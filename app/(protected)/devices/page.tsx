'use client';

import { useEffect, useState, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/contexts/ToastContext';
import {
  Monitor, Wifi, WifiOff, Battery, Clock, RefreshCw,
  ChevronDown, ChevronUp, Laptop, Smartphone, Server, Cpu,
  Camera, Mic, Activity, Radio, Thermometer, Trash2,
  Play, Square, AlertCircle, CheckCircle, XCircle,
  Rocket, X, Bell, ShieldCheck, ShieldX, HardDrive,
  Cloud, Database, UploadCloud,
  PackageCheck, Layers, Zap, BarChart2
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

type DeviceFile = {
  id: number;
  filename: string;
  size: number | null;
  file_type: string | null;
  created_at: string | null;
  modified_at: string | null;
  on_device: boolean;
  on_cloud: boolean;
  cloud_file_id: number | null;
  upload_requested: boolean;
  last_synced: string | null;
};

type DeployedModel = {
  id: number;
  name: string;
  architecture: string;
  accuracy: number | null;
  created_at: string;
  deployed_at?: string;
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

function formatBytes(bytes: number | null): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const [activeTab, setActiveTab] = useState<'sensors' | 'data' | 'deployments'>('sensors');
  const [collectionStatus, setCollectionStatus] = useState<CollectionStatus>({});
  const [selectedDurations, setSelectedDurations] = useState<Record<string, number>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [deviceFiles, setDeviceFiles] = useState<DeviceFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploadingFileId, setUploadingFileId] = useState<number | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null);
  const [deployedModels, setDeployedModels] = useState<DeployedModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const { get, post, delete: del } = useApi();
  const toast = useToast();

  const hardwareInfo = device.hardware_info || {};
  const sensors = hardwareInfo.sensors || hardwareInfo.available_sensors || [];
  const deviceType = hardwareInfo.device_type || device.device_type;
  const isRaspberryPi = hardwareInfo.is_raspberry_pi;
  const piModel = hardwareInfo.raspberry_pi_model;

  const fetchDeviceFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const data = await get(`/device/${device.device_uuid}/files`);
      if (data?.files) setDeviceFiles(data.files);
    } catch {
      // silently ignore
    } finally {
      setLoadingFiles(false);
    }
  }, [device.device_uuid, get]);

  const fetchDeployedModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const data = await get(`/datasets/models?device_id=${device.device_uuid}`);
      if (data?.models) setDeployedModels(data.models.filter((m: any) => m.deployed));
    } catch {
      // silently ignore
    } finally {
      setLoadingModels(false);
    }
  }, [device.device_uuid, get]);

  const handleTabChange = (tab: 'sensors' | 'data' | 'deployments') => {
    setActiveTab(tab);
    if (tab === 'data' && deviceFiles.length === 0) fetchDeviceFiles();
    if (tab === 'deployments' && deployedModels.length === 0) fetchDeployedModels();
  };

  const handleExpand = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    if (next && activeTab === 'data') fetchDeviceFiles();
    if (next && activeTab === 'deployments') fetchDeployedModels();
  };

  const handleRequestUpload = async (fileId: number) => {
    setUploadingFileId(fileId);
    try {
      await post(`/device/file/${fileId}/request-upload`, {});
      toast.success('Upload Requested', 'File will be uploaded on next device sync');
      setDeviceFiles(prev => prev.map(f => f.id === fileId ? { ...f, upload_requested: true } : f));
    } catch (err) {
      toast.error('Upload Failed', err instanceof Error ? err.message : 'Failed to request upload');
    } finally {
      setUploadingFileId(null);
    }
  };

  const handleDeleteFile = async (fileId: number, filename: string) => {
    if (!confirm(`Delete file "${filename}" from this device's registry?`)) return;
    setDeletingFileId(fileId);
    try {
      await del(`/device/${device.device_uuid}/files/${fileId}`);
      toast.success('File Removed', `"${filename}" removed from registry`);
      setDeviceFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (err) {
      toast.error('Delete Failed', err instanceof Error ? err.message : 'Failed to delete file');
    } finally {
      setDeletingFileId(null);
    }
  };

  const handleStartCollection = async (sensorType: string) => {
    const duration = selectedDurations[sensorType] || 1;
    setCollectionStatus(prev => ({ ...prev, [sensorType]: { collecting: true, duration, startTime: Date.now() } }));
    setTimeout(() => {
      setCollectionStatus(prev => ({
        ...prev,
        [sensorType]: { ...prev[sensorType], collecting: false, filename: `${sensorType}_${new Date().toISOString().split('T')[0]}.json` }
      }));
      onRefresh();
    }, duration * 60 * 1000);
  };

  const handleStopCollection = (sensorType: string) => {
    setCollectionStatus(prev => ({ ...prev, [sensorType]: { ...prev[sensorType], collecting: false } }));
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete device "${device.device_name}"?`)) return;
    setIsDeleting(true);
    await onDelete(device.device_id);
    setIsDeleting(false);
  };

  const localCount = deviceFiles.filter(f => f.on_device && !f.on_cloud).length;
  const cloudCount = deviceFiles.filter(f => f.on_cloud).length;

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 hover:border-slate-600 transition-all overflow-hidden">
      {/* Card Header */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 rounded-lg bg-slate-700/50">
            {getDeviceIcon(deviceType, isRaspberryPi)}
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${device.online ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/50 text-slate-400'}`}>
              {device.online ? 'Online' : 'Offline'}
            </span>
            <button onClick={handleDelete} disabled={isDeleting} className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors" title="Delete device">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <h3 className="text-white font-semibold mb-1 truncate">{device.device_name || device.device_id}</h3>

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
                <div className={`h-2 rounded-full transition-all ${device.battery_level > 50 ? 'bg-green-500' : device.battery_level > 20 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${device.battery_level}%` }} />
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

      {/* Expand/Collapse Toggle */}
      <button
        onClick={handleExpand}
        className="w-full px-6 py-3 flex items-center justify-between bg-slate-700/30 hover:bg-slate-700/50 transition-colors border-t border-slate-700"
      >
        <span className="text-sm text-slate-300 font-medium">{isExpanded ? 'Hide Details' : 'Show Details'}</span>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {/* Expanded Panel */}
      {isExpanded && (
        <div className="border-t border-slate-700 bg-slate-900/30">
          {/* Tabs */}
          <div className="flex border-b border-slate-700">
            {([
              { id: 'sensors', label: 'Sensors', icon: <Activity className="w-3.5 h-3.5" /> },
              { id: 'data',    label: `Data${deviceFiles.length > 0 ? ` (${deviceFiles.length})` : ''}`, icon: <Database className="w-3.5 h-3.5" /> },
              { id: 'deployments', label: 'Deployments', icon: <Layers className="w-3.5 h-3.5" /> },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {/* Sensors Tab */}
          {activeTab === 'sensors' && (
            <div className="p-5">
              {sensors.length === 0 ? (
                <div className="text-center py-6 text-slate-500">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No sensors detected on this device</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sensors.map((sensor: Sensor) => (
                    <div key={sensor.sensor_type} className={`p-4 rounded-lg border ${sensor.available ? 'bg-slate-800/50 border-slate-600' : 'bg-slate-800/20 border-slate-700/50 opacity-60'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${sensor.available ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-700 text-slate-500'}`}>{getSensorIcon(sensor.sensor_type)}</div>
                          <div>
                            <p className="text-sm font-medium text-white">{sensor.name}</p>
                            <p className="text-xs text-slate-500">{sensor.sensor_type}</p>
                          </div>
                        </div>
                        {sensor.available ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-slate-500" />}
                      </div>
                      {sensor.available && device.online && (
                        <div className="mt-3 pt-3 border-t border-slate-700">
                          <div className="flex items-center gap-2">
                            <select value={selectedDurations[sensor.sensor_type] || 1} onChange={e => setSelectedDurations(prev => ({ ...prev, [sensor.sensor_type]: parseInt(e.target.value) }))} disabled={collectionStatus[sensor.sensor_type]?.collecting} className="flex-1 px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                              {DURATION_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                            {collectionStatus[sensor.sensor_type]?.collecting ? (
                              <button onClick={() => handleStopCollection(sensor.sensor_type)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"><Square className="w-3 h-3" />Stop</button>
                            ) : (
                              <button onClick={() => handleStartCollection(sensor.sensor_type)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm transition-colors"><Play className="w-3 h-3" />Collect</button>
                            )}
                          </div>
                          {collectionStatus[sensor.sensor_type]?.collecting && <div className="mt-2 flex items-center gap-2 text-xs text-amber-400"><div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />Collecting data...</div>}
                          {collectionStatus[sensor.sensor_type]?.filename && !collectionStatus[sensor.sensor_type]?.collecting && <div className="mt-2 text-xs text-green-400">Saved: {collectionStatus[sensor.sensor_type].filename}</div>}
                        </div>
                      )}
                      {!sensor.available && sensor.error && <p className="mt-2 text-xs text-slate-500">{sensor.error}</p>}
                    </div>
                  ))}
                </div>
              )}
              {(hardwareInfo.processor || hardwareInfo.cpu_count || hardwareInfo.memory) && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <h4 className="text-xs font-medium text-slate-400 mb-2">Hardware Info</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                    {hardwareInfo.processor && <div><span className="text-slate-600">CPU:</span> {hardwareInfo.processor.slice(0, 30)}</div>}
                    {hardwareInfo.cpu_count && <div><span className="text-slate-600">Cores:</span> {hardwareInfo.cpu_count}</div>}
                    {hardwareInfo.memory?.total && <div><span className="text-slate-600">RAM:</span> {(hardwareInfo.memory.total / (1024**3)).toFixed(1)} GB</div>}
                    {hardwareInfo.system && <div><span className="text-slate-600">OS:</span> {hardwareInfo.system}</div>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Data Tab */}
          {activeTab === 'data' && (
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><HardDrive className="w-3.5 h-3.5 text-amber-400" />{localCount} local-only</span>
                  <span className="flex items-center gap-1"><Cloud className="w-3.5 h-3.5 text-blue-400" />{cloudCount} on cloud</span>
                </div>
                <button onClick={fetchDeviceFiles} className="p-1.5 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors">
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingFiles ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loadingFiles ? (
                <div className="text-center py-8 text-slate-500">
                  <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin opacity-50" />
                  <p className="text-sm">Loading files...</p>
                </div>
              ) : deviceFiles.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No files found on this device</p>
                  <p className="text-xs mt-1 text-slate-600">Files will appear here after the device syncs</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {deviceFiles.map(file => (
                    <div key={file.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700/50 hover:border-slate-600 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate font-mono">{file.filename}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500">{formatBytes(file.size)}</span>
                          {file.file_type && <span className="px-1.5 py-0.5 rounded text-xs bg-slate-700 text-slate-400">{file.file_type}</span>}
                          {file.on_device && !file.on_cloud && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-amber-500/15 text-amber-400 border border-amber-500/20">
                              <HardDrive className="w-2.5 h-2.5" />Local
                            </span>
                          )}
                          {file.on_cloud && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-blue-500/15 text-blue-400 border border-blue-500/20">
                              <Cloud className="w-2.5 h-2.5" />Cloud
                            </span>
                          )}
                          {file.upload_requested && !file.on_cloud && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                              <UploadCloud className="w-2.5 h-2.5" />Uploading...
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {file.on_device && !file.on_cloud && !file.upload_requested && (
                          <button
                            onClick={() => handleRequestUpload(file.id)}
                            disabled={uploadingFileId === file.id}
                            className="p-1.5 rounded hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 transition-colors"
                            title="Upload to cloud"
                          >
                            <UploadCloud className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteFile(file.id, file.filename)}
                          disabled={deletingFileId === file.id}
                          className="p-1.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                          title="Remove from registry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Deployments Tab */}
          {activeTab === 'deployments' && (
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-slate-400">Models deployed to this device</p>
                <button onClick={fetchDeployedModels} className="p-1.5 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors">
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingModels ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loadingModels ? (
                <div className="text-center py-8 text-slate-500">
                  <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin opacity-50" />
                  <p className="text-sm">Loading deployments...</p>
                </div>
              ) : deployedModels.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No models deployed to this device</p>
                  <p className="text-xs mt-1 text-slate-600">Deploy a model from the Training page</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {deployedModels.map(model => (
                    <div key={model.id} className="p-4 rounded-lg bg-slate-800/60 border border-indigo-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <PackageCheck className="w-4 h-4 text-indigo-400" />
                          <span className="text-sm font-medium text-white">{model.name}</span>
                        </div>
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/15 text-green-400">
                          <Zap className="w-3 h-3" />Active
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                        <span>{model.architecture}</span>
                        {model.accuracy != null && <span className="flex items-center gap-1"><BarChart2 className="w-3 h-3" />{(model.accuracy * 100).toFixed(1)}%</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type PendingDeployment = {
  deployment_id: string;
  model_id: number;
  model_name: string;
  device_id: string;
  device_name: string;
  config: {
    prediction_duration: number;
    prediction_interval: number;
    actions: Array<{label: string; action_type: string; action_value: string}>;
  };
  sent_at: string;
};

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [pendingDevices, setPendingDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [pendingDeployments, setPendingDeployments] = useState<PendingDeployment[]>([]);
  const [expandedDeploy, setExpandedDeploy] = useState<string | null>(null);
  const [deployEditConfig, setDeployEditConfig] = useState<Record<string, { prediction_duration: number; prediction_interval: number }>>({});
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const { get, post, delete: del } = useApi();
  const toast = useToast();

  const fetchDevices = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await get('/device/list?include_offline=true');
      if (data && Array.isArray(data.devices)) {
        setDevices(data.devices);
      }
    } catch (err) {
      toast.error('Loading Failed', err instanceof Error ? err.message : 'Failed to fetch devices');
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPendingDevices = useCallback(async () => {
    try {
      const data = await get('/device/pending');
      if (data && Array.isArray(data.pending)) {
        setPendingDevices(data.pending);
      }
    } catch {
      // silently ignore
    }
  }, [get]);

  const fetchPendingDeployments = useCallback(async () => {
    try {
      const data = await get('/datasets/models/pending-deployments');
      if (data && Array.isArray(data.deployments)) {
        setPendingDeployments(data.deployments);
      }
    } catch {
      // Silently ignore - endpoint may not exist yet
    }
  }, [get]);

  const handleApproveDevice = async (deviceId: string, deviceName: string) => {
    setApprovingId(deviceId);
    try {
      await post(`/device/${deviceId}/approve`, {});
      toast.success('Device Approved', `"${deviceName}" is now linked to your account`);
      setPendingDevices(prev => prev.filter(d => d.device_id !== deviceId));
      fetchDevices();
    } catch (err) {
      toast.error('Approval Failed', err instanceof Error ? err.message : 'Failed to approve device');
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectDevice = async (deviceId: string, deviceName: string) => {
    if (!confirm(`Reject device "${deviceName}"? It will be removed and must re-register.`)) return;
    setRejectingId(deviceId);
    try {
      await post(`/device/${deviceId}/reject`, {});
      toast.warning('Device Rejected', `"${deviceName}" has been removed`);
      setPendingDevices(prev => prev.filter(d => d.device_id !== deviceId));
    } catch (err) {
      toast.error('Rejection Failed', err instanceof Error ? err.message : 'Failed to reject device');
    } finally {
      setRejectingId(null);
    }
  };

  const handleAcceptDeployment = async (deployment: PendingDeployment) => {
    const editedConfig = deployEditConfig[deployment.deployment_id];
    try {
      await post(`/datasets/models/deployments/${deployment.deployment_id}/confirm`, {
        accepted: true,
        config: editedConfig ? { ...deployment.config, ...editedConfig } : deployment.config,
      });
      toast.success('Deployment Accepted', `Model "${deployment.model_name}" is now running on this device`);
      setPendingDeployments(prev => prev.filter(d => d.deployment_id !== deployment.deployment_id));
    } catch (err) {
      toast.error('Accept Failed', err instanceof Error ? err.message : 'Failed to accept deployment');
    }
  };

  const handleDeclineDeployment = async (deployment: PendingDeployment) => {
    try {
      await post(`/datasets/models/deployments/${deployment.deployment_id}/confirm`, { accepted: false });
      toast.warning('Deployment Declined', `Deployment of "${deployment.model_name}" was declined`);
      setPendingDeployments(prev => prev.filter(d => d.deployment_id !== deployment.deployment_id));
    } catch (err) {
      toast.error('Decline Failed', err instanceof Error ? err.message : 'Failed to decline deployment');
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchPendingDevices();
    fetchPendingDeployments();
    const interval = setInterval(() => {
      fetchPendingDevices();
      fetchPendingDeployments();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchDevices, fetchPendingDevices, fetchPendingDeployments]);

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      await del(`/device/${deviceId}`);
      setDevices(prev => prev.filter(d => d.device_id !== deviceId));
      toast.success('Device Deleted', 'Device has been removed');
    } catch (err) {
      toast.error('Delete Failed', err instanceof Error ? err.message : 'Failed to delete device');
    }
  };

  const handleDeleteAllDevices = async () => {
    if (!confirm('Are you sure you want to delete ALL devices? This cannot be undone.')) return;
    
    try {
      setIsDeletingAll(true);
      await del('/device/all');
      setDevices([]);
      toast.success('All Devices Deleted', 'All devices have been removed');
    } catch (err) {
      toast.error('Delete Failed', err instanceof Error ? err.message : 'Failed to delete all devices');
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

      {/* Pending Devices — awaiting approval */}
      {pendingDevices.length > 0 && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-5 h-5 text-blue-400 animate-pulse" />
            <h2 className="text-lg font-semibold text-blue-300">
              {pendingDevices.length} Device{pendingDevices.length > 1 ? 's' : ''} Awaiting Approval
            </h2>
          </div>
          {pendingDevices.map(d => {
            const hw = d.hardware_info || {};
            const deviceType = hw.device_type || d.device_type;
            const isRPi = hw.is_raspberry_pi;
            return (
              <div key={d.device_id} className="bg-blue-500/10 border border-blue-500/40 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      {getDeviceIcon(deviceType, isRPi)}
                    </div>
                    <div>
                      <p className="text-white font-medium">{d.device_name || d.device_id}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                        {getDeviceTypeBadge(deviceType, isRPi, hw.raspberry_pi_model)}
                        {d.ip_address && <span className="font-mono">{d.ip_address}</span>}
                        <span className="text-slate-600">Last seen {new Date(d.last_seen).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApproveDevice(d.device_id, d.device_name)}
                      disabled={approvingId === d.device_id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {approvingId === d.device_id ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleRejectDevice(d.device_id, d.device_name)}
                      disabled={rejectingId === d.device_id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-red-600/30 hover:border-red-500/50 text-slate-300 hover:text-red-300 border border-slate-600 rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      <ShieldX className="w-4 h-4" />
                      {rejectingId === d.device_id ? 'Rejecting...' : 'Reject'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pending Deployments Banner */}
      {pendingDeployments.length > 0 && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-5 h-5 text-yellow-400 animate-pulse" />
            <h2 className="text-lg font-semibold text-yellow-300">
              {pendingDeployments.length} Pending Deployment{pendingDeployments.length > 1 ? 's' : ''}
            </h2>
          </div>
          {pendingDeployments.map(deploy => (
            <div key={deploy.deployment_id} className="bg-yellow-500/10 border border-yellow-500/40 rounded-xl overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-yellow-500/20 rounded-lg mt-0.5">
                      <Rocket className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Deploy request: <span className="text-yellow-300">{deploy.model_name}</span></p>
                      <p className="text-slate-400 text-xs mt-0.5">Target: {deploy.device_name} · Sent {new Date(deploy.sent_at).toLocaleTimeString()}</p>
                      <div className="flex gap-3 mt-1 text-xs text-slate-300">
                        <span>⏱ {deploy.config.prediction_duration}s duration</span>
                        <span>🔄 every {deploy.config.prediction_interval}s</span>
                        {deploy.config.actions.length > 0 && <span>⚡ {deploy.config.actions.length} action{deploy.config.actions.length > 1 ? 's' : ''}</span>}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedDeploy(expandedDeploy === deploy.deployment_id ? null : deploy.deployment_id)}
                    className="text-slate-400 hover:text-white text-xs px-2 py-1 bg-slate-700/50 rounded"
                  >
                    {expandedDeploy === deploy.deployment_id ? 'Hide' : 'Adjust'}
                  </button>
                </div>

                {/* Editable config */}
                {expandedDeploy === deploy.deployment_id && (
                  <div className="mt-4 pt-4 border-t border-yellow-500/20 space-y-3">
                    <p className="text-xs text-slate-400 mb-2">Adjust settings before accepting:</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Prediction Duration (s)</label>
                        <input
                          type="number" min={5} max={3600}
                          value={deployEditConfig[deploy.deployment_id]?.prediction_duration ?? deploy.config.prediction_duration}
                          onChange={e => setDeployEditConfig(prev => ({ ...prev, [deploy.deployment_id]: { ...(prev[deploy.deployment_id] || deploy.config), prediction_duration: parseInt(e.target.value) || 60 } }))}
                          className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Prediction Interval (s)</label>
                        <input
                          type="number" min={0.1} step={0.1} max={60}
                          value={deployEditConfig[deploy.deployment_id]?.prediction_interval ?? deploy.config.prediction_interval}
                          onChange={e => setDeployEditConfig(prev => ({ ...prev, [deploy.deployment_id]: { ...(prev[deploy.deployment_id] || deploy.config), prediction_interval: parseFloat(e.target.value) || 1 } }))}
                          className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                        />
                      </div>
                    </div>
                    {deploy.config.actions.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Configured actions:</p>
                        <div className="space-y-1">
                          {deploy.config.actions.map((a, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs p-2 bg-slate-800/50 rounded">
                              <span className="text-indigo-300">When <span className="text-white font-medium">{a.label}</span>:</span>
                              <span className="text-xs px-1 py-0.5 rounded bg-slate-700 text-slate-300 uppercase">{a.action_type}</span>
                              <span className="text-slate-400 truncate">{a.action_value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleAcceptDeployment(deploy)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" /> Accept &amp; Deploy
                  </button>
                  <button
                    onClick={() => handleDeclineDeployment(deploy)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-red-600/30 hover:border-red-500/50 text-slate-300 hover:text-red-300 border border-slate-600 rounded-lg text-sm transition-colors"
                  >
                    <X className="w-4 h-4" /> Decline
                  </button>
                </div>
              </div>
            </div>
          ))}
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
