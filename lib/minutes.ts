import fs from 'fs';
import path from 'path';

export const MINUTES_DATA_DIR = process.env.THOTH_DATA_DIR || '/home/pi/Desktop/thoth/data';
export const MINUTE_RE = /^\d{8}_\d{4}$/;
export const MINUTE_ID_RE = /^(?:(?<label>[^/\\]+)__)?(?<minute>\d{8}_\d{4})$/;

export type MinuteFiles = {
  video: boolean;
  radar: boolean;
  xy_tracking?: boolean;
  csi: boolean;
  manifest: boolean;
  predictions: boolean;
};

export type MinuteSummary = {
  minute: string;
  minuteName: string;
  relativePath: string;
  path: string;
  modified: string;
  created: string;
  deviceKey: string;
  deviceLabel: string;
  labels: string[];
  completed: boolean;
  state: 'ready' | 'collecting';
  uploaded: boolean;
  files: MinuteFiles;
  sizes: Record<string, number>;
  progress?: {
    expectedChunks: number;
    storedChunks: number;
    analyzedChunks: number;
    storagePercent: number;
    predictionPercent: number;
    chunkSeconds?: number | null;
    chunks: Array<{
      index: number;
      state: 'waiting' | 'analyzing' | 'occupied' | 'empty' | 'error';
      stored: boolean;
      analyzed: boolean;
      prediction?: unknown;
      location?: any;
    }>;
  };
  dataFiles?: MinuteDataFile[];
  manifest?: any;
};

export type MinuteDetail = MinuteSummary & {
  filePaths: Record<string, string | null>;
  previews: Record<string, string>;
  predictions?: any;
};

export type MinuteDataFile = {
  filename: string;
  relativePath: string;
  path: string;
  size: number;
  modified: string;
  contentType: string;
};

export type PredictionTimelineEntry = {
  minute: string;
  minuteName: string;
  generated_at?: string;
  labels: string[];
  model_name: string;
  data_type?: string;
  prediction?: string | number | boolean | null;
  probability?: number | null;
  confidence?: number | null;
  status?: string;
  error?: string;
  [key: string]: any;
};

export type LabeledMinuteGroup = {
  label: string;
  minutes: Array<MinuteSummary & {
    fileCount: number;
    totalSize: number;
    files: MinuteDataFile[];
  }>;
  minuteCount: number;
  fileCount: number;
  totalSize: number;
};

const MINUTE_UPLOAD_SKIP_NAMES = new Set(['manifest.json', 'predictions.json', 'cloud_upload.json']);
const MINUTE_UPLOAD_EXTENSIONS = new Set(['.dat', '.bin', '.csv', '.jsonl', '.json', '.mp4']);

function readTextPreview(filePath: string | null, limit = 12000): string {
  if (!filePath || !fs.existsSync(filePath)) return '';
  try {
    return fs.readFileSync(filePath, 'utf8').slice(0, limit);
  } catch {
    return '';
  }
}

