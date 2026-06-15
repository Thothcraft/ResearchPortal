'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/contexts/ToastContext';
import {
  Activity,
  Cpu,
  Download,
  Eye,
  FolderOpen,
  Monitor,
  RefreshCw,
  Radar,
  Server,
  Wifi,
  Camera,
  Mic,
  Clock3,
  UploadCloud,
  PackageCheck,
  XCircle,
  Brain,
} from 'lucide-react';

type Sensor = {
  sensor_type: string;
  name: string;
  available: boolean;
  device_path?: string;
  capabilities?: Record<string, any>;
  error?: string;
};

type DeviceHardwareInfo = {
  device_type?: string;
  is_raspberry_pi?: boolean;
  raspberry_pi_model?: string;
  sensors?: Sensor[];
  available_sensors?: Sensor[];
  system?: string;
  processor?: string;
  cpu_count?: number;
  memory?: { total: number; available: number; percent: number };
  hostname?: string;
};

type Device = {
  device_id: string;
  device_name: string;
  device_type: string;
  online: boolean;
  approved: boolean;
  battery_level: number | null;
  last_seen: string;
  ip_address: string;
  mac_address: string | null;
  device_uuid: string;
  user_id: number;
  hardware_info?: DeviceHardwareInfo;
};

type Deployment = {
  id: string | number;
  deployment_id?: string;
  model_name: string;
  model_type?: string;
  status?: string;
  delivered_at?: string;
  device_id?: string;
};

type MinuteSummary = {
  minute: string;
  path: string;
  modified: string;
  created: string;
  deviceKey: string;
  deviceLabel: string;
  completed: boolean;
  uploaded: boolean;
  state: 'ready' | 'collecting';
  files: {
    video: boolean;
    radar: boolean;
    csi: boolean;
    manifest: boolean;
  };
  sizes: Record<string, number>;
  manifest?: any;
};

const getSensorIcon = (sensorType: string) => {
  switch ((sensorType || '').toLowerCase()) {
    case 'camera':
      return Camera;
    case 'microphone':
      return Mic;
    case 'wifi_csi':
    case 'csi':
      return Wifi;
    case 'radar':
      return Radar;
    default:
      return Activity;
  }
};

const getDeviceIcon = (deviceType?: string, isRaspberryPi?: boolean) => {
  if (isRaspberryPi) return Cpu;
  switch ((deviceType || '').toLowerCase()) {
    case 'laptop':
      return Monitor;
    case 'desktop':
      return Server;
    case 'raspberry_pi':
      return Cpu;
    default:
      return Monitor;
  }
};

