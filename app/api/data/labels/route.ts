import { NextResponse } from 'next/server';
import { MINUTES_DATA_DIR, listLabeledMinuteGroups } from '@/lib/minutes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const labels = listLabeledMinuteGroups();
    return NextResponse.json({
      success: true,
      labels,
      count: labels.length,
      dataDir: MINUTES_DATA_DIR,
    });
  } catch (error) {
    console.error('Error listing local label files:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list local label files', labels: [] },
      { status: 500 }
    );
  }
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
