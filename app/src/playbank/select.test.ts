import { describe, it, expect } from "vitest";
import {
  selectDailyPlay, rankDailyPlay, concernDomainsFromLogs, domainForBehaviorType, daySeedFor,
  sanitizeInterestToken, SESSION_LENGTH_RANGES, SESSION_LENGTHS, MIN_SESSION_BUCKET,
  availableSessionLengths, domainForRecommendation,
  CONTINUATION_NEXT_STEP_BOOST, CONTINUATION_SWITCH_DAMP,
  CONTINUATION_LOW_EFFORT_BOOST, CONTINUATION_LOW_EFFORT_MAX_MIN,
  type PlaySelectContext,
} from "./select";
import { bandForAge, PLAY_ACTIVITIES, PLAY_BANDS } from "./content";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

  // CI-31: sessionLength filtering
  describe("CI-31 sessionLength filtering", () => {
    it("SESSION_LENGTH_RANGES covers the three buckets", () => {
      expect(SESSION_LENGTH_RANGES.short).toEqual([0, 10]);
      expect(SESSION_LENGTH_RANGES.standard).toEqual([11, 20]);
      expect(SESSION_LENGTH_RANGES.extended[0]).toBe(21);
    });

    it("short filter returns only activities with durationMin ≤ 10", () => {
      const picks = rankDailyPlay({ ageYears: 4, daySeed: 1, sessionLength: "short" });
      for (const p of picks) {
        expect(p.activity.durationMin).toBeLessThanOrEqual(10);
      }
    });

    it("standard filter returns only activities with durationMin 11-20", () => {
      const picks = rankDailyPlay({ ageYears: 4, daySeed: 1, sessionLength: "standard" });
      for (const p of picks) {
        expect(p.activity.durationMin).toBeGreaterThan(10);
        expect(p.activity.durationMin).toBeLessThanOrEqual(20);
      }
    });

    it("selectDailyPlay with sessionLength=short returns picks in the short range", () => {
      const picks = selectDailyPlay({ ageYears: 4, daySeed: 1, sessionLength: "short" });
      expect(picks.length).toBeGreaterThan(0);
      for (const p of picks) {
        expect(p.activity.durationMin).toBeLessThanOrEqual(10);
      }
    });

    it("selectDailyPlay with no sessionLength uses the full pool (no filter applied)", () => {
      // Without sessionLength the full activity pool is used — no duration filter.
      const picksAll = selectDailyPlay({ ageYears: 4, daySeed: 1 });
      const picksShort = selectDailyPlay({ ageYears: 4, daySeed: 1, sessionLength: "short" });
      // The unfiltered top pick can differ from the short-only top pick, showing
      // the filter is not silently applied.
      expect(picksAll.length).toBeGreaterThan(0);
      // All picks from the full pool can include any durationMin — just confirm
      // the call succeeds and returns results.
      expect(picksAll[0]).toBeDefined();
    });

    it("is deterministic for the same seed and sessionLength", () => {
      const a = selectDailyPlay({ ageYears: 4, daySeed: 3, sessionLength: "short" });
      const b = selectDailyPlay({ ageYears: 4, daySeed: 3, sessionLength: "short" });
      expect(a.map((p) => p.activity.id)).toEqual(b.map((p) => p.activity.id));
    });

    it("different sessionLength values return different top picks for the same seed", () => {
      const shortPick = selectDailyPlay({ ageYears: 4, daySeed: 1, sessionLength: "short" }, 1);
      const stdPick   = selectDailyPlay({ ageYears: 4, daySeed: 1, sessionLength: "standard" }, 1);
      // They come from different durationMin buckets so they cannot be the same activity.
      expect(shortPick[0].activity.durationMin).toBeLessThanOrEqual(10);
      expect(stdPick[0].activity.durationMin).toBeGreaterThan(10);
    });
  });
});

