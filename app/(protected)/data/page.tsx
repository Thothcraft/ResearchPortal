'use client';

import { useState, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';
import {
  Database,
  FileText,
  FileJson,
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
} from 'lucide-react';

type DataFile = {
  name: string;
  type: 'imu' | 'csi' | 'mfcw' | 'img' | 'vid' | 'other';
  size: number;
  timestamp: string;
  extension: string;
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<DataFile['type'] | 'all'>('all');
  const { get } = useApi();

  const fetchFiles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await get('/data/files');
      
      if (data && Array.isArray(data.files)) {
        const parsedFiles: DataFile[] = data.files.map((file: any) => {
          const { type, timestamp } = parseFileName(file.name);
          return {
            name: file.name,
            type,
            size: file.size || 0,
            timestamp,
            extension: file.name.split('.').pop() || '',
          };
        });
        setFiles(parsedFiles);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch files');
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Data Files</h1>
          <p className="text-slate-400">Browse and manage collected sensor data</p>
        </div>
        <button
          onClick={fetchFiles}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
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
            return (
              <div
                key={index}
                className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700 hover:border-slate-600 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg ${config.bg}`}>
                    <Icon className={`w-6 h-6 ${config.color}`} />
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.color}`}>
                    {config.label}
                  </span>
                </div>

                <h3 className="text-white font-medium mb-2 truncate" title={file.name}>
                  {file.name}
                </h3>

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

                <button className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg transition-colors">
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
