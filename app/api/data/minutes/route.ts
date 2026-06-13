import { NextResponse } from 'next/server';
import { listMinuteSummaries } from '@/lib/minutes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const minutes = listMinuteSummaries();
    return NextResponse.json({
      success: true,
      minutes,
      count: minutes.length,
      dataDir: '/home/pi/Desktop/data',
    });
  } catch (error) {
    console.error('Error listing minute folders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list minute folders', minutes: [] },
      { status: 500 }
    );
  }
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
