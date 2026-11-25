import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart3, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { localDb } from '../../lib/dexie';
import { syncPendingAttempts } from '../../lib/syncEngine';
import { useAuth } from '../auth/AuthContext';
import type { ExamAttemptRecord } from '../../types/exam.types';

export function AnalyticsPage() {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<ExamAttemptRecord[]>([]);
  const [syncing, setSyncing] = useState(false);

  async function loadAttempts() {
    if (!user) return;
    const rows = await localDb.examAttempts.where('user_id').equals(user.id).toArray();
    rows.sort((a, b) => b.completed_at.localeCompare(a.completed_at));
    setAttempts(rows);
  }

  useEffect(() => {
    loadAttempts();
  }, [user]);

  async function handleSync() {
    setSyncing(true);
    try {
      await syncPendingAttempts();
      await loadAttempts();
    } finally {
      setSyncing(false);
    }
  }

  const mocks = attempts.filter((a) => a.jamb_scaled_score !== null);
  const avgMock =
    mocks.length > 0
      ? Math.round(mocks.reduce((sum, a) => sum + (a.jamb_scaled_score ?? 0), 0) / mocks.length)
      : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="rounded-lg border border-slate-200 p-2 text-slate-600">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-slate-900">Performance History</h1>
              <p className="text-xs text-slate-500">Track scores &amp; offline sync status</p>
            </div>
          </div>

          <button
            type="button"
            disabled={syncing}
            onClick={handleSync}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            Sync Now
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Total Exams Taken</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{attempts.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Avg. UTME Mock Score</p>
            <p className="mt-1 text-2xl font-extrabold text-emerald-800">
              {avgMock !== null ? `${avgMock} / 400` : '—'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Pending Cloud Sync</p>
            <p className="mt-1 text-2xl font-extrabold text-amber-600">
              {attempts.filter((a) => a.sync_status === 'pending').length}
            </p>
          </div>
        </div>

        {attempts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <BarChart3 className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm font-semibold text-slate-700">No exams taken yet</p>
            <Link
              to="/exam-setup"
              className="mt-3 inline-block rounded-lg bg-emerald-800 px-4 py-2 text-xs font-bold text-white"
            >
              Take Your First Exam
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {attempts.map((a) => (
              <Link
                key={a.client_attempt_id}
                to={`/results/${a.client_attempt_id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {a.mode === 'mock' ? 'JAMB Timed Mock' : 'Practice Session'} —{' '}
                    <span className="text-emerald-800">
                      {a.jamb_scaled_score !== null
                        ? `${a.jamb_scaled_score}/400`
                        : `${a.score}/${a.total_questions}`}
                    </span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="h-3 w-3" />
                    {new Date(a.completed_at).toLocaleString()}
                  </p>
                </div>

                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    a.sync_status === 'synced'
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {a.sync_status === 'synced' ? 'Synced' : 'Saved Offline'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
