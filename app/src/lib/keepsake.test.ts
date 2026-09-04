/**
 * keepsake.test.ts — ENG-14: compounding value made visible, and kept safe.
 *
 * Two pure modules under test: keepsakeCounts ("Arbor knows {n} things") and
 * keepsakeMonth (the month keepsake). Both fail without the change — neither
 * existed, and no code in the app produced a day-0 count of what Arbor holds
 * or a month-in-review of any kind (grep for month-in-review returned only
 * billing).
 *
 * The firewall cases are the point: a count must stay a count. Any denominator,
 * ratio, target or month-over-month delta appearing in these shapes is the
 * defect, not a feature, so the tests assert on the SHAPE and not just values.
 */
import { describe, it, expect } from "vitest";
import { arborKnows, countProfileFacts, type KnowsInput } from "./keepsakeCounts";
import {
  MONTH_CARD_IDS,
  buildMonthKeepsake,
  monthKeyOf,
  monthKeepsakeStorageKey,
  shouldOfferMonthKeepsake,
} from "./keepsakeMonth";

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

/* ── ENG-14(b) · The month keepsake ──────────────────────────────────────── */

describe("the month keepsake", () => {
  it("builds a card per non-empty count, in order", () => {
    const keepsake = buildMonthKeepsake({ monthKey: "2026-08", moments: 12, milestones: 2, stories: 1 });
    expect(keepsake).not.toBeNull();
    expect(keepsake!.cards.map((c) => c.id)).toEqual(["moments", "milestones", "stories"]);
    expect(keepsake!.month).toBe(8);
    expect(keepsake!.year).toBe(2026);
  });

  it("adds the parent's own words VERBATIM as a fourth card", () => {
    const quote = "  She asked to read it again, twice.  ";
    const keepsake = buildMonthKeepsake({ monthKey: "2026-08", moments: 3, milestones: 0, stories: 0, parentQuote: quote });
    expect(keepsake!.cards.map((c) => c.id)).toEqual(["moments", "quote"]);
    expect(keepsake!.cards[1].quote).toBe("She asked to read it again, twice.");
  });

  it("a month that held nothing gets NO card, not three zeros", () => {
    expect(buildMonthKeepsake({ monthKey: "2026-08", moments: 0, milestones: 0, stories: 0 })).toBeNull();
  });

  it("rejects a malformed month key instead of inventing a month", () => {
    expect(buildMonthKeepsake({ monthKey: "", moments: 3, milestones: 0, stories: 0 })).toBeNull();
    expect(buildMonthKeepsake({ monthKey: "2026-13", moments: 3, milestones: 0, stories: 0 })).toBeNull();
  });

  it("CLINICAL FIREWALL: a card is a count or a quote — it cannot carry a delta", () => {
    const keepsake = buildMonthKeepsake({ monthKey: "2026-08", moments: 12, milestones: 2, stories: 1 })!;
    for (const card of keepsake.cards) {
      const keys = Object.keys(card).sort();
      expect(keys).toEqual(keys.includes("quote") ? ["id", "quote"] : ["count", "id"]);
    }
    // Negative control: the builder sees ONE month and so CANNOT compare two.
    expect(buildMonthKeepsake.length).toBe(1);
    expect([...MONTH_CARD_IDS]).toEqual(["moments", "milestones", "stories", "quote"]);
  });
});

describe("offering the month keepsake — once, and never for a half month", () => {
  const keepsake = buildMonthKeepsake({ monthKey: "2026-08", moments: 5, milestones: 1, stories: 0 });

  it("offers on the first open of the following month", () => {
    expect(
      shouldOfferMonthKeepsake({ lastOfferedMonthKey: null, keepsake, currentMonthKey: "2026-09" }),
    ).toBe(true);
  });

  it("never offers the month the family is still living in", () => {
    expect(
      shouldOfferMonthKeepsake({ lastOfferedMonthKey: null, keepsake, currentMonthKey: "2026-08" }),
    ).toBe(false);
  });

  it("never nags: once offered, never again", () => {
    expect(
      shouldOfferMonthKeepsake({ lastOfferedMonthKey: "2026-08", keepsake, currentMonthKey: "2026-09" }),
    ).toBe(false);
  });

  it("offers nothing when the month held nothing", () => {
    expect(
      shouldOfferMonthKeepsake({ lastOfferedMonthKey: null, keepsake: null, currentMonthKey: "2026-09" }),
    ).toBe(false);
  });

  it("month keys are stable and per-child storage is namespaced", () => {
    expect(monthKeyOf("2026-08-31T22:00:00Z")).toBe("2026-08");
    expect(monthKeyOf("nope")).toBeNull();
    expect(monthKeepsakeStorageKey("child-7")).toBe("arbor.keepsake.month.child-7");
  });
});
