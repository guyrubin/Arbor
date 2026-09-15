/**
 * KID-LOCK (W0.9): module-level Kid Mode gate singleton + persistence.
 *
 * WHY A MODULE SINGLETON: the W0.9 audit found kid-mode escape paths in
 * non-React modules (native.ts hardware back) and in providers that render
 * OUTSIDE the KidModeProvider subtree (ToastProvider in App.tsx, the
 * ArborContext setActiveTab seam). React context can't reach them; this
 * subscribable boolean can. KidModeContext is the ONLY writer — everything
 * else reads (isKidModeActive) or subscribes (subscribeKidMode).
 *
 * PERSISTENCE (LEAK 1): the active state (+ selected kid surface) round-trips
 * through localStorage under `arbor.kidmode.active` so a page reload or
 * webview kill lands the child back INSIDE Kid Mode, never in the parent app.
 * The gate self-initializes from storage at module load, so every reader —
 * including modules that run before React mounts — sees the rehydrated value
 * synchronously on first paint.
 *
 * SAFETY CONTRACT: device-local UI state only. NO child data, NO Firestore,
 * NO network. Zero behavior change while Kid Mode is off — every guard built
 * on this gate is an `if (isKidModeActive())` early-return.
 */

import { trackKidSessionEnd } from "./kpiEvents";

/** localStorage key for the persisted Kid Mode state (arbor.* convention). */
export const KIDMODE_LS_KEY = "arbor.kidmode.active";

/**
 * N1-01: the kid SESSION stamp, deliberately BESIDE the persisted state and
 * never inside `KidModeState` — that shape is read by the overlay on every
 * rehydrate and a timestamp in it would be a new persisted field about a
 * child's behaviour. This is sessionStorage: it dies with the tab, which is
 * exactly the life of the session it measures.
 *
 * Shape: `{ at, n }` — a start time and an activity COUNT. Two numbers. There
 * is nothing here that could carry a child's content even if a caller wanted
 * it to (critic C9).
 */
export const KIDMODE_SESSION_SS_KEY = "arbor.kidmode.session";

/** Persisted shape: open flag + the kid surface in view (validated by the overlay). */
export interface KidModeState {
  open: boolean;
  /** Overlay view id ("home" | kid surface id). Stored as a plain string; the
   *  overlay validates it against its own surface registry on rehydrate. */
  view?: string;
  /** HeroArcade world pre-selection carried by the arcade view (KID-4). */
  worldId?: string | null;
}

/** Structural storage subset (node-testable with a Map-backed fake). */
export interface KidModeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): KidModeStorage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Session-scoped sibling of defaultStorage() — same guards, same contract. */
function defaultSessionStorage(): KidModeStorage | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Injected clock + storage for the session stamp (tests pass a Map fake). */
export interface KidSessionDeps {
  storage?: KidModeStorage | null;
  now?: number;
}

/** In-memory mirror, so a blocked sessionStorage still measures the session. */
let kidSessionMemory: { at: number; n: number } | null = null;

function sessionStore(deps: KidSessionDeps): KidModeStorage | null {
  return deps.storage !== undefined ? deps.storage : defaultSessionStorage();
}

function readKidSession(deps: KidSessionDeps): { at: number; n: number } | null {
  const store = sessionStore(deps);
  if (store) {
    try {
      const raw = store.getItem(KIDMODE_SESSION_SS_KEY);
      if (raw) {
        const v = JSON.parse(raw) as Record<string, unknown>;
        const at = typeof v.at === "number" && Number.isFinite(v.at) ? v.at : Number.NaN;
        const n = typeof v.n === "number" && Number.isFinite(v.n) ? Math.max(0, Math.trunc(v.n)) : 0;
        // A reload INSIDE Kid Mode (LEAK 1) rehydrates the real start time.
        if (Number.isFinite(at)) return { at, n };
      }
    } catch {
      /* unreadable / garbage → fall back to the in-memory mirror */
    }
  }
  return kidSessionMemory;
}

function writeKidSession(value: { at: number; n: number } | null, deps: KidSessionDeps): void {
  kidSessionMemory = value;
  const store = sessionStore(deps);
  if (!store) return;
  try {
    if (value) store.setItem(KIDMODE_SESSION_SS_KEY, JSON.stringify(value));
    else store.removeItem(KIDMODE_SESSION_SS_KEY);
  } catch {
    /* storage unavailable — the in-memory mirror still carries the session */
  }
}

