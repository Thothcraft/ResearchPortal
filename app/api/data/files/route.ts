import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = '/home/pi/Desktop/data';
const MINUTE_RE = /^\d{8}_\d{4}$/;

export async function GET() {
  try {
    const files: {
      name: string;
      size: number;
      modified: string;
      files?: Record<string, boolean>;
      type?: string;
    }[] = [];

    if (fs.existsSync(DATA_DIR)) {
      const items = fs.readdirSync(DATA_DIR);
      for (const item of items) {
        const itemPath = path.join(DATA_DIR, item);
        const stat = fs.statSync(itemPath);

        if (!stat.isDirectory() || !MINUTE_RE.test(item)) continue;

        const names = new Set(fs.readdirSync(itemPath));
        files.push({
          name: item,
          size: stat.size,
          modified: stat.mtime.toISOString(),
          type: 'minute-folder',
          files: {
            video: names.has('usb_camera.mp4'),
            radar: Array.from(names).some(name => name.startsWith('mmw_radar_raw_') && name.endsWith('.bin')),
            csi: names.has('wifi_csi_raw.csv') || names.has('wifi_csi_timestamped.csv') || names.has('wifi_csi_serial_all.jsonl'),
            manifest: names.has('manifest.json'),
          },
        });
      }
      files.sort((a, b) => (b.modified || '').localeCompare(a.modified || ''));
    }

    return NextResponse.json({
      success: true,
      files,
      count: files.length,
      dataDir: DATA_DIR,
    });
  } catch (error) {
    console.error('Error listing data files:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list data files', files: [] },
      { status: 500 }
    );
  }
}
