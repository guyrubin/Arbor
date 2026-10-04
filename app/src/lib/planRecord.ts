import { CANONICAL_BEHAVIOR_TYPES, MOMENT_BEHAVIOR_TYPE } from "../content/behaviorTaxonomy.js";

/**
 * B-ASKJB-27 — the behaviour record a plan is generated from: COUNTS only.
 *
 * Guy G6: moment text stays OFF. The client sends `behaviour type → count`
 * over the trailing 21 days and nothing else; the server re-validates the
 * same shape (a client is never trusted to have dropped the text). A type is
 * accepted only when it is one of the canonical taxonomy values, so a free
 * label typed by a parent ("bit his sister at dinner") can never ride in as a
 * "type". Plain "Moment" captures are journal entries, not a pattern, and are
 * never counted (same rule as suggestedChallenges).
 *
 * Pure: no I/O, callers pass `now`. Shared by the client (ArborContext) and
 * the server (/generate-plan).
 */

export type TypeCount = { type: string; count: number };

export const PLAN_RECORD_WINDOW_DAYS = 21;
const MAX_COUNT = 999;
const COUNTED: ReadonlySet<string> = new Set(CANONICAL_BEHAVIOR_TYPES.filter((t) => t !== MOMENT_BEHAVIOR_TYPE));

const byCountDesc = (a: TypeCount, b: TypeCount) => b.count - a.count || a.type.localeCompare(b.type);

/** Client: canonical behaviour type → count over the last 21 days (no text). */
export function recentTypeCounts(
  logs: readonly { behaviorType?: string; timestamp?: string }[],
  now: number,
  windowDays = PLAN_RECORD_WINDOW_DAYS,
): TypeCount[] {
  const cutoff = now - windowDays * 86_400_000;
  const counts = new Map<string, number>();
  for (const l of logs) {
    const type = l.behaviorType ?? "";
    if (!COUNTED.has(type)) continue;
    const at = Date.parse(l.timestamp ?? "");
    if (Number.isNaN(at) || at < cutoff || at > now) continue;
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return [...counts.entries()].map(([type, count]) => ({ type, count })).sort(byCountDesc);
}

/** Server: the same shape, re-validated — canonical types only, whole numbers
 *  1..999, one row per type. Anything else is dropped, never echoed. */
export function sanitizeTypeCounts(raw: unknown): TypeCount[] {
  if (!Array.isArray(raw)) return [];
  const out = new Map<string, number>();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const { type, count } = row as { type?: unknown; count?: unknown };
    if (typeof type !== "string" || !COUNTED.has(type) || out.has(type)) continue;
    if (typeof count !== "number" || !Number.isInteger(count) || count < 1) continue;
    out.set(type, Math.min(count, MAX_COUNT));
  }
  return [...out.entries()].map(([type, count]) => ({ type, count })).sort(byCountDesc);
}
