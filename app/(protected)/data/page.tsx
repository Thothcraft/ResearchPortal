'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useCachedApi, useCachedData, clearCache } from '@/hooks/useCachedApi';
import { useToast, parseApiError } from '@/contexts/ToastContext';
import {
  detectFileType,
  isValidDataFile,
  extractDateFromFilename,
  getFileTypeDisplayInfo,
  formatFileSize,
  DataFileType,
} from '@/utils/fileDetection';
import { FileListSkeleton, StatCardsSkeleton } from '@/components/LoadingSkeleton';
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
  Trash2,
  Folder,
  FolderOpen,
  FolderPlus,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  SortAsc,
  SortDesc,
  Music,
} from 'lucide-react';

// Constants
const PAGE_SIZE = 20;
const CACHE_TTL = 60000; // 1 minute

type Device = {
  id: string;
  name: string;
  status: 'online' | 'offline';
  ip_address?: string;
};

type DataFile = {
  id?: number;
  name: string;
  type: DataFileType;
  size: number;
  timestamp: string;
  extension: string;
  deviceId: string;
  deviceName: string;
  deviceOnline: boolean;
  onCloud: boolean;
  cloudFileId?: number;
  isValid: boolean;
};

const FILE_TYPE_ICONS: Record<DataFileType, typeof Database> = {
  csi: Wifi,
  imu: Activity,
  image: Image,
  video: Film,
  audio: Music,
  sensor: Radio,
  timelapse: Film,
  other: FileText,
};

