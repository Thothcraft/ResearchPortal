'use client';

import type { ElementType } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/contexts/ToastContext';
import {
  Brain,
  Radar,
  RefreshCw,
  Video,
  Wifi,
  Network,
  Image as ImageIcon,
  Layers3,
  ChevronRight,
  CircleDot,
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
  hardware_info?: {
    hostname?: string;
    device_type?: string;
    is_raspberry_pi?: boolean;
    portal_upload_allowed?: boolean;
    deployment_requests_allowed?: boolean;
    cloud_sync_allowed?: boolean;
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

type MinuteSourceType = 'image' | 'video' | 'csi' | 'radar';

type MinuteSource = {
  minute: string;
  type: MinuteSourceType;
  deviceId: string;
  deviceName: string;
  files: CloudFile[];
  labels: string[];
  uploadedAt: string;
};

const SOURCE_TYPES: Array<{
  type: MinuteSourceType;
  label: string;
  description: string;
  icon: ElementType;
}> = [
  { type: 'image', label: 'Images', description: 'Resize and optional Canny edge detection', icon: ImageIcon },
  { type: 'video', label: 'Video', description: 'Minute-long camera clips', icon: Video },
  { type: 'csi', label: 'CSI', description: 'Magnitude views from subcarrier data', icon: Wifi },
  { type: 'radar', label: 'Radar', description: 'Range, Doppler, and azimuth views', icon: Radar },
];

const PRETRAINED_MODELS = [
  {
    key: 'opencv_person_detector',
    name: 'OpenCV Person Detector',
    subtitle: 'Pretrained image baseline for workflow validation',
    description: 'A lightweight HOG + SVM person detector that can be deployed without training.',
  },
];

function extractMinute(value: unknown): string | null {
  const match = String(value || '').match(/\b\d{8}_\d{4}\b/);
  return match ? match[0] : null;
}

function inferType(file: CloudFile): MinuteSourceType | null {
  const name = (file.filename || '').toLowerCase();
  if (name.endsWith('manifest.json') || name.endsWith('predictions.json')) return null;
  if (name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.mkv')) return 'video';
  if (name.endsWith('.bin')) return 'radar';
  if (name.endsWith('.jsonl')) return 'csi';
  if (name.endsWith('.csv') && (name.includes('csi') || name.includes('wifi'))) return 'csi';
  if (name.endsWith('.json') && (name.includes('csi') || name.includes('wifi'))) return 'csi';
  if (name.match(/\.(png|jpg|jpeg|gif|bmp|webp|tiff)$/)) return 'image';
  return null;
}

function parseLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)));
}

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

function getDeviceName(device: Device) {
  return device.device_name || device.hardware_info?.hostname || device.device_uuid || 'Unknown device';
}

function getSensors(device: Device): Sensor[] {
  return device.hardware_info?.sensors || device.hardware_info?.available_sensors || [];
}

