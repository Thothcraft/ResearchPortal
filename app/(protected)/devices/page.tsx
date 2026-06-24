'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Cpu,
  Download,
  FolderOpen,
  RefreshCw,
  SlidersHorizontal,
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
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function minuteMatchesDevice(device: Device, minute: LocalMinuteSummary): boolean {
  const candidates = [
    device.device_uuid,
    device.device_id,
    device.device_name,
    device.hardware_info?.hostname,
    device.hardware_info?.raspberry_pi_model,
    device.hardware_info?.device_type,
  ].map(normalizeKey).filter(Boolean);
  const minuteCandidates = [
    minute.deviceKey,
    minute.deviceLabel,
    minute.relativePath,
    minute.minuteName,
  ].map(normalizeKey).filter(Boolean);
  return minuteCandidates.some((candidate) => candidates.includes(candidate));
}

function normalizeSettings(value?: CaptureSettings | null): CaptureSettings {
  return {
    labels: Array.isArray(value?.labels) ? value!.labels.map(String).filter(Boolean) : [],
    sensors: { ...DEFAULT_SENSORS, ...(value?.sensors || {}) },
  };
}

function DevicePanel({
  device,
  files,
  minutes,
  settings,
  onSaveSettings,
  onDownloadCloudFile,
  onDownloadMinute,
}: {
  device: Device;
  files: DeviceFileSummary[];
  minutes: LocalMinuteSummary[];
  settings: CaptureSettings;
  onSaveSettings: (deviceId: string, settings: CaptureSettings) => Promise<void>;
  onDownloadCloudFile: (fileId: number, filename?: string) => Promise<void>;
  onDownloadMinute: (minute: string, deviceId: string) => Promise<void>;
}) {
  const hardware = device.hardware_info || {};
  const sensors = hardware.sensors || hardware.available_sensors || [];
  const [expanded, setExpanded] = useState(false);
  const [draftLabel, setDraftLabel] = useState(settings.labels.join(', '));
  const [draftSensors, setDraftSensors] = useState<Record<string, boolean>>(settings.sensors);
  const matchedMinutes = useMemo(() => {
    const scoped = minutes.filter((minute) => minuteMatchesDevice(device, minute));
    return scoped.length ? scoped : minutes;
  }, [device, minutes]);
  const freshFileActivity = matchedMinutes.some((minute) => isRecent(minute.modified, 3 * 60 * 1000));

  useEffect(() => {
    setDraftLabel(settings.labels.join(', '));
    setDraftSensors(settings.sensors);
  }, [settings]);

  const minuteBundles = useMemo(() => {
    return matchedMinutes
      .map((minute) => ({
        minute: minute.minute,
        minuteLabel: minute.relativePath,
        fileCount: Object.values(minute.files).filter(Boolean).length,
        totalSize: Object.values(minute.sizes || {}).reduce((sum, size) => sum + Number(size || 0), 0),
        labels: minute.labels,
        uploaded: minute.uploaded,
      }))
      .sort((a, b) => b.minute.localeCompare(a.minute));
  }, [matchedMinutes]);

  const saveSettings = async () => {
    await onSaveSettings(device.device_uuid, {
      labels: draftLabel.split(',').map((label) => label.trim()).filter(Boolean),
      sensors: { ...DEFAULT_SENSORS, ...draftSensors },
    });
  };

  return (
    <article className={`border border-slate-300 ${(device.online || freshFileActivity) ? 'bg-white' : 'bg-slate-100 opacity-75 grayscale'}`}>
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full flex-col gap-4 border-b border-slate-300 p-5 text-left lg:flex-row lg:items-start lg:justify-between"
      >
        <div className="flex items-start gap-3">
          <div className="bg-slate-950 p-3 text-white">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">{device.device_type || hardware.device_type || 'device'}</div>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">{device.device_name || device.device_id}</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-700">
              <span className={`border px-2 py-1 font-medium ${(device.online || freshFileActivity) ? 'border-emerald-700 bg-emerald-50 text-emerald-800' : 'border-slate-400 bg-slate-100 text-slate-700'}`}>
                {(device.online || freshFileActivity) ? 'Online' : 'Offline'}
              </span>
              <span className="border border-slate-300 bg-white px-2 py-1">IP {device.ip_address || 'N/A'}</span>
              <span className="border border-slate-300 bg-white px-2 py-1">Last seen {device.last_seen ? new Date(parseServerTime(device.last_seen)).toLocaleString() : 'N/A'}</span>
              <span className="border border-slate-300 bg-white px-2 py-1">{minuteBundles.length} captured minutes</span>
              <span className="border border-slate-300 bg-white px-2 py-1">{expanded ? 'Expanded' : 'Collapsed'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hardware.raspberry_pi_model && (
            <div className="max-w-sm text-sm font-medium text-slate-800">{hardware.raspberry_pi_model}</div>
          )}
          {expanded ? <ChevronDown className="h-5 w-5 text-slate-700" /> : <ChevronRight className="h-5 w-5 text-slate-700" />}
        </div>
      </button>

      {expanded && (
      <div className="grid gap-0 lg:grid-cols-[360px_1fr]">
        <section className="border-b border-slate-300 p-5 lg:border-b-0 lg:border-r">
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

        <section className="p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-800">
            <FolderOpen className="h-4 w-4" />
            Captured minutes
          </div>
          <div className="space-y-3">
            {minuteBundles.map((minute) => (
              <div key={minute.minute} className="border border-slate-300 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="font-mono text-base font-semibold text-slate-950">{minute.minute}</div>
                    <div className="mt-1 text-sm text-slate-700">
                      {minute.fileCount} files · {humanBytes(minute.totalSize)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-700">
                      {minute.labels.length ? minute.labels.map((label) => (
                        <span key={`${minute.minute}:${label}`} className="border border-slate-300 bg-slate-50 px-2 py-1">
                          {label}
                        </span>
                      )) : (
                        <span className="border border-slate-300 bg-slate-50 px-2 py-1">
                          {minute.minuteLabel}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {minute.fileCount > 0 && (
                      <button
                        type="button"
                        onClick={() => onDownloadMinute(minute.minute, device.device_uuid)}
                        className="inline-flex items-center gap-2 bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                      >
                        <Download className="h-4 w-4" />
                        Download minute
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {!minuteBundles.length && (
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
  const { get, put } = useApi();
  const { user, isLoading: authLoading } = useAuth();
  const toast = useToast();

  const loadData = useCallback(async (showLoading = false) => {
    if (authLoading || !user?.token) return;
    if (showLoading) setLoading(true);
    try {
      const deviceRes = await get('/device/list?include_offline=true').catch(() => ({ devices: [] }));
      const remoteDevices = Array.isArray(deviceRes?.devices) ? deviceRes.devices : [];
      setDevices(remoteDevices);

      const minutesRes = await fetch('/api/data/minutes', { cache: 'no-store' })
        .then((response) => response.json())
        .catch(() => ({ minutes: [] }));
      setMinutes(Array.isArray(minutesRes?.minutes) ? minutesRes.minutes : []);

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

  const rows = useMemo(() => devices.map((device) => {
    const files = deviceFiles[device.device_uuid] || [];
    const freshFileActivity = files.some((file) => isRecent(file.last_synced || file.modified_at, 15 * 60 * 1000));
    return { ...device, online: Boolean(device.online || isRecent(device.last_seen, 15 * 60 * 1000) || freshFileActivity) };
  }), [deviceFiles, devices]);

  const saveSettings = async (deviceId: string, nextSettings: CaptureSettings) => {
    const response = await put(`/device/${deviceId}/capture-settings`, nextSettings);
    if (!response?.success) throw new Error(response?.message || 'Unable to save settings');
    setSettings((current) => ({ ...current, [deviceId]: normalizeSettings(response.capture_settings) }));
    toast.success('Settings applied', 'Ongoing collection will use the updated label and sensors');
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
  const totalMinutes = minutes.length;

  if (loading && !devices.length) {
    return <div className="border border-slate-300 bg-white p-8 text-sm text-slate-700">Loading devices...</div>;
  }

  return (
    <div className="space-y-6 text-slate-950">
      <section className="border border-slate-300 bg-white p-5">
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
            className="inline-flex items-center gap-2 border border-slate-400 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-100"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="border border-slate-300 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">Online</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{onlineCount}/{rows.length}</div>
          </div>
          <div className="border border-slate-300 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">Captured minutes</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{totalMinutes}</div>
          </div>
          <div className="border border-slate-300 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">Registered devices</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{rows.length}</div>
          </div>
        </div>
      </section>

      <div className="space-y-5">
        {rows.map((device) => (
          <DevicePanel
            key={device.device_uuid}
            device={device}
            files={deviceFiles[device.device_uuid] || []}
            minutes={minutes}
            settings={settings[device.device_uuid] || normalizeSettings(device.hardware_info?.capture_settings)}
            onSaveSettings={saveSettings}
            onDownloadCloudFile={(fileId, filename = 'file') => downloadFromUrl(`/api/proxy/file/${fileId}`, filename)}
            onDownloadMinute={(minute, deviceId) => downloadFromUrl(`/api/proxy/file/minute/${minute}/download?device_id=${encodeURIComponent(deviceId)}`, `${minute}.zip`)}
          />
        ))}
        {!rows.length && (
          <div className="border border-dashed border-slate-400 bg-white p-8 text-sm text-slate-700">
            No devices are registered yet.
          </div>
        )}
      </div>
    </div>
  );
}