function normalize(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getDeviceIdentity(device: Device) {
  const hw = device.hardware_info || {};
  const label = device.device_name || device.device_id || hw.hostname || 'Unknown device';
  const key = normalize(device.device_uuid || device.device_id || device.device_name || hw.hostname || label);
  const aliases = [
    device.device_uuid,
    device.device_id,
    device.device_name,
    hw.hostname,
    hw.device_type,
    device.ip_address,
  ]
    .filter(Boolean)
    .map(normalize);
  return { key, label, aliases };
}

function getMinuteIdentity(minute: MinuteSummary) {
  const manifest = minute.manifest || {};
  const aliases = [
    minute.deviceKey,
    minute.deviceLabel,
    manifest.device_id,
    manifest.device_name,
    manifest.host,
    manifest.outputs?.video?.device,
    manifest.outputs?.radar?.device,
    manifest.outputs?.wifi?.device,
  ]
    .filter(Boolean)
    .map(normalize);
  return { aliases };
}

function humanBytes(bytes: number | null): string {
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

function DeviceCard({
  device,
  minutes,
  deployments,
  onUploadMinute,
  onRefresh,
}: {
  device: Device;
  minutes: MinuteSummary[];
  deployments: Deployment[];
  onUploadMinute: (minute: string) => Promise<void>;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const hardware = device.hardware_info || {};
  const sensors = hardware.sensors || hardware.available_sensors || [];
  const deviceType = hardware.device_type || device.device_type;
  const isRaspberryPi = Boolean(
    hardware.is_raspberry_pi ||
    device.device_type === 'thoth' ||
    /arm|aarch/i.test(`${hardware.processor || ''} ${hardware.system || ''} ${hardware.raspberry_pi_model || ''}`)
  );
  const DeviceIcon = getDeviceIcon(deviceType, hardware.is_raspberry_pi);
  const minuteCount = minutes.length;
  const uploadedCount = minutes.filter((minute) => minute.uploaded).length;
  const deployedCount = deployments.length;
  const connectHost = device.ip_address || 'thoth.local';
  const connectUrl = connectHost.includes(':')
    ? `http://[${connectHost}]:5000/connect`
    : `http://${connectHost}:5000/connect`;

  const handleUpload = async (minute: string) => {
    setUploading(minute);
    try {
      await onUploadMinute(minute);
      onRefresh();
    } catch {
      // toast already handled by parent
    } finally {
      setUploading(null);
    }
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-slate-950 p-3 text-white">
            <DeviceIcon className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{deviceType || 'device'}</div>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">{device.device_name || device.device_id}</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 font-medium ${device.online ? 'bg-emerald-500/10 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                <span className={`h-2 w-2 rounded-full ${device.online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {device.online ? 'Online' : 'Offline'}
              </span>
              {hardware.raspberry_pi_model && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{hardware.raspberry_pi_model}</span>
              )}
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{sensors.length} sensors</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{minuteCount} minutes</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{uploadedCount} uploaded</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{deployedCount} models</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {device.online && isRaspberryPi && (
            <a
              href={connectUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Monitor className="h-4 w-4" />
              Connect
            </a>
          )}
          <a href="/data" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <FolderOpen className="h-4 w-4" />
            Minutes
          </a>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">IP</div>
          <div className="mt-1 text-sm font-medium text-slate-900">{device.ip_address || 'N/A'}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Last seen</div>
          <div className="mt-1 text-sm font-medium text-slate-900">{new Date(device.last_seen).toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Battery</div>
          <div className="mt-1 text-sm font-medium text-slate-900">{device.battery_level != null ? `${device.battery_level}%` : 'N/A'}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Hardware</div>
          <div className="mt-1 text-sm font-medium text-slate-900">{hardware.hostname || device.device_uuid}</div>
        </div>
      </div>

      {expanded && (
        <div className="mt-5 space-y-5">
          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Activity className="h-4 w-4" />
              Connected sensors
            </div>
            <div className="space-y-2">
              {sensors.length ? sensors.map((sensor: Sensor) => {
                const Icon = getSensorIcon(sensor.sensor_type);
                return (
                  <div key={sensor.sensor_type} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg p-2 ${sensor.available ? 'bg-emerald-500/10 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-950">{sensor.name}</div>
                        <div className="text-xs text-slate-500">{sensor.sensor_type}</div>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${sensor.available ? 'bg-emerald-500/10 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      <span className={`h-2 w-2 rounded-full ${sensor.available ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {sensor.available ? 'Online' : 'Offline'}
                    </span>
                  </div>
                );
              }) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No sensors detected.</div>
              )}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Clock3 className="h-4 w-4" />
              Collected minutes
            </div>
            <div className="space-y-2">
              {minutes.length ? minutes.map((minute) => (
                <div key={minute.minute} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-semibold text-slate-950">{minute.minute}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>{minute.deviceLabel}</span>
                        <span>Updated {new Date(minute.modified).toLocaleString()}</span>
                        <span>{humanBytes((minute.sizes.video || 0) + (minute.sizes.radar || 0) + (minute.sizes.csi_timestamped || 0) + (minute.sizes.csi_serial || 0))}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className={`rounded-full px-2.5 py-1 font-medium ${minute.uploaded ? 'bg-blue-500/10 text-blue-700' : 'bg-amber-500/10 text-amber-700'}`}>
                          {minute.uploaded ? 'Uploaded' : 'Local'}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 font-medium ${minute.completed ? 'bg-emerald-500/10 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {minute.completed ? 'Ready' : 'Collecting'}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 font-medium ${minute.files.video ? 'bg-slate-100 text-slate-700' : 'bg-slate-100 text-slate-400'}`}>Video</span>
                        <span className={`rounded-full px-2.5 py-1 font-medium ${minute.files.radar ? 'bg-slate-100 text-slate-700' : 'bg-slate-100 text-slate-400'}`}>Radar</span>
                        <span className={`rounded-full px-2.5 py-1 font-medium ${minute.files.csi ? 'bg-slate-100 text-slate-700' : 'bg-slate-100 text-slate-400'}`}>CSI</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/data?minute=${minute.minute}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <Eye className="h-4 w-4" />
                        View
                      </Link>
                      <a href={`/api/data/minutes/${minute.minute}/download`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <Download className="h-4 w-4" />
                        Download
                      </a>
                      {!minute.uploaded && (
                        <button
                          type="button"
                          onClick={() => handleUpload(minute.minute)}
                          disabled={uploading === minute.minute}
                          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
                        >
                          <UploadCloud className="h-4 w-4" />
                          {uploading === minute.minute ? 'Uploading...' : 'Upload'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No minute folders assigned to this device yet.</div>
              )}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Brain className="h-4 w-4" />
              Deployed models
            </div>
            <div className="space-y-2">
              {deployments.length ? deployments.map((deployment) => (
                <div key={String(deployment.id)} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-950">{deployment.model_name}</div>
                      <div className="mt-1 text-xs text-slate-500">{deployment.model_type || 'model'} {deployment.delivered_at ? `· ${new Date(deployment.delivered_at).toLocaleString()}` : ''}</div>
                    </div>
                    <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${deployment.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-700' : deployment.status === 'pending' ? 'bg-amber-500/10 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                      <PackageCheck className="h-3.5 w-3.5" />
                      {deployment.status || 'unknown'}
                    </span>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No deployments for this device.</div>
              )}
            </div>
          </section>
        </div>
      )}
    </article>
  );
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [minutes, setMinutes] = useState<MinuteSummary[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { get } = useApi();
  const toast = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [deviceRes, minuteRes, deployRes] = await Promise.all([
        get('/device/list?include_offline=true').catch(() => ({ devices: [] })),
        fetch('/api/data/minutes', { cache: 'no-store' }).then((res) => res.json()).catch(() => ({ minutes: [] })),
        get('/datasets/models/deployments').catch(() => ({ deployments: [] })),
      ]);

      const remoteDevices = Array.isArray(deviceRes?.devices) ? deviceRes.devices : [];
      setDevices(remoteDevices);
      setMinutes(Array.isArray(minuteRes?.minutes) ? minuteRes.minutes : []);
      setDeployments(Array.isArray(deployRes?.deployments) ? deployRes.deployments : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load devices';
      setError(message);
      toast.error('Load Failed', message);
    } finally {
      setLoading(false);
    }
  }, [get, toast]);

  useEffect(() => {
    loadData();
    const timer = window.setInterval(loadData, 30000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const deviceRows = useMemo(() => {
    const singleDevice = devices.length === 1;
    return devices.map((device) => {
      const identity = getDeviceIdentity(device);
      const relatedMinutes = minutes.filter((minute) => {
        const aliases = getMinuteIdentity(minute).aliases;
        return aliases.some((alias) => identity.aliases.includes(alias));
      });
      const relatedDeployments = deployments.filter((deployment) => {
        if (singleDevice) return true;
        const target = normalize(deployment.device_id);
        return target && identity.aliases.includes(target);
      });
      return { device, relatedMinutes, relatedDeployments };
    });
  }, [devices, minutes, deployments]);

  const handleUploadMinute = async (minute: string) => {
    try {
      const response = await fetch(`/api/data/minutes/${minute}/upload`, { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Upload failed');
      }
      toast.success('Uploaded', `Minute ${minute} uploaded to cloud`);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      toast.error('Upload Failed', message);
      throw err;
    }
  };

  const onlineCount = devices.filter((device) => device.online).length;
  const offlineCount = devices.length - onlineCount;
  const totalMinutes = minutes.length;
  const uploadedMinutes = minutes.filter((minute) => minute.uploaded).length;

  if (loading && !devices.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
        Loading devices...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Devices</div>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">Connected sensor devices</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Each device card shows online state, attached sensors, minute folders, cloud upload state, and deployed models.
            </p>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Devices</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{devices.length}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Online</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-700">{onlineCount}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Minutes</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{totalMinutes}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Uploaded</div>
            <div className="mt-1 text-2xl font-semibold text-blue-700">{uploadedMinutes}</div>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <XCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </section>

      <section className="space-y-4">
        {deviceRows.length ? deviceRows.map(({ device, relatedMinutes, relatedDeployments }) => (
          <DeviceCard
            key={device.device_uuid || device.device_id}
            device={device}
            minutes={relatedMinutes}
            deployments={relatedDeployments}
            onUploadMinute={handleUploadMinute}
            onRefresh={loadData}
          />
        )) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
            No devices found.
          </div>
        )}
      </section>
    </div>
  );
}
