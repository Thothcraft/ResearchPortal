/**
 * Smart File Detection Utilities
 * 
 * Detects valid data files based on extension.
 * 
 * Valid file formats (5 supported types):
 * - Image: *.jpg/jpeg/png/gif/bmp/webp/tiff/heic
 * - Audio: *.wav/mp3/m4a/flac/ogg/aac
 * - CSI:   *.csv (WiFi Channel State Information)
 * - Video: *.mp4/avi/mov/mkv/webm/m4v
 * - FMCW:  *.bin/dat/npy (radar data)
 */

export type DataFileType = 'image' | 'audio' | 'csi' | 'video' | 'fmcw';

export interface DataFileInfo {
  name: string;
  type: DataFileType | 'other';
  date: string | null;
  extension: string;
  hasMetadata: boolean;
  isValid: boolean;
  size: number;
  label?: string;
}

// File type configurations
const FILE_TYPE_PATTERNS: Record<DataFileType, {
  prefixes: string[];
  extensions: string[];
  requiresMetadata: boolean;
}> = {
  image: {
    prefixes: ['img_', 'image_', 'img-', 'image-'],
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'heic'],
    requiresMetadata: false,
  },
  audio: {
    prefixes: ['audio_', 'aud_', 'audio-', 'aud-'],
    extensions: ['wav', 'mp3', 'm4a', 'flac', 'ogg', 'aac'],
    requiresMetadata: false,
  },
  csi: {
    prefixes: ['csi_', 'csi-'],
    extensions: ['csv'],
    requiresMetadata: false,
  },
  video: {
    prefixes: ['vid_', 'video_', 'vid-', 'video-'],
    extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm', 'm4v'],
    requiresMetadata: false,
  },
  fmcw: {
    prefixes: ['fmcw_', 'radar_', 'fmcw-', 'radar-'],
    extensions: ['bin', 'dat', 'npy'],
    requiresMetadata: false,
  },
};

// Date pattern regex
const DATE_PATTERNS = [
  /(\d{4}-\d{2}-\d{2})/,  // YYYY-MM-DD
  /(\d{4}_\d{2}_\d{2})/,  // YYYY_MM_DD
  /(\d{8})/,              // YYYYMMDD
];

/**
 * Extract date from filename
 */
export function extractDateFromFilename(filename: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const match = filename.match(pattern);
    if (match) {
      let date = match[1];
      // Normalize to YYYY-MM-DD format
      if (date.includes('_')) {
        date = date.replace(/_/g, '-');
      } else if (date.length === 8 && !date.includes('-')) {
        date = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
      }
      return date;
    }
  }
  return null;
}

/**
 * Detect file type from filename - primarily by extension
 * No naming convention required
 */
export function detectFileType(filename: string): DataFileType | 'other' {
  const lowerName = filename.toLowerCase();
  const extension = lowerName.split('.').pop() || '';
  
  // First check by extension + prefix (most specific match)
  for (const [type, config] of Object.entries(FILE_TYPE_PATTERNS) as [DataFileType, typeof FILE_TYPE_PATTERNS[DataFileType]][]) {
    if (config.extensions.includes(extension)) {
      const hasPrefix = config.prefixes.some(prefix => lowerName.startsWith(prefix));
      if (hasPrefix) {
        return type;
      }
    }
  }
  
  // Fallback: detect by extension only
  for (const [type, config] of Object.entries(FILE_TYPE_PATTERNS) as [DataFileType, typeof FILE_TYPE_PATTERNS[DataFileType]][]) {
    if (config.extensions.includes(extension)) {
      return type;
    }
  }
  
  return 'other';
}

/**
 * Check if a file is a valid data file
 * No naming convention required - just needs a recognized extension
 */
export function isValidDataFile(filename: string): boolean {
  return detectFileType(filename) !== 'other';
}

/**
 * Extract label from filename
 * Uses the filename without extension as the label
 */
