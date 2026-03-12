'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Camera,
  Video,
  Image,
  Upload,
  Trash2,
  Download,
  RefreshCw,
  Play,
  Pause,
  X,
  Cloud,
  CloudOff,
  Loader2,
  Grid,
  List,
  Filter,
  Search,
  Clock,
  HardDrive,
  Smartphone,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

type MediaFile = {
  file_id?: string;
  filename: string;
  type: 'image' | 'video' | 'audio';
  size: number;
  content_type?: string;
  uploaded_at?: string;
  created?: string;
  modified?: string;
  on_cloud?: boolean;
  device_id?: string;
};

type CaptureStatus = {
  capturing: boolean;
  type: 'photo' | 'video' | null;
  progress: number;
};

export default function MediaGalleryPage() {
  const { token } = useAuth();
  const [cloudFiles, setCloudFiles] = useState<MediaFile[]>([]);
  const [localFiles, setLocalFiles] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video' | 'audio'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>({ capturing: false, type: null, progress: 0 });
  const [thothConnected, setThothConnected] = useState(false);
  const [thothUrl, setThothUrl] = useState('http://localhost:5000');
  const [showSettings, setShowSettings] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-d7d37.up.railway.app';

  const fetchCloudFiles = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/file/files?limit=100&content_type=image,video`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.files) {
          const mediaFiles = data.files.filter((f: any) => 
            f.content_type?.startsWith('image/') || 
            f.content_type?.startsWith('video/') ||
            f.filename?.match(/\.(jpg|jpeg|png|gif|mp4|avi|mov|webm)$/i)
          ).map((f: any) => ({
            ...f,
            type: f.content_type?.startsWith('video/') ? 'video' : 'image',
            on_cloud: true,
          }));
          setCloudFiles(mediaFiles);
        }
      }
    } catch (error) {
      console.error('Error fetching cloud files:', error);
    }
  }, [token, API_BASE]);

  const fetchLocalFiles = useCallback(async () => {
    try {
      const response = await fetch(`${thothUrl}/api/media/list`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          setLocalFiles(data.files.map((f: any) => ({ ...f, on_cloud: false })));
          setThothConnected(true);
        }
      } else {
        setThothConnected(false);
      }
    } catch (error) {
      console.error('Error fetching local files:', error);
      setThothConnected(false);
    }
  }, [thothUrl]);

  const refreshFiles = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchCloudFiles(), fetchLocalFiles()]);
    setIsRefreshing(false);
  }, [fetchCloudFiles, fetchLocalFiles]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchCloudFiles(), fetchLocalFiles()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchCloudFiles, fetchLocalFiles]);

  const captureMedia = async (type: 'photo' | 'video', duration: number = 5) => {
    if (!thothConnected) {
      alert('Thoth device not connected. Please check the connection.');
      return;
    }

    setCaptureStatus({ capturing: true, type, progress: 0 });

    try {
      const response = await fetch(`${thothUrl}/api/camera/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, duration, upload: true }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.status === 'success') {
          await refreshFiles();
        }
      }
    } catch (error) {
      console.error('Error capturing media:', error);
    } finally {
      setCaptureStatus({ capturing: false, type: null, progress: 0 });
    }
  };

  const uploadToCloud = async (filename: string) => {
    try {
      const response = await fetch(`${thothUrl}/api/media/upload/${filename}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        await refreshFiles();
      }
    } catch (error) {
      console.error('Error uploading to cloud:', error);
    }
  };

  const deleteFile = async (file: MediaFile) => {
    if (!confirm(`Delete ${file.filename}?`)) return;

    try {
      if (file.on_cloud && file.file_id) {
        await fetch(`${API_BASE}/file/${file.file_id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      } else {
        await fetch(`${thothUrl}/api/media/delete/${file.filename}`, {
          method: 'DELETE',
        });
      }
      await refreshFiles();
      setSelectedFile(null);
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  const allFiles = [...cloudFiles, ...localFiles.filter(lf => 
    !cloudFiles.some(cf => cf.filename === lf.filename)
  )];

  const filteredFiles = allFiles.filter(file => {
    if (filterType !== 'all' && file.type !== filterType) return false;
    if (searchQuery && !file.filename.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMediaUrl = (file: MediaFile) => {
    if (file.on_cloud && file.file_id) {
      return `${API_BASE}/file/${file.file_id}/content`;
    }
    return `${thothUrl}/api/media/serve/${file.filename}`;
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading media gallery...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Media Gallery</h1>
            <p className="text-slate-400">Capture, view, and manage photos and videos from your devices</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              thothConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {thothConnected ? <Smartphone className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {thothConnected ? 'Device Connected' : 'Device Offline'}
            </div>
            <button
              onClick={refreshFiles}
              disabled={isRefreshing}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Capture Controls */}
        <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 rounded-xl p-6 border border-indigo-500/30 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-400" />
            Quick Capture
          </h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => captureMedia('photo')}
              disabled={captureStatus.capturing || !thothConnected}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition-colors"
            >
              {captureStatus.capturing && captureStatus.type === 'photo' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Image className="w-5 h-5" />
              )}
              Take Photo
            </button>
            <button
              onClick={() => captureMedia('video', 5)}
              disabled={captureStatus.capturing || !thothConnected}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition-colors"
            >
              {captureStatus.capturing && captureStatus.type === 'video' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Video className="w-5 h-5" />
              )}
              Record 5s Video
            </button>
            <button
              onClick={() => captureMedia('video', 10)}
              disabled={captureStatus.capturing || !thothConnected}
              className="flex items-center gap-2 px-6 py-3 bg-pink-600 hover:bg-pink-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition-colors"
            >
              {captureStatus.capturing && captureStatus.type === 'video' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Video className="w-5 h-5" />
              )}
              Record 10s Video
            </button>
          </div>
          {!thothConnected && (
            <p className="text-amber-400 text-sm mt-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Connect your Thoth device to enable capture. Device URL: {thothUrl}
            </p>
          )}
        </div>

        {/* Filters and Search */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-400" />
            {(['all', 'image', 'video', 'audio'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterType === type
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Image className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{allFiles.filter(f => f.type === 'image').length}</p>
                <p className="text-slate-400 text-sm">Photos</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Video className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{allFiles.filter(f => f.type === 'video').length}</p>
                <p className="text-slate-400 text-sm">Videos</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Cloud className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{cloudFiles.length}</p>
                <p className="text-slate-400 text-sm">On Cloud</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <HardDrive className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{localFiles.length}</p>
                <p className="text-slate-400 text-sm">On Device</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Media Grid/List */}
      {filteredFiles.length === 0 ? (
        <div className="text-center py-16">
          <Camera className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No media files yet</h3>
          <p className="text-slate-400 mb-6">Capture photos or videos using the buttons above</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredFiles.map((file, index) => (
            <div
              key={`${file.filename}-${index}`}
              onClick={() => setSelectedFile(file)}
              className="group relative aspect-square bg-slate-800 rounded-xl overflow-hidden cursor-pointer border border-slate-700 hover:border-indigo-500 transition-all hover:scale-[1.02]"
            >
              {file.type === 'image' ? (
                <img
                  src={getMediaUrl(file)}
                  alt={file.filename}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23334155" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%2394a3b8" font-size="12">No Preview</text></svg>';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/50 to-indigo-900/50">
                  <Play className="w-12 h-12 text-white/80" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-white text-sm font-medium truncate">{file.filename}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-slate-300 text-xs">{formatFileSize(file.size)}</span>
                    {file.on_cloud ? (
                      <Cloud className="w-3 h-3 text-green-400" />
                    ) : (
                      <HardDrive className="w-3 h-3 text-orange-400" />
                    )}
                  </div>
                </div>
              </div>
              <div className="absolute top-2 right-2">
                {file.type === 'video' && (
                  <div className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">
                    Video
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-800">
              <tr>
                <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">File</th>
                <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Type</th>
                <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Size</th>
                <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Location</th>
                <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Date</th>
                <th className="text-right text-slate-400 text-sm font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredFiles.map((file, index) => (
                <tr
                  key={`${file.filename}-${index}`}
                  className="hover:bg-slate-700/50 cursor-pointer"
                  onClick={() => setSelectedFile(file)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center overflow-hidden">
                        {file.type === 'image' ? (
                          <img src={getMediaUrl(file)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Video className="w-5 h-5 text-purple-400" />
                        )}
                      </div>
                      <span className="text-white text-sm font-medium truncate max-w-[200px]">{file.filename}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      file.type === 'image' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {file.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-sm">{formatFileSize(file.size)}</td>
                  <td className="px-4 py-3">
                    {file.on_cloud ? (
                      <span className="flex items-center gap-1 text-green-400 text-sm">
                        <Cloud className="w-4 h-4" /> Cloud
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-orange-400 text-sm">
                        <HardDrive className="w-4 h-4" /> Device
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-sm">
                    {formatDate(file.uploaded_at || file.modified)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!file.on_cloud && (
                        <button
                          onClick={(e) => { e.stopPropagation(); uploadToCloud(file.filename); }}
                          className="p-1.5 text-slate-400 hover:text-green-400 hover:bg-green-500/10 rounded"
                          title="Upload to cloud"
                        >
                          <Upload className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteFile(file); }}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Media Preview Modal */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setSelectedFile(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div>
                <h3 className="text-white font-semibold">{selectedFile.filename}</h3>
                <p className="text-slate-400 text-sm">
                  {formatFileSize(selectedFile.size)} • {formatDate(selectedFile.uploaded_at || selectedFile.modified)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!selectedFile.on_cloud && (
                  <button
                    onClick={() => uploadToCloud(selectedFile.filename)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
                  >
                    <Upload className="w-4 h-4" />
                    Upload to Cloud
                  </button>
                )}
                <button
                  onClick={() => deleteFile(selectedFile)}
                  className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 flex items-center justify-center bg-black min-h-[400px]">
              {selectedFile.type === 'image' ? (
                <img
                  src={getMediaUrl(selectedFile)}
                  alt={selectedFile.filename}
                  className="max-w-full max-h-[70vh] object-contain"
                />
              ) : (
                <video
                  src={getMediaUrl(selectedFile)}
                  controls
                  autoPlay
                  className="max-w-full max-h-[70vh]"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
