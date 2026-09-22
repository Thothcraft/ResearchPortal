'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';

type Asset = { file_id: number; filename: string; kind?: string; content_type?: string };

function secondDotStyle(state: string, classification?: string | number) {
  const background = state === 'occupied' || classification === 'green'
    ? 'hsl(145 68% 39%)'
    : state === 'empty' || classification === 'red'
      ? 'hsl(4 76% 51%)'
      : 'hsl(217 88% 55%)';
  return { background, boxShadow: `0 0 0 1px color-mix(in srgb, ${background} 55%, transparent)`, transition: 'background-color .45s ease, box-shadow .45s ease' };
}

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

function viridis(value: number) {
  const stops = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];
  const scaled = Math.max(0, Math.min(1, value)) * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(scaled));
  const amount = scaled - index;
  return stops[index].map((channel, offset) => Math.round(channel + (stops[index + 1][offset] - channel) * amount));
}

function CompactXYMap({ map }: { map: any }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const rows = Number(map?.rows || 0);
    const columns = Number(map?.columns || 0);
    const values = Array.isArray(map?.values) ? map.values : [];
    if (!canvas || !rows || !columns || values.length !== rows * columns) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const image = context.createImageData(columns, rows);
    values.forEach((raw: number, sourceIndex: number) => {
      const sourceRow = Math.floor(sourceIndex / columns);
      const column = sourceIndex % columns;
      const destinationIndex = ((rows - 1 - sourceRow) * columns + column) * 4;
      const [red, green, blue] = viridis((Number(raw) || 0) / 255);
      image.data[destinationIndex] = red;
      image.data[destinationIndex + 1] = green;
      image.data[destinationIndex + 2] = blue;
      image.data[destinationIndex + 3] = 255;
    });
    const buffer = document.createElement('canvas');
    buffer.width = columns;
    buffer.height = rows;
    buffer.getContext('2d')?.putImageData(image, 0, 0);
    context.imageSmoothingEnabled = true;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(buffer, 0, 0, canvas.width, canvas.height);
  }, [map]);
  return <div className="bg-slate-950 p-2">
    <canvas ref={ref} width={512} height={512} className="aspect-square h-auto w-full" />
    <div className="mt-2 flex items-center gap-2 text-[10px] font-medium text-slate-300">
      <span>0</span>
      <span className="h-1.5 flex-1 rounded-full" style={{ background: 'linear-gradient(90deg,#440154,#3b528b,#21918c,#5ec962,#fde725)' }} />
      <span>1 normalized intensity</span>
    </div>
  </div>;
}

