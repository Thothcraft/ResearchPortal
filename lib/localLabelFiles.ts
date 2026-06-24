import fs from 'fs';
import path from 'path';
import { MINUTES_DATA_DIR, MINUTE_RE } from '@/lib/minutes';

const DATA_EXTENSIONS = new Set(['.dat', '.bin', '.csv', '.jsonl']);
const SKIP_NAMES = new Set(['manifest.json', 'predictions.json', 'cloud_upload.json']);

export type LocalLabelFile = {
  id: string;
  label: string;
  minute: string;
  filename: string;
  relativePath: string;
  size: number;
  modified: string;
  contentType: string;
};

export type LocalLabelGroup = {
  label: string;
  files: LocalLabelFile[];
};

export function contentTypeForLocalFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') return 'text/csv';
  if (ext === '.jsonl') return 'application/x-ndjson';
  if (ext === '.json') return 'application/json';
  return 'application/octet-stream';
}

export function localPathForRelative(relativePath: string): string | null {
  const resolvedRoot = path.resolve(MINUTES_DATA_DIR);
  const resolved = path.resolve(MINUTES_DATA_DIR, relativePath);
  if (!resolved.startsWith(`${resolvedRoot}${path.sep}`)) return null;
  return resolved;
}

export function listLocalLabelFiles(): LocalLabelGroup[] {
  const labels: LocalLabelGroup[] = [];
  if (!fs.existsSync(MINUTES_DATA_DIR)) return labels;

  for (const label of fs.readdirSync(MINUTES_DATA_DIR).sort()) {
    if (label === 'config' || label.startsWith('.')) continue;
    const labelDir = path.join(MINUTES_DATA_DIR, label);
    if (!fs.statSync(labelDir).isDirectory() || MINUTE_RE.test(label)) continue;

    const files: LocalLabelFile[] = [];
    for (const minute of fs.readdirSync(labelDir).sort()) {
      if (!MINUTE_RE.test(minute)) continue;
      const minuteDir = path.join(labelDir, minute);
      if (!fs.statSync(minuteDir).isDirectory()) continue;

      for (const filename of fs.readdirSync(minuteDir).sort()) {
        const filePath = path.join(minuteDir, filename);
        if (!fs.statSync(filePath).isFile()) continue;
        const ext = path.extname(filename).toLowerCase();
        if (SKIP_NAMES.has(filename) || filename.endsWith('.log') || !DATA_EXTENSIONS.has(ext)) continue;
        const stat = fs.statSync(filePath);
        const relativePath = path.join(label, minute, filename);
        files.push({
          id: Buffer.from(relativePath).toString('base64url'),
          label,
          minute,
          filename,
          relativePath,
          size: stat.size,
          modified: stat.mtime.toISOString(),
          contentType: contentTypeForLocalFile(filePath),
        });
      }
    }

    if (files.length) labels.push({ label, files });
  }

  return labels;
}
