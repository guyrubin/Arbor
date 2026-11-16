import { afterEach, describe, expect, it, vi } from "vitest";
import { offersForChild } from "../../../lib/age/playGate";
import { KID_WORLDS } from "../kidWorlds";
import { STUDIO_V2_ACTIVITIES, STUDIO_V2_WORLDS, studioActivitiesForChild, studioActivity, studioActivityFits, studioActivityFromLegacy, studioLegacyRoute } from "./studioCatalog";
import { studioCopy } from "./studioCopy";
import { STUDIO_GAME_SELECTION, STUDIO_MAKER_IDS, isStudioMakerId, studioMenuActivities } from './studioCatalog';
import { resetStudioNextFlagForTests } from "./studioNextFlag";
const now = new Date("2026-10-13T12:00:00Z");
const child = (ageMonths: number) => ({ id: "test-child", age: Math.floor(ageMonths / 12), ageMonths, ageMonthsAsOf: "2026-10-13" });
describe("Studio V2 retains real destinations and eligibility", () => {
  it('curates eight distinct games plus the twelve makers while keeping legacy history resolvable', () => {
    const menu = STUDIO_V2_WORLDS.flatMap(world => studioMenuActivities(world, child(84), 'he', now));
    expect(menu.map(a => a.id).sort()).toEqual([...STUDIO_GAME_SELECTION, ...STUDIO_MAKER_IDS].sort());
    for (const id of ['feelings', 'mimic', 'beat', 'sound-explorer', 'reading', 'pose', 'speech', 'adventures']) {
      expect(menu.some(a => a.id === id)).toBe(false); expect(studioActivity(id)).toBeDefined();
    }
  });
  it("has one world per activity and preserves all nine legacy routes", () => {
    expect(new Set(STUDIO_V2_ACTIVITIES.map(a => a.id)).size).toBe(STUDIO_V2_ACTIVITIES.length);
    for (const legacy of KID_WORLDS) {
      const activity = studioActivityFromLegacy(legacy.worldId);
      expect(activity?.legacyWorldId).toBe(legacy.worldId);
      expect(studioLegacyRoute(activity!.id)).toEqual({ surface: "arcade", worldId: legacy.worldId });
    }
    expect(studioActivity("mimic")?.worldId).toBe("feelings");
    expect(studioActivity("sound-explorer")?.worldId).toBe("studio");
  });
  it("retains the production age rules across preschool and school ages", () => {
    for (const months of [24, 36, 48, 60, 84]) {
      const expected = offersForChild(KID_WORLDS, child(months), now).map(w => w.worldId);
      const actual = STUDIO_V2_WORLDS.flatMap(world => studioActivitiesForChild(world, child(months), "en", now)).filter(a => a.legacyWorldId && a.id !== "sneak").map(a => a.legacyWorldId);
      expect(actual.sort()).toEqual(expected.sort());
    }
  });
  it("offers no games for an unknown age or a child under three", () => {
    for (const world of STUDIO_V2_WORLDS) {
      expect(studioActivitiesForChild(world, undefined, "en", now)).toEqual([]);
      expect(studioActivitiesForChild(world, child(24), "he", now)).toEqual([]);
    }
  });
  it("keeps English-only speech out of Hebrew while offering environmental sound", () => {
    expect(studioActivityFits("speech", child(60), "he", now)).toBe(false);
    expect(studioActivityFits("sound-explorer", child(60), "he", now)).toBe(true);
  });
  it("respects Sneak opt-out without hiding other games", () => {
    expect(studioActivityFits("sneak", child(60), "en", now, { sneakEnabled: false })).toBe(false);
    expect(studioActivityFits("memory", child(60), "en", now, { sneakEnabled: false })).toBe(true);
  });
  it("offers all eight requested real mechanics with complete EN/HE instructions", () => {
    for (const id of ["memory", "feelings", "mimic", "sound-explorer", "pattern", "calm-builder", "beat", "puzzle"] as const) {
      for (const lang of ["en", "he"] as const) {
        expect(studioActivityFits(id, child(60), lang, now)).toBe(true);
        expect(studioCopy(lang).activities[id].instruction.length).toBeGreaterThan(10);
      }
    }
  });
});

describe("the makers are new activities, on for every child", () => {
  const WORLD = { "mend-bowl": "studio", "stitch-garden": "studio", "paper-boat": "stories", "season-dial": "playbank", "crank-works": "playbank", "windup-race": "playbank", "clay-theatre": "stories", "bottle-lab": "studio", "ice-age-friend": "playbank", "tiny-builders": "playbank", "fox-trail": "playbank", "maker-desk": "studio" } as const;
  const optIn = () => { vi.stubGlobal("localStorage", { getItem: (k: string) => k === "arbor.flags.studioNext" ? "1" : null, setItem: () => {}, removeItem: () => {} }); resetStudioNextFlagForTests(); };
  afterEach(() => { vi.unstubAllGlobals(); resetStudioNextFlagForTests(); });
  it("twelve distinct ids, each its own activity in its own world with the Bop age bands and both languages", () => {
    expect([...STUDIO_MAKER_IDS]).toEqual(Object.keys(WORLD));
    for (const id of STUDIO_MAKER_IDS) {
      const a = studioActivity(id)!;
      expect(a.worldId).toBe(WORLD[id]); expect(a.legacyWorldId).toBeUndefined();
      expect(a.ageBands).toEqual(studioActivity("puzzle")!.ageBands); expect(a.languages).toEqual(["en", "he"]);
      expect(STUDIO_GAME_SELECTION).not.toContain(id); expect(isStudioMakerId(id)).toBe(true);
    }
    for (const id of ["memory", "puzzle", "", "toString", "__proto__"]) expect(isStudioMakerId(id)).toBe(false);
  });
  for (const switchOn of [false, true]) it(`device switch ${switchOn ? "on" : "off"}: each maker joins its world after the curated tiles, in EN and HE; age rules still hold`, () => {
    if (switchOn) optIn();
    for (const lang of ["en", "he"] as const) {
      for (const world of STUDIO_V2_WORLDS) {
        const ids = studioMenuActivities(world, child(60), lang, now).map(a => a.id);
        const makers = STUDIO_MAKER_IDS.filter(id => WORLD[id] === world);
        expect(ids.slice(ids.length - makers.length)).toEqual(makers);
        expect(ids.filter(id => !isStudioMakerId(id))).toEqual(STUDIO_GAME_SELECTION.filter(id => studioActivityFits(id, child(60), lang, now)).filter(id => studioActivity(id)!.worldId === world));
      }
      for (const id of STUDIO_MAKER_IDS) { expect(studioActivityFits(id, child(60), lang, now)).toBe(true); expect(studioActivityFits(id, child(24), lang, now)).toBe(false); }
    }
  });
});
