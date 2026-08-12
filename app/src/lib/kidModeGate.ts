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

/** localStorage key for the persisted Kid Mode state (arbor.* convention). */
export const KIDMODE_LS_KEY = "arbor.kidmode.active";

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
export function setKidModeActive(next: boolean): void {
  if (next === active) return;
  active = next;
  for (const listener of [...listeners]) {
    try {
      listener(active);
    } catch {
      /* one bad listener never blocks the rest */
    }
  }
}

/** Subscribe to gate changes; returns the unsubscribe function. */
export function subscribeKidMode(listener: KidModeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
