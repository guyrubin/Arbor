/* analyticsOptOut — B-DATA-05: the parent's analytics opt-out, ONE module.
 *
 * WHAT IT IS
 * ──────────
 * One per-account preference with two homes:
 *   · `users/{uid}.analyticsOptOut` (Firestore) — the per-account TRUTH, so a
 *     choice made on the phone holds on the laptop. The owner may write their
 *     own user doc (firestore.rules `match /users/{userId}`), no rules change.
 *   · localStorage `arbor.analytics.optOut` — the SYNCHRONOUS read
 *     lib/analytics.ts `track()` needs at its first line. It stores
 *     `{ uid, optOut }`, so one account's choice never answers for another
 *     account signed in later on the same browser.
 *
 * WHO READS IT
 * ────────────
 *   · lib/analytics.ts `track()` — the one event choke point — checks it
 *     before any other logic; an opted-out account writes 0 events.
 *   · lib/retentionRollup.ts — `upsertRetentionRollup` checks it first, and
 *     `recordRetentionSession` (the sign-in moment) hydrates it from the user
 *     doc before any rollup write; an opted-out account writes 0 rollups.
 *   · components/privacy/AnalyticsOptOutRow — the Settings switch.
 *
 * BEFORE HYDRATION ON A FRESH BROWSER
 * ───────────────────────────────────
 * Auth-ready fires `session_open` before the sign-in hydration has read the
 * user doc. When this browser can hold a record (storage readable) but holds
 * none for the signed-in account, its preference is not yet known: track()
 * BUFFERS up to 20 events (lib/analytics PRE_HYDRATION_EVENT_CAP), then
 * hydration FLUSHES them when the account is opted in and DROPS them when it
 * is opted out. Where storage is unavailable there is no browser record to
 * wait for: the in-memory flag (set by hydration) or the default applies.
 *
 * No child data, no copy and no verdict lives here: one boolean per account.
 */
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, firebaseEnabled } from "./firebase";

/**
 * The default when an account has never chosen.
 * Guy G-30 (counsel) decides; today's behaviour = opted-in (false).
 * Change it HERE only: track(), the rollup writer and the Settings switch all
 * read it through this module.
 */
export const ANALYTICS_OPT_OUT_DEFAULT = false;

/** localStorage key of the synchronous read. */
export const ANALYTICS_OPT_OUT_STORAGE_KEY = "arbor.analytics.optOut";

/** Field on `users/{uid}` that holds the per-account truth. */
export const ANALYTICS_OPT_OUT_FIELD = "analyticsOptOut";

/** "in" / "out" = this account's preference is known on this browser;
 *  "unknown" = it has not been read for this account yet. */
export type AnalyticsOptOutState = "in" | "out" | "unknown";

type OptOutRecord = { uid: string; optOut: boolean };

/** Per-account read/write seam (Firestore by default; a fake under test). */
export interface AnalyticsOptOutStore {
  /** The stored boolean, or null when the account has never chosen. */
  read(uid: string): Promise<boolean | null>;
  write(uid: string, optOut: boolean): Promise<void>;
}

/** In-memory flag: holds the answer even when storage is blocked. */
let memory: OptOutRecord | null = null;
/** Bumped by every explicit choice, so a slower hydration read never
 *  overwrites a choice the parent made while it was in flight. */
let choiceSeq = 0;

type SettledListener = (uid: string, optedOut: boolean) => void;
const listeners = new Set<SettledListener>();

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function readStored(): OptOutRecord | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(ANALYTICS_OPT_OUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const { uid, optOut } = parsed as Record<string, unknown>;
    return typeof uid === "string" && uid && typeof optOut === "boolean" ? { uid, optOut } : null;
  } catch {
    return null;
  }
}

function recordFor(uid: string | undefined): OptOutRecord | null {
  for (const record of [memory, readStored()]) {
    if (record && (uid === undefined || record.uid === uid)) return record;
  }
  return null;
}

/** What this browser knows about the account's preference (synchronous). */
export function analyticsOptOutState(uid?: string): AnalyticsOptOutState {
  const record = recordFor(uid);
  if (!record) return "unknown";
  return record.optOut ? "out" : "in";
}

