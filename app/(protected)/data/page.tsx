'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Brain, Clock, Database, RefreshCw, Sparkles } from 'lucide-react';

type TimelineEntry = {
  minute: string;
  minuteName: string;
  generated_at?: string;
  labels?: string[];
  model_name: string;
  data_type?: string;
  prediction?: string | number | boolean | null;
  probability?: number | null;
  confidence?: number | null;
  status?: string;
  error?: string;
};

type TimelineResponse = {
  success: boolean;
  timelines: Record<string, TimelineEntry[]>;
  modelCount?: number;
  error?: string;
};

function formatMinute(value: string) {
  const match = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day, hour, minute] = match;
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function confidenceFor(entry: TimelineEntry) {
  const value = typeof entry.confidence === 'number' ? entry.confidence : entry.probability;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function predictionLabel(entry: TimelineEntry) {
  if (entry.status === 'skipped') return 'Skipped';
  if (entry.status === 'error') return 'Error';
  if (entry.prediction === true) return 'occupied';
  if (entry.prediction === false) return 'empty';
  return entry.prediction ?? 'No prediction';
}

export default function DataPage() {
  const [timelines, setTimelines] = useState<Record<string, TimelineEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadTimelines() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/data/predictions', { cache: 'no-store' });
      const data = (await response.json()) as TimelineResponse;
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load predictions');
      setTimelines(data.timelines || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load predictions');
      setTimelines({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTimelines();
    const id = window.setInterval(loadTimelines, 30000);
    return () => window.clearInterval(id);
  }, []);

  const modelGroups = useMemo(() => Object.entries(timelines), [timelines]);
  const totalPredictions = modelGroups.reduce((sum, [, entries]) => sum + entries.length, 0);
  const latest = modelGroups
    .flatMap(([, entries]) => entries)
    .sort((a, b) => b.minute.localeCompare(a.minute))[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <section className="bg-slate-950 px-6 py-8 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
              <Sparkles className="h-4 w-4" />
              Local inference
            </div>
            <h1 className="mt-3 text-3xl font-semibold">Minute prediction timeline</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Predictions are read from each captured minute and grouped by model, matching the Thoth device dashboard.
            </p>
          </div>
          <button
            type="button"
            onClick={loadTimelines}
            className="inline-flex items-center gap-2 border border-white/20 bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Brain className="h-4 w-4" />
              Models
            </div>
            <div className="mt-2 text-3xl font-semibold">{modelGroups.length}</div>
          </div>
          <div className="border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Activity className="h-4 w-4" />
              Predictions
            </div>
            <div className="mt-2 text-3xl font-semibold">{totalPredictions}</div>
          </div>
          <div className="border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Clock className="h-4 w-4" />
              Latest minute
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold">{latest ? latest.minuteName : 'None'}</div>
          </div>
        </div>

        {error && (
          <div className="mt-5 flex items-center gap-2 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="mt-6 space-y-6">
          {modelGroups.map(([modelName, entries]) => (
            <section key={modelName} className="border border-slate-200 bg-white">
              <div className="flex flex-col gap-3 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <Database className="h-4 w-4" />
                    {entries[0]?.data_type || 'model'}
                  </div>
                  <h2 className="mt-1 text-2xl font-semibold">{modelName}</h2>
                </div>
                <div className="text-sm text-slate-500">{entries.length} minute entries</div>
              </div>

              <div className="overflow-x-auto p-5">
                <div className="flex min-w-max gap-4">
                  {entries.slice(0, 36).map((entry, index) => {
                    const confidence = confidenceFor(entry);
                    const isError = entry.status === 'error';
                    const isSkipped = entry.status === 'skipped';
                    return (
                      <div key={`${modelName}:${entry.minute}:${index}`} className="w-56 shrink-0">
                        <div className="mb-3 flex items-center">
                          <div className={`h-3 w-3 rounded-full ${isError ? 'bg-red-500' : isSkipped ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                          <div className="h-px flex-1 bg-slate-200" />
                        </div>
                        <div className="border border-slate-200 bg-slate-50 p-4">
                          <div className="font-mono text-xs text-slate-500">{formatMinute(entry.minuteName || entry.minute)}</div>
                          <div className="mt-2 text-lg font-semibold text-slate-950">{String(predictionLabel(entry))}</div>
                          <div className="mt-3 h-2 bg-slate-200">
                            <div
                              className={`h-2 ${isError ? 'bg-red-500' : isSkipped ? 'bg-amber-400' : 'bg-cyan-500'}`}
                              style={{ width: `${Math.max(4, Math.min(100, (confidence ?? 0) * 100))}%` }}
                            />
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            {confidence === null ? entry.status || 'recorded' : `${Math.round(confidence * 100)}% confidence`}
                          </div>
                          {!!entry.labels?.length && (
                            <div className="mt-3 flex flex-wrap gap-1">
                              {entry.labels.slice(0, 3).map((label) => (
                                <span key={label} className="border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-600">
                                  {label}
                                </span>
                              ))}
                            </div>
                          )}
                          {entry.error && <div className="mt-3 line-clamp-2 text-xs text-red-600">{entry.error}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          ))}

          {!loading && !modelGroups.length && (
            <div className="border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No minute prediction files were found under the configured Thoth data directory.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
