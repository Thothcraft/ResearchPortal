'use client';

import { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Activity,
  ArrowDownToLine,
  FileText,
  Loader2,
  Radio,
  RefreshCw,
  Signal,
  Video,
  Wifi,
  Waves,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { useToast } from '@/contexts/ToastContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

type MinuteFiles = {
  video: boolean;
  radar: boolean;
  csi: boolean;
  manifest: boolean;
};

type MinuteSummary = {
  minute: string;
  path: string;
  modified: string;
  created: string;
  completed: boolean;
  state: 'ready' | 'collecting';
  files: MinuteFiles;
  sizes: Record<string, number>;
  manifest?: any;
};

type MinuteDetail = MinuteSummary & {
  filePaths: Record<string, string | null>;
  previews: Record<string, string>;
};

const THOTH_BASE_URL = process.env.NEXT_PUBLIC_THOTH_BASE_URL || 'http://thoth.local:5000';

function humanSize(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function parseCsiAverages(csvText: string): number[] {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];

  const sums: number[] = [];
  let rows = 0;

  for (const line of lines.slice(1)) {
    const parts = line.split(',');
    if (parts.length < 15) continue;
    const dataField = parts.slice(14).join(',');
    const start = dataField.indexOf('[');
    const end = dataField.lastIndexOf(']');
    if (start < 0 || end <= start) continue;

    try {
      const values = JSON.parse(dataField.slice(start, end + 1));
      if (!Array.isArray(values) || values.length < 2) continue;
      const subcarriers = Math.floor(values.length / 2);
      if (!subcarriers) continue;
      if (!sums.length) {
        for (let i = 0; i < subcarriers; i += 1) sums.push(0);
      }

      for (let i = 0; i < subcarriers; i += 1) {
        const real = Number(values[i * 2] ?? 0);
        const imag = Number(values[i * 2 + 1] ?? 0);
        sums[i] += Math.hypot(real, imag);
      }
      rows += 1;
    } catch {
      continue;
    }
  }

  if (!rows) return [];
  return sums.map((sum) => sum / rows);
}

function SensorBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs ${
      ok ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-400'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-slate-500'}`} />
      {label}
    </span>
  );
}

function RadarPlotCard({ minute, plot, title, description }: { minute: string; plot: 'range-doppler' | 'azimuth-range' | 'azimuth-doppler'; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-900 dark:text-slate-50">{title}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{description}</div>
        </div>
        <a
          href={`/api/data/minutes/${minute}/radar/${plot}`}
          target="_blank"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
        >
          <ArrowDownToLine className="h-3.5 w-3.5" />
          Open
        </a>
      </div>
      <img
        src={`/api/data/minutes/${minute}/radar/${plot}`}
        alt={title}
        className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900"
      />
    </div>
  );
}

function CsiChart({ minute, enabled }: { minute: string; enabled: boolean }) {
  const toast = useToast();
  const [series, setSeries] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/data/minutes/${minute}/file/csi_timestamped`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('CSI file unavailable');
        const text = await res.text();
        const values = parseCsiAverages(text);
        if (!cancelled) setSeries(values);
      } catch (error: any) {
        if (!cancelled && error?.name !== 'AbortError') {
          setSeries([]);
          toast.error('CSI', error?.message || 'Failed to load CSI data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [minute, enabled, toast]);

  const chartData = useMemo(() => ({
    labels: series.map((_, idx) => `${idx + 1}`),
    datasets: [
      {
        label: 'Average amplitude',
        data: series,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.18)',
        pointRadius: 0,
        tension: 0.25,
        fill: true,
      },
    ],
  }), [series]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { intersect: false, mode: 'index' as const },
    },
    scales: {
      x: {
        ticks: { color: '#94a3b8', maxTicksLimit: 8 },
        grid: { color: 'rgba(148, 163, 184, 0.12)' },
      },
      y: {
        ticks: { color: '#94a3b8' },
        grid: { color: 'rgba(148, 163, 184, 0.12)' },
      },
    },
  }), []);

  if (!enabled) {
    return <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800">CSI is offline for this minute.</div>;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-900 dark:text-slate-50">CSI average across subcarriers</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Derived from `wifi_csi_timestamped.csv`.</div>
        </div>
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> : null}
      </div>
      <div className="mt-4 h-72">
        {series.length ? (
          <Line data={chartData} options={chartOptions} />
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-700">
            No CSI samples found.
          </div>
        )}
      </div>
    </div>
  );
}

