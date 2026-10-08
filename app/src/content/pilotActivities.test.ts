import { describe, expect, it } from "vitest";
import { availableSourceActivities, SOURCE_ACTIVITIES, sourceActivityForLog } from "./sourceActivities";
import { fitsTomorrowKit, TOMORROW_KITS } from "./tomorrowTogether";

const NOW = new Date("2026-10-08T12:00:00Z");
describe("source-based editorial pilot", () => {
  it("has twenty unique bilingual, traceable draft activities without clinical stamps", () => {
    expect(SOURCE_ACTIVITIES).toHaveLength(20);
    expect(new Set(SOURCE_ACTIVITIES.map(c => c.id)).size).toBe(20);
    for (const c of SOURCE_ACTIVITIES) {
      for (const lang of ["en", "he"] as const) for (const slot of ["title", "do", "say", "materials"] as const) expect(c[slot][lang].trim()).not.toBe("");
      expect(c.source).toMatch(/^https:\/\/me\.health\.gov\.il\//);
      expect(c.checkedAt).toBe("2026-10-08");
      expect(c.reviewStatus).toBe("draft");
      expect("review" in c).toBe(false);
    }
  });
  it("filters the actual months and fails closed on unknown age or expiry", () => {
    expect(availableSourceActivities(24, NOW)).toHaveLength(7);
    expect(availableSourceActivities(35, NOW)).toHaveLength(7);
    expect(availableSourceActivities(36, NOW)).toHaveLength(7);
    expect(availableSourceActivities(48, NOW)).toHaveLength(6);
    for (const m of [null, NaN, -1, 23, 60]) expect(availableSourceActivities(m, NOW)).toEqual([]);
    expect(availableSourceActivities(36, new Date("2026-12-03T00:00:00Z"))).toEqual([]);
  });
  it("passes the selected content's identity and language into the existing play log contract", () => {
    const card = SOURCE_ACTIVITIES[8];
    expect(sourceActivityForLog(card, "he")).toMatchObject({ id: card.id, title: card.title.he, steps: [card.do.he, card.say.he], source: { url: card.source } });
  });
});
describe("parent-led tomorrow kits", () => {
  it("offers exactly three complete three-picture kits within the declared ages", () => {
    expect(TOMORROW_KITS).toHaveLength(3);
    for (const k of TOMORROW_KITS) {
      expect(k.scenes).toHaveLength(3);
      for (const lang of ["en", "he"] as const) expect(new Set(k.scenes.map(s => s.story[lang])).size).toBe(3);
    }
    for (const m of [36, 60, 83]) expect(fitsTomorrowKit(m)).toBe(true);
    for (const m of [null, 35, 84, NaN]) expect(fitsTomorrowKit(m)).toBe(false);
  });
});
