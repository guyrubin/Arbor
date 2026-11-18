import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { storiesWorthCardId, storiesWorthKicker } from "./storiesWorth";
import { LEARN_CARDS } from "../../learn/learnCards";

/* Stories › Worth knowing (N-Stories-D/M): one reviewed read by age, none outside the bands. */

const months = (years: number) => years * 12 + 4;

describe("storiesWorthCardId", () => {
  it("a 3-year-old gets the reading-aloud read, a reviewed card whose band covers three", () => {
    const id = storiesWorthCardId(months(3));
    expect(id).toBe("reading-aloud");
    const card = LEARN_CARDS.find((c) => c.id === id)!;
    expect(card).toBeDefined();
    expect(card.ageMin).toBeLessThanOrEqual(3);
    expect(card.ageMax).toBeGreaterThanOrEqual(3);
  });
  it("seven to ten get how children learn to tell a story, inside that card's band", () => {
    for (const y of [7, 8, 10]) {
      const card = LEARN_CARDS.find((c) => c.id === storiesWorthCardId(months(y)))!;
      expect(card.id).toBe("storytelling-development");
      expect(card.ageMin).toBeLessThanOrEqual(y);
      expect(card.ageMax).toBeGreaterThanOrEqual(y);
    }
  });
  it("negative control: no card outside both bands, or with no age on the profile", () => {
    expect(storiesWorthCardId(months(11))).toBeNull();
    expect(storiesWorthCardId(months(14))).toBeNull();
    expect(storiesWorthCardId(null)).toBeNull();
    expect(storiesWorthCardId(Number.NaN)).toBeNull();
  });
  it("every age the helper answers lies inside the chosen card's own age band", () => {
    for (let y = 0; y <= 16; y++) {
      const id = storiesWorthCardId(months(y));
      if (!id) continue;
      const card = LEARN_CARDS.find((c) => c.id === id)!;
      expect(y >= card.ageMin && y <= card.ageMax, `${id} at ${y}`).toBe(true);
    }
  });
});

describe("storiesWorthKicker", () => {
  it("says the age in words in both languages, as My child does", () => {
    expect(storiesWorthKicker(months(3), "en")).toBe("Worth knowing at three");
    expect(storiesWorthKicker(months(3), "he")).toBe("כדאי לדעת בגיל שלוש");
    expect(storiesWorthKicker(months(8), "en")).toBe("Worth knowing");
    expect(storiesWorthKicker(null, "he")).toBe("כדאי לדעת");
  });
});

describe("Stories wires the shared card", () => {
  const src = readFileSync(resolve(__dirname, "../tabs/HeroJourneyTab.tsx"), "utf8");
  it("renders NowWorthKnowing with the picked cardId inside the family section, only when there is one", () => {
    const family = src.slice(src.indexOf('<RouteSection id="family"'), src.indexOf('<RouteSection id="pictures"'));
    expect(family).toContain("{worthCard && (");
    expect(family).toContain("<NowWorthKnowing");
    expect(family).toContain("cardId={worthCard}");
    expect(src).toContain("storiesWorthCardId(childAgeMonths)");
  });
});