export default function MinutesPage() {
  const toast = useToast();
  const [minutes, setMinutes] = useState<MinuteSummary[]>([]);
  const [selectedMinute, setSelectedMinute] = useState<string | null>(null);
  const [detail, setDetail] = useState<MinuteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'video' | 'csi' | 'radar' | 'files'>('video');

  const latestMinute = minutes[0];
  const readyMinutes = useMemo(() => minutes.filter((minute) => minute.completed), [minutes]);

  const deviceState = !latestMinute
    ? 'idle'
    : latestMinute.completed
      ? 'idle'
      : 'collecting data';

  const loadMinutes = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/data/minutes', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load minutes');
      const allMinutes = data.minutes || [];
      setMinutes(allMinutes);
      if (!selectedMinute || !allMinutes.some((minute: MinuteSummary) => minute.minute === selectedMinute && minute.completed)) {
        const nextSelected = allMinutes.find((minute: MinuteSummary) => minute.completed)?.minute || null;
        setSelectedMinute(nextSelected);
      }
    } catch (error: any) {
      toast.error('Minutes', error?.message || 'Failed to load minutes');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadDetail = async (minute: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/data/minutes/${minute}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load minute detail');
      setDetail(data.minute);
    } catch (error: any) {
      toast.error('Minute', error?.message || 'Failed to load minute detail');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadMinutes();
  }, []);

  useEffect(() => {
    if (selectedMinute) {
      loadDetail(selectedMinute);
      setActiveTab('video');
    } else {
      setDetail(null);
    }
  }, [selectedMinute]);

  useEffect(() => {
    const timer = setInterval(() => loadMinutes(true), 5000);
    return () => clearInterval(timer);
  }, [selectedMinute]);

  const sensorCards = useMemo(() => {
    const files = detail?.files || latestMinute?.files;
    return [
      { title: 'DreamHat Radar', ok: !!files?.radar, desc: 'Raw mmWave capture and processed range/azimuth views.', icon: Waves },
      { title: 'USB Camera', ok: !!files?.video, desc: 'Minute-synced camera video from the connected USB camera.', icon: Video },
      { title: 'ESP32 CSI', ok: !!files?.csi, desc: 'WiFi CSI stream from the USB serial ESP32 receiver.', icon: Wifi },
      { title: 'Sense HAT', ok: false, desc: 'Not part of the current synchronized minute capture.', icon: Signal },
    ];
  }, [detail, latestMinute]);

  const liveVideoUrl = `${THOTH_BASE_URL}/captures/live/video`;
  const liveCsiUrl = `${THOTH_BASE_URL}/captures/live/csi`;
  const liveRadarUrl = `${THOTH_BASE_URL}/captures/live/radar`;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900">
                <Activity className="h-3.5 w-3.5" />
                {deviceState}
              </span>
              {latestMinute ? <SensorBadge ok={latestMinute.completed} label={latestMinute.completed ? 'Captures complete' : 'Capture in progress'} /> : null}
              <SensorBadge ok={!!latestMinute?.files?.video} label="Camera" />
              <SensorBadge ok={!!latestMinute?.files?.radar} label="Radar" />
              <SensorBadge ok={!!latestMinute?.files?.csi} label="CSI" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-slate-950 dark:text-white">Thoth minute captures</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
                Only completed minute folders from <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-900 dark:bg-slate-800 dark:text-slate-100">/home/pi/Desktop/data</code> are listed here.
                The newest in-progress minute stays hidden until the manifest marks it complete, so the browser updates as soon as data is saved.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Device: {latestMinute?.minute || 'none'}</span>
              <span>Saved minutes: {readyMinutes.length}</span>
              <span>Live portal: {THOTH_BASE_URL}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href={liveVideoUrl} target="_blank" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">
              <Video className="h-4 w-4" />
              Live video
            </a>
            <a href={liveCsiUrl} target="_blank" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">
              <Wifi className="h-4 w-4" />
              Live CSI
            </a>
            <a href={liveRadarUrl} target="_blank" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">
              <Radio className="h-4 w-4" />
              Live radar
            </a>
            <button onClick={() => loadMinutes()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {sensorCards.map((sensor) => (
          <div key={sensor.title} className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900">
                  <sensor.icon className="h-5 w-5 text-indigo-500" />
                </div>
                <div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">{sensor.title}</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-slate-50">{sensor.ok ? 'Online' : 'Offline'}</div>
                </div>
              </div>
              <SensorBadge ok={sensor.ok} label={sensor.ok ? 'Live' : 'Missing'} />
            </div>
            <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">{sensor.desc}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm xl:col-span-2 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Saved minute folders</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Completed minutes only. The list refreshes every 5 seconds so new saved data shows up immediately after the minute closes.
              </p>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {loading ? 'Refreshing...' : `${readyMinutes.length} ready`}
            </span>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="max-h-[34rem] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center p-10">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                </div>
              ) : readyMinutes.length ? (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {readyMinutes.map((minute) => {
                    const isActive = minute.minute === selectedMinute;
                    return (
                      <button
                        key={minute.minute}
                        onClick={() => setSelectedMinute(minute.minute)}
                        className={`w-full px-4 py-4 text-left transition-colors ${isActive ? 'bg-indigo-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-900/60'}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-mono text-sm text-slate-950 dark:text-slate-100">{minute.minute}</div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              Saved {formatDistanceToNow(new Date(minute.manifest?.capture_finished || minute.modified), { addSuffix: true })}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <SensorBadge ok={minute.files.video} label="Video" />
                            <SensorBadge ok={minute.files.radar} label="Radar" />
                            <SensorBadge ok={minute.files.csi} label="CSI" />
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                          <span>{humanSize(minute.sizes.video)} video</span>
                          <span>{humanSize(minute.sizes.radar)} radar</span>
                          <span>{humanSize(minute.sizes.csi_csv || minute.sizes.csi_timestamped || minute.sizes.csi_serial)} csi</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-sm text-slate-500 dark:text-slate-400">No completed minute folders yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Current state</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Collecting, idle, and sensor availability.</p>
            </div>
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
              <span className="text-slate-500 dark:text-slate-400">Device</span>
              <span className="font-medium text-slate-950 dark:text-slate-100">{deviceState}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
              <span className="text-slate-500 dark:text-slate-400">Latest minute</span>
              <span className="font-mono text-slate-950 dark:text-slate-100">{latestMinute?.minute || 'none'}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
              <span className="text-slate-500 dark:text-slate-400">Saved minutes</span>
              <span className="text-slate-950 dark:text-slate-100">{readyMinutes.length}</span>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
            Radar and CSI visualizations are generated on demand from each minute folder. Video is streamed directly, radar shows the processed mmWave plots, and CSI shows the average subcarrier amplitude graph.
          </div>

          {selectedMinute ? (
            <a
              href={`/api/data/minutes/${selectedMinute}/download`}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Download selected minute
            </a>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Minute detail</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {selectedMinute ? `Viewing ${selectedMinute}` : 'Select a saved minute to inspect video, CSI, and radar.'}
            </p>
          </div>
          {selectedMinute ? (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setActiveTab('video')} className={`rounded-lg px-3 py-2 text-sm ${activeTab === 'video' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300'}`}>
                Video
              </button>
              <button onClick={() => setActiveTab('csi')} className={`rounded-lg px-3 py-2 text-sm ${activeTab === 'csi' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300'}`}>
                CSI
              </button>
              <button onClick={() => setActiveTab('radar')} className={`rounded-lg px-3 py-2 text-sm ${activeTab === 'radar' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300'}`}>
                Radar
              </button>
              <button onClick={() => setActiveTab('files')} className={`rounded-lg px-3 py-2 text-sm ${activeTab === 'files' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300'}`}>
                Files
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-5">
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
          ) : detail ? (
            <div className="space-y-5">
              {activeTab === 'video' && (
                <div className="space-y-3">
                  {detail.files.video ? (
                    <video controls className="w-full rounded-xl border border-slate-200 bg-black dark:border-slate-800" src={`/api/data/minutes/${detail.minute}/file/video`} />
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700">Video is not available for this minute.</div>
                  )}
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    The MP4 is served directly from the saved minute folder.
                  </div>
                </div>
              )}

              {activeTab === 'csi' && (
                <div className="space-y-4">
                  <CsiChart minute={detail.minute} enabled={detail.files.csi} />
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Raw CSI</div>
                      <div className="mt-1 font-medium text-slate-950 dark:text-slate-100">{humanSize(detail.sizes.csi_csv)} csv</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Timestamped CSI</div>
                      <div className="mt-1 font-medium text-slate-950 dark:text-slate-100">{humanSize(detail.sizes.csi_timestamped)} csv</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Serial log</div>
                      <div className="mt-1 font-medium text-slate-950 dark:text-slate-100">{humanSize(detail.sizes.csi_serial)} jsonl</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={`/api/data/minutes/${detail.minute}/file/csi_timestamped`} target="_blank" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900">
                      <FileText className="h-4 w-4" />
                      Open CSI CSV
                    </a>
                    <a href={`/api/data/minutes/${detail.minute}/file/csi_serial`} target="_blank" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900">
                      <FileText className="h-4 w-4" />
                      Open serial log
                    </a>
                  </div>
                </div>
              )}

              {activeTab === 'radar' && (
                <div className="space-y-4">
                  {detail.files.radar ? (
                    <>
                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                        <RadarPlotCard
                          minute={detail.minute}
                          plot="range-doppler"
                          title="Range-Doppler"
                          description="Same processing family used by the mmWave full visualization example."
                        />
                        <RadarPlotCard
                          minute={detail.minute}
                          plot="azimuth-range"
                          title="Azimuth-Range"
                          description="Spatial energy over range and angle."
                        />
                        <RadarPlotCard
                          minute={detail.minute}
                          plot="azimuth-doppler"
                          title="Azimuth-Doppler"
                          description="Angle/velocity view for motion analysis."
                        />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                        Radar plots are rendered from the minute&apos;s raw `mmw_radar_raw_*.bin` capture using the same CubeProcessor pipeline used by the mmWave examples.
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700">Radar is offline for this minute.</div>
                  )}
                </div>
              )}

              {activeTab === 'files' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Video</div>
                      <div className="mt-1 text-sm font-medium text-slate-950 dark:text-slate-100">{detail.files.video ? humanSize(detail.sizes.video) : 'Missing'}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Radar</div>
                      <div className="mt-1 text-sm font-medium text-slate-950 dark:text-slate-100">{detail.files.radar ? humanSize(detail.sizes.radar) : 'Missing'}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                      <div className="text-xs uppercase tracking-wide text-slate-500">CSI</div>
                      <div className="mt-1 text-sm font-medium text-slate-950 dark:text-slate-100">{detail.files.csi ? humanSize(detail.sizes.csi_csv || detail.sizes.csi_timestamped || detail.sizes.csi_serial) : 'Missing'}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Manifest</div>
                      <div className="mt-1 text-sm font-medium text-slate-950 dark:text-slate-100">{detail.files.manifest ? 'Present' : 'Missing'}</div>
                    </div>
                  </div>
                  <pre className="max-h-80 overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-200 dark:border-slate-800">
                    {detail.previews.manifest || 'No manifest preview available.'}
                  </pre>
                  <div className="flex flex-wrap gap-2">
                    <a href={`/api/data/minutes/${detail.minute}/download`} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">
                      <ArrowDownToLine className="h-4 w-4" />
                      Download minute zip
                    </a>
                    <a href={`/api/data/minutes/${detail.minute}/file/radar`} target="_blank" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900">
                      <FileText className="h-4 w-4" />
                      Open radar bin
                    </a>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700">
              Select a completed minute to inspect the synchronized capture.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
