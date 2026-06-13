import { NextResponse } from 'next/server';
import fs from 'fs';
import { execFileSync } from 'child_process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function listMinutes() {
  const root = '/home/pi/Desktop/data';
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .filter((item) => /^\d{8}_\d{4}$/.test(item))
    .sort();
}

function serviceActive(name: string) {
  try {
    return execFileSync('systemctl', ['is-active', name], { encoding: 'utf8' }).trim() === 'active';
  } catch {
    return false;
  }
}

export async function GET() {
  const minutes = listMinutes();
  const latestMinute = minutes.at(-1) || null;
  const collectorActive = serviceActive('thoth-collector.service');
  const webActive = serviceActive('thoth-web.service');
  const online = collectorActive || webActive || minutes.length > 0;

  return NextResponse.json({
    device: {
      device_id: 'thoth-local',
      device_name: 'Thoth',
      device_type: 'raspberry_pi',
      online,
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
      },
    },
    collection: {
      active: collectorActive,
      web_active: webActive,
      latest_minute: latestMinute,
      minute_count: minutes.length,
      minutes,
    },
  });
}
