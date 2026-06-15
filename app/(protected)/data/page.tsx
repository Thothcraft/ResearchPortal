'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  Download,
  Eye,
  HardDrive,
  Radar,
  RefreshCw,
  Search,
  TriangleAlert,
  UploadCloud,
  Video,
  Wifi,
} from 'lucide-react';

type MinuteSummary = {
  minute: string;
  path: string;
  modified: string;
  created: string;
  deviceKey: string;
  deviceLabel: string;
  labels: string[];
  completed: boolean;
  uploaded: boolean;
  state: 'ready' | 'collecting';
  files: {
    video: boolean;
    radar: boolean;
    csi: boolean;
    manifest: boolean;
  };
  sizes: Record<string, number>;
  manifest?: any;
};

type MinuteDetail = MinuteSummary & {
  filePaths: Record<string, string | null>;
  previews: Record<string, string>;
};

const RADAR_PLOTS = [
  { key: 'range-doppler', label: 'Range-Doppler', description: 'Energy across range and velocity bins.' },
  { key: 'azimuth-range', label: 'Azimuth-Range', description: 'Angular spread across range bins.' },
  { key: 'azimuth-doppler', label: 'Azimuth-Doppler', description: 'Motion-aware angle view.' },
] as const;

function humanBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatStamp(value?: string | null): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  cells.push(current);
  return cells;
}

function parseCsiAverageSeries(text: string, limit = 5000): number[] {
  const series: number[] = [];
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return series;

  const firstLine = lines[0];
  if (firstLine.startsWith('{')) {
    for (const line of lines) {
      try {
        const row = JSON.parse(line);
        const raw = String(row.line || row.raw || row.raw_csi_line || '');
        if (!raw.startsWith('CSI_DATA,')) continue;
        const rawCells = splitCsvLine(raw);
        const values = parseCsiValues(rawCells[rawCells.length - 1]);
        if (values) series.push(values);
      } catch {
        continue;
      }
    }
    return series.slice(-limit);
  }

  const header = splitCsvLine(lines[0]);
  const dataIndex = header.indexOf('data');
  if (dataIndex < 0) return series;

  for (const line of lines.slice(1)) {
    if (!line.startsWith('CSI_DATA,')) continue;
    const row = splitCsvLine(line);
    const dataCell = row[dataIndex];
    const mean = parseCsiValues(dataCell);
    if (mean !== null) series.push(mean);
  }
  return series.slice(-limit);
}

function parseCsiValues(cell: string | undefined): number | null {
  if (!cell) return null;
  const cleaned = cell.trim().replace(/^\[/, '').replace(/\]$/, '');
  if (!cleaned) return null;

  const values = cleaned
    .split(',')
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (values.length < 2) return null;

  const magnitudes: number[] = [];
  for (let index = 0; index + 1 < values.length; index += 2) {
    const imag = values[index];
    const real = values[index + 1];
    magnitudes.push(Math.sqrt((real * real) + (imag * imag)));
  }
  if (!magnitudes.length) return null;
  return magnitudes.reduce((sum, value) => sum + value, 0) / magnitudes.length;
}

function CsiChart({ points }: { points: number[] }) {
  const width = 960;
  const height = 220;
  const padding = 18;

  if (!points.length) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
        CSI graph will appear here when the ESP32 serial log is available.
      </div>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const polyline = points
    .map((value, index) => {
      const x = padding + index * step;
      const y = height - padding - ((value - min) / span) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-950/95 p-4 text-white">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-100">Average subcarrier amplitude</div>
          <div className="text-xs text-slate-400">{points.length} packets rendered from the minute&apos;s CSI log</div>
        </div>
        <div className="text-right text-xs text-slate-400">
          <div>min {min.toFixed(1)}</div>
          <div>max {max.toFixed(1)}</div>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full">
        <rect x="0" y="0" width={width} height={height} rx="16" fill="rgba(15,23,42,0.96)" />
        <polyline fill="none" stroke="#60a5fa" strokeWidth="2.5" points={polyline} />
      </svg>
    </div>
  );
}

function FileBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${ok ? 'bg-emerald-500/10 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {label}
    </span>
  );
}

