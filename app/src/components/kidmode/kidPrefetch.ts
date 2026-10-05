/**
 * B-KID-47 — no blank screen between worlds. The kid home warms the code of
 * every surface it opens once the browser is idle, so a tile tap mounts the
 * world from cache instead of a two-chunk waterfall (overlay → arcade →
 * world). The specifiers are the SAME modules the lazy() calls load
 * (KidModeOverlay, HeroArcade), so the bundler reuses one chunk each.
 */
export const KID_SURFACE_CHUNKS: readonly (() => Promise<unknown>)[] = [
  () => import("../practice/PracticeHubTab"),
  () => import("../tabs/HeroJourneyTab"),
  () => import("../practice/MindVaultWorld"),
  () => import("../practice/PatternPowerWorld"),
  () => import("../practice/BeatKeeperWorld"),
  () => import("../practice/HeroPoseWorld"),
  () => import("../practice/SpellForgeWorld"),
  () => import("../practice/SpeechCoachTab"),
  () => import("../practice/MimicStudioTab"),
  () => import("../practice/FeelingsLabTab"),
  () => import("../practice/AdventuresTab"),
];

let warmed = false;

/** Once per session, on idle: fetch every kid surface chunk; failures are
 *  silent (the lazy() call retries on tap, behind KidStageFallback). */
export function prefetchKidSurfaces(): void {
  if (warmed || typeof window === "undefined") return;
  warmed = true;
  const run = () => { for (const load of KID_SURFACE_CHUNKS) void load().catch(() => { /* retried on tap */ }); };
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(run, { timeout: 2000 });
  else window.setTimeout(run, 300);
}

/** Test-only. */
export const __resetKidPrefetch = (): void => { warmed = false; };
