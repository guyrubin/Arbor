import { describe, expect, it } from "vitest";
import { computeWeeklyDigestStats, fallbackDigestNarrative } from "./digest.js";

const NOW = Date.parse("2026-06-11T12:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

const log = (overrides: Partial<{ timestamp: string; behaviorType: string; intensity: number; durationMinutes: number; context: string; resolved: boolean }> = {}) => ({
  timestamp: daysAgo(1),
  behaviorType: "Transition refusal",
  intensity: 3,
  durationMinutes: 10,
  context: "Home",
  resolved: false,
  ...overrides,
});

describe("weekly digest stats (RET-1)", () => {
  it("counts only the trailing 7 days and compares with the previous week", () => {
    const logs = [
      log({ timestamp: daysAgo(1), intensity: 2 }),
      log({ timestamp: daysAgo(3), intensity: 2, resolved: true }),
      log({ timestamp: daysAgo(10), intensity: 5 }), // previous week
      log({ timestamp: daysAgo(20), intensity: 5 }), // outside both windows
    ];
    const stats = computeWeeklyDigestStats(logs, [{ title: "m", checked: true }, { title: "n", checked: false }], NOW);
    expect(stats.momentsLogged).toBe(2);
    expect(stats.previousWeekMoments).toBe(1);
    expect(stats.avgIntensity).toBe(2);
    expect(stats.intensityTrend).toBe("easing");
    expect(stats.resolvedCount).toBe(1);
    expect(stats.milestonesDone).toBe(1);
    expect(stats.milestonesTotal).toBe(2);
  });

  it("reports the dominant context and behavior", () => {
    const logs = [
      log({ context: "School", behaviorType: "Morning refusal" }),
      log({ context: "School", behaviorType: "Morning refusal" }),
      log({ context: "Home", behaviorType: "Screen dispute" }),
    ];
    const stats = computeWeeklyDigestStats(logs, [], NOW);
    expect(stats.topContext).toBe("School");
    expect(stats.topBehavior).toBe("Morning refusal");
  });

  it("handles an empty week without NaN", () => {
    const stats = computeWeeklyDigestStats([], [], NOW);
    expect(stats.momentsLogged).toBe(0);
    expect(stats.avgIntensity).toBeNull();
    expect(stats.intensityTrend).toBe("unknown");
  });

  it("fallback narrative is truthful and channel-ready (subject/preheader present)", () => {
    const stats = computeWeeklyDigestStats([log()], [{ title: "m", checked: true }], NOW);
    const n = fallbackDigestNarrative("Maya", stats);
    expect(n.title).toBe("Maya's week");
    expect(n.subject).toContain("Maya");
    expect(n.preheader.length).toBeGreaterThan(0);
    expect(n.highlights.length).toBeGreaterThan(0);
    expect(n.tryThisWeek.length).toBeGreaterThan(0);
  });
});