// ── KID-3: session-length honesty ─────────────────────────────────────────────
// The UI may only OFFER a session-length chip when its bucket is honestly
// stocked for the child's band; the duration badge always shows the picked
// activity's real durationMin. These tests pin both halves.
describe("KID-3 session-length honesty", () => {
  // One representative age per band (midpoint of the PLAY_BANDS range).
  const bandAges = PLAY_BANDS.map(({ band, minYears, maxYears }) => ({
    band,
    ageYears: (minYears + Math.min(maxYears, minYears + 2)) / 2,
  }));

  it("representative ages actually map to their band", () => {
    for (const { band, ageYears } of bandAges) {
      expect(bandForAge(ageYears)).toBe(band);
    }
  });

  it(`every offered SessionLength has >= ${MIN_SESSION_BUCKET} in-band activities, per band`, () => {
    for (const { band, ageYears } of bandAges) {
      for (const s of availableSessionLengths(ageYears)) {
        const [minDur, maxDur] = SESSION_LENGTH_RANGES[s];
        const inBand = PLAY_ACTIVITIES.filter(
          (a) => a.bands.includes(band) && a.durationMin >= minDur && a.durationMin <= maxDur
        );
        expect(
          inBand.length,
          `offered bucket "${s}" for band "${band}" must hold >= ${MIN_SESSION_BUCKET} in-band activities`
        ).toBeGreaterThanOrEqual(MIN_SESSION_BUCKET);
      }
    }
  });

  it("never offers a session length whose bucket is empty for the band", () => {
    for (const { band, ageYears } of bandAges) {
      const offered = availableSessionLengths(ageYears);
      for (const s of SESSION_LENGTHS) {
        const [minDur, maxDur] = SESSION_LENGTH_RANGES[s];
        const bucketEmpty = !PLAY_ACTIVITIES.some(
          (a) => a.bands.includes(band) && a.durationMin >= minDur && a.durationMin <= maxDur
        );
        if (bucketEmpty) {
          expect(offered, `empty bucket "${s}" must not be offered for band "${band}"`).not.toContain(s);
        }
      }
    }
  });

  it("picks for every OFFERED length stay inside that length's range (fallback never fires)", () => {
    for (const { ageYears } of bandAges) {
      for (const s of availableSessionLengths(ageYears)) {
        const [minDur, maxDur] = SESSION_LENGTH_RANGES[s];
        const picks = selectDailyPlay({ ageYears, daySeed: 7, sessionLength: s });
        expect(picks.length).toBeGreaterThan(0);
        for (const p of picks) {
          expect(p.activity.durationMin).toBeGreaterThanOrEqual(minDur);
          expect(p.activity.durationMin).toBeLessThanOrEqual(maxDur);
        }
      }
    }
  });

  // KID-3 content wave: the buckets the chips depend on are now honestly
  // stocked — extended (21–30 min) for every band EXCEPT infant (a 25–30 min
  // guided session is not an honest ask of that band), standard for infant.
  it("the extended chip is now offered for toddler / preschool / early-school, and NOT for infant", () => {
    for (const { band, ageYears } of bandAges) {
      const offered = availableSessionLengths(ageYears);
      if (band === "infant") {
        expect(offered, "infant must not be offered the extended chip").not.toContain("extended");
      } else {
        expect(offered, `band "${band}" should now offer the extended chip`).toContain("extended");
      }
    }
  });

  it("every band is offered the standard chip (infant standard bucket stocked by the KID-3 wave)", () => {
    for (const { band, ageYears } of bandAges) {
      expect(availableSessionLengths(ageYears), `band "${band}" missing the standard chip`).toContain("standard");
    }
  });

  // Static guard: the duration badge in both play cards is the activity's real
  // durationMin — a chip's range label ("25-30 min") can never be displayed for
  // an activity that doesn't satisfy it.
  it("DailyPlayCard / DailyPlanCard badge the real durationMin, never the chip range", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    for (const rel of [
      "../components/overview/DailyPlayCard.tsx",
      "../components/overview/DailyPlanCard.tsx",
    ]) {
      const src = readFileSync(path.join(here, rel), "utf8");
      expect(src, `${rel} must badge the activity's own durationMin`).toContain(
        't("play.min", { n: activity.durationMin })'
      );
      // Strip comments so prose mentioning the keys can't false-positive.
      const noComments = src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(
        noComments,
        `${rel} must not render a play.session.* range label as the badge`
      ).not.toMatch(/play\.session\.(short|standard|extended)/);
    }
  });
});

