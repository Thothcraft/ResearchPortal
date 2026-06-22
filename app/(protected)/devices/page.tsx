'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  Activity,
  Cpu,
  Download,
  FolderOpen,
  Monitor,
  RefreshCw,
  Radar,
  Server,
  Wifi,
  Camera,
  Mic,
  UploadCloud,
  PackageCheck,
  XCircle,
  Brain,
  ToggleLeft,
  ToggleRight,
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
  portal_upload_allowed?: boolean;
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
  declined_at?: string;
  device_id?: string;
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

function extractMinuteStamp(value: unknown): string | null {
  const match = String(value || '').match(/\b\d{8}_\d{4}\b/);
  return match ? match[0] : null;
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

function isRecent(value?: string | null, windowMs = 10 * 60 * 1000): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && Date.now() - time <= windowMs;
}

function DeviceCard({
  device,
  files,
  deployments,
  onRequestUpload,
  onDownloadCloudFile,
  onDownloadMinute,
}: {
  device: Device;
  files: DeviceFileSummary[];
  deployments: Deployment[];
  onRequestUpload: (fileId: number) => Promise<void>;
  onDownloadCloudFile: (fileId: number, filename?: string) => Promise<void>;
  onDownloadMinute: (minute: string, deviceId: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const hardware = device.hardware_info || {};
  const sensors = hardware.sensors || hardware.available_sensors || [];
  const deviceType = hardware.device_type || device.device_type;
  const isRaspberryPi = Boolean(
    hardware.is_raspberry_pi ||
    device.device_type === 'thoth' ||
    /arm|aarch/i.test(`${hardware.processor || ''} ${hardware.system || ''} ${hardware.raspberry_pi_model || ''}`)
  );
  const DeviceIcon = getDeviceIcon(deviceType, hardware.is_raspberry_pi);
  const cloudCount = files.filter((file) => file.on_cloud).length;
  const localCount = files.filter((file) => file.on_device).length;
  const deployedCount = deployments.length;
  const minuteBundles = useMemo(() => {
    const grouped = new Map<string, DeviceFileSummary[]>();
    files.forEach((file) => {
      const minute = extractMinuteStamp(file.filename);
      if (!minute) return;
      const bucket = grouped.get(minute) || [];
      bucket.push(file);
      grouped.set(minute, bucket);
    });
    return Array.from(grouped.entries())
      .map(([minute, minuteFiles]) => ({
        minute,
        files: minuteFiles.sort((a, b) => (a.filename || '').localeCompare(b.filename || '')),
        localCount: minuteFiles.filter((file) => file.on_device).length,
        cloudCount: minuteFiles.filter((file) => file.on_cloud).length,
        uploadRequested: minuteFiles.some((file) => file.upload_requested),
      }))
      .sort((a, b) => b.minute.localeCompare(a.minute));
  }, [files]);

  useEffect(() => {
    if (!expanded) {
      setFlipped(false);
      return;
    }

    const frame = requestAnimationFrame(() => setFlipped(true));
    return () => cancelAnimationFrame(frame);
  }, [expanded]);

  return (
    <>
    <article
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm cursor-pointer transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-md"
      onClick={() => setExpanded(true)}
    >
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
              <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 font-medium ${device.hardware_info?.portal_upload_allowed !== false ? 'bg-cyan-500/10 text-cyan-700' : 'bg-rose-500/10 text-rose-700'}`}>
                {device.hardware_info?.portal_upload_allowed !== false ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                {device.hardware_info?.portal_upload_allowed !== false ? 'Portal uploads allowed' : 'Portal uploads disabled'}
              </span>
              {hardware.raspberry_pi_model && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{hardware.raspberry_pi_model}</span>
              )}
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{sensors.length} sensors</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{minuteBundles.length} minutes</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{localCount} files</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{cloudCount} on cloud</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{deployedCount} models</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setExpanded(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Open
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

    </article>

      {expanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={() => setExpanded(false)}>
          <div className="w-full max-w-6xl" style={{ perspective: '1600px' }} onClick={(event) => event.stopPropagation()}>
            <div
              className="rounded-3xl border border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out"
              style={{
                transformStyle: 'preserve-3d',
                backfaceVisibility: 'hidden',
                transform: flipped ? 'rotateY(0deg) translateY(0)' : 'rotateY(-18deg) translateY(8px)',
              }}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Device details</div>
                  <div className="mt-1 text-xl font-semibold text-slate-950">{device.device_name || device.device_id}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[80vh] overflow-auto p-5 space-y-5">
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
              <FolderOpen className="h-4 w-4" />
              Collected minutes
            </div>
            <div className="space-y-2">
              {minuteBundles.length ? minuteBundles.map((minute) => (
                <div key={minute.minute} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{minute.minute}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>{minute.files.length} files</span>
                        <span>{minute.localCount} local</span>
                        <span>{minute.cloudCount} cloud</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${minute.uploadRequested ? 'bg-cyan-500/10 text-cyan-700' : 'bg-slate-100 text-slate-500'}`}>
                        <UploadCloud className="h-3.5 w-3.5" />
                        {minute.uploadRequested ? 'Upload requested' : 'Local minute'}
                      </span>
                      {minute.cloudCount > 0 && (
                        <button
                          type="button"
                          onClick={() => onDownloadMinute(minute.minute, device.device_uuid)}
                          className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download minute
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {minute.files.slice(0, 8).map((file) => (
                      <span key={file.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                        {file.filename.replace(`${minute.minute}_`, '')}
                      </span>
                    ))}
                    {minute.files.length > 8 && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
                        +{minute.files.length - 8} more
                      </span>
                    )}
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No minute folders found on this device.</div>
              )}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
              <FolderOpen className="h-4 w-4" />
              Device file registry
            </div>
            <div className="space-y-2">
              {files.length ? files.slice(0, 12).map((file) => (
                <div key={file.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-950">{file.filename}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>{file.file_type || 'unknown'}</span>
                        <span>{humanBytes(file.size || 0)}</span>
                        <span>{file.modified_at ? new Date(file.modified_at).toLocaleString() : 'N/A'}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className={`rounded-full px-2.5 py-1 font-medium ${file.on_device ? 'bg-slate-100 text-slate-700' : 'bg-slate-100 text-slate-400'}`}>On device</span>
                        <span className={`rounded-full px-2.5 py-1 font-medium ${file.on_cloud ? 'bg-blue-500/10 text-blue-700' : 'bg-amber-500/10 text-amber-700'}`}>{file.on_cloud ? 'On cloud' : 'Local only'}</span>
                        <span className={`rounded-full px-2.5 py-1 font-medium ${file.upload_requested ? 'bg-cyan-500/10 text-cyan-700' : 'bg-slate-100 text-slate-500'}`}>{file.upload_requested ? 'Upload requested' : 'No request'}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!file.on_cloud && (
                        <button
                          type="button"
                          onClick={() => onRequestUpload(file.id)}
                          onClickCapture={(event) => event.stopPropagation()}
                          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                        >
                          <UploadCloud className="h-4 w-4" />
                          Request upload
                        </button>
                      )}
                      {file.on_cloud && file.cloud_file_id && (
                        <button
                          type="button"
                          onClick={() => onDownloadCloudFile(file.cloud_file_id!, file.filename)}
                          onClickCapture={(event) => event.stopPropagation()}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No device files found in Brain.</div>
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
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceFiles, setDeviceFiles] = useState<Record<string, DeviceFileSummary[]>>({});
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { get, post } = useApi();
  const { user } = useAuth();
  const toast = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [deviceRes, deployRes] = await Promise.all([
        get('/device/list?include_offline=true').catch(() => ({ devices: [] })),
        get('/datasets/models/deployments').catch(() => ({ deployments: [] })),
      ]);

      const remoteDevices = Array.isArray(deviceRes?.devices) ? deviceRes.devices : [];
      setDevices(remoteDevices);
      setDeployments(Array.isArray(deployRes?.deployments) ? deployRes.deployments : []);

      const fileEntries = await Promise.all(
        remoteDevices.map(async (device: Device) => {
          const response = await get(`/device/${device.device_uuid}/files`).catch(() => null);
          return [device.device_uuid, Array.isArray(response?.files) ? response.files : []] as const;
        })
      );
      setDeviceFiles(Object.fromEntries(fileEntries));
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
      const relatedFiles = deviceFiles[device.device_uuid] || [];
      const recentlySynced = relatedFiles.some((file) => isRecent(file.last_synced || file.modified_at));
      const displayDevice = { ...device, online: Boolean(device.online || isRecent(device.last_seen) || recentlySynced) };
      const relatedDeployments = deployments.filter((deployment) => {
        if (singleDevice) return true;
        const target = normalize(deployment.device_id);
        return target && identity.aliases.includes(target);
      });
      return { device: displayDevice, relatedFiles, relatedDeployments };
    });
  }, [devices, deviceFiles, deployments]);

  const handleRequestUpload = async (fileId: number) => {
    try {
      const response = await post(`/device/file/${fileId}/request-upload`, {});
      if (!response?.success) {
        throw new Error(response?.message || 'Request failed');
      }
      toast.success('Requested', 'Upload request sent to the device');
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed';
      toast.error('Request Failed', message);
      throw err;
    }
  };

  const downloadFromUrl = useCallback(async (url: string, fallbackName: string) => {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: user?.token ? { Authorization: `Bearer ${user.token}` } : undefined,
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const disposition = response.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = match?.[1] || fallbackName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      toast.error('Download failed', err instanceof Error ? err.message : 'Unable to download');
    }
  }, [toast, user?.token]);

  const handleDownloadCloudFile = useCallback(async (fileId: number, filename = 'file') => {
    await downloadFromUrl(`/api/proxy/file/${fileId}`, filename);
  }, [downloadFromUrl]);

  const handleDownloadMinute = useCallback(async (minute: string, deviceId: string) => {
    await downloadFromUrl(`/api/proxy/file/minute/${minute}/download?device_id=${encodeURIComponent(deviceId)}`, `${minute}.zip`);
  }, [downloadFromUrl]);

  const onlineCount = deviceRows.filter(({ device }) => device.online).length;
  const totalFiles = Object.values(deviceFiles).flat().length;
  const uploadedFiles = Object.values(deviceFiles).flat().filter((file) => file.on_cloud).length;

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
              Each device card shows online state, attached sensors, cloud file registry state, upload controls, and deployed models.
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
            <div className="text-xs uppercase tracking-wide text-slate-500">Files</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{totalFiles}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Cloud</div>
            <div className="mt-1 text-2xl font-semibold text-blue-700">{uploadedFiles}</div>
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
        {deviceRows.length ? deviceRows.map(({ device, relatedFiles, relatedDeployments }) => (
          <DeviceCard
            key={device.device_uuid || device.device_id}
            device={device}
            files={relatedFiles}
            deployments={relatedDeployments}
            onRequestUpload={handleRequestUpload}
            onDownloadCloudFile={handleDownloadCloudFile}
            onDownloadMinute={handleDownloadMinute}
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