/** True when nothing may be recorded for this account. An account whose
 *  preference is not known yet follows ANALYTICS_OPT_OUT_DEFAULT. */
export function isAnalyticsOptedOut(uid?: string): boolean {
  const state = analyticsOptOutState(uid);
  return state === "unknown" ? ANALYTICS_OPT_OUT_DEFAULT : state === "out";
}

/** True while track() must hold this account's events: a fresh browser (it
 *  can keep a record, holds none for this account) before hydration. */
export function awaitsAnalyticsOptOutHydration(uid: string | undefined): boolean {
  if (!uid || uid === "local-sandbox") return false;
  return storage() !== null && analyticsOptOutState(uid) === "unknown";
}

/** Called with (uid, optedOut) whenever the preference becomes known or
 *  changes. Returns the unsubscribe. */
export function onAnalyticsOptOutSettled(listener: SettledListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function settle(uid: string, optOut: boolean): void {
  memory = { uid, optOut };
  try {
    storage()?.setItem(ANALYTICS_OPT_OUT_STORAGE_KEY, JSON.stringify({ uid, optOut }));
  } catch {
    /* storage blocked: the in-memory flag still answers this session */
  }
  for (const listener of [...listeners]) {
    try {
      listener(uid, optOut);
    } catch {
      /* a listener never breaks the preference */
    }
  }
}

/** The live store, or null when Firebase is not configured (local sandbox). */
export function firestoreAnalyticsOptOutStore(): AnalyticsOptOutStore | null {
  if (!firebaseEnabled || !db) return null;
  const database = db;
  return {
    async read(uid) {
      const snap = await getDoc(doc(database, "users", uid));
      const value = snap.exists() ? (snap.data() as Record<string, unknown>)[ANALYTICS_OPT_OUT_FIELD] : undefined;
      return typeof value === "boolean" ? value : null;
    },
    async write(uid, optOut) {
      // merge: the user doc holds other fields; only this one is ours.
      await setDoc(doc(database, "users", uid), { [ANALYTICS_OPT_OUT_FIELD]: optOut }, { merge: true });
    },
  };
}

/**
 * The parent's choice. Applies on this browser at once (synchronous read +
 * listeners), then mirrors to `users/{uid}`. Resolves true when the account
 * copy is saved (or there is no account store to save to), false when the
 * mirror failed — the choice still holds on this browser.
 */
export async function setAnalyticsOptOut(
  uid: string | undefined,
  optOut: boolean,
  store: AnalyticsOptOutStore | null = firestoreAnalyticsOptOutStore(),
): Promise<boolean> {
  if (!uid) return false;
  choiceSeq += 1;
  settle(uid, optOut);
  if (!store || uid === "local-sandbox") return true;
  try {
    await store.write(uid, optOut);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sign-in hydration (called from lib/retentionRollup recordRetentionSession):
 * reads the per-account truth and settles this browser to it. Resolves the
 * account's opt-out, or null when it could not be read and this browser holds
 * no record for the account (callers then write nothing).
 */
export async function hydrateAnalyticsOptOut(
  uid: string | undefined,
  store: AnalyticsOptOutStore | null = firestoreAnalyticsOptOutStore(),
): Promise<boolean | null> {
  if (!uid || uid === "local-sandbox") return null;
  const seqAtStart = choiceSeq;
  if (!store) {
    const state = analyticsOptOutState(uid);
    if (state !== "unknown") return state === "out";
    settle(uid, ANALYTICS_OPT_OUT_DEFAULT);
    return ANALYTICS_OPT_OUT_DEFAULT;
  }
  try {
    const stored = await store.read(uid);
    // The parent chose while the read was in flight: the choice wins.
    if (choiceSeq !== seqAtStart) return isAnalyticsOptedOut(uid);
    const optOut = typeof stored === "boolean" ? stored : ANALYTICS_OPT_OUT_DEFAULT;
    settle(uid, optOut);
    return optOut;
  } catch {
    const state = analyticsOptOutState(uid);
    return state === "unknown" ? null : state === "out";
  }
}
