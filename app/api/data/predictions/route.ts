import { NextResponse } from 'next/server';
import { collectPredictionTimelines } from '@/lib/minutes';

export async function GET() {
  try {
    const timelines = collectPredictionTimelines();
    return NextResponse.json({
      success: true,
      timelines,
      modelCount: Object.keys(timelines).length,
    });
  } catch (error) {
    console.error('Error loading prediction timelines:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load prediction timelines', timelines: {} },
      { status: 500 }
    );
  }
}
