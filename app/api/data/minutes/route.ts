import { NextResponse } from 'next/server';
import { listMinuteSummaries } from '@/lib/minutes';

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
