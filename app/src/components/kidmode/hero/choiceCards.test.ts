/**
 * K2 4e — the child's choice cards: a 4:3 crop of each choice's first page
 * (plate + the child's sprite at the page's slot), placed exactly as the
 * reader places the sprite, the whole child inside the card.
 */
import { describe, expect, it } from "vitest";
import { fiveSmoothStones as book } from "../../../lib/library/books/fiveSmoothStones";
import { mockHeroPoseRaster } from "../../../lib/heroPoseMockArt";
import type { HeroPoseId } from "../../../lib/heroSheetContract";
import { keyBookSprite } from "./heroKeyer";
import { choiceCardPlans, cropAround, heroBoxOnPlate } from "./choiceCards";

const anchors = new Map(
  ["run-staff-left", "armour-stuck", "sit-hunched"].map((pose) => [pose, keyBookSprite(mockHeroPoseRaster(pose as HeroPoseId)).anchor!] as const),
);

describe("K2 4e: choice cards", () => {
  it("one card per choice, from the choice's first page (p6a, p6b, p6c), the child inside a 4:3 crop of the plate", () => {
    const plans = choiceCardPlans(book, anchors);
    expect(plans.map((p) => [p.choiceId, p.plateId])).toEqual([["a", "PL3"], ["b", "PL4e"], ["c", "PL3w2"]]);
    for (const p of plans) {
      expect(p.crop.w / p.crop.h, p.choiceId).toBeCloseTo(4 / 3, 5);
      expect(p.crop.x, p.choiceId).toBeGreaterThanOrEqual(0);
      expect(p.crop.y, p.choiceId).toBeGreaterThanOrEqual(0);
      expect(p.crop.x + p.crop.w, p.choiceId).toBeLessThanOrEqual(p.plate.w + 1e-6);
      expect(p.crop.y + p.crop.h, p.choiceId).toBeLessThanOrEqual(p.plate.h + 1e-6);
      // the whole child: head and feet inside the card
      expect(p.hero.y, p.choiceId).toBeGreaterThanOrEqual(p.crop.y - 1e-6);
      expect(p.hero.y + p.hero.h, p.choiceId).toBeLessThanOrEqual(p.crop.y + p.crop.h + 1e-6);
      expect(p.hero.x + p.hero.w / 2, p.choiceId).toBeGreaterThan(p.crop.x);
      expect(p.hero.x + p.hero.w / 2, p.choiceId).toBeLessThan(p.crop.x + p.crop.w);
    }
  }, 60_000);

  it("the sprite sits where the reader puts it (feet on the slot) and the feet sit low in the card", () => {
    const slot = { pose: "x", x: 0.4, y: 0.8, scale: 0.26, facing: "right" as const, z: "fr" as const };
    const plate = { w: 2528, h: 1696 };
    const hero = heroBoxOnPlate(slot, { aspect: 0.5, footX: 0.4, footW: 0.3 }, plate);
    expect(hero.y + hero.h).toBeCloseTo(0.8 * 1696, 6);
    expect(hero.x + 0.4 * hero.w).toBeCloseTo(0.4 * 2528, 6);
    const crop = cropAround(hero, plate);
    expect((hero.y + hero.h - crop.y) / crop.h).toBeCloseTo(0.88, 5);
    expect(crop.h).toBeCloseTo(hero.h * 1.6, 5);
  });

  it("no anchor for the page's pose = no card (the reader keeps the plate's focus crop)", () => {
    expect(choiceCardPlans(book, new Map()).length).toBe(0);
  });
});
