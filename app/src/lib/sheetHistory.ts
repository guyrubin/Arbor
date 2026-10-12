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
 * Learn reader keeps its own `arborLearnCard` marker; this one is `arborSheet`,
 * and a push keeps whatever state the entry under it carried, so a sheet
 * opened over an open Learn read returns to that read.
 *
 * Sheets are React state, so these helpers must survive what React does to
 * effects: StrictMode replays an open (it must not push twice), an unmount can
 * arrive without a close (the entry is still retired), and a second sheet can
 * open while the first one's Back is in flight (its push waits for the land,
 * or the browser would pop the new entry instead of the old one).
 *
 * A Back is asynchronous and cannot be cancelled. Everything that would add
 * an entry while one is in flight (a push, a route change in `after`, a
 * second close from a double tap) waits for it to land: afterSheetBack().
 * The land is the browser's own `popstate` and nothing else. IA-06r: no timer
 * stands in for it and no capture-phase listener second-guesses it. A retire
 * asks for a Back only when its own entry is on top, so there is always an
 * entry under it to land on; when the Back cannot even be asked, it lands at
 * once.
 *
 * The first `popstate` after our Back is taken as its land. Measured in
 * Chromium (12 Oct 2026, 30 Backs over a same-url entry): the land arrives
 * 1.9 to 21.4 ms after `history.back()` (median 3.4 ms, p90 8.7 ms), so not
 * reliably inside one 16.7 ms frame. A fragment navigation in that window
 * fires `popstate` at once (read as the land) and the Back then pops the new
 * entry: the route bounces back. So no route change may start while a Back is
 * in flight: ArborContext's setActiveTab and useHashQuery's goToRoute wait
 * through afterSheetBack while sheetBackInFlight(). What is left is a raw
 * `<a href="#/…">` clicked inside those few milliseconds; the app's route
 * changes go through those two seams.
 */

const KEY = "arborSheet";

/** Sheets that are open right now. */
const live = new Set<string>();
/** Sheets whose entry this page session pushed and has not yet retired. */
const entries = new Set<string>();
/** While one of our Backs is in flight: what waits for it to land. null = none in flight. */
let landing: Array<() => void> | null = null;
let seq = 0;

function hasHistory(): boolean {
  return typeof window !== "undefined" && !!window.history && !!window.location;
}

/** The sheet marker on the current history entry, or null. */
function tokenOnTop(): string | null {
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

/** True while one of our Backs is in flight (asked for, not yet landed). */
export function sheetBackInFlight(): boolean {
  return landing !== null;
}

/** Run the callback once no sheet's Back is in flight: now, or right after that Back lands. */
export function afterSheetBack(task: () => void): void {
  if (landing) landing.push(task);
  else task();
}

/**
 * The Back landed: run what waited, in order. Each task goes through
 * afterSheetBack again, so a task that starts a Back of its own hands
 * everything after it to that one: nothing ever runs while a Back is in flight.
 */
function land(): void {
  const waiting = landing ?? [];
  landing = null;
  waiting.forEach(task => afterSheetBack(task));
}

function push(token: string): void {
  if (!live.has(token) || entries.has(token) || !hasHistory()) return;
  if (landing) { landing.push(() => push(token)); return; }
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
  if (landing) { landing.push(() => retireSheetEntry(token, after)); return; }
  const mine = entries.delete(token);
  if (!mine || !hasHistory() || tokenOnTop() !== token) { after?.(); return; }
  landing = after ? [after] : [];
  const onLand = () => { window.removeEventListener("popstate", onLand); land(); };
  window.addEventListener("popstate", onLand);
  try { window.history.back(); } catch { onLand(); }
}

/**
 * The sheet's effect let go of it (an unmount, or StrictMode's replay). Retire
 * the entry only if no open claimed the same token again in this task (a
 * microtask, not a timer: it runs before any browser event can).
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
  if (!entries.has(token) || tokenOnTop() === token) return false;
  entries.delete(token);
  live.delete(token);
  return true;
}
