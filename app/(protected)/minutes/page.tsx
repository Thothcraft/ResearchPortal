'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { formatDistanceToNow } from 'date-fns';
import {
  CloudDownload,
  FileText,
  Loader2,
  Radio,
  RefreshCw,
  Signal,
  Video,
  Wifi,
  Waves,
} from 'lucide-react';

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

function SensorCard({ title, ok, desc, icon: Icon }: { title: string; ok: boolean; desc: string; icon: any }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <Icon className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{title}</div>
            <div className="text-base font-semibold">{ok ? 'Online' : 'Offline'}</div>
          </div>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${ok ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-400'}`}>
          {ok ? 'Live' : 'Missing'}
        </span>
      </div>
      <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">{desc}</div>
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

  const latestMinute = minutes[0];

  const loadMinutes = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/data/minutes', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load minutes');
      setMinutes(data.minutes || []);
      if (!selectedMinute && data.minutes?.length) {
        setSelectedMinute(data.minutes[0].minute);
      }
    } catch (error: any) {
      toast.error('Minutes', error.message || 'Failed to load minutes');
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
      toast.error('Minute Detail', error.message || 'Failed to load minute detail');
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
    }
  }, [selectedMinute]);

  useEffect(() => {
    const timer = setInterval(() => loadMinutes(true), 30000);
    return () => clearInterval(timer);
  }, [selectedMinute]);

  const sensorCards = useMemo(() => {
    const files = detail?.files || latestMinute?.files;
    return [
      { title: 'DreamHat Radar', ok: !!files?.radar, desc: 'Raw mmWave radar frames and capture bin files.', icon: Waves },
      { title: 'USB Camera', ok: !!files?.video, desc: 'Minute-synced MP4 from the attached camera.', icon: Video },
      { title: 'ESP32 CSI', ok: !!files?.csi, desc: 'WiFi CSI stream from the serial receiver.', icon: Wifi },
      { title: 'Sense HAT', ok: false, desc: 'Not recorded in the minute capture path.', icon: Signal },
    ];
  }, [detail, latestMinute]);

  const liveMinute = latestMinute?.minute;
  const liveVideoUrl = `${THOTH_BASE_URL}/captures/live/video`;
  const liveCsiUrl = `${THOTH_BASE_URL}/captures/live/csi`;
  const liveRadarUrl = `${THOTH_BASE_URL}/captures/live/radar`;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-wide text-slate-500">Thoth Minutes</div>
            <h1 className="text-3xl font-semibold mt-1">Continuous synchronized capture</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
              Minute folders from <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">/home/pi/Desktop/data</code> only.
              Sensor sources are shown online or offline, and the latest minute can be opened, viewed, or downloaded directly.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={liveVideoUrl} target="_blank" className="btn btn-primary">
              <Video className="w-4 h-4 mr-2" />Live Video
            </a>
            <a href={liveCsiUrl} target="_blank" className="btn btn-secondary">
              <Wifi className="w-4 h-4 mr-2" />Live CSI
            </a>
            <a href={liveRadarUrl} target="_blank" className="btn btn-secondary">
              <Radio className="w-4 h-4 mr-2" />Live Radar
            </a>
            <button onClick={() => loadMinutes()} className="btn btn-secondary">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {sensorCards.map((sensor) => (
          <SensorCard key={sensor.title} {...sensor} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Minute folders</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {minutes.length} minute folders found, newest first.
              </p>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Auto-refresh every 30 seconds
            </span>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="max-h-[36rem] overflow-y-auto">
              {loading ? (
                <div className="p-8 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                </div>
              ) : minutes.length ? (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {minutes.map((minute) => (
                    <button
                      key={minute.minute}
                      onClick={() => setSelectedMinute(minute.minute)}
                      className={`w-full text-left p-4 transition-colors ${selectedMinute === minute.minute ? 'bg-indigo-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-mono text-sm">{minute.minute}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Updated {formatDistanceToNow(new Date(minute.modified), { addSuffix: true })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`px-2 py-1 rounded-full ${minute.files.video ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-400'}`}>Video</span>
                          <span className={`px-2 py-1 rounded-full ${minute.files.radar ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-400'}`}>Radar</span>
                          <span className={`px-2 py-1 rounded-full ${minute.files.csi ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-400'}`}>CSI</span>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex gap-4">
                        <span>{humanSize(minute.sizes.video)} video</span>
                        <span>{humanSize(minute.sizes.radar)} radar</span>
                        <span>{humanSize(minute.sizes.csi_csv || minute.sizes.csi_timestamped || minute.sizes.csi_serial)} csi</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-sm text-slate-500 dark:text-slate-400">No minute folders found.</div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Selected minute</h2>
            {selectedMinute && (
              <a href={`/api/data/minutes/${selectedMinute}/download`} className="btn btn-primary text-sm">
                <Download className="w-4 h-4 mr-2" />ZIP
              </a>
            )}
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 dark:text-slate-400">Minute</span>
              <span className="font-mono">{selectedMinute || 'None'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 dark:text-slate-400">Live minute</span>
              <span className="font-mono">{liveMinute || 'None'}</span>
            </div>
          </div>

          {detailLoading ? (
            <div className="mt-6 flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : detail ? (
            <div className="mt-6 space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">Video</div>
                {detail.files.video ? (
                  <video controls className="w-full rounded-lg border border-slate-200 dark:border-slate-700" src={`/api/data/minutes/${detail.minute}/file/video`} />
                ) : (
                  <div className="text-sm text-slate-500">No video file.</div>
                )}
              </div>

              <div>
                <div className="text-sm font-medium mb-2">CSI Preview</div>
                {detail.files.csi ? (
                  <pre className="text-xs bg-slate-950 text-emerald-200 rounded-lg p-3 max-h-56 overflow-auto whitespace-pre-wrap">
                    {detail.previews.csi_timestamped || detail.previews.csi_csv || detail.previews.csi_serial || 'Preview unavailable.'}
                  </pre>
                ) : (
                  <div className="text-sm text-slate-500">No CSI file.</div>
                )}
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Radar</div>
                {detail.files.radar ? (
                  <div className="space-y-2">
                    <a className="text-indigo-500 text-sm" href={`/api/data/minutes/${detail.minute}/file/radar`} target="_blank">
                      Open radar bin
                    </a>
                    <div className="text-xs text-slate-500">
                      Radar capture is stored as raw binary. Download the minute ZIP for offline parsing.
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">No radar file.</div>
                )}
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Manifest</div>
                {detail.files.manifest ? (
                  <pre className="text-xs bg-slate-950 text-slate-200 rounded-lg p-3 max-h-48 overflow-auto whitespace-pre-wrap">
                    {detail.previews.manifest || 'No manifest preview.'}
                  </pre>
                ) : (
                  <div className="text-sm text-slate-500">No manifest file.</div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <a href={`/api/data/minutes/${detail.minute}/download`} className="btn btn-primary">
                  <CloudDownload className="w-4 h-4 mr-2" />Download minute
                </a>
                <a href={`/api/data/minutes/${detail.minute}/file/csi_timestamped`} target="_blank" className="btn btn-secondary">
                  <FileText className="w-4 h-4 mr-2" />CSI CSV
                </a>
              </div>
            </div>
          ) : (
            <div className="mt-6 text-sm text-slate-500">Select a minute to inspect it.</div>
          )}
        </div>
      </div>
    </div>
  );
}
