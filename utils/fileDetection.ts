/**
 * Smart File Detection Utilities
 * 
 * Detects valid data files based on:
 * 1. File naming conventions (type prefix + date)
 * 2. Metadata file presence
 * 3. File extension validation
 * 
 * Valid file formats:
 * - CSI: csi_YYYY-MM-DD_*.csv (with optional csi_YYYY-MM-DD_*.meta.json)
 * - IMU: imu_YYYY-MM-DD_*.json/jsonl/csv
 * - Image: img_YYYY-MM-DD_*.jpg/png/etc
 * - Video: vid_YYYY-MM-DD_*.mp4/avi/etc
 * - Audio: audio_YYYY-MM-DD_*.wav/mp3/etc
 * - Sensor: sensor_YYYY-MM-DD_*.csv/json
 */

export type DataFileType = 'csi' | 'imu' | 'image' | 'video' | 'audio' | 'sensor' | 'timelapse' | 'other';

export interface DataFileInfo {
  name: string;
  type: DataFileType;
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
  csi: {
    prefixes: ['csi_', 'csi-'],
    extensions: ['csv'],
    requiresMetadata: false,
  },
  imu: {
    prefixes: ['imu_', 'imu-'],
    extensions: ['json', 'jsonl', 'csv'],
    requiresMetadata: false,
  },
  image: {
    prefixes: ['img_', 'image_', 'img-', 'image-'],
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'heic'],
    requiresMetadata: false,
  },
  video: {
    prefixes: ['vid_', 'video_', 'vid-', 'video-'],
    extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm', 'm4v'],
    requiresMetadata: false,
  },
  audio: {
    prefixes: ['audio_', 'aud_', 'audio-', 'aud-'],
    extensions: ['wav', 'mp3', 'm4a', 'flac', 'ogg', 'aac'],
    requiresMetadata: false,
  },
  sensor: {
    prefixes: ['sensor_', 'mfcw_', 'radar_', 'sensor-'],
    extensions: ['csv', 'json', 'jsonl'],
    requiresMetadata: false,
  },
  timelapse: {
    prefixes: ['timelapse_', 'tl_', 'timelapse-'],
    extensions: ['mp4', 'avi', 'mov', 'zip'],
    requiresMetadata: false,
  },
  other: {
    prefixes: [],
    extensions: [],
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
export function detectFileType(filename: string): DataFileType {
  const lowerName = filename.toLowerCase();
  const extension = lowerName.split('.').pop() || '';
  
  // First check by extension (primary detection method)
  for (const [type, config] of Object.entries(FILE_TYPE_PATTERNS) as [DataFileType, typeof FILE_TYPE_PATTERNS[DataFileType]][]) {
    if (type === 'other') continue;
    if (config.extensions.includes(extension)) {
      // If has prefix, use that type specifically
      const hasPrefix = config.prefixes.some(prefix => lowerName.startsWith(prefix));
      if (hasPrefix) {
        return type;
      }
    }
  }
  
  // Fallback: detect by extension only
  for (const [type, config] of Object.entries(FILE_TYPE_PATTERNS) as [DataFileType, typeof FILE_TYPE_PATTERNS[DataFileType]][]) {
    if (type === 'other') continue;
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
  const type = detectFileType(filename);
  // Any recognized file type is valid
  return type !== 'other';
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
      if (types && types.length > 0 && !types.includes(f.type)) return false;
      
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
export function groupFilesByType(files: DataFileInfo[]): Map<DataFileType, DataFileInfo[]> {
  const groups = new Map<DataFileType, DataFileInfo[]>();
  
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
export function getFileTypeDisplayInfo(type: DataFileType): {
  label: string;
  color: string;
  bgColor: string;
} {
  const displayInfo: Record<DataFileType, { label: string; color: string; bgColor: string }> = {
    csi: { label: 'CSI', color: 'text-green-400', bgColor: 'bg-green-500/10' },
    imu: { label: 'IMU', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    image: { label: 'Image', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
    video: { label: 'Video', color: 'text-red-400', bgColor: 'bg-red-500/10' },
    audio: { label: 'Audio', color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
    sensor: { label: 'Sensor', color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
    timelapse: { label: 'Timelapse', color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
    other: { label: 'Other', color: 'text-slate-400', bgColor: 'bg-slate-500/10' },
  };
  
  return displayInfo[type] || displayInfo.other;
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
