import { NextRequest, NextResponse } from 'next/server';

/**
 * Thin proxy for Brain's versioned `/v1/*` surface (`/v1/events`,
 * `/v1/usage`, `/v1/devices`, …). `/api/proxy` covers the legacy `/api/*`
 * namespace; this route is the v1 equivalent.
 */
const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://web-production-d7d37.up.railway.app';
const NORMALIZED_BACKEND_BASE_URL = BACKEND_BASE_URL.replace(/\/$/, '');
const V1_BASE_URL = `${NORMALIZED_BACKEND_BASE_URL}/v1`;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function forwardHeaders(request: NextRequest): Headers {
  const out = new Headers();
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (
      lower === 'host' ||
      lower === 'connection' ||
      lower === 'content-length' ||
      lower === 'accept-encoding'
    ) {
      return;
    }
    out.set(key, value);
  });
  out.set('x-thoth-source', 'portal');
  return out;
}

async function proxy(request: NextRequest, pathParts: string[]) {
  const url = new URL(request.url);
  const joined = pathParts.map((p) => encodeURIComponent(p)).join('/');
  const target = `${V1_BASE_URL}/${joined}${url.search}`;
  const method = request.method.toUpperCase();
  const body =
    method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
      ? await request.arrayBuffer()
      : undefined;

  try {
    const upstream = await fetch(target, {
      method,
      headers: forwardHeaders(request),
      body,
      cache: 'no-store',
      redirect: 'manual',
    });
    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower !== 'transfer-encoding' && lower !== 'content-encoding' && lower !== 'set-cookie') {
        responseHeaders.set(key, value);
      }
    });
    responseHeaders.set('Cache-Control', 'no-store');
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error(`[Brain v1 Proxy] ${method} ${target}:`, error);
    return NextResponse.json(
      { detail: error?.message || 'Brain proxy error' },
      { status: 503 },
    );
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
export async function POST(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
export async function PUT(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
