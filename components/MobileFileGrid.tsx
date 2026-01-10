/** Mobile-optimized file grid with touch-friendly interactions */

'use client';

import React, { useState, useRef } from 'react';
import { File, Folder, Download, Trash2, Eye, MoreVertical, Upload, Search, Filter } from 'lucide-react';
import { formatFileSize } from '@/lib/utils';

interface FileItem {
  id: number;
  name: string;
  type: string;
  size: number;
  extension: string;
  onCloud?: boolean;
  uploadedAt?: string;
  folderId?: number;
}

interface FolderItem {
  id: number;
  name: string;
  fileCount: number;
  subfolderCount: number;
  path: string;
}

interface MobileFileGridProps {
  files: FileItem[];
  folders: FolderItem[];
  onFileSelect?: (file: FileItem) => void;
  onFolderSelect?: (folder: FolderItem) => void;
  onFileDownload?: (file: FileItem) => void;
  onFileDelete?: (file: FileItem) => void;
  onFilePreview?: (file: FileItem) => void;
  onFileUpload?: () => void;
  onSearch?: (query: string) => void;
  selectedFiles?: Set<number>;
  onFileSelectToggle?: (fileId: number) => void;
  onMultiSelect?: (fileIds: number[]) => void;
  loading?: boolean;
}