function normalizeSecond(entry: any, fallbackIndex = 0) {
  const occupancy = entry?.occupancy && typeof entry.occupancy === 'object' ? entry.occupancy : {};
  const index = Number((entry?.second_index ?? entry?.chunk_index) ?? entry?.index ?? fallbackIndex);
  const status = String(entry?.status || entry?.state || occupancy?.label || 'loading');
  const state = status === 'occupied' || status === 'empty'
    ? status
    : status === 'waiting'
      ? 'waiting'
      : status === 'error'
        ? 'error'
        : 'loading';
  const locationValue = entry?.location;
  const location = Array.isArray(locationValue)
    ? { x: Number(locationValue[0]), y: Number(locationValue[1]) }
    : locationValue;
  return {
    index,
    state,
    classification: occupancy?.classification || entry?.classification || (state === 'occupied' ? 'green' : state === 'empty' ? 'red' : undefined),
    prediction: occupancy?.label || entry?.prediction || (state === 'loading' ? 'processing' : state === 'error' ? 'analysis error' : state),
    detectedFrames: Number(occupancy?.detected_frames ?? entry?.detected_frames ?? entry?.detectedFrames ?? 0),
    evaluatedFrames: Number(occupancy?.evaluated_frames ?? entry?.evaluated_frames ?? entry?.evaluatedFrames ?? 0),
    ratio: Number(occupancy?.ratio ?? entry?.ratio ?? 0),
    peopleCount: Number(entry?.people_count ?? entry?.peopleCount ?? 0),
    score: entry?.score == null ? null : Number(entry.score),
    location,
    targets: Array.isArray(entry?.targets) ? entry.targets : [],
    labels: Array.isArray(entry?.labels) ? entry.labels : [],
    activityLabels: Array.isArray(entry?.activity_labels ?? entry?.activityLabels) ? (entry.activity_labels ?? entry.activityLabels) : [],
    xyMap: entry?.xy_map || entry?.xyMap || entry?.analysis?.xy_map,
    cameraFilename: entry?.camera_filename || entry?.cameraFilename,
    error: entry?.error,
  };
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
  const threshold = Number(latest?.threshold_normalized ?? payload?.threshold_normalized);
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    z.forEach((row: number[], y: number) => row.forEach((value, x) => {
      const t = Math.max(0, Math.min(1, Number(value) || 0));
      const [red, green, blue] = viridis(t);
      ctx.fillStyle = `rgb(${red} ${green} ${blue})`;
      ctx.fillRect(x * canvas.width / cols, (rows - 1 - y) * canvas.height / rows, canvas.width / cols + 1, canvas.height / rows + 1);
    }));
    if (tracking) {
      const room = payload?.room || {};
      const width = Number(room.width_m) || Number(payload?.x?.at?.(-1)) || 1;
      const depth = Number(room.depth_m) || Number(payload?.y?.at?.(-1)) || 1;
      const point = (x: number, y: number) => [x * canvas.width / width, canvas.height - y * canvas.height / depth];
      ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 3; ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
      const cones = Array.isArray(room.radar_cones) && room.radar_cones.length ? room.radar_cones : [{ wall: room.sensor_wall || 'Back', position_m: room.sensor_position_m || width / 2, horizontal_deg: 40, range_m: 15 }];
      cones.filter((cone: any) => cone.enabled !== false).forEach((cone: any) => {
        const wall = cone.wall || 'Back', position = Number(cone.position_m || 0);
        const origin = wall === 'Back' ? [position, 0] : wall === 'Front' ? [position, depth] : wall === 'Left' ? [0, position] : [width, position];
        const heading = wall === 'Back' ? 90 : wall === 'Front' ? -90 : wall === 'Left' ? 0 : 180;
        const center = (heading + Number(cone.azimuth_deg || 0)) * Math.PI / 180;
        const half = Number(cone.horizontal_deg || 40) * Math.PI / 360, range = Number(cone.range_m || 15);
        const ends = [-half, half].map((offset) => [origin[0] + Math.cos(center + offset) * range, origin[1] + Math.sin(center + offset) * range]);
        const o = point(origin[0], origin[1]), a = point(ends[0][0], ends[0][1]), b = point(ends[1][0], ends[1][1]);
        ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.closePath(); ctx.fillStyle = 'rgba(34,211,238,.14)'; ctx.fill(); ctx.strokeStyle = '#22d3ee'; ctx.stroke();
      });
      (room.furniture || []).forEach((item: any) => { const a = point(Number(item.x || 0), Number(item.y || 0) + Number(item.depth || .8)); const b = point(Number(item.x || 0) + Number(item.width || .8), Number(item.y || 0)); ctx.fillStyle = 'rgba(168,162,158,.35)'; ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); });
      (room.zones || []).forEach((zone: any) => { const a = point(Number(zone.x || 0), Number(zone.y || 0) + Number(zone.depth || 1)); const b = point(Number(zone.x || 0) + Number(zone.width || 1), Number(zone.y || 0)); ctx.fillStyle = `${zone.color || '#22c55e'}22`; ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); ctx.strokeStyle = zone.color || '#22c55e'; ctx.lineWidth = 2; ctx.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); ctx.fillStyle = zone.color || '#22c55e'; ctx.font = 'bold 14px sans-serif'; ctx.fillText(String(zone.label || 'Zone'), a[0] + 7, a[1] + 18); });
      const targets = Array.isArray(latest?.targets) ? latest.targets : [];
      targets.forEach((target: any) => { const position = target?.position || []; if (!Number.isFinite(Number(position[0])) || !Number.isFinite(Number(position[1]))) return; const p = point(Number(position[0]), Number(position[1])); const error = Number(target.position_error_m || 0); ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(7, error * canvas.width / width), 0, Math.PI * 2); ctx.fillStyle = 'rgba(239,68,68,.24)'; ctx.fill(); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'; ctx.fillText(`T${target.id} ${Number(position[0]).toFixed(2)},${Number(position[1]).toFixed(2)} ±${error.toFixed(2)}m`, p[0] + 10, p[1] - 10); });
    }
  }, [latest, payload, tracking]);
  useEffect(() => {
    setFrameIndex(0);
    setPlaying(frames.length > 1);
    setOccupancyThreshold(Number(payload?.occupancy?.threshold_percent ?? 50));
  }, [payload, frames.length]);
  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const timer = window.setInterval(() => setFrameIndex((current) => (current + 1) % frames.length), Math.min(750, Number(payload?.frame_interval_ms) || 120));
    return () => window.clearInterval(timer);
  }, [frames.length, payload?.frame_interval_ms, playing]);
  return <div className="space-y-3">
    <canvas ref={ref} width={720} height={720} className="mx-auto h-auto w-full max-w-3xl bg-slate-950" />
    {tracking && <div className="mx-auto flex max-w-3xl items-center gap-3 text-[11px] font-mono text-slate-600"><span>0</span><div className="h-2 flex-1 rounded-full" style={{ background: 'linear-gradient(90deg,#440154,#3b528b,#21918c,#5ec962,#fde725)' }} /><span>1 normalized intensity</span></div>}
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
        Normalized gate {threshold.toFixed(2)} / diagnostic SNR {snr.toFixed(1)} dB
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

