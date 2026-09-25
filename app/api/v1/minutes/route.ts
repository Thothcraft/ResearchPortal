import { NextResponse } from 'next/server';
import { listMinutes, ThothNodeConfig } from '@/lib/minutes-api';

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

export async function GET() {
  try {
    const minutes = await listMinutes(nodeConfig());
    return NextResponse.json({ success: true, minutes, count: minutes.length });
  } catch (error: any) {
    console.error('Error listing v1 minutes:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to list minutes', minutes: [] },
      { status: 502 },
    );
  }
}