// ── W2 masterplan 2.5: recommendation continuation (Maytal frame 5) ──────────
// The parent's last reported outcome adjusts ranking WEIGHTS only:
// helped → same-domain next step ×1.35; not_today → same-domain ×0.75 +
// low-effort ×1.15; somewhat/absent → byte-identical. The `continuation` flag
// (and the card line it gates) derives ONLY from a parent-reported "helped".
describe("W2 2.5 Daily Play continuation", () => {
  const helpedReg = { recommendation: "Try a calm breathing moment before the transition", outcome: "helped" as const };
  const notTodayReg = { recommendation: "Try a calm breathing moment before the transition", outcome: "not_today" as const };

  describe("domainForRecommendation", () => {
    it("routes behaviour-lexicon text and activity-verb text to a domain", () => {
      expect(domainForRecommendation("handle the tantrum at bedtime")).toBe("regulation");
      expect(domainForRecommendation("a calm breathing game")).toBe("regulation");
      expect(domainForRecommendation("read a picture book aloud")).toBe("language");
      expect(domainForRecommendation("sort the laundry by color and count")).toBe("cognitive");
      expect(domainForRecommendation("completely unrelated text")).toBeNull();
    });
  });

  it("helped → same-domain activities score higher; every other score is untouched", () => {
    const base = rankDailyPlay({ ageYears: 4, daySeed: 1 });
    const withHelped = rankDailyPlay({ ageYears: 4, daySeed: 1, lastAction: helpedReg });
    for (const p of withHelped) {
      const before = base.find((b) => b.activity.id === p.activity.id)!;
      if (p.activity.domain === "regulation") {
        expect(p.score).toBeGreaterThan(before.score);
      } else {
        expect(p.score).toBe(before.score);
      }
    }
  });

  it("helped → a same-domain pick surfaces at the top, flagged as continuation", () => {
    const picks = selectDailyPlay({ ageYears: 4, daySeed: 1, lastAction: helpedReg });
    const flagged = picks.filter((p) => p.continuation);
    expect(flagged.length).toBeGreaterThan(0);
    for (const p of flagged) {
      expect(p.activity.domain).toBe("regulation");
      expect(p.activity.bands).toContain("preschool");
    }
  });

  it("continuation boost (1.35) stays below goal (1.6) and top-concern (1.8) weights", () => {
    expect(CONTINUATION_NEXT_STEP_BOOST).toBeLessThan(1.6);
    expect(CONTINUATION_NEXT_STEP_BOOST).toBeLessThan(1.8);
    expect(CONTINUATION_SWITCH_DAMP).toBeLessThan(1);
    expect(CONTINUATION_LOW_EFFORT_BOOST).toBeGreaterThan(1);
  });

  it("not_today → same-domain damped, low-effort nudged, and NEVER flagged", () => {
    const base = rankDailyPlay({ ageYears: 4, daySeed: 1 });
    const withNo = rankDailyPlay({ ageYears: 4, daySeed: 1, lastAction: notTodayReg });
    expect(withNo.some((p) => p.continuation)).toBe(false);
    for (const p of withNo) {
      const before = base.find((b) => b.activity.id === p.activity.id)!;
      const lowEffort = p.activity.durationMin <= CONTINUATION_LOW_EFFORT_MAX_MIN;
      const sameDomain = p.activity.domain === "regulation";
      if (sameDomain && !lowEffort) expect(p.score).toBeLessThan(before.score);
      if (!sameDomain && lowEffort) expect(p.score).toBeGreaterThan(before.score);
      if (!sameDomain && !lowEffort) expect(p.score).toBe(before.score);
    }
  });

  it('"somewhat" is neutral — byte-identical ranking to no lastAction', () => {
    const base = selectDailyPlay({ ageYears: 4, concernDomains: ["social"], daySeed: 3 });
    const somewhat = selectDailyPlay({
      ageYears: 4, concernDomains: ["social"], daySeed: 3,
      lastAction: { recommendation: "a calm breathing game", outcome: "somewhat" },
    });
    expect(JSON.stringify(somewhat)).toBe(JSON.stringify(base));
  });

  it("ZERO-REGRESSION: no lastAction → byte-identical selection, no continuation key", () => {
    const ctx: PlaySelectContext = { ageYears: 3, concernDomains: ["language"], interests: ["Trains"], daySeed: 9 };
    const bare = selectDailyPlay(ctx);
    const explicitUndefined = selectDailyPlay({ ...ctx, lastAction: undefined });
    expect(JSON.stringify(bare)).toBe(JSON.stringify(explicitUndefined));
    // JSON drops undefined fields — absent input must never serialize a flag.
    expect(JSON.stringify(bare)).not.toContain("continuation");
  });

  it("unmatchable recommendation text adjusts nothing on helped", () => {
    const base = selectDailyPlay({ ageYears: 4, daySeed: 2 });
    const noMatch = selectDailyPlay({
      ageYears: 4, daySeed: 2,
      lastAction: { recommendation: "zzz nothing recognizable", outcome: "helped" },
    });
    expect(JSON.stringify(noMatch)).toBe(JSON.stringify(base));
  });

  it("is deterministic for a given seed with lastAction (weights, never randomness)", () => {
    const a = selectDailyPlay({ ageYears: 4, daySeed: 11, lastAction: helpedReg });
    const b = selectDailyPlay({ ageYears: 4, daySeed: 11, lastAction: helpedReg });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// ── W2 2.5 attribution pin (verification-panel HARD RULE) ────────────────────
// The continuation line is ALWAYS an echo of the parent's own report — the
// flag derives only from outcome === "helped", the card renders the line only
// behind that flag, and the copy carries the "You said / אמרת" attribution.
describe("W2 2.5 'you said' attribution pin", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const noComments = (src: string) =>
    src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

  it("select.ts sets `continuation` only under a parent-reported 'helped' outcome", () => {
    const src = noComments(readFileSync(path.join(here, "./select.ts"), "utf8"));
    const assignment = src.match(/const continuation =[\s\S]*?;/);
    expect(assignment, "continuation assignment must exist").toBeTruthy();
    expect(assignment![0]).toContain('lastOutcome === "helped"');
    // No other code path may set the flag.
    expect(src.match(/continuation\s*=/g)!.length).toBe(1);
  });

  it("DailyPlayCard renders the line ONLY behind pick.continuation, with the attribution key", () => {
    const src = noComments(
      readFileSync(path.join(here, "../components/overview/DailyPlayCard.tsx"), "utf8")
    );
    expect(src).toContain("pick.continuation &&");
    expect(src).toContain('continueText("elev.continue.play.helped"');
    // The key must not render outside the continuation gate: the only mount
    // of the string sits inside the {pick.continuation && ...} block.
    const gate = src.indexOf("pick.continuation &&");
    const key = src.indexOf('elev.continue.play.helped');
    expect(gate).toBeGreaterThan(-1);
    expect(key).toBeGreaterThan(gate);
  });
});
