/**
 * B-KID-47 — no blank screen between worlds (K0, without the GameShell):
 * the home prefetches navigation shells on idle, Kid Mode never shows the
 * parent grey TabSkeleton (the world's own art + the hero instead), and the
 * overlay no longer holds an empty stage for the old view's exit.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (rel: string) => readFileSync(path.resolve(__dirname, "..", rel), "utf8");
const overlay = read("kidmode/KidModeOverlay.tsx");
const arcade = read("practice/HeroArcade.tsx");
const dash = read("kidmode/KidDashboard.tsx");
const prefetch = read("kidmode/kidPrefetch.ts");
const fallback = read("kidmode/KidStageFallback.tsx");

describe("B-KID-47: no grey parent skeleton in Kid Mode", () => {
  it("the overlay's every Suspense shows the kid stage, never TabSkeleton", () => {
    expect(overlay).not.toContain("TabSkeleton");
    const all = overlay.match(/<Suspense fallback=/g)?.length ?? 0;
    const stages = overlay.match(/<Suspense fallback=\{<KidStageFallback/g)?.length ?? 0;
    expect(all).toBeGreaterThan(4);
    expect(stages).toBe(all - 1); // The pinned reader owns its cover fallback.
    expect(overlay.match(/<Suspense fallback=\{null\}/g)).toHaveLength(1);
    expect(overlay).toContain("<KidStageFallback worldId={arcadeWorldId ?? undefined} />");
  });
  it("the arcade's world Suspense is the kid stage while Kid Mode is on (parent keeps its skeleton)", () => {
    expect(arcade).toContain("<Suspense fallback={kidMode ? <KidStageFallback worldId={open.id} /> : <TabSkeleton />}><Comp /></Suspense>");
  });
  it("the stage is the world's own art in the child's theme; no sticker over a hero picture", () => {
    expect(fallback).toContain("worldArtwork(worldId, theme)");
    expect(fallback).toContain("{!art?.hasHero && (");
    expect(fallback).not.toMatch(/<TabSkeleton|import \{ TabSkeleton/);
  });
  it("no empty-stage hold: the overlay swaps views at once (B-KID-74: no exit hold at all)", () => {
    expect(overlay).not.toContain('mode="wait"');
    // B-KID-74 re-pin: popLayout kept every left view mounted until its exit
    // finished; the content is now one keyed enter-only node (oneKidView.test).
    expect(overlay).not.toContain('mode="popLayout"');
    expect(overlay).toContain("key={`${scopeKey}:${kidViewKey(view, arcadeWorldId)}`}");
  });
});

describe("Kids loading: small home warm-up, selected game ready on intro", () => {
  it("keeps home prefetch to two shells, not legacy games or capture tools", async () => {
    const mod = await import("./kidPrefetch");
    expect(mod.KID_SURFACE_CHUNKS).toHaveLength(2);
    const homeQueue = prefetch.slice(prefetch.indexOf('export const KID_SURFACE_CHUNKS'), prefetch.indexOf('export function prefetchKidSurfaces'));
    expect(homeQueue).toContain("import('./studioV2/StudioWorld')");
    expect(homeQueue).toContain("import('./studioV2/StudioGame')");
    expect(homeQueue).not.toMatch(/SpeechCoach|MimicStudio|HeroPose|MindVault|RiverRescue/);
  });
  it("the three current adventures and lazy renderer share the exact same loader", () => {
    const game = read("kidmode/studioV2/StudioGame.tsx");
    for (const [id, component] of [['river-rescue', 'RiverRescue'], ['feelings-forest', 'FeelingsForest'], ['rhythm-garden', 'RhythmGarden']]) {
      expect(prefetch).toContain(`import('./studioV2/games/adventures/${component}')`);
      expect(game).toContain(`lazy(STUDIO_ACTIVITY_LOADERS['${id}'])`);
    }
    expect(game).toContain("if (!eligible || phase !== 'intro') return;");
    expect(game).toContain('preloadStudioActivity(activityId)');
  });
  it("both homes return the cancellation function on unmount", () => {
    expect(dash).toContain('useEffect(() => prefetchKidSurfaces(), []);');
    expect(read("kidmode/studioV2/StudioHome.tsx")).toContain('useEffect(() => prefetchKidSurfaces(), []);');
  });
});