export default function DataPage() {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<DataFileType | 'all'>('all');
  const [showValidOnly, setShowValidOnly] = useState(true);
  
  // UI state
  const [previewFile, setPreviewFile] = useState<DataFile | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  
  const { get, post } = useCachedApi();
  const toast = useToast();

  // Fetch devices with caching
  const { 
    data: devicesData, 
    isLoading: devicesLoading,
    refetch: refetchDevices 
  } = useCachedData<{ devices: any[] }>('/device/list?include_offline=true', {
    cacheTTL: CACHE_TTL,
    refreshInterval: 30000, // Refresh every 30s
  });

  // Fetch cloud files with caching
  const {
    data: cloudFilesData,
    isLoading: cloudFilesLoading,
    refetch: refetchCloudFiles
  } = useCachedData<{ files: any[] }>('/file/files?limit=200', {
    cacheTTL: CACHE_TTL,
  });

  // Process devices
  const devices = useMemo(() => {
    if (!devicesData?.devices) return [];
    return devicesData.devices.map((d: any) => ({
      id: d.device_uuid || d.device_id,
      name: d.device_name || d.name,
      status: d.online ? 'online' : 'offline',
      ip_address: d.ip_address,
    }));
  }, [devicesData]);

  // Fetch device files (only for online devices to reduce load)
  const [deviceFiles, setDeviceFiles] = useState<DataFile[]>([]);
  const [deviceFilesLoading, setDeviceFilesLoading] = useState(false);

  const fetchDeviceFiles = useCallback(async () => {
    if (devices.length === 0) return;
    
    setDeviceFilesLoading(true);
    const allFiles: DataFile[] = [];
    
    // Only fetch from online devices for performance
    const onlineDevices = devices.filter(d => d.status === 'online');
    
    await Promise.all(
      onlineDevices.map(async (device) => {
        try {
          const data = await get(`/device/${device.id}/files`, { cacheTTL: CACHE_TTL });
          if (data?.files) {
            data.files.forEach((f: any) => {
              const type = detectFileType(f.filename);
              const isValid = isValidDataFile(f.filename);
              const timestamp = extractDateFromFilename(f.filename) || '';
              
              allFiles.push({
                id: f.id,
                name: f.filename,
                type,
                size: f.size || 0,
                timestamp,
                extension: f.filename.split('.').pop() || '',
                deviceId: device.id,
                deviceName: device.name,
                deviceOnline: true,
                onCloud: f.on_cloud || false,
                cloudFileId: f.cloud_file_id,
                isValid,
              });
            });
          }
        } catch (e) {
          console.log(`Could not fetch files for device ${device.id}`);
        }
      })
    );
    
    setDeviceFiles(allFiles);
    setDeviceFilesLoading(false);
  }, [devices, get]);

  // Fetch device files when devices change
  useEffect(() => {
    if (devices.length > 0) {
      fetchDeviceFiles();
    }
  }, [devices.length, fetchDeviceFiles]);

  // Process cloud files
  const cloudFiles = useMemo(() => {
    if (!cloudFilesData?.files) return [];
    
    const seenIds = new Set(deviceFiles.map(f => f.cloudFileId).filter(Boolean));
    
    return cloudFilesData.files
      .filter((f: any) => !seenIds.has(f.file_id))
      .map((f: any) => {
        const type = detectFileType(f.filename);
        const isValid = isValidDataFile(f.filename);
        const timestamp = extractDateFromFilename(f.filename) || f.uploaded_at?.split('T')[0] || '';
        
        return {
          id: undefined,
          name: f.filename,
          type,
          size: f.size || 0,
          timestamp,
          extension: f.filename.split('.').pop() || '',
          deviceId: 'cloud',
          deviceName: 'Cloud Upload',
          deviceOnline: true,
          onCloud: true,
          cloudFileId: f.file_id,
          isValid,
        } as DataFile;
      });
  }, [cloudFilesData, deviceFiles]);

  // Combine all files
  const allFiles = useMemo(() => {
    return [...deviceFiles, ...cloudFiles];
  }, [deviceFiles, cloudFiles]);

  // Filter and sort files
  const filteredFiles = useMemo(() => {
    let result = allFiles;
    
    // Filter by validity
    if (showValidOnly) {
      result = result.filter(f => f.isValid);
    }
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(f => 
        f.name.toLowerCase().includes(query) ||
        f.deviceName.toLowerCase().includes(query)
      );
    }
    
    // Filter by type
    if (filterType !== 'all') {
      result = result.filter(f => f.type === filterType);
    }
    
    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'date':
          cmp = (a.timestamp || '').localeCompare(b.timestamp || '');
          break;
        case 'size':
          cmp = a.size - b.size;
          break;
        case 'type':
          cmp = a.type.localeCompare(b.type);
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    
    return result;
  }, [allFiles, searchQuery, filterType, showValidOnly, sortBy, sortOrder]);

  // Paginate
  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredFiles.slice(start, start + PAGE_SIZE);
  }, [filteredFiles, currentPage]);

  const totalPages = Math.ceil(filteredFiles.length / PAGE_SIZE);

  // File type counts
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allFiles.length };
    allFiles.forEach(f => {
      counts[f.type] = (counts[f.type] || 0) + 1;
    });
    return counts;
  }, [allFiles]);

  // Handlers
  const handleRefresh = async () => {
    clearCache('/device');
    clearCache('/file');
    await Promise.all([refetchDevices(), refetchCloudFiles()]);
    await fetchDeviceFiles();
  };

  const handlePreview = async (file: DataFile) => {
    if (!file.onCloud || !file.cloudFileId) {
      toast.warning('Not Available', 'File must be uploaded to cloud for preview');
      return;
    }
    
    setPreviewFile(file);
    setPreviewContent(null);
    setIsLoadingPreview(true);
    
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-d7d37.up.railway.app';
      const fileUrl = `${apiUrl}/file/${file.cloudFileId}?download=false`;
      
      const response = await fetch(fileUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to load file');
      
      if (['image', 'video', 'audio', 'timelapse'].includes(file.type)) {
        const blob = await response.blob();
        setPreviewContent(URL.createObjectURL(blob));
      } else {
        const text = await response.text();
        setPreviewContent(text.substring(0, 5000) + (text.length > 5000 ? '\n\n... (truncated)' : ''));
      }
    } catch (err) {
      setPreviewContent('Failed to load preview');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDelete = async (file: DataFile) => {
    if (!file.cloudFileId) return;
    if (!confirm(`Delete "${file.name}" from cloud?`)) return;
    
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-d7d37.up.railway.app';
      
      const response = await fetch(`${apiUrl}/file/${file.cloudFileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Delete failed');
      
      toast.success('Deleted', `"${file.name}" removed from cloud`);
      clearCache('/file');
      refetchCloudFiles();
    } catch (err) {
      toast.error('Delete Failed', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleDownload = async (file: DataFile) => {
    if (!file.cloudFileId) {
      toast.warning('Not Available', 'File must be on cloud to download');
      return;
    }
    
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-d7d37.up.railway.app';
      
      const response = await fetch(`${apiUrl}/file/${file.cloudFileId}?download=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Download Failed', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const isLoading = devicesLoading || cloudFilesLoading || deviceFilesLoading;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Data Files</h1>
          <p className="text-slate-400">
            {filteredFiles.length} files • {showValidOnly ? 'Valid format only' : 'All files'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={showValidOnly}
              onChange={(e) => setShowValidOnly(e.target.checked)}
              className="rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
            />
            Valid format only
          </label>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Type Filters */}
      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3 mb-6">
        <button
          onClick={() => { setFilterType('all'); setCurrentPage(1); }}
          className={`p-3 rounded-xl border transition-all ${
            filterType === 'all'
              ? 'bg-indigo-600 border-indigo-500 text-white'
              : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
          }`}
        >
          <Database className="w-5 h-5 mx-auto mb-1" />
          <div className="text-xs font-medium">All</div>
          <div className="text-lg font-bold">{typeCounts.all || 0}</div>
        </button>
        {(['csi', 'imu', 'image', 'video', 'audio', 'sensor', 'timelapse', 'other'] as DataFileType[]).map(type => {
          const Icon = FILE_TYPE_ICONS[type];
          const info = getFileTypeDisplayInfo(type);
          return (
            <button
              key={type}
              onClick={() => { setFilterType(type); setCurrentPage(1); }}
              className={`p-3 rounded-xl border transition-all ${
                filterType === type
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
              }`}
            >
              <Icon className={`w-5 h-5 mx-auto mb-1 ${filterType === type ? '' : info.color}`} />
              <div className="text-xs font-medium">{info.label}</div>
              <div className="text-lg font-bold">{typeCounts[type] || 0}</div>
            </button>
          );
        })}
      </div>

      {/* Search and Sort */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="date">Sort by Date</option>
            <option value="name">Sort by Name</option>
            <option value="size">Sort by Size</option>
            <option value="type">Sort by Type</option>
          </select>
          <button
            onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
            className="px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white hover:border-slate-600 transition-colors"
          >
            {sortOrder === 'asc' ? <SortAsc className="w-5 h-5" /> : <SortDesc className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && allFiles.length === 0 ? (
        <FileListSkeleton count={8} />
      ) : filteredFiles.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
          <Database className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400">No data files found</p>
          <p className="text-slate-500 text-sm mt-1">
            Valid files should follow format: type_YYYY-MM-DD_name.ext
          </p>
        </div>
      ) : (
        <>
          {/* File List */}
          <div className="space-y-3 mb-6">
            {paginatedFiles.map((file, index) => {
              const Icon = FILE_TYPE_ICONS[file.type];
              const info = getFileTypeDisplayInfo(file.type);
              
              return (
                <div
                  key={`${file.name}-${file.deviceId}-${index}`}
                  className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700 hover:border-slate-600 transition-all"
                >
                  <div className={`p-3 rounded-lg ${info.bgColor}`}>
                    <Icon className={`w-6 h-6 ${info.color}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium truncate" title={file.name}>
                      {file.name}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Server className="w-3 h-3" />
                        {file.deviceName}
                      </span>
                      {file.timestamp && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {file.timestamp}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3" />
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {file.onCloud ? (
                      <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-500/10 text-green-400">
                        <Cloud className="w-3 h-3" />
                        Cloud
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-slate-500/10 text-slate-400">
                        <CloudOff className="w-3 h-3" />
                        Local
                      </span>
                    )}
                    
                    {file.onCloud && (
                      <>
                        <button
                          onClick={() => handlePreview(file)}
                          className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownload(file)}
                          className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(file)}
                          className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-slate-400 text-sm">
                Showing {(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, filteredFiles.length)} of {filteredFiles.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="px-4 py-2 text-white">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-slate-700">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-semibold text-white truncate">{previewFile.name}</h3>
              </div>
              <button
                onClick={() => { setPreviewFile(null); setPreviewContent(null); }}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
              {isLoadingPreview ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                </div>
              ) : previewFile.type === 'image' && previewContent ? (
                <img src={previewContent} alt={previewFile.name} className="max-w-full h-auto mx-auto rounded-lg" />
              ) : ['video', 'timelapse'].includes(previewFile.type) && previewContent ? (
                <video src={previewContent} controls className="max-w-full h-auto mx-auto rounded-lg" />
              ) : previewFile.type === 'audio' && previewContent ? (
                <div className="flex flex-col items-center py-8">
                  <Music className="w-16 h-16 text-blue-400 mb-4" />
                  <audio src={previewContent} controls className="w-full max-w-md" />
                </div>
              ) : (
                <pre className="bg-slate-900 p-4 rounded-lg text-sm text-slate-300 overflow-x-auto whitespace-pre-wrap font-mono">
                  {previewContent || 'No preview available'}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
