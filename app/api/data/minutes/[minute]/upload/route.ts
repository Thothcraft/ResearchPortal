import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getMinuteDetail } from '@/lib/minutes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const THOTH_BASE_URL =
  process.env.THOTH_DEVICE_URL ||
  process.env.NEXT_PUBLIC_THOTH_URL ||
  'http://thoth.local:5000';

export async function POST(
  _request: Request,
  { params }: { params: { minute: string } }
) {
  try {
    const minute = decodeURIComponent(params.minute);
    const detail = getMinuteDetail(minute);

    if (!detail) {
      return NextResponse.json({ success: false, error: 'Minute folder not found' }, { status: 404 });
    }

    const response = await fetch(`${THOTH_BASE_URL}/api/captures/${encodeURIComponent(minute)}/upload`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: payload?.message || payload?.error || `Upload failed with status ${response.status}`,
        },
        { status: response.status }
      );
    }

    const marker = {
      uploaded_at: new Date().toISOString(),
      source: THOTH_BASE_URL,
      response: payload,
    };
    fs.writeFileSync(path.join(detail.path, 'cloud_upload.json'), JSON.stringify(marker, null, 2));

    return NextResponse.json({
      success: true,
      minute,
      marker,
      response: payload,
    });
  } catch (error) {
    console.error('Error uploading minute folder:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload minute folder' },
      { status: 500 }
    );
  }
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
