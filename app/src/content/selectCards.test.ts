import { describe, expect, it } from "vitest";
import { computeContentHash } from "./governance";
import { hardMomentCards, type HardMomentCard } from "./hardMomentCards";
import { byCategory, byConcern, concernsForBehaviors, inAgeBand, matchToRecentBehaviors } from "./selectCards";

const NOW = new Date("2026-07-22");

/** A correctly stamped approval (named reviewer + content hash) — the only shape that publishes. */
const approve = (card: HardMomentCard): HardMomentCard => ({
  ...card,
  reviewStatus: "approved",
  reviewedBy: "Dr. Noa Levi",
  reviewedAt: "2026-07-01",
  contentHash: computeContentHash(card),
});

const find = (id: string): HardMomentCard => hardMomentCards.find((item) => item.id === id)!;

describe("selectCards — fail-closed selector (CONT-6)", () => {
  it("returns nothing from the real all-draft pack", () => {
    expect(byCategory("big-feelings", hardMomentCards, NOW, 36)).toHaveLength(0);
    expect(byConcern("aggression", hardMomentCards, NOW, 36)).toHaveLength(0);
    expect(matchToRecentBehaviors(["Sibling Conflict", "Food Refusal"], hardMomentCards, NOW, 36)).toHaveLength(0);
  });

  it("byCategory returns approved fixtures only", () => {
    const fixtures = [approve(find("tantrum")), approve(find("hitting")), find("public-meltdown")];
    const result = byCategory("big-feelings", fixtures, NOW, 36);
    expect(result.map((c) => c.id)).toEqual(["tantrum", "hitting"]);
  });

  it("byConcern returns approved fixtures only", () => {
    const fixtures = [approve(find("hitting")), find("teasing")];
    expect(byConcern("aggression", fixtures, NOW, 36).map((c) => c.id)).toEqual(["hitting"]);
  });

  it("never returns a draft record, even when it matches best", () => {
    const fixtures = [find("sibling-conflict"), approve(find("waiting"))];
    const matched = matchToRecentBehaviors(["Sibling Conflict"], fixtures, NOW, 36);
    expect(matched.some((c) => c.reviewStatus !== "approved")).toBe(false);
    expect(matched.map((c) => c.id)).not.toContain("sibling-conflict");
  });

  it("never returns a retired record", () => {
    const retired = { ...approve(find("hitting")), reviewStatus: "retired" as const };
    const fixtures = [retired, approve(find("teasing"))];
    expect(byConcern("aggression", fixtures, NOW, 36).map((c) => c.id)).toEqual(["teasing"]);
    expect(byCategory("big-feelings", fixtures, NOW, 36)).toHaveLength(0);
    expect(matchToRecentBehaviors(["Hitting"], fixtures, NOW, 36).map((c) => c.id)).toEqual(["teasing"]);
  });

  it("never returns a stamped record whose copy was edited after approval", () => {
    const approved = approve(find("hitting"));
    const edited = { ...approved, sayThis: { ...approved.sayThis, en: "Edited after the stamp." } };
    expect(byConcern("aggression", [edited], NOW, 36)).toHaveLength(0);
  });

  it("maps free-text behavior-log categories to the controlled concern vocabulary", () => {
    expect(concernsForBehaviors(["Transition Refusal"])).toContain("transitions");
    expect(concernsForBehaviors(["Screentime Dispute"])).toContain("screens");
    expect(concernsForBehaviors(["Sibling Conflict"])).toContain("peer-conflict");
    expect(concernsForBehaviors(["Food Refusal"])).toContain("food");
    expect(concernsForBehaviors(["Sleep Meltdown"])).toEqual(expect.arrayContaining(["sleep", "regulation"]));
    expect(concernsForBehaviors(["Sensory Overload"])).toContain("regulation");
    expect(concernsForBehaviors(["Something Unrelated"])).toHaveLength(0);
  });

  it("matchToRecentBehaviors ranks stronger concern overlap first", () => {
    const fixtures = [approve(find("getting-dressed")), approve(find("school-dropoff")), approve(find("clinging"))];
    const matched = matchToRecentBehaviors(["School Dropoff Distress", "Transition Refusal"], fixtures, NOW, 36);
    // school-dropoff matches separation + transitions (+ moment), clinging matches separation only.
    expect(matched[0]?.id).toBe("school-dropoff");
    expect(matched.map((c) => c.id)).toContain("clinging");
    expect(matched.map((c) => c.id)).not.toContain("getting-dressed");
  });

  it("returns nothing for unmatched or empty behavior lists", () => {
    const fixtures = hardMomentCards.map(approve);
    expect(matchToRecentBehaviors([], fixtures, NOW, 36)).toHaveLength(0);
    expect(matchToRecentBehaviors(["Quantum Entanglement"], fixtures, NOW, 36)).toHaveLength(0);
  });
});

