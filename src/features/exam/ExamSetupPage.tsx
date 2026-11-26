import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpenCheck, Clock, Loader2, Play, RotateCcw } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { localDb } from '../../lib/dexie';
import { supabase } from '../../lib/supabase';
import { downloadSubjectPack } from '../../lib/syncEngine';
import { fetchLiveAlocQuestions } from '../../lib/alocLive';
import type { ActiveExamSession, ExamMode, QuestionType, Subject } from '../../types/exam.types';

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function ExamSetupPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'practice' ? 'practice' : 'mock';

  const [mode, setMode] = useState<ExamMode>(initialMode);
  const [source, setSource] = useState<'offline' | 'aloc'>('offline');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [localCounts, setLocalCounts] = useState<Record<string, number>>({});
  const [practiceSubjectId, setPracticeSubjectId] = useState('');
  const [practiceType, setPracticeType] = useState<'all' | QuestionType>('all');
  const [practiceMinutes, setPracticeMinutes] = useState(20);
  const [existingSession, setExistingSession] = useState<ActiveExamSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const active = await localDb.activeSessions.get('current');
      if (active) setExistingSession(active);

      const selectedIds = profile?.selected_subjects ?? [];
      let loadedSubjects: Subject[] = [];

      if (selectedIds.length > 0) {
        if (navigator.onLine) {
          const { data } = await supabase.from('subjects').select('*').in('id', selectedIds);
          if (data) loadedSubjects = data as Subject[];
        }
        if (loadedSubjects.length === 0) {
          loadedSubjects = await localDb.subjects.where('id').anyOf(selectedIds).toArray();
        }
      }

      loadedSubjects.sort((a, b) => Number(b.is_mandatory) - Number(a.is_mandatory));
      setSubjects(loadedSubjects);
      if (loadedSubjects.length > 0) setPracticeSubjectId(loadedSubjects[0].id);

      const counts: Record<string, number> = {};
      for (const s of loadedSubjects) {
        counts[s.id] = await localDb.questions.where('subject_id').equals(s.id).count();
      }
      setLocalCounts(counts);
      setLoading(false);
    }
    load();
  }, [profile]);

  async function syncMissingPacks() {
    if (!navigator.onLine) {
      setErrorMsg('You are offline. Download subject packs when connected to the internet.');
      return;
    }
    setStarting(true);
    setErrorMsg(null);
    try {
      const nextCounts: Record<string, number> = { ...localCounts };
      for (const s of subjects) {
        nextCounts[s.id] = await downloadSubjectPack(s);
      }
      setLocalCounts(nextCounts);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to sync packs.');
    } finally {
      setStarting(false);
    }
  }

  async function handleStartExam() {
    setErrorMsg(null);
    setStarting(true);

    try {
      let chosenSubjectIds: string[] = [];
      let pickedQuestionIds: string[] = [];
      let durationMinutes = 120;

      const targetSubjects =
        mode === 'mock'
          ? subjects
          : subjects.filter((s) => s.id === practiceSubjectId);

      chosenSubjectIds = targetSubjects.map((s) => s.id);
      durationMinutes = mode === 'mock' ? 120 : practiceMinutes;

      if (source === 'aloc') {
        if (!navigator.onLine) {
          setErrorMsg('Live ALOC mode requires internet. Switch to Offline Bank to practice offline.');
          setStarting(false);
          return;
        }
        const liveQs = await fetchLiveAlocQuestions(targetSubjects, mode === 'mock' ? undefined : 40);
        for (const sub of targetSubjects) {
          let subQs = liveQs.filter((q) => q.subject_id === sub.id);
          if (subQs.length === 0) {
            subQs = await localDb.questions.where('subject_id').equals(sub.id).toArray();
          }
          pickedQuestionIds.push(...shuffle(subQs).slice(0, sub.default_exam_count).map((q) => q.id));
        }
      } else if (mode === 'mock') {
        for (const sub of targetSubjects) {
          const qs = await localDb.questions.where('subject_id').equals(sub.id).toArray();
          pickedQuestionIds.push(...shuffle(qs).slice(0, sub.default_exam_count).map((q) => q.id));
        }
      } else {
        let qs = await localDb.questions.where('subject_id').equals(practiceSubjectId).toArray();
        if (practiceType !== 'all') {
          qs = qs.filter((q) => q.question_type === practiceType);
        }
        pickedQuestionIds = shuffle(qs).slice(0, 40).map((q) => q.id);
      }

      if (pickedQuestionIds.length === 0) {
        setErrorMsg(
          'No downloaded questions found for your selection. Tap "Sync Latest Questions" below or add questions in Admin.'
        );
        setStarting(false);
        return;
      }

      const now = Date.now();
      const session: ActiveExamSession = {
        id: 'current',
        mode,
        subject_ids: chosenSubjectIds,
        question_ids: pickedQuestionIds,
        answers: {},
        flagged_ids: [],
        current_index: 0,
        started_at: new Date(now).toISOString(),
        end_timestamp: now + durationMinutes * 60 * 1000,
      };

      await localDb.activeSessions.put(session);
      navigate('/exam');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to start exam.');
    } finally {
      setStarting(false);
    }
  }

  const totalOffline = Object.values(localCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-slate-900">Start CBT Examination</h1>
            <p className="text-xs text-slate-500">Runs offline using your downloaded subject packs</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        {existingSession && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <div>
              <p className="text-sm font-bold text-amber-950">Unfinished Exam Found</p>
              <p className="text-xs text-amber-800">
                You have an in-progress {existingSession.mode.toUpperCase()} session ({Object.keys(existingSession.answers).length}/{existingSession.question_ids.length} answered).
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  await localDb.activeSessions.delete('current');
                  setExistingSession(null);
                }}
                className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => navigate('/exam')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Resume Exam
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking offline question packs...
          </div>
        ) : subjects.length < 4 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm">
            <p className="font-semibold">Please select your 4 JAMB subjects on the Dashboard first.</p>
            <Link to="/" className="mt-3 inline-block rounded-lg bg-emerald-800 px-4 py-2 text-xs font-semibold text-white">
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {/* Mode Toggle */}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMode('mock')}
                className={`flex items-center justify-center gap-2 rounded-lg py-2.5 ${
                  mode === 'mock' ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                <Clock className="h-4 w-4" /> Timed JAMB Mock
              </button>
              <button
                type="button"
                onClick={() => setMode('practice')}
                className={`flex items-center justify-center gap-2 rounded-lg py-2.5 ${
                  mode === 'practice' ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                <BookOpenCheck className="h-4 w-4" /> Practice / Past Qs
              </button>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-700">Question Source</p>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setSource('offline')}
                  className={"rounded-lg py-2 " + (source === 'offline' ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-600')}
                >
                  Offline Bank
                </button>
                <button
                  type="button"
                  onClick={() => setSource('aloc')}
                  className={"rounded-lg py-2 " + (source === 'aloc' ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-600')}
                >
                  Live ALOC (13,800+ Qs)
                </button>
              </div>
            </div>

            {mode === 'mock' ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Simulates the official 4-subject UTME CBT exam (<strong>120 minutes</strong>, scaled out of <strong>400</strong>).
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {subjects.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                      <span className="text-xs font-bold text-slate-900">{s.name}</span>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                        {localCounts[s.id] ?? 0} saved
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Subject</label>
                  <select
                    value={practiceSubjectId}
                    onChange={(e) => setPracticeSubjectId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({localCounts[s.id] ?? 0})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Question Filter</label>
                  <select
                    value={practiceType}
                    onChange={(e) => setPracticeType(e.target.value as 'all' | QuestionType)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                  >
                    <option value="all">All Questions</option>
                    <option value="past">Past Questions Only</option>
                    <option value="practice">Practice Questions Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Timer (Minutes)</label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={practiceMinutes}
                    onChange={(e) => setPracticeMinutes(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                  />
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">
                {errorMsg}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                disabled={starting}
                onClick={syncMissingPacks}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Sync Latest Questions ({totalOffline} local)
              </button>

              <button
                type="button"
                disabled={starting}
                onClick={handleStartExam}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-900 disabled:opacity-60"
              >
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Start Exam Now
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
