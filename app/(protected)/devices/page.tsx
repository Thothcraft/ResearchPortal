'use client';

import { useEffect, useState, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { 
  Monitor, Wifi, WifiOff, Battery, Clock, RefreshCw, 
  ChevronDown, ChevronUp, Laptop, Smartphone, Server, Cpu,
  Camera, Mic, Activity, Radio, Thermometer, Trash2,
  Play, Square, AlertCircle, CheckCircle, XCircle
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
  battery_level: number | null;
  last_seen: string;
  ip_address: string;
  mac_address: string | null;
  device_uuid: string;
  user_id: number;
  hardware_info?: DeviceHardwareInfo;
};

type CollectionStatus = {
  [sensorType: string]: {
    collecting: boolean;
    filename?: string;
    duration?: number;
    startTime?: number;
  };
};

const DURATION_OPTIONS = [
  { value: 1, label: '1 min' },
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
];

const getDeviceIcon = (deviceType: string, isRaspberryPi?: boolean) => {
  if (isRaspberryPi) return <Cpu className="w-6 h-6 text-green-400" />;
  switch (deviceType?.toLowerCase()) {
    case 'laptop':
      return <Laptop className="w-6 h-6 text-blue-400" />;
    case 'mobile':
      return <Smartphone className="w-6 h-6 text-purple-400" />;
    case 'desktop':
      return <Server className="w-6 h-6 text-orange-400" />;
    case 'raspberry_pi':
      return <Cpu className="w-6 h-6 text-green-400" />;
    default:
      return <Monitor className="w-6 h-6 text-indigo-400" />;
  }
};

const getSensorIcon = (sensorType: string) => {
  switch (sensorType?.toLowerCase()) {
    case 'camera':
      return <Camera className="w-4 h-4" />;
    case 'microphone':
      return <Mic className="w-4 h-4" />;
    case 'imu':
    case 'sense_hat':
      return <Activity className="w-4 h-4" />;
    case 'wifi_csi':
      return <Wifi className="w-4 h-4" />;
    case 'radar':
      return <Radio className="w-4 h-4" />;
    default:
      return <Thermometer className="w-4 h-4" />;
  }
};

const getDeviceTypeBadge = (deviceType: string, isRaspberryPi?: boolean, piModel?: string) => {
  if (isRaspberryPi) {
    return (
      <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400">
        {piModel || 'Raspberry Pi'}
      </span>
    );
  }
  
  const badges: Record<string, { bg: string; text: string; label: string }> = {
    laptop: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Laptop' },
    desktop: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Desktop' },
    mobile: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Mobile' },
    thoth: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', label: 'Thoth Device' },
  };
  
  const badge = badges[deviceType?.toLowerCase()] || badges.thoth;
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${badge.bg} ${badge.text}`}>
      {badge.label}
    </span>
  );
};

function DeviceCard({ 
  device, 
  onDelete,
  onRefresh 
}: { 
  device: Device; 
  onDelete: (deviceId: string) => void;
  onRefresh: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [collectionStatus, setCollectionStatus] = useState<CollectionStatus>({});
  const [selectedDurations, setSelectedDurations] = useState<Record<string, number>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  
  const hardwareInfo = device.hardware_info || {};
  const sensors = hardwareInfo.sensors || hardwareInfo.available_sensors || [];
  const deviceType = hardwareInfo.device_type || device.device_type;
  const isRaspberryPi = hardwareInfo.is_raspberry_pi;
  const piModel = hardwareInfo.raspberry_pi_model;

  const handleStartCollection = async (sensorType: string) => {
    const duration = selectedDurations[sensorType] || 1;
    
    setCollectionStatus(prev => ({
      ...prev,
      [sensorType]: { collecting: true, duration, startTime: Date.now() }
    }));

    // In a real implementation, this would call the device's API
    // For now, we simulate the collection
    setTimeout(() => {
      setCollectionStatus(prev => ({
        ...prev,
        [sensorType]: { 
          ...prev[sensorType], 
          collecting: false,
          filename: `${sensorType}_${new Date().toISOString().split('T')[0]}.json`
        }
      }));
      onRefresh();
    }, duration * 60 * 1000);
  };

  const handleStopCollection = (sensorType: string) => {
    setCollectionStatus(prev => ({
      ...prev,
      [sensorType]: { ...prev[sensorType], collecting: false }
    }));
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete device "${device.device_name}"?`)) return;
    setIsDeleting(true);
    await onDelete(device.device_id);
    setIsDeleting(false);
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 hover:border-slate-600 transition-all overflow-hidden">
      {/* Card Header */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 rounded-lg bg-slate-700/50">
            {getDeviceIcon(deviceType, isRaspberryPi)}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                device.online
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-slate-600/50 text-slate-400'
              }`}
            >
              {device.online ? 'Online' : 'Offline'}
            </span>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
              title="Delete device"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <h3 className="text-white font-semibold mb-1 truncate">
          {device.device_name || device.device_id}
        </h3>
        
        <div className="flex items-center gap-2 mb-4">
          {getDeviceTypeBadge(deviceType, isRaspberryPi, piModel)}
          {sensors.length > 0 && (
            <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300">
              {sensors.filter((s: Sensor) => s.available).length} sensors
            </span>
          )}
        </div>

        <div className="space-y-2 text-sm">
          {device.ip_address && (
            <div className="flex items-center gap-2 text-slate-400">
              <Wifi className="w-4 h-4 text-slate-500" />
              <span className="font-mono text-xs">{device.ip_address}</span>
            </div>
          )}
          {device.battery_level !== null && (
            <div className="flex items-center gap-2 text-slate-400">
              <Battery className="w-4 h-4" />
              <div className="flex-1 bg-slate-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
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
            <Clock className="w-4 h-4 text-slate-500" />
            <span className="text-xs">{new Date(device.last_seen).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Expand/Collapse Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-3 flex items-center justify-between bg-slate-700/30 hover:bg-slate-700/50 transition-colors border-t border-slate-700"
      >
        <span className="text-sm text-slate-300 font-medium">
          {isExpanded ? 'Hide Sensors' : 'Show Sensors & Collect Data'}
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Expanded Sensors Section */}
      {isExpanded && (
        <div className="p-6 pt-4 border-t border-slate-700 bg-slate-900/30">
          <h4 className="text-sm font-medium text-slate-300 mb-4">Available Sensors</h4>
          
          {sensors.length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No sensors detected on this device</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sensors.map((sensor: Sensor) => (
                <div
                  key={sensor.sensor_type}
                  className={`p-4 rounded-lg border ${
                    sensor.available
                      ? 'bg-slate-800/50 border-slate-600'
                      : 'bg-slate-800/20 border-slate-700/50 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        sensor.available ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-700 text-slate-500'
                      }`}>
                        {getSensorIcon(sensor.sensor_type)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{sensor.name}</p>
                        <p className="text-xs text-slate-500">{sensor.sensor_type}</p>
                      </div>
                    </div>
                    {sensor.available ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-slate-500" />
                    )}
                  </div>

                  {sensor.available && device.online && (
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedDurations[sensor.sensor_type] || 1}
                          onChange={(e) => setSelectedDurations(prev => ({
                            ...prev,
                            [sensor.sensor_type]: parseInt(e.target.value)
                          }))}
                          disabled={collectionStatus[sensor.sensor_type]?.collecting}
                          className="flex-1 px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {DURATION_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        
                        {collectionStatus[sensor.sensor_type]?.collecting ? (
                          <button
                            onClick={() => handleStopCollection(sensor.sensor_type)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
                          >
                            <Square className="w-3 h-3" />
                            Stop
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStartCollection(sensor.sensor_type)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm transition-colors"
                          >
                            <Play className="w-3 h-3" />
                            Collect
                          </button>
                        )}
                      </div>
                      
                      {collectionStatus[sensor.sensor_type]?.collecting && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-amber-400">
                          <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                          Collecting data...
                        </div>
                      )}
                      
                      {collectionStatus[sensor.sensor_type]?.filename && !collectionStatus[sensor.sensor_type]?.collecting && (
                        <div className="mt-2 text-xs text-green-400">
                          Saved: {collectionStatus[sensor.sensor_type].filename}
                        </div>
                      )}
                    </div>
                  )}

                  {!sensor.available && sensor.error && (
                    <p className="mt-2 text-xs text-slate-500">{sensor.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Hardware Info */}
          {(hardwareInfo.processor || hardwareInfo.cpu_count || hardwareInfo.memory) && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <h4 className="text-xs font-medium text-slate-400 mb-2">Hardware Info</h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                {hardwareInfo.processor && (
                  <div>
                    <span className="text-slate-600">CPU:</span> {hardwareInfo.processor.slice(0, 20)}...
                  </div>
                )}
                {hardwareInfo.cpu_count && (
                  <div>
                    <span className="text-slate-600">Cores:</span> {hardwareInfo.cpu_count}
                  </div>
                )}
                {hardwareInfo.memory?.total && (
                  <div>
                    <span className="text-slate-600">RAM:</span> {(hardwareInfo.memory.total / (1024**3)).toFixed(1)} GB
                  </div>
                )}
                {hardwareInfo.system && (
                  <div>
                    <span className="text-slate-600">OS:</span> {hardwareInfo.system}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const { get, delete: del } = useApi();

  const fetchDevices = useCallback(async () => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      await del(`/device/${deviceId}`);
      setDevices(prev => prev.filter(d => d.device_id !== deviceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete device');
    }
  };

  const handleDeleteAllDevices = async () => {
    if (!confirm('Are you sure you want to delete ALL devices? This cannot be undone.')) return;
    
    try {
      setIsDeletingAll(true);
      await del('/device/all');
      setDevices([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete all devices');
    } finally {
      setIsDeletingAll(false);
    }
  };

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
          <p className="text-slate-400">Manage your connected IoT devices and collect sensor data</p>
        </div>
        <div className="flex items-center gap-3">
          {devices.length > 0 && (
            <button
              onClick={handleDeleteAllDevices}
              disabled={isDeletingAll}
              className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              {isDeletingAll ? 'Deleting...' : 'Delete All'}
            </button>
          )}
          <button
            onClick={fetchDevices}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
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
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
          <button 
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 p-4 rounded-lg mb-6">
        <p className="text-sm">
          <strong>Data Storage:</strong> Collected sensor data is saved locally on each device in the <code className="bg-slate-800 px-1.5 py-0.5 rounded text-xs">thoth/data/</code> directory. 
          Files are automatically discovered and can be uploaded from the Data page.
        </p>
      </div>

      {/* Device Grid */}
      {filteredDevices.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
          <Monitor className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400 mb-2">No devices found</p>
          <p className="text-slate-500 text-sm">Connect a Thoth device to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredDevices.map((device) => (
            <DeviceCard
              key={device.device_id}
              device={device}
              onDelete={handleDeleteDevice}
              onRefresh={fetchDevices}
            />
          ))}
        </div>
      )}
    </div>
  );
}
