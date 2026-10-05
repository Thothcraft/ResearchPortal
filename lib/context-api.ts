/**
 * Typed client for Brain's `/v1/context/*` surface through the
 * `/api/brain/*` portal proxy. Mirrors the mobile `ContextRepository`.
 *
 * Evidence = raw observations/predictions with provenance.
 * State = derived semantic statement attributed to an estimator.
 * The UI keeps the two concepts visually separate.
 */
import { brainJson } from './node-api';

export interface CtxEntity {
  id: string;
  kind: string;
  name?: string;
  attributes?: Record<string, unknown>;
  created_at?: number;
}

export interface CtxRelationship {
  id: number;
  subject: string;
  predicate: string;
  object: string;
  valid_from?: number;
  valid_until?: number;
  confidence: number;
  source: string;
  provenance?: Record<string, unknown>;
}

export interface CtxEvidence {
  id: string;
  key: string;
  value?: unknown;
  timestamp?: number;
  source_id?: string;
  device_id?: string;
  prediction_id?: string;
  observation_id?: string;
  model_id?: string;
  model_version?: string;
  confidence?: number;
  provenance?: Record<string, unknown>;
}

export interface CtxState {
  id: number;
  key: string;
  value?: unknown;
  entity_id: string;
  confidence: number;
  since?: number;
  valid_until?: number;
  evidence_ids: string[];
  estimator: string;
}

export interface CtxEvent {
  id: number;
  key: string;
  type: string;
  entity_id?: string;
  value?: unknown;
  previous_value?: unknown;
  confidence?: number;
  timestamp?: number;
  provenance?: Record<string, unknown>;
}

export interface CtxSnapshot {
  entities: CtxEntity[];
  relationships: CtxRelationship[];
  states: CtxState[];
  generated_at?: number;
}

const list = <T>(res: any, key: string): T[] =>
  (res?.[key] as T[] | undefined) ?? [];

export const contextApi = {
  snapshot: () =>
    brainJson<any>('/context/snapshot').then((r) => ({
      entities: list<CtxEntity>(r, 'entities'),
      relationships: list<CtxRelationship>(r, 'relationships'),
      states: list<CtxState>(r, 'states'),
      generated_at: r?.generated_at,
    }) as CtxSnapshot),

  entities: (kind?: string) =>
    brainJson<any>(`/context/entities${kind ? `?kind=${kind}` : ''}`)
      .then((r) => list<CtxEntity>(r, 'entities')),

  upsertEntity: (e: { id: string; kind: string; name?: string;
      attributes?: Record<string, unknown> }) =>
    brainJson<CtxEntity>('/context/entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(e),
    }),

  relationships: (opts: { subject?: string; predicate?: string;
      activeOnly?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (opts.subject) q.set('subject', opts.subject);
    if (opts.predicate) q.set('predicate', opts.predicate);
    if (opts.activeOnly) q.set('active_only', 'true');
    return brainJson<any>(`/context/relationships?${q}`)
      .then((r) => list<CtxRelationship>(r, 'relationships'));
  },

  createRelationship: (rel: { subject: string; predicate: string;
      object: string; confidence?: number; source?: string;
      allow_unresolved?: boolean }) =>
    brainJson<CtxRelationship>('/context/relationships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rel),
    }),

  endRelationship: (id: number) =>
    brainJson(`/context/relationships/${id}`, { method: 'DELETE' }),

  evidence: (opts: { key?: string; sourceId?: string; since?: number;
      limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (opts.key) q.set('key', opts.key);
    if (opts.sourceId) q.set('source_id', opts.sourceId);
    if (opts.since) q.set('since', String(opts.since));
    q.set('limit', String(opts.limit ?? 200));
    return brainJson<any>(`/context/evidence?${q}`)
      .then((r) => list<CtxEvidence>(r, 'evidence'));
  },

  states: (opts: { key?: string; entityId?: string;
      activeOnly?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (opts.key) q.set('key', opts.key);
    if (opts.entityId) q.set('entity_id', opts.entityId);
    if (opts.activeOnly) q.set('active_only', 'true');
    return brainJson<any>(`/context/state?${q}`)
      .then((r) => list<CtxState>(r, 'states'));
  },

  events: (opts: { key?: string; since?: number; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (opts.key) q.set('key', opts.key);
    if (opts.since) q.set('since', String(opts.since));
    q.set('limit', String(opts.limit ?? 200));
    return brainJson<any>(`/context/events?${q}`)
      .then((r) => list<CtxEvent>(r, 'events'));
  },
};

/** Known evidence/state key families for grouping/filtering. */
export const CONTEXT_KEY_FAMILIES = [
  'occupancy', 'presence', 'location', 'activity', 'ble',
  'localization', 'environment',
] as const;
