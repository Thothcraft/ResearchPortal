import { NextResponse } from 'next/server';
import fs from 'fs';
import { listMinuteSummaries, MINUTES_DATA_DIR } from '@/lib/minutes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DATA_DIR = MINUTES_DATA_DIR;

export async function GET() {
  try {
    const files: {
      name: string;
      size: number;
      modified: string;
      files?: Record<string, boolean>;
      type?: string;
      completed?: boolean;
      state?: 'ready' | 'collecting';
    }[] = [];

    if (fs.existsSync(DATA_DIR)) {
      for (const minute of listMinuteSummaries()) {
        const stat = fs.statSync(minute.path);
        files.push({
          name: minute.minute,
          size: stat.size,
          modified: minute.modified,
          type: 'minute-folder',
          completed: minute.completed,
          state: minute.state,
          files: {
            video: minute.files.video,
            radar: minute.files.radar,
            xy_tracking: minute.files.xy_tracking,
            csi: minute.files.csi,
            manifest: minute.files.manifest,
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

export async function HEAD() {
  return NextResponse.json({ success: true }, { status: 200 });
}
