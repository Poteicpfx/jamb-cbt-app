import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, BookOpenCheck, Clock, LogOut, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { SubjectSelector } from '../subjects/SubjectSelector';
import { OfflinePacksPanel } from '../offline/OfflinePacksPanel';
import { supabase } from '../../lib/supabase';
import { localDb } from '../../lib/dexie';
import type { Subject } from '../../types/exam.types';

export function DashboardPage() {
  const { profile, user, signOut } = useAuth();
  const [editingSubjects, setEditingSubjects] = useState(false);
  const [mySubjects, setMySubjects] = useState<Subject[]>([]);

  const hasCombo = (profile?.selected_subjects?.length ?? 0) === 4;

  useEffect(() => {
    async function loadChosen() {
      if (!profile?.selected_subjects?.length) {
        setMySubjects([]);
        return;
      }

      if (navigator.onLine) {
        const { data } = await supabase
          .from('subjects')
          .select('*')
          .in('id', profile.selected_subjects);
        if (data) {
          setMySubjects(data as Subject[]);
          return;
        }
      }

      const cached = await localDb.subjects
        .where('id')
        .anyOf(profile.selected_subjects)
        .toArray();
      setMySubjects(cached);
    }

    loadChosen();
  }, [profile]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <h1 className="text-base font-bold text-slate-900">
              Welcome, {profile?.full_name || user?.email}
            </h1>
            <p className="text-xs text-slate-500">
              Target UTME Score:{' '}
              <span className="font-semibold text-emerald-800">{profile?.target_score ?? 280}/400</span>
              {profile?.role === 'admin' && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  <ShieldCheck className="h-3 w-3" /> ADMIN
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {profile?.role === 'admin' && (
              <Link
                to="/admin"
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Admin Portal
              </Link>
            )}
            <button
              type="button"
              onClick={signOut}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <section className="grid gap-4 sm:grid-cols-3">
          <Link
            to="/exam-setup?mode=mock"
            className="block rounded-2xl bg-emerald-900 p-5 text-white shadow-sm transition hover:bg-emerald-800"
          >
            <Clock className="h-6 w-6 text-emerald-200" />
            <h3 className="mt-3 font-bold">Timed Mock Exam</h3>
            <p className="mt-1 text-xs text-emerald-100">
              Start 4-subject UTME simulator with calculator &amp; timer.
            </p>
          </Link>

          <Link
            to="/exam-setup?mode=practice"
            className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300"
          >
            <BookOpenCheck className="h-6 w-6 text-emerald-700" />
            <h3 className="mt-3 font-bold text-slate-900">Past Questions &amp; Practice</h3>
            <p className="mt-1 text-xs text-slate-600">
              Practice one subject at a time &amp; review explanations.
            </p>
          </Link>

          <Link
            to="/analytics"
            className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300"
          >
            <BarChart3 className="h-6 w-6 text-emerald-700" />
            <h3 className="mt-3 font-bold text-slate-900">Results &amp; Progress</h3>
            <p className="mt-1 text-xs text-slate-600">
              View past scores, subject strengths &amp; sync status.
            </p>
          </Link>
        </section>

        {!hasCombo || editingSubjects ? (
          <SubjectSelector onSaved={() => setEditingSubjects(false)} />
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Your JAMB Subject Combination</h2>
              <button
                type="button"
                onClick={() => setEditingSubjects(true)}
                className="flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" /> Change Subjects
              </button>
            </div>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 md:grid-cols-4">
              {mySubjects.map((s) => (
                <div key={s.id} className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-xs font-bold text-emerald-900">{s.name}</p>
                  <p className="text-[11px] text-emerald-700">{s.default_exam_count} questions</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {hasCombo && mySubjects.length > 0 && <OfflinePacksPanel subjects={mySubjects} />}
      </main>
    </div>
  );
}
