import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getMinuteDetail } from '@/lib/minutes';

export async function GET(
  request: NextRequest,
  { params }: { params: { minute: string; kind: string } }
) {
  try {
    const minute = decodeURIComponent(params.minute);
    const kind = params.kind;
    const detail = getMinuteDetail(minute);

    if (!detail) {
      return NextResponse.json({ error: 'Minute folder not found' }, { status: 404 });
    }

    const fileMap: Record<string, string | null> = {
      video: detail.filePaths.video,
      radar: detail.filePaths.radar,
      csi_csv: detail.filePaths.csi_csv,
      csi_timestamped: detail.filePaths.csi_timestamped,
      csi_serial: detail.filePaths.csi_serial,
      manifest: detail.filePaths.manifest,
      ffmpeg_log: detail.filePaths.ffmpeg_log,
    };

    const filePath = fileMap[kind];
    if (!filePath || !fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.mp4') contentType = 'video/mp4';
    else if (ext === '.csv') contentType = 'text/csv';
    else if (ext === '.json') contentType = 'application/json';
    else if (ext === '.jsonl') contentType = 'application/x-ndjson';
    else if (ext === '.log') contentType = 'text/plain';

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${path.basename(filePath)}"`,
        'Content-Length': String(content.length),
      },
    });
  } catch (error) {
    console.error('Error serving minute file:', error);
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
  }
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
