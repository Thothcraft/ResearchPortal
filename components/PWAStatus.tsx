'use client';

import { useEffect, useState } from 'react';
import { Download, WifiOff, X } from 'lucide-react';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function PWAStatus() {
  const [online, setOnline] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    const installHandler = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt); };
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    window.addEventListener('beforeinstallprompt', installHandler);
    return () => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
      window.removeEventListener('beforeinstallprompt', installHandler);
    };
  }, []);

  if (hidden || (online && !installPrompt)) return null;
  return (
    <div className="fixed inset-x-3 bottom-20 z-50 flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white shadow-2xl md:bottom-5 md:left-auto md:max-w-sm">
      {online ? <Download className="h-5 w-5 text-cyan-300" /> : <WifiOff className="h-5 w-5 text-amber-300" />}
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{online ? 'Install Thoth Portal' : 'Offline mode'}</div>
        <div className="text-xs text-slate-300">{online ? 'Add this portal to your device.' : 'Showing the latest cached device and capture data.'}</div>
      </div>
      {online && installPrompt && <button className="rounded-lg bg-cyan-300 px-3 py-1.5 font-semibold text-slate-950" onClick={async () => { await installPrompt.prompt(); setInstallPrompt(null); }}>Install</button>}
      <button aria-label="Dismiss" onClick={() => setHidden(true)}><X className="h-4 w-4" /></button>
    </div>
  );
}
