/**
 * B-KID-47 — no blank screen between worlds (K0, without the GameShell):
 * the home prefetches every world chunk on idle, Kid Mode never shows the
 * parent grey TabSkeleton (the world's own art + the hero instead), and the
 * overlay no longer holds an empty stage for the old view's exit.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (rel: string) => readFileSync(path.resolve(__dirname, "..", rel), "utf8");
const overlay = read("kidmode/KidModeOverlay.tsx");
const arcade = read("practice/HeroArcade.tsx");
const dash = read("kidmode/KidDashboard.tsx");
const prefetch = read("kidmode/kidPrefetch.ts");
const fallback = read("kidmode/KidStageFallback.tsx");

const lazySpecifiers = (src: string) => [...src.matchAll(/lazy\(\(\) => import\("([^"]+)"\)\)/g)].map((m) => m[1]);
const fromKidmode = (spec: string, fileDir: "kidmode" | "practice") =>
  path.posix.normalize(path.posix.join(fileDir === "kidmode" ? "kidmode" : "practice", spec));

describe("B-KID-47: no grey parent skeleton in Kid Mode", () => {
  it("the overlay's every Suspense shows the kid stage, never TabSkeleton", () => {
    expect(overlay).not.toContain("TabSkeleton");
    expect(overlay.match(/<Suspense fallback=\{<KidStageFallback/g)?.length).toBe(4);
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
    expect(overlay).toContain("key={kidViewKey(view, arcadeWorldId)}");
  });
});

describe("B-KID-47: the home warms every world chunk", () => {
  it("prefetches exactly the modules the kid lazy() calls load", () => {
    const wanted = new Set([
      ...lazySpecifiers(overlay).map((s) => fromKidmode(s, "kidmode")),
      ...lazySpecifiers(arcade).map((s) => fromKidmode(s, "practice")),
    ]);
    const warmed = new Set([...prefetch.matchAll(/import\("([^"]+)"\)/g)].map((m) => fromKidmode(m[1], "kidmode")));
    // the comics shelf + word world are not home tiles; everything a tile opens is warmed
    for (const spec of ["practice/PracticeHubTab", "tabs/HeroJourneyTab", "practice/MindVaultWorld", "practice/PatternPowerWorld", "practice/BeatKeeperWorld", "practice/HeroPoseWorld", "practice/SpellForgeWorld", "practice/SpeechCoachTab", "practice/MimicStudioTab", "practice/FeelingsLabTab", "practice/AdventuresTab"]) {
      expect(wanted.has(spec), `${spec} is a lazy kid surface`).toBe(true);
      expect(warmed.has(spec), `${spec} is prefetched`).toBe(true);
    }
  });
  it("the home calls it once on mount", () => {
    expect(dash).toContain("useEffect(() => { prefetchKidSurfaces(); }, []);");
  });
  it("runs once per session, on idle", async () => {
    const calls: number[] = [];
    vi.stubGlobal("window", { requestIdleCallback: (cb: () => void) => { calls.push(1); return 1; }, setTimeout });
    try {
      const mod = await import("./kidPrefetch");
      mod.__resetKidPrefetch();
      mod.prefetchKidSurfaces();
      mod.prefetchKidSurfaces();
      expect(calls).toHaveLength(1);
      expect(mod.KID_SURFACE_CHUNKS).toHaveLength(11);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
