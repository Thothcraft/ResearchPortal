'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  Activity,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Cpu,
  Download,
  FolderOpen,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';

type Sensor = {
  sensor_type?: string;
  key?: string;
  name?: string;
  available?: boolean;
};

type CaptureSettings = {
  labels: string[];
  sensors: Record<string, boolean>;
};

type DeviceHardwareInfo = {
  device_type?: string;
  is_raspberry_pi?: boolean;
  raspberry_pi_model?: string;
  portal_upload_allowed?: boolean;
  sensors?: Sensor[];
  available_sensors?: Sensor[];
  hostname?: string;
  capture_settings?: CaptureSettings;
};

type Device = {
  device_id: string;
  device_name: string;
  device_type: string;
  online: boolean;
  battery_level: number | null;
  last_seen: string;
  ip_address: string;
  mac_address: string | null;
  device_uuid: string;
  hardware_info?: DeviceHardwareInfo;
};

type DeviceFileSummary = {
  id: number;
  filename: string;
  size?: number;
  file_type?: string;
  created_at?: string;
  modified_at?: string;
  on_device: boolean;
  on_cloud: boolean;
  cloud_file_id?: number | null;
  upload_requested: boolean;
  last_synced?: string;
  label?: string | null;
  labels?: string[];
  occupancy?: {
    label?: string;
    detected_frames?: number;
    evaluated_frames?: number;
    ratio?: number;
    threshold_percent?: number;
  } | null;
  metadata?: { label?: string; labels?: string[] };
};

type LocalMinuteSummary = {
  minute: string;
  minuteName: string;
  relativePath: string;
  path: string;
  modified: string;
  created: string;
  deviceKey: string;
  deviceLabel: string;
  labels: string[];
  occupancy?: DeviceFileSummary['occupancy'];
  progress?: {
    expectedChunks: number;
    storedChunks: number;
    analyzedChunks: number;
    storagePercent: number;
    predictionPercent: number;
    chunkSeconds?: number | null;
  };
  completed: boolean;
  state: 'ready' | 'collecting';
  uploaded: boolean;
  files: {
    video: boolean;
    radar: boolean;
    csi: boolean;
    manifest: boolean;
    predictions: boolean;
  };
  sizes: Record<string, number>;
  dataFiles?: Array<{
    filename: string;
    relativePath: string;
    path: string;
    size: number;
    modified: string;
    contentType: string;
  }>;
};

const DEFAULT_SENSORS: Record<string, boolean> = {
  usb_camera: true,
  dreamhat_radar: true,
  esp32_csi: true,
  sense_hat: true,
};

const SENSOR_LABELS: Record<string, string> = {
  usb_camera: 'Camera',
  dreamhat_radar: 'Radar',
  esp32_csi: 'CSI',
  sense_hat: 'Sense HAT',
};

