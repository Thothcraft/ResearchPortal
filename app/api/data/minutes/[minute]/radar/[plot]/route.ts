import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { getMinuteDetail } from '@/lib/minutes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLOT_KINDS = new Set(['range-doppler', 'azimuth-range', 'azimuth-doppler']);
const VENV_PYTHON = '/home/pi/thoth/venv/bin/python';
const PYTHON = process.env.THOTH_PYTHON || (fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : 'python3');

export async function GET(
  request: NextRequest,
  { params }: { params: { minute: string; plot: string } }
) {
  try {
    const minute = decodeURIComponent(params.minute);
    const plot = decodeURIComponent(params.plot);
    const detail = getMinuteDetail(minute);

    if (!detail) {
      return NextResponse.json({ error: 'Minute folder not found' }, { status: 404 });
    }

    if (!PLOT_KINDS.has(plot)) {
      return NextResponse.json({ error: 'Unsupported radar plot kind' }, { status: 400 });
    }

    const radarPath = detail.filePaths.radar;
    if (!radarPath || !fs.existsSync(radarPath)) {
      return NextResponse.json({ error: 'Radar file not found' }, { status: 404 });
    }

    const cacheDir = path.join(os.tmpdir(), 'thoth-researchportal-radar', minute);
    const outPath = path.join(cacheDir, `${plot}.png`);
    const scriptPath = path.join(process.cwd(), 'scripts', 'render_radar_plot.py');

    const radarMtime = fs.statSync(radarPath).mtimeMs;
    const scriptMtime = fs.existsSync(scriptPath) ? fs.statSync(scriptPath).mtimeMs : 0;
    const outExists = fs.existsSync(outPath);
    const outMtime = outExists ? fs.statSync(outPath).mtimeMs : 0;

    if (!outExists || outMtime < radarMtime || outMtime < scriptMtime) {
      fs.mkdirSync(cacheDir, { recursive: true });
      execFileSync(PYTHON, [scriptPath, radarPath, plot, outPath], {
        stdio: 'pipe',
      });
    }

    const payload = fs.readFileSync(outPath);
    return new NextResponse(payload, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60',
        'Content-Length': String(payload.length),
      },
    });
  } catch (error) {
    console.error('Error rendering radar plot:', error);
    return NextResponse.json({ error: 'Failed to render radar plot' }, { status: 500 });
  }
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