function readJsonPreview(filePath: string | null): any {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function normalizeDeviceValue(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeLabelValue(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^,+|,+$/g, '');
}

function extractLabels(manifest: any): string[] {
  const labels = Array.isArray(manifest?.labels) ? manifest.labels : [];
  const cleaned: string[] = [];
  for (const label of labels) {
    const value = normalizeLabelValue(label);
    if (value && !cleaned.includes(value)) {
      cleaned.push(value);
    }
  }
  return cleaned;
}

function labelsFromMinutePath(relativePath: string): string[] {
  const parts = relativePath.split(path.sep).filter(Boolean);
  if (parts.length >= 2 && MINUTE_RE.test(parts[1])) return [parts[0]];
  return [];
}

function minuteIdFor(relativePath: string): string {
  const parts = relativePath.split(path.sep).filter(Boolean);
  if (parts.length >= 2 && MINUTE_RE.test(parts[1])) return `${parts[0]}__${parts[1]}`;
  return parts[0] || relativePath;
}

function extractDeviceInfo(manifest: any, minuteDir: string): { deviceKey: string; deviceLabel: string; uploaded: boolean } {
  const candidates = [
    manifest?.device_name,
    manifest?.device_id,
    manifest?.host,
    manifest?.outputs?.video?.device,
    manifest?.outputs?.radar?.device,
    manifest?.outputs?.wifi?.device,
  ].filter(Boolean);
  const deviceLabel = String(candidates[0] || manifest?.host || path.basename(minuteDir) || 'unknown');
  const deviceKey = normalizeDeviceValue(candidates[0] || manifest?.host || manifest?.device_id || deviceLabel);
  const uploaded = Boolean(
    manifest?.uploaded_at ||
    manifest?.cloud_uploaded_at ||
    manifest?.upload?.uploaded_at ||
    manifest?.upload?.status === 'uploaded' ||
    manifest?.cloud?.uploaded ||
    manifest?.outputs?.video?.cloud_file_id ||
    manifest?.outputs?.radar?.cloud_file_id ||
    manifest?.outputs?.wifi?.cloud_file_id ||
    fs.existsSync(path.join(minuteDir, 'cloud_upload.json')) ||
    fs.existsSync(path.join(minuteDir, '.uploaded'))
  );
  return { deviceKey, deviceLabel, uploaded };
}

function getMinutePaths(minuteDir: string) {
  const names = fs.existsSync(minuteDir) ? fs.readdirSync(minuteDir) : [];
  const radarBins = names.filter((name) => name.startsWith('mmw_radar_raw_') && name.endsWith('.bin')).sort();
  const radarCsvs = names.filter((name) => name.startsWith('mmw_radar_xy_') && name.endsWith('.csv')).sort();
  return {
    video: names.includes('usb_camera.mp4') ? path.join(minuteDir, 'usb_camera.mp4') : null,
    radar: radarBins.length ? path.join(minuteDir, radarBins[0]) : null,
    radarBins: radarBins.map((name) => path.join(minuteDir, name)),
    radarCsvs: radarCsvs.map((name) => path.join(minuteDir, name)),
    xyTracking: names.includes('xy-tracking.json') ? path.join(minuteDir, 'xy-tracking.json') : null,
    csiCsv: names.includes('wifi_csi_raw.csv') ? path.join(minuteDir, 'wifi_csi_raw.csv') : null,
    csiTimestamped: names.includes('wifi_csi_timestamped.csv') ? path.join(minuteDir, 'wifi_csi_timestamped.csv') : null,
    csiSerial: names.includes('wifi_csi_serial_all.jsonl') ? path.join(minuteDir, 'wifi_csi_serial_all.jsonl') : null,
    manifest: names.includes('manifest.json') ? path.join(minuteDir, 'manifest.json') : null,
    predictions: names.includes('predictions.json') ? path.join(minuteDir, 'predictions.json') : null,
    ffmpegLog: names.includes('usb_camera.ffmpeg.log') ? path.join(minuteDir, 'usb_camera.ffmpeg.log') : null,
  };
}

function getMinuteProgress(paths: ReturnType<typeof getMinutePaths>, manifest: any): MinuteSummary['progress'] {
  const radarBins = Array.isArray(paths.radarBins) ? paths.radarBins : [];
  const radarCsvs = Array.isArray(paths.radarCsvs) ? paths.radarCsvs : [];
  const predictions = paths.predictions && fs.existsSync(paths.predictions) ? readJsonPreview(paths.predictions) : null;
  const expectedChunks = Number(manifest?.expected_chunks || 0) || Math.max(radarBins.length, radarCsvs.length, Array.isArray(predictions?.timeline) ? predictions.timeline.length : 0, 1);
  const storedChunks = Math.min(radarBins.length, radarCsvs.length);
  const analyzedChunks = Array.isArray(predictions?.timeline) ? predictions.timeline.length : 0;
  const predictionByIndex = new Map<number, any>((predictions?.timeline || []).map((entry: any): [number, any] => [Number(entry?.chunk_index), entry]));
  const manifestByIndex = new Map<number, any>((manifest?.outputs?.radar?.chunks || []).map((entry: any): [number, any] => [Number(entry?.chunk_index), entry]));
  const chunks = Array.from({ length: expectedChunks }, (_, index) => {
    const prediction = predictionByIndex.get(index);
    const recorded = index < storedChunks;
    const manifestChunk = manifestByIndex.get(index);
    const state = manifestChunk?.status === 'error'
      ? 'error'
      : prediction
        ? (prediction.occupied === true ? 'occupied' : 'empty')
        : recorded ? 'analyzing' : 'waiting';
    return { index, state, stored: recorded, analyzed: Boolean(prediction), prediction: prediction?.prediction, location: prediction?.location };
  });
  return {
    expectedChunks,
    storedChunks,
    analyzedChunks,
    storagePercent: Math.min(100, (storedChunks / expectedChunks) * 100),
    predictionPercent: Math.min(100, (analyzedChunks / expectedChunks) * 100),
    chunkSeconds: Number(manifest?.chunk_seconds || 0) || null,
    chunks,
  };
}

function contentTypeForMinuteFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') return 'text/csv';
  if (ext === '.json') return 'application/json';
  if (ext === '.jsonl') return 'application/x-ndjson';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.bin' || ext === '.dat') return 'application/octet-stream';
  return 'application/octet-stream';
}

