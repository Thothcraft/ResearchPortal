'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import {
  contextApi, type CtxEntity, type CtxRelationship, type CtxSnapshot,
} from '@/lib/context-api';

const KINDS = ['person', 'device', 'wearable', 'space', 'object'];

/**
 * Entities + relationship graph (Part 6): list with kind/name, create
 * entity form, relationship CRUD, and an edge list grouped by predicate.
 */
export function EntityExplorer({ snapshot }: { snapshot: CtxSnapshot | null }) {
  const [kind, setKind] = useState('person');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [rels, setRels] = useState<CtxRelationship[]>([]);
  const [error, setError] = useState('');
  const [sel, setSel] = useState<string>('');

  const entities = useMemo(() => snapshot?.entities ?? [], [snapshot]);

  const loadRels = useCallback(async () => {
    try {
      setRels(await contextApi.relationships());
      setError('');
    } catch (e: any) {
      setError(e?.message || 'relationships unavailable');
    }
  }, []);

  useEffect(() => { loadRels(); }, [loadRels]);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const id = `${kind}:${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      await contextApi.upsertEntity({ id, kind, name: name.trim() });
      setName('');
      window.dispatchEvent(new Event('context:refresh'));
    } catch (e: any) {
      setError(e?.message || 'create failed');
    } finally {
      setBusy(false);
    }
  };

  const endRel = async (id: number) => {
    await contextApi.endRelationship(id);
    await loadRels();
  };

  const nameOf = (id: string) =>
    entities.find((e) => e.id === id)?.name ?? id.split(':').pop() ?? id;

  const grouped = useMemo(() => {
    const g = new Map<string, CtxRelationship[]>();
    for (const r of rels) {
      g.set(r.predicate, [...(g.get(r.predicate) ?? []), r]);
    }
    return g;
  }, [rels]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h3 className="mb-3 text-sm font-semibold">Entities</h3>
        <div className="mb-3 flex gap-2">
          <select value={kind} onChange={(e) => setKind(e.target.value)}
            className="rounded bg-neutral-800 px-2 py-1.5 text-sm">
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="name" className="flex-1 rounded bg-neutral-800 px-3 py-1.5 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && create()} />
          <button onClick={create} disabled={busy}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm disabled:opacity-40">
            Add
          </button>
        </div>
        {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
        {!entities.length && (
          <p className="text-xs text-neutral-500">
            {snapshot ? 'No entities yet.' :
              <><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Loading…</>}
          </p>)}
        {entities.map((e) => (
          <button key={e.id} onClick={() => setSel(e.id === sel ? '' : e.id)}
            className={`mb-1 flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm ${
              sel === e.id ? 'border-blue-500 bg-neutral-800' : 'border-neutral-800'}`}>
            <span>
              <span className="mr-2 rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
                {e.kind}
              </span>
              {e.name ?? e.id}
            </span>
            <span className="font-mono text-xs text-neutral-500">{e.id}</span>
          </button>
        ))}
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h3 className="mb-3 text-sm font-semibold">Relationships</h3>
        {Array.from(grouped.entries()).map(([pred, list]) => (
          <div key={pred} className="mb-4">
            <p className="mb-1 font-mono text-xs uppercase tracking-wider text-neutral-500">
              {pred}
            </p>
            {list.map((r) => (
              <div key={r.id}
                className="mb-1 flex items-center justify-between rounded bg-neutral-950 px-3 py-1.5 text-sm">
                <span>
                  {nameOf(r.subject)}
                  <span className="mx-1 text-neutral-500">—{pred}→</span>
                  {nameOf(r.object)}
                </span>
                <span className="flex items-center gap-2 text-xs text-neutral-500">
                  {Math.round(r.confidence * 100)}%
                  {r.valid_until && <span className="text-neutral-600">ended</span>}
                  <button onClick={() => endRel(r.id)} title="end relationship"
                    className="text-neutral-600 hover:text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        ))}
        {grouped.size === 0 && (
          <p className="text-xs text-neutral-500">
            No relationships — wearable enrollment and space assignment
            create them automatically.</p>)}
      </section>
    </div>
  );
}
