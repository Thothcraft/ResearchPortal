'use client';

type Props = {
  address: string;
  online: boolean;
};

export default function DevicePresence3D({ address, online }: Props) {
  const host = address.trim();
  let source = '';
  if (host) {
    try {
      const url = new URL(host.includes('://') ? host : `http://${host}`);
      if (!url.port) {
        url.port = '5000';
      }
      source = `${url.origin}/presence?embed=1`;
    } catch {
      source = host.startsWith('http') ? `${host.replace(/\/$/, '')}/presence?embed=1` : `http://${host}:5000/presence?embed=1`;
    }
  }

  return (
    <section className="border-b border-slate-200 bg-slate-950">
      <div className="flex items-center justify-between px-5 py-3 text-white">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Live presence</div>
          <div className="mt-1 text-sm text-slate-300">3D occupancy, 2D localization, and room calibration</div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${online ? 'bg-emerald-400/15 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
          {online ? 'Live' : 'Offline'}
        </span>
      </div>
      {source && online ? (
        <iframe
          title="Live 3D presence"
          src={source}
          className="h-[620px] w-full border-0 bg-slate-950"
          loading="lazy"
          allow="fullscreen"
        />
      ) : (
        <div className="grid h-40 place-items-center border-t border-slate-800 text-sm text-slate-400">
          The device must be online with a reachable LAN address.
        </div>
      )}
    </section>
  );
}