function humanBytes(bytes?: number): string {
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

function parseServerTime(value?: string | null): number {
  if (!value) return NaN;
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  return new Date(normalized).getTime();
}

function isRecent(value?: string | null, windowMs = 10 * 60 * 1000): boolean {
  if (!value) return false;
  const time = parseServerTime(value);
  return Number.isFinite(time) && Date.now() - time <= windowMs;
}

function normalizeKey(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function matchesDevice(device: Device, minute: LocalMinuteSummary): boolean {
  const deviceKeys = [
    device.device_uuid,
    device.device_id,
    device.device_name,
    device.hardware_info?.hostname,
    device.hardware_info?.raspberry_pi_model,
    device.hardware_info?.device_type,
  ].map(normalizeKey).filter(Boolean);
  const minuteKeys = [minute.deviceKey, minute.deviceLabel, minute.relativePath, minute.minuteName]
    .map(normalizeKey)
    .filter(Boolean);
  return minuteKeys.some((key) => deviceKeys.includes(key));
}

function normalizeSettings(value?: CaptureSettings | null): CaptureSettings {
  return {
    labels: Array.isArray(value?.labels) ? value!.labels.map(String).filter(Boolean) : [],
    sensors: { ...DEFAULT_SENSORS, ...(value?.sensors || {}) },
  };
}

function labelsForFile(file: DeviceFileSummary): string[] {
  const candidates = [
    ...(Array.isArray(file.labels) ? file.labels : []),
    ...(Array.isArray(file.metadata?.labels) ? file.metadata.labels : []),
    file.label,
    file.metadata?.label,
    file.occupancy?.label,
  ];
  return Array.from(new Set(candidates.map((value) => String(value || '').trim()).filter(Boolean)));
}

function DevicePanel({
  device,
  files,
  minutes,
  settings,
  onSaveSettings,
  onDownloadCloudFile,
  onDownloadMinute,
  onUploadMinute,
  onRename,
  onRemove,
}: {
  device: Device;
  files: DeviceFileSummary[];
  minutes: LocalMinuteSummary[];
  settings: CaptureSettings;
  onSaveSettings: (deviceId: string, settings: CaptureSettings) => Promise<void>;
  onDownloadCloudFile: (fileId: number, filename?: string) => Promise<void>;
  onDownloadMinute: (minute: string, deviceId: string) => Promise<void>;
  onUploadMinute: (minute: string, deviceId: string) => Promise<void>;
  onRename: (deviceId: string, name: string) => Promise<void>;
  onRemove: (deviceId: string) => Promise<void>;
}) {
  const hardware = device.hardware_info || {};
  const sensors = hardware.sensors || hardware.available_sensors || [];
  const [expanded, setExpanded] = useState(false);
  const [draftLabel, setDraftLabel] = useState(settings.labels.join(', '));
  const [draftSensors, setDraftSensors] = useState<Record<string, boolean>>(settings.sensors);
  const [draftName, setDraftName] = useState(device.device_name || device.device_id);
  const [openMinute, setOpenMinute] = useState<string | null>(null);

  const matchedMinutes = useMemo(() => {
    return minutes.filter((minute) => matchesDevice(device, minute));
  }, [device, minutes]);

  useEffect(() => {
    setDraftLabel(settings.labels.join(', '));
    setDraftSensors(settings.sensors);
  }, [settings]);

  const saveSettings = async () => {
    await onSaveSettings(device.device_uuid, {
      labels: draftLabel.split(',').map((label) => label.trim()).filter(Boolean),
      sensors: { ...DEFAULT_SENSORS, ...draftSensors },
    });
  };

  return (
    <article className={`overflow-hidden rounded-2xl border border-slate-200 shadow-sm transition ${device.online ? 'bg-white' : 'bg-slate-50 opacity-80'}`}>
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full flex-col gap-4 border-b border-slate-200 p-4 text-left transition hover:bg-slate-50 sm:p-5 lg:flex-row lg:items-start lg:justify-between"
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-xl bg-slate-950 p-3 text-white">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">{device.device_name || device.device_id}</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-700">
              <span className={`rounded-full border px-2.5 py-1 font-medium ${device.online ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-slate-100 text-slate-700'}`}>
                {device.online ? 'Online' : 'Offline'}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">IP {device.ip_address || 'N/A'}</span>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Last seen {device.last_seen ? new Date(parseServerTime(device.last_seen)).toLocaleString() : 'N/A'}</span>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">{matchedMinutes.length} captured minutes</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="h-5 w-5 text-slate-700" /> : <ChevronRight className="h-5 w-5 text-slate-700" />}
        </div>
      </button>

      {expanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-8" onClick={() => { setExpanded(false); setOpenMinute(null); }}>
          <div className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-[#f4f1e9]" onClick={(event) => event.stopPropagation()}>
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-300 bg-[#f4f1e9] p-4 sm:p-5"><div className="flex items-center gap-4">{openMinute && <button type="button" onClick={() => setOpenMinute(null)} className="rounded-full border border-slate-400 px-3 py-1.5 text-sm font-semibold">← Back</button>}<div><div className="text-xs font-semibold uppercase tracking-wider text-slate-600">{openMinute ? 'Captured minute' : 'Device'}</div><h2 className="text-2xl font-semibold">{openMinute || device.device_name || device.device_id}</h2></div></div><button type="button" aria-label="Close device" onClick={() => { setExpanded(false); setOpenMinute(null); }}><X className="h-6 w-6"/></button></header>
          {openMinute ? <iframe title={`Captured minute ${openMinute}`} src={`/captures/${encodeURIComponent(device.device_uuid)}/${encodeURIComponent(openMinute)}?embedded=1`} className="h-[calc(94vh-82px)] w-full border-0"/> : <>
          <div className="grid gap-0 lg:grid-cols-[360px_1fr]">
          <section className="border-b border-slate-200 p-4 sm:p-5 lg:border-b-0 lg:border-r">
            <div className="mb-6"><label className="text-xs font-semibold uppercase tracking-wide text-slate-700">Device name</label><div className="mt-2 flex gap-2"><input value={draftName} onChange={(event) => setDraftName(event.target.value)} className="min-w-0 flex-1 border border-slate-400 bg-white px-3 py-2"/><button type="button" onClick={() => onRename(device.device_uuid, draftName)} className="inline-flex items-center gap-2 bg-slate-950 px-3 text-sm font-semibold text-white"><Pencil className="h-4 w-4"/>Save</button></div><button type="button" onClick={() => onRemove(device.device_uuid)} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-red-700"><Trash2 className="h-4 w-4"/>Remove device</button></div>
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-800">
              <SlidersHorizontal className="h-4 w-4" />
              Ongoing collection
            </div>
            <label className="block text-sm font-medium text-slate-950">
              Current label
              <input
                value={draftLabel}
                onChange={(event) => setDraftLabel(event.target.value)}
                placeholder="comma-separated labels"
                className="mt-2 w-full border border-slate-400 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-slate-950"
              />
            </label>
            <div className="mt-5 space-y-3">
              {Object.keys(DEFAULT_SENSORS).map((key) => (
                <label key={key} className="flex items-center justify-between gap-4 border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-950">
                  <span>{SENSOR_LABELS[key] || key}</span>
                  <input
                    type="checkbox"
                    checked={draftSensors[key] !== false}
                    onChange={(event) => setDraftSensors((current) => ({ ...current, [key]: event.target.checked }))}
                    className="h-5 w-5"
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={saveSettings}
              className="mt-5 w-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Apply to current and next minutes
            </button>
            <div className="mt-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950">
                <Activity className="h-4 w-4" />
                Detected sensors
              </div>
              <div className="space-y-2">
                {sensors.length ? sensors.map((sensor) => (
                  <div key={sensor.sensor_type || sensor.key || sensor.name} className="flex justify-between gap-3 border border-slate-300 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-950">{sensor.name || sensor.sensor_type || sensor.key}</span>
                    <span className={sensor.available ? 'text-emerald-800' : 'text-slate-600'}>{sensor.available ? 'Online' : 'Offline'}</span>
                  </div>
                )) : (
                  <div className="border border-dashed border-slate-400 p-3 text-sm text-slate-700">No sensors reported yet.</div>
                )}
              </div>
            </div>
          </section>

          <section className="min-w-0 p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-800">
              <FolderOpen className="h-4 w-4" />
              Captured minutes
            </div>
            <div className="space-y-3">
              {matchedMinutes.map((minute) => {
                const dataFiles = minute.dataFiles || [];
                const fileCount = dataFiles.length;
                const totalSize = dataFiles.reduce((sum, file) => sum + Number(file.size || 0), 0);
                return (
                  <div key={minute.minute} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="font-mono text-base font-semibold text-slate-950">{minute.minute}</div>
                        <div className="mt-1 text-sm text-slate-700">
                          {new Date(parseServerTime(minute.created || minute.modified)).toLocaleString()} · {fileCount} item · {humanBytes(totalSize)}
                        </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium text-slate-700">
                          {Object.entries(minute.files).filter(([key, present]) => present && !['manifest', 'predictions'].includes(key)).map(([sensor]) => (
                            <span key={`${minute.minute}:${sensor}`} className="border border-cyan-300 bg-cyan-50 px-2 py-1">{sensor === 'radar' ? 'radar' : sensor.replaceAll('_', ' ')}</span>
                          ))}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-700">
                          {minute.labels.length ? minute.labels.map((label) => (
                            <span key={`${minute.minute}:${label}`} className="border border-slate-300 bg-slate-50 px-2 py-1">
                              {label}
                            </span>
                          )) : (
                            <span className="border border-slate-300 bg-slate-50 px-2 py-1">
                              {minute.relativePath}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className={`rounded-full px-2.5 py-1 font-semibold ${minute.uploaded ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-800'}`}>
                            {minute.uploaded ? 'Uploaded' : 'On device only'}
                          </span>
                          {!!minute.occupancy?.evaluated_frames && (
                            <span className="text-slate-600">
                              {minute.occupancy.detected_frames || 0} / {minute.occupancy.evaluated_frames} detected
                            </span>
                          )}
                        </div>
                        {minute.progress && (
                          <div className="mt-3 max-w-xl space-y-2">
                            <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500">
                              <span>Storage</span>
                              <span>{Math.round(minute.progress.storagePercent)}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                              <div className="h-full rounded-full bg-cyan-500" style={{ width: `${minute.progress.storagePercent}%` }} />
                            </div>
                            <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500">
                              <span>Predictions</span>
                              <span>{Math.round(minute.progress.predictionPercent)}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${minute.progress.predictionPercent}%` }} />
                            </div>
                          </div>
                        )}
                        {dataFiles.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-700">
                            {dataFiles.slice(0, 6).map((file) => (
                              <span key={`${minute.minute}:${file.relativePath}`} className="border border-slate-300 bg-slate-50 px-2 py-1">
                                {file.filename}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
                        <button
                          type="button"
                          onClick={() => onUploadMinute(minute.minute, device.device_uuid).then(() => setOpenMinute(minute.minute)).catch((error) => window.alert(error instanceof Error ? error.message : 'Upload request failed'))}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-700 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-950 hover:bg-cyan-100"
                        >
                          <BarChart3 className="h-4 w-4" />
                          Upload and view
                        </button>
                        {fileCount > 0 && (
                          <button
                            type="button"
                            onClick={() => onDownloadMinute(minute.minute, device.device_uuid)}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                          >
                            <Download className="h-4 w-4" />
                            Download minute
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {!matchedMinutes.length && (
                <div className="border border-dashed border-slate-400 p-6 text-sm text-slate-700">
                  No captured minutes are registered for this device yet.
                </div>
              )}
            </div>

            {files.some((file) => file.on_cloud && file.cloud_file_id) && (
              <div className="mt-6 border-t border-slate-300 pt-4">
                <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-800">Cloud files</div>
                <div className="space-y-2">
                  {files.filter((file) => file.on_cloud && file.cloud_file_id).slice(0, 8).map((file) => (
                    <div key={file.id} className="flex items-center justify-between gap-3 border border-slate-300 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate text-slate-950">{file.filename}</span>
                      <button
                        type="button"
                        onClick={() => onDownloadCloudFile(file.cloud_file_id!, file.filename)}
                        className="font-semibold text-slate-950 underline"
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
          </div></>}
          </div>
        </div>
      )}
    </article>
  );
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceFiles, setDeviceFiles] = useState<Record<string, DeviceFileSummary[]>>({});
  const [minutes, setMinutes] = useState<LocalMinuteSummary[]>([]);
  const [settings, setSettings] = useState<Record<string, CaptureSettings>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const { get, put, delete: del } = useApi();
  const { user, isLoading: authLoading } = useAuth();
  const toast = useToast();

  const loadData = useCallback(async (showLoading = false) => {
    if (authLoading || !user?.token) return;
    if (showLoading) setLoading(true);
    try {
      const deviceRes = await get('/device/list?include_offline=true').catch(() => ({ devices: [] }));
      const remoteDevices = Array.isArray(deviceRes?.devices) ? deviceRes.devices : [];
      setDevices(remoteDevices);

      const entries = await Promise.all(remoteDevices.map(async (device: Device) => {
        const [fileRes, settingsRes] = await Promise.all([
          get(`/device/${device.device_uuid}/files`).catch(() => ({ files: [] })),
          get(`/device/${device.device_uuid}/capture-settings`).catch(() => null),
        ]);
        return {
          id: device.device_uuid,
          files: Array.isArray(fileRes?.files) ? fileRes.files : [],
          settings: normalizeSettings(settingsRes?.capture_settings || device.hardware_info?.capture_settings),
        };
      }));

      setDeviceFiles(Object.fromEntries(entries.map((entry) => [entry.id, entry.files])));
      setMinutes(entries.flatMap((entry) => entry.files.map((file: DeviceFileSummary) => {
        const sensors = String(file.file_type || '').split(':')[1]?.split(',').filter(Boolean) || [];
        return {
          minute: file.filename,
          minuteName: file.filename,
          relativePath: file.filename,
          path: '',
          modified: file.modified_at || file.last_synced || '',
          created: file.created_at || '',
          deviceKey: entry.id,
          deviceLabel: entry.id,
          labels: labelsForFile(file),
          occupancy: file.occupancy,
          completed: true,
          state: 'ready' as const,
          uploaded: file.on_cloud,
          files: { video: sensors.includes('video'), radar: sensors.includes('radar'), csi: sensors.includes('csi'), manifest: true, predictions: false },
          sizes: { total: Number(file.size || 0) },
          dataFiles: [{ filename: file.filename, relativePath: file.filename, path: '', size: Number(file.size || 0), modified: file.modified_at || '', contentType: 'capture/minute' }],
        };
      })));
      setSettings(Object.fromEntries(entries.map((entry) => [entry.id, entry.settings])));
    } catch (err) {
      toast.error('Load failed', err instanceof Error ? err.message : 'Unable to load devices');
    } finally {
      setLoading(false);
    }
  }, [authLoading, get, toast, user?.token]);

  useEffect(() => {
    if (authLoading || !user?.token) return;
    loadData(true);
    const timer = window.setInterval(() => loadData(false), 10000);
    return () => window.clearInterval(timer);
  }, [authLoading, loadData, user?.token]);

  const rows = useMemo(() => devices.map((device) => ({ ...device, online: Boolean(device.online) })), [devices]);
  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((device) => {
      if (onlineOnly && !device.online) return false;
      if (!needle) return true;
      return [device.device_name, device.device_id, device.device_uuid, device.ip_address, device.hardware_info?.hostname]
        .some((value) => String(value || '').toLowerCase().includes(needle));
    });
  }, [onlineOnly, query, rows]);

  const saveSettings = async (deviceId: string, nextSettings: CaptureSettings) => {
    const response = await put(`/device/${deviceId}/capture-settings`, nextSettings);
    if (!response?.success) throw new Error(response?.message || 'Unable to save settings');
    setSettings((current) => ({ ...current, [deviceId]: normalizeSettings(response.capture_settings) }));
    toast.success('Settings applied', 'Ongoing collection will use the updated label and sensors');
  };

  const renameDevice = async (deviceId: string, name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    await put(`/device/${deviceId}`, { device_name: cleanName });
    setDevices((current) => current.map((device) => device.device_uuid === deviceId ? { ...device, device_name: cleanName } : device));
    toast.success('Device renamed', cleanName);
  };

  const removeDevice = async (deviceId: string) => {
    if (!window.confirm('Remove this device from the portal? Collected files will not be deleted.')) return;
    await del(`/device/${deviceId}`);
    setDevices((current) => current.filter((device) => device.device_uuid !== deviceId));
    toast.success('Device removed');
  };

  const downloadFromUrl = useCallback(async (url: string, fallbackName: string) => {
    try {
      const response = await fetch(url, {
        headers: user?.token ? { Authorization: `Bearer ${user.token}` } : undefined,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fallbackName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      toast.error('Download failed', err instanceof Error ? err.message : 'Unable to download');
    }
  }, [toast, user?.token]);

  const onlineCount = rows.filter((device) => device.online).length;

  if (loading && !devices.length) {
    return <div className="border border-slate-300 bg-white p-8 text-sm text-slate-700">Loading devices...</div>;
  }

  return (
    <div className="space-y-4 text-slate-950 sm:space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">Devices</div>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">Thoth devices</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
              Monitor online status, apply ongoing capture labels and sensor toggles, and move captured minutes to cloud storage.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadData(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-100"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">Online</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{onlineCount}/{rows.length}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">Captured minutes</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{minutes.length}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">Registered devices</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{rows.length}</div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search devices by name, host, IP…" className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium sm:justify-start">
            Online only
            <input type="checkbox" checked={onlineOnly} onChange={(event) => setOnlineOnly(event.target.checked)} className="h-4 w-4 accent-cyan-600" />
          </label>
        </div>
      </section>

      <div className="space-y-5">
        {visibleRows.map((device) => (
          <DevicePanel
            key={device.device_uuid}
            device={device}
            files={deviceFiles[device.device_uuid] || []}
            minutes={minutes}
            settings={settings[device.device_uuid] || normalizeSettings(device.hardware_info?.capture_settings)}
            onSaveSettings={saveSettings}
            onRename={renameDevice}
            onRemove={removeDevice}
            onDownloadCloudFile={(fileId, filename = 'file') => downloadFromUrl(`/api/proxy/file/${fileId}`, filename)}
            onDownloadMinute={(minute, deviceId) => downloadFromUrl(`/api/proxy/file/minute/${minute}/download?device_id=${encodeURIComponent(deviceId)}`, `${minute}.zip`)}
            onUploadMinute={async (minute, deviceId) => {
              const response = await fetch(`/api/proxy/device/${encodeURIComponent(deviceId)}/captures/${encodeURIComponent(minute)}/request-upload`, {
                method: 'POST',
                headers: user?.token ? { Authorization: `Bearer ${user.token}` } : undefined,
              });
              if (!response.ok) throw new Error(await response.text());
              return;
            }}
          />
        ))}
        {!visibleRows.length && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-700">
            {rows.length ? 'No devices match the current filters.' : 'No devices are registered yet.'}
          </div>
        )}
      </div>
    </div>
  );
}
