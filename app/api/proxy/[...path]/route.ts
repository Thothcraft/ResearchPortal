import { NextRequest, NextResponse } from 'next/server';

const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL ||
  (process.env.NODE_ENV === 'development'
    ? 'http://127.0.0.1:8000'
    : 'https://web-production-d7d37.up.railway.app');

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

  // For GET requests, we can retry on failure
  const maxRetries = method === 'GET' ? 2 : 0;
  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Create AbortController with 30 second timeout (reduced from 60)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      // Clone body for retries (only for non-GET requests)
      const body = method !== 'GET' && method !== 'HEAD' ? request.body : undefined;
      
      const upstream = await fetch(targetUrl, {
        method,
        headers,
        body,
        ...(body ? { duplex: 'half' as const } : {}),
        redirect: 'manual',
        signal: controller.signal,
        // Disable keep-alive to avoid stale connections
        keepalive: false,
      });

      clearTimeout(timeoutId);

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
    } catch (error: any) {
      clearTimeout(timeoutId);
      lastError = error;
      
      // Only retry on connection errors, not timeouts
      const isRetryable = error.cause?.code === 'ECONNRESET' || 
                          error.cause?.code === 'ECONNREFUSED' ||
                          error.message?.includes('fetch failed');
      
      if (attempt < maxRetries && isRetryable) {
        console.warn(`[Proxy] Retry ${attempt + 1}/${maxRetries} for ${method} ${targetUrl}`);
        // Small delay before retry
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      break;
    }
  }

  // All retries failed
  const error = lastError;
  const errorMessage = error.name === 'AbortError' 
    ? 'Backend request timed out after 30 seconds'
    : error.cause?.code === 'ECONNREFUSED'
    ? 'Backend server is not running. Please start the Python server.'
    : error.cause?.code === 'UND_ERR_HEADERS_TIMEOUT'
    ? 'Backend is taking too long to respond. Check if the server is overloaded.'
    : error.cause?.code === 'ECONNRESET'
    ? 'Connection to backend was reset. Please try again.'
    : `Backend error: ${error.message}`;
  
  console.error(`[Proxy Error] ${method} ${targetUrl}: ${errorMessage}`);
  
  return NextResponse.json(
    { 
      success: false, 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    },
    { status: 503 }
  );
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
