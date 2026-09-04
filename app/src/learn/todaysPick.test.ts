/**
 * LC-04 guard — "Today's pick" is a real, explainable, per-day ranking.
 *
 * The pre-change shape was `catalog.find((m) => !done[m.id])` — the first
 * unfinished item in FILE ORDER. Every assertion below fails against that
 * shape: it is not seeded, it does not move with the parent's signals, and it
 * does not respect the age window.
 */
import { describe, it, expect } from "vitest";
import { LEARN_CARDS } from "./learnCards";
import type { LearnCard, LearnRankSignals } from "./learnLibrary";
import { ageVisibleLearnCards, pickDayKey, pickSeed, todaysLearnPick } from "./todaysPick";

const CHILD = "child-abc";
const DAY = "2026-09-04";

const baseSignals = (over: Partial<LearnRankSignals> = {}): LearnRankSignals => ({
  ageYears: 4,
  focusDomain: null,
  ...over,
});

describe("LC-04 · deterministic per-day pick", () => {
  it("same child + same day + same signals → the same card, every call", () => {
    const s = baseSignals({ focusDomain: "language_communication" });
    const a = todaysLearnPick(LEARN_CARDS, s, { childId: CHILD, dayKey: DAY });
    const b = todaysLearnPick(LEARN_CARDS, s, { childId: CHILD, dayKey: DAY });
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a!.card.id).toBe(b!.card.id);
  });

  it("the seed moves with the day and with the child (so the pick can rotate)", () => {
    expect(pickSeed(CHILD, "2026-09-04")).not.toBe(pickSeed(CHILD, "2026-09-05"));
    expect(pickSeed(CHILD, DAY)).not.toBe(pickSeed("child-xyz", DAY));
  });

  it("rotates across days when the top score is tied", () => {
    // A synthetic all-tied shelf isolates the tiebreak from the scoring.
    const tied: LearnCard[] = ["a", "b", "c", "d", "e"].map((id) => ({
      id,
      category: "sleep",
      domains: [],
      ageMin: 0,
      ageMax: 18,
      minutes: 3,
      title: { en: id, he: id },
      hook: { en: id, he: id },
      keyPoints: [],
      body: { en: id, he: id },
      tryToday: { en: id, he: id },
      ask: { en: id, he: id },
      concerns: [],
    }));
    const s = baseSignals({ ageYears: null });
    const seen = new Set<string>();
    for (let d = 1; d <= 20; d += 1) {
      const day = `2026-09-${String(d).padStart(2, "0")}`;
      const pick = todaysLearnPick(tied, s, { childId: CHILD, dayKey: day });
      expect(pick).toBeTruthy();
      expect(pick!.tied).toBe(tied.length);
      seen.add(pick!.card.id);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("pickDayKey is the UTC calendar day", () => {
    expect(pickDayKey(new Date("2026-09-04T22:30:00Z"))).toBe("2026-09-04");
  });
});

describe("LC-04 · the pick follows the parent's signals, not file order", () => {
  it("a different focus domain yields a different card", () => {
    const one = todaysLearnPick(LEARN_CARDS, baseSignals({ focusDomain: "language_communication" }), { childId: CHILD, dayKey: DAY });
    const two = todaysLearnPick(LEARN_CARDS, baseSignals({ focusDomain: "sensory_motor_patterns" }), { childId: CHILD, dayKey: DAY });
    expect(one).toBeTruthy();
    expect(two).toBeTruthy();
    expect(one!.card.id).not.toBe(two!.card.id);
  });

  it("different recent concerns yield a different card", () => {
    const sleepy = todaysLearnPick(LEARN_CARDS, baseSignals({ recentConcerns: ["sleep"] }), { childId: CHILD, dayKey: DAY });
    const screens = todaysLearnPick(LEARN_CARDS, baseSignals({ recentConcerns: ["screens"] }), { childId: CHILD, dayKey: DAY });
    expect(sleepy).toBeTruthy();
    expect(screens).toBeTruthy();
    expect(sleepy!.card.id).not.toBe(screens!.card.id);
    expect(sleepy!.fromConcerns).toBe(true);
  });

  it("NEGATIVE CONTROL: the pick is not simply the first card in file order", () => {
    // The pre-change implementation always returned catalogue[0]. With a real
    // signal set the ranked winner must be somewhere else in the file.
    const pick = todaysLearnPick(LEARN_CARDS, baseSignals({ recentConcerns: ["sleep"], focusDomain: "independence_adaptive_skills" }), {
      childId: CHILD,
      dayKey: DAY,
    });
    expect(pick).toBeTruthy();
    expect(pick!.card.id).not.toBe(LEARN_CARDS[0].id);
  });

  it("a card the parent marked 'not helpful' is never today's pick", () => {
    const s = baseSignals({ focusDomain: "language_communication" });
    const first = todaysLearnPick(LEARN_CARDS, s, { childId: CHILD, dayKey: DAY })!;
    const demoted = todaysLearnPick(LEARN_CARDS, { ...s, helpfulness: { [first.card.id]: -1 } }, { childId: CHILD, dayKey: DAY })!;
    expect(demoted.card.id).not.toBe(first.card.id);
  });
});

describe("LC-04 · the pick is always a card the parent can see", () => {
  it("never picks a card outside the child's age window", () => {
    for (const age of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const pick = todaysLearnPick(LEARN_CARDS, baseSignals({ ageYears: age }), { childId: CHILD, dayKey: DAY });
      expect(pick).toBeTruthy();
      expect(pick!.card.ageMin).toBeLessThanOrEqual(age);
      expect(pick!.card.ageMax).toBeGreaterThanOrEqual(age);
    }
  });

  it("ageVisibleLearnCards degrades to the full catalogue rather than to nothing", () => {
    expect(ageVisibleLearnCards(LEARN_CARDS, 99).length).toBe(LEARN_CARDS.length);
    expect(ageVisibleLearnCards(LEARN_CARDS, null).length).toBe(LEARN_CARDS.length);
  });

  it("returns null only for an empty catalogue", () => {
    expect(todaysLearnPick([], baseSignals(), { childId: CHILD, dayKey: DAY })).toBeNull();
  });
});
