import { describe, expect, it } from "vitest";
import { computeContentHash } from "./governance";
import { hardMomentCards, type HardMomentCard } from "./hardMomentCards";
import { byCategory, byConcern, concernsForBehaviors, matchToRecentBehaviors } from "./selectCards";

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
    expect(byCategory("big-feelings", hardMomentCards, NOW)).toHaveLength(0);
    expect(byConcern("aggression", hardMomentCards, NOW)).toHaveLength(0);
    expect(matchToRecentBehaviors(["Sibling Conflict", "Food Refusal"], hardMomentCards, NOW)).toHaveLength(0);
  });

  it("byCategory returns approved fixtures only", () => {
    const fixtures = [approve(find("tantrum")), approve(find("hitting")), find("public-meltdown")];
    const result = byCategory("big-feelings", fixtures, NOW);
    expect(result.map((c) => c.id)).toEqual(["tantrum", "hitting"]);
  });

  it("byConcern returns approved fixtures only", () => {
    const fixtures = [approve(find("hitting")), find("teasing")];
    expect(byConcern("aggression", fixtures, NOW).map((c) => c.id)).toEqual(["hitting"]);
  });

  it("never returns a draft record, even when it matches best", () => {
    const fixtures = [find("sibling-conflict"), approve(find("waiting"))];
    const matched = matchToRecentBehaviors(["Sibling Conflict"], fixtures, NOW);
    expect(matched.some((c) => c.reviewStatus !== "approved")).toBe(false);
    expect(matched.map((c) => c.id)).not.toContain("sibling-conflict");
  });

  it("never returns a retired record", () => {
    const retired = { ...approve(find("hitting")), reviewStatus: "retired" as const };
    const fixtures = [retired, approve(find("teasing"))];
    expect(byConcern("aggression", fixtures, NOW).map((c) => c.id)).toEqual(["teasing"]);
    expect(byCategory("big-feelings", fixtures, NOW)).toHaveLength(0);
    expect(matchToRecentBehaviors(["Hitting"], fixtures, NOW).map((c) => c.id)).toEqual(["teasing"]);
  });

  it("never returns a stamped record whose copy was edited after approval", () => {
    const approved = approve(find("hitting"));
    const edited = { ...approved, sayThis: { ...approved.sayThis, en: "Edited after the stamp." } };
    expect(byConcern("aggression", [edited], NOW)).toHaveLength(0);
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
    const matched = matchToRecentBehaviors(["School Dropoff Distress", "Transition Refusal"], fixtures, NOW);
    // school-dropoff matches separation + transitions (+ moment), clinging matches separation only.
    expect(matched[0]?.id).toBe("school-dropoff");
    expect(matched.map((c) => c.id)).toContain("clinging");
    expect(matched.map((c) => c.id)).not.toContain("getting-dressed");
  });

  it("returns nothing for unmatched or empty behavior lists", () => {
    const fixtures = hardMomentCards.map(approve);
    expect(matchToRecentBehaviors([], fixtures, NOW)).toHaveLength(0);
    expect(matchToRecentBehaviors(["Quantum Entanglement"], fixtures, NOW)).toHaveLength(0);
  });
});
