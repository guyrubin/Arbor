/**
 * firsts.test.ts — ENG-13: the week-1 celebration that could not happen.
 *
 * Behaviour tests over the pure detector. Every case fails without the module
 * (there was no code anywhere that fired a celebration at a threshold of ONE —
 * growth/prideMoment.ts returns [] with no prior snapshot and its count
 * thresholds start at 5, which is the defect these tests exist to close).
 *
 * The load-bearing cases are the anti-streak ones: the first week must be
 * reachable through CUMULATIVE distinct days, never consecutive ones.
 */
import { describe, it, expect } from "vitest";
import {
  EMPTY_FIRSTS_STATE,
  FIRST_KINDS,
  FIRST_WEEK_DAYS,
  FIRST_WEEK_MIN_DAYS_WITH_MOMENTS,
  detectFirsts,
  firstCopyKeys,
  hasCelebratedFirst,
  mergeFirsts,
  pickFirst,
  type FirstsInput,
} from "./firsts";

const base: FirstsInput = {
  momentCount: 0,
  milestoneCount: 0,
  storyCount: 0,
  momentDays: [],
  daysSinceStart: 0,
};

describe("a first fires at ONE, on day zero", () => {
  it("the first moment belongs to the lifecycle spine, not here", () => {
    // ONE OWNER PER CELEBRATION. lib/lifecycle.ts stages the time-based
    // moments on Today. Detecting them here as well showed a parent the
    // IDENTICAL sentence twice, on two surfaces, from two ledgers that cannot
    // see each other.
    const firsts = detectFirsts({ ...base, momentCount: 1, momentDays: ["2026-09-01"] }, EMPTY_FIRSTS_STATE);
    expect(firsts).toEqual([]);
  });

  it("the first milestone and the first story each fire at one", () => {
    expect(detectFirsts({ ...base, milestoneCount: 1 }, EMPTY_FIRSTS_STATE)).toEqual([
      { kind: "first_milestone", count: 1 },
    ]);
    expect(detectFirsts({ ...base, storyCount: 1 }, EMPTY_FIRSTS_STATE)).toEqual([
      { kind: "first_story", count: 1 },
    ]);
  });

  it("a brand-new family with nothing yet celebrates nothing", () => {
    expect(detectFirsts(base, EMPTY_FIRSTS_STATE)).toEqual([]);
  });
});

describe("the first week is cumulative, never a streak", () => {
  const scattered = ["2026-09-01", "2026-09-04", "2026-09-07"]; // Mon, Thu, Sun

  it("the first week belongs to the lifecycle spine, not here", () => {
    const firsts = detectFirsts(
      { ...base, momentCount: 3, momentDays: scattered, daysSinceStart: 6 },
      EMPTY_FIRSTS_STATE,
    );
    expect(firsts.some((f) => f.kind === "first_week")).toBe(false);
  });

  it("does not fire before the week has actually passed", () => {
    const firsts = detectFirsts(
      { ...base, momentCount: 3, momentDays: scattered, daysSinceStart: 4 },
      EMPTY_FIRSTS_STATE,
    );
    expect(firsts.some((f) => f.kind === "first_week")).toBe(false);
  });

  it("does not fire on two days of moments, however many moments they hold", () => {
    const firsts = detectFirsts(
      { ...base, momentCount: 40, momentDays: ["2026-09-01", "2026-09-02"], daysSinceStart: 9 },
      EMPTY_FIRSTS_STATE,
    );
    expect(firsts.some((f) => f.kind === "first_week")).toBe(false);
  });

  it("counts DISTINCT days — ten moments on one day is one day", () => {
    const sameDay = Array.from({ length: 10 }, () => "2026-09-01");
    const firsts = detectFirsts(
      { ...base, momentCount: 10, momentDays: sameDay, daysSinceStart: 8 },
      EMPTY_FIRSTS_STATE,
    );
    expect(firsts.some((f) => f.kind === "first_week")).toBe(false);
  });

  it("the thresholds are the documented ones", () => {
    expect(FIRST_WEEK_DAYS).toBe(7);
    expect(FIRST_WEEK_MIN_DAYS_WITH_MOMENTS).toBe(3);
  });
});

describe("idempotency — a first can never happen twice", () => {
  const input: FirstsInput = { ...base, milestoneCount: 1 };

  it("re-detecting after merging the state yields nothing", () => {
    const first = detectFirsts(input, EMPTY_FIRSTS_STATE);
    expect(first).toHaveLength(1);
    const next = mergeFirsts(EMPTY_FIRSTS_STATE, first);
    expect(detectFirsts(input, next)).toEqual([]);
    // Still nothing when more arrive — the FIRST already happened.
    expect(detectFirsts({ ...input, milestoneCount: 12 }, next)).toEqual([]);
  });

  it("merge is pure and de-duplicates", () => {
    const state = { seen: ["first_moment"] };
    const merged = mergeFirsts(state, [{ kind: "first_moment", count: 3 }]);
    expect(merged.seen).toEqual(["first_moment"]);
    expect(state.seen).toEqual(["first_moment"]);
    expect(hasCelebratedFirst(merged, "first_moment")).toBe(true);
    expect(hasCelebratedFirst(merged, "first_week")).toBe(false);
  });

  it("a deleted row never un-fires a celebration and never fires a negative one", () => {
    const state = mergeFirsts(EMPTY_FIRSTS_STATE, [{ kind: "first_moment", count: 1 }]);
    expect(detectFirsts({ ...base, momentCount: 0 }, state)).toEqual([]);
  });
});

describe("only one card at a time", () => {
  it("picks the biggest true thing when several fire together", () => {
    const firsts = detectFirsts(
      {
        momentCount: 5,
        milestoneCount: 1,
        storyCount: 1,
        momentDays: ["2026-09-01", "2026-09-03", "2026-09-06"],
        daysSinceStart: 7,
      },
      EMPTY_FIRSTS_STATE,
    );
    // first_week and first_moment are the lifecycle spine's; what remains here
    // is the milestone and the story, and only one card shows.
    expect(firsts.length).toBeGreaterThan(1);
    expect(pickFirst(firsts)?.kind).toBe("first_milestone");
  });

  it("returns null when nothing fired", () => {
    expect(pickFirst([])).toBeNull();
  });

  it("every kind has copy keys under the elev namespace", () => {
    for (const kind of FIRST_KINDS) {
      const keys = firstCopyKeys(kind);
      expect(keys.title).toBe(`elev.firsts.${kind}.title`);
      expect(keys.sub).toBe(`elev.firsts.${kind}.sub`);
    }
  });
});

describe("clinical firewall: a first carries a count and a kind, nothing else", () => {
  it("emits no score, ratio, target or delta field", () => {
    const firsts = detectFirsts({ ...base, milestoneCount: 4 }, EMPTY_FIRSTS_STATE);
    expect(Object.keys(firsts[0]).sort()).toEqual(["count", "kind"]);
  });

  it("junk counts degrade to nothing rather than to a wrong celebration", () => {
    expect(detectFirsts({ ...base, milestoneCount: Number.NaN }, EMPTY_FIRSTS_STATE)).toEqual([]);
    expect(detectFirsts({ ...base, milestoneCount: -3 }, EMPTY_FIRSTS_STATE)).toEqual([]);
  });
});
