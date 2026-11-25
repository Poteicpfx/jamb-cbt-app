import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Trophy, XCircle } from 'lucide-react';
import { localDb } from '../../lib/dexie';
import { MathText } from '../../components/MathText';
import type { ExamAttemptRecord, Question, Subject } from '../../types/exam.types';

export function ResultsPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [attempt, setAttempt] = useState<ExamAttemptRecord | null>(null);
  const [questionMap, setQuestionMap] = useState<Map<string, Question>>(new Map());
  const [subjectMap, setSubjectMap] = useState<Map<string, Subject>>(new Map());

  useEffect(() => {
    async function load() {
      if (!attemptId) return;
      const found = await localDb.examAttempts.get(attemptId);
      if (!found) return;
      setAttempt(found);

      const qIds = found.answers.map((a) => a.question_id);
      const [qs, subs] = await Promise.all([
        localDb.questions.where('id').anyOf(qIds).toArray(),
        localDb.subjects.where('id').anyOf(found.subject_ids).toArray(),
      ]);

      setQuestionMap(new Map(qs.map((q) => [q.id, q])));
      setSubjectMap(new Map(subs.map((s) => [s.id, s])));
    }
    load();
  }, [attemptId]);

  if (!attempt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-sm text-slate-600">
        Loading exam results...
      </div>
    );
  }

  const percent = Math.round((attempt.score / attempt.total_questions) * 100);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <Link to="/analytics" className="text-xs font-bold text-emerald-800 hover:underline">
            All History →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <section className="rounded-2xl bg-emerald-900 p-6 text-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
                {attempt.mode === 'mock' ? 'UTME Mock Score' : 'Practice Result'}
              </p>
              <h1 className="mt-1 text-3xl font-extrabold">
                {attempt.jamb_scaled_score !== null
                  ? `${attempt.jamb_scaled_score} / 400`
                  : `${attempt.score} / ${attempt.total_questions}`}
              </h1>
              <p className="mt-1 text-xs text-emerald-100">
                Raw Correct: {attempt.score}/{attempt.total_questions} ({percent}%) • Time:{' '}
                {Math.floor(attempt.duration_seconds / 60)}m {attempt.duration_seconds % 60}s
              </p>
            </div>
            <Trophy className="h-12 w-12 text-amber-300" />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Subject Breakdown</h2>
          <div className="mt-3 space-y-3">
            {attempt.subject_ids.map((sId) => {
              const sub = subjectMap.get(sId);
              const subAns = attempt.answers.filter((a) => a.subject_id === sId);
              const correct = subAns.filter((a) => a.is_correct).length;
              const pct = subAns.length ? Math.round((correct / subAns.length) * 100) : 0;

              return (
                <div key={sId}>
                  <div className="flex justify-between text-xs font-semibold">
                    <span>{sub?.name ?? 'Subject'}</span>
                    <span>
                      {correct}/{subAns.length} ({pct}%)
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-emerald-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Review Answers &amp; Explanations</h2>
          {attempt.answers.map((ans, idx) => {
            const q = questionMap.get(ans.question_id);
            if (!q) return null;

            return (
              <div key={q.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Question {idx + 1}</span>
                  {ans.is_correct ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> Correct
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600">
                      <XCircle className="h-4 w-4" /> Incorrect
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm text-slate-900">
                  <MathText text={q.stem} />
                </p>

                <div className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2">
                  {q.options.map((opt) => {
                    const isCorrectOpt = opt.key === q.correct_option;
                    const isPicked = opt.key === ans.selected_option;
                    return (
                      <div
                        key={opt.key}
                        className={`rounded-lg border px-2.5 py-1.5 ${
                          isCorrectOpt
                            ? 'border-emerald-400 bg-emerald-50 font-semibold text-emerald-950'
                            : isPicked
                              ? 'border-red-300 bg-red-50 text-red-800'
                              : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        <span className="mr-1.5 font-bold">{opt.key}.</span>
                        <MathText text={opt.text} />
                      </div>
                    );
                  })}
                </div>

                {q.explanation && (
                  <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                    <span className="font-bold text-slate-900">Explanation: </span>
                    <MathText text={q.explanation} />
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
