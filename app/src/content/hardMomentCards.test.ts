import { describe, expect, it } from "vitest";
import { hardMomentCards, publishedHardMomentCards } from "./hardMomentCards";

describe("hard moment content pack", () => {
  it("contains 25 unique bilingual governed cards", () => {
    expect(hardMomentCards).toHaveLength(25);
    expect(new Set(hardMomentCards.map((item) => item.id)).size).toBe(25);
    for (const item of hardMomentCards) {
      expect(item.locales).toEqual(expect.arrayContaining(["en", "he"]));
      expect(item.title.en.trim().length).toBeGreaterThan(3);
      expect(item.title.he.trim().length).toBeGreaterThan(3);
      for (const field of [item.doNow, item.sayThis, item.avoid, item.observe, item.escalation]) {
        expect(field.en.trim().length).toBeGreaterThan(10);
        expect(field.he.trim().length).toBeGreaterThan(5);
      }
      expect(item.reviewStatus).toBe("draft");
    }
  });

  it("keeps unreviewed drafts out of product surfaces", () => {
    expect(publishedHardMomentCards).toHaveLength(0);
  });
});
