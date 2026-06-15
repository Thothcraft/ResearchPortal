import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getMinuteDetail, MINUTES_DATA_DIR, MINUTE_RE } from '@/lib/minutes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeLabels(labels: unknown): string[] {
  const items = Array.isArray(labels) ? labels : String(labels || '').split(',');
  const cleaned: string[] = [];
  for (const item of items) {
    const value = String(item || '').trim().replace(/\s+/g, ' ');
    if (value && !cleaned.includes(value)) cleaned.push(value);
  }
  return cleaned;
}

function mergeLabels(existing: unknown, incoming: unknown): string[] {
  const merged: string[] = [];
  for (const label of normalizeLabels(existing)) {
    if (!merged.includes(label)) merged.push(label);
  }
  for (const label of normalizeLabels(incoming)) {
    if (!merged.includes(label)) merged.push(label);
  }
  return merged;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { minute: string } }
) {
  try {
    const minute = decodeURIComponent(params.minute);
    if (!MINUTE_RE.test(minute)) {
      return NextResponse.json({ success: false, error: 'Invalid minute folder' }, { status: 400 });
    }

    const minuteDir = path.join(MINUTES_DATA_DIR, minute);
    const detail = getMinuteDetail(minute);
    if (!detail || !fs.existsSync(minuteDir)) {
      return NextResponse.json({ success: false, error: 'Minute folder not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const labels = normalizeLabels(body.labels);
    const replace = Boolean(body.replace);
    const manifestPath = path.join(minuteDir, 'manifest.json');
    const manifest = fs.existsSync(manifestPath)
      ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      : {};
    manifest.labels = replace ? labels : mergeLabels(manifest.labels, labels);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    return NextResponse.json({ success: true, minute, labels: manifest.labels, manifest });
  } catch (error) {
    console.error('Error updating minute labels:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update minute labels' },
      { status: 500 }
    );
  }
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
