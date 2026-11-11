/**
 * Deploy-skew recovery (11 Nov 2026 regression review).
 *
 * Every production release replaces the hashed `/assets/*` chunks. A tab or
 * home-screen app opened before that release still runs the old entry module
 * and asks for chunk names that no longer exist. Hosting answers those with
 * the SPA shell (HTTP 200, text/html), so the dynamic import fails with a MIME
 * error: the screen the parent tapped (Ask Arbor, New question, any lazy tab)
 * never opens, and React.lazy caches that rejection, so "Try again" cannot
 * succeed either. The only correct state is the current build: reload once.
 *
 * The reload answers a load the parent just asked for and that already failed.
 * It is never triggered by an update being available, so a running game,
 * recording or draft is never taken over (sw.js keeps that rule).
 * A second failure inside the window is a real outage, not skew: no loop; the
 * boundary shows an explicit Reload instead.
 */

export const STALE_BUILD_RELOAD_KEY = "arbor.staleBuildReloadAt";
export const STALE_BUILD_RELOAD_WINDOW_MS = 60_000;

// Chromium, Firefox and Safari wordings for a failed module/chunk fetch, plus
// Vite's CSS preload failure and the strict-MIME refusal of an HTML "script".
const STALE_CHUNK_MESSAGE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|Expected a JavaScript(?:-or-Wasm)? module script|is not a valid JavaScript MIME type/i;

export function isStaleBuildError(error: unknown): boolean {
  const message = typeof error === "string"
    ? error
    : error && typeof error === "object" ? (error as { message?: unknown }).message : undefined;
  return typeof message === "string" && STALE_CHUNK_MESSAGE.test(message);
}

type ReloadStamp = Pick<Storage, "getItem" | "setItem">;

export type StaleBuildEnv = {
  now: () => number;
  storage: ReloadStamp | null;
  reload: () => void;
};

function browserEnv(): StaleBuildEnv {
  let storage: ReloadStamp | null = null;
  try { storage = window.sessionStorage; } catch { /* storage blocked */ }
  return { now: () => Date.now(), storage, reload: () => window.location.reload() };
}

/** Reload into the current build at most once per window (per tab). Returns
 *  true when a reload was started. Without working storage there is no loop
 *  guard, so it never reloads by itself; the boundary offers Reload instead. */
export function reloadIntoCurrentBuild(env: StaleBuildEnv = browserEnv()): boolean {
  const now = env.now();
  try {
    if (!env.storage) return false;
    const last = Number(env.storage.getItem(STALE_BUILD_RELOAD_KEY));
    if (Number.isFinite(last) && last > 0 && now >= last && now - last < STALE_BUILD_RELOAD_WINDOW_MS) return false;
    env.storage.setItem(STALE_BUILD_RELOAD_KEY, String(now));
    if (env.storage.getItem(STALE_BUILD_RELOAD_KEY) !== String(now)) return false;
  } catch {
    return false;
  }
  env.reload();
  return true;
}

/** Vite dispatches `vite:preloadError` when a lazy chunk or its preloaded CSS
 *  fails (including the import itself). The event is not cancelled: if no
 *  reload starts, the error still reaches the nearest ErrorBoundary. */
export function installStaleBuildRecovery(target: Pick<Window, "addEventListener"> = window, env?: StaleBuildEnv): void {
  target.addEventListener("vite:preloadError", () => { reloadIntoCurrentBuild(env); });
}
