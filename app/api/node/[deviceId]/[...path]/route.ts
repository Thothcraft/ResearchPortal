import { NextRequest, NextResponse } from 'next/server';

/**
 * Portal → Brain relay proxy (plans/CONTRACT.md §2/§5).
 *
 * The device page calls `/api/node/{deviceId}/<node path>` with the same
 * inner paths the node serves on `:80/api/*`; this route wraps them into
 * `{method, path, body}` and POSTs to Brain's `/v1/nodes/{id}/api` relay,
 * which forwards an `api_request` frame over the node's WS tunnel and
 * returns the `api_response` verbatim (status + body).
 *
 * `/api/node/{id}/v1/room` → node path `/api/v1/room` etc.
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
  const auth = request.headers.get('authorization');
  const cookie = request.headers.get('cookie');
  const apiKey = request.headers.get('x-api-key');
  if (auth) out.set('authorization', auth);
  if (cookie) out.set('cookie', cookie);
  if (apiKey) out.set('x-api-key', apiKey);
  out.set('content-type', 'application/json');
  out.set('accept', 'application/json');
  out.set('x-thoth-source', 'portal');
  return out;
}

async function relay(request: NextRequest, deviceId: string, pathParts: string[]) {
  const url = new URL(request.url);
  // Inner node path keeps the node's /api/* shape; the device page never
  // sees the Brain relay wrapper.
  const innerPath = `/api/${pathParts.map((p) => encodeURIComponent(p)).join('/')}${url.search}`;

  let body: unknown = null;
  if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS') {
    const raw = await request.text();
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = raw; // non-JSON payloads travel as raw strings
      }
    }
  }

  try {
    const upstream = await fetch(
      `${V1_BASE_URL}/nodes/${encodeURIComponent(deviceId)}/api`,
      {
        method: 'POST',
        headers: forwardHeaders(request),
        body: JSON.stringify({ method: request.method, path: innerPath, body }),
        cache: 'no-store',
      },
    );

    const responseHeaders = new Headers();
    const contentType = upstream.headers.get('content-type');
    if (contentType) responseHeaders.set('content-type', contentType);
    const disposition = upstream.headers.get('content-disposition');
    if (disposition) responseHeaders.set('content-disposition', disposition);
    responseHeaders.set('Cache-Control', 'no-store');

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error(`[Node Relay] ${request.method} ${innerPath}:`, error);
    return NextResponse.json(
      { detail: error?.message || 'Node relay error' },
      { status: 503 },
    );
  }
}

type Ctx = { params: Promise<{ deviceId: string; path: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { deviceId, path } = await ctx.params;
  return relay(request, deviceId, path);
}
export async function POST(request: NextRequest, ctx: Ctx) {
  const { deviceId, path } = await ctx.params;
  return relay(request, deviceId, path);
}
export async function PUT(request: NextRequest, ctx: Ctx) {
  const { deviceId, path } = await ctx.params;
  return relay(request, deviceId, path);
}
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { deviceId, path } = await ctx.params;
  return relay(request, deviceId, path);
}
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { deviceId, path } = await ctx.params;
  return relay(request, deviceId, path);
}
