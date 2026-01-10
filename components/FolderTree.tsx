/** Folder tree component with drag and drop support */

'use client';

import React, { useState, useCallback, useRef } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, File, Plus, MoreVertical } from 'lucide-react';

interface FolderNode {
  id: number;
  name: string;
  parent_id: number | null;
  path: string;
  created_at: string;
  updated_at: string;
  file_count: number;
  subfolder_count: number;
  size_bytes: number;
  children?: FolderNode[];
  expanded?: boolean;
}

interface FileItem {
  id: number;
  name: string;
  type: string;
  size: number;
  folder_id?: number;
}

interface FolderTreeProps {
  folders: FolderNode[];
  files: FileItem[];
  onFolderSelect?: (folder: FolderNode) => void;
  onFileMove?: (fileId: number, folderId: number | null) => void;
  onFolderCreate?: (parentId: number | null, name: string) => void;
  onFolderRename?: (folderId: number, name: string) => void;
  onFolderDelete?: (folderId: number) => void;
  selectedFolderId?: number | null;
  className?: string;
}

export default function FolderTree({
  folders,
  files,
  onFolderSelect,
  onFileMove,
  onFolderCreate,
  onFolderRename,
  onFolderDelete,
  selectedFolderId,
  className = ''
}: FolderTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [draggedItem, setDraggedItem] = useState<{ type: 'file' | 'folder'; id: number } | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'folder' | 'empty';
    folderId?: number;
  } | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderParentId, setNewFolderParentId] = useState<number | null>(null);

  // Build folder tree structure
  const buildTree = useCallback((folderList: FolderNode[]): FolderNode[] => {
    const folderMap = new Map<number, FolderNode>();
    const rootFolders: FolderNode[] = [];

    // Create map of all folders
    folderList.forEach(folder => {
      folderMap.set(folder.id, { ...folder, children: [] });
    });

    // Build tree structure
    folderList.forEach(folder => {
      const folderNode = folderMap.get(folder.id)!;
      if (folder.parent_id === null) {
        rootFolders.push(folderNode);
      } else {
        const parent = folderMap.get(folder.parent_id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(folderNode);
        }
      }
    });

    return rootFolders;
  }, []);

  const folderTree = buildTree(folders);

  const toggleFolder = (folderId: number) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const handleDragStart = (e: React.DragEvent, type: 'file' | 'folder', id: number) => {
    setDraggedItem({ type, id });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, folderId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folderId);
  };

  const handleDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleDrop = (e: React.DragEvent, targetFolderId: number | null) => {
    e.preventDefault();
    setDragOverFolder(null);

    if (!draggedItem) return;

    if (draggedItem.type === 'file' && onFileMove) {
      onFileMove(draggedItem.id, targetFolderId);
    } else if (draggedItem.type === 'folder' && draggedItem.id !== targetFolderId) {
      // Handle folder move (would need implementation)
      console.log('Move folder', draggedItem.id, 'to', targetFolderId);
    }

    setDraggedItem(null);
  };

  const handleContextMenu = (e: React.MouseEvent, type: 'folder' | 'empty', folderId?: number) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type,
      folderId
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim() && onFolderCreate) {
      onFolderCreate(newFolderParentId, newFolderName.trim());
      setNewFolderName('');
      setShowNewFolderInput(false);
      setNewFolderParentId(null);
    }
  };

  const handleRenameFolder = (folderId: number, newName: string) => {
    if (newName.trim() && onFolderRename) {
      onFolderRename(folderId, newName.trim());
    }
  };

  // Get files in folder
  const getFilesInFolder = (folderId: number | null): FileItem[] => {
    return files.filter(file => 
      folderId === null ? !file.folder_id : file.folder_id === folderId
    );
  };

  // Render folder node
  const renderFolder = (folder: FolderNode, level: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const isDragOver = dragOverFolder === folder.id;
    const folderFiles = getFilesInFolder(folder.id);

    return (
      <div key={folder.id} className="select-none">
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer hover:bg-slate-700/50 transition-colors ${
            isSelected ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-300'
          } ${isDragOver ? 'bg-indigo-500/20 border border-indigo-500/50' : ''}`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => onFolderSelect?.(folder)}
          onContextMenu={(e) => handleContextMenu(e, 'folder', folder.id)}
          draggable
          onDragStart={(e) => handleDragStart(e, 'folder', folder.id)}
          onDragOver={(e) => handleDragOver(e, folder.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, folder.id)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFolder(folder.id);
            }}
            className="p-0.5 hover:bg-slate-600/50 rounded transition-colors"
          >
            {folder.subfolder_count > 0 && (
              isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
            )}
          </button>
          
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-yellow-500" />
          ) : (
            <Folder className="w-4 h-4 text-yellow-500" />
          )}
          
          <span className="flex-1 text-sm truncate">{folder.name}</span>
          
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {folder.file_count > 0 && (
              <span className="bg-slate-600/50 px-1.5 py-0.5 rounded">
                {folder.file_count}
              </span>
            )}
            {folder.subfolder_count > 0 && (
              <span className="bg-slate-600/50 px-1.5 py-0.5 rounded">
                {folder.subfolder_count} folders
              </span>
            )}
          </div>
        </div>

        {/* Render children */}
        {isExpanded && folder.children && (
          <div>
            {folder.children.map(child => renderFolder(child, level + 1))}
            
            {/* Files in this folder */}
            {folderFiles.map(file => (
              <div
                key={file.id}
                className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-slate-700/50 transition-colors text-slate-400"
                style={{ paddingLeft: `${(level + 1) * 20 + 8}px` }}
                draggable
                onDragStart={(e) => handleDragStart(e, 'file', file.id)}
                onContextMenu={(e) => handleContextMenu(e, 'empty', folder.id)}
              >
                <File className="w-4 h-4 text-slate-500" />
                <span className="flex-1 text-sm truncate">{file.name}</span>
                <span className="text-xs text-slate-500">
                  {formatFileSize(file.size)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render root files (not in any folder)
  const rootFiles = getFilesInFolder(null);

  return (
    <div className={`folder-tree ${className}`}>
      {/* Root folder */}
      <div
        className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-slate-700/50 transition-colors mb-2 ${
          selectedFolderId === null ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-300'
        } ${dragOverFolder === 0 ? 'bg-indigo-500/20 border border-indigo-500/50' : ''}`}
        onClick={() => onFolderSelect?.({ id: 0, name: 'Root', parent_id: null, path: '/', created_at: '', updated_at: '', file_count: rootFiles.length, subfolder_count: folderTree.length, size_bytes: 0 })}
        onContextMenu={(e) => handleContextMenu(e, 'empty')}
        onDragOver={(e) => handleDragOver(e, 0)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, null)}
      >
        <Folder className="w-4 h-4 text-yellow-500" />
        <span className="flex-1 text-sm font-medium">Root</span>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {rootFiles.length > 0 && (
            <span className="bg-slate-600/50 px-1.5 py-0.5 rounded">
              {rootFiles.length}
            </span>
          )}
          {folderTree.length > 0 && (
            <span className="bg-slate-600/50 px-1.5 py-0.5 rounded">
              {folderTree.length} folders
            </span>
          )}
        </div>
      </div>

      {/* Root files */}
      {rootFiles.map(file => (
        <div
          key={file.id}
          className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-slate-700/50 transition-colors text-slate-400 mb-1"
          style={{ paddingLeft: '28px' }}
          draggable
          onDragStart={(e) => handleDragStart(e, 'file', file.id)}
        >
          <File className="w-4 h-4 text-slate-500" />
          <span className="flex-1 text-sm truncate">{file.name}</span>
          <span className="text-xs text-slate-500">
            {formatFileSize(file.size)}
          </span>
        </div>
      ))}

      {/* Folder tree */}
      {folderTree.map(folder => renderFolder(folder))}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed bg-slate-800 border border-slate-700 rounded-lg shadow-lg py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {contextMenu.type === 'folder' ? (
            <>
              <button
                className="w-full px-3 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-2"
                onClick={() => {
                  // Handle folder rename
                  const folder = folders.find(f => f.id === contextMenu.folderId);
                  if (folder) {
                    const newName = prompt('Enter new folder name:', folder.name);
                    if (newName) {
                      handleRenameFolder(contextMenu.folderId!, newName);
                    }
                  }
                  closeContextMenu();
                }}
              >
                Rename
              </button>
              <button
                className="w-full px-3 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-2"
                onClick={() => {
                  if (onFolderDelete && contextMenu.folderId) {
                    if (confirm('Are you sure you want to delete this folder?')) {
                      onFolderDelete(contextMenu.folderId);
                    }
                  }
                  closeContextMenu();
                }}
              >
                Delete
              </button>
            </>
          ) : (
            <button
              className="w-full px-3 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-2"
              onClick={() => {
                setNewFolderParentId(contextMenu.folderId || null);
                setShowNewFolderInput(true);
                closeContextMenu();
              }}
            >
              <Plus className="w-4 h-4" />
              New Folder
            </button>
          )}
        </div>
      )}

      {/* New folder input */}
      {showNewFolderInput && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-4 w-96 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-3">Create New Folder</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateFolder();
                } else if (e.key === 'Escape') {
                  setShowNewFolderInput(false);
                  setNewFolderName('');
                  setNewFolderParentId(null);
                }
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowNewFolderInput(false);
                  setNewFolderName('');
                  setNewFolderParentId(null);
                }}
                className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close context menu on click outside */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={closeContextMenu}
        />
      )}
    </div>
  );
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
