import { describe, expect, it } from "vitest";
import { offersForChild } from "../../../lib/age/playGate";
import { KID_WORLDS } from "../kidWorlds";
import { STUDIO_V2_ACTIVITIES, STUDIO_V2_WORLDS, studioActivitiesForChild, studioActivity, studioActivityFits, studioActivityFromLegacy, studioLegacyRoute } from "./studioCatalog";
import { studioCopy } from "./studioCopy";
import { STUDIO_GAME_SELECTION, studioMenuActivities } from './studioCatalog';
const now = new Date("2026-10-13T12:00:00Z");
const child = (ageMonths: number) => ({ id: "test-child", age: Math.floor(ageMonths / 12), ageMonths, ageMonthsAsOf: "2026-10-13" });
describe("Studio V2 retains real destinations and eligibility", () => {
  it('curates eight distinct games while keeping legacy history resolvable', () => {
    const menu = STUDIO_V2_WORLDS.flatMap(world => studioMenuActivities(world, child(84), 'he', now));
    expect(menu.map(a => a.id).sort()).toEqual([...STUDIO_GAME_SELECTION].sort());
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
