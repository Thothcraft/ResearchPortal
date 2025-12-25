'use client';

import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { Monitor, Wifi, WifiOff, Battery, Clock, RefreshCw } from 'lucide-react';

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
  user_id: number;
};

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');
  const { get } = useApi();

  const fetchDevices = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await get('/device/list?include_offline=true');
      if (data && Array.isArray(data.devices)) {
        setDevices(data.devices);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch devices');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const filteredDevices = devices.filter((device) => {
    if (filter === 'online') return device.online;
    if (filter === 'offline') return !device.online;
    return true;
  });

  const onlineCount = devices.filter((d) => d.online).length;
  const offlineCount = devices.filter((d) => !d.online).length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Devices</h1>
          <p className="text-slate-400">Manage your connected IoT devices</p>
        </div>
        <button
          onClick={fetchDevices}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <button
          onClick={() => setFilter('all')}
          className={`p-4 rounded-xl border transition-all ${
            filter === 'all'
              ? 'bg-indigo-600 border-indigo-500 text-white'
              : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <Monitor className="w-5 h-5" />
            <span className="font-medium">All Devices</span>
          </div>
          <p className="text-2xl font-bold mt-2">{devices.length}</p>
        </button>
        <button
          onClick={() => setFilter('online')}
          className={`p-4 rounded-xl border transition-all ${
            filter === 'online'
              ? 'bg-green-600 border-green-500 text-white'
              : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <Wifi className="w-5 h-5" />
            <span className="font-medium">Online</span>
          </div>
          <p className="text-2xl font-bold mt-2">{onlineCount}</p>
        </button>
        <button
          onClick={() => setFilter('offline')}
          className={`p-4 rounded-xl border transition-all ${
            filter === 'offline'
              ? 'bg-red-600 border-red-500 text-white'
              : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <WifiOff className="w-5 h-5" />
            <span className="font-medium">Offline</span>
          </div>
          <p className="text-2xl font-bold mt-2">{offlineCount}</p>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Device Grid */}
      {filteredDevices.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
          <Monitor className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400">No devices found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDevices.map((device) => (
            <div
              key={device.device_id}
              className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-lg bg-indigo-500/10">
                  <Monitor className="w-6 h-6 text-indigo-400" />
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    device.online
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-slate-600/50 text-slate-400'
                  }`}
                >
                  {device.online ? 'Online' : 'Offline'}
                </span>
              </div>

              <h3 className="text-white font-semibold mb-1 truncate">
                {device.device_name || device.device_id}
              </h3>
              <p className="text-slate-500 text-sm mb-4">{device.device_type}</p>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="text-slate-500">ID:</span>
                  <span className="font-mono text-xs">{device.device_id}</span>
                </div>
                {device.battery_level !== null && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <Battery className="w-4 h-4" />
                    <div className="flex-1 bg-slate-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          device.battery_level > 50
                            ? 'bg-green-500'
                            : device.battery_level > 20
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${device.battery_level}%` }}
                      />
                    </div>
                    <span>{device.battery_level}%</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock className="w-4 h-4" />
                  <span>{new Date(device.last_seen).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
