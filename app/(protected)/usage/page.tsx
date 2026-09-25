'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { useApi } from '@/hooks/useApi';
import { UsageRow, brainJson } from '@/lib/node-api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const KINDS = ['prediction', 'deploy', 'capture', 'automation', 'actuate', 'api'];
const SOURCES = ['api', 'portal', 'dashboard', 'mobile'];
const KIND_COLORS: Record<string, string> = {
  prediction: '#38bdf8',
  deploy: '#a78bfa',
  capture: '#f59e0b',
  automation: '#34d399',
  actuate: '#f472b6',
  api: '#94a3b8',
};

interface DeviceRow {
  device_uuid: string;
  device_name?: string;
  online?: boolean;
}

export default function UsagePage() {
  const { get } = useApi();
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [kind, setKind] = useState('');
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    get('/devices')
      .then((res) => setDevices(Array.isArray(res?.devices) ? res.devices : []))
      .catch(() => setDevices([]));
  }, [get]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const params = new URLSearchParams();
      if (deviceId) params.set('device_id', deviceId);
      if (kind) params.set('kind', kind);
      if (source) params.set('source', source);
      params.set('limit', '500');
      const res = await brainJson<{ usage?: UsageRow[] }>(`/usage?${params}`);
      setRows(res.usage || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'failed to load usage');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [deviceId, kind, source]);

  useEffect(() => {
    load();
  }, [load]);

  const deviceName = useCallback(
    (uuid: string) =>
      devices.find((d) => d.device_uuid === uuid)?.device_name || uuid,
    [devices],
  );

  const chart = useMemo(() => {
    const perKind = new Map<string, number>();
    const perDay = new Map<string, number>();
    for (const row of rows) {
      perKind.set(row.kind, (perKind.get(row.kind) || 0) + 1);
      const day = new Date(row.ts * 1000).toISOString().slice(0, 10);
      perDay.set(day, (perDay.get(day) || 0) + 1);
    }
    const days = Array.from(perDay.keys()).sort();
    return {
      kind: {
        labels: Array.from(perKind.keys()),
        datasets: [{
          label: 'calls',
          data: Array.from(perKind.values()),
          backgroundColor: Array.from(perKind.keys()).map((k) => KIND_COLORS[k] || '#94a3b8'),
        }],
      },
      daily: {
        labels: days,
        datasets: [{
          label: 'calls/day',
          data: days.map((d) => perDay.get(d) || 0),
          backgroundColor: '#0f172a',
        }],
      },
    };
  }, [rows]);

  const avgLatency = useMemo(() => {
    const lat = rows.filter((r) => r.latency_ms != null);
    if (!lat.length) return null;
    return Math.round(lat.reduce((a, r) => a + Number(r.latency_ms), 0) / lat.length);
  }, [rows]);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <BarChart3 className="h-5 w-5" /> API usage
          </h1>
          <p className="text-sm text-slate-500">
            Metered node/cloud API activity — prediction, deploy, capture, automation, actuate.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
          <option value="">All devices</option>
          {devices.map((d) => (
            <option key={d.device_uuid} value={d.device_uuid}>
              {d.device_name || d.device_uuid}
            </option>
          ))}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
          <option value="">All kinds</option>
          {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
          <option value="">All sources</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{err}</div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Calls by kind</h3>
          {rows.length ? (
            <Bar data={chart.kind} options={{ responsive: true, plugins: { legend: { display: false } } }} />
          ) : <p className="text-sm text-slate-500">No usage rows yet.</p>}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Calls per day</h3>
          {rows.length ? (
            <Bar data={chart.daily} options={{ responsive: true, plugins: { legend: { display: false } } }} />
          ) : <p className="text-sm text-slate-500">No usage rows yet.</p>}
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">{rows.length} rows</h3>
          {avgLatency != null && (
            <span className="text-xs text-slate-500">avg latency {avgLatency} ms</span>
          )}
        </div>
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">Device</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium">Kind</th>
                <th className="px-4 py-2 font-medium">Model</th>
                <th className="px-4 py-2 font-medium text-right">Latency</th>
                <th className="px-4 py-2 font-medium">Path</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-600">
                    {new Date(row.ts * 1000).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-800">{deviceName(row.device_id)}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5">{row.source}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className="rounded-full px-2 py-0.5 font-medium text-white"
                      style={{ backgroundColor: KIND_COLORS[row.kind] || '#94a3b8' }}
                    >
                      {row.kind}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-slate-600">{row.model_id || '—'}</td>
                  <td className="px-4 py-2 text-right text-slate-600">
                    {row.latency_ms != null ? `${Math.round(row.latency_ms)} ms` : '—'}
                  </td>
                  <td className="px-4 py-2 font-mono text-slate-500">
                    {String(row.meta?.method || '')} {String(row.meta?.path || '')}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No metered calls yet — relayed node calls record here automatically.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
