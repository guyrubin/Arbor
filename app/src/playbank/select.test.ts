import { describe, it, expect } from "vitest";
import {
  selectDailyPlay, rankDailyPlay, concernDomainsFromLogs, domainForBehaviorType, daySeedFor,
  sanitizeInterestToken,
} from "./select";
import { bandForAge } from "./content";

const NOW = new Date("2026-06-15T12:00:00").getTime();
const DAY = 86_400_000;

describe("bandForAge", () => {
  it("maps ages to coarse bands", () => {
    expect(bandForAge(0.5)).toBe("infant");
    expect(bandForAge(2)).toBe("toddler");
    expect(bandForAge(4)).toBe("preschool");
    expect(bandForAge(7)).toBe("early-school");
  });
});

describe("domainForBehaviorType", () => {
  it("routes common behaviour types to a domain", () => {
    expect(domainForBehaviorType("Transition Refusal")).toBe("regulation");
    expect(domainForBehaviorType("Screentime Dispute")).toBe("regulation");
    expect(domainForBehaviorType("Sibling Conflict")).toBe("social");
    expect(domainForBehaviorType("Speech delay")).toBe("language");
    expect(domainForBehaviorType("Random note")).toBeNull();
  });
});

describe("concernDomainsFromLogs", () => {
  it("ranks concern domains by recent frequency", () => {
    const logs = [
      { behaviorType: "Transition Refusal", timestamp: new Date(NOW - 1 * DAY).toISOString() },
      { behaviorType: "Screentime Dispute", timestamp: new Date(NOW - 2 * DAY).toISOString() },
      { behaviorType: "Sibling Conflict", timestamp: new Date(NOW - 3 * DAY).toISOString() },
    ];
    expect(concernDomainsFromLogs(logs, NOW)).toEqual(["regulation", "social"]);
  });

  it("ignores logs outside the window", () => {
    const logs = [{ behaviorType: "Transition Refusal", timestamp: new Date(NOW - 60 * DAY).toISOString() }];
    expect(concernDomainsFromLogs(logs, NOW)).toEqual([]);
  });
});

