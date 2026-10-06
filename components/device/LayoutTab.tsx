'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import {
  BuildingAnchor,
  RoomDoc,
  RoomSpatial,
  V3,
  nodeGet,
  nodePut,
} from '@/lib/node-api';

/**
 * Layout tab — edits the node's room/v1 document: shared building anchor
 * (house geolocation), per-room spatial anchor (floor / heading / ENU
 * origin / surveyed flag), room dimensions, and device anchor positions
 * with position uncertainty. Saves via PUT /api/v1/room; the node
 * normalizes + persists and pushes the doc to Brain.
 */

const inputCls =
  'w-full rounded-md border border-slate-200 px-2 py-1 text-xs ' +
  'focus:border-slate-400 focus:outline-none';
const labelCls = 'block text-[11px] font-medium text-slate-500';

function Num({
  label,
  value,
  step = 0.1,
  onChange,
}: {
  label: string;
  value: number | null | undefined;
  step?: number;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="flex-1">
      <span className={labelCls}>{label}</span>
      <input
        type="number"
        step={step}
        className={inputCls}
        value={value ?? ''}
        onChange={(e) => {
          const t = e.target.value;
          onChange(t === '' ? null : Number(t));
        }}
      />
    </label>
  );
}

interface RoomEdit {
  room_id: string;
  name: string;
  dims: { w: number | null; d: number | null; h: number | null };
  spatial: {
    floor: number | null;
    heading_deg: number | null;
    x: number | null;
    y: number | null;
    z: number | null;
    surveyed: boolean;
  };
  isPrimary: boolean;
}

interface DevEdit {
  device_id: string;
  room_id: string;
  x: number | null;
  y: number | null;
  z: number | null;
  rot_y_deg: number | null;
  mount: string;
  uncertainty: number | null;
  sensors?: Array<{
    type: string;
    pos: V3;
    rot_y?: number;
    tilt?: number;
    fov_deg?: number;
    range_m?: number;
  }>;
}

function roomToEdit(
  doc: RoomDoc,
  roomId: string,
  isPrimary: boolean,
): RoomEdit {
  const base = isPrimary
    ? { room_id: doc.room_id || '', name: doc.name || '',
        dims: doc.dims, spatial: doc.spatial }
    : (() => {
        const r = (doc.rooms ?? []).find((x) => x.room_id === roomId);
        return { room_id: r?.room_id || roomId, name: r?.name || '',
                 dims: r?.dims, spatial: r?.spatial };
      })();
  const sp = base.spatial;
  return {
    room_id: base.room_id,
    name: base.name,
    dims: { w: base.dims?.w ?? null, d: base.dims?.d ?? null,
            h: base.dims?.h ?? null },
    spatial: {
      floor: sp?.floor ?? null,
      heading_deg: sp?.heading_deg ?? null,
      x: sp?.origin_enu_m?.[0] ?? null,
      y: sp?.origin_enu_m?.[1] ?? null,
      z: sp?.origin_enu_m?.[2] ?? null,
      surveyed: Boolean(sp?.surveyed),
    },
    isPrimary,
  };
}

function docToEdits(doc: RoomDoc): {
  rooms: RoomEdit[];
  devices: DevEdit[];
  building: {
    id: string;
    name: string;
    lat: number | null;
    lon: number | null;
    alt: number | null;
  };
} {
  const primaryId = doc.room_id || '';
  const rooms: RoomEdit[] = [roomToEdit(doc, primaryId, true)];
  for (const r of doc.rooms ?? [])
    rooms.push(roomToEdit(doc, r.room_id, false));
  const devices: DevEdit[] = (doc.devices ?? []).map((d) => ({
    device_id: d.device_id,
    room_id: d.room_id || primaryId,
    x: d.pos?.[0] ?? null,
    y: d.pos?.[1] ?? null,
    z: d.pos?.[2] ?? null,
    rot_y_deg:
      d.rot_y != null
        ? (Math.abs(d.rot_y) > Math.PI * 2
            ? d.rot_y
            : (d.rot_y * 180) / Math.PI)
        : null,
    mount: d.mount || '',
    uncertainty: d.position_uncertainty_m ?? null,
    sensors: d.sensors,
  }));
  const b = doc.building;
  return {
    rooms,
    devices,
    building: {
      id: b?.id || '',
      name: b?.name || '',
      lat: b?.anchor?.latitude ?? null,
      lon: b?.anchor?.longitude ?? null,
      alt: b?.anchor?.altitude_m ?? null,
    },
  };
}