type SensorWindow = {
  sensor: string;
  hz?: number;
  t_ns: number[];
  real: boolean[];
  amp?: number[][][];      // csi: [G, rx, sc]
  values?: number[][];     // sense: [G, channels]
  channels?: any;          // csi: subcarrier count; sense: channel names
  source_index?: number[]; // radar/camera: held source index
};

const SENSOR_TABS = [
  { id: 'radar', label: 'Radar' },
  { id: 'csi', label: 'CSI' },
  { id: 'camera', label: 'Camera' },
  { id: 'sense', label: 'Sense' },
] as const;

/** Timeline strip: one cell per grid tick, bright = measured, dim = held/interpolated. */
function RealMaskStrip({ real, cursorIndex, onSeek, count }: { real: boolean[]; cursorIndex: number; onSeek: (i: number) => void; count: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !count) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = real[i] ? '#22d3ee' : '#334155';
      const x = i * w / count;
      ctx.fillRect(x, 0, Math.max(1, w / count), h);
    }
    // cursor
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(cursorIndex * w / count, 0, Math.max(2, w / count), h);
  }, [real, cursorIndex, count]);
  return (
    <canvas
      ref={ref}
      width={800}
      height={36}
      className="h-9 w-full cursor-crosshair rounded bg-slate-950"
      onClick={(e) => {
        const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
        const frac = (e.clientX - rect.left) / rect.width;
        onSeek(Math.max(0, Math.min(count - 1, Math.round(frac * count))));
      }}
    />
  );
}

/** CSI amplitude heatmap for one grid tick: rows = receivers, cols = subcarriers. */
function CsiHeatmap({ amp }: { amp: number[][] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !Array.isArray(amp) || !amp.length) return;
    const rows = amp.length;
    const cols = Math.max(...amp.map((r) => (Array.isArray(r) ? r.length : 0)));
    if (!cols) return;
    const flat = amp.flat();
    const max = Math.max(...flat.map(Number), 1e-6);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    amp.forEach((row, y) => row.forEach((v, x) => {
      const [r, g, b] = viridis((Number(v) || 0) / max);
      ctx.fillStyle = `rgb(${r} ${g} ${b})`;
      ctx.fillRect(x * canvas.width / cols, y * canvas.height / rows, canvas.width / cols + 1, canvas.height / rows + 1);
    }));
  }, [amp]);
  return <canvas ref={ref} width={520} height={Math.max(40, amp.length * 40)} className="w-full rounded bg-slate-950" />;
}