// W0 age fix — the governed ageBands metadata now filters selection when the
// caller passes the child's age (months). Missing age closes personalized selection.
describe("selectCards — ageBands filter", () => {
  it("inAgeBand parses year ranges/open bands in months, fail-closed on missing or malformed metadata", () => {
    const losingGame = find("losing-game"); // ageBands ["6-9", "10-12"]
    expect(inAgeBand(losingGame, 36)).toBe(false);         // 3y — out of band
    expect(inAgeBand(losingGame, 6 * 12)).toBe(true);      // 6y — lower edge in
    expect(inAgeBand(losingGame, 9 * 12 + 11)).toBe(true); // 9y11m — "6-9" spans through age 9
    expect(inAgeBand(losingGame, 13 * 12)).toBe(false);    // 13y — past "10-12"
    // Missing age or malformed metadata cannot establish applicability.
    expect(inAgeBand(losingGame, null)).toBe(false);
    expect(inAgeBand(losingGame, undefined)).toBe(false);
    expect(inAgeBand({ ...losingGame, ageBands: [] }, 36)).toBe(false);
    expect(inAgeBand({ ...losingGame, ageBands: ["weird"] }, 36)).toBe(false);
    expect(inAgeBand({ ...losingGame, ageBands: ["6+"] }, 36)).toBe(false);
    expect(inAgeBand({ ...losingGame, ageBands: ["6+"] }, 7 * 12)).toBe(true);
  });

  it("filters out-of-band cards from every selector when an age is given", () => {
    // losing-game = 6-9/10-12; sibling-conflict = default 2-5. Both carry peer-conflict.
    const fixtures = [approve(find("losing-game")), approve(find("sibling-conflict"))];
    const toddler = 3 * 12;
    expect(matchToRecentBehaviors(["Sibling Conflict"], fixtures, NOW, toddler).map((c) => c.id))
      .toEqual(["sibling-conflict"]);
    expect(byConcern("peer-conflict", fixtures, NOW, toddler).map((c) => c.id)).toEqual(["sibling-conflict"]);
    // Category filter: homework (6-9/10-12) vs leaving-play (2-5), both "transitions".
    const transitions = [approve(find("homework")), approve(find("leaving-play"))];
    expect(byCategory("transitions", transitions, NOW, toddler).map((c) => c.id)).toEqual(["leaving-play"]);
    // The bands cut both ways: a 7-year-old gets the 6-9 card, not the 2-5 one.
    expect(byConcern("peer-conflict", fixtures, NOW, 7 * 12).map((c) => c.id)).toEqual(["losing-game"]);
    // And a 5-year-old sits inside "2-5" only.
    expect(byConcern("peer-conflict", fixtures, NOW, 5 * 12).map((c) => c.id)).toEqual(["sibling-conflict"]);
  });

  it("returns no personalized cards when no age is passed", () => {
    const fixtures = [approve(find("losing-game")), approve(find("sibling-conflict"))];
    expect(matchToRecentBehaviors(["Sibling Conflict"], fixtures, NOW).map((c) => c.id))
      .toEqual([]);
  });
});
