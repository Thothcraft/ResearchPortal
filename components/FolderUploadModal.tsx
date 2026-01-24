'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  FolderUp,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
  Folder,
} from 'lucide-react';

interface FileWithPath {
  file: File;
  relativePath: string;
}

interface FolderUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: (folderId: number, folderName: string) => void;
  parentFolderId?: number | null;
}

export default function FolderUploadModal({
  isOpen,
  onClose,
  onUploadComplete,
  parentFolderId = null,
}: FolderUploadModalProps) {
  const [files, setFiles] = useState<FileWithPath[]>([]);
  const [folderName, setFolderName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'error'>('idle');
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processedFiles, setProcessedFiles] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [successfulFiles, setSuccessfulFiles] = useState(0);
  const [failedFiles, setFailedFiles] = useState(0);
  
  const folderInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleFolderSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const fileList: FileWithPath[] = [];
    let detectedFolderName = '';

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      // Get relative path from webkitRelativePath
      const relativePath = (file as any).webkitRelativePath || file.name;
      
      // Extract folder name from first file's path
      if (i === 0 && relativePath.includes('/')) {
        detectedFolderName = relativePath.split('/')[0];
      }

      // Skip hidden files and system files
      if (file.name.startsWith('.') || file.name === 'Thumbs.db' || file.name === 'desktop.ini') {
        continue;
      }

      fileList.push({
        file,
        relativePath,
      });
    }

    setFiles(fileList);
    if (detectedFolderName && !folderName) {
      setFolderName(detectedFolderName);
    }
    setErrorMessage(null);
  }, [folderName]);

  const pollUploadStatus = useCallback(async (uploadIdToCheck: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-d7d37.up.railway.app';
      
      const response = await fetch(`${apiUrl}/folders/upload-status/${uploadIdToCheck}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to get upload status');
      }
      
      const data = await response.json();
      
      setProcessedFiles(data.processed_files);
      setTotalFiles(data.total_files);
      setSuccessfulFiles(data.successful_files);
      setFailedFiles(data.failed_files);
      setUploadProgress(data.progress_percent);
      
      if (data.status === 'completed') {
        setUploadStatus('completed');
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        // Notify parent after a short delay
        setTimeout(() => {
          onUploadComplete(data.folder_id, data.folder_name);
        }, 1500);
      } else if (data.status === 'failed') {
        setUploadStatus('error');
        setErrorMessage(data.errors?.join(', ') || 'Upload failed');
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    } catch (error) {
      console.error('Error polling upload status:', error);
    }
  }, [onUploadComplete]);

  const handleUpload = async () => {
    if (!folderName.trim() || files.length === 0) {
      setErrorMessage('Please select a folder and provide a name');
      return;
    }

    setIsUploading(true);
    setUploadStatus('uploading');
    setErrorMessage(null);
    setUploadProgress(0);
    setTotalFiles(files.length);
    setProcessedFiles(0);
    setSuccessfulFiles(0);
    setFailedFiles(0);

    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-d7d37.up.railway.app';

      // First create the folder
      const folderResponse = await fetch(`${apiUrl}/folders/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: folderName.trim(),
          parent_id: parentFolderId,
          description: `Uploaded folder with ${files.length} files`,
        }),
      });

      if (!folderResponse.ok) {
        const errorData = await folderResponse.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to create folder');
      }

      const folderResult = await folderResponse.json();
      const folderId = folderResult.id;

      setUploadStatus('processing');

      // Upload files one by one using FormData (handles large files efficiently)
      let successful = 0;
      let failed = 0;
      const errors: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const { file, relativePath } = files[i];
        
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('folder_id', folderId.toString());
          
          // Labels: filename (without ext) + folder name
          const filenameWithoutExt = file.name.replace(/\.[^.]+$/, '');
          const labels = [filenameWithoutExt, folderName.trim()];
          formData.append('labels', JSON.stringify(labels));
          formData.append('relative_path', relativePath);

          const uploadResponse = await fetch(`${apiUrl}/file/upload-multipart`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            body: formData,
          });

          if (uploadResponse.ok) {
            successful++;
          } else {
            failed++;
            const errData = await uploadResponse.json().catch(() => ({}));
            errors.push(`${file.name}: ${errData.detail || 'Upload failed'}`);
          }
        } catch (fileError) {
          failed++;
          errors.push(`${file.name}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
        }

        setProcessedFiles(i + 1);
        setSuccessfulFiles(successful);
        setFailedFiles(failed);
        setUploadProgress(((i + 1) / files.length) * 100);
      }

      if (failed === 0) {
        setUploadStatus('completed');
        setTimeout(() => {
          onUploadComplete(folderId, folderName.trim());
        }, 1500);
      } else if (successful === 0) {
        setUploadStatus('error');
        setErrorMessage(errors.slice(0, 5).join('\n'));
      } else {
        // Partial success
        setUploadStatus('completed');
        setErrorMessage(`${failed} file(s) failed to upload`);
        setTimeout(() => {
          onUploadComplete(folderId, folderName.trim());
        }, 2000);
      }

    } catch (error) {
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed');
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setFiles([]);
    setFolderName('');
    setIsUploading(false);
    setUploadProgress(0);
    setUploadStatus('idle');
    setUploadId(null);
    setErrorMessage(null);
    setProcessedFiles(0);
    setTotalFiles(0);
    setSuccessfulFiles(0);
    setFailedFiles(0);
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalSize = files.reduce((sum, f) => sum + f.file.size, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <FolderUp className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-semibold text-white">Upload Folder</h3>
          </div>
          <button
            onClick={handleClose}
            disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Upload Status Display */}
          {uploadStatus !== 'idle' && (
            <div className={`p-4 rounded-lg border ${
              uploadStatus === 'completed' ? 'bg-green-500/10 border-green-500/30' :
              uploadStatus === 'error' ? 'bg-red-500/10 border-red-500/30' :
              'bg-indigo-500/10 border-indigo-500/30'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                {uploadStatus === 'uploading' && <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />}
                {uploadStatus === 'processing' && <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />}
                {uploadStatus === 'completed' && <CheckCircle className="w-5 h-5 text-green-400" />}
                {uploadStatus === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
                <span className={`font-medium ${
                  uploadStatus === 'completed' ? 'text-green-400' :
                  uploadStatus === 'error' ? 'text-red-400' :
                  'text-indigo-400'
                }`}>
                  {uploadStatus === 'uploading' && 'Uploading files...'}
                  {uploadStatus === 'processing' && `Processing files (${processedFiles}/${totalFiles})...`}
                  {uploadStatus === 'completed' && `Upload complete! ${successfulFiles} files uploaded.`}
                  {uploadStatus === 'error' && 'Upload failed'}
                </span>
              </div>
              
              {/* Progress bar */}
              {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div 
                    className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
              
              {/* Stats */}
              {uploadStatus === 'completed' && failedFiles > 0 && (
                <p className="text-yellow-400 text-sm mt-2">
                  {failedFiles} file(s) failed to upload
                </p>
              )}
              
              {errorMessage && (
                <p className="text-red-400 text-sm mt-2">{errorMessage}</p>
              )}
            </div>
          )}

          {/* Folder Selection */}
          {uploadStatus === 'idle' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Select Folder
                </label>
                <input
                  ref={folderInputRef}
                  type="file"
                  // @ts-ignore - webkitdirectory is not in standard types
                  webkitdirectory=""
                  directory=""
                  multiple
                  onChange={handleFolderSelect}
                  className="hidden"
                />
                <button
                  onClick={() => folderInputRef.current?.click()}
                  className="w-full p-8 border-2 border-dashed border-slate-600 rounded-lg hover:border-indigo-500 transition-colors flex flex-col items-center gap-3"
                >
                  <Folder className="w-12 h-12 text-slate-500" />
                  <span className="text-slate-400">Click to select a folder</span>
                  <span className="text-slate-500 text-sm">All files in the folder will be uploaded</span>
                </button>
              </div>

              {/* Folder Name */}
              {files.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Folder Name (used as label for all files)
                  </label>
                  <input
                    type="text"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="Enter folder name..."
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {/* Selected Files Preview */}
              {files.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-300">
                      Selected Files ({files.length})
                    </label>
                    <span className="text-sm text-slate-500">
                      Total: {formatFileSize(totalSize)}
                    </span>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg border border-slate-700 max-h-48 overflow-y-auto">
                    {files.slice(0, 50).map((f, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 border-b border-slate-700/50 last:border-0">
                        <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span className="text-sm text-slate-300 truncate flex-1">{f.relativePath}</span>
                        <span className="text-xs text-slate-500">{formatFileSize(f.file.size)}</span>
                      </div>
                    ))}
                    {files.length > 50 && (
                      <div className="px-3 py-2 text-center text-sm text-slate-500">
                        ... and {files.length - 50} more files
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <p className="text-red-400 text-sm">{errorMessage}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-slate-700">
          {uploadStatus === 'idle' ? (
            <>
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={files.length === 0 || !folderName.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                Upload {files.length} Files
              </button>
            </>
          ) : uploadStatus === 'completed' ? (
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              Done
            </button>
          ) : uploadStatus === 'error' ? (
            <>
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setUploadStatus('idle');
                  setErrorMessage(null);
                }}
                className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                Try Again
              </button>
            </>
          ) : (
            <div className="flex-1 text-center text-slate-400">
              Please wait while files are being processed...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
