'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { contextApi, type CtxEvidence } from '@/lib/context-api';

interface Edge {
  observer: string;
  target: string;
  rssi: number;
  ts: number;
  samples: number;
}

const W = 760, H = 420;

/** Extract observer→target RSSI edges from ble.proximity.v1 evidence. */
function toEdges(rows: CtxEvidence[]): Edge[] {
  const byKey = new Map<string, Edge>();
  for (const e of rows) {
    const v = (e.value ?? {}) as Record<string, unknown>;
    const observer = String(v.observer ?? e.source_id ?? 'unknown');
    const target = String(v.target ?? '');
    const rssi = Number(v.rssi_dbm ?? v.rssi);
    if (!target || !Number.isFinite(rssi)) continue;
    const ts = e.timestamp ?? 0;
    const key = `${observer}→${target}`;
    const prev = byKey.get(key);
    if (!prev || ts > prev.ts) {
      byKey.set(key, { observer, target, rssi, ts,
        samples: (prev?.samples ?? 0) + 1 });
    } else {
      prev.samples += 1;
    }
  }
  return Array.from(byKey.values());
}

/**
 * BLE relation map — observers (nodes/phones) on the left, targets
 * (wearables) on the right. Edge width encodes RSSI, opacity encodes
 * freshness. RSSI is signal strength — never relabeled as distance.
 */
export function BleRelationMap() {
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const rows = await contextApi.evidence(
        { key: 'ble.proximity.v1', limit: 500 });
      setEdges(toEdges(rows));
      setError('');
    } catch (e: any) {
      setError(e?.message || 'BLE evidence unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const layout = useMemo(() => {
    const observers = Array.from(new Set(edges.map((e) => e.observer)));
    const targets = Array.from(new Set(edges.map((e) => e.target)));
    const pos = new Map<string, { x: number; y: number }>();
    observers.forEach((o, i) =>
      pos.set(`o:${o}`, { x: 110, y: 60 + (i * (H - 120)) / Math.max(1, observers.length - 1 || 1) }));
    targets.forEach((t, i) =>
      pos.set(`t:${t}`, { x: W - 110, y: 60 + (i * (H - 120)) / Math.max(1, targets.length - 1 || 1) }));
    return { observers, targets, pos };
  }, [edges]);

  if (loading) return (
    <div className="flex items-center gap-2 py-16 text-neutral-400">
      <Loader2 className="h-4 w-4 animate-spin" /> Reading BLE evidence…
    </div>);
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (edges.length === 0) return (
    <p className="py-12 text-center text-sm text-neutral-500">
      No ble.proximity.v1 evidence yet — enable the BLE source in the mobile
      app or wait for node-side BLE scanning.</p>);

  const now = Date.now() / 1000;
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
      <svg viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-lg border border-neutral-800 bg-neutral-950">
        {edges.map((e, i) => {
          const a = layout.pos.get(`o:${e.observer}`)!;
          const b = layout.pos.get(`t:${e.target}`)!;
          const fresh = Math.max(0, 1 - (now - e.ts) / 90);
          const strength = Math.max(0, Math.min(1, (e.rssi + 95) / 60));
          return (
            <g key={i}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="#60a5fa" strokeOpacity={0.15 + 0.6 * fresh}
                strokeWidth={1 + 3 * strength} />
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 3}
                fontSize={10} className="fill-neutral-500" textAnchor="middle">
                {e.rssi} dBm
              </text>
            </g>
          );
        })}
        {layout.observers.map((o) => {
          const p = layout.pos.get(`o:${o}`)!;
          return (
            <g key={o}>
              <circle cx={p.x} cy={p.y} r={16} fill="#3b82f6" />
              <text x={p.x} y={p.y - 24} fontSize={11} textAnchor="middle"
                className="fill-neutral-300">{o.split(':').pop()}</text>
              <text x={p.x} y={p.y + 4} fontSize={10} textAnchor="middle"
                className="fill-white">◉</text>
            </g>
          );
        })}
        {layout.targets.map((t) => {
          const p = layout.pos.get(`t:${t}`)!;
          return (
            <g key={t}>
              <circle cx={p.x} cy={p.y} r={16} fill="#14b8a6" />
              <text x={p.x} y={p.y - 24} fontSize={11} textAnchor="middle"
                className="fill-neutral-300">{t.split(':').pop()}</text>
              <text x={p.x} y={p.y + 4} fontSize={10} textAnchor="middle"
                className="fill-white">◌</text>
            </g>
          );
        })}
      </svg>
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-xs">
        <p className="mb-2 font-medium text-neutral-300">
          Edge legend: width = RSSI, fade = age
        </p>
        {edges.map((e, i) => (
          <div key={i} className="mb-1 flex justify-between text-neutral-400">
            <span className="font-mono">{e.observer.split(':').pop()} → {e.target.split(':').pop()}</span>
            <span>{e.rssi} dBm · {Math.max(0, now - e.ts).toFixed(0)}s · ×{e.samples}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