function SensorScrubber({ minute, deviceId, token, durationSeconds }: { minute: string; deviceId: string; token?: string | null; durationSeconds: number }) {
  const [sensor, setSensor] = useState<string>('csi');
  const [window, setWindow] = useState<SensorWindow | null>(null);
  const [cursor, setCursor] = useState(0); // seconds offset into the minute
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [senseChannel, setSenseChannel] = useState(0);
  const [cameraUrl, setCameraUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setUnavailable(false);
    fetch(`/api/proxy/file/minute/${encodeURIComponent(minute)}/container/sensor/${sensor}?device_id=${encodeURIComponent(deviceId)}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => { if (!cancelled) setWindow(d?.window || null); })
      .catch(() => { if (!cancelled) { setWindow(null); setUnavailable(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sensor, minute, deviceId, token]);

  const count = window?.t_ns?.length || 0;
  const hz = Number(window?.hz) || 1;
  const cursorIndex = count ? Math.min(count - 1, Math.max(0, Math.round(cursor * hz))) : 0;
  const isReal = Boolean(window?.real?.[cursorIndex]);

  // Camera: the held source index is the synchronized second; fetch that frame.
  const cameraSecond = sensor === 'camera' && window?.source_index ? Number(window.source_index[cursorIndex] ?? 0) : null;
  useEffect(() => {
    if (cameraSecond == null || !token) { setCameraUrl(null); return; }
    let cancelled = false;
    fetch(`/api/proxy/file/minute/${encodeURIComponent(minute)}/container/camera/${cameraSecond}?device_id=${encodeURIComponent(deviceId)}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    })
      .then((r) => (r.ok ? r.blob() : Promise.reject(r.status)))
      .then((blob) => { if (!cancelled) setCameraUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); }); })
      .catch(() => { if (!cancelled) setCameraUrl(null); });
    return () => { cancelled = true; };
  }, [cameraSecond, minute, deviceId, token]);
  useEffect(() => () => { if (cameraUrl) URL.revokeObjectURL(cameraUrl); }, [cameraUrl]);

  const senseChannels: string[] = sensor === 'sense' && Array.isArray(window?.channels) ? window.channels : [];
  const senseSeries: number[] = sensor === 'sense' && window?.values
    ? window.values.map((row) => Number(row?.[senseChannel]) || 0)
    : [];

  return (
    <section className="border border-slate-300 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Minute explorer</div>
          <h2 className="mt-1 text-xl font-semibold">Per-sensor time scrubber</h2>
        </div>
        <div className="flex gap-1">
          {SENSOR_TABS.map((tab) => (
            <button key={tab.id} type="button" onClick={() => setSensor(tab.id)}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${sensor === tab.id ? 'border-cyan-600 bg-cyan-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {unavailable && (
        <div className="rounded border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          This capture predates the resampled-grid schema, so per-sensor time windows are unavailable.
        </div>
      )}
      {loading && <div className="p-4 text-sm text-slate-500">Loading {sensor} grid…</div>}

      {!loading && window && count > 0 && (
        <div className="space-y-3">
          <RealMaskStrip real={window.real || []} cursorIndex={cursorIndex} count={count} onSeek={(i) => setCursor(i / hz)} />
          <div className="flex items-center gap-3 text-xs">
            <input aria-label="Minute position" type="range" min={0} max={Math.max(1, durationSeconds)}
              step={1 / hz} value={cursor}
              onChange={(e) => setCursor(Number(e.target.value))} className="min-w-0 flex-1 accent-cyan-600" />
            <span className="w-24 text-right font-mono">{cursor.toFixed(2)}s</span>
            <span className={`rounded-full px-2 py-0.5 font-semibold ${isReal ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
              {isReal ? 'measured' : 'held'}
            </span>
          </div>

          {sensor === 'csi' && window.amp && (
            <div>
              <div className="mb-1 text-[11px] font-medium text-slate-500">CSI amplitude · {window.amp[cursorIndex]?.length || 0} receiver(s) × {window.amp[cursorIndex]?.[0]?.length || 0} subcarriers</div>
              <CsiHeatmap amp={window.amp[cursorIndex] || []} />
            </div>
          )}

          {sensor === 'sense' && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs">
                <label className="font-medium text-slate-600">Channel</label>
                <select value={senseChannel} onChange={(e) => setSenseChannel(Number(e.target.value))} className="rounded border border-slate-300 px-2 py-1">
                  {senseChannels.map((name, i) => <option key={name} value={i}>{name}</option>)}
                </select>
                <span className="font-mono text-slate-700">{Number(senseSeries[cursorIndex] || 0).toFixed(3)}</span>
              </div>
              <LinePlot points={senseSeries} />
            </div>
          )}

          {sensor === 'camera' && (
            <div>
              <div className="mb-1 text-[11px] font-medium text-slate-500">Camera frame · second {cameraSecond ?? '—'}</div>
              {cameraUrl
                ? <img src={cameraUrl} alt={`Camera at ${cursor.toFixed(2)}s`} className="max-h-[50vh] w-full rounded bg-black object-contain" />
                : <div className="rounded border border-dashed border-slate-300 p-6 text-sm text-slate-500">No camera frame held at this time.</div>}
            </div>
          )}

          {sensor === 'radar' && (
            <div className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Radar grid index <strong>{cursorIndex}</strong> → source frame <strong>{window.source_index?.[cursorIndex] ?? '—'}</strong>.
              Frame-level radar playback uses the localization heatmap below.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default function CaptureViewerPage() {
  const params = useParams<{ deviceId: string; minute: string }>();
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [documents, setDocuments] = useState<Record<string, any>>({});
  const [videoUrl, setVideoUrl] = useState('');
  const [containerMetadata, setContainerMetadata] = useState<any>(null);
  const [cameraSecond, setCameraSecond] = useState(0);
  const [cameraUrl, setCameraUrl] = useState('');
  const [cameraPlaying, setCameraPlaying] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [liveSeconds, setLiveSeconds] = useState<any[]>([]);
  const [storedSeconds, setStoredSeconds] = useState<any[]>([]);
  const liveCursor = useRef<string | null>(null);
  const liveLoading = useRef(false);
  const containerLoaded = useRef(false);
  const videoLoaded = useRef(false);

  const load = useCallback(async () => {
    if (!user?.token) return;
    const headers = { Authorization: `Bearer ${user.token}` };
    const response = await fetch(`/api/proxy/file/minute/${encodeURIComponent(params.minute)}/assets?device_id=${encodeURIComponent(params.deviceId)}`, { headers, cache: 'no-store' });
    if (!response.ok) {
      setWaiting(false);
      return;
    }
    const data = await response.json();
    const next: Asset[] = Array.isArray(data.assets) ? data.assets : [];
    setAssets(next);
    const viewable = next.filter((asset) => ['xy-tracking', 'xy_tracking', 'manifest', 'predictions'].includes(String(asset.kind)) || /(?:^|_)(predictions|manifest)\.json$/i.test(asset.filename));
    const entries = (await Promise.all(viewable.map(async (asset) => {
      const result = await fetch(`/api/proxy/file/${asset.file_id}?download=false`, { headers, cache: 'no-store' });
      if (!result.ok) return null;
      const key = asset.kind === 'xy-tracking' || asset.kind === 'xy_tracking'
        ? asset.kind
        : asset.kind === 'manifest' || /(?:^|_)manifest\.json$/i.test(asset.filename)
          ? 'manifest.json'
          : 'predictions.json';
      return [key, await result.json()] as const;
    }))).filter((entry) => entry !== null) as Array<readonly [string, any]>;
    setDocuments((current) => ({ ...current, ...Object.fromEntries(entries) }));
    const container = next.find((asset) => asset.kind === 'synchronized-container' || /capture\.npz$/i.test(asset.filename));
    if (container && !containerLoaded.current) {
      const metadataResponse = await fetch(`/api/proxy/file/minute/${encodeURIComponent(params.minute)}/container/metadata?device_id=${encodeURIComponent(params.deviceId)}`, { headers, cache: 'no-store' });
      if (metadataResponse.ok) {
        const payload = await metadataResponse.json();
        containerLoaded.current = true;
        setContainerMetadata(payload.metadata || null);
        const firstCameraSecond = (payload.metadata?.seconds || []).find((second: any) => Number(second?.camera_frames || 0) > 0);
        if (firstCameraSecond) setCameraSecond(Number(firstCameraSecond.second_index));
        if (payload.metadata?.manifest) {
          setDocuments((current) => ({ ...current, 'manifest.json': payload.metadata.manifest }));
        }
      }
    }
    const video = next.find((asset) => asset.content_type?.startsWith('video/') || /\.mp4$/i.test(asset.filename));
    if (video && !videoLoaded.current) {
      videoLoaded.current = true;
      const result = await fetch(`/api/proxy/file/${video.file_id}?download=false`, { headers });
      if (result.ok) setVideoUrl(URL.createObjectURL(await result.blob()));
      else videoLoaded.current = false;
    }
    const hasManifest = next.some((asset) => asset.kind === 'manifest' || /(?:^|_)manifest\.json$/i.test(asset.filename));
    setWaiting(!hasManifest && (!container || !containerLoaded.current));
  }, [params.deviceId, params.minute, user?.token]);

  const cameraSeconds = useMemo(() => (Array.isArray(containerMetadata?.seconds) ? containerMetadata.seconds : [])
    .filter((second: any) => Number(second?.camera_frames || 0) > 0)
    .map((second: any) => Number(second.second_index)), [containerMetadata]);

  useEffect(() => {
    if (!user?.token || !cameraSeconds.includes(cameraSecond)) {
      setCameraUrl('');
      return;
    }
    let objectUrl = '';
    let cancelled = false;
    fetch(`/api/proxy/file/minute/${encodeURIComponent(params.minute)}/container/camera/${cameraSecond}?device_id=${encodeURIComponent(params.deviceId)}`, {
      headers: { Authorization: `Bearer ${user.token}` },
      cache: 'no-store',
    }).then(async (response) => {
      if (!response.ok || cancelled) return;
      objectUrl = URL.createObjectURL(await response.blob());
      if (!cancelled) setCameraUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return objectUrl;
      });
      else URL.revokeObjectURL(objectUrl);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [cameraSecond, cameraSeconds, params.deviceId, params.minute, user?.token]);

  useEffect(() => () => {
    if (cameraUrl) URL.revokeObjectURL(cameraUrl);
  }, [cameraUrl]);

  useEffect(() => () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  useEffect(() => {
    if (!cameraPlaying || cameraSeconds.length < 2) return;
    const timer = window.setInterval(() => setCameraSecond((current) => {
      const index = cameraSeconds.indexOf(current);
      return cameraSeconds[(index + 1) % cameraSeconds.length];
    }), 1000);
    return () => window.clearInterval(timer);
  }, [cameraPlaying, cameraSeconds]);

  const loadLiveSeconds = useCallback(async () => {
    if (!user?.token || liveLoading.current) return;
    liveLoading.current = true;
    try {
      const suffix = liveCursor.current ? `?after=${encodeURIComponent(liveCursor.current)}` : '';
      const response = await fetch(`/api/proxy/device/${encodeURIComponent(params.deviceId)}/live-seconds${suffix}`, {
        headers: { Authorization: `Bearer ${user.token}` },
        cache: 'no-store',
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data.cursor) liveCursor.current = data.cursor;
      if (data.minute !== params.minute) return;
      setLiveSeconds((current) => {
        const merged = new Map<number, any>(
          current.map((second): [number, any] => [Number((second.second_index ?? second.chunk_index)), second]),
        );
        (Array.isArray((data.seconds ?? data.chunks)) ? (data.seconds ?? data.chunks) : []).forEach((second: any) => merged.set(Number((second.second_index ?? second.chunk_index)), second));
        return Array.from(merged.values()).sort((a, b) => Number((a.second_index ?? a.chunk_index)) - Number((b.second_index ?? b.chunk_index)));
      });
    } finally {
      liveLoading.current = false;
    }
  }, [params.deviceId, params.minute, user?.token]);

  const captureFinalized = Boolean(containerMetadata || documents['manifest.json']?.capture_finished);

  const loadStoredSeconds = useCallback(async () => {
    if (!user?.token) return;
    const response = await fetch(`/api/proxy/device/${encodeURIComponent(params.deviceId)}/files`, {
      headers: { Authorization: `Bearer ${user.token}` },
      cache: 'no-store',
    });
    if (!response.ok) return;
    const data = await response.json();
    const minute = (Array.isArray(data?.files) ? data.files : []).find((file: any) => file?.filename === params.minute);
    const seconds = (minute?.progress?.seconds ?? minute?.progress?.chunks);
    if (Array.isArray(seconds) && seconds.length) {
      setStoredSeconds(seconds);
    }
  }, [params.deviceId, params.minute, user?.token]);

  useEffect(() => {
    load();
    if (!waiting) return;
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [load, waiting]);

  useEffect(() => {
    if (captureFinalized) return;
    const refresh = () => { if (document.visibilityState === 'visible') loadLiveSeconds(); };
    refresh();
    const timer = window.setInterval(refresh, 2000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [captureFinalized, loadLiveSeconds]);

  useEffect(() => {
    loadStoredSeconds();
    if (storedSeconds.length) return;
    const timer = window.setInterval(loadStoredSeconds, 5000);
    return () => window.clearInterval(timer);
  }, [loadStoredSeconds, storedSeconds.length]);

  const predictions = documents['predictions.json'];
  const manifest = documents['manifest.json'];
  const predictionTimeline = Array.isArray(predictions?.timeline) ? predictions.timeline : [];
  const predictionByIndex = new Map<number, any>(predictionTimeline.map((entry: any): [number, any] => [Number((entry?.second_index ?? entry?.chunk_index)), entry]));
  const manifestSeconds = Array.isArray((manifest?.outputs?.radar?.seconds ?? manifest?.outputs?.radar?.chunks)) ? (manifest.outputs.radar.seconds ?? manifest.outputs.radar.chunks) : [];
  const secondByIndex = new Map<number, any>();
  storedSeconds.forEach((entry: any) => secondByIndex.set(Number(entry?.index), normalizeSecond(entry)));
  manifestSeconds.forEach((entry: any) => {
    const prediction = predictionByIndex.get(Number((entry?.second_index ?? entry?.chunk_index)));
    secondByIndex.set(Number((entry?.second_index ?? entry?.chunk_index)), normalizeSecond(prediction ? { ...entry, ...prediction } : entry));
  });
  predictionTimeline.forEach((entry: any) => {
    const index = Number((entry?.second_index ?? entry?.chunk_index));
    if (!secondByIndex.has(index)) secondByIndex.set(index, normalizeSecond(entry));
  });
  liveSeconds.forEach((entry: any) => secondByIndex.set(Number((entry?.second_index ?? entry?.chunk_index)), normalizeSecond(entry)));
  const seconds = Array.from(secondByIndex.values())
    .filter((second) => second.state !== 'waiting')
    .sort((a, b) => a.index - b.index);
  const humanLabels = Array.isArray(manifest?.labels) ? manifest.labels : [];
  const modelPredictions = Array.isArray(manifest?.model_predictions) ? manifest.model_predictions : [];
  const radarSummary = manifest?.outputs?.radar || {};
  const csiSummary = manifest?.outputs?.wifi_csi || {};
  const csiReceivers = Array.isArray(csiSummary.receivers) ? csiSummary.receivers : [];
  const csiSamples = csiReceivers.reduce((total: number, receiver: any) => total + Number(receiver?.samples || receiver?.sample_count || 0), 0);
  const cameraSummary = manifest?.outputs?.camera || {};
  const senseSummary = manifest?.outputs?.sense_hat || {};

  return <div className="space-y-6 text-slate-950">
    <header className="border border-slate-300 bg-white p-5"><div className="text-xs font-semibold uppercase text-slate-600">Live capture metadata</div><h1 className="mt-1 font-mono text-2xl font-semibold">{params.minute}</h1><p className="mt-2 text-sm text-slate-700">Device {params.deviceId}</p></header>
    {waiting && <div className="sr-only" role="status">Live metadata is updating while capture files remain on the device.</div>}
    <section className="border border-slate-300 bg-slate-50 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Radar capture</div><div className="mt-2 flex flex-wrap gap-6 text-sm"><span><strong>{Number(radarSummary.sample_count || 0)}</strong> frames captured this minute</span><span><strong>{Number((radarSummary.second_count ?? radarSummary.chunk_count) || 0)}</strong> complete seconds</span><span><strong>{Number(radarSummary.average_sampling_rate_hz || 0).toFixed(2)}</strong> Hz average</span></div></section>
    <section className="border border-slate-300 bg-white p-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Capture data summary</div><div className="mt-2 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4"><div>CSI samples: <strong>{csiSamples || Number(csiSummary.sample_count || 0)}</strong></div><div>CSI receivers: <strong>{Number(csiSummary.receiver_count || csiReceivers.length || 0)}</strong></div><div>Camera frames: <strong>{Number(cameraSummary.sample_count || cameraSummary.frame_count || 0)}</strong></div><div>Sense HAT samples: <strong>{Number(senseSummary.sample_count || 0)}</strong></div></div></section>
    <SensorScrubber minute={params.minute} deviceId={params.deviceId} token={user?.token} durationSeconds={Number(manifest?.duration_seconds) || 60} />
    <section className="border border-slate-300 bg-white p-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Human labels</div><div className="mt-3 flex flex-wrap gap-2">{humanLabels.length ? humanLabels.map((label: string) => <span key={label} className="rounded-full border border-cyan-300 bg-cyan-50 px-3 py-1 text-sm">{label}</span>) : <span className="text-sm text-slate-500">No labels were authored for this minute.</span>}</div></section>
    <section className="border border-slate-300 bg-white p-4"><div className="mb-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-600">User models</div><h2 className="mt-1 text-xl font-semibold">Prediction timelines</h2></div><div className="space-y-3">{modelPredictions.map((model: any) => <article key={model.model_id} className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold">{model.model_name} <span className="text-xs text-slate-500">{model.model_version}</span></h3><div className="mt-3 space-y-2">{(model.timeline || []).map((item: any, index: number) => <div key={`${(item.second_index ?? item.chunk_index)}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 text-xs"><div><strong>Second {Number((item.second_index ?? item.chunk_index)) + 1}</strong> · {item.timestamp} · status {item.status}</div>{item.status === 'ok' ? <div className="mt-1">Class: <strong>{item.class}</strong> · confidence {(Number(item.confidence) * 100).toFixed(1)}% · scores {JSON.stringify(item.scores || {})}</div> : <div className="mt-1">{item.reason ? `Reason: ${item.reason}` : item.error ? `Error: ${item.error}` : 'No additional details.'}</div>}</div>)}</div></article>)}{!modelPredictions.length ? <div className="border border-dashed border-slate-300 p-8 text-sm text-slate-500">No enabled user model produced a result.</div> : null}</div></section>
    <section className="border border-slate-300 bg-white p-4"><h2 className="mb-3 font-semibold">Camera</h2>{videoUrl ? <video controls src={videoUrl} className="max-h-[70vh] w-full bg-black" /> : cameraUrl ? <div className="space-y-3"><Image unoptimized src={cameraUrl} width={1280} height={720} alt={`Camera frame for second ${cameraSecond + 1}`} className="max-h-[70vh] w-full bg-black object-contain"/><div className="flex items-center gap-3 text-xs"><button type="button" onClick={() => setCameraPlaying((value) => !value)} className="border border-slate-300 bg-white px-3 py-1.5 font-semibold">{cameraPlaying ? 'Pause' : 'Play'}</button><input aria-label="Camera second" type="range" min={0} max={Math.max(0, Number(containerMetadata?.seconds?.length || 1) - 1)} value={cameraSecond} onChange={(event) => { setCameraPlaying(false); setCameraSecond(Number(event.target.value)); }} className="min-w-0 flex-1 accent-cyan-600"/><span className="font-mono">{cameraSecond + 1}s</span></div></div> : <div className="p-8 text-sm text-slate-500">No camera frames in this minute.</div>}</section>
    <div className="text-xs text-slate-500">{assets.length} cloud assets</div>
  </div>;
}