export default function MobileFileGrid({
  files,
  folders,
  onFileSelect,
  onFolderSelect,
  onFileDownload,
  onFileDelete,
  onFilePreview,
  onFileUpload,
  onSearch,
  selectedFiles = new Set(),
  onFileSelectToggle,
  onMultiSelect,
  loading = false
}: MobileFileGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file?: FileItem;
    folder?: FolderItem;
  } | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout>();
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  // Filter files based on search and filter
  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = selectedFilter === 'all' || 
      (selectedFilter === 'cloud' && file.onCloud) ||
      (selectedFilter === 'local' && !file.onCloud) ||
      (selectedFilter === 'images' && ['jpg', 'jpeg', 'png', 'gif'].includes(file.extension.toLowerCase())) ||
      (selectedFilter === 'documents' && ['pdf', 'doc', 'docx', 'txt'].includes(file.extension.toLowerCase()));
    
    return matchesSearch && matchesFilter;
  });

  // Handle touch events for long press
  const handleTouchStart = (e: React.TouchEvent, item: FileItem | FolderItem) => {
    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    
    longPressTimer.current = setTimeout(() => {
      // Long press detected - show context menu
      const touch = e.touches[0];
      setContextMenu({
        x: touch.clientX,
        y: touch.clientY,
        file: 'id' in item ? item as FileItem : undefined,
        folder: 'fileCount' in item ? item as FolderItem : undefined
      });
    }, 500);
  };

  const handleTouchMove = () => {
    // Cancel long press if finger moves
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent, item: FileItem | FolderItem) => {
    // Clear long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    
    // Check if it was a tap (not a long press)
    const touch = e.changedTouches[0];
    const startPos = touchStartPos.current;
    
    if (startPos && 
        Math.abs(touch.clientX - startPos.x) < 10 && 
        Math.abs(touch.clientY - startPos.y) < 10) {
      
      if (isSelectionMode && 'id' in item) {
        // Toggle selection in selection mode
        onFileSelectToggle?.(item.id);
      } else {
        // Normal tap behavior
        if ('id' in item) {
          onFileSelect?.(item as FileItem);
        } else {
          onFolderSelect?.(item as FolderItem);
        }
      }
    }
    
    touchStartPos.current = null;
  };

  const getFileIcon = (file: FileItem) => {
    const ext = file.extension.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
      return '🖼️';
    } else if (['mp4', 'avi', 'mov', 'mkv'].includes(ext)) {
      return '🎬';
    } else if (['pdf'].includes(ext)) {
      return '📄';
    } else if (['csv', 'xlsx', 'xls'].includes(ext)) {
      return '📊';
    } else if (['zip', 'rar', '7z'].includes(ext)) {
      return '📦';
    } else if (['txt', 'md', 'log'].includes(ext)) {
      return '📝';
    } else {
      return '📁';
    }
  };

  const handleMultiSelect = () => {
    if (selectedFiles.size > 0) {
      onMultiSelect?.(Array.from(selectedFiles));
    }
    setIsSelectionMode(false);
    onFileSelectToggle?.(-1); // Clear selection
  };

  return (
    <div className="mobile-file-grid flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-800 border-b border-slate-700">
        {/* Search Bar */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search files and folders..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                onSearch?.(e.target.value);
              }}
              className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-slate-400 hover:text-white"
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="px-4 pb-4">
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {['all', 'cloud', 'local', 'images', 'documents'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedFilter === filter
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="flex items-center justify-between px-4 pb-4">
          <div className="flex items-center gap-2">
            {selectedFiles.size > 0 && (
              <span className="text-sm text-slate-300">
                {selectedFiles.size} selected
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {selectedFiles.size > 0 && (
              <button
                onClick={handleMultiSelect}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
              >
                Action ({selectedFiles.size})
              </button>
            )}
            
            <button
              onClick={() => setIsSelectionMode(!isSelectionMode)}
              className={`p-2 rounded-lg transition-colors ${
                isSelectionMode
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <div className="w-3 h-3 border-2 border-current rounded" />
              </div>
            </button>
            
            {onFileUpload && (
              <button
                onClick={onFileUpload}
                className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                <Upload className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div className="p-4">
            {/* Folders */}
            {folders.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-slate-400 mb-3">Folders</h3>
                <div className="grid grid-cols-2 gap-3">
                  {folders.map(folder => (
                    <div
                      key={folder.id}
                      className="bg-slate-800 rounded-lg p-4 touch-manipulation"
                      onTouchStart={(e) => handleTouchStart(e, folder)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={(e) => handleTouchEnd(e, folder)}
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className="text-3xl mb-2">📁</div>
                        <div className="text-sm text-white font-medium truncate w-full">
                          {folder.name}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {folder.fileCount} files
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            {filteredFiles.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-3">Files</h3>
                <div className="grid grid-cols-2 gap-3">
                  {filteredFiles.map(file => (
                    <div
                      key={file.id}
                      className={`bg-slate-800 rounded-lg p-4 touch-manipulation relative ${
                        selectedFiles.has(file.id) ? 'ring-2 ring-indigo-500' : ''
                      }`}
                      onTouchStart={(e) => handleTouchStart(e, file)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={(e) => handleTouchEnd(e, file)}
                    >
                      {isSelectionMode && (
                        <div className="absolute top-2 right-2">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            selectedFiles.has(file.id)
                              ? 'bg-indigo-600 border-indigo-600'
                              : 'border-slate-500'
                          }`}>
                            {selectedFiles.has(file.id) && (
                              <div className="w-2 h-2 bg-white rounded-full" />
                            )}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex flex-col items-center text-center">
                        <div className="text-3xl mb-2">{getFileIcon(file)}</div>
                        <div className="text-sm text-white font-medium truncate w-full">
                          {file.name}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {formatFileSize(file.size)}
                        </div>
                        {file.onCloud && (
                          <div className="mt-2 px-2 py-1 bg-indigo-600/20 text-indigo-400 text-xs rounded-full">
                            Cloud
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {folders.length === 0 && filteredFiles.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-4xl mb-4">📂</div>
                <h3 className="text-lg font-medium text-white mb-2">No files found</h3>
                <p className="text-slate-400 text-sm mb-4">
                  {searchQuery ? 'Try adjusting your search' : 'Upload your first files to get started'}
                </p>
                {onFileUpload && (
                  <button
                    onClick={onFileUpload}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                  >
                    Upload Files
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed bg-slate-800 border border-slate-700 rounded-lg shadow-lg py-2 z-30"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.file && (
              <>
                <button
                  onClick={() => {
                    onFilePreview?.(contextMenu.file!);
                    setContextMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
                <button
                  onClick={() => {
                    onFileDownload?.(contextMenu.file!);
                    setContextMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={() => {
                    onFileDelete?.(contextMenu.file!);
                    setContextMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </>
            )}
            
            {contextMenu.folder && (
              <button
                onClick={() => {
                  onFolderSelect?.(contextMenu.folder!);
                  setContextMenu(null);
                }}
                className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-2"
              >
                <Folder className="w-4 h-4" />
                Open Folder
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
