/* retentionRollup — N1-04 (OBJ-MEA-01A): the writer lib/retention.ts never had.
 *
 * THE DEFECT THIS CLOSES
 * ──────────────────────
 * `lib/retention.ts` is a complete, tested cohort module whose only importers
 * were its own test file and a name pin. Nothing ever BUILT a rollup and
 * nothing ever STORED one, so the arithmetic could not answer a question about
 * a real family. Arbor's dominant defect — built-but-unmounted — in its
 * highest-stakes module.
 *
 * WHAT THIS IS
 * ────────────
 * I/O only. Every day key, every merge and every offset comes from
 * lib/retention.ts (`buildRollup`, `mergeRollup`); there is deliberately no
 * arithmetic in this file, because a second implementation of "what day was
 * that" is how two dashboards start disagreeing. This module decides only
 * WHERE the fact is written, WHEN a write is worth doing, and that a failure
 * is silent.
 *
 * WHERE IT IS WRITTEN — `retentionRollups/{uid}`, top-level, NOT under
 * `users/{uid}/…`. The founder-side reader is then one cheap scan of one small
 * collection instead of a `collectionGroup("events")` fan-out across every
 * family's whole event history. Rules for the collection are owner-scoped
 * (read/write only your own uid); the report reads through ADC.
 *
 * PRIVACY — the document is derived from event NAMES and TIMESTAMPS only, plus
 * two acquisition props (`source`, `market`) that already ride on every
 * analytics event via lib/attribution. No child data can reach it: there is no
 * code path here that reads a child, a note, a name or any free text, and
 * `RETENTION_ROLLUP_DOC_KEYS` is pinned by the guard so a field cannot be added
 * later without a test going red.
 *
 * CLINICAL FIREWALL — a rollup is a PRODUCT fact, never a verdict about a
 * family. Nothing here returns copy and nothing here may be imported by a
 * component; the guard asserts `app/src/components/**` imports it zero times.
 *
 * LAW 3 — `activeDays` is cumulative, never consecutive. There is no streak
 * field, no `currentStreak`, no `longestStreak`, and there must never be one:
 * a child-facing or parent-facing streak is a pressure mechanic. The guard
 * scans this file and lib/retention.ts for /streak|consecutive/i and requires
 * zero hits.
 */
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, firebaseEnabled } from "./firebase";
import { loadAttribution } from "./attribution";
import { buildRollup, mergeRollup, type RetentionRollup } from "./retention";

/** Top-level collection. One document per family, id = uid. */
export const RETENTION_ROLLUP_COLLECTION = "retentionRollups";

/** The complete key set of a stored rollup document, sorted.
 *  Pinned by the guard: a new key here is a privacy review, not a patch. */
export const RETENTION_ROLLUP_DOC_KEYS = [
  "activeDays",
  "firstSeen",
  "market",
  "source",
  "tzOffsetMinutes",
  "updatedAt",
] as const;

export interface RetentionRollupDoc {
  /** "YYYY-MM-DD" of the first day this family was seen. Only moves earlier. */
  firstSeen: string;
  /** Distinct local day keys, ascending, capped at retention.MAX_ACTIVE_DAYS. */
  activeDays: string[];
  /** First-touch acquisition slice keys (lib/attribution). Null when unknown. */
  source: string | null;
  market: string | null;
  /** Minutes to ADD to UTC for this family's own day boundary. */
  tzOffsetMinutes: number;
  /** ISO instant of the last write. */
  updatedAt: string;
}

/** What a session knows about itself. Supplied by the caller so the module
 *  stays deterministic under test — no Date.now() hidden inside a branch. */
export interface RetentionSessionContext {
  uid: string;
  at: string | number | Date;
  tzOffsetMinutes: number;
  source: string | null;
  market: string | null;
}

/** Read/write seam. The default implementation is Firestore; the guard passes
 *  a fake, which is the only way "never throws when the db is absent" is a
 *  testable claim rather than a comment. */
export interface RetentionRollupStore {
  read(uid: string): Promise<unknown>;
  write(uid: string, document: RetentionRollupDoc): Promise<void>;
}

/** Defensive parse of whatever Firestore hands back. A malformed stored doc
 *  degrades to "no prior rollup" rather than corrupting the merge. */
