/**
 * B-KID-39 (KB-12, VETO brand/claim) — no public figure is named in product
 * copy, and the contempt line is gone. the-friendly-monster's parent insight
 * attributed its idea to a named public figure and called the gentle-because-
 * weak "merely incapable". Scan: no parentInsight (EN or HE) names a person
 * from the denylist or attributes "an idea from <Name>", and no insight uses
 * the contempt words.
 */
import { describe, expect, it } from "vitest";
import { HERO_STORIES, getStorySpec } from "./heroJourneys";

/** Public figures the copy has drawn on (EN + HE spellings). */
const NAMES = /\b(Peterson|Jordan|Jung|Campbell|Freud|Piaget|Montessori|Nietzsche|Solzhenitsyn)\b|פיטרסון|יונג|קמפבל|פרויד|פיאז'ה|מונטסורי|ניטשה/;
const ATTRIBUTION = /\b(?:idea|insight|concept|thought) (?:from|of|by) [A-Z][a-z]+(?: [A-Z][a-z]+)?/;
const CONTEMPT = /merely incapable|not virtuous|חסר יכולת|אינו מוסרי/;

describe("B-KID-39: parent insights name no public figure and hold no contempt line", () => {
  it.each(HERO_STORIES.filter((s) => s.parentInsight).map((s) => s.id))("%s", (id) => {
    const insight = getStorySpec(id)!.parentInsight!;
    for (const text of [insight.en, insight.he]) {
      expect(text, id).not.toMatch(NAMES);
      expect(text, id).not.toMatch(ATTRIBUTION);
      expect(text, id).not.toMatch(CONTEMPT);
    }
  });
  it("the friendly-monster insight keeps its idea (strength under control, aimed at protecting)", () => {
    const { en, he } = getStorySpec("the-friendly-monster")!.parentInsight!;
    expect(en).toContain("keep that strength under control");
    expect(he).toContain("להחזיק את הכוח שלו בשליטה");
  });
  it("NEGATIVE CONTROL: the pre-fix opening fails the scan", () => {
    const preFix = "This story works with a core idea from Jordan Peterson: a person who is harmless because they are weak is not virtuous — they are merely incapable.";
    expect(preFix).toMatch(NAMES);
    expect(preFix).toMatch(ATTRIBUTION);
    expect(preFix).toMatch(CONTEMPT);
  });
});
