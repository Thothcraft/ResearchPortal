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
import FolderUploadModal from '@/components/FolderUploadModal';
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
  FolderUp,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  SortAsc,
  SortDesc,
  Music,
  MoreVertical,
  Plus,
  ArrowLeft,
  Tag,
  Tags,
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

type DataFolder = {
  id: number;
  name: string;
  parent_id: number | null;
  path: string;
  created_at: string;
  updated_at: string;
  file_count: number;
  subfolder_count: number;
  size_bytes: number;
  description?: string;
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
  folderId?: number;
  labels?: string[];
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
  
  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLabel, setUploadLabel] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Folder state
  const [showFolderUploadModal, setShowFolderUploadModal] = useState(false);
  const [folders, setFolders] = useState<DataFolder[]>([]);
  const [allFolders, setAllFolders] = useState<DataFolder[]>([]);  // For folder name lookups
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [deletingFolderId, setDeletingFolderId] = useState<number | null>(null);
  
  // Label management state
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [labelFile, setLabelFile] = useState<DataFile | null>(null);
  const [fileLabels, setFileLabels] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [isLoadingLabels, setIsLoadingLabels] = useState(false);
  const [isSavingLabels, setIsSavingLabels] = useState(false);
  
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

  // Fetch folders
  const fetchFolders = useCallback(async () => {
    setFoldersLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = '/api/proxy';
      
      const parentParam = currentFolderId ? `?parent_id=${currentFolderId}` : '?parent_id=-1';
      const response = await fetch(`${apiUrl}/folders/${parentParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setFolders(data || []);
      } else {
        setFolders([]);
      }
    } catch (error) {
      console.error('Error fetching folders:', error);
      setFolders([]);
    } finally {
      setFoldersLoading(false);
    }
  }, [currentFolderId]);

  // Fetch folders on mount and when currentFolderId changes
  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  // Fetch all folders for name lookups
  const fetchAllFolders = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = '/api/proxy';
      
      const response = await fetch(`${apiUrl}/folders/?all=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAllFolders(data || []);
      }
    } catch (error) {
      console.error('Error fetching all folders:', error);
    }
  }, []);

  // Fetch all folders on mount
  useEffect(() => {
    fetchAllFolders();
  }, [fetchAllFolders]);

  // Create folder handler
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = '/api/proxy';
      
      const response = await fetch(`${apiUrl}/folders/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newFolderName.trim(),
          parent_id: currentFolderId,
        }),
      });
      
      if (response.ok) {
        toast.success('Folder Created', `Folder "${newFolderName}" created successfully`);
        setNewFolderName('');
        setShowCreateFolderModal(false);
        fetchFolders();
        fetchAllFolders();
      } else {
        const error = await response.json().catch(() => ({}));
        toast.error('Error', error.detail || 'Failed to create folder');
      }
    } catch (error) {
      toast.error('Error', 'Failed to create folder');
    }
  };

  // Folder upload complete handler
  const handleFolderUploadComplete = (folderId: number, folderName: string) => {
    toast.success('Upload Complete', `Folder "${folderName}" uploaded successfully`);
    setShowFolderUploadModal(false);
    fetchFolders();
    fetchAllFolders();
    clearCache('/file');
    refetchCloudFiles();
  };

  // Delete folder handler
  const handleDeleteFolder = async (folder: DataFolder, force: boolean = false) => {
    if (!force && (folder.file_count > 0 || folder.subfolder_count > 0)) {
      const confirmMsg = `Folder "${folder.name}" contains ${folder.file_count} files and ${folder.subfolder_count} subfolders. Delete anyway? (Files will be moved to root)`;
      if (!confirm(confirmMsg)) return;
      force = true;
    } else if (!force) {
      if (!confirm(`Delete folder "${folder.name}"?`)) return;
    }
    
    setDeletingFolderId(folder.id);
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = '/api/proxy';
      
      const response = await fetch(`${apiUrl}/folders/${folder.id}?force=${force}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        toast.success('Folder Deleted', `"${folder.name}" has been deleted`);
        fetchFolders();
        fetchAllFolders();
      } else {
        const error = await response.json().catch(() => ({}));
        toast.error('Delete Failed', error.detail || 'Failed to delete folder');
      }
    } catch (error) {
      toast.error('Error', 'Failed to delete folder');
    } finally {
      setDeletingFolderId(null);
    }
  };

  // Label management handlers
  const handleOpenLabelModal = async (file: DataFile) => {
    if (!file.cloudFileId) {
      toast.warning('Not Available', 'File must be on cloud to manage labels');
      return;
    }
    
    setLabelFile(file);
    setShowLabelModal(true);
    setIsLoadingLabels(true);
    setFileLabels([]);
    setNewLabel('');
    
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = '/api/proxy';
      
      const response = await fetch(`${apiUrl}/file/${file.cloudFileId}/metadata`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setFileLabels(data.labels || []);
      }
    } catch (error) {
      console.error('Error fetching labels:', error);
    } finally {
      setIsLoadingLabels(false);
    }
  };

  const handleAddLabel = () => {
    const label = newLabel.trim();
    if (!label) return;
    if (fileLabels.includes(label)) {
      toast.warning('Duplicate', 'This label already exists');
      return;
    }
    setFileLabels([...fileLabels, label]);
    setNewLabel('');
  };

  const handleRemoveLabel = (label: string) => {
    setFileLabels(fileLabels.filter(l => l !== label));
  };

  const handleSaveLabels = async () => {
    if (!labelFile?.cloudFileId) return;
    
    setIsSavingLabels(true);
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = '/api/proxy';
      
      const response = await fetch(`${apiUrl}/file/${labelFile.cloudFileId}/metadata`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          labels: fileLabels,
          primary_label: fileLabels[0] || '',
        }),
      });
      
      if (response.ok) {
        toast.success('Labels Saved', 'File labels updated successfully');
        setShowLabelModal(false);
        setLabelFile(null);
        clearCache('/file');
        refetchCloudFiles();
      } else {
        const error = await response.json().catch(() => ({}));
        toast.error('Save Failed', error.detail || 'Failed to save labels');
      }
    } catch (error) {
      toast.error('Error', 'Failed to save labels');
    } finally {
      setIsSavingLabels(false);
    }
  };

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
          folderId: f.folder_id,
          labels: f.labels || [],
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
      const apiUrl = '/api/proxy';
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
      const apiUrl = '/api/proxy';
      
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
      const apiUrl = '/api/proxy';
      
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadFile(file);
    setUploadError(null);
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    
    setIsUploading(true);
    setUploadError(null);
    
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = '/api/proxy';
      
      // Use FormData for efficient file upload (handles large files without memory issues)
      const formData = new FormData();
      formData.append('file', uploadFile);
      
      // Extract label from filename (without extension)
      const filenameWithoutExt = uploadFile.name.replace(/\.[^.]+$/, '');
      const labels = uploadLabel.trim() 
        ? [filenameWithoutExt, uploadLabel.trim()] 
        : [filenameWithoutExt];
      
      formData.append('labels', JSON.stringify(labels));
      
      const response = await fetch(`${apiUrl}/file/upload-multipart`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      toast.success('Upload Complete', `"${uploadFile.name}" uploaded successfully`);
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadLabel('');
      
      // Refresh file list
      clearCache('/file');
      refetchCloudFiles();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setUploadError(message);
      toast.error('Upload Failed', message);
    } finally {
      setIsUploading(false);
    }
  };

  const resetUploadModal = () => {
    setShowUploadModal(false);
    setUploadFile(null);
    setUploadLabel('');
    setUploadError(null);
  };

  const isLoading = devicesLoading || cloudFilesLoading || deviceFilesLoading;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Data Files</h1>
          <p className="text-slate-400">
            {filteredFiles.length} files • {folders.length} folders • {showValidOnly ? 'Valid format only' : 'All files'}
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
            onClick={() => setShowFolderUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <FolderUp className="w-4 h-4" />
            Upload Folder
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload File
          </button>
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

      {/* Folders Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Folder className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-semibold text-white">Folders</h2>
            {currentFolderId && (
              <button
                onClick={() => setCurrentFolderId(null)}
                className="flex items-center gap-1 ml-2 text-sm text-indigo-400 hover:text-indigo-300"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to root
              </button>
            )}
          </div>
          <button
            onClick={() => setShowCreateFolderModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            New Folder
          </button>
        </div>
        
        {foldersLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : folders.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
            {folders.map(folder => (
              <div
                key={folder.id}
                className="relative flex items-center gap-3 p-4 bg-slate-800/50 border border-slate-700 rounded-xl cursor-pointer hover:border-indigo-500/50 hover:bg-slate-800 transition-all group"
              >
                <div 
                  className="flex items-center gap-3 flex-1 min-w-0"
                  onClick={() => setCurrentFolderId(folder.id)}
                >
                  <FolderOpen className="w-10 h-10 text-yellow-400 group-hover:text-yellow-300 flex-shrink-0" />
                  <div className="text-left min-w-0">
                    <p className="text-white font-medium text-sm truncate">{folder.name}</p>
                    <p className="text-slate-500 text-xs">{folder.file_count} files</p>
                    <p className="text-slate-600 text-xs">{formatFileSize(folder.size_bytes)}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }}
                  disabled={deletingFolderId === folder.id}
                  className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all disabled:opacity-50"
                  title="Delete folder"
                >
                  {deletingFolderId === folder.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-slate-800/30 rounded-xl border border-slate-700/50 mb-4">
            <Folder className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No folders yet</p>
            <button
              onClick={() => setShowFolderUploadModal(true)}
              className="mt-2 text-indigo-400 hover:text-indigo-300 text-sm"
            >
              Upload a folder to get started
            </button>
          </div>
        )}
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
            Upload files or folders to get started
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
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-medium truncate" title={file.name}>
                        {file.name}
                      </h3>
                      {file.folderId && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-yellow-500/10 text-yellow-400">
                          <Folder className="w-3 h-3" />
                          {allFolders.find(f => f.id === file.folderId)?.name || 'Folder'}
                        </span>
                      )}
                    </div>
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
                    {file.labels && file.labels.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        <Tag className="w-3 h-3 text-slate-500" />
                        {file.labels.slice(0, 3).map((label, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded text-xs bg-indigo-500/20 text-indigo-300">
                            {label}
                          </span>
                        ))}
                        {file.labels.length > 3 && (
                          <span className="text-xs text-slate-500">+{file.labels.length - 3} more</span>
                        )}
                      </div>
                    )}
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
                          onClick={() => handleOpenLabelModal(file)}
                          className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-indigo-400 transition-colors"
                          title="Manage Labels"
                        >
                          <Tags className="w-4 h-4" />
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

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl w-full max-w-lg overflow-hidden border border-slate-700">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <Upload className="w-5 h-5 text-green-400" />
                <h3 className="text-lg font-semibold text-white">Upload Data File</h3>
              </div>
              <button
                onClick={resetUploadModal}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* File info guide */}
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <h4 className="text-sm font-medium text-slate-300 mb-2">Supported File Types</h4>
                <div className="text-xs text-slate-500 space-y-1">
                  <p><strong className="text-slate-400">CSV:</strong> .csv (CSI data, general data)</p>
                  <p><strong className="text-slate-400">JSON:</strong> .json, .jsonl (IMU, sensor data)</p>
                  <p><strong className="text-slate-400">Media:</strong> .jpg, .png, .mp4, .wav, etc.</p>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  The filename (without extension) will be used as the file's label.
                </p>
              </div>

              {/* File input */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Select File
                </label>
                <input
                  type="file"
                  onChange={handleFileSelect}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white file:cursor-pointer hover:file:bg-indigo-700"
                />
              </div>

              {/* File info display */}
              {uploadFile && (
                <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const type = detectFileType(uploadFile.name);
                      const Icon = FILE_TYPE_ICONS[type];
                      const info = getFileTypeDisplayInfo(type);
                      return (
                        <>
                          <div className={`p-2 rounded-lg ${info.bgColor}`}>
                            <Icon className={`w-5 h-5 ${info.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{uploadFile.name}</p>
                            <p className="text-sm text-slate-400">
                              {formatFileSize(uploadFile.size)} • Detected type: <span className={info.color}>{info.label}</span>
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Optional label */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Additional Label (optional)
                </label>
                <input
                  type="text"
                  value={uploadLabel}
                  onChange={(e) => setUploadLabel(e.target.value)}
                  placeholder="e.g., walking, sitting, gesture1"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  File will have both filename and this label (if provided)
                </p>
              </div>

              {/* Error display */}
              {uploadError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <p className="text-red-400 text-sm whitespace-pre-line">{uploadError}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={resetUploadModal}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!uploadFile || isUploading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Folder Upload Modal */}
      <FolderUploadModal
        isOpen={showFolderUploadModal}
        onClose={() => setShowFolderUploadModal(false)}
        onUploadComplete={handleFolderUploadComplete}
        parentFolderId={currentFolderId}
      />

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl w-full max-w-md border border-slate-700">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <FolderPlus className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-semibold text-white">Create New Folder</h3>
              </div>
              <button
                onClick={() => { setShowCreateFolderModal(false); setNewFolderName(''); }}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Folder Name
              </label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); }}
                placeholder="Enter folder name..."
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                autoFocus
              />
              <p className="text-xs text-slate-500 mt-2">
                Folder name will be used as the default label for files uploaded to this folder.
              </p>
            </div>
            <div className="flex gap-3 p-4 border-t border-slate-700">
              <button
                onClick={() => { setShowCreateFolderModal(false); setNewFolderName(''); }}
                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FolderPlus className="w-4 h-4" />
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Label Management Modal */}
      {showLabelModal && labelFile && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl w-full max-w-lg border border-slate-700">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <Tags className="w-5 h-5 text-indigo-400" />
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-white">Manage Labels</h3>
                  <p className="text-sm text-slate-400 truncate">{labelFile.name}</p>
                </div>
              </div>
              <button
                onClick={() => { setShowLabelModal(false); setLabelFile(null); }}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {isLoadingLabels ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Current Labels */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Current Labels
                    </label>
                    {fileLabels.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {fileLabels.map((label, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/20 text-indigo-300 rounded-full text-sm"
                          >
                            <Tag className="w-3 h-3" />
                            {label}
                            <button
                              onClick={() => handleRemoveLabel(label)}
                              className="ml-1 p-0.5 hover:bg-indigo-500/30 rounded-full transition-colors"
                              title="Remove label"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm">No labels assigned</p>
                    )}
                  </div>

                  {/* Add New Label */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Add New Label
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddLabel(); }}
                        placeholder="e.g., walking, sitting, gesture1"
                        className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={handleAddLabel}
                        disabled={!newLabel.trim()}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Labels help organize files for training datasets. The first label is used as the primary label.
                    </p>
                  </div>

                  {/* Quick Add Suggestions */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Quick Add
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['walking', 'sitting', 'standing', 'running', 'gesture', 'empty', 'noise'].map(suggestion => (
                        <button
                          key={suggestion}
                          onClick={() => {
                            if (!fileLabels.includes(suggestion)) {
                              setFileLabels([...fileLabels, suggestion]);
                            }
                          }}
                          disabled={fileLabels.includes(suggestion)}
                          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          + {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 p-4 border-t border-slate-700">
              <button
                onClick={() => { setShowLabelModal(false); setLabelFile(null); }}
                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLabels}
                disabled={isSavingLabels}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isSavingLabels ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Tag className="w-4 h-4" />
                    Save Labels
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