export function listMinuteSummaries(): MinuteSummary[] {
  if (!fs.existsSync(MINUTES_DATA_DIR)) return [];

  const minutes: MinuteSummary[] = [];
  const candidateDirs: Array<{ dir: string; relativePath: string; minuteName: string }> = [];
  for (const item of fs.readdirSync(MINUTES_DATA_DIR)) {
    if (item === 'config' || item.startsWith('.')) continue;
    const itemPath = path.join(MINUTES_DATA_DIR, item);
    if (!fs.statSync(itemPath).isDirectory()) continue;
    if (MINUTE_RE.test(item)) {
      candidateDirs.push({ dir: itemPath, relativePath: item, minuteName: item });
      continue;
    }
    for (const child of fs.readdirSync(itemPath)) {
      const childPath = path.join(itemPath, child);
      if (fs.statSync(childPath).isDirectory() && MINUTE_RE.test(child)) {
        candidateDirs.push({ dir: childPath, relativePath: path.join(item, child), minuteName: child });
      }
    }
  }

  for (const candidate of candidateDirs) {
    const minuteDir = candidate.dir;
    const stat = fs.statSync(minuteDir);
    const paths = getMinutePaths(minuteDir);
    const manifest = readJsonPreview(paths.manifest);
    const deviceInfo = extractDeviceInfo(manifest, minuteDir);
    const labels = Array.from(new Set([...labelsFromMinutePath(candidate.relativePath), ...extractLabels(manifest)]));
    const completed = Boolean(manifest?.capture_finished);
    const minute = minuteIdFor(candidate.relativePath);
    const progress = getMinuteProgress(paths, manifest);
    minutes.push({
      minute,
      minuteName: candidate.minuteName,
      relativePath: candidate.relativePath,
      path: minuteDir,
      modified: stat.mtime.toISOString(),
      created: stat.birthtime.toISOString(),
      deviceKey: deviceInfo.deviceKey,
      deviceLabel: deviceInfo.deviceLabel,
      labels,
      completed,
      state: completed ? 'ready' : 'collecting',
      uploaded: deviceInfo.uploaded,
      files: {
        video: !!paths.video,
        radar: !!paths.radar,
        xy_tracking: !!paths.xyTracking,
        csi: !!(paths.csiCsv || paths.csiTimestamped || paths.csiSerial),
        manifest: !!paths.manifest,
        predictions: !!paths.predictions,
      },
      sizes: {
        video: paths.video ? fs.statSync(paths.video).size : 0,
        radar: paths.radar ? fs.statSync(paths.radar).size : 0,
        csi_csv: paths.csiCsv ? fs.statSync(paths.csiCsv).size : 0,
        csi_timestamped: paths.csiTimestamped ? fs.statSync(paths.csiTimestamped).size : 0,
        csi_serial: paths.csiSerial ? fs.statSync(paths.csiSerial).size : 0,
      },
      progress,
      dataFiles: listMinuteDataFiles(minuteDir),
      manifest,
    });
  }

  minutes.sort((a, b) => b.minute.localeCompare(a.minute));
  return minutes;
}

