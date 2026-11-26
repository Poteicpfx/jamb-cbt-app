import { supabase } from './supabase';
import { localDb } from './dexie';
import type { Question, Subject } from '../types/exam.types';

export async function fetchLiveAlocQuestions(
  subjects: Subject[],
  countPerSubject: number
): Promise<Question[]> {
  const { data, error } = await supabase.functions.invoke('aloc-live-exam', {
    body: {
      subjects: subjects.map((s) => ({
        subject_id: s.id,
        code: s.code,
        count: countPerSubject,
      })),
    },
  });

  if (error) {
    throw new Error(error.message || 'Could not reach live ALOC server.');
  }

  const questions = (data?.questions ?? []) as Question[];
  if (questions.length > 0) {
    await localDb.questions.bulkPut(questions);
  }
  return questions;
}
