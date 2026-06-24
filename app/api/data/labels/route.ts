import { NextResponse } from 'next/server';
import { MINUTES_DATA_DIR } from '@/lib/minutes';
import { listLocalLabelFiles } from '@/lib/localLabelFiles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const labels = listLocalLabelFiles();
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