export function getMinuteSummary(minute: string): MinuteSummary | null {
  return listMinuteSummaries().find((m) => m.minute === minute) || null;
}

export function getMinuteDetail(minute: string): MinuteDetail | null {
  const existingSummary = getMinuteSummary(minute);
  const parsed = MINUTE_ID_RE.exec(minute);
  if (!existingSummary && !parsed) return null;
  const minuteName = existingSummary?.minuteName || parsed?.groups?.minute || minute;
  const minuteDir = existingSummary?.path || path.join(MINUTES_DATA_DIR, minuteName);
  if (!fs.existsSync(minuteDir) || !fs.statSync(minuteDir).isDirectory()) return null;

  const stat = fs.statSync(minuteDir);
  const paths = getMinutePaths(minuteDir);
  const manifest = readJsonPreview(paths.manifest);
  const deviceInfo = extractDeviceInfo(manifest, minuteDir);
  const relativePath = existingSummary?.relativePath || minuteName;
  const labels = Array.from(new Set([...labelsFromMinutePath(relativePath), ...extractLabels(manifest)]));
  const completed = Boolean(manifest?.capture_finished);
  const progress = getMinuteProgress(paths, manifest);
  const summary = existingSummary || {
    minute,
    minuteName,
    relativePath,
    path: minuteDir,
    modified: stat.mtime.toISOString(),
    created: stat.birthtime.toISOString(),
    deviceKey: deviceInfo.deviceKey,
    deviceLabel: deviceInfo.deviceLabel,
    labels,
    completed,
    state: completed ? 'ready' : 'collecting',
    uploaded: deviceInfo.uploaded,
      files: {
        video: !!paths.video,
        radar: !!paths.radar,
        xy_tracking: !!paths.xyTracking,
        csi: !!(paths.csiCsv || paths.csiTimestamped || paths.csiSerial),
        manifest: !!paths.manifest,
        predictions: !!paths.predictions,
      },
    sizes: {
      video: paths.video ? fs.statSync(paths.video).size : 0,
      radar: paths.radar ? fs.statSync(paths.radar).size : 0,
      csi_csv: paths.csiCsv ? fs.statSync(paths.csiCsv).size : 0,
        csi_timestamped: paths.csiTimestamped ? fs.statSync(paths.csiTimestamped).size : 0,
      csi_serial: paths.csiSerial ? fs.statSync(paths.csiSerial).size : 0,
    },
    progress,
    manifest,
  };

  return {
    ...summary,
    filePaths: {
      video: paths.video,
      radar: paths.radar,
      xy_tracking: paths.xyTracking,
      csi_csv: paths.csiCsv,
      csi_timestamped: paths.csiTimestamped,
      csi_serial: paths.csiSerial,
        manifest: paths.manifest,
      predictions: paths.predictions,
      ffmpeg_log: paths.ffmpegLog,
    },
    predictions: readJsonPreview(paths.predictions),
      previews: {
        csi_csv: readTextPreview(paths.csiCsv),
        csi_timestamped: readTextPreview(paths.csiTimestamped),
        csi_serial: readTextPreview(paths.csiSerial),
        xy_tracking: readTextPreview(paths.xyTracking),
        ffmpeg_log: readTextPreview(paths.ffmpegLog),
        manifest: paths.manifest ? JSON.stringify(readJsonPreview(paths.manifest), null, 2) : '',
        predictions: paths.predictions ? JSON.stringify(readJsonPreview(paths.predictions), null, 2) : '',
      },
  };
}

