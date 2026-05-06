import { NextRequest, NextResponse } from 'next/server';

const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL ||
  (process.env.NODE_ENV === 'development'
    ? 'http://localhost:7050'
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
  
  console.log(`[Proxy] ${request.method} ${targetUrl}`);

  const method = request.method.toUpperCase();
  const headers = filterHeaders(request.headers);

  try {
    // Get body as text for POST/PUT requests
    let body: string | undefined = undefined;
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      body = await request.text();
      console.log(`[Proxy] Body length: ${body?.length || 0}`);
    }

    // Use Node.js https module for more reliable requests
    const https = require('https');
    const http = require('http');
    const url = new URL(targetUrl);
    const isHttps = url.protocol === 'https:';
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: Object.fromEntries(headers),
    };

    return new Promise((resolve) => {
      const lib = isHttps ? https : http;
      
      const req = lib.request(options, (res: any) => {
        const responseHeaders = new Headers();
        
        // Copy headers
        Object.entries(res.headers).forEach(([key, value]) => {
          const lower = key.toLowerCase();
          if (lower !== 'transfer-encoding' && lower !== 'content-encoding') {
            responseHeaders.set(key, value as string);
          }
        });

        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const responseBody = Buffer.concat(chunks);
          resolve(
            new NextResponse(responseBody, {
              status: res.statusCode,
              headers: responseHeaders,
            })
          );
        });
      });

      req.on('error', (error: any) => {
        console.error(`[Proxy] Request failed:`, error);
        resolve(
          NextResponse.json(
            {
              success: false,
              error: `Backend connection failed: ${error.message}`,
            },
            { status: 503 }
          )
        );
      });

      // Write body if exists
      if (body) {
        req.write(body);
      }
      
      req.end();
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
