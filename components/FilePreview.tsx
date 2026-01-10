/** File preview component for images, videos, and CSV files */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCw, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';

interface FilePreviewProps {
  file: {
    id: number;
    name: string;
    type: string;
    size: number;
    extension: string;
    url?: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onDownload?: () => void;
}

type PreviewType = 'image' | 'video' | 'csv' | 'text' | 'unknown';

export default function FilePreview({ file, isOpen, onClose, onDownload }: FilePreviewProps) {
  const [previewType, setPreviewType] = useState<PreviewType>('unknown');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [imageScale, setImageScale] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Determine preview type based on file extension
  useEffect(() => {
    const ext = file.extension.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) {
      setPreviewType('image');
    } else if (['mp4', 'avi', 'mov', 'mkv', 'webm', 'ogg'].includes(ext)) {
      setPreviewType('video');
    } else if (['csv', 'tsv'].includes(ext)) {
      setPreviewType('csv');
    } else if (['txt', 'json', 'xml', 'log', 'md'].includes(ext)) {
      setPreviewType('text');
    } else {
      setPreviewType('unknown');
    }
  }, [file.extension]);

  // Load preview content
  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    setError('');

    const loadPreview = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          throw new Error('Authentication required');
        }

        // Get file URL or use provided URL
        const url = file.url || `${process.env.NEXT_PUBLIC_API_URL || 'https://web-production-d7d37.up.railway.app'}/file/${file.id}`;
        
        if (previewType === 'image' || previewType === 'video') {
          // For images and videos, we can use the URL directly
          setPreviewUrl(url);
        } else if (previewType === 'csv') {
          // For CSV, fetch and parse the data
          const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (!response.ok) throw new Error('Failed to load file');
          
          const text = await response.text();
          parseCSV(text);
        } else if (previewType === 'text') {
          // For text files, fetch the content
          const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (!response.ok) throw new Error('Failed to load file');
          
          const text = await response.text();
          setPreviewUrl(`data:text/plain;base64,${btoa(text)}`);
        }
        
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preview');
        setIsLoading(false);
      }
    };

    loadPreview();
  }, [isOpen, file, previewType]);

  // Parse CSV data
  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return;

    // Parse headers (first line)
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    setCsvHeaders(headers);

    // Parse data rows
    const data = lines.slice(1, 101).map(line => 
      line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
    );
    setCsvData(data);
  };

  // Image controls
  const handleZoomIn = () => setImageScale(prev => Math.min(prev * 1.2, 5));
  const handleZoomOut = () => setImageScale(prev => Math.max(prev / 1.2, 0.1));
  const handleRotate = () => setImageRotation(prev => (prev + 90) % 360);
  const resetImage = () => {
    setImageScale(1);
    setImageRotation(0);
  };

  // Video controls
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const skip = (seconds: number) => {
    if (videoRef.current) {
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
      handleSeek(newTime);
    }
  };

  // Format time for video
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
      <div className="relative w-full h-full max-w-6xl max-h-screen bg-slate-900 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white truncate">{file.name}</h2>
            <p className="text-sm text-slate-400">{formatFileSize(file.size)} • {file.extension.toUpperCase()}</p>
          </div>
          
          <div className="flex items-center gap-2">
            {onDownload && (
              <button
                onClick={onDownload}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-300"
                title="Download"
              >
                <Download className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-300"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <div className="text-red-400 mb-4">Failed to load preview</div>
              <p className="text-slate-400 text-sm">{error}</p>
            </div>
          ) : (
            <>
              {previewType === 'image' && (
                <div className="flex flex-col items-center justify-center p-8">
                  <div className="mb-4 flex gap-2">
                    <button
                      onClick={handleZoomOut}
                      className="p-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors text-white"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleZoomIn}
                      className="p-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors text-white"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleRotate}
                      className="p-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors text-white"
                      title="Rotate"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={resetImage}
                      className="p-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors text-white"
                      title="Reset"
                    >
                      Reset
                    </button>
                  </div>
                  
                  <div className="overflow-auto max-w-full max-h-96 border border-slate-700 rounded">
                    <img
                      ref={imageRef}
                      src={previewUrl}
                      alt={file.name}
                      className="max-w-none"
                      style={{
                        transform: `scale(${imageScale}) rotate(${imageRotation}deg)`,
                        transition: 'transform 0.2s ease'
                      }}
                    />
                  </div>
                </div>
              )}

              {previewType === 'video' && (
                <div className="flex flex-col p-4">
                  <div className="flex-1 flex items-center justify-center bg-black rounded">
                    <video
                      ref={videoRef}
                      src={previewUrl}
                      className="max-w-full max-h-96"
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onLoadedMetadata={(e) => {
                        const video = e.target as HTMLVideoElement;
                        setDuration(video.duration);
                      }}
                      onTimeUpdate={(e) => {
                        const video = e.target as HTMLVideoElement;
                        setCurrentTime(video.currentTime);
                      }}
                    />
                  </div>
                  
                  {/* Video Controls */}
                  <div className="mt-4 bg-slate-800 rounded-lg p-4">
                    <div className="flex items-center gap-4 mb-3">
                      <button
                        onClick={togglePlay}
                        className="p-2 bg-indigo-600 hover:bg-indigo-700 rounded-full transition-colors text-white"
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      
                      <button
                        onClick={() => skip(-10)}
                        className="p-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors text-white"
                      >
                        <SkipBack className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => skip(10)}
                        className="p-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors text-white"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                      
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-white text-sm">{formatTime(currentTime)}</span>
                        <div className="flex-1 bg-slate-600 rounded-full h-2">
                          <div
                            className="bg-indigo-500 h-2 rounded-full transition-all"
                            style={{ width: `${(currentTime / duration) * 100}%` }}
                          />
                        </div>
                        <span className="text-white text-sm">{formatTime(duration)}</span>
                      </div>
                      
                      <button
                        onClick={() => handleVolumeChange(volume === 0 ? 1 : 0)}
                        className="p-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors text-white"
                      >
                        {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                    </div>
                    
                    <input
                      type="range"
                      min="0"
                      max={duration}
                      value={currentTime}
                      onChange={(e) => handleSeek(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              {previewType === 'csv' && (
                <div className="p-4">
                  <div className="mb-4 text-slate-300">
                    <p>Showing first {csvData.length} rows of CSV data</p>
                  </div>
                  
                  <div className="overflow-auto max-h-96 border border-slate-700 rounded">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800 sticky top-0">
                        <tr>
                          {csvHeaders.map((header, index) => (
                            <th key={index} className="px-4 py-2 text-left text-slate-300 border-b border-slate-700">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.map((row, rowIndex) => (
                          <tr key={rowIndex} className="hover:bg-slate-800/50">
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex} className="px-4 py-2 text-slate-400 border-b border-slate-700/50">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {csvData.length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                      No data to display
                    </div>
                  )}
                </div>
              )}

              {previewType === 'text' && (
                <div className="p-4">
                  <div className="bg-slate-800 rounded p-4 max-h-96 overflow-auto">
                    <pre className="text-sm text-slate-300 whitespace-pre-wrap">
                      <iframe
                        src={previewUrl}
                        className="w-full h-96 border-0"
                        title={file.name}
                      />
                    </pre>
                  </div>
                </div>
              )}

              {previewType === 'unknown' && (
                <div className="flex flex-col items-center justify-center h-96 text-center">
                  <div className="text-slate-400 mb-4">Preview not available</div>
                  <p className="text-slate-500 text-sm">
                    This file type cannot be previewed. Please download the file to view its contents.
                  </p>
                  {onDownload && (
                    <button
                      onClick={onDownload}
                      className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                    >
                      Download File
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
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