export function extractLabelFromFilename(filename: string): string | null {
  // Remove extension and use the base name as label
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
  return nameWithoutExt || null;
}

/**
 * Parse a file into DataFileInfo
 */
export function parseDataFile(
  filename: string,
  size: number = 0,
  metadataFiles?: Set<string>
): DataFileInfo {
  const type = detectFileType(filename);
  const date = extractDateFromFilename(filename);
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  const label = extractLabelFromFilename(filename);
  
  // Check for metadata file
  const metaFilename = filename.replace(/\.[^.]+$/, '.meta.json');
  const hasMetadata = metadataFiles?.has(metaFilename) || false;
  
  // Determine validity
  const isValid = isValidDataFile(filename);
  
  return {
    name: filename,
    type,
    date,
    extension,
    hasMetadata,
    isValid,
    size,
    label: label || undefined,
  };
}

/**
 * Filter and parse a list of files, returning only valid data files
 */
export function filterValidDataFiles(
  files: Array<{ name: string; size: number }>,
  options: {
    includeInvalid?: boolean;
    types?: DataFileType[];
    dateRange?: { start?: string; end?: string };
  } = {}
): DataFileInfo[] {
  const { includeInvalid = false, types, dateRange } = options;
  
  // Build set of metadata files for quick lookup
  const metadataFiles = new Set(
    files
      .filter(f => f.name.endsWith('.meta.json'))
      .map(f => f.name)
  );
  
  return files
    .filter(f => !f.name.endsWith('.meta.json')) // Exclude metadata files from main list
    .map(f => parseDataFile(f.name, f.size, metadataFiles))
    .filter(f => {
      // Filter by validity
      if (!includeInvalid && !f.isValid) return false;
      
      // Filter by type
      if (types && types.length > 0 && (f.type === 'other' || !types.includes(f.type as DataFileType))) return false;
      
      // Filter by date range
      if (dateRange && f.date) {
        if (dateRange.start && f.date < dateRange.start) return false;
        if (dateRange.end && f.date > dateRange.end) return false;
      }
      
      return true;
    });
}

/**
 * Group files by date
 */
export function groupFilesByDate(files: DataFileInfo[]): Map<string, DataFileInfo[]> {
  const groups = new Map<string, DataFileInfo[]>();
  
  files.forEach(file => {
    const date = file.date || 'unknown';
    if (!groups.has(date)) {
      groups.set(date, []);
    }
    groups.get(date)!.push(file);
  });
  
  return groups;
}

/**
 * Group files by type
 */
export function groupFilesByType(files: DataFileInfo[]): Map<DataFileType | 'other', DataFileInfo[]> {
  const groups = new Map<DataFileType | 'other', DataFileInfo[]>();
  
  files.forEach(file => {
    if (!groups.has(file.type)) {
      groups.set(file.type, []);
    }
    groups.get(file.type)!.push(file);
  });
  
  return groups;
}

/**
 * Get file type display info
 */
export function getFileTypeDisplayInfo(type: DataFileType | 'other'): {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
} {
  const displayInfo: Record<DataFileType | 'other', { label: string; color: string; bgColor: string; icon: string }> = {
    image: { label: 'Image', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', icon: '🖼️' },
    audio: { label: 'Audio', color: 'text-purple-400', bgColor: 'bg-purple-500/10', icon: '🎵' },
    csi: { label: 'CSI', color: 'text-green-400', bgColor: 'bg-green-500/10', icon: '📡' },
    video: { label: 'Video', color: 'text-red-400', bgColor: 'bg-red-500/10', icon: '🎬' },
    fmcw: { label: 'FMCW', color: 'text-cyan-400', bgColor: 'bg-cyan-500/10', icon: '📻' },
    other: { label: 'Other', color: 'text-slate-400', bgColor: 'bg-slate-500/10', icon: '📄' },
  };
  
  return displayInfo[type] ?? displayInfo.other;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
