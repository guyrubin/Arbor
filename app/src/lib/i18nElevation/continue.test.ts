import { describe, it, expect } from "vitest";
import { en, he, continueText, withContinuation } from "./continue";

/**
 * W2 masterplan 2.5 — continuation strings (Maytal frame 5 "ממשיך מכאן").
 *
 * HARD RULE (verification panel): continuation framing is ALWAYS an echo of
 * the parent's own report — "you said it helped" — never an AI efficacy
 * claim, never a grade. These pins keep the attribution words mandatory and
 * ban outcome/grade language from the module.
 */
describe("i18nElevation/continue — EN/HE parity", () => {
  it("every key exists in both languages, non-empty, elev.continue.* namespaced", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
    for (const [key, value] of [...Object.entries(en), ...Object.entries(he)]) {
      expect(key.startsWith("elev.continue."), key).toBe(true);
      expect(value.trim().length, key).toBeGreaterThan(0);
    }
  });
});

describe("'you said' attribution is mandatory (test-pinned)", () => {
  it("the Daily Play continuation line opens with the parent's own report", () => {
    expect(en["elev.continue.play.helped"]).toContain("You said");
    expect(he["elev.continue.play.helped"]).toContain("אמרת");
  });

  it("no string makes an AI efficacy claim or grades anything", () => {
    for (const value of [...Object.values(en), ...Object.values(he)]) {
      // No percentages, scores, or effect verbs on the child.
      expect(value).not.toMatch(/%|\bscore\b|\bimproved\b|\bworked\b|\bproven\b|\beffective\b/i);
      expect(value).not.toMatch(/השתפר|ציון|הוכח|יעיל/);
    }
  });

  it("the Learn variant claims only the bookmark signal", () => {
    expect(en["elev.continue.learn.why"].toLowerCase()).toContain("saved");
    expect(he["elev.continue.learn.why"]).toContain("שמרתם");
  });
});

describe("continueText / withContinuation accessors", () => {
  it("resolves keys per language with the app-wide missing-key convention", () => {
    expect(continueText("elev.continue.play.helped", false)).toBe(en["elev.continue.play.helped"]);
    expect(continueText("elev.continue.play.helped", true)).toBe(he["elev.continue.play.helped"]);
    expect(continueText("elev.continue.nope", false)).toBe("elev.continue.nope");
  });

  it("withContinuation routes elev.continue.* to the module and everything else to t()", () => {
    const t = (key: string) => `T:${key}`;
    const wrapped = withContinuation(t, false);
    expect(wrapped("elev.continue.play.helped")).toBe(en["elev.continue.play.helped"]);
    expect(wrapped("play.min")).toBe("T:play.min");
  });
});