/**
 * A kid activity finished. A COUNT, incremented by the kid surfaces; no id, no
 * title, no domain — `kid_session_end` carries two integers and this is one of
 * them. A no-op outside Kid Mode, so a parent surface can never inflate it.
 */
export function noteKidActivity(deps: KidSessionDeps = {}): void {
  if (!active) return;
  const session = readKidSession(deps);
  if (!session) return;
  writeKidSession({ at: session.at, n: session.n + 1 }, deps);
}

const CLOSED: KidModeState = { open: false };

/** Serializes a state for storage (pure — round-trips through parseKidModeState). */
export function serializeKidModeState(state: KidModeState): string {
  return JSON.stringify({
    open: state.open === true,
    view: typeof state.view === "string" ? state.view : undefined,
    worldId: typeof state.worldId === "string" ? state.worldId : undefined,
  });
}

/** Parses a persisted raw value; ANY garbage/legacy shape degrades to closed. */
export function parseKidModeState(raw: string | null): KidModeState {
  if (raw === null) return CLOSED;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return CLOSED;
    const o = v as Record<string, unknown>;
    if (o.open !== true) return CLOSED;
    return {
      open: true,
      view: typeof o.view === "string" ? o.view : undefined,
      worldId: typeof o.worldId === "string" ? o.worldId : null,
    };
  } catch {
    return CLOSED;
  }
}

/** Reads the persisted state; closed when storage is unavailable. */
export function readKidModeState(storage: KidModeStorage | null = defaultStorage()): KidModeState {
  if (!storage) return CLOSED;
  try {
    return parseKidModeState(storage.getItem(KIDMODE_LS_KEY));
  } catch {
    return CLOSED;
  }
}

/** Writes the state; closing removes the key entirely (no stale residue). */
export function writeKidModeState(state: KidModeState, storage: KidModeStorage | null = defaultStorage()): void {
  if (!storage) return;
  try {
    if (state.open) storage.setItem(KIDMODE_LS_KEY, serializeKidModeState(state));
    else storage.removeItem(KIDMODE_LS_KEY);
  } catch {
    /* storage unavailable — non-fatal, gate still works in-memory */
  }
}

/* ── the subscribable gate ──────────────────────────────────────────────────── */

type KidModeListener = (active: boolean) => void;
const listeners = new Set<KidModeListener>();

// LEAK 1: rehydrate synchronously at module load — readers that run before
// React mounts (native back listener, first Shell render) see the truth.
let active = readKidModeState().open;

/** Current gate value. Safe from any module, React or not. */
export function isKidModeActive(): boolean {
  return active;
}

/**
 * Sets the gate (KidModeContext is the only intended writer) and notifies
 * subscribers. Idempotent — setting the current value notifies no one.
 */
export function setKidModeActive(next: boolean, deps: KidSessionDeps = {}): void {
  if (next === active) return;
  // N1-01: the session boundary is measured HERE because this gate is the one
  // place Kid Mode can open or close from. ORDER IS LOAD-BEARING: the end event
  // is emitted while `active` is still true, so lib/analytics tags it
  // `kid_mode: true` and strips marketing attribution at its own choke point.
  // Flipping first would ship a child-generated event carrying the parent's
  // utm_* props. This module never re-implements that gate; it only respects it.
  if (next) writeKidSession({ at: deps.now ?? Date.now(), n: 0 }, deps);
  else endKidSession(deps);
  active = next;
  for (const listener of [...listeners]) {
    try {
      listener(active);
    } catch {
      /* one bad listener never blocks the rest */
    }
  }
}

/** Closes the measured session and emits it. Called only on a true→false flip. */
function endKidSession(deps: KidSessionDeps): void {
  const session = readKidSession(deps);
  writeKidSession(null, deps);
  const now = deps.now ?? Date.now();
  // No stamp (storage blocked before the open, or a pre-N1-01 session still in
  // flight at deploy) still reports the exit — seconds 0 is honest, a missing
  // event is not.
  const seconds = session ? Math.max(0, Math.round((now - session.at) / 1000)) : 0;
  trackKidSessionEnd({ seconds, activities: session ? session.n : 0 });
}

/** Subscribe to gate changes; returns the unsubscribe function. */
export function subscribeKidMode(listener: KidModeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
