import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { syncPendingAttempts } from '../lib/syncEngine';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingAttempts().catch(() => {});
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-xs font-semibold text-slate-950">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>Offline Mode — Downloaded subjects still work! Results sync automatically later.</span>
    </div>
  );
}
