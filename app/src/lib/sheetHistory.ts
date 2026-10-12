/**
 * v3 IA-06 — one history entry per open L2 sheet.
 *
 * This generalises the Learn reader's pattern (LearnLibrary.tsx, OBJ-LEARN-02):
 * opening pushes ONE entry at the CURRENT url that carries a marker in
 * history state, so the browser Back button closes the sheet instead of
 * leaving the route; closing from inside the sheet retires that entry with
 * `history.back()`, so no orphan entry is left behind. ArborContext owns
 * `#/<tab>` and reacts to `hashchange` only, and a same-url entry fires
 * `popstate` without `hashchange`, so the two mechanisms never collide. The
 * Learn reader keeps its own `arborLearnCard` marker; this one is `arborSheet`.
 *
 * Sheets are React state, so these helpers must survive what React does to
 * effects: StrictMode replays an open (it must not push twice), an unmount can
 * arrive without a close (the entry is still retired), and a second sheet can
 * open while the first one's Back is in flight (its push waits for the land,
 * or the browser would pop the new entry instead of the old one).
 */

const KEY = "arborSheet";
/** A Back that never lands (no entry to return to) must not wedge the queue. */
const BACK_TIMEOUT_MS = 1000;

/** Sheets that are open right now. */
const live = new Set<string>();
/** Sheets whose entry this page session pushed and has not yet retired. */
const entries = new Set<string>();
let backPending = false;
let waiting: Array<() => void> = [];
let seq = 0;

function hasHistory(): boolean {
  return typeof window !== "undefined" && !!window.history && !!window.location;
}

/** The sheet marker on the current history entry, or null. */
export function sheetTokenOnTop(): string | null {
  if (!hasHistory()) return null;
  const state = window.history.state as unknown;
  if (!state || typeof state !== "object") return null;
  const value = (state as Record<string, unknown>)[KEY];
  return typeof value === "string" ? value : null;
}

/** A marker no earlier page load can have left in history state. */
export function newSheetToken(): string {
  seq += 1;
  return `${Date.now().toString(36)}-${seq}`;
}

function push(token: string): void {
  if (!live.has(token) || entries.has(token) || !hasHistory()) return;
  if (backPending) { waiting.push(() => push(token)); return; }
  try {
    const state = window.history.state as unknown;
    const base = state && typeof state === "object" ? state as Record<string, unknown> : {};
    window.history.pushState({ ...base, [KEY]: token }, "", window.location.href);
    entries.add(token);
  } catch { /* history unavailable — the sheet still opens; Back simply leaves */ }
}

/** The sheet opened: push its entry once. A replayed open is a no-op. */
export function openSheetEntry(token: string): void {
  live.add(token);
  push(token);
}

/**
 * The sheet closed from inside: retire its entry with one `history.back()`
 * when the entry is still on top, then run `after` once the browser has
 * landed. Navigation belongs in `after` — a hash change made before the Back
 * lands would be the entry the Back pops.
 */
export function retireSheetEntry(token: string, after?: () => void): void {
  live.delete(token);
  if (backPending) { waiting.push(() => retireSheetEntry(token, after)); return; }
  if (!entries.has(token)) { after?.(); return; }
  entries.delete(token);
  if (!hasHistory() || sheetTokenOnTop() !== token) { after?.(); return; }
  backPending = true;
  let landed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const land = () => {
    if (landed) return;
    landed = true;
    window.removeEventListener("popstate", land);
    if (timer !== undefined) clearTimeout(timer);
    backPending = false;
    after?.();
    const queued = waiting;
    waiting = [];
    queued.forEach(run => run());
  };
  window.addEventListener("popstate", land);
  timer = setTimeout(land, BACK_TIMEOUT_MS);
  try { window.history.back(); } catch { land(); }
}

/**
 * The sheet's effect let go of it (an unmount, or StrictMode's replay). Retire
 * the entry only if no open claimed the same token again in this task.
 */
export function releaseSheetEntry(token: string): void {
  live.delete(token);
  queueMicrotask(() => { if (!live.has(token)) retireSheetEntry(token); });
}

/**
 * On `popstate`: true once — when the browser itself moved off this sheet's
 * entry (the parent pressed Back). The entry is gone, so nothing retires it.
 */
export function sheetEntryLeft(token: string): boolean {
  if (!entries.has(token) || sheetTokenOnTop() === token) return false;
  entries.delete(token);
  live.delete(token);
  return true;
}