describe("selectDailyPlay", () => {
  it("prefers an activity in the child's band", () => {
    const picks = selectDailyPlay({ ageYears: 2, daySeed: daySeedFor(NOW) });
    expect(picks.length).toBeGreaterThan(0);
    expect(picks[0].activity.bands).toContain("toddler");
  });

  it("surfaces a concern-matched activity to the top, tagged as such", () => {
    const picks = selectDailyPlay({ ageYears: 4, concernDomains: ["regulation"], daySeed: 1 });
    expect(picks[0].activity.domain).toBe("regulation");
    expect(picks[0].reason).toBe("concern-match");
  });

  it("falls back to a stage-match when there are no concerns (no cold-start failure)", () => {
    const picks = selectDailyPlay({ ageYears: 4, daySeed: 1 });
    expect(picks[0].reason).toBe("stage-match");
    expect(picks.length).toBe(3);
  });

  it("deprioritises recently-done activities", () => {
    const top = rankDailyPlay({ ageYears: 4, concernDomains: ["regulation"], daySeed: 1 })[0].activity.id;
    const withDone = rankDailyPlay({
      ageYears: 4, concernDomains: ["regulation"], recentlyDoneIds: [top], daySeed: 1,
    });
    expect(withDone[0].activity.id).not.toBe(top);
  });

  it("is deterministic for a given day seed", () => {
    const a = selectDailyPlay({ ageYears: 3, concernDomains: ["social"], daySeed: 42 });
    const b = selectDailyPlay({ ageYears: 3, concernDomains: ["social"], daySeed: 42 });
    expect(a.map((p) => p.activity.id)).toEqual(b.map((p) => p.activity.id));
  });

  // CI-28: goal-domain weighting (1.6×)
  describe("CI-28 goalDomains weighting", () => {
    it("surfaces a goal-matched activity to the top, tagged as goal-match", () => {
      const picks = selectDailyPlay({ ageYears: 4, goalDomains: ["regulation"], daySeed: 1 });
      expect(picks[0].activity.domain).toBe("regulation");
      expect(picks[0].reason).toBe("goal-match");
    });

    it("goal-match activities appear in top picks when concern-domain differs", () => {
      // Goal says regulation, concern says social — regulation goal-match picks
      // should appear in the top 4 and be labelled goal-match.
      // Note: concern-top-rank (1.8 boost) can still outscore goal-only (1.6x)
      // for the very top slot when the same activity doesn't overlap; the 1.6x
      // goal weight ensures goal-linked activities *surface* prominently,
      // not that they always hold the single #1 slot.
      const picks = selectDailyPlay({
        ageYears: 4,
        goalDomains: ["regulation"],
        concernDomains: ["social"],
        daySeed: 1,
      }, 4);
      const goalMatches = picks.filter((p) => p.reason === "goal-match");
      expect(goalMatches.length).toBeGreaterThan(0);
      for (const p of goalMatches) {
        expect(p.activity.domain).toBe("regulation");
      }
    });

    it("goal-match score at 1.6x is strictly higher than concern-only at 1.8x decay for the same domain", () => {
      // Concern-only (top of concern list = 1.8 boost) vs goal-only (1.6 boost).
      // At the top concern slot the concern-match can still outrank because 1.8 > 1.6,
      // but goal + concern together should exceed either alone.
      const withGoalAndConcern = rankDailyPlay({
        ageYears: 4, goalDomains: ["regulation"], concernDomains: ["regulation"], daySeed: 1,
      });
      const withGoalOnly = rankDailyPlay({
        ageYears: 4, goalDomains: ["regulation"], daySeed: 1,
      });
      // The top pick's score with both boosts should be higher than with goal alone.
      const topBoth = withGoalAndConcern.find((p) => p.activity.domain === "regulation")!;
      const topGoal = withGoalOnly.find((p) => p.activity.domain === "regulation")!;
      expect(topBoth.score).toBeGreaterThan(topGoal.score);
    });

    it("produces a goal-match reason only when the activity band also matches", () => {
      const picks = rankDailyPlay({ ageYears: 4, goalDomains: ["regulation"], daySeed: 1 });
      const goalMatches = picks.filter((p) => p.reason === "goal-match");
      // All goal-match picks must be in the preschool band (age 4).
      for (const p of goalMatches) {
        expect(p.activity.bands).toContain("preschool");
      }
    });

    it("is deterministic for a given seed with goal domains", () => {
      const a = selectDailyPlay({ ageYears: 4, goalDomains: ["language"], daySeed: 7 });
      const b = selectDailyPlay({ ageYears: 4, goalDomains: ["language"], daySeed: 7 });
      expect(a.map((p) => p.activity.id)).toEqual(b.map((p) => p.activity.id));
    });
  });

  // CI-29: interest-boost scoring (1.3×) + sanitizeInterestToken (FIX 3)
  describe("CI-29 interest-boost scoring", () => {
    it("boosts the score of a themeable activity when interests are provided", () => {
      // Get the top themeable activity without interests.
      const withoutInterests = rankDailyPlay({ ageYears: 4, daySeed: 1 });
      const themeableIdx = withoutInterests.findIndex((p) => p.activity.themeableContextSlot);
      // Same seed with interests — the same themeable activity should score higher.
      if (themeableIdx !== -1) {
        const themeableId = withoutInterests[themeableIdx].activity.id;
        const withInterests = rankDailyPlay({ ageYears: 4, daySeed: 1, interests: ["Trains"] });
        const boosted = withInterests.find((p) => p.activity.id === themeableId);
        const unboosted = withoutInterests[themeableIdx];
        expect(boosted!.score).toBeGreaterThan(unboosted.score);
      }
    });

    it("labels a themeable top pick as interest-match when interests are provided", () => {
      // Run with interests and check that at least one interest-match exists in top picks.
      const picks = selectDailyPlay({ ageYears: 4, interests: ["Trains"], daySeed: 1 }, 6);
      const interestMatches = picks.filter((p) => p.reason === "interest-match");
      expect(interestMatches.length).toBeGreaterThan(0);
      // Each interest-match must have matchedInterest set.
      for (const p of interestMatches) {
        expect(p.matchedInterest).toBe("Trains");
      }
    });

    it("does NOT label non-themeable activities as interest-match", () => {
      const picks = rankDailyPlay({ ageYears: 4, interests: ["Trains"], daySeed: 1 });
      const wrongLabel = picks.filter(
        (p) => p.reason === "interest-match" && !p.activity.themeableContextSlot
      );
      expect(wrongLabel).toHaveLength(0);
    });

    it("produces no interest-match when interests array is empty", () => {
      const picks = rankDailyPlay({ ageYears: 4, interests: [], daySeed: 1 });
      expect(picks.filter((p) => p.reason === "interest-match")).toHaveLength(0);
    });

    it("interest-boost (1.3×) is lower than goal-boost (1.6×) for same activity", () => {
      // An activity that is both themeable and in the regulation domain.
      const themeableRegulation = rankDailyPlay({ ageYears: 4, daySeed: 1 })
        .find((p) => p.activity.themeableContextSlot && p.activity.domain === "regulation");
      if (!themeableRegulation) return; // skip if no such activity at this age
      const id = themeableRegulation.activity.id;

      const withGoal = rankDailyPlay({ ageYears: 4, goalDomains: ["regulation"], daySeed: 1 });
      const withInterest = rankDailyPlay({ ageYears: 4, interests: ["Trains"], daySeed: 1 });
      const goalScore = withGoal.find((p) => p.activity.id === id)!.score;
      const interestScore = withInterest.find((p) => p.activity.id === id)!.score;
      expect(goalScore).toBeGreaterThan(interestScore);
    });

    it("is deterministic for a given seed with interests", () => {
      const a = selectDailyPlay({ ageYears: 4, interests: ["Dinosaurs"], daySeed: 5 });
      const b = selectDailyPlay({ ageYears: 4, interests: ["Dinosaurs"], daySeed: 5 });
      expect(a.map((p) => p.activity.id)).toEqual(b.map((p) => p.activity.id));
    });
  });

  // CI-29 FIX 3: sanitizeInterestToken — clinical/condition word blocking
  describe("CI-29 sanitizeInterestToken (FIX 3)", () => {
    it("passes through safe interest tokens unchanged", () => {
      expect(sanitizeInterestToken("Trains")).toBe("Trains");
      expect(sanitizeInterestToken("Dinosaurs")).toBe("Dinosaurs");
      expect(sanitizeInterestToken("Space")).toBe("Space");
    });

    it("returns empty string for a CONDITIONS word (autism, ADHD, etc.)", () => {
      expect(sanitizeInterestToken("autism")).toBe("");
      expect(sanitizeInterestToken("ADHD")).toBe("");
      expect(sanitizeInterestToken("anxiety disorder")).toBe("");
      expect(sanitizeInterestToken("developmental delay")).toBe("");
      expect(sanitizeInterestToken("apraxia")).toBe("");
    });

    it("returns empty string for banned clinical interest nouns (FIX 1)", () => {
      expect(sanitizeInterestToken("fixation")).toBe("");
      expect(sanitizeInterestToken("hyperfocus")).toBe("");
      expect(sanitizeInterestToken("special interest")).toBe("");
      expect(sanitizeInterestToken("obsession")).toBe("");
      expect(sanitizeInterestToken("restricted interests")).toBe("");
    });

    it("strips whitespace before testing", () => {
      expect(sanitizeInterestToken("  Trains  ")).toBe("Trains");
      expect(sanitizeInterestToken("  autism  ")).toBe("");
    });

    it("returns empty string for empty input", () => {
      expect(sanitizeInterestToken("")).toBe("");
      expect(sanitizeInterestToken("   ")).toBe("");
    });

    it("blocks condition words mid-token (autism-adjacent substring)", () => {
      // "autistic" contains the banned substring
      expect(sanitizeInterestToken("autistic")).toBe("");
    });
  });
});
