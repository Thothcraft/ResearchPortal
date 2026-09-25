/**
 * API-backed minute repository — the canonical replacement for the
 * legacy filesystem reader in `lib/minutes.ts`.
 *
 * The Portal consumes the Thoth node's v1 HTTP API
 * (`GET /api/v1/minutes`, `/api/v1/minutes/{id}`,
 * `/api/v1/minutes/{id}/seconds/{n}`) and never touches the capture
 * filesystem or parses on-disk minute artifacts itself.
 *
 * Types come from `lib/contracts.generated.ts` (generated from the
 * canonical Whispy JSON schemas — do not hand-edit).
 */

import type { MinuteManifest } from './contracts.generated';

/** Row shape returned by `GET /api/v1/minutes` (summary, not the full manifest). */
export interface MinuteSummaryV1 {
  minute_id: string;
  device_id: string;
  start_timestamp: number;
  end_timestamp?: number | null;
  sources: number;
  predictions: number;
  labels: string[];
  canonical: boolean;
  error?: string;
}

/** Derived, indexed second view returned by `/seconds/{n}`. */
export interface SecondView {
  minute_id?: string;
  second_index: number;
  status?: string;
  occupied?: boolean | null;
  classification?: string;
  score?: number;
  ratio?: number;
  location?: unknown;
  detected_frames?: number;
  evaluated_frames?: number;
  error?: string;
}

export interface ThothNodeConfig {
  /** e.g. http://127.0.0.1:5000 — the node's authenticated local API. */
  baseUrl: string;
  /** Bearer token (the node's local_token). */
  token?: string;
  /** Injectable fetch for tests; defaults to global fetch. */
  fetcher?: typeof fetch;
}

async function request<T>(cfg: ThothNodeConfig, path: string): Promise<T> {
  const fetcher = cfg.fetcher ?? fetch;
  const res = await fetcher(`${cfg.baseUrl.replace(/\/$/, '')}${path}`, {
    headers: {
      Accept: 'application/json',
      ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Thoth API ${res.status} on ${path}: ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** List canonical minute summaries from the node. */
export async function listMinutes(cfg: ThothNodeConfig): Promise<MinuteSummaryV1[]> {
  const body = await request<{ minutes: MinuteSummaryV1[] }>(cfg, '/api/v1/minutes');
  return body.minutes ?? [];
}

/** Fetch one canonical `thoth-minute/v1` manifest. */
export async function getMinute(cfg: ThothNodeConfig, minuteId: string): Promise<MinuteManifest> {
  return request<MinuteManifest>(cfg, `/api/v1/minutes/${encodeURIComponent(minuteId)}`);
}

/**
 * Fetch the derived second-level view. Missing seconds return a valid
 * empty view (`status: 'missing'`), never fabricated observations.
 */
export async function getMinuteSecond(
  cfg: ThothNodeConfig,
  minuteId: string,
  second: number,
): Promise<SecondView> {
  return request<SecondView>(
    cfg,
    `/api/v1/minutes/${encodeURIComponent(minuteId)}/seconds/${second}`,
  );
}

/** Populated second indices of a canonical minute (timestamp-derived). */
export function populatedSeconds(minute: MinuteManifest): number[] {
  const seconds = (minute.quality?.seconds as SecondView[] | undefined) ?? [];
  return seconds
    .map((s) => s.second_index)
    .filter((i): i is number => typeof i === 'number')
    .sort((a, b) => a - b);
}
