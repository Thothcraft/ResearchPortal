import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { execFileSync } from 'child_process';

const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'https://web-production-d7d37.up.railway.app';
const LOCAL_THOTH_DATA = '/home/pi/Desktop/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildLocalThothDevices() {
  const hasCollector = fs.existsSync('/etc/systemd/system/thoth-collector.service');
  const collectorActive = (() => {
    try {
      return execFileSync('systemctl', ['is-active', 'thoth-collector.service'], { encoding: 'utf8' }).trim() === 'active';
    } catch {
      return false;
    }
  })();
  const thothOnline = collectorActive || hasCollector;
  const minutes = fs.existsSync(LOCAL_THOTH_DATA)
    ? fs.readdirSync(LOCAL_THOTH_DATA).filter((item) => /^\d{8}_\d{4}$/.test(item))
    : [];
  const latestMinute = minutes.sort().at(-1) || null;

  return [
    {
      device_id: 'thoth-local',
      device_name: 'Thoth',
      device_type: 'raspberry_pi',
      online: thothOnline,
      approved: true,
      battery_level: null,
      last_seen: new Date().toISOString(),
      ip_address: 'thoth.local',
      mac_address: null,
      device_uuid: 'thoth-local',
      user_id: 0,
      hardware_info: {
        device_type: 'raspberry_pi',
        is_raspberry_pi: true,
        raspberry_pi_model: 'Thoth RPi',
        hostname: 'thoth',
        sensors: [
          { sensor_type: 'radar', name: 'DreamHat Radar', available: true, device_path: '/dev/spidev0.0' },
          { sensor_type: 'camera', name: 'USB Camera', available: true, device_path: '/dev/video0' },
          { sensor_type: 'wifi_csi', name: 'ESP32 CSI', available: true, device_path: '/dev/ttyACM0' },
        ],
        latest_minute: latestMinute,
      },
    },
  ];
}

function buildTargetUrl(pathParts: string[], requestUrl: string, forceApiPrefix = false): string {
  const url = new URL(requestUrl);
  const joinedPath = pathParts.map((p) => encodeURIComponent(p)).join('/');
  const backendUrl = new URL(BACKEND_BASE_URL);
  const basePath = backendUrl.pathname.replace(/\/$/, '');
  const shouldPrefixApi =
    forceApiPrefix &&
    !basePath.endsWith('/api') &&
    !joinedPath.startsWith('api/');

  backendUrl.pathname = `${basePath}${shouldPrefixApi ? '/api' : ''}/${joinedPath}`.replace(/\/{2,}/g, '/');
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
  forceApiPrefix = false,
  bodyOverride?: string
) {
  const normalized = pathParts.join('/');
  if (normalized === 'device/list' || normalized === 'api/device/list') {
    return NextResponse.json({
      devices: buildLocalThothDevices(),
    });
  }

  const targetUrl = buildTargetUrl(pathParts, request.url, forceApiPrefix);

  console.log(`[Proxy] ${request.method} ${targetUrl}`);
  console.log(`[Proxy] Backend URL: ${BACKEND_BASE_URL}`);

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

    if (
      !forceApiPrefix &&
      (response.statusCode === 404 || response.statusCode === 405) &&
      !new URL(targetUrl).pathname.startsWith('/api/')
    ) {
      console.warn(`[Proxy] Retrying ${method} ${targetUrl} with /api prefix`);
      return proxy(request, pathParts, true, body);
    }

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
