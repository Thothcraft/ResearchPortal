import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { getMinuteDetail } from '@/lib/minutes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { minute: string } }
) {
  try {
    const minute = decodeURIComponent(params.minute);
    const detail = getMinuteDetail(minute);

    if (!detail) {
      return NextResponse.json({ error: 'Minute folder not found' }, { status: 404 });
    }

    const zipPath = path.join(os.tmpdir(), `${minute}.zip`);
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    execFileSync('zip', ['-r', '-q', zipPath, '.'], {
      cwd: detail.path,
    });

    const payload = fs.readFileSync(zipPath);
    fs.unlinkSync(zipPath);

    return new NextResponse(payload, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${minute}.zip"`,
        'Content-Length': String(payload.length),
      },
    });
  } catch (error) {
    console.error('Error building minute zip:', error);
    return NextResponse.json({ error: 'Failed to build zip archive' }, { status: 500 });
  }
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
