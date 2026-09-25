import { NextRequest, NextResponse } from 'next/server';
import { getMinuteSecond, ThothNodeConfig } from '@/lib/minutes-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function nodeConfig(): ThothNodeConfig {
  return {
    baseUrl:
      process.env.THOTH_NODE_URL ||
      process.env.NEXT_PUBLIC_THOTH_NODE_URL ||
      'http://127.0.0.1:5000',
    token: process.env.THOTH_NODE_TOKEN || undefined,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ minute: string; second: string }> },
) {
  const { minute, second } = await params;
  const index = Number.parseInt(second, 10);
  if (!Number.isFinite(index) || index < 0) {
    return NextResponse.json(
      { success: false, error: 'second must be a non-negative integer' },
      { status: 400 },
    );
  }
  try {
    const view = await getMinuteSecond(nodeConfig(), minute, index);
    return NextResponse.json({ success: true, second: view });
  } catch (error: any) {
    console.error(`Error fetching v1 second ${minute}/${index}:`, error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch second' },
      { status: 502 },
    );
  }
}
