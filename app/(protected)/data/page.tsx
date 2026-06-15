'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  CalendarDays,
  ChevronDown,
  Download,
  FolderOpen,
  RefreshCw,
  Search,
  UploadCloud,
  Video,
  Wifi,
  Radar,
  FileText,
  Brain,
  CircleAlert,
} from 'lucide-react';

type Sensor = {
  sensor_type: string;
  name: string;
  available: boolean;
};

type Device = {
  device_uuid: string;
  device_id: string;
  device_name: string;
  device_type: string;
  online: boolean;
  approved: boolean;
  hardware_info?: {
    hostname?: string;
    device_type?: string;
    is_raspberry_pi?: boolean;
    portal_upload_allowed?: boolean;
    sensors?: Sensor[];
    available_sensors?: Sensor[];
  };
};

type CloudFile = {
  file_id: number;
  filename: string;
  size: number;
  content_type?: string;
  uploaded_at: string;
  device_id?: string | null;
  on_cloud?: boolean;
  metadata?: Record<string, any>;
  labels?: string[];
  folder_id?: number | null;
};

type DeviceFile = {
  id: number;
  filename: string;
  size?: number;
  file_type?: string;
  created_at?: string;
  modified_at?: string;
  on_device: boolean;
  on_cloud: boolean;
  upload_requested: boolean;
  last_synced?: string;
};

type MinuteBundle = {
  minute: string;
  deviceId: string;
  deviceLabel: string;
  labels: string[];
  files: CloudFile[];
  video?: CloudFile;
  radar?: CloudFile;
  csi?: CloudFile;
  manifest?: CloudFile;
  predictions?: CloudFile;
  uploadedAt: string;
  fileCount: number;
  uploadedCount: number;
  complete: boolean;
};

type PredictionRow = {
  minute?: string;
  label?: string;
  prediction?: string;
  occupied?: boolean;
  score?: number;
  confidence?: number;
  probability?: number;
  model_name?: string;
  model?: string;
  timestamp?: string;
};

function humanBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatStamp(value?: string | null): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function normalize(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)));
}

function extractMinute(value: unknown): string | null {
  const text = String(value || '');
  const match = text.match(/\b\d{8}_\d{4}\b/);
  return match ? match[0] : null;
}

function inferFileKind(file: CloudFile): 'video' | 'radar' | 'csi' | 'manifest' | 'predictions' | 'other' {
  const name = (file.filename || '').toLowerCase();
  if (name.endsWith('.mp4')) return 'video';
  if (name.endsWith('.bin')) return 'radar';
  if (name.endsWith('.csv') || name.endsWith('.jsonl')) return 'csi';
  if (name.endsWith('manifest.json')) return 'manifest';
  if (name.endsWith('predictions.json')) return 'predictions';
  return 'other';
}

function getDeviceKey(device: Device) {
  return normalize(device.device_uuid || device.device_id || device.device_name);
}

function getDeviceLabel(device: Device) {
  return device.device_name || device.hardware_info?.hostname || device.device_uuid || 'Unknown device';
}

function getSensors(device: Device): Sensor[] {
  return device.hardware_info?.sensors || device.hardware_info?.available_sensors || [];
}

function parsePredictionTimeline(text: string): PredictionRow[] {
  const rows: PredictionRow[] = [];
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (item && typeof item === 'object') rows.push(item as PredictionRow);
        });
      } else if (parsed && typeof parsed === 'object') {
        rows.push(parsed as PredictionRow);
      }
      continue;
    } catch {
      // fall through
    }

    if (line.includes(',')) {
      const cells = line.split(',').map((cell) => cell.trim());
      if (cells.length >= 2) {
        rows.push({
          timestamp: cells[0],
          prediction: cells[1],
          confidence: Number.parseFloat(cells[2] || ''),
        });
      }
    }
  }

  return rows;
}