export function parseStoredRollup(raw: unknown): RetentionRollup | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const firstSeen = typeof r.firstSeen === "string" ? r.firstSeen : null;
  const activeDays = Array.isArray(r.activeDays)
    ? r.activeDays.filter((d): d is string => typeof d === "string")
    : [];
  if (!firstSeen || activeDays.length === 0) return null;
  return { firstSeen, activeDays };
}

/**
 * The document this session should store, or `null` when the stored one is
 * already correct — a second session on the same day must not re-serialise the
 * whole array for nothing. All arithmetic is lib/retention.ts's.
 */
export function nextRollupDoc(
  stored: unknown,
  ctx: RetentionSessionContext,
): RetentionRollupDoc | null {
  const prev = parseStoredRollup(stored);
  // A session IS an activity day: buildRollup owns the day-key arithmetic.
  const incoming = buildRollup([{ event: "session_open", at: ctx.at }], ctx.tzOffsetMinutes);
  const merged = mergeRollup(prev, incoming);
  if (!merged) return null;

  const prior = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : null;
  const unchanged =
    prev !== null &&
    merged.firstSeen === prev.firstSeen &&
    merged.activeDays.length === prev.activeDays.length &&
    prior !== null &&
    prior.source === ctx.source &&
    prior.market === ctx.market &&
    prior.tzOffsetMinutes === ctx.tzOffsetMinutes;
  if (unchanged) return null;

  return {
    firstSeen: merged.firstSeen,
    activeDays: merged.activeDays,
    source: ctx.source,
    market: ctx.market,
    tzOffsetMinutes: ctx.tzOffsetMinutes,
    updatedAt: new Date(ctx.at).toISOString(),
  };
}

export type RetentionUpsertResult = "written" | "unchanged" | "skipped";

/**
 * Merge this session's activity day into the stored rollup. Best-effort by
 * construction: a read failure, a write failure or an absent db all resolve to
 * "skipped" — a retention fact is never worth degrading a parent's session.
 */
export async function upsertRetentionRollup(
  store: RetentionRollupStore | null,
  ctx: RetentionSessionContext,
): Promise<RetentionUpsertResult> {
  if (!store || !ctx.uid) return "skipped";
  try {
    const stored = await store.read(ctx.uid);
    const next = nextRollupDoc(stored, ctx);
    if (!next) return "unchanged";
    await store.write(ctx.uid, next);
    return "written";
  } catch {
    return "skipped";
  }
}

/** The live store, or null when Firebase is not configured (local sandbox). */
export function firestoreRollupStore(): RetentionRollupStore | null {
  if (!firebaseEnabled || !db) return null;
  const database = db;
  return {
    async read(uid) {
      const snap = await getDoc(doc(database, RETENTION_ROLLUP_COLLECTION, uid));
      return snap.exists() ? snap.data() : null;
    },
    async write(uid, document) {
      // Full replace, not merge: the stored key set is then exactly
      // RETENTION_ROLLUP_DOC_KEYS and a stray legacy field cannot survive.
      await setDoc(doc(database, RETENTION_ROLLUP_COLLECTION, uid), document);
    },
  };
}

const SS_RETENTION_ROLLUP = "arbor.retentionRollup";

/** Minutes to ADD to UTC to reach the family's own day boundary. */
function localTzOffsetMinutes(): number {
  try {
    return -new Date().getTimezoneOffset();
  } catch {
    return 0;
  }
}

/**
 * The one production call site (context/AuthContext.tsx, at auth-ready, beside
 * trackSessionOpen). Fire-and-forget, once per browser session, and it never
 * throws into the caller — the gate shape is lib/analytics.ts's `track()`.
 */
export function recordRetentionSession(uid: string | undefined): void {
  if (!uid || uid === "local-sandbox") return;
  try {
    if (sessionStorage.getItem(SS_RETENTION_ROLLUP)) return;
    sessionStorage.setItem(SS_RETENTION_ROLLUP, new Date().toISOString());
  } catch {
    /* storage blocked → still record; the day-set merge is idempotent anyway */
  }
  let source: string | null = null;
  let market: string | null = null;
  try {
    const a = loadAttribution();
    source = a?.source ?? null;
    market = a?.market ?? null;
  } catch {
    /* attribution is a slice key, never a precondition */
  }
  try {
    void upsertRetentionRollup(firestoreRollupStore(), {
      uid,
      at: new Date(),
      tzOffsetMinutes: localTzOffsetMinutes(),
      source,
      market,
    });
  } catch {
    /* best effort */
  }
}
