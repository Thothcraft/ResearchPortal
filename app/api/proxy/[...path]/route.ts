import { NextRequest, NextResponse } from 'next/server';

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'https://web-production-d7d37.up.railway.app';

export const runtime = 'nodejs';

function buildTargetUrl(pathParts: string[], requestUrl: string): string {
  const url = new URL(requestUrl);
  const joinedPath = pathParts.map((p) => encodeURIComponent(p)).join('/');
  const target = new URL(`${BACKEND_BASE_URL.replace(/\/$/, '')}/${joinedPath}`);
  target.search = url.search;
  return target.toString();
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

async function proxy(request: NextRequest, pathParts: string[]) {
  const targetUrl = buildTargetUrl(pathParts, request.url);

  const method = request.method.toUpperCase();
  const headers = filterHeaders(request.headers);

  const body = method !== 'GET' && method !== 'HEAD' ? request.body : undefined;

  const upstream = await fetch(targetUrl, {
    method,
    headers,
    body,
    ...(body ? { duplex: 'half' as const } : {}),
    redirect: 'manual',
  });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === 'transfer-encoding' || lower === 'content-encoding') {
      return;
    }
    responseHeaders.set(key, value);
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
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
