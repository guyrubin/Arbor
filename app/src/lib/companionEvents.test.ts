import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Companion places — analytics parity (9 Oct 2026). The three-place rewrite
 * shipped with zero `track(` calls under components/companion/, and the
 * Practice Studio and Today events stopped with the code that emitted them.
 * This pins the restored family: names, exact key sets, ids only, Kid Mode
 * silent, and the LIVE call sites.
 */
const trackSpy = vi.hoisted(() => vi.fn());
const kidMode = vi.hoisted(() => ({ active: false }));
vi.mock("./analytics", () => ({ track: trackSpy }));
vi.mock("./kidModeGate", () => ({ isKidModeActive: () => kidMode.active }));

import { KpiEvent, UNKNOWN_ID, trackCompanionPanelOpen, trackCompanionPlaceOpen, trackPracticeStudioOpen, trackPracticeTogetherDid } from "./kpiEvents";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("companion events — names, exact keys, ids only", () => {
  beforeEach(() => { trackSpy.mockClear(); kidMode.active = false; });

  const table: [string, () => void, string, Record<string, unknown>][] = [
    ["place", () => trackCompanionPlaceOpen("now"), "companion_place_open", { place: "now" }],
    ["panel", () => trackCompanionPanelOpen("seed"), "companion_panel_open", { via: "seed" }],
    ["world", () => trackPracticeStudioOpen("sound-lab", "kidmode"), "practice_studio_open", { world: "sound-lab", via: "kidmode" }],
    ["together", () => trackPracticeTogetherDid("build"), "practice_together_did", { card: "build" }],
  ];
  for (const [label, fire, event, props] of table) {
    it(`${label}: emits ${event} with exactly ${JSON.stringify(Object.keys(props))}`, () => {
      fire();
      expect(trackSpy).toHaveBeenCalledTimes(1);
      expect(trackSpy).toHaveBeenCalledWith(event, props);
    });
  }

  it("the names are declared in KpiEvent (dashboards read these strings)", () => {
    expect(KpiEvent.CompanionPlaceOpen).toBe("companion_place_open");
    expect(KpiEvent.CompanionPanelOpen).toBe("companion_panel_open");
    expect(KpiEvent.PracticeStudioOpen).toBe("practice_studio_open");
    expect(KpiEvent.PracticeTogetherDid).toBe("practice_together_did");
  });

  it("NEGATIVE CONTROL: free text and unknown enums never reach the sink verbatim", () => {
    trackCompanionPlaceOpen("Dylan's portrait");
    trackCompanionPanelOpen("whatsapp");
    trackPracticeStudioOpen("Mia cried at the sound lab", "kidmode");
    trackPracticeTogetherDid("We built a tower with Mia");
    for (const [, props] of trackSpy.mock.calls) {
      for (const value of Object.values(props as Record<string, unknown>)) expect(value === UNKNOWN_ID || value === "kidmode").toBe(true);
    }
  });

  it("Kid Mode never emits", () => {
    kidMode.active = true;
    trackCompanionPlaceOpen("together"); trackCompanionPanelOpen("launcher");
    trackPracticeStudioOpen("sound-lab", "direct"); trackPracticeTogetherDid("build");
    expect(trackSpy).not.toHaveBeenCalled();
  });
});

describe("companion events — the call sites are live", () => {
  const now = read("components/companion/NowView.tsx");
  const recommendation = read("components/companion/NowRecommendation.tsx");
  const portrait = read("components/companion/ChildPortrait.tsx");
  const together = read("components/companion/TogetherView.tsx");
  const workspace = read("components/companion/CompanionWorkspace.tsx");

  it("each place reports itself once per mount (or per child)", () => {
    expect(now).toContain('useEffect(() => { trackCompanionPlaceOpen("now"); }, []);');
    expect(portrait).toContain('useEffect(() => { trackCompanionPlaceOpen("child"); }, [childProfile.id]);');
    expect(together).toContain('useEffect(() => { trackCompanionPlaceOpen("together"); }, [childProfile.id]);');
  });

  it("the panel reports every way it opens, once per opening", () => {
    expect(workspace).toContain("if (!openRef.current) trackCompanionPanelOpen(via);");
    for (const via of ["route", "seed", "launcher"]) expect(workspace).toContain(`show("${via}")`);
  });

  it("Now re-emits the funnel's offered step for each distinct AI step", () => {
    expect(recommendation).toContain('useEffect(() => { if (useAi && aiStep) trackActionOffered("now"); }, [useAi, aiStep]);');
  });

  it("Together keeps Practice Studio's two series alive", () => {
    expect(together).toContain('trackPracticeStudioOpen(world.id, direct ? "direct" : "kidmode");');
    expect(together).toMatch(/setKeptState\(\{ childId: childProfile\.id, ids: \[\.\.\.kept, id\] \}\); trackPracticeTogetherDid\(id\);/);
  });

  it("NEGATIVE CONTROL: the companion folder is no longer silent", () => {
    const dir = path.resolve(__dirname, "..", "components", "companion");
    const files = fs.readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
    const emitting = files.filter((f) => /track[A-Z]\w*\(/.test(read(`components/companion/${f}`)));
    expect(emitting.length).toBeGreaterThanOrEqual(5);
  });
});