export default function TrainingPage() {
  const { get } = useApi();
  const toast = useToast();

  const [devices, setDevices] = useState<Device[]>([]);
  const [cloudFiles, setCloudFiles] = useState<CloudFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<MinuteSourceType>('image');
  const [selectedMinute, setSelectedMinute] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [deviceRes, fileRes] = await Promise.all([
        get('/device/list?include_offline=true').catch(() => ({ devices: [] })),
        get('/file/files?limit=500').catch(() => ({ files: [] })),
      ]);
      setDevices(Array.isArray(deviceRes?.devices) ? deviceRes.devices : []);
      setCloudFiles(Array.isArray(fileRes?.files) ? fileRes.files : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load training data';
      setError(message);
      toast.error('Load failed', message);
    } finally {
      setLoading(false);
    }
  }, [get, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const sources = useMemo(() => {
    const grouped = new Map<string, MinuteSource>();

    for (const file of cloudFiles) {
      const minute = String(file.metadata?.minute || extractMinute(file.filename) || '').trim();
      if (!minute) continue;
      const type = inferType(file);
      if (!type) continue;

      const deviceId = String(file.device_id || file.metadata?.device_id || '').trim();
      const device = devices.find((entry) => entry.device_uuid === deviceId || entry.device_id === deviceId);
      const key = `${minute}::${type}`;
      const current = grouped.get(key) || {
        minute,
        type,
        deviceId,
        deviceName: device ? getDeviceName(device) : (deviceId || 'Unknown device'),
        files: [],
        labels: [],
        uploadedAt: file.uploaded_at,
      };

      current.files.push(file);
      current.labels = Array.from(new Set([...current.labels, ...parseLabels(file.labels), ...parseLabels(file.metadata?.labels)]));
      if (device && current.deviceName === 'Unknown device') current.deviceName = getDeviceName(device);
      if (!current.deviceId && deviceId) current.deviceId = deviceId;
      if (!current.uploadedAt || file.uploaded_at > current.uploadedAt) current.uploadedAt = file.uploaded_at;
      grouped.set(key, current);
    }

    return Array.from(grouped.values()).sort((a, b) => b.minute.localeCompare(a.minute));
  }, [cloudFiles, devices]);

  const sourcesByType = useMemo(() => {
    return SOURCE_TYPES.reduce((acc, item) => {
      acc[item.type] = sources.filter((source) => source.type === item.type);
      return acc;
    }, {} as Record<MinuteSourceType, MinuteSource[]>);
  }, [sources]);

  const selectedSources = sourcesByType[selectedType] || [];
  const selectedSource = useMemo(() => {
    if (selectedMinute) {
      return selectedSources.find((source) => source.minute === selectedMinute) || null;
    }
    return selectedSources[0] || null;
  }, [selectedMinute, selectedSources]);

  useEffect(() => {
    if (selectedSources.length) return;
    const fallback = SOURCE_TYPES.find((item) => (sourcesByType[item.type] || []).length > 0);
    if (fallback && fallback.type !== selectedType) {
      setSelectedType(fallback.type);
      setSelectedMinute(null);
    }
  }, [selectedSources.length, selectedType, sourcesByType]);

  useEffect(() => {
    if (!selectedSources.length) {
      setSelectedMinute(null);
      return;
    }
    if (!selectedMinute || !selectedSources.some((source) => source.minute === selectedMinute)) {
      setSelectedMinute(selectedSources[0].minute);
    }
  }, [selectedMinute, selectedSources]);

  const onlineDevices = devices.filter((device) => device.online);
  const raspberryPiDevices = devices.filter((device) => device.hardware_info?.is_raspberry_pi || /arm|aarch/i.test(`${device.hardware_info?.device_type || ''} ${device.device_type || ''}`));

  if (loading && !cloudFiles.length && !devices.length) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-8 text-sm text-slate-300">
        Loading cloud training workspace...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Training</div>
            <h1 className="mt-2 text-3xl font-semibold">Cloud training and federated learning</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              This view is limited to uploaded minute data and the devices that can consume it.
            </p>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-900"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {SOURCE_TYPES.map((item) => {
          const Icon = item.icon;
          const count = sourcesByType[item.type]?.length || 0;
          const active = selectedType === item.type;
          return (
            <button
              key={item.type}
              type="button"
              onClick={() => {
                setSelectedType(item.type);
                setSelectedMinute(null);
              }}
              className={`rounded-2xl border p-4 text-left shadow-sm transition ${active ? 'border-cyan-400 bg-cyan-400/10 text-white' : 'border-slate-800 bg-slate-950 text-slate-100 hover:border-slate-700'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{count}</div>
                  <div className="mt-1 text-sm text-slate-400">{item.description}</div>
                </div>
                <ChevronRight className={`h-5 w-5 ${active ? 'text-cyan-200' : 'text-slate-500'}`} />
              </div>
            </button>
          );
        })}
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-900 bg-rose-950/60 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-slate-100 shadow-xl shadow-black/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Cloud training</div>
                <h2 className="mt-1 text-2xl font-semibold text-white">{SOURCE_TYPES.find((item) => item.type === selectedType)?.label || 'Source'} minutes</h2>
              </div>
              <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
                {selectedSources.length} minute bundles
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              {selectedSources.length ? selectedSources.map((source) => (
                <article
                  key={`${source.minute}::${source.type}`}
                  className={`rounded-2xl border p-4 transition ${selectedSource?.minute === source.minute ? 'border-cyan-400 bg-cyan-500/10' : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'}`}
                  onClick={() => setSelectedMinute(source.minute)}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold text-white">{source.minute}</div>
                      <div className="mt-1 text-sm text-slate-400">{source.deviceName}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {source.labels.length ? source.labels.map((label) => (
                          <span key={label} className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-200">
                            {label}
                          </span>
                        )) : (
                          <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-400">No labels</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1 text-slate-200">
                        <CircleDot className="h-3.5 w-3.5" />
                        {source.files.length} files
                      </span>
                      <span>{formatStamp(source.uploadedAt)}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                    {source.files.map((file) => (
                      <span key={file.file_id} className="rounded-full bg-white/5 px-2.5 py-1">
                        {file.filename.replace(`${source.minute}_`, '')}
                      </span>
                    ))}
                  </div>
                </article>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/80 p-6 text-sm text-slate-400">
                  No uploaded minute data of this type is available yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-slate-100 shadow-xl shadow-black/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Selected minute</div>
                <h3 className="mt-1 text-2xl font-semibold text-white">{selectedSource?.minute || 'No minute selected'}</h3>
              </div>
              <Layers3 className="h-5 w-5 text-cyan-300" />
            </div>

            {selectedSource ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Device</div>
                  <div className="mt-1 text-sm text-white">{selectedSource.deviceName}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Data type</div>
                  <div className="mt-1 text-sm text-white">{selectedSource.type.toUpperCase()}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Files</div>
                  <div className="mt-1 text-sm text-white">{selectedSource.files.length}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Uploaded</div>
                  <div className="mt-1 text-sm text-white">{formatStamp(selectedSource.uploadedAt)}</div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                Pick a minute bundle from the left to inspect the uploaded data.
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              <a href="/data" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-900">
                View uploaded data
                <ChevronRight className="h-4 w-4" />
              </a>
              <a href="/models" className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-300">
                Open device models
                <Brain className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-slate-100 shadow-xl shadow-black/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Federated learning</div>
                <h2 className="mt-1 text-2xl font-semibold text-white">Connected devices</h2>
              </div>
              <Network className="h-5 w-5 text-cyan-300" />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Online devices</div>
                <div className="mt-1 text-3xl font-semibold text-white">{onlineDevices.length}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Raspberry Pi</div>
                <div className="mt-1 text-3xl font-semibold text-white">{raspberryPiDevices.length}</div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {devices.length ? devices.map((device) => (
                <div key={device.device_uuid} className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{getDeviceName(device)}</div>
                      <div className="mt-1 text-xs text-slate-500">{device.hardware_info?.hostname || device.device_uuid}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${device.online ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-800 text-slate-400'}`}>
                      {device.online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {(getSensors(device) || []).slice(0, 4).map((sensor) => (
                      <span key={sensor.sensor_type} className={`rounded-full px-2.5 py-1 ${sensor.available ? 'bg-cyan-500/10 text-cyan-200' : 'bg-slate-800 text-slate-400'}`}>
                        {sensor.name}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                    <span className="rounded-full bg-slate-800 px-2.5 py-1">
                      {device.hardware_info?.portal_upload_allowed === false ? 'Portal uploads disabled' : 'Portal uploads enabled'}
                    </span>
                    <span className="rounded-full bg-slate-800 px-2.5 py-1">
                      {device.hardware_info?.deployment_requests_allowed === false ? 'Deploy requests disabled' : 'Deploy requests enabled'}
                    </span>
                    <span className="rounded-full bg-slate-800 px-2.5 py-1">
                      {device.hardware_info?.cloud_sync_allowed === false ? 'Cloud sync disabled' : 'Cloud sync enabled'}
                    </span>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                  No devices available for federated learning.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-slate-100 shadow-xl shadow-black/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Pretrained model</div>
                <h2 className="mt-1 text-2xl font-semibold text-white">Image baseline</h2>
              </div>
              <Brain className="h-5 w-5 text-cyan-300" />
            </div>

            <div className="mt-4 space-y-3">
              {PRETRAINED_MODELS.map((model) => (
                <article key={model.key} className="rounded-xl border border-slate-800 bg-white/5 p-4">
                  <div className="text-sm font-semibold text-white">{model.name}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{model.subtitle}</div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{model.description}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950 p-5 text-sm leading-6 text-slate-400">
            Cloud training expects uploaded minutes for one data type at a time. Federated learning uses the connected device set above.
          </div>
        </div>
      </section>
    </div>
  );
}
