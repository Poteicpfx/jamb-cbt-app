import { useEffect, useState } from 'react';
import { CheckCircle2, DownloadCloud, Loader2, RefreshCw } from 'lucide-react';
import { localDb } from '../../lib/dexie';
import { downloadSubjectPack } from '../../lib/syncEngine';
import type { Subject } from '../../types/exam.types';

interface PackStats {
  downloadedCount: number;
  lastSyncedAt?: string;
}

export function OfflinePacksPanel({ subjects }: { subjects: Subject[] }) {
  const [stats, setStats] = useState<Record<string, PackStats>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshLocalCounts() {
    const nextStats: Record<string, PackStats> = {};
    for (const subject of subjects) {
      const count = await localDb.questions.where('subject_id').equals(subject.id).count();
      const localSub = await localDb.subjects.get(subject.id);
      nextStats[subject.id] = {
        downloadedCount: count,
        lastSyncedAt: localSub?.last_synced_at,
      };
    }
    setStats(nextStats);
  }

  useEffect(() => {
    if (subjects.length > 0) {
      refreshLocalCounts();
    }
  }, [subjects]);

  async function handleDownload(subject: Subject) {
    if (!navigator.onLine) {
      setMessage('You need an internet connection to download a new subject pack.');
      return;
    }

    setDownloadingId(subject.id);
    setMessage(null);
    try {
      const count = await downloadSubjectPack(subject);
      await refreshLocalCounts();
      setMessage(`Downloaded ${subject.name} (${count} question${count === 1 ? '' : 's'}) for offline use.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Offline Subject Packs</h2>
          <p className="text-xs text-slate-500">
            Download your subjects once so you can take CBT exams without mobile data.
          </p>
        </div>
      </div>

      {message && (
        <div className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-xs font-medium text-emerald-800">
          {message}
        </div>
      )}

      <div className="mt-4 space-y-2.5">
        {subjects.map((subject) => {
          const info = stats[subject.id];
          const isDownloaded = Boolean(info?.lastSyncedAt);
          const isBusy = downloadingId === subject.id;

          return (
            <div
              key={subject.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{subject.name}</p>
                <p className="text-xs text-slate-500">
                  {isDownloaded
                    ? `${info.downloadedCount} question(s) saved offline`
                    : 'Not downloaded yet'}
                </p>
              </div>

              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleDownload(subject)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  isDownloaded
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    : 'bg-emerald-800 text-white hover:bg-emerald-900'
                }`}
              >
                {isBusy ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Downloading...
                  </>
                ) : isDownloaded ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <RefreshCw className="h-3 w-3" /> Update Pack
                  </>
                ) : (
                  <>
                    <DownloadCloud className="h-3.5 w-3.5" /> Download Offline
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
