import { describe, expect, it } from "vitest";
import type { ActionLoopEntry } from "../../actionLoop/model";
import { bandForAge, localizeActivity } from "../../playbank/content";
import { dailyPlayForNow, focusSignalsForNow, type NowPlayPick } from "./nowRecommendationModel";
import { toDomains } from "../../lib/domains/registry";

const now = new Date("2026-10-09T12:00:00Z");
const row = (id: string, at: string, extra: Partial<ActionLoopEntry> = {}): ActionLoopEntry => ({
  id, acceptedAt: at, recommendation: id, source: "coach", capacity: "tiny", status: "completed", outcome: "helped", outcomeAt: at, ...extra,
});

describe("Now's bounded daily signals", () => {
  it("counts real recent entries and excludes malformed, old and future timestamps", () => {
    expect(focusSignalsForNow({
      behaviorLogs: [
        { timestamp: "2026-10-08T08:00:00Z", behaviorType: "Moment" },
        { timestamp: "2026-09-08T08:00:00Z", behaviorType: "Tantrum" },
        { timestamp: "2026-10-10T08:00:00Z", behaviorType: "Tantrum" },
        { timestamp: "invalid", behaviorType: "Tantrum" },
      ],
      playLogs: [{ timestamp: "2026-10-09T08:00:00Z" }],
      milestones: [{ checked: true, observationUpdatedAt: "2026-10-09T09:00:00Z" }, { checked: false, observationUpdatedAt: "2026-10-09T10:00:00Z" }],
      actionLoop: [],
    }, now)).toEqual({ count: 3, topTrigger: "", latestAt: Date.parse("2026-10-09T09:00:00Z") });
  });
  it("chooses the newest reported outcome independently of collection order", () => {
    const rows = [row("old", "2026-10-01T08:00:00Z"), row("new", "2026-10-08T08:00:00Z", { outcome: "not_today" }), row("future", "2026-10-10T08:00:00Z")];
    const signals = focusSignalsForNow({ behaviorLogs: [], playLogs: [], milestones: [], actionLoop: rows }, now);
    expect(signals).toMatchObject({ lastActionRecommendation: "new", lastActionOutcome: "not_today", count: 0 });
    expect(rows[0].id).toBe("old");
  });
  it("does not pass private free text, intensity or derived scores into focus signals", () => {
    const privateRow = { timestamp: "2026-10-08T08:00:00Z", behaviorType: "Moment", notes: "private diary", trigger: "private words", intensity: 5 };
    const serialized = JSON.stringify(focusSignalsForNow({ behaviorLogs: [privateRow], playLogs: [], milestones: [], actionLoop: [] }, now));
    expect(serialized).not.toMatch(/private|intensity|score|percent|notes/);
  });
  it("keeps a sparse family honest: zero observations, no implied recent pattern", () => {
    expect(focusSignalsForNow({ behaviorLogs: [], playLogs: [], milestones: [], actionLoop: [] }, now)).toEqual({ count: 0, topTrigger: "" });
  });
});

describe("Now's library fallback", () => {
  it.each([0, 1, 3, 5, 9, 12])("has stable age-fitting activities and translated instructions at age %s", (ageYears) => {
    const input = { ageYears, goalDomains: ["language" as const], concernDomains: ["regulation" as const], daySeed: 456 };
    const picks = dailyPlayForNow(input);
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.length).toBeLessThanOrEqual(3);
    expect(picks.map((pick) => pick.activity.id)).toEqual(dailyPlayForNow(input).map((pick) => pick.activity.id));
    for (const pick of picks) {
      expect(pick.activity.bands).toContain(bandForAge(ageYears));
      expect(localizeActivity(pick.activity, "he").steps.every((step) => /[\u0590-\u05ff]/.test(step))).toBe(true);
    }
  });
  it("does not make up an age match when the age is unknown or unsupported", () => {
    for (const ageYears of [Number.NaN, -1, 13]) expect(dailyPlayForNow({ ageYears })).toEqual([]);
  });
});

// v3 F-NOW-1 r2 (FEAT-02): the active question's guide topic ranks library
// ideas in its areas first, and only those picks say so (`topic-match`).
describe("Now's question-led library order", () => {
  const base = { ageYears: 4, daySeed: 456 };
  const talking = (pick: NowPlayPick) => toDomains("play", pick.activity.domain, { activityId: pick.activity.id }).includes("talking");
  const ids = (picks: NowPlayPick[]) => picks.map((pick) => pick.activity.id);
  it("puts ideas in the question's areas first, in the library's own order, and marks only those", () => {
    const library = dailyPlayForNow(base, 100);
    expect(library.some(talking)).toBe(true);
    const picks = dailyPlayForNow({ ...base, topicDomains: ["talking"] });
    expect(picks[0].reason).toBe("topic-match");
    expect(talking(picks[0])).toBe(true);
    for (const pick of picks) expect(pick.reason === "topic-match").toBe(talking(pick));
    const ranked = dailyPlayForNow({ ...base, topicDomains: ["talking"] }, 100);
    expect([...ids(ranked)].sort()).toEqual([...ids(library)].sort());
    expect(ids(ranked.filter(talking))).toEqual(ids(library.filter(talking)));
    expect(ids(ranked.filter((pick) => !talking(pick)))).toEqual(ids(library.filter((pick) => !talking(pick))));
  });
  it("leaves the library's order and reasons alone without a question", () => {
    expect(dailyPlayForNow({ ...base, topicDomains: [] })).toEqual(dailyPlayForNow(base));
    expect(dailyPlayForNow(base).some((pick) => pick.reason === "topic-match")).toBe(false);
  });
});
