import { childScopedKey } from "./childLocalState";

/**
 * B-DATA-14 (12 Nov) — a moment retried after a reload keeps its first id.
 *
 * A capture that needs the server's acknowledgement (Tonight's line, the
 * book handback, Together's offline idea) is written with a fresh id, and the
 * persistent Firestore cache keeps that write queued even when the ack times
 * out. The retry used to reuse the id only from memory, so a reload between
 * the failure and the retry minted a second id and both documents synced:
 * the moment was kept twice. This store keeps the attempt's id and timestamp
 * on the device until the ack arrives, so the retry overwrites the queued
 * document instead of adding one.
 *
 * Only attempts with a caller's STABLE retry key are stored (never the
 * moment's text: the key names the place, e.g. `tonight:<day>:<practice>`).
 * The key is child-scoped (`arbor.momentRetry.<childId>`), so erasing the
 * child sweeps it (childLocalState). Entries expire after a week and the list
 * is capped, so an abandoned retry never pins an id forever.
 */

type StorageLike = Pick<Storage, "getItem" | "setItem"> & Partial<Pick<Storage, "removeItem">>;

export interface MomentAttempt { id: string; timestamp: string }
interface Stored extends MomentAttempt { at: number }

export const MOMENT_RETRY_TTL_MS = 2 * 24 * 60 * 60 * 1000;
export const MOMENT_RETRY_CAP = 40;

const keyFor = (childId: string) => childScopedKey("momentRetry", childId);

const deviceStore = (): StorageLike | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

function readAll(storage: StorageLike | null, childId: string, nowMs: number): Record<string, Stored> {
  if (!storage || !childId) return {};
  try {
    const raw = storage.getItem(keyFor(childId));
    const parsed = raw ? JSON.parse(raw) as unknown : null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, Stored> = {};
    for (const [attempt, value] of Object.entries(parsed as Record<string, unknown>)) {
      const v = value as Partial<Stored> | null;
      if (!v || typeof v.id !== "string" || !v.id || typeof v.timestamp !== "string" || typeof v.at !== "number") continue;
      if (nowMs - v.at > MOMENT_RETRY_TTL_MS || v.at > nowMs + 60_000) continue;
      out[attempt] = { id: v.id, timestamp: v.timestamp, at: v.at };
    }
    return out;
  } catch {
    return {};
  }
}

function writeAll(storage: StorageLike | null, childId: string, all: Record<string, Stored>): void {
  if (!storage || !childId) return;
  try {
    const entries = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, MOMENT_RETRY_CAP);
    if (!entries.length) {
      if (storage.removeItem) storage.removeItem(keyFor(childId));
      else storage.setItem(keyFor(childId), "{}");
      return;
    }
    storage.setItem(keyFor(childId), JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* a full or private store keeps the in-memory retry only */
  }
}

/** The first attempt's id and timestamp for this retry key, if one is pending. */
export function readMomentAttempt(childId: string, attemptKey: string, opts: { storage?: StorageLike | null; nowMs?: number } = {}): MomentAttempt | undefined {
  const storage = opts.storage === undefined ? deviceStore() : opts.storage;
  const hit = readAll(storage, childId, opts.nowMs ?? Date.now())[attemptKey];
  return hit ? { id: hit.id, timestamp: hit.timestamp } : undefined;
}

/** Remember an attempt before its write starts (it may outlive a reload). */
export function rememberMomentAttempt(childId: string, attemptKey: string, attempt: MomentAttempt, opts: { storage?: StorageLike | null; nowMs?: number } = {}): void {
  const storage = opts.storage === undefined ? deviceStore() : opts.storage;
  const nowMs = opts.nowMs ?? Date.now();
  const all = readAll(storage, childId, nowMs);
  all[attemptKey] = { id: attempt.id, timestamp: attempt.timestamp, at: all[attemptKey]?.at ?? nowMs };
  writeAll(storage, childId, all);
}

/** The server acknowledged the write: the next capture at this place is new. */
export function forgetMomentAttempt(childId: string, attemptKey: string, opts: { storage?: StorageLike | null; nowMs?: number } = {}): void {
  const storage = opts.storage === undefined ? deviceStore() : opts.storage;
  const all = readAll(storage, childId, opts.nowMs ?? Date.now());
  if (!(attemptKey in all)) return;
  delete all[attemptKey];
  writeAll(storage, childId, all);
}
