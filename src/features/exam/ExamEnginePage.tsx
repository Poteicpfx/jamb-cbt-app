import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calculator,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Grid,
  Send,
  X,
} from 'lucide-react';
import { localDb } from '../../lib/dexie';
import { syncPendingAttempts } from '../../lib/syncEngine';
import { useAuth } from '../auth/AuthContext';
import { CalculatorModal } from '../../components/CalculatorModal';
import { MathText } from '../../components/MathText';
import type {
  ActiveExamSession,
  AttemptAnswerRecord,
  ExamAttemptRecord,
  OptionKey,
  Question,
  Subject,
} from '../../types/exam.types';

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function formatTimer(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hrs, mins, secs].map((v) => String(v).padStart(2, '0')).join(':');
}

export function ExamEnginePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [session, setSession] = useState<ActiveExamSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [remainingSecs, setRemainingSecs] = useState(0);
  const [showCalc, setShowCalc] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function init() {
      const active = await localDb.activeSessions.get('current');
      if (!active) {
        navigate('/exam-setup', { replace: true });
        return;
      }

      const [qsRaw, subsRaw] = await Promise.all([
        localDb.questions.where('id').anyOf(active.question_ids).toArray(),
        localDb.subjects.where('id').anyOf(active.subject_ids).toArray(),
      ]);

      const qMap = new Map(qsRaw.map((q) => [q.id, q]));
      const orderedQs = active.question_ids
        .map((id) => qMap.get(id))
        .filter((q): q is Question => Boolean(q));

      const sMap = new Map(subsRaw.map((s) => [s.id, s]));
      const orderedSubs = active.subject_ids
        .map((id) => sMap.get(id))
        .filter((s): s is Subject => Boolean(s));

      setSession(active);
      setQuestions(orderedQs);
      setSubjects(orderedSubs);
      setRemainingSecs(Math.max(0, Math.floor((active.end_timestamp - Date.now()) / 1000)));
    }
    init();
  }, [navigate]);

  const submitExam = useCallback(async () => {
    if (!session || !user || submitting) return;
    setSubmitting(true);

    const completedAt = new Date();
    const durationSeconds = Math.max(
      1,
      Math.floor((completedAt.getTime() - new Date(session.started_at).getTime()) / 1000)
    );

    let totalCorrect = 0;
    const perSubject: Record<string, { correct: number; total: number }> = {};

    const answers: AttemptAnswerRecord[] = questions.map((q) => {
      const picked = session.answers[q.id] ?? null;
      const isCorrect = picked === q.correct_option;
      if (isCorrect) totalCorrect += 1;

      if (!perSubject[q.subject_id]) perSubject[q.subject_id] = { correct: 0, total: 0 };
      perSubject[q.subject_id].total += 1;
      if (isCorrect) perSubject[q.subject_id].correct += 1;

      return {
        question_id: q.id,
        subject_id: q.subject_id,
        selected_option: picked,
        is_correct: isCorrect,
        time_spent_seconds: 0,
      };
    });

    let scaledScore: number | null = null;
    if (session.mode === 'mock') {
      scaledScore = Math.round(
        Object.values(perSubject).reduce(
          (acc, st) => acc + (st.total > 0 ? (st.correct / st.total) * 100 : 0),
          0
        )
      );
    }

    const attempt: ExamAttemptRecord = {
      client_attempt_id: makeUuid(),
      user_id: user.id,
      mode: session.mode,
      subject_ids: session.subject_ids,
      total_questions: questions.length,
      score: totalCorrect,
      jamb_scaled_score: scaledScore,
      duration_seconds: durationSeconds,
      started_at: session.started_at,
      completed_at: completedAt.toISOString(),
      answers,
      sync_status: 'pending',
    };

    await localDb.examAttempts.put(attempt);
    await localDb.activeSessions.delete('current');
    syncPendingAttempts().catch(() => {});
    navigate(`/results/${attempt.client_attempt_id}`, { replace: true });
  }, [session, user, submitting, questions, navigate]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => {
      const secs = Math.max(0, Math.floor((session.end_timestamp - Date.now()) / 1000));
      setRemainingSecs(secs);
      if (secs === 0) {
        window.clearInterval(timer);
        submitExam();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session, submitExam]);

  const currentQuestion = questions[session?.current_index ?? 0];

  async function updateSession(patch: Partial<ActiveExamSession>) {
    if (!session) return;
    const updated = { ...session, ...patch };
    setSession(updated);
    await localDb.activeSessions.put(updated);
  }

  function selectOption(opt: OptionKey) {
    if (!session || !currentQuestion) return;
    updateSession({ answers: { ...session.answers, [currentQuestion.id]: opt } });
  }

  function toggleFlag() {
    if (!session || !currentQuestion) return;
    const exists = session.flagged_ids.includes(currentQuestion.id);
    const next = exists
      ? session.flagged_ids.filter((id) => id !== currentQuestion.id)
      : [...session.flagged_ids, currentQuestion.id];
    updateSession({ flagged_ids: next });
  }

  function goToIndex(idx: number) {
    if (!session || idx < 0 || idx >= questions.length) return;
    updateSession({ current_index: idx });
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (showCalc || showSubmit) return;
      const key = e.key.toUpperCase();
      if (key === 'A' || key === 'B' || key === 'C' || key === 'D') selectOption(key);
      else if (key === 'N' || e.key === 'ArrowRight') goToIndex((session?.current_index ?? 0) + 1);
      else if (key === 'P' || e.key === 'ArrowLeft') goToIndex((session?.current_index ?? 0) - 1);
      else if (key === 'R') toggleFlag();
      else if (key === 'S') setShowSubmit(true);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const activeSubjectId = currentQuestion?.subject_id;
  const subjectQuestions = useMemo(
    () =>
      questions
        .map((q, globalIdx) => ({ q, globalIdx }))
        .filter((item) => item.q.subject_id === activeSubjectId),
    [questions, activeSubjectId]
  );

  if (!session || !currentQuestion) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
        Loading CBT exam engine...
      </div>
    );
  }

  const answeredCount = Object.keys(session.answers).length;
  const isFlagged = session.flagged_ids.includes(currentQuestion.id);
  const selectedOpt = session.answers[currentQuestion.id];
  const timerBadge =
    remainingSecs < 300
      ? 'bg-red-100 text-red-700'
      : remainingSecs < 900
        ? 'bg-amber-100 text-amber-800'
        : 'bg-emerald-50 text-emerald-800';
  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5">
          <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-xs font-bold ${timerBadge}`}>
            <Clock className="h-3.5 w-3.5" />
            <span>{formatTimer(remainingSecs)}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCalc(true)}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Calculator className="h-4 w-4 text-emerald-700" />
              <span className="hidden sm:inline">Calculator</span>
            </button>
            <button
              type="button"
              onClick={() => setShowGrid(true)}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 lg:hidden"
            >
              <Grid className="h-4 w-4" />
              <span>{answeredCount}/{questions.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSubmit(true)}
              className="flex items-center gap-1 rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-900"
            >
              <Send className="h-3.5 w-3.5" /> Submit
            </button>
          </div>
        </div>

        <div className="mx-auto flex max-w-6xl gap-1.5 overflow-x-auto border-t border-slate-100 px-3 py-2">
          {subjects.map((sub) => {
            const firstIdx = questions.findIndex((q) => q.subject_id === sub.id);
            const active = sub.id === activeSubjectId;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => firstIdx >= 0 && goToIndex(firstIdx)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  active ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {sub.code}
              </button>
            );
          })}
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-4 p-3 pb-20 lg:grid-cols-3 lg:p-6">
        <section className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2 lg:p-6">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-emerald-800">
                Question {session.current_index + 1} of {questions.length}
              </span>
              <button
                type="button"
                onClick={toggleFlag}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  isFlagged ? 'bg-amber-100 text-amber-800' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <Flag className="h-3.5 w-3.5" /> {isFlagged ? 'Flagged' : 'Flag'}
              </button>
            </div>

            <div className="mt-4 text-sm leading-relaxed text-slate-900 md:text-base">
              <MathText text={currentQuestion.stem} />
            </div>

            {currentQuestion.image_url && (
              <img
                src={currentQuestion.image_url}
                alt="Question diagram"
                className="mt-3 max-h-56 rounded-xl border border-slate-200 object-contain"
              />
            )}

            <div className="mt-5 space-y-2.5">
              {currentQuestion.options.map((opt) => {
                const chosen = selectedOpt === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => selectOption(opt.key)}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-sm transition ${
                      chosen
                        ? 'border-emerald-700 bg-emerald-50 font-semibold text-emerald-950'
                        : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        chosen ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {opt.key}
                    </span>
                    <span className="pt-0.5"><MathText text={opt.text} /></span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 hidden items-center justify-between border-t border-slate-100 pt-4 lg:flex">
            <button
              type="button"
              disabled={session.current_index === 0}
              onClick={() => goToIndex(session.current_index - 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Previous (P)
            </button>
            <span className="text-[11px] text-slate-400">Keys: A-D answer | N/P move | R flag | S submit</span>
            <button
              type="button"
              disabled={session.current_index === questions.length - 1}
              onClick={() => goToIndex(session.current_index + 1)}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              Next (N) <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        <aside className="hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:block">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Question Palette ({answeredCount}/{questions.length})
          </h2>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {subjectQuestions.map(({ q, globalIdx }, idxInSub) => {
              const isCurrent = globalIdx === session.current_index;
              const isAns = Boolean(session.answers[q.id]);
              const isFlg = session.flagged_ids.includes(q.id);
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => goToIndex(globalIdx)}
                  className={`h-9 rounded-lg text-xs font-bold ${
                    isCurrent
                      ? 'ring-2 ring-emerald-800 bg-emerald-900 text-white'
                      : isFlg
                        ? 'bg-amber-400 text-slate-950'
                        : isAns
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {idxInSub + 1}
                </button>
              );
            })}
          </div>
        </aside>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2.5 lg:hidden">
        <button
          type="button"
          disabled={session.current_index === 0}
          onClick={() => goToIndex(session.current_index - 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        <button
          type="button"
          onClick={() => setShowGrid(true)}
          className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700"
        >
          Q {session.current_index + 1}/{questions.length}
        </button>
        <button
          type="button"
          disabled={session.current_index === questions.length - 1}
          onClick={() => goToIndex(session.current_index + 1)}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </footer>

      {showGrid && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 lg:hidden">
          <div className="w-full rounded-t-2xl bg-white p-5">
            <div className="flex items-center justify-between pb-3">
              <h3 className="text-sm font-bold">Jump to Question</h3>
              <button type="button" onClick={() => setShowGrid(false)} className="p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid max-h-64 grid-cols-6 gap-2 overflow-y-auto py-2">
              {subjectQuestions.map(({ q, globalIdx }, idxInSub) => {
                const isCurrent = globalIdx === session.current_index;
                const isAns = Boolean(session.answers[q.id]);
                const isFlg = session.flagged_ids.includes(q.id);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      goToIndex(globalIdx);
                      setShowGrid(false);
                    }}
                    className={`h-10 rounded-lg text-xs font-bold ${
                      isCurrent
                        ? 'bg-emerald-900 text-white'
                        : isFlg
                          ? 'bg-amber-400 text-slate-950'
                          : isAns
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {idxInSub + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Submit Examination?</h3>
            <p className="mt-1.5 text-xs text-slate-600">
              You have answered <strong>{answeredCount}</strong> out of{' '}
              <strong>{questions.length}</strong> questions.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSubmit(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Continue Exam
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={submitExam}
                className="rounded-lg bg-emerald-800 px-4 py-2 text-xs font-bold text-white"
              >
                {submitting ? 'Grading...' : 'Yes, Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCalc && <CalculatorModal onClose={() => setShowCalc(false)} />}
    </div>
  );
}