export function listMinuteDataFiles(minuteDir: string): MinuteDataFile[] {
  if (!fs.existsSync(minuteDir) || !fs.statSync(minuteDir).isDirectory()) return [];

  return fs.readdirSync(minuteDir)
    .sort()
    .map((filename) => path.join(minuteDir, filename))
    .filter((filePath) => fs.existsSync(filePath) && fs.statSync(filePath).isFile())
    .filter((filePath) => {
      const filename = path.basename(filePath);
      if (filename.startsWith('.')) return false;
      if (MINUTE_UPLOAD_SKIP_NAMES.has(filename)) return false;
      const ext = path.extname(filename).toLowerCase();
      return MINUTE_UPLOAD_EXTENSIONS.has(ext);
    })
    .map((filePath) => {
      const stat = fs.statSync(filePath);
      return {
        filename: path.basename(filePath),
        relativePath: path.relative(MINUTES_DATA_DIR, filePath).split(path.sep).join('/'),
        path: filePath,
        size: stat.size,
        modified: stat.mtime.toISOString(),
        contentType: contentTypeForMinuteFile(filePath),
      };
    });
}

export function listLabeledMinuteGroups(): LabeledMinuteGroup[] {
  const groups = new Map<string, LabeledMinuteGroup>();

  for (const minute of listMinuteSummaries()) {
    if (!minute.labels.length) continue;
    const detail = getMinuteDetail(minute.minute);
    const files = detail
      ? listMinuteDataFiles(detail.path)
      : listMinuteDataFiles(minute.path);
    const fileCount = files.length;
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    for (const label of minute.labels) {
      const existing = groups.get(label) || {
        label,
        minutes: [],
        minuteCount: 0,
        fileCount: 0,
        totalSize: 0,
      };

      existing.minutes.push({
        ...minute,
        fileCount,
        totalSize,
        files,
      });
      existing.minuteCount += 1;
      existing.fileCount += fileCount;
      existing.totalSize += totalSize;
      groups.set(label, existing);
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      minutes: group.minutes.sort((a, b) => b.minute.localeCompare(a.minute)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function normalizePredictionLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeLabelValue(item))
    .filter(Boolean);
}

export function collectPredictionTimelines(): Record<string, PredictionTimelineEntry[]> {
  const timelines: Record<string, PredictionTimelineEntry[]> = {};

  for (const minute of listMinuteSummaries()) {
    const predictionPath = path.join(minute.path, 'predictions.json');
    const prediction = readJsonPreview(predictionPath);
    if (!prediction || typeof prediction !== 'object') continue;

    const generatedAt = prediction.generated_at;
    const labels = Array.from(new Set([...minute.labels, ...normalizePredictionLabels(prediction.labels)]));
    const deployedModels = Array.isArray(prediction.deployed_models) ? prediction.deployed_models : [];
    const timeline = Array.isArray(prediction.timeline) ? prediction.timeline : [];
    const entries = timeline.length ? timeline : deployedModels;

    if (entries.length) {
      for (const item of entries) {
        if (!item || typeof item !== 'object') continue;
        const modelName = String(
          item.model_name ||
          item.model ||
          item.deployment_name ||
          item.name ||
          'default'
        ).trim() || 'default';

        if (!timelines[modelName]) timelines[modelName] = [];
        timelines[modelName].push({
          minute: minute.minute,
          minuteName: minute.minuteName,
          generated_at: generatedAt,
          labels,
          model_name: modelName,
          ...item,
        });
      }
      continue;
    }

    const modelName = String(prediction.model_name || prediction.model || 'default').trim() || 'default';
    if (!timelines[modelName]) timelines[modelName] = [];
    timelines[modelName].push({
      minute: minute.minute,
      minuteName: minute.minuteName,
      generated_at: generatedAt,
      labels,
      model_name: modelName,
      prediction: prediction.prediction || prediction.label || prediction.occupied,
      probability: prediction.probability || prediction.confidence || null,
      confidence: prediction.confidence || null,
      status: prediction.status,
      error: prediction.error,
    });
  }

  for (const modelName of Object.keys(timelines)) {
    timelines[modelName].sort((a, b) => b.minute.localeCompare(a.minute));
  }

  return timelines;
}
