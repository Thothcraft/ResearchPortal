'use client';

/**
 * Canonical minute timeline — powered exclusively by the Thoth v1 API.
 *
 * Data path: Thoth node `/api/v1/minutes*` → Portal route
 * `/api/v1/minutes*` → this page. No filesystem reads, no manifest.json
 * parsing — `lib/minutes-api.ts` + generated contract types only.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MinuteManifest } from '@/lib/contracts.generated';
import type {
  MinuteSummaryV1,
  SecondView,
} from '@/lib/minutes-api';
import { populatedSeconds } from '@/lib/minutes-api';

function fmtTime(ts?: number | null): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleTimeString();
}

export default function HubMinutesPage() {
  const [minutes, setMinutes] = useState<MinuteSummaryV1[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [minute, setMinute] = useState<MinuteManifest | null>(null);
  const [selectedSeconds, setSelectedSeconds] = useState<number[]>([]);
  const [secondViews, setSecondViews] = useState<Record<number, SecondView>>({});
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetch('/api/v1/minutes', { cache: 'no-store' })
      .then((r) => r.json())
      .then((body) => {
        if (!body.success) throw new Error(body.error || 'list failed');
        setMinutes(body.minutes || []);
        if (body.minutes?.length) setSelectedId(body.minutes[0].minute_id);
      })
      .catch((e) => setError(String(e?.message || e)));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setMinute(null);
    setSecondViews({});
    setSelectedSeconds([]);
    fetch(`/api/v1/minutes/${encodeURIComponent(selectedId)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((body) => {
        if (!body.success) throw new Error(body.error || 'fetch failed');
        setMinute(body.minute as MinuteManifest);
      })
      .catch((e) => setError(String(e?.message || e)));
  }, [selectedId]);

  const seconds = useMemo(() => (minute ? populatedSeconds(minute) : []), [minute]);

  const toggleSecond = useCallback(
    (idx: number) => {
      if (!selectedId) return;
      setSelectedSeconds((prev) => {
        const next = prev.includes(idx)
          ? prev.filter((s) => s !== idx)
          : [...prev, idx].slice(-3); // keep at most three selected
        return next;
      });
      setSecondViews((prev) => {
        if (prev[idx]) return prev;
        fetch(
          `/api/v1/minutes/${encodeURIComponent(selectedId)}/seconds/${idx}`,
          { cache: 'no-store' },
        )
          .then((r) => r.json())
          .then((body) => {
            if (body.success) {
              setSecondViews((p) => ({ ...p, [idx]: body.second as SecondView }));
            }
          })
          .catch(() => undefined);
        return prev;
      });
    },
    [selectedId],
  );

  const predictions = (minute?.predictions as any[]) ?? [];
  const sources = (minute?.sources as any[]) ?? [];
  const quality = (minute?.quality ?? {}) as any;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Minutes (v1 API)</h1>
        <p className="text-sm text-slate-500">
          Canonical thoth-minute/v1 data served by the Thoth node API — no
          filesystem access.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Minute</label>
        <select
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {minutes.map((m) => (
            <option key={m.minute_id} value={m.minute_id}>
              {m.minute_id} — {m.device_id}
            </option>
          ))}
        </select>
        {minute && (
          <span className="text-xs text-slate-500">
            {minute.format} · {fmtTime(minute.start_timestamp)}–
            {fmtTime(minute.end_timestamp)} · {minute.duration_seconds ?? '—'}s
          </span>
        )}
      </div>

      {minute && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Sources</h2>
              <ul className="space-y-1 text-sm text-slate-600">
                {sources.map((s: any, i: number) => (
                  <li key={i}>
                    <span className="font-mono">{s.source_id}</span>
                    <span className="text-slate-400"> · {s.modality || 'source'}</span>
                    {s.metadata?.sample_count != null && (
                      <span className="text-slate-400">
                        {' '}· {String(s.metadata.sample_count)} samples
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Quality</h2>
              <ul className="space-y-1 text-sm text-slate-600">
                <li>status: {String(quality.status ?? '—')}</li>
                <li>
                  expected seconds: {String(quality.expected_seconds ?? '—')} ·
                  recorded: {seconds.length}
                </li>
                <li>warnings: {(quality.warnings || []).length} · errors: {(quality.errors || []).length}</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Predictions</h2>
              <ul className="space-y-1 text-sm text-slate-600">
                {predictions.slice(0, 5).map((p: any, i: number) => (
                  <li key={i}>
                    <span className="font-mono">{String(p.prediction ?? p.label ?? '?')}</span>
                    {p.confidence != null && (
                      <span className="text-slate-400"> · {Number(p.confidence).toFixed(2)}</span>
                    )}
                    {p.second_index != null && (
                      <span className="text-slate-400"> · s{p.second_index}</span>
                    )}
                  </li>
                ))}
                {predictions.length === 0 && <li className="text-slate-400">none</li>}
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">
              Second timeline <span className="font-normal text-slate-400">(select up to 3)</span>
            </h2>
            <div className="flex flex-wrap gap-1">
              {seconds.map((idx) => {
                const active = selectedSeconds.includes(idx);
                return (
                  <button
                    key={idx}
                    onClick={() => toggleSecond(idx)}
                    className={`h-8 w-8 rounded text-xs font-mono transition-colors ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                    title={`second ${idx}`}
                  >
                    {idx}
                  </button>
                );
              })}
              {seconds.length === 0 && (
                <span className="text-sm text-slate-400">no populated seconds</span>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {selectedSeconds.map((idx) => {
              const view = secondViews[idx];
              return (
                <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="mb-2 text-sm font-semibold text-slate-800">
                    Second {idx}
                  </h3>
                  {!view ? (
                    <p className="text-sm text-slate-400">loading…</p>
                  ) : (
                    <pre className="max-h-64 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-700">
                      {JSON.stringify(view, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
