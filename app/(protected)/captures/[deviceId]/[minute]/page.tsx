'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

type Asset = { file_id: number; filename: string; kind?: string; content_type?: string };

function frameImage(frame: any, fallback: any) {
  if (Array.isArray(frame?.z)) return frame.z;
  if (!Array.isArray(frame?.z_shape) || !Array.isArray(frame?.z_sparse)) return fallback;
  const rows = Number(frame.z_shape[0]) || 0;
  const columns = Number(frame.z_shape[1]) || 0;
  const image = Array.from({ length: rows }, () => Array(columns).fill(0));
  frame.z_sparse.forEach((cell: unknown) => {
    if (!Array.isArray(cell)) return;
    const row = Number(cell[0]), column = Number(cell[1]);
    if (image[row] && column >= 0 && column < columns) image[row][column] = Number(cell[2]) || 0;
  });
  return image;
}

function Heatmap({ payload, tracking = false }: { payload: any; tracking?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const frames = Array.isArray(payload?.frames) && payload.frames.length ? payload.frames : [payload];
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(frames.length > 1);
  const [occupancyThreshold, setOccupancyThreshold] = useState(Number(payload?.occupancy?.threshold_percent ?? 50));
  const latest = frames[Math.min(frameIndex, frames.length - 1)] || payload;
  const confirmed = latest?.detected === true;
  const snr = Number(latest?.snr_db);
  const threshold = Number(latest?.threshold_db ?? payload?.threshold_db);
  const detectedFrames = Number(payload?.occupancy?.detected_frames) || 0;
  const evaluatedFrames = Number(payload?.occupancy?.evaluated_frames) || 0;
  const detectedPercent = evaluatedFrames ? detectedFrames * 100 / evaluatedFrames : 0;
  const occupancyLabel = evaluatedFrames > 0 && detectedPercent >= occupancyThreshold ? 'occupied' : 'empty';
  useEffect(() => {
    const canvas = ref.current;
    const z = frameImage(latest, payload?.z);
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
  }, [latest, payload]);
  useEffect(() => {
    setFrameIndex(0);
    setPlaying(frames.length > 1);
    setOccupancyThreshold(Number(payload?.occupancy?.threshold_percent ?? 50));
  }, [payload, frames.length]);
  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const timer = window.setInterval(() => setFrameIndex((current) => (current + 1) % frames.length), Number(payload?.frame_interval_ms) || 120);
    return () => window.clearInterval(timer);
  }, [frames.length, payload?.frame_interval_ms, playing]);
  return <div className="space-y-3">
    <canvas ref={ref} width={640} height={360} className="h-auto w-full bg-slate-950" />
    {frames.length > 1 && <div className="flex items-center gap-3 text-xs text-slate-600">
      <button type="button" onClick={() => setPlaying((value) => !value)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold hover:bg-slate-50">{playing ? 'Pause' : 'Play'}</button>
      <input aria-label="Localization frame" type="range" min={0} max={frames.length - 1} value={frameIndex} onChange={(event) => { setPlaying(false); setFrameIndex(Number(event.target.value)); }} className="min-w-0 flex-1 accent-cyan-600" />
      <span className="w-20 text-right font-mono">{frameIndex + 1} / {frames.length}</span>
    </div>}
    {tracking && <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className={`rounded-full px-2.5 py-1 font-semibold ${confirmed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
        {confirmed ? 'Target detected' : 'No current target'}
      </span>
      {Number.isFinite(snr) && Number.isFinite(threshold) && <span className="font-mono text-slate-600">
        SNR {snr.toFixed(1)} dB / threshold {threshold.toFixed(1)} dB
      </span>}
      {payload?.occupancy && <span className="font-semibold capitalize text-slate-700">
        Minute: {occupancyLabel} — {detectedFrames} / {evaluatedFrames} frames detected ({Math.round(detectedPercent * 10) / 10}%)
      </span>}
      {payload?.occupancy && <label className="flex items-center gap-2 font-medium text-slate-600">
        Occupied at ≥
        <input aria-label="Occupancy threshold percentage" type="number" min={0} max={100} step={1} value={occupancyThreshold} onChange={(event) => setOccupancyThreshold(Math.min(100, Math.max(0, Number(event.target.value) || 0)))} className="w-16 rounded-md border border-slate-300 px-2 py-1 text-right" />%
      </label>}
    </div>}
  </div>;
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
  const viewable = next.filter((asset) => asset.kind === 'xy-tracking' || asset.kind === 'xy_tracking' || /^(predictions|manifest)\.json$/i.test(asset.filename));
  const entries = await Promise.all(viewable.map(async (asset) => {
    const result = await fetch(`/api/proxy/file/${asset.file_id}?download=false`, { headers, cache: 'no-store' });
    const key = asset.kind === 'xy-tracking' || asset.kind === 'xy_tracking' ? asset.kind : asset.filename.toLowerCase();
    return [key!, await result.json()] as const;
  }));
  setDocuments(Object.fromEntries(entries));
    const video = next.find((asset) => asset.content_type?.startsWith('video/') || /\.mp4$/i.test(asset.filename));
    if (video && !videoUrl) {
      const result = await fetch(`/api/proxy/file/${video.file_id}?download=false`, { headers });
      setVideoUrl(URL.createObjectURL(await result.blob()));
    }
    setWaiting(!next.some((asset) => asset.kind === 'xy-tracking' || asset.kind === 'xy_tracking'));
  }, [params.deviceId, params.minute, user?.token, videoUrl]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 2500);
    return () => window.clearInterval(timer);
  }, [load]);

  const predictions = documents['predictions.json'];
  const manifest = documents['manifest.json'];
  const predictionTimeline = Array.isArray(predictions?.timeline) ? predictions.timeline : [];
  const expectedChunks = 6;
  const predictionByIndex = new Map<number, any>(predictionTimeline.map((entry: any): [number, any] => [Number(entry?.chunk_index), entry]));
  const manifestByIndex = new Map<number, any>((manifest?.outputs?.radar?.chunks || []).map((entry: any): [number, any] => [Number(entry?.chunk_index), entry]));

  return <div className="space-y-6 text-slate-950">
    <header className="border border-slate-300 bg-white p-5"><div className="text-xs font-semibold uppercase text-slate-600">Uploaded capture</div><h1 className="mt-1 font-mono text-2xl font-semibold">{params.minute}</h1><p className="mt-2 text-sm text-slate-700">Device {params.deviceId}</p></header>
    {waiting && <div className="border border-cyan-300 bg-cyan-50 p-4 text-sm">This capture is not available yet. The page refreshes automatically.</div>}
    <section className="border border-slate-300 bg-white p-4"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Chunk predictions</h2></div><div className="flex items-start gap-2">{Array.from({ length: expectedChunks }, (_, index) => { const entry: any = predictionByIndex.get(index); const chunk: any = manifestByIndex.get(index); const pending = String(chunk?.status || 'waiting'); const state = entry ? (entry.occupied === true ? 'occupied' : 'empty') : pending; const color = state === 'occupied' ? 'bg-emerald-500' : state === 'empty' ? 'bg-red-500' : state === 'collecting' ? 'animate-pulse bg-blue-500' : ['stored', 'analyzing'].includes(state) ? 'animate-pulse bg-cyan-500' : state === 'error' ? 'bg-amber-500' : 'bg-slate-300'; const location = Array.isArray(entry?.location) ? entry.location.join(', ') : 'n/a'; const detail = [`Chunk ${index + 1}`, entry?.ratio == null ? null : `ratio ${(Number(entry.ratio) * 100).toFixed(1)}%`, `coordinates ${location}`, entry?.score == null ? null : `confidence ${entry.score}`, chunk?.error].filter(Boolean).join(' · '); return <div key={index} className="min-w-0 flex-1 text-center" title={detail}><div role="img" tabIndex={0} title={detail} aria-label={`Chunk ${index + 1} status indicator`} className={`mx-auto h-3 w-3 rounded-full ${color}`} /></div>; })}</div></section>
    <section className="border border-slate-300 bg-white p-4"><h2 className="mb-3 font-semibold">X / Y localization</h2>{documents['xy-tracking'] || documents['xy_tracking'] ? <Heatmap payload={documents['xy-tracking'] || documents['xy_tracking']} tracking /> : <div className="p-8 text-sm text-slate-500">Not available</div>}</section>
    <section className="border border-slate-300 bg-white p-4"><h2 className="mb-3 font-semibold">Camera video</h2>{videoUrl ? <video controls src={videoUrl} className="max-h-[70vh] w-full bg-black" /> : <div className="p-8 text-sm text-slate-500">No camera video in this minute.</div>}</section>
    <div className="text-xs text-slate-500">{assets.length} cloud assets</div>
  </div>;
}
