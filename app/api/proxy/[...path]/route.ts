import { NextRequest, NextResponse } from 'next/server';

const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://web-production-d7d37.up.railway.app';
const NORMALIZED_BACKEND_BASE_URL = BACKEND_BASE_URL.replace(/\/$/, '');
const API_BASE_URL = NORMALIZED_BACKEND_BASE_URL.endsWith('/api')
  ? NORMALIZED_BACKEND_BASE_URL
  : `${NORMALIZED_BACKEND_BASE_URL}/api`;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildTargetUrl(pathParts: string[], requestUrl: string): string {
  const url = new URL(requestUrl);
  const joinedPath = pathParts.map((p) => encodeURIComponent(p)).join('/');
  const backendUrl = new URL(API_BASE_URL);
  backendUrl.pathname = `${backendUrl.pathname.replace(/\/$/, '')}/${joinedPath}`.replace(/\/{2,}/g, '/');
  backendUrl.search = url.search;
  return backendUrl.toString();
}

function filterHeaders(headers: Headers): Headers {
  const out = new Headers();
  headers.forEach((value, key) => {
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
  return out;
}

async function proxy(
  request: NextRequest,
  pathParts: string[],
  bodyOverride?: string
) {
  const targetUrl = buildTargetUrl(pathParts, request.url);

  const method = request.method.toUpperCase();
  const headers = filterHeaders(request.headers);

  try {
    const body =
      bodyOverride !== undefined
        ? bodyOverride
        : method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
          ? await request.text()
          : undefined;

    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
      signal: request.signal,
    });

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower !== 'transfer-encoding' && lower !== 'content-encoding') {
        responseHeaders.set(key, value);
      }
    });

    responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private');
    responseHeaders.set('Pragma', 'no-cache');
    responseHeaders.set('Expires', '0');

    // Forward the upstream body without buffering. This is especially
    // important for multi-minute ZIPs, which can be several gigabytes.
    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error(`[Proxy Error] ${method} ${targetUrl}:`, error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Proxy error',
      },
      { status: 503 }
    );
  }
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path);
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path);
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path);
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path);
}

export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path);
}

export async function OPTIONS(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path);
}

export async function HEAD(request: NextRequest, { params }: { params: { path: string[] } }) {
  const response = await proxy(request, params.path);
  return new NextResponse(null, {
    status: response.status,
    headers: response.headers,
  });
}