function normalize(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseLabels(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((label) => label.trim().replace(/\s+/g, ' '))
        .filter(Boolean)
    )
  );
}

export default function DataPage() {
  const searchParams = useSearchParams();
  const [minutes, setMinutes] = useState<MinuteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [uploadFilter, setUploadFilter] = useState<'all' | 'uploaded' | 'local'>('all');
  const [startMinute, setStartMinute] = useState('');
  const [endMinute, setEndMinute] = useState('');
  const [selectedMinute, setSelectedMinute] = useState<string | null>(null);
  const [selectedMinutes, setSelectedMinutes] = useState<string[]>([]);
  const [detail, setDetail] = useState<MinuteDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [csiSeries, setCsiSeries] = useState<number[]>([]);
  const [uploadingMinute, setUploadingMinute] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [labelBusy, setLabelBusy] = useState(false);

  const loadMinutes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/data/minutes', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load minute folders');
      }

      const list = Array.isArray(payload.minutes) ? payload.minutes : [];
      setMinutes(list);
      setSelectedMinute((current) => current && list.some((minute: MinuteSummary) => minute.minute === current) ? current : (searchParams.get('minute') || list[0]?.minute || null));
      setSelectedMinutes((current) => current.filter((minute) => list.some((item: MinuteSummary) => item.minute === minute)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load minute folders');
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  const loadMinuteDetail = useCallback(async (minute: string) => {
    setDetailLoading(true);
    setDetail(null);
    setCsiSeries([]);
    try {
      const response = await fetch(`/api/data/minutes/${minute}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load minute details');
      }

      const minuteDetail = payload.minute as MinuteDetail;
      setDetail(minuteDetail);

      const csiPath = minuteDetail.filePaths.csi_csv || minuteDetail.filePaths.csi_timestamped || minuteDetail.filePaths.csi_serial;
      if (minuteDetail.files.csi && csiPath) {
        const csiKind = minuteDetail.filePaths.csi_csv
          ? 'csi_csv'
          : minuteDetail.filePaths.csi_timestamped
            ? 'csi_timestamped'
            : 'csi_serial';
        const csiResponse = await fetch(`/api/data/minutes/${minute}/file/${csiKind}`, { cache: 'no-store' });
        const csiText = await csiResponse.text();
        if (csiResponse.ok) {
          setCsiSeries(parseCsiAverageSeries(csiText));
        }
      }
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const uploadMinute = useCallback(async (minute: string) => {
    setUploadingMinute(minute);
    try {
      const response = await fetch(`/api/data/minutes/${minute}/upload`, { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Upload failed');
      }
      await loadMinutes();
      if (selectedMinute === minute) {
        await loadMinuteDetail(minute);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingMinute(null);
    }
  }, [loadMinuteDetail, loadMinutes, selectedMinute]);

  const applyLabels = useCallback(async (minutesToLabel: string[], replace = false) => {
    const labels = parseLabels(labelInput);
    if (!labels.length || !minutesToLabel.length) {
      return;
    }

    setLabelBusy(true);
    try {
      const endpoint = minutesToLabel.length === 1
        ? `/api/data/minutes/${minutesToLabel[0]}/labels`
        : '/api/data/minutes/labels';
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(minutesToLabel.length === 1
          ? { labels, replace }
          : { minutes: minutesToLabel, labels, replace }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to update labels');
      }
      setLabelInput('');
      await loadMinutes();
      if (selectedMinute) {
        await loadMinuteDetail(selectedMinute);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update labels');
    } finally {
      setLabelBusy(false);
    }
  }, [labelInput, loadMinuteDetail, loadMinutes, selectedMinute]);

  useEffect(() => {
    loadMinutes();
  }, [loadMinutes]);

  useEffect(() => {
    if (selectedMinute) {
      loadMinuteDetail(selectedMinute);
    } else {
      setDetail(null);
      setCsiSeries([]);
    }
  }, [loadMinuteDetail, selectedMinute]);

  useEffect(() => {
    if (!selectedSummary || selectedSummary.state !== 'collecting') return;
    const timer = window.setInterval(() => {
      loadMinuteDetail(selectedSummary.minute);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [loadMinuteDetail, selectedSummary?.minute, selectedSummary?.state]);

  const deviceOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const minute of minutes) {
      const key = minute.deviceKey || normalize(minute.deviceLabel);
      if (!seen.has(key)) seen.set(key, minute.deviceLabel || minute.deviceKey || 'Unknown device');
    }
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [minutes]);

  const filteredMinutes = useMemo(() => {
    const q = query.trim().toLowerCase();
    const start = startMinute.trim();
    const end = endMinute.trim();
    return minutes.filter((minute) => {
      if (q && !(minute.minute.toLowerCase().includes(q) || minute.deviceLabel.toLowerCase().includes(q))) return false;
      if (deviceFilter !== 'all' && normalize(minute.deviceKey || minute.deviceLabel) !== deviceFilter) return false;
      if (uploadFilter === 'uploaded' && !minute.uploaded) return false;
      if (uploadFilter === 'local' && minute.uploaded) return false;
      if (start && minute.minute < start) return false;
      if (end && minute.minute > end) return false;
      return true;
    });
  }, [minutes, query, deviceFilter, uploadFilter, startMinute, endMinute]);

  const totals = useMemo(() => ({
    total: minutes.length,
    uploaded: minutes.filter((minute) => minute.uploaded).length,
    local: minutes.filter((minute) => !minute.uploaded).length,
    ready: minutes.filter((minute) => minute.completed).length,
  }), [minutes]);

  const selectedSummary = useMemo(
    () => minutes.find((minute) => minute.minute === selectedMinute) || null,
    [minutes, selectedMinute]
  );

  const groupedDeviceCount = deviceOptions.length;
  const selectedCount = selectedMinutes.length;

  const toggleSelectedMinute = (minute: string) => {
    setSelectedMinutes((current) => (
      current.includes(minute)
        ? current.filter((item) => item !== minute)
        : [...current, minute]
    ));
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Minute data</div>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">All minute folders</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Only timestamped folders from <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-900">/home/pi/Desktop/data</code> are shown.
              Filter by device, time range, and cloud sync status.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadMinutes}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <a
              href={selectedMinute ? `/api/data/minutes/${selectedMinute}/download` : '#'}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium ${selectedMinute ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'pointer-events-none bg-slate-200 text-slate-500'}`}
            >
              <Download className="h-4 w-4" />
              Download selected
            </a>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Total folders</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{totals.total}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Uploaded</div>
            <div className="mt-1 text-2xl font-semibold text-blue-700">{totals.uploaded}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Local</div>
            <div className="mt-1 text-2xl font-semibold text-amber-700">{totals.local}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Devices</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{groupedDeviceCount}</div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 lg:col-span-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search minute or device"
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
          <select
            value={deviceFilter}
            onChange={(event) => setDeviceFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
          >
            <option value="all">All devices</option>
            {deviceOptions.map((device) => (
              <option key={device.value} value={device.value}>{device.label}</option>
            ))}
          </select>
          <select
            value={uploadFilter}
            onChange={(event) => setUploadFilter(event.target.value as 'all' | 'uploaded' | 'local')}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
          >
            <option value="all">All sync states</option>
            <option value="uploaded">Uploaded</option>
            <option value="local">Local only</option>
          </select>
          <input
            value={startMinute}
            onChange={(event) => setStartMinute(event.target.value)}
            placeholder="Start minute YYYYMMDD_HHMM"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          <input
            value={endMinute}
            onChange={(event) => setEndMinute(event.target.value)}
            placeholder="End minute YYYYMMDD_HHMM"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <TriangleAlert className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wide text-slate-500">Labels</div>
            <input
              value={labelInput}
              onChange={(event) => setLabelInput(event.target.value)}
              placeholder="Add labels, comma separated"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => selectedMinute ? applyLabels([selectedMinute]) : undefined}
              disabled={!selectedMinute || !labelInput.trim() || labelBusy}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {labelBusy && selectedMinute ? 'Saving...' : 'Label selected minute'}
            </button>
            <button
              type="button"
              onClick={() => selectedMinutes.length ? applyLabels(selectedMinutes) : undefined}
              disabled={!selectedMinutes.length || !labelInput.trim() || labelBusy}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {labelBusy && selectedMinutes.length ? 'Saving...' : `Label ${selectedCount} selected`}
            </button>
            <button
              type="button"
              onClick={() => {
                setLabelInput('');
                setSelectedMinutes([]);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Clear
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {loading && minutes.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">Loading minute folders...</div>
        ) : (
          filteredMinutes.map((minute) => {
            const active = minute.minute === selectedMinute;
            return (
              <article
                key={minute.minute}
                className={`rounded-2xl border bg-white p-5 shadow-sm transition ${active ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedMinute(minute.minute)}
                  className="flex w-full items-start justify-between gap-4 text-left"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                      <input
                        type="checkbox"
                        checked={selectedMinutes.includes(minute.minute)}
                        onChange={() => toggleSelectedMinute(minute.minute)}
                        onClick={(event) => event.stopPropagation()}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <CalendarDays className="h-4 w-4" />
                      Minute folder
                    </div>
                    <h2 className="mt-2 truncate text-xl font-semibold text-slate-950">{minute.minute}</h2>
                    <div className="mt-1 text-sm text-slate-600">{minute.deviceLabel}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(minute.labels || []).length ? minute.labels.map((label) => (
                        <span key={label} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                          {label}
                        </span>
                      )) : (
                        <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-400">No labels</span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <FileBadge label="Video" ok={minute.files.video} />
                      <FileBadge label="Radar" ok={minute.files.radar} />
                      <FileBadge label="CSI" ok={minute.files.csi} />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${minute.uploaded ? 'bg-blue-500/10 text-blue-700' : 'bg-amber-500/10 text-amber-700'}`}>
                      <CloudIcon uploaded={minute.uploaded} />
                      {minute.uploaded ? 'Uploaded' : 'Local'}
                    </span>
                    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${minute.completed ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}>
                      <span className={`h-2 w-2 rounded-full ${minute.completed ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {minute.completed ? 'Ready' : 'Collecting'}
                    </span>
                    {active ? <ChevronUp className="h-5 w-5 text-slate-500" /> : <ChevronDown className="h-5 w-5 text-slate-500" />}
                  </div>
                </button>

                <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Updated</div>
                    <div className="mt-1 flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-slate-400" />
                      <span>{formatStamp(minute.manifest?.capture_finished || minute.modified)}</span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Size</div>
                    <div className="mt-1 flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-slate-400" />
                      <span>{humanBytes((minute.sizes.video || 0) + (minute.sizes.radar || 0) + (minute.sizes.csi_timestamped || 0) + (minute.sizes.csi_serial || 0))}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMinute(minute.minute)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                  <a href={`/api/data/minutes/${minute.minute}/download`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                  {!minute.uploaded && (
                    <button
                      type="button"
                      onClick={() => uploadMinute(minute.minute)}
                      disabled={uploadingMinute === minute.minute}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
                    >
                      <UploadCloud className="h-4 w-4" />
                      {uploadingMinute === minute.minute ? 'Uploading...' : 'Upload'}
                    </button>
                  )}
                </div>

                {active && detail && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Device</div>
                        <div className="mt-1 text-sm font-medium text-slate-900">{detail.deviceLabel}</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Radar</div>
                        <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-900">
                          <Radar className="h-4 w-4 text-slate-500" />
                          {detail.files.radar ? 'Available' : 'Missing'}
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">CSI</div>
                        <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-900">
                          <Wifi className="h-4 w-4 text-slate-500" />
                          {detail.files.csi ? 'Available' : 'Missing'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
        {!loading && filteredMinutes.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">No minute folders matched the current filters.</div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Selected minute</div>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">{selectedSummary?.minute || 'No minute selected'}</h2>
              {selectedSummary && (
                <p className="mt-1 text-sm text-slate-600">
                  {selectedSummary.deviceLabel} · {selectedSummary.uploaded ? 'uploaded' : 'local'} · {formatStamp(selectedSummary.manifest?.capture_finished || selectedSummary.modified)}
                </p>
              )}
            </div>
            {selectedSummary && (
              <div className={`rounded-full px-3 py-1 text-xs font-medium ${selectedSummary.completed ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}>
                {selectedSummary.completed ? 'Ready' : 'Collecting'}
              </div>
            )}
          </div>

          {!selectedSummary ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-sm text-slate-500">
              Pick a minute card to inspect the synchronized camera, radar, and CSI outputs.
            </div>
          ) : detailLoading && !detail ? (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-8 text-sm text-slate-500">Loading minute details...</div>
          ) : detail ? (
            <div className="mt-6 space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Video</div>
                  <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-900">
                    <Video className="h-4 w-4 text-slate-500" />
                    {detail.files.video ? 'Available' : 'Missing'}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Radar</div>
                  <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-900">
                    <Radar className="h-4 w-4 text-slate-500" />
                    {detail.files.radar ? 'Available' : 'Missing'}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">CSI</div>
                  <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-900">
                    <Wifi className="h-4 w-4 text-slate-500" />
                    {detail.files.csi ? 'Available' : 'Missing'}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-950 p-3">
                {detail.files.video ? (
                  <video controls className="w-full rounded-lg bg-black" src={`/api/data/minutes/${detail.minute}/file/video`} />
                ) : (
                  <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-700 text-sm text-slate-400">
                    No video file found in this minute.
                  </div>
                )}
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                {RADAR_PLOTS.map((plot) => (
                  <a
                    key={plot.key}
                    href={`/api/data/minutes/${detail.minute}/radar/${plot.key}`}
                    target="_blank"
                    rel="noreferrer"
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300"
                  >
                    <div className="border-b border-slate-200 px-4 py-3">
                      <div className="text-sm font-semibold text-slate-950">{plot.label}</div>
                      <div className="mt-1 text-xs text-slate-500">{plot.description}</div>
                    </div>
                    <img
                      src={`/api/data/minutes/${detail.minute}/radar/${plot.key}`}
                      alt={plot.label}
                      className="h-48 w-full object-cover"
                    />
                  </a>
                ))}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3">
                  <div className="text-sm font-semibold text-slate-950">CSI amplitude graph</div>
                  <div className="text-xs text-slate-500">Average amplitude across subcarriers, derived from the ESP32 receiver stream.</div>
                </div>
                <CsiChart points={csiSeries} />
              </div>
            </div>
          ) : null}
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Minute details</div>
          <div className="mt-1 text-lg font-semibold text-slate-950">Manifest and files</div>

          {detail ? (
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Files present</div>
                <div className="mt-3 space-y-2">
                  <FileBadge label="Manifest" ok={detail.files.manifest} />
                  <FileBadge label="Video MP4" ok={detail.files.video} />
                  <FileBadge label="Radar BIN" ok={detail.files.radar} />
                  <FileBadge label="CSI CSV/JSONL" ok={detail.files.csi} />
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Labels</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Array.isArray(detail.manifest?.labels) && detail.manifest.labels.length ? (
                    detail.manifest.labels.map((label) => (
                      <span key={label} className="rounded-full bg-indigo-600/10 px-2.5 py-1 text-xs font-medium text-indigo-700">{label}</span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">No labels yet.</span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => selectedSummary ? setLabelInput((selectedSummary.labels || []).join(', ')) : undefined}
                    disabled={!selectedSummary}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Load labels
                  </button>
                  <button
                    type="button"
                    onClick={() => selectedSummary ? applyLabels([selectedSummary.minute], true) : undefined}
                    disabled={!selectedSummary || !labelInput.trim() || labelBusy}
                    className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {labelBusy ? 'Saving...' : 'Replace minute labels'}
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Paths</div>
                <div className="mt-3 space-y-2 text-xs font-mono text-slate-600">
                  <div className="break-all">{detail.filePaths.video || 'Missing video'}</div>
                  <div className="break-all">{detail.filePaths.radar || 'Missing radar'}</div>
                  <div className="break-all">{detail.filePaths.csi_timestamped || 'Missing CSI timestamped CSV'}</div>
                  <div className="break-all">{detail.filePaths.csi_serial || 'Missing CSI serial log'}</div>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Manifest</div>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                  {detail.previews.manifest || JSON.stringify(detail.manifest || {}, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              Select a minute to inspect the capture files, derived plots, and download links.
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}

function CloudIcon({ uploaded }: { uploaded: boolean }) {
  return uploaded ? <span className="h-2 w-2 rounded-full bg-blue-500" /> : <span className="h-2 w-2 rounded-full bg-amber-500" />;
}
