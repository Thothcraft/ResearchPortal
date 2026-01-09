'use client';

import { useState, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';
import {
  Database,
  FileText,
  Film,
  Image,
  Activity,
  Wifi,
  Radio,
  Download,
  RefreshCw,
  Search,
  Calendar,
  HardDrive,
  Cloud,
  CloudOff,
  Loader2,
  Server,
  Upload,
  Check,
} from 'lucide-react';

type Device = {
  id: string;
  name: string;
  status: 'online' | 'offline';
  ip_address?: string;
  local_ip?: string;
};

type DataFile = {
  id?: number;  // DeviceFile ID from Brain server
  name: string;
  type: 'imu' | 'csi' | 'mfcw' | 'img' | 'vid' | 'other';
  size: number;
  timestamp: string;
  extension: string;
  deviceId: string;
  deviceName: string;
  deviceOnline: boolean;
  onCloud: boolean;
  cloudFileId?: number;
  downloading?: boolean;
  uploading?: boolean;
};

const FILE_TYPE_CONFIG = {
  imu: { label: 'IMU Data', icon: Activity, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  csi: { label: 'CSI Data', icon: Wifi, color: 'text-green-400', bg: 'bg-green-500/10' },
  mfcw: { label: 'MFCW Data', icon: Radio, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  img: { label: 'Image', icon: Image, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  vid: { label: 'Video', icon: Film, color: 'text-red-400', bg: 'bg-red-500/10' },
  other: { label: 'Other', icon: FileText, color: 'text-slate-400', bg: 'bg-slate-500/10' },
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function parseFileName(name: string): { type: DataFile['type']; timestamp: string } {
  const lowerName = name.toLowerCase();
  let type: DataFile['type'] = 'other';
  let timestamp = '';

  if (lowerName.startsWith('imu_')) {
    type = 'imu';
    timestamp = name.substring(4).split('.')[0];
  } else if (lowerName.startsWith('csi_')) {
    type = 'csi';
    timestamp = name.substring(4).split('.')[0];
  } else if (lowerName.startsWith('mfcw_')) {
    type = 'mfcw';
    timestamp = name.substring(5).split('.')[0];
  } else if (lowerName.startsWith('img_')) {
    type = 'img';
    timestamp = name.substring(4).split('.')[0];
  } else if (lowerName.startsWith('vid_')) {
    type = 'vid';
    timestamp = name.substring(4).split('.')[0];
  }

  return { type, timestamp };
}

export default function DataPage() {
  const [files, setFiles] = useState<DataFile[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<DataFile['type'] | 'all'>('all');
  const [filterDevice, setFilterDevice] = useState<string>('all');
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, number>>(new Map());
  const [isDragging, setIsDragging] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [selectedFileType, setSelectedFileType] = useState<DataFile['type']>('other');
  const [uploadDate, setUploadDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const { get, post } = useApi();

  // Fetch devices and files from Brain server
  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch devices from Brain server (include offline devices)
      let deviceList: Device[] = [];
      try {
        const devicesData = await get('/device/list?include_offline=true');
        if (devicesData && Array.isArray(devicesData.devices)) {
          deviceList = devicesData.devices.map((d: any) => ({
            id: d.device_uuid || d.device_id,
            name: d.device_name || d.name,
            status: d.online ? 'online' : 'offline',
            ip_address: d.ip_address,
            local_ip: d.hardware_info?.local_ip || d.hardware_info?.ip_address,
          }));
        }
      } catch (e) {
        console.log('Could not fetch devices from Brain:', e);
      }
      setDevices(deviceList);

      // Fetch files from all sources in parallel for better performance
      const allFiles: DataFile[] = [];
      const seenCloudFileIds = new Set<number>();

      // Create promises for all device file fetches + cloud files fetch
      const deviceFilePromises = deviceList.map(async (device) => {
        try {
          const deviceFilesData = await get(`/device/${device.id}/files`);
          if (deviceFilesData && Array.isArray(deviceFilesData.files)) {
            return deviceFilesData.files.map((f: any) => ({
              ...f,
              _device: device
            }));
          }
        } catch (e) {
          console.log(`Could not fetch files for device ${device.id}:`, e);
        }
        return [];
      });

      const cloudFilesPromise = get('/file/files?limit=200').catch((e) => {
        console.log('Could not fetch cloud files:', e);
        return { files: [] };
      });

      // Wait for all requests in parallel
      const [deviceFilesResults, cloudFilesData] = await Promise.all([
        Promise.all(deviceFilePromises),
        cloudFilesPromise
      ]);

      // Process device files
      deviceFilesResults.flat().forEach((f: any) => {
        if (!f || !f._device) return;
        const device = f._device;
        const { type, timestamp } = parseFileName(f.filename);
        allFiles.push({
          id: f.id,
          name: f.filename,
          type,
          size: f.size || 0,
          timestamp,
          extension: f.filename.split('.').pop() || '',
          deviceId: device.id,
          deviceName: device.name,
          deviceOnline: device.status === 'online',
          onCloud: f.on_cloud || false,
          cloudFileId: f.cloud_file_id,
          downloading: false,
          uploading: false,
        });
        if (f.cloud_file_id) {
          seenCloudFileIds.add(f.cloud_file_id);
        }
      });

      // Process cloud-uploaded files (skip duplicates)
      if (cloudFilesData && Array.isArray(cloudFilesData.files)) {
        cloudFilesData.files.forEach((f: any) => {
          if (seenCloudFileIds.has(f.file_id)) return;
          const { type, timestamp } = parseFileName(f.filename);
          allFiles.push({
            id: undefined,
            name: f.filename,
            type,
            size: f.size || 0,
            timestamp: timestamp || f.uploaded_at?.split('T')[0] || '',
            extension: f.filename.split('.').pop() || '',
            deviceId: 'cloud',
            deviceName: 'Cloud Upload',
            deviceOnline: true,
            onCloud: true,
            cloudFileId: f.file_id,
            downloading: false,
            uploading: false,
          });
        });
      }

      setFiles(allFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Upload file from device to cloud
  // Requests Brain to mark file for upload, Thoth will upload on next registration
  const handleUploadToCloud = async (file: DataFile) => {
    if (file.onCloud) {
      return; // Already on cloud
    }
    
    if (!file.deviceOnline) {
      setError(`Cannot upload: Device "${file.deviceName}" is offline`);
      return;
    }

    if (!file.id) {
      setError('Cannot upload: File ID not found');
      return;
    }

    setFiles(prev => prev.map(f => 
      f.name === file.name ? { ...f, uploading: true } : f
    ));

    try {
      // Request Brain to mark file for upload
      // Thoth will see this in its next registration response and upload the file
      const response = await post(`/device/file/${file.id}/request-upload`, {});
      
      if (response && response.success) {
        // File is queued for upload - will be uploaded on next device sync (within 10 seconds)
        setFiles(prev => prev.map(f => 
          f.name === file.name ? { ...f, uploading: true } : f
        ));
        
        // Poll for completion (check every 3 seconds for up to 30 seconds)
        let attempts = 0;
        const maxAttempts = 10;
        const pollInterval = setInterval(async () => {
          attempts++;
          try {
            const filesData = await get(`/device/${file.deviceId}/files`);
            const updatedFile = filesData?.files?.find((f: any) => f.filename === file.name);
            
            if (updatedFile?.on_cloud) {
              clearInterval(pollInterval);
              setFiles(prev => prev.map(f => 
                f.name === file.name ? { 
                  ...f, 
                  onCloud: true, 
                  cloudFileId: updatedFile.cloud_file_id,
                  uploading: false 
                } : f
              ));
            } else if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
              setFiles(prev => prev.map(f => 
                f.name === file.name ? { ...f, uploading: false } : f
              ));
              setError('Upload is taking longer than expected. Please check device status.');
            }
          } catch (e) {
            // Continue polling
          }
        }, 3000);
      } else {
        throw new Error(response?.message || 'Failed to request upload');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload to cloud failed');
      setFiles(prev => prev.map(f => 
        f.name === file.name ? { ...f, uploading: false } : f
      ));
    }
  };

  // Download file - uploads to cloud first if not already there
  const handleDownload = async (file: DataFile) => {
    setFiles(prev => prev.map(f => 
      f.name === file.name ? { ...f, downloading: true } : f
    ));

    try {
      let cloudFileId = file.cloudFileId;
      
      // If not on cloud, request upload first
      if (!file.onCloud) {
        if (!file.deviceOnline) {
          throw new Error(`Device "${file.deviceName}" is offline. Cannot upload file to cloud.`);
        }
        
        if (!file.id) {
          throw new Error('Cannot download: File ID not found');
        }
        
        // Request upload via Brain API
        const uploadResponse = await post(`/device/file/${file.id}/request-upload`, {});
        if (!uploadResponse || !uploadResponse.success) {
          throw new Error(uploadResponse?.message || 'Failed to request upload');
        }
        
        // Wait for upload to complete (poll every 2 seconds for up to 30 seconds)
        let attempts = 0;
        const maxAttempts = 15;
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          attempts++;
          
          const filesData = await get(`/device/${file.deviceId}/files`);
          const updatedFile = filesData?.files?.find((f: any) => f.filename === file.name);
          
          if (updatedFile?.on_cloud) {
            cloudFileId = updatedFile.cloud_file_id;
            setFiles(prev => prev.map(f => 
              f.name === file.name ? { ...f, onCloud: true, cloudFileId } : f
            ));
            break;
          }
        }
        
        if (!cloudFileId) {
          throw new Error('Upload timed out. Please try again.');
        }
      }
      
      // Download from cloud
      if (cloudFileId) {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-d7d37.up.railway.app';
        const token = localStorage.getItem('auth_token');
        
        const downloadUrl = `${apiBaseUrl}/file/${cloudFileId}?download=true`;
        
        const response = await fetch(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to download file');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setFiles(prev => prev.map(f => 
        f.name === file.name ? { ...f, downloading: false } : f
      ));
    }
  };

  // Infer file type from extension
  const inferFileType = (filename: string): DataFile['type'] => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(ext)) return 'img';
    if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext)) return 'vid';
    if (['json'].includes(ext)) return 'imu';  // Default JSON to IMU
    if (['csv'].includes(ext)) return 'csi';   // Default CSV to CSI
    if (['bin'].includes(ext)) return 'mfcw';  // Default binary to MFCW
    return 'other';
  };

  // Show upload modal when files are selected
  const handleFileSelect = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const filesArray = Array.from(fileList);
    setPendingFiles(filesArray);
    // Infer type from first file
    if (filesArray.length > 0) {
      setSelectedFileType(inferFileType(filesArray[0].name));
    }
    setUploadDate(new Date().toISOString().split('T')[0]);
    setShowUploadModal(true);
  };

  // Handle file upload to cloud with progress tracking
  const handleFileUpload = async () => {
    if (pendingFiles.length === 0) return;

    const token = localStorage.getItem('auth_token');
    if (!token) {
      setError('Please log in to upload files');
      return;
    }

    setShowUploadModal(false);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-d7d37.up.railway.app';

    const uploadPromises = pendingFiles.map((file) => {
      return new Promise<void>((resolve) => {
        // Generate new filename with type prefix and date
        const ext = file.name.split('.').pop() || '';
        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const newFileName = `${selectedFileType}_${uploadDate}_${baseName}.${ext}`;
        
        // Initialize progress at 0%
        setUploadingFiles(prev => new Map(prev).set(newFileName, 0));

        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        // Create a new file with the renamed filename
        const renamedFile = new File([file], newFileName, { type: file.type });
        formData.append('file', renamedFile);

        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setUploadingFiles(prev => new Map(prev).set(newFileName, percentComplete));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText);
              console.log(`Uploaded ${newFileName}:`, result);
            } catch (e) {
              console.log(`Uploaded ${newFileName}`);
            }
          } else {
            setError(`Failed to upload ${newFileName}: ${xhr.statusText || 'Server error'}`);
          }
          // Remove from uploading files
          setUploadingFiles(prev => {
            const newMap = new Map(prev);
            newMap.delete(newFileName);
            return newMap;
          });
          resolve();
        });

        xhr.addEventListener('error', () => {
          setError(`Failed to upload ${newFileName}: Network error`);
          setUploadingFiles(prev => {
            const newMap = new Map(prev);
            newMap.delete(newFileName);
            return newMap;
          });
          resolve();
        });

        xhr.addEventListener('abort', () => {
          setUploadingFiles(prev => {
            const newMap = new Map(prev);
            newMap.delete(newFileName);
            return newMap;
          });
          resolve();
        });

        xhr.open('POST', `${apiUrl}/file/upload-multipart`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });
    });

    // Wait for all uploads to complete
    await Promise.all(uploadPromises);
    setPendingFiles([]);

    // Refresh file list after upload
    fetchData();
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || file.type === filterType;
    return matchesSearch && matchesType;
  });

  const fileTypeCounts = files.reduce((acc, file) => {
    acc[file.type] = (acc[file.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md mx-4 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Upload Files</h3>
            
            <div className="mb-4">
              <p className="text-slate-400 text-sm mb-2">
                {pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''} selected:
              </p>
              <div className="max-h-24 overflow-y-auto text-sm text-slate-300">
                {pendingFiles.map((f, i) => (
                  <div key={i} className="truncate">{f.name}</div>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                File Type
              </label>
              <select
                value={selectedFileType}
                onChange={(e) => setSelectedFileType(e.target.value as DataFile['type'])}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="imu">IMU Data</option>
                <option value="csi">CSI Data</option>
                <option value="mfcw">MFCW Data</option>
                <option value="img">Image</option>
                <option value="vid">Video</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Date
              </label>
              <input
                type="date"
                value={uploadDate}
                onChange={(e) => setUploadDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setPendingFiles([]);
                }}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleFileUpload}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Data Files</h1>
          <p className="text-slate-400">Browse and manage collected sensor data</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`mb-8 border-2 border-dashed rounded-xl p-8 transition-all ${
          isDragging
            ? 'border-indigo-500 bg-indigo-500/10'
            : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
        }`}
      >
        <div className="text-center">
          <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-indigo-400' : 'text-slate-500'}`} />
          <h3 className="text-lg font-semibold text-white mb-2">Upload Files to Cloud</h3>
          <p className="text-slate-400 mb-4">
            Drag and drop files here, or click to browse
          </p>
          <input
            type="file"
            multiple
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer transition-colors"
          >
            <Upload className="w-4 h-4" />
            Choose Files
          </label>
          {uploadingFiles.size > 0 && (
            <div className="mt-4 space-y-3">
              {Array.from(uploadingFiles.entries()).map(([fileName, progress]) => (
                <div key={fileName} className="max-w-md mx-auto">
                  <div className="flex items-center justify-between text-sm text-indigo-400 mb-1">
                    <span className="truncate mr-2">{fileName}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div 
                      className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* File Type Filters */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <button
          onClick={() => setFilterType('all')}
          className={`p-4 rounded-xl border transition-all ${
            filterType === 'all'
              ? 'bg-indigo-600 border-indigo-500 text-white'
              : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-5 h-5" />
            <span className="font-medium">All</span>
          </div>
          <p className="text-2xl font-bold">{files.length}</p>
        </button>
        {Object.entries(FILE_TYPE_CONFIG).map(([key, config]) => {
          const Icon = config.icon;
          const count = fileTypeCounts[key] || 0;
          return (
            <button
              key={key}
              onClick={() => setFilterType(key as DataFile['type'])}
              className={`p-4 rounded-xl border transition-all ${
                filterType === key
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-5 h-5" />
                <span className="font-medium text-sm">{config.label}</span>
              </div>
              <p className="text-2xl font-bold">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Files Grid */}
      {filteredFiles.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
          <Database className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400">No data files found</p>
          <p className="text-slate-500 text-sm mt-1">
            Files should be named with prefixes: IMU_, csi_, mfcw_, img_, vid_
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFiles.map((file, index) => {
            const config = FILE_TYPE_CONFIG[file.type];
            const Icon = config.icon;
            const canDownload = file.onCloud || file.deviceOnline;
            
            return (
              <div
                key={index}
                className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700 hover:border-slate-600 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg ${config.bg}`}>
                    <Icon className={`w-6 h-6 ${config.color}`} />
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Cloud status indicator */}
                    {file.onCloud ? (
                      <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-500/10 text-green-400">
                        <Cloud className="w-3 h-3" />
                        On Cloud
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-slate-500/10 text-slate-400">
                        <CloudOff className="w-3 h-3" />
                        Device Only
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-white font-medium mb-2 truncate" title={file.name}>
                  {file.name}
                </h3>

                {/* Device info */}
                <div className="flex items-center gap-2 mb-3">
                  <Server className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-400 text-sm">{file.deviceName}</span>
                  <span className={`w-2 h-2 rounded-full ${file.deviceOnline ? 'bg-green-400' : 'bg-slate-500'}`} />
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <HardDrive className="w-4 h-4" />
                    <span>{formatFileSize(file.size)}</span>
                  </div>
                  {file.timestamp && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <Calendar className="w-4 h-4" />
                      <span>{file.timestamp}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-slate-400">
                    <FileText className="w-4 h-4" />
                    <span className="uppercase">{file.extension}</span>
                  </div>
                </div>

                <button 
                  onClick={() => handleDownload(file)}
                  disabled={!canDownload || file.downloading}
                  className={`mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    !canDownload 
                      ? 'bg-slate-700/30 text-slate-500 cursor-not-allowed'
                      : file.downloading
                        ? 'bg-indigo-600/50 text-white cursor-wait'
                        : 'bg-slate-700/50 hover:bg-indigo-600 text-slate-300 hover:text-white'
                  }`}
                >
                  {file.downloading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {file.onCloud ? 'Downloading...' : 'Uploading to Cloud...'}
                    </>
                  ) : file.onCloud ? (
                    <>
                      <Download className="w-4 h-4" />
                      Download from Cloud
                    </>
                  ) : file.deviceOnline ? (
                    <>
                      <Upload className="w-4 h-4" />
                      Download & Upload to Cloud
                    </>
                  ) : (
                    <>
                      <CloudOff className="w-4 h-4" />
                      Device Offline
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
