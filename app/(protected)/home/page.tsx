'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import DevicePresence3D from '@/components/DevicePresence3D';
import { Brain, Cpu, FolderOpen, RefreshCw, Radar, Wifi, Camera, Mic, Activity } from 'lucide-react';
import Link from 'next/link';

type Sensor = {
  sensor_type: string;
  name: string;
  available: boolean;
};

type Device = {
  device_uuid: string;
  device_name: string;
  device_type: string;
  online: boolean;
  last_seen?: string;
  hardware_info?: {
    hostname?: string;
    is_raspberry_pi?: boolean;
    raspberry_pi_model?: string;
    sensors?: Sensor[];
    available_sensors?: Sensor[];
  };
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

function parseServerTime(value?: string | null): number {
  if (!value) return NaN;
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  return new Date(normalized).getTime();
}

const isDeviceOnline = (device: Device): boolean => {
  return Boolean(device.online);
};

export default function HomePage() {
  const { get } = useApi();
  const { user, isLoading: authLoading } = useAuth();
  const toast = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (authLoading || !user?.token) return;
    setLoading(true);
    setError(null);
    try {
      const deviceRes = await get('/device/list?include_offline=true').catch(() => ({ devices: [] }));
      setDevices(Array.isArray(deviceRes?.devices) ? deviceRes.devices : []);
      setLastUpdated(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard';
      setError(message);
      toast.error('Load failed', message);
    } finally {
      setLoading(false);
    }
  }, [authLoading, get, toast, user?.token]);

  useEffect(() => {
    if (authLoading || !user?.token) return;
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, [authLoading, load, user?.token]);

  const normalizedDevices = useMemo(
    () => devices.map((device) => ({
      ...device,
      online: isDeviceOnline(device),
    })),
    [devices],
  );
  const onlineDevices = useMemo(() => normalizedDevices.filter((device) => device.online), [normalizedDevices]);
  const latestDevice = onlineDevices[0] || normalizedDevices[0] || null;
  const latestSensors = latestDevice?.hardware_info?.sensors || latestDevice?.hardware_info?.available_sensors || [];

  if (loading && !devices.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-slate-100 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Home</div>
            <h1 className="mt-1 text-3xl font-semibold text-white">Thoth Research Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Live device state comes from Brain. Local sensor data stays on the device unless a minute is explicitly uploaded to cloud.
            </p>
          </div>
          <div className="grid gap-2 sm:flex sm:items-center">
            <Link href="/devices" className="inline-flex items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200">Manage devices</Link>
            <button type="button" onClick={load} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800 disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Devices online</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-300">{onlineDevices.length}</div>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Devices total</div>
            <div className="mt-1 text-2xl font-semibold text-white">{normalizedDevices.length}</div>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Live presence</div>
            <div className="mt-1 text-2xl font-semibold text-cyan-300">{onlineDevices.length ? 'Ready' : 'Offline'}</div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}
        {lastUpdated && <div className="mt-3 text-right text-xs text-slate-500">Updated {lastUpdated.toLocaleTimeString()}</div>}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Device status</div>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">Connected devices</h2>
            </div>
            <Cpu className="h-5 w-5 text-slate-400" />
          </div>

          <div className="mt-4 space-y-3">
            {normalizedDevices.map((device) => (
              <article key={device.device_uuid} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{device.device_name}</div>
                    <div className="mt-1 text-xs text-slate-500">{device.hardware_info?.hostname || device.device_uuid}</div>
                  </div>
                  <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${isDeviceOnline(device) ? 'bg-emerald-500/10 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    <span className={`h-2 w-2 rounded-full ${isDeviceOnline(device) ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {isDeviceOnline(device) ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(device.hardware_info?.sensors || device.hardware_info?.available_sensors || []).map((sensor) => {
                    const Icon = getSensorIcon(sensor.sensor_type);
                    return (
                      <span key={`${device.device_uuid}-${sensor.sensor_type}`} className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${sensor.available ? 'bg-cyan-500/10 text-cyan-700' : 'bg-slate-100 text-slate-500'}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {sensor.name}
                      </span>
                    );
                  })}
                  {!((device.hardware_info?.sensors || device.hardware_info?.available_sensors || []).length) && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">No sensors reported</span>
                  )}
                </div>
                <Link href="/devices" className="mt-4 inline-flex text-sm font-semibold text-cyan-700 hover:text-cyan-900">View captures and controls →</Link>
              </article>
            ))}
            {!normalizedDevices.length && (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                No devices found for this account.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Primary device</div>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">Latest online unit</h2>
              </div>
              <Brain className="h-5 w-5 text-slate-400" />
            </div>
            {latestDevice ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-950">{latestDevice.device_name}</div>
                <div className="mt-1 text-xs text-slate-500">{latestDevice.hardware_info?.raspberry_pi_model || latestDevice.hardware_info?.hostname || latestDevice.device_uuid}</div>
                <div className="mt-3 text-xs uppercase tracking-wide text-slate-500">Sensors</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {latestSensors.length ? latestSensors.map((sensor) => (
                    <span key={sensor.sensor_type} className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-700">{String(sensor.name || sensor.sensor_type || '').replace(/radar/gi, 'localization')}</span>
                  )) : (
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-500">None reported</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                No online device available.
              </div>
            )}
          </section>

          {latestDevice && (
            <DevicePresence3D address={latestDevice.ip_address || ''} online={latestDevice.online} />
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Spatial view</div>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">Live room presence</h2>
              </div>
              <FolderOpen className="h-5 w-5 text-slate-400" />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Open an online device to view persistent presence, motion energy, target dimensions, and editable room calibration.
            </p>
            <Link href="/devices" className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Open live presence
            </Link>
          </section>
        </div>
      </section>
    </div>
  );
}
