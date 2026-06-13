import { NextRequest, NextResponse } from 'next/server';
import { getMinuteDetail } from '@/lib/minutes';

export async function GET(
  request: NextRequest,
  { params }: { params: { minute: string } }
) {
  try {
    const minute = decodeURIComponent(params.minute);
    const detail = getMinuteDetail(minute);

    if (!detail) {
      return NextResponse.json({ success: false, error: 'Minute folder not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      minute: detail,
    });
  } catch (error) {
    console.error('Error loading minute detail:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load minute detail' },
      { status: 500 }
    );
  }
}
