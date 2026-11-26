import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  DownloadCloud,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { localDb } from '../../lib/dexie';
import { downloadSubjectPack } from '../../lib/syncEngine';
import type { Subject } from '../../types/exam.types';

const CLOUD_COUNTS_CACHE = 'utme_subject_cloud_counts';

export function AllSubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [cloudCounts, setCloudCounts] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(CLOUD_COUNTS_CACHE);
      return saved ? (JSON.parse(saved) as Record<string, number>) : {};
    } catch {
      return {};
    }
  });
  const [offlineCounts, setOfflineCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadAll = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setStatusMsg(null);

    try {
      let list: Subject[] = [];

      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('subjects')
          .select('*')
          .eq('is_active', true)
          .order('is_mandatory', { ascending: false })
          .order('name');

        if (!error && data) {
          list = data as Subject[];
          // Cache subject metadata locally without erasing download timestamps
          for (const sub of list) {
            const existing = await localDb.subjects.get(sub.id);
            await localDb.subjects.put({ ...existing, ...sub });
          }

          // Fetch live published question count for each subject
          const countPairs = await Promise.all(
            list.map(async (sub) => {
              const { count } = await supabase
                .from('questions')
                .select('id', { count: 'exact', head: true })
                .eq('subject_id', sub.id)
                .eq('is_published', true);
              return [sub.id, count ?? 0] as const;
            })
          );

          const nextCloud = Object.fromEntries(countPairs);
          setCloudCounts(nextCloud);
          localStorage.setItem(CLOUD_COUNTS_CACHE, JSON.stringify(nextCloud));
        }
      }

      if (list.length === 0) {
        list = await localDb.subjects.orderBy('name').toArray();
      }

      setSubjects(list);

      const offPairs = await Promise.all(
        list.map(async (sub) => {
          const count = await localDb.questions.where('subject_id').equals(sub.id).count();
          return [sub.id, count] as const;
        })
      );
      setOfflineCounts(Object.fromEntries(offPairs));

      if (isManualRefresh) {
        setStatusMsg(
          navigator.onLine
            ? 'Subjects and live question counts refreshed!'
            : 'Offline mode: showing cached subject counts.'
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAll(false);
  }, [loadAll]);

  async function handleSyncSubject(sub: Subject) {
    if (!navigator.onLine) {
      setStatusMsg('Connect to the internet to download or update this subject.');
      return;
    }
    setSyncingId(sub.id);
    setStatusMsg(null);
    try {
      const count = await downloadSubjectPack(sub);
      setOfflineCounts((prev) => ({ ...prev, [sub.id]: count }));
      setCloudCounts((prev) => ({ ...prev, [sub.id]: count }));
      setStatusMsg(`Synced ${sub.name}: ${count} question(s) saved offline.`);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setSyncingId(null);
    }
  }

  const totalCloud = Object.values(cloudCounts).reduce((a, b) => a + b, 0);
  const totalOffline = Object.values(offlineCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-slate-900">All Available Subjects</h1>
              <p className="text-xs text-slate-500">
                {subjects.length} subjects • {totalCloud} total questions ({totalOffline} offline)
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={refreshing || loading}
            onClick={() => loadAll(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-900 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        {statusMsg && (
          <div className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
            {statusMsg}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
            Loading all subjects &amp; question counts...
          </div>
        ) : (
          <div className="space-y-2.5">
            {subjects.map((sub) => {
              const cloudCount = cloudCounts[sub.id] ?? 0;
              const offCount = offlineCounts[sub.id] ?? 0;
              const isSynced = offCount > 0 && offCount === cloudCount;
              const isBusy = syncingId === sub.id;

              return (
                <div
                  key={sub.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                        {sub.code}
                      </span>
                      <h2 className="text-sm font-bold text-slate-900">{sub.name}</h2>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                        <Database className="h-3.5 w-3.5 text-emerald-700" />
                        {cloudCount} in bank
                      </span>
                      <span>•</span>
                      <span>{offCount} saved offline</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleSyncSubject(sub)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      isSynced
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        : 'bg-emerald-800 text-white hover:bg-emerald-900'
                    }`}
                  >
                    {isBusy ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing...
                      </>
                    ) : isSynced ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Up to date
                      </>
                    ) : (
                      <>
                        <DownloadCloud className="h-3.5 w-3.5" /> Refresh Pack
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
