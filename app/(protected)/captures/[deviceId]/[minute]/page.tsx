'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

type Asset = { file_id: number; filename: string; kind?: string; content_type?: string };

function Heatmap({ payload }: { payload: any }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const z = payload?.z || payload?.frames?.at(-1)?.z;
    if (!canvas || !Array.isArray(z) || !z.length) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rows = z.length;
    const cols = Math.max(...z.map((row: unknown[]) => row?.length || 0));
    const values = z.flat().filter(Number.isFinite) as number[];
    const min = Math.min(...values), max = Math.max(...values);
    z.forEach((row: number[], y: number) => row.forEach((value, x) => {
      const t = (value - min) / (max - min || 1);
      ctx.fillStyle = `hsl(${240 - t * 240} 90% 50%)`;
      ctx.fillRect(x * canvas.width / cols, y * canvas.height / rows, canvas.width / cols + 1, canvas.height / rows + 1);
    }));
  }, [payload]);
  return <canvas ref={ref} width={640} height={360} className="h-auto w-full bg-slate-950" />;
}

function LinePlot({ points }: { points: number[] }) {
  const clean = (points || []).filter(Number.isFinite);
  const min = Math.min(...clean), max = Math.max(...clean);
  const path = clean.map((v, i) => `${i ? 'L' : 'M'} ${i * 800 / Math.max(1, clean.length - 1)} ${240 - (v - min) * 220 / (max - min || 1)}`).join(' ');
  return <svg viewBox="0 0 800 260" className="w-full bg-slate-950"><path d={path} fill="none" stroke="#22d3ee" strokeWidth="2" /></svg>;
}

export default function CaptureViewerPage() {
  const params = useParams<{ deviceId: string; minute: string }>();
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [documents, setDocuments] = useState<Record<string, any>>({});
  const [videoUrl, setVideoUrl] = useState('');
  const [waiting, setWaiting] = useState(true);

  const load = useCallback(async () => {
    if (!user?.token) return;
    const headers = { Authorization: `Bearer ${user.token}` };
    const response = await fetch(`/api/proxy/file/minute/${encodeURIComponent(params.minute)}/assets?device_id=${encodeURIComponent(params.deviceId)}`, { headers, cache: 'no-store' });
    const data = await response.json();
    const next: Asset[] = Array.isArray(data.assets) ? data.assets : [];
    setAssets(next);
    const viewable = next.filter((asset) => asset.kind?.startsWith('radar-') || asset.kind === 'csi-plot');
    const entries = await Promise.all(viewable.map(async (asset) => {
      const result = await fetch(`/api/proxy/file/${asset.file_id}?download=false`, { headers, cache: 'no-store' });
      return [asset.kind!, await result.json()] as const;
    }));
    setDocuments(Object.fromEntries(entries));
    const video = next.find((asset) => asset.content_type?.startsWith('video/') || /\.mp4$/i.test(asset.filename));
    if (video && !videoUrl) {
      const result = await fetch(`/api/proxy/file/${video.file_id}?download=false`, { headers });
      setVideoUrl(URL.createObjectURL(await result.blob()));
    }
    setWaiting(viewable.length < 1);
  }, [params.deviceId, params.minute, user?.token, videoUrl]);

  useEffect(() => { load(); const timer = window.setInterval(load, 5000); return () => window.clearInterval(timer); }, [load]);

  const plots = ['range-doppler', 'azimuth-range', 'azimuth-doppler', 'xy-tracking'];
  return <div className="space-y-6 text-slate-950">
    <header className="border border-slate-300 bg-white p-5"><div className="text-xs font-semibold uppercase text-slate-600">Uploaded capture</div><h1 className="mt-1 font-mono text-2xl font-semibold">{params.minute}</h1><p className="mt-2 text-sm text-slate-700">Device {params.deviceId}</p></header>
    {waiting && <div className="border border-cyan-300 bg-cyan-50 p-4 text-sm">Waiting for the online Pi to upload and prepare this minute. This page refreshes automatically.</div>}
    <div className="grid gap-5 lg:grid-cols-2">{plots.map((plot) => <section key={plot} className="border border-slate-300 bg-white p-4"><h2 className="mb-3 font-semibold">{plot.replaceAll('-', ' ')}</h2>{documents[`radar-${plot}`] ? <Heatmap payload={documents[`radar-${plot}`]} /> : <div className="p-8 text-sm text-slate-500">Not available</div>}</section>)}</div>
    <section className="border border-slate-300 bg-white p-4"><h2 className="mb-3 font-semibold">CSI amplitude</h2>{documents['csi-plot'] ? <LinePlot points={documents['csi-plot'].points || []} /> : <div className="p-8 text-sm text-slate-500">Not available</div>}</section>
    <section className="border border-slate-300 bg-white p-4"><h2 className="mb-3 font-semibold">Camera video</h2>{videoUrl ? <video controls src={videoUrl} className="max-h-[70vh] w-full bg-black" /> : <div className="p-8 text-sm text-slate-500">No camera video in this minute.</div>}</section>
    <div className="text-xs text-slate-500">{assets.length} cloud assets</div>
  </div>;
}
