import { NextRequest, NextResponse } from 'next/server';
import { getMinute, ThothNodeConfig } from '@/lib/minutes-api';

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
  { params }: { params: Promise<{ minute: string }> },
) {
  const { minute } = await params;
  try {
    const manifest = await getMinute(nodeConfig(), minute);
    return NextResponse.json({ success: true, minute: manifest });
  } catch (error: any) {
    console.error(`Error fetching v1 minute ${minute}:`, error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch minute' },
      { status: 502 },
    );
  }
}