export function LayoutTab({
  deviceId,
  cachedRoom,
  onSaved,
}: {
  deviceId: string;
  cachedRoom: RoomDoc | null;
  onSaved?: (doc: RoomDoc) => void;
}) {
  const [doc, setDoc] = useState<RoomDoc | null>(cachedRoom);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [build, setBuild] = useState({
    id: '', name: '',
    lat: null as number | null,
    lon: null as number | null,
    alt: null as number | null,
  });
  const [rooms, setRooms] = useState<RoomEdit[]>([]);
  const [devices, setDevices] = useState<DevEdit[]>([]);

  const applyDoc = useCallback((d: RoomDoc) => {
    setDoc(d);
    const e = docToEdits(d);
    setBuild(e.building);
    setRooms(e.rooms);
    setDevices(e.devices);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      // Authoritative doc straight from the node (relay), not Brain cache.
      const res = await nodeGet<{ room?: RoomDoc } | RoomDoc>(
        deviceId, '/api/v1/room');
      const d = ((res as { room?: RoomDoc })?.room ?? res) as RoomDoc;
      applyDoc(d);
    } catch (e) {
      if (cachedRoom) applyDoc(cachedRoom);
      setErr(e instanceof Error ? e.message : 'room fetch failed');
    } finally {
      setLoading(false);
    }
  }, [deviceId, cachedRoom, applyDoc]);

  useEffect(() => { void load(); }, [load]);

  const addDevice = useCallback((devId: string) => {
    if (!devId || devices.some((d) => d.device_id === devId)) return;
    setDevices((prev) => [...prev, {
      device_id: devId,
      room_id: rooms[0]?.room_id || '',
      x: 0, y: 0, z: 0,
      rot_y_deg: null,
      mount: 'table',
      uncertainty: 0.5,
      sensors: [],
    }]);
  }, [devices, rooms]);

  const save = useCallback(async () => {
    if (!doc) return;
    setSaving(true);
    setMsg('');
    setErr('');
    try {
      const primary = rooms.find((r) => r.isPrimary);
      const spatial = (r: RoomEdit): RoomSpatial | undefined => {
        const origin = r.spatial.x != null && r.spatial.y != null
          && r.spatial.z != null
          ? [r.spatial.x, r.spatial.y, r.spatial.z] as V3
          : null;
        const out: RoomSpatial = {
          surveyed: r.spatial.surveyed,
          floor: r.spatial.floor,
          heading_deg: r.spatial.heading_deg,
          origin_enu_m: origin,
        };
        return out;
      };
      const building: BuildingAnchor | undefined = build.id || build.name ||
        build.lat != null || build.lon != null || build.alt != null
        ? {
            id: build.id || undefined,
            name: build.name || undefined,
            anchor: build.lat != null && build.lon != null
              ? { latitude: build.lat, longitude: build.lon,
                  altitude_m: build.alt }
              : undefined,
          }
        : undefined;
      const body: RoomDoc = {
        ...doc,
        format: 'room/v1',
        room_id: primary?.room_id ?? doc.room_id,
        name: primary?.name ?? doc.name,
        dims: primary && primary.dims.w != null && primary.dims.d != null
              && primary.dims.h != null
          ? { w: primary.dims.w, d: primary.dims.d, h: primary.dims.h }
          : doc.dims,
        spatial: primary ? spatial(primary) : doc.spatial,
        building: building ?? doc.building,
        rooms: rooms.filter((r) => !r.isPrimary).map((r) => ({
          room_id: r.room_id,
          name: r.name || undefined,
          dims: r.dims.w != null && r.dims.d != null && r.dims.h != null
            ? { w: r.dims.w, d: r.dims.d, h: r.dims.h }
            : undefined,
          spatial: spatial(r),
          walls: (doc.rooms ?? []).find(
            (x) => x.room_id === r.room_id)?.walls,
          furniture: (doc.rooms ?? []).find(
            (x) => x.room_id === r.room_id)?.furniture,
        })),
        devices: devices.map((d) => ({
          device_id: d.device_id,
          room_id: d.room_id || undefined,
          pos: [d.x ?? 0, d.y ?? 0, d.z ?? 0] as V3,
          rot_y: d.rot_y_deg != null
            ? (d.rot_y_deg * Math.PI) / 180 : undefined,
          mount: d.mount || undefined,
          position_uncertainty_m: d.uncertainty,
          sensors: d.sensors,
        })),
      };
      const res = await nodePut<{ room?: RoomDoc } | RoomDoc>(
        deviceId, '/api/v1/room', body);
      const saved = ((res as { room?: RoomDoc })?.room ?? res) as RoomDoc;
      applyDoc(saved && typeof saved === 'object' ? saved : body);
      onSaved?.(saved && typeof saved === 'object' ? saved : body);
      setMsg('Saved — node normalized and synced the room doc.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'save failed');
    } finally {
      setSaving(false);
    }
  }, [doc, rooms, devices, build, deviceId, applyDoc, onSaved]);

  const roomOpts = useMemo(
    () => rooms.map((r) => ({ id: r.room_id, name: r.name || 'main room' })),
    [rooms],
  );

  if (loading && !doc) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-slate-200 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading room doc…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {err && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {err}
        </div>
      )}
      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {msg}
        </div>
      )}

      {/* Building anchor — shared across all nodes in the house */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-900">
          House anchor <span className="font-normal text-slate-400">(building)</span>
        </h3>
        <p className="mb-3 text-xs text-slate-500">
          One geographic origin shared by every node in the house — each
          room&apos;s ENU origin and heading are relative to it.
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <label>
            <span className={labelCls}>Building id</span>
            <input className={inputCls} value={build.id}
              placeholder="house-1"
              onChange={(e) => setBuild({ ...build, id: e.target.value })} />
          </label>
          <label>
            <span className={labelCls}>Name</span>
            <input className={inputCls} value={build.name}
              placeholder="Home"
              onChange={(e) => setBuild({ ...build, name: e.target.value })} />
          </label>
          <Num label="Latitude" value={build.lat} step={0.000001}
            onChange={(v) => setBuild({ ...build, lat: v })} />
          <Num label="Longitude" value={build.lon} step={0.000001}
            onChange={(v) => setBuild({ ...build, lon: v })} />
          <Num label="Altitude m" value={build.alt}
            onChange={(v) => setBuild({ ...build, alt: v })} />
        </div>
      </section>

      {/* Per-room spatial + dims */}
      {rooms.map((r, i) => (
        <section key={r.room_id || 'primary'}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            Room — {r.name || r.room_id || 'main room'}
            {r.isPrimary &&
              <span className="ml-2 text-xs font-normal text-slate-400">primary</span>}
          </h3>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <label className="col-span-2">
              <span className={labelCls}>Room name</span>
              <input className={inputCls} value={r.name}
                onChange={(e) => setRooms((prev) => prev.map((x, j) =>
                  j === i ? { ...x, name: e.target.value } : x))} />
            </label>
            <Num label="Width m" value={r.dims.w}
              onChange={(v) => setRooms((prev) => prev.map((x, j) =>
                j === i ? { ...x, dims: { ...x.dims, w: v } } : x))} />
            <Num label="Depth m" value={r.dims.d}
              onChange={(v) => setRooms((prev) => prev.map((x, j) =>
                j === i ? { ...x, dims: { ...x.dims, d: v } } : x))} />
            <Num label="Height m" value={r.dims.h}
              onChange={(v) => setRooms((prev) => prev.map((x, j) =>
                j === i ? { ...x, dims: { ...x.dims, h: v } } : x))} />
            <Num label="Floor" value={r.spatial.floor} step={1}
              onChange={(v) => setRooms((prev) => prev.map((x, j) =>
                j === i ? { ...x, spatial: { ...x.spatial, floor: v } } : x))} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-6">
            <Num label="Heading ° (cw from N)" value={r.spatial.heading_deg} step={1}
              onChange={(v) => setRooms((prev) => prev.map((x, j) =>
                j === i ? { ...x, spatial: { ...x.spatial, heading_deg: v } } : x))} />
            <Num label="ENU origin E m" value={r.spatial.x}
              onChange={(v) => setRooms((prev) => prev.map((x, j) =>
                j === i ? { ...x, spatial: { ...x.spatial, x: v } } : x))} />
            <Num label="ENU origin N m" value={r.spatial.y}
              onChange={(v) => setRooms((prev) => prev.map((x, j) =>
                j === i ? { ...x, spatial: { ...x.spatial, y: v } } : x))} />
            <Num label="ENU origin U m" value={r.spatial.z}
              onChange={(v) => setRooms((prev) => prev.map((x, j) =>
                j === i ? { ...x, spatial: { ...x.spatial, z: v } } : x))} />
            <label className="col-span-2 flex items-end gap-2 pb-1">
              <input type="checkbox" checked={r.spatial.surveyed}
                onChange={(e) => setRooms((prev) => prev.map((x, j) =>
                  j === i ? { ...x,
                    spatial: { ...x.spatial, surveyed: e.target.checked } }
                    : x))}
                className="h-4 w-4 rounded border-slate-300" />
              <span className="text-xs text-slate-600">
                Measured dims and room anchor confirmed
              </span>
            </label>
          </div>
        </section>
      ))}

      {/* Device anchors */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-900">
          Device anchors
        </h3>
        <p className="mb-3 text-xs text-slate-500">
          Each node&apos;s position in its room (metres, origin at floor
          centre) plus position uncertainty — the map fuses every node&apos;s
          devices into one anchored layout.
        </p>
        {devices.length === 0 && (
          <p className="mb-3 text-xs text-slate-500">No devices anchored yet.</p>
        )}
        <div className="space-y-3">
          {devices.map((d, i) => (
            <div key={d.device_id}
              className="grid grid-cols-2 items-end gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 lg:grid-cols-9">
              <div className="col-span-2">
                <span className={labelCls}>Device</span>
                <p className="truncate font-mono text-xs text-slate-800"
                  title={d.device_id}>{d.device_id}</p>
              </div>
              <label>
                <span className={labelCls}>Room</span>
                <select className={inputCls} value={d.room_id}
                  onChange={(e) => setDevices((prev) => prev.map((x, j) =>
                    j === i ? { ...x, room_id: e.target.value } : x))}>
                  {roomOpts.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>))}
                </select>
              </label>
              {(['x', 'y', 'z'] as const).map((axis) => (
                <Num key={axis} label={`${axis.toUpperCase()} m`}
                  value={d[axis]}
                  onChange={(v) => setDevices((prev) => prev.map((x, j) =>
                    j === i ? { ...x, [axis]: v } : x))} />
              ))}
              <Num label="Yaw °" value={d.rot_y_deg} step={1}
                onChange={(v) => setDevices((prev) => prev.map((x, j) =>
                  j === i ? { ...x, rot_y_deg: v } : x))} />
              <Num label="Unc. ±m" value={d.uncertainty}
                onChange={(v) => setDevices((prev) => prev.map((x, j) =>
                  j === i ? { ...x, uncertainty: v } : x))} />
              <div className="flex gap-1">
                <label className="flex-1">
                  <span className={labelCls}>Mount</span>
                  <select className={inputCls} value={d.mount}
                    onChange={(e) => setDevices((prev) => prev.map((x, j) =>
                      j === i ? { ...x, mount: e.target.value } : x))}>
                    {['', 'wall', 'table', 'floor', 'ceiling'].map((m) => (
                      <option key={m} value={m}>{m || '—'}</option>))}
                  </select>
                </label>
                <button type="button"
                  onClick={() => setDevices((prev) =>
                    prev.filter((_, j) => j !== i))}
                  className="self-end rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
        <AddDeviceRow onAdd={addDevice} />
      </section>

      <div className="flex items-center gap-3">
        <button type="button" onClick={() => void save()} disabled={saving || !doc}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
          {saving
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Save className="h-4 w-4" />}
          Save layout
        </button>
        <button type="button" onClick={() => void load()} disabled={loading}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          Reload from node
        </button>
      </div>
    </div>
  );
}

function AddDeviceRow({ onAdd }: { onAdd: (id: string) => void }) {
  const [id, setId] = useState('');
  return (
    <div className="mt-3 flex items-center gap-2">
      <input
        className="w-72 rounded-md border border-slate-200 px-2 py-1 text-xs"
        placeholder="device_id (uuid or sensor id) — add anchor"
        value={id}
        onChange={(e) => setId(e.target.value)}
      />
      <button type="button"
        onClick={() => { onAdd(id.trim()); setId(''); }}
        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
        Add anchor
      </button>
    </div>
  );
}
