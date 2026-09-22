'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';

interface Zone { id: number; name: string; polygon: [number, number][] }
interface Placement {
  device_id: string; device_name: string; space_id: number;
  x: number; y: number; rotation_deg: number; fov_deg: number; range_m: number;
}
interface Space {
  id: number; name: string; parent_id: number | null;
  width_m: number | null; height_m: number | null;
  zones: Zone[]; devices: Placement[];
}
interface ZoneState { occupied: boolean; people_count: number; confidence: number }
interface SpaceState {
  space_id: number; name: string; occupied: boolean;
  people_count: number; confidence: number;
  zones: Record<string, ZoneState>; last_activity: string | null;
}
interface DeviceInfo { device_id: string; device_name: string; online: boolean }

const PLAN_W = 10; // meters, default plan extents
const PLAN_H = 8;
const SCALE = 60;  // px per meter

export default function SpacesPage() {
  const { get, post, put, del } = useApi();
  const { user } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [states, setStates] = useState<Record<number, SpaceState>>({});
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selected, setSelected] = useState<Space | null>(null);
  const [newName, setNewName] = useState('');
  const [drawing, setDrawing] = useState<[number, number][]>([]);
  const [zoneName, setZoneName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const load = useCallback(async () => {
    try {
      const [sp, st, dev] = await Promise.all([
        get('/spaces'), get('/spaces/state'), get('/device'),
      ]);
      setSpaces(sp.spaces || []);
      const map: Record<number, SpaceState> = {};
      for (const s of st.spaces || []) map[s.space_id] = s;
      setStates(map);
      setDevices(dev.devices || dev || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load spaces');
    }
  }, [get]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const st = await get('/spaces/state');
        const map: Record<number, SpaceState> = {};
        for (const s of st.spaces || []) map[s.space_id] = s;
        setStates(map);
      } catch { /* keep last state */ }
    }, 5000);
    return () => clearInterval(t);
  }, [get]);

  const createSpace = async () => {
    if (!newName.trim()) return;
    try {
      const res = await post('/spaces', { name: newName.trim(), width_m: PLAN_W, height_m: PLAN_H });
      setNewName('');
      await load();
      if (res.space) setSelected(res.space);
    } catch (e: any) { setError(e?.message || 'Create failed'); }
  };

  const toPlan = (e: React.MouseEvent): [number, number] => {
    const rect = svgRef.current!.getBoundingClientRect();
    return [
      Math.round(((e.clientX - rect.left) / SCALE) * 10) / 10,
      Math.round(((e.clientY - rect.top) / SCALE) * 10) / 10,
    ];
  };

  const onPlanClick = (e: React.MouseEvent) => {
    if (!selected) return;
    setDrawing((pts) => [...pts, toPlan(e)]);
  };

  const saveZone = async () => {
    if (!selected || !zoneName.trim() || drawing.length < 3) return;
    try {
      await post(`/spaces/${selected.id}/zones`, { name: zoneName.trim(), polygon: drawing });
      setDrawing([]); setZoneName('');
      await load();
      const fresh = await get(`/spaces/${selected.id}`);
      setSelected(fresh.space);
    } catch (e: any) { setError(e?.message || 'Zone save failed'); }
  };

  const placeDevice = async (deviceId: string, x: number, y: number) => {
    try {
      await put(`/spaces/devices/${deviceId}/placement`, {
        space_id: selected!.id, x, y, rotation_deg: 0, fov_deg: 90, range_m: 8,
      });
      await load();
      const fresh = await get(`/spaces/${selected!.id}`);
      setSelected(fresh.space);
    } catch (e: any) { setError(e?.message || 'Placement failed'); }
  };

  const deleteSpace = async (id: number) => {
    await del(`/spaces/${id}`);
    if (selected?.id === id) setSelected(null);
    await load();
  };

  const state = selected ? states[selected.id] : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Spaces</h1>
          <p className="text-sm text-neutral-400">
            Named areas with zones and placed devices — live occupancy state.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="New space name"
            className="rounded bg-neutral-800 px-3 py-2 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && createSpace()}
          />
          <button onClick={createSpace}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500">
            Create
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* space list */}
        <div className="space-y-2">
          {spaces.map((s) => {
            const st = states[s.id];
            return (
              <button key={s.id} onClick={() => setSelected(s)}
                className={`flex w-full items-center justify-between rounded border px-4 py-3 text-left ${
                  selected?.id === s.id ? 'border-blue-500 bg-neutral-800' : 'border-neutral-700 bg-neutral-900'
                }`}>
                <span>
                  <span className={st?.occupied ? 'text-green-400' : 'text-neutral-500'}>
                    {st?.occupied ? '●' : '○'}
                  </span>{' '}
                  {s.name}
                </span>
                <span className="text-xs text-neutral-400">
                  {st ? `${st.people_count} people` : ''} · {s.zones.length} zones
                </span>
              </button>
            );
          })}
          {spaces.length === 0 && (
            <p className="text-sm text-neutral-500">No spaces yet — create one above.</p>
          )}
        </div>

        {/* floor plan */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">{selected.name}</h2>
                <button onClick={() => deleteSpace(selected.id)}
                  className="text-xs text-red-400 hover:underline">Delete space</button>
              </div>

              <svg ref={svgRef} onClick={onPlanClick}
                width={(selected.width_m || PLAN_W) * SCALE}
                height={(selected.height_m || PLAN_H) * SCALE}
                className="cursor-crosshair rounded border border-neutral-700 bg-neutral-950">
                {/* grid */}
                {Array.from({ length: Math.floor(selected.width_m || PLAN_W) + 1 }, (_, i) => (
                  <line key={`v${i}`} x1={i * SCALE} y1={0} x2={i * SCALE}
                    y2={(selected.height_m || PLAN_H) * SCALE} stroke="#262626" />
                ))}
                {Array.from({ length: Math.floor(selected.height_m || PLAN_H) + 1 }, (_, i) => (
                  <line key={`h${i}`} x1={0} y1={i * SCALE}
                    x2={(selected.width_m || PLAN_W) * SCALE} y2={i * SCALE} stroke="#262626" />
                ))}
                {/* zones */}
                {selected.zones.map((z) => {
                  const zs = state?.zones?.[z.name];
                  return (
                    <g key={z.id}>
                      <polygon
                        points={z.polygon.map(([x, y]) => `${x * SCALE},${y * SCALE}`).join(' ')}
                        fill={zs?.occupied ? 'rgba(34,197,94,0.25)' : 'rgba(59,130,246,0.15)'}
                        stroke={zs?.occupied ? '#22c55e' : '#3b82f6'} strokeWidth={1.5} />
                      <text x={z.polygon[0][0] * SCALE + 4} y={z.polygon[0][1] * SCALE + 14}
                        className="fill-neutral-300" fontSize={11}>
                        {z.name}{zs?.occupied ? ` (${zs.people_count})` : ''}
                      </text>
                    </g>
                  );
                })}
                {/* in-progress polygon */}
                {drawing.length > 0 && (
                  <polyline
                    points={drawing.map(([x, y]) => `${x * SCALE},${y * SCALE}`).join(' ')}
                    fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4" />
                )}
                {/* device markers + FOV cones */}
                {selected.devices.map((d) => {
                  const cx = d.x * SCALE, cy = d.y * SCALE;
                  const half = (d.fov_deg / 2) * (Math.PI / 180);
                  const rot = d.rotation_deg * (Math.PI / 180);
                  const r = d.range_m * SCALE;
                  const a1 = rot - half - Math.PI / 2, a2 = rot + half - Math.PI / 2;
                  return (
                    <g key={d.device_id}>
                      <path
                        d={`M ${cx} ${cy} L ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(a2)} ${cy + r * Math.sin(a2)} Z`}
                        fill="rgba(168,85,247,0.12)" stroke="#a855f7" strokeWidth={1} />
                      <circle cx={cx} cy={cy} r={6} fill="#a855f7" />
                      <text x={cx + 9} y={cy + 4} fontSize={11} className="fill-neutral-300">
                        {d.device_name}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* zone creation */}
              <div className="flex items-center gap-2 text-sm">
                <input value={zoneName} onChange={(e) => setZoneName(e.target.value)}
                  placeholder="Zone name" className="rounded bg-neutral-800 px-3 py-1.5" />
                <span className="text-neutral-400">
                  {drawing.length ? `${drawing.length} points` : 'Click the plan to draw a zone'}
                </span>
                <button onClick={saveZone} disabled={drawing.length < 3 || !zoneName.trim()}
                  className="rounded bg-blue-600 px-3 py-1.5 disabled:opacity-40">Save zone</button>
                <button onClick={() => setDrawing([])}
                  className="rounded bg-neutral-700 px-3 py-1.5">Clear</button>
              </div>

              {/* device placement */}
              <div className="text-sm">
                <p className="mb-1 text-neutral-400">Assign device (click sets position):</p>
                <div className="flex flex-wrap gap-2">
                  {devices.map((d) => (
                    <button key={d.device_id}
                      onClick={() => placeDevice(d.device_id, 1, 1)}
                      className="rounded border border-neutral-700 px-3 py-1 hover:border-purple-500">
                      {d.device_name} {d.online ? '🟢' : '⚫'}
                    </button>
                  ))}
                </div>
              </div>

              {/* live state */}
              {state && (
                <pre className="overflow-auto rounded bg-neutral-900 p-3 text-xs text-neutral-300">
                  {JSON.stringify(state, null, 2)}
                </pre>
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">Select a space to view its floor plan.</p>
          )}
        </div>
      </div>
    </div>
  );
}