function CloudMinuteCard({
  bundle,
  active,
  onSelect,
}: {
  bundle: MinuteBundle;
  active: boolean;
  onSelect: () => void;
}) {
  const ready = bundle.complete;
  return (
    <article
      className={`rounded-2xl border bg-slate-950 p-4 text-slate-100 shadow-sm transition hover:border-slate-700 ${active ? 'border-cyan-400 ring-2 ring-cyan-500/20' : 'border-slate-800'}`}
      onClick={onSelect}
    >
      <button type="button" className="flex w-full items-start justify-between gap-4 text-left" onClick={onSelect}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
            <CalendarDays className="h-3.5 w-3.5" />
            Minute bundle
          </div>
          <h3 className="mt-2 truncate text-lg font-semibold text-white">{bundle.minute}</h3>
          <div className="mt-1 text-sm text-slate-400">{bundle.deviceLabel}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(bundle.labels || []).length ? (
              bundle.labels.map((label) => (
                <span key={label} className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-200">
                  {label}
                </span>
              ))
            ) : (
              <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-400">No labels</span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className={`rounded-full px-2.5 py-1 ${bundle.video ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>Video {bundle.video ? 'on' : 'off'}</span>
            <span className={`rounded-full px-2.5 py-1 ${bundle.radar ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>Radar {bundle.radar ? 'on' : 'off'}</span>
            <span className={`rounded-full px-2.5 py-1 ${bundle.csi ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>CSI {bundle.csi ? 'on' : 'off'}</span>
            <span className={`rounded-full px-2.5 py-1 ${bundle.predictions ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>Predictions {bundle.predictions ? 'on' : 'off'}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${ready ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
            <span className={`h-2 w-2 rounded-full ${ready ? 'bg-emerald-400' : 'bg-amber-300'}`} />
            {ready ? 'Ready' : 'Collecting'}
          </span>
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${bundle.uploadedCount > 0 ? 'bg-blue-500/15 text-blue-300' : 'bg-slate-800 text-slate-400'}`}>
            <UploadCloud className="h-3.5 w-3.5" />
            {bundle.uploadedCount > 0 ? 'Cloud synced' : 'Local only'}
          </span>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{bundle.fileCount} files</span>
          <ChevronDown className={`h-5 w-5 text-slate-500 transition ${active ? 'rotate-180' : ''}`} />
        </div>
      </button>

      <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
        <div className="rounded-xl bg-white/5 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Uploaded</div>
          <div className="mt-1 font-medium text-slate-100">{formatStamp(bundle.uploadedAt)}</div>
        </div>
        <div className="rounded-xl bg-white/5 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Size</div>
          <div className="mt-1 font-medium text-slate-100">
            {humanBytes(bundle.files.reduce((sum, file) => sum + (file.size || 0), 0))}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function DataPage() {
  const { get } = useApi();
  const { user } = useAuth();
  const toast = useToast();

  const [devices, setDevices] = useState<Device[]>([]);
  const [cloudFiles, setCloudFiles] = useState<CloudFile[]>([]);
  const [deviceFiles, setDeviceFiles] = useState<Record<string, DeviceFile[]>>({});
  const [deployments, setDeployments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState<'all' | 'uploaded' | 'local'>('all');
  const [startMinute, setStartMinute] = useState('');
  const [endMinute, setEndMinute] = useState('');
  const [selectedMinute, setSelectedMinute] = useState<string | null>(null);
  const [predictionTimeline, setPredictionTimeline] = useState<PredictionRow[]>([]);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [fileBusyId, setFileBusyId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [deviceRes, fileRes, deployRes] = await Promise.all([
        get('/device/list?include_offline=true').catch(() => ({ devices: [] })),
        get('/file/files?limit=200').catch(() => ({ files: [] })),
        get('/datasets/models/deployments').catch(() => ({ deployments: [] })),
      ]);

      const remoteDevices = Array.isArray(deviceRes?.devices) ? deviceRes.devices : [];
      const files = Array.isArray(fileRes?.files) ? fileRes.files : [];
      const remoteDeployments = Array.isArray(deployRes?.deployments) ? deployRes.deployments : [];

      setDevices(remoteDevices);
      setCloudFiles(files);
      setDeployments(remoteDeployments);

      const fileEntries = await Promise.all(
        remoteDevices.map(async (device: Device) => {
          const response = await get(`/device/${device.device_uuid}/files`).catch(() => null);
          return [device.device_uuid, Array.isArray(response?.files) ? response.files : []] as const;
        })
      );
      setDeviceFiles(Object.fromEntries(fileEntries));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      setError(message);
      toast.error('Load failed', message);
    } finally {
      setLoading(false);
    }
  }, [get, toast]);

  useEffect(() => {
    loadData();
    const timer = window.setInterval(loadData, 30000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const bundles = useMemo(() => {
    const map = new Map<string, MinuteBundle>();

    for (const file of cloudFiles) {
      const minute = String(file.metadata?.minute || extractMinute(file.filename) || '').trim();
      if (!minute) continue;

      const deviceId = String(file.device_id || file.metadata?.device_id || '').trim();
      const device = devices.find((item) => item.device_uuid === deviceId || item.device_id === deviceId);
      const deviceLabel = device ? getDeviceLabel(device) : (deviceId || 'Unknown device');
      const key = `${minute}::${deviceId || deviceLabel}`;
      const bundle = map.get(key) || {
        minute,
        deviceId: deviceId || '',
        deviceLabel,
        labels: [],
        files: [],
        uploadedAt: file.uploaded_at,
        fileCount: 0,
        uploadedCount: 0,
        complete: false,
      };

      bundle.files.push(file);
      bundle.labels = Array.from(new Set([...bundle.labels, ...parseLabels(file.labels)]));
      if (!bundle.deviceId && deviceId) bundle.deviceId = deviceId;
      if (device && bundle.deviceLabel === 'Unknown device') bundle.deviceLabel = getDeviceLabel(device);
      if (!bundle.uploadedAt || file.uploaded_at > bundle.uploadedAt) bundle.uploadedAt = file.uploaded_at;

      const kind = inferFileKind(file);
      if (kind === 'video') bundle.video = file;
      if (kind === 'radar') bundle.radar = file;
      if (kind === 'csi') bundle.csi = file;
      if (kind === 'manifest') bundle.manifest = file;
      if (kind === 'predictions') bundle.predictions = file;

      map.set(key, bundle);
    }

    return Array.from(map.values())
      .map((bundle) => ({
        ...bundle,
        fileCount: bundle.files.length,
        uploadedCount: bundle.files.filter((file) => file.on_cloud !== false).length,
        complete: Boolean(bundle.video && bundle.radar && bundle.csi && bundle.manifest),
      }))
      .sort((a, b) => b.minute.localeCompare(a.minute));
  }, [cloudFiles, devices]);

  const deviceOptions = useMemo(() => {
    return devices.map((device) => ({ value: device.device_uuid, label: getDeviceLabel(device) }));
  }, [devices]);

  const localFiles = useMemo(() => [] as Array<{ device: Device; files: DeviceFile[] }>, []);

  const filteredBundles = useMemo(() => {
    const q = query.trim().toLowerCase();
    const start = startMinute.trim();
    const end = endMinute.trim();
    return bundles.filter((bundle) => {
      if (q && !(bundle.minute.toLowerCase().includes(q) || bundle.deviceLabel.toLowerCase().includes(q) || bundle.labels.some((label) => label.toLowerCase().includes(q)))) {
        return false;
      }
      if (deviceFilter !== 'all' && normalize(bundle.deviceId || bundle.deviceLabel) !== deviceFilter && normalize(bundle.deviceLabel) !== deviceFilter) {
        return false;
      }
      if (stateFilter === 'uploaded' && bundle.uploadedCount === 0) return false;
      if (stateFilter === 'local' && bundle.uploadedCount > 0) return false;
      if (start && bundle.minute < start) return false;
      if (end && bundle.minute > end) return false;
      return true;
    });
  }, [bundles, deviceFilter, endMinute, query, startMinute, stateFilter]);

  const selectedBundle = useMemo(
    () => bundles.find((bundle) => bundle.minute === selectedMinute) || null,
    [bundles, selectedMinute]
  );

  const selectedDevice = useMemo(() => {
    if (!selectedBundle) return null;
    return devices.find((device) => device.device_uuid === selectedBundle.deviceId) || null;
  }, [devices, selectedBundle]);

  useEffect(() => {
    if (selectedBundle?.predictions?.file_id) {
      setPredictionLoading(true);
      fetch(`/api/proxy/file/${selectedBundle.predictions.file_id}`, {
        method: 'GET',
        headers: user?.token ? { Authorization: `Bearer ${user.token}` } : undefined,
        cache: 'no-store',
      })
        .then(async (response) => {
          const text = await response.text();
          if (!response.ok) {
            throw new Error(text || 'Failed to load predictions');
          }
          const parsed = parsePredictionTimeline(text);
          setPredictionTimeline(parsed);
        })
        .catch(() => setPredictionTimeline([]))
        .finally(() => setPredictionLoading(false));
    } else {
      setPredictionTimeline([]);
    }
  }, [selectedBundle, user?.token]);

  const downloadCloudFile = useCallback(async (file: CloudFile, inline = false) => {
    if (!file?.file_id) return;
    setFileBusyId(file.file_id);
    try {
      const response = await fetch(`/api/proxy/file/${file.file_id}${inline ? '?download=false' : ''}`, {
        method: 'GET',
        headers: user?.token ? { Authorization: `Bearer ${user.token}` } : undefined,
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      if (inline) {
        window.open(url, '_blank', 'noopener,noreferrer');
        window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      } else {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = file.filename || 'file';
        document.body.appendChild(anchor);
        anchor.click();
        window.URL.revokeObjectURL(url);
        anchor.remove();
      }
    } catch (err) {
      toast.error('Download failed', err instanceof Error ? err.message : 'Unable to download file');
    } finally {
      setFileBusyId(null);
    }
  }, [toast, user?.token]);

  const requestUpload = useCallback(async (_fileId: number) => {
    toast.info('Portal uploads disabled', 'Local-only device files are not exposed in this portal view.');
  }, [toast]);

  const syncCount = cloudFiles.filter((file) => file.on_cloud !== false).length;
  const onlineCount = devices.filter((device) => device.online).length;
  if (loading && !bundles.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
        Loading cloud data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-slate-100 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Data</div>
            <h1 className="mt-1 text-3xl font-semibold text-white">Cloud minute browser</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              This view shows only cloud-synced minute bundles and device registry metadata from Brain.
              Local data stays on the device unless it was explicitly uploaded.
            </p>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Devices</div>
            <div className="mt-1 text-2xl font-semibold text-white">{devices.length}</div>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Online</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-300">{onlineCount}</div>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Cloud files</div>
            <div className="mt-1 text-2xl font-semibold text-cyan-300">{syncCount}</div>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Registry</div>
            <div className="mt-1 text-2xl font-semibold text-white">{devices.length}</div>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <CircleAlert className="h-4 w-4" />
            {error}
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[1.4fr_0.9fr_0.8fr_0.8fr]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search minutes, labels, devices"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                />
              </div>
              <select
                value={deviceFilter}
                onChange={(event) => setDeviceFilter(event.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              >
                <option value="all">All devices</option>
                {deviceOptions.map((device) => (
                  <option key={device.value} value={normalize(device.value)}>
                    {device.label}
                  </option>
                ))}
              </select>
              <select
                value={stateFilter}
                onChange={(event) => setStateFilter(event.target.value as 'all' | 'uploaded' | 'local')}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              >
                <option value="all">All states</option>
                <option value="uploaded">Uploaded</option>
                <option value="local">Local only</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={startMinute}
                  onChange={(event) => setStartMinute(event.target.value)}
                  placeholder="Start minute"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                />
                <input
                  value={endMinute}
                  onChange={(event) => setEndMinute(event.target.value)}
                  placeholder="End minute"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {filteredBundles.map((bundle) => (
              <CloudMinuteCard
                key={`${bundle.minute}::${bundle.deviceId}`}
                bundle={bundle}
                active={bundle.minute === selectedMinute}
                onSelect={() => setSelectedMinute(bundle.minute)}
              />
            ))}
            {!filteredBundles.length && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500 shadow-sm">
                No cloud minute bundles match the current filters.
              </div>
            )}
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Local registry</div>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">Files waiting on the device</h2>
              </div>
              <FolderOpen className="h-5 w-5 text-slate-400" />
            </div>

            <div className="mt-4 space-y-4">
              {localFiles.length ? localFiles.map(({ device, files }) => (
                <div key={device.device_uuid} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{getDeviceLabel(device)}</div>
                      <div className="mt-1 text-xs text-slate-500">{files.length} local files</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${device.hardware_info?.portal_upload_allowed === false ? 'bg-rose-500/10 text-rose-700' : 'bg-cyan-500/10 text-cyan-700'}`}>
                      {device.hardware_info?.portal_upload_allowed === false ? 'Portal upload disabled' : 'Portal upload enabled'}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {files.slice(0, 6).map((file) => (
                      <div key={file.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900">{file.filename}</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {file.file_type || 'unknown'} · {humanBytes(file.size || 0)} · {formatStamp(file.modified_at)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${file.on_cloud ? 'bg-blue-500/10 text-blue-700' : 'bg-amber-500/10 text-amber-700'}`}>
                            {file.on_cloud ? 'Cloud' : 'Local'}
                          </span>
                          {!file.on_cloud && (
                            <button
                              type="button"
                              onClick={() => requestUpload(file.id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                            >
                              <UploadCloud className="h-3.5 w-3.5" />
                              Request upload
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                  No local-only registry entries found.
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Selected minute</div>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">{selectedBundle?.minute || 'No minute selected'}</h2>
          {selectedBundle ? (
            <div className="mt-4 space-y-5">
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Device</span>
                  <span className="font-medium text-slate-900">{selectedBundle.deviceLabel}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-slate-500">Uploaded</span>
                  <span className="font-medium text-slate-900">{formatStamp(selectedBundle.uploadedAt)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-slate-500">State</span>
                  <span className="font-medium text-slate-900">{selectedBundle.complete ? 'Ready' : 'Collecting'}</span>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-950">Files</div>
                <div className="mt-3 space-y-2 text-sm">
                  <FileLink label="Video" file={selectedBundle.video} icon={<Video className="h-4 w-4" />} />
                  <FileLink label="Radar" file={selectedBundle.radar} icon={<Radar className="h-4 w-4" />} />
                  <FileLink label="CSI" file={selectedBundle.csi} icon={<Wifi className="h-4 w-4" />} />
                  <FileLink label="Manifest" file={selectedBundle.manifest} icon={<FileText className="h-4 w-4" />} />
                  <FileLink label="Predictions" file={selectedBundle.predictions} icon={<Brain className="h-4 w-4" />} />
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-950">Labels</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(selectedBundle.labels || []).length ? selectedBundle.labels.map((label) => (
                    <span key={label} className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-700">{label}</span>
                  )) : (
                    <span className="text-sm text-slate-500">No labels yet.</span>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-950">Prediction timeline</div>
                <div className="mt-3">
                  {predictionLoading ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Loading predictions...</div>
                  ) : predictionTimeline.length ? (
                    <div className="space-y-2">
                      {predictionTimeline.slice(0, 12).map((row, index) => (
                        <div key={`${row.timestamp || row.minute || index}`} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm">
                          <div>
                            <div className="font-medium text-slate-900">{row.prediction || row.label || (row.occupied ? 'occupied' : 'empty')}</div>
                            <div className="text-xs text-slate-500">{row.timestamp || row.minute || 'minute sample'}</div>
                          </div>
                          <div className="text-right text-xs text-slate-500">
                            <div>{typeof row.confidence === 'number' ? `confidence ${row.confidence.toFixed(3)}` : ''}</div>
                            <div>{typeof row.probability === 'number' ? `probability ${row.probability.toFixed(3)}` : ''}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                      No prediction file found for this minute.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-950">Sensors on device</div>
                <div className="mt-3 space-y-2">
                  {(getSensors(selectedDevice || ({} as Device)) || []).length ? getSensors(selectedDevice || ({} as Device)).map((sensor) => (
                    <div key={sensor.sensor_type} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                      <div>
                        <div className="font-medium text-slate-900">{sensor.name}</div>
                        <div className="text-xs text-slate-500">{sensor.sensor_type}</div>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${sensor.available ? 'bg-emerald-500/10 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {sensor.available ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  )) : (
                    <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">No sensors reported.</div>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-950">Files in bundle</div>
                <div className="mt-3 space-y-2 text-xs font-mono text-slate-600">
                  {selectedBundle.files.map((file) => (
                    <div key={file.file_id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                      <div className="min-w-0">
                        <div className="break-all font-medium text-slate-900">{file.filename}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{humanBytes(file.size || 0)} · {formatStamp(file.uploaded_at)}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => downloadCloudFile(file, true)}
                          disabled={fileBusyId === file.file_id}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadCloudFile(file, false)}
                          disabled={fileBusyId === file.file_id}
                          className="rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          {fileBusyId === file.file_id ? 'Working...' : 'Download'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              Pick a cloud minute bundle to inspect its files, labels, sensors, and predictions.
            </div>
          )}
        </aside>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Device deployments</div>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">Queued models</h2>
          </div>
          <Download className="h-5 w-5 text-slate-400" />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {deployments.length ? deployments.map((deployment) => (
            <div key={deployment.deployment_id || deployment.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">{deployment.model_name}</div>
                  <div className="mt-1 text-xs text-slate-500">{deployment.device_name || deployment.device_id}</div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${deployment.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-700' : deployment.status === 'pending' ? 'bg-amber-500/10 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                  {deployment.status || 'unknown'}
                </span>
              </div>
              <div className="mt-3 text-xs text-slate-500">
                {deployment.model_type || 'model'} · {formatStamp(deployment.created_at)}
              </div>
            </div>
          )) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              No deployments returned by Brain for the current account.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function FileLink({
  label,
  file,
  icon,
}: {
  label: string;
  file?: CloudFile;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-slate-500">{icon}</span>
        <div className="min-w-0">
          <div className="font-medium text-slate-900">{label}</div>
          <div className="truncate text-xs text-slate-500">{file ? file.filename : 'Missing'}</div>
        </div>
      </div>
      <span className={`rounded-full px-2 py-1 text-xs font-medium ${file ? 'bg-emerald-500/10 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
        {file ? 'Available' : 'Missing'}
      </span>
    </div>
  );
}
