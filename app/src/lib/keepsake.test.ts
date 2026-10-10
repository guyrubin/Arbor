/**
 * keepsake.test.ts — ENG-14: compounding value made visible, and kept safe.
 *
 * The existing keepsakeCounts module remains covered here. B-ASKJB-37
 * replaces the old month count object; its dated page is covered separately
 * in keepsakeMonth.test.ts.
 *
 * The firewall cases are the point: a count must stay a count. Any denominator,
 * ratio, target or month-over-month delta appearing in these shapes is the
 * defect, not a feature, so the tests assert on the SHAPE and not just values.
 */
import { describe, it, expect } from "vitest";
import { arborKnows, countProfileFacts, type KnowsInput } from "./keepsakeCounts";
/* ── ENG-14(a) · Arbor knows {n} things ──────────────────────────────────── */

const zero: KnowsInput = { profileFacts: 0, moments: 0, milestones: 0, memories: 0 };

describe("what Arbor knows is a COUNT", () => {
  it("sums the four parts", () => {
    const knows = arborKnows({ profileFacts: 3, moments: 4, milestones: 2, memories: 1 });
    expect(knows.total).toBe(10);
  });

  it("is answerable on day zero, from the profile alone", () => {
    // The whole ENG-14 defect: the dev-map card needed devScore confidence and
    // the since-strip needed prior rows, so day 0 rendered nothing at all.
    const knows = arborKnows({ ...zero, profileFacts: 2 });
    expect(knows.total).toBe(2);
    expect(knows.parts).toEqual([{ id: "profile", count: 2 }]);
  });

  it("omits empty parts rather than showing a zero row to shame", () => {
    const knows = arborKnows({ profileFacts: 2, moments: 0, milestones: 0, memories: 1 });
    expect(knows.parts.map((p) => p.id)).toEqual(["profile", "memories"]);
  });

  it("an empty family is an honest zero, not an error", () => {
    expect(arborKnows(zero)).toEqual({ total: 0, parts: [] });
  });

  it("junk inputs degrade to zero, never to a wrong number", () => {
    expect(arborKnows({ ...zero, moments: Number.NaN }).total).toBe(0);
    expect(arborKnows({ ...zero, moments: -5 }).total).toBe(0);
  });

  it("counts only the profile facts a parent actually gave", () => {
    expect(countProfileFacts(null)).toBe(0);
    expect(countProfileFacts({ name: "  " })).toBe(0);
    expect(countProfileFacts({ name: "Maya", ageMonths: 42 })).toBe(2);
    expect(countProfileFacts({ name: "Maya", age: 3 })).toBe(2);
    expect(
      countProfileFacts({ name: "Maya", ageMonths: 42, interests: ["trains", "water"], challenges: ["sleep"] }),
    ).toBe(5);
    // The live ChildProfile shape (languages/strengths/challenges) counts too.
    expect(
      countProfileFacts({ name: "Maya", age: 3, languages: ["he"], strengths: ["curious"], challenges: ["sleep"] }),
    ).toBe(5);
  });

  it("CLINICAL FIREWALL: the shape has no denominator, target, ratio or delta", () => {
    const knows = arborKnows({ profileFacts: 2, moments: 1, milestones: 0, memories: 0 });
    expect(Object.keys(knows).sort()).toEqual(["parts", "total"]);
    for (const part of knows.parts) expect(Object.keys(part).sort()).toEqual(["count", "id"]);
    // Negative control: the fields a progress ring would need must be absent.
    for (const banned of ["max", "of", "target", "percent", "pct", "ratio", "delta", "trend", "score"]) {
      expect(knows).not.toHaveProperty(banned);
    }
  });
});
