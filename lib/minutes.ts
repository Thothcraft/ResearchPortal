import fs from 'fs';
import path from 'path';

export const MINUTES_DATA_DIR = '/home/pi/Desktop/data';
export const MINUTE_RE = /^\d{8}_\d{4}$/;

export type MinuteFiles = {
  video: boolean;
  radar: boolean;
  csi: boolean;
  manifest: boolean;
};

export type MinuteSummary = {
  minute: string;
  path: string;
  modified: string;
  created: string;
  deviceKey: string;
  deviceLabel: string;
  completed: boolean;
  state: 'ready' | 'collecting';
  uploaded: boolean;
  files: MinuteFiles;
  sizes: Record<string, number>;
  manifest?: any;
};

export type MinuteDetail = MinuteSummary & {
  filePaths: Record<string, string | null>;
  previews: Record<string, string>;
};

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
  const radar = names.find((name) => name.startsWith('mmw_radar_raw_') && name.endsWith('.bin')) || null;
  return {
    video: names.includes('usb_camera.mp4') ? path.join(minuteDir, 'usb_camera.mp4') : null,
    radar: radar ? path.join(minuteDir, radar) : null,
    csiCsv: names.includes('wifi_csi_raw.csv') ? path.join(minuteDir, 'wifi_csi_raw.csv') : null,
    csiTimestamped: names.includes('wifi_csi_timestamped.csv') ? path.join(minuteDir, 'wifi_csi_timestamped.csv') : null,
    csiSerial: names.includes('wifi_csi_serial_all.jsonl') ? path.join(minuteDir, 'wifi_csi_serial_all.jsonl') : null,
    manifest: names.includes('manifest.json') ? path.join(minuteDir, 'manifest.json') : null,
    ffmpegLog: names.includes('usb_camera.ffmpeg.log') ? path.join(minuteDir, 'usb_camera.ffmpeg.log') : null,
  };
}

export function listMinuteSummaries(): MinuteSummary[] {
  if (!fs.existsSync(MINUTES_DATA_DIR)) return [];

  const minutes: MinuteSummary[] = [];
  for (const item of fs.readdirSync(MINUTES_DATA_DIR)) {
    const minuteDir = path.join(MINUTES_DATA_DIR, item);
    if (!fs.statSync(minuteDir).isDirectory() || !MINUTE_RE.test(item)) continue;
    const stat = fs.statSync(minuteDir);
    const paths = getMinutePaths(minuteDir);
    const manifest = readJsonPreview(paths.manifest);
    const deviceInfo = extractDeviceInfo(manifest, minuteDir);
    const completed = Boolean(manifest?.capture_finished);
    minutes.push({
      minute: item,
      path: minuteDir,
      modified: stat.mtime.toISOString(),
      created: stat.birthtime.toISOString(),
      deviceKey: deviceInfo.deviceKey,
      deviceLabel: deviceInfo.deviceLabel,
      completed,
      state: completed ? 'ready' : 'collecting',
      uploaded: deviceInfo.uploaded,
      files: {
        video: !!paths.video,
        radar: !!paths.radar,
        csi: !!(paths.csiCsv || paths.csiTimestamped || paths.csiSerial),
        manifest: !!paths.manifest,
      },
      sizes: {
        video: paths.video ? fs.statSync(paths.video).size : 0,
        radar: paths.radar ? fs.statSync(paths.radar).size : 0,
        csi_csv: paths.csiCsv ? fs.statSync(paths.csiCsv).size : 0,
        csi_timestamped: paths.csiTimestamped ? fs.statSync(paths.csiTimestamped).size : 0,
        csi_serial: paths.csiSerial ? fs.statSync(paths.csiSerial).size : 0,
      },
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
  if (!MINUTE_RE.test(minute)) return null;
  const minuteDir = path.join(MINUTES_DATA_DIR, minute);
  if (!fs.existsSync(minuteDir) || !fs.statSync(minuteDir).isDirectory()) return null;

  const stat = fs.statSync(minuteDir);
  const paths = getMinutePaths(minuteDir);
  const manifest = readJsonPreview(paths.manifest);
  const deviceInfo = extractDeviceInfo(manifest, minuteDir);
  const completed = Boolean(manifest?.capture_finished);
  const summary = getMinuteSummary(minute) || {
    minute,
    path: minuteDir,
    modified: stat.mtime.toISOString(),
    created: stat.birthtime.toISOString(),
    deviceKey: deviceInfo.deviceKey,
    deviceLabel: deviceInfo.deviceLabel,
    completed,
    state: completed ? 'ready' : 'collecting',
    uploaded: deviceInfo.uploaded,
    files: {
      video: !!paths.video,
      radar: !!paths.radar,
      csi: !!(paths.csiCsv || paths.csiTimestamped || paths.csiSerial),
      manifest: !!paths.manifest,
    },
    sizes: {
      video: paths.video ? fs.statSync(paths.video).size : 0,
      radar: paths.radar ? fs.statSync(paths.radar).size : 0,
      csi_csv: paths.csiCsv ? fs.statSync(paths.csiCsv).size : 0,
        csi_timestamped: paths.csiTimestamped ? fs.statSync(paths.csiTimestamped).size : 0,
        csi_serial: paths.csiSerial ? fs.statSync(paths.csiSerial).size : 0,
      },
    manifest,
  };

  return {
    ...summary,
    filePaths: {
      video: paths.video,
      radar: paths.radar,
      csi_csv: paths.csiCsv,
      csi_timestamped: paths.csiTimestamped,
      csi_serial: paths.csiSerial,
      manifest: paths.manifest,
      ffmpeg_log: paths.ffmpegLog,
    },
    previews: {
      csi_csv: readTextPreview(paths.csiCsv),
      csi_timestamped: readTextPreview(paths.csiTimestamped),
      csi_serial: readTextPreview(paths.csiSerial),
      ffmpeg_log: readTextPreview(paths.ffmpegLog),
      manifest: paths.manifest ? JSON.stringify(readJsonPreview(paths.manifest), null, 2) : '',
    },
  };
}
