import { describe, it, expect } from "vitest";
import {
  selectDailyPlay, rankDailyPlay, concernDomainsFromLogs, domainForBehaviorType, daySeedFor,
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
});
