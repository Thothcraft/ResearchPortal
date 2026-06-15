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

  console.log(`[Proxy] ${request.method} ${targetUrl}`);
  console.log(`[Proxy] Backend URL: ${API_BASE_URL}`);

  const method = request.method.toUpperCase();
  const headers = filterHeaders(request.headers);

  try {
    const body =
      bodyOverride !== undefined
        ? bodyOverride
        : method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
          ? await request.text()
          : undefined;

    if (body !== undefined) {
      console.log(`[Proxy] Body length: ${body.length}`);
    }

    const https = require('https');
    const http = require('http');
    const url = new URL(targetUrl);
    const isHttps = url.protocol === 'https:';

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: Object.fromEntries(headers),
    };

    const response = await new Promise<{ statusCode?: number; headers: Record<string, string | string[] | undefined>; body: Buffer }>((resolve, reject) => {
      const lib = isHttps ? https : http;
      const req = lib.request(options, (res: any) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      });

      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy(new Error('Backend request timeout'));
      });

      if (body) {
        req.write(body);
      }

      req.end();
    });

    const responseHeaders = new Headers();
    Object.entries(response.headers).forEach(([key, value]) => {
      const lower = key.toLowerCase();
      if (lower !== 'transfer-encoding' && lower !== 'content-encoding') {
        if (Array.isArray(value)) {
          responseHeaders.set(key, value.join(', '));
        } else if (value !== undefined) {
          responseHeaders.set(key, value);
        }
      }
    });

    responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private');
    responseHeaders.set('Pragma', 'no-cache');
    responseHeaders.set('Expires', '0');

    return new NextResponse(response.body, {
      status: response.statusCode,
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
