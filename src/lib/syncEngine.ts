import { supabase } from './supabase';
import { localDb } from './dexie';
import type { Passage, Question, Subject, Topic } from '../types/exam.types';

export async function downloadSubjectPack(subject: Subject): Promise<number> {
  const { data: manifest } = await supabase
    .from('offline_pack_manifests')
    .select('pack_version')
    .eq('subject_id', subject.id)
    .maybeSingle();

  const [topicsRes, passagesRes] = await Promise.all([
    supabase.from('topics').select('id, subject_id, name').eq('subject_id', subject.id),
    supabase.from('passages').select('id, subject_id, title, content, exam_year').eq('subject_id', subject.id),
  ]);

  if (topicsRes.error) throw topicsRes.error;
  if (passagesRes.error) throw passagesRes.error;

  // Paginate questions in chunks of 1000 so large subjects never truncate
  const questions: Question[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('subject_id', subject.id)
      .eq('is_published', true)
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    const batch = (data ?? []) as Question[];
    questions.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  const topics = (topicsRes.data ?? []) as Topic[];
  const passages = (passagesRes.data ?? []) as Passage[];

  await localDb.transaction(
    'rw',
    localDb.subjects,
    localDb.topics,
    localDb.passages,
    localDb.questions,
    async () => {
      await localDb.topics.where('subject_id').equals(subject.id).delete();
      await localDb.passages.where('subject_id').equals(subject.id).delete();
      await localDb.questions.where('subject_id').equals(subject.id).filter((q) => !q.id.startsWith('aloc-')).delete();

      if (topics.length) await localDb.topics.bulkPut(topics);
      if (passages.length) await localDb.passages.bulkPut(passages);
      if (questions.length) await localDb.questions.bulkPut(questions);

      await localDb.subjects.put({
        ...subject,
        downloaded_version: manifest?.pack_version ?? 1,
        last_synced_at: new Date().toISOString(),
      });
    }
  );

  return questions.length;
}

export async function syncPendingAttempts(): Promise<number> {
  if (!navigator.onLine) return 0;

  const pending = await localDb.examAttempts
    .where('sync_status')
    .equals('pending')
    .toArray();

  let syncedCount = 0;

  for (const attempt of pending) {
    const { data: insertedAttempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .upsert(
        {
          client_attempt_id: attempt.client_attempt_id,
          user_id: attempt.user_id,
          mode: attempt.mode,
          subject_ids: attempt.subject_ids,
          total_questions: attempt.total_questions,
          score: attempt.score,
          jamb_scaled_score: attempt.jamb_scaled_score,
          duration_seconds: attempt.duration_seconds,
          started_at: attempt.started_at,
          completed_at: attempt.completed_at,
        },
        { onConflict: 'client_attempt_id' }
      )
      .select('id')
      .single();

    if (attemptError || !insertedAttempt) continue;

    const dbAnswers = attempt.answers.filter((a) => !a.question_id.startsWith('aloc-'));
    if (dbAnswers.length > 0) {
      await supabase.from('attempt_answers').insert(
        dbAnswers.map((ans) => ({
          attempt_id: insertedAttempt.id,
          question_id: ans.question_id,
          subject_id: ans.subject_id,
          selected_option: ans.selected_option,
          is_correct: ans.is_correct,
          time_spent_seconds: ans.time_spent_seconds,
        }))
      );
    }

    await localDb.examAttempts.update(attempt.client_attempt_id, {
      sync_status: 'synced',
    });
    syncedCount += 1;
  }

  return syncedCount;
}
