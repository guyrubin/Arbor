import { describe, expect, it } from "vitest";
import { buildDigestEmail, buildDigestPrompt, computeWeeklyDigestStats, DIGEST_NO_COMPARE_LINE, digestPromptStats, fallbackDigestNarrative } from "./digest.js";
import { readFileSync } from "node:fs";
import path from "node:path";

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
    expect(stats.resolvedCount).toBe(1);
    expect(stats.milestonesDone).toBe(1);
    expect(stats.milestonesTotal).toBe(2);
  });

  it("carries counts only — no derived intensity score or trend verdict (clinical firewall)", () => {
    const logs = [
      log({ timestamp: daysAgo(1), intensity: 2 }),
      log({ timestamp: daysAgo(10), intensity: 5 }), // previous week, would have read "easing"
    ];
    const stats = computeWeeklyDigestStats(logs, [], NOW);
    expect(stats).not.toHaveProperty("avgIntensity");
    expect(stats).not.toHaveProperty("intensityTrend");
    const narrative = fallbackDigestNarrative("Maya", stats);
    expect(JSON.stringify(narrative)).not.toMatch(/easing|intensifying|\/\s*5\b/i);
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
    expect(stats.daysCovered).toBe(0);
    expect(stats.resolvedCount).toBe(0);
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

/**
 * B-TODAY-03 — the digest prompt was handed `previousWeekMoments` and
 * `milestonesTotal` ("do not contradict them") and asked for "watchFor"
 * observations. Asserted on the FINAL prompt builder, not a literal, so a
 * rewrite (lane X B-AI-02) must keep the projection and the no-compare line.
 */
describe("B-TODAY-03 — digest prompt projection and no-compare rule", () => {
  const stats = computeWeeklyDigestStats(
    [log({ timestamp: daysAgo(1) }), log({ timestamp: daysAgo(9) })],
    [{ title: "m", checked: true }, { title: "n", checked: false }],
    NOW,
  );
  const prompt = buildDigestPrompt({ contract: "CONTRACT", childJson: "{}", childName: "Noa", stats, languageDirective: "" });

  it("NEGATIVE CONTROL — the raw stats DO carry both fields", () => {
    expect(JSON.stringify(stats)).toContain("previousWeekMoments");
    expect(JSON.stringify(stats)).toContain("milestonesTotal");
  });

  it("the final prompt contains neither previousWeekMoments nor milestonesTotal", () => {
    expect(prompt).not.toContain("previousWeekMoments");
    expect(prompt).not.toContain("milestonesTotal");
    expect(Object.keys(digestPromptStats(stats))).not.toContain("previousWeekMoments");
    expect(prompt).toContain('"momentsLogged":1');
  });

  it("the prompt states the no-compare rule and asks for no watch-for observations", () => {
    expect(prompt).toContain(DIGEST_NO_COMPARE_LINE);
    expect(DIGEST_NO_COMPARE_LINE).toMatch(/Never compare with earlier weeks; never state a total or a share\./);
    expect(prompt).not.toMatch(/keeping an eye on|gentle observations/);
  });

  it("the /digest route builds its prompt through buildDigestPrompt and answers watchFor: []", () => {
    const api = readFileSync(path.join(__dirname, "..", "routes", "api.ts"), "utf8");
    const route = api.slice(api.indexOf('router.post("/digest",'), api.indexOf('router.get("/digest/email-status"'));
    expect(route).toContain("buildDigestPrompt({");
    expect(route).not.toContain("JSON.stringify(stats)");
    expect(route).toMatch(/res\.json\(\{ \.\.\.narrative, watchFor: \[\], stats, generated: "ai" \}\)/);
  });

  it("the fallback narrative (and so every fallback response) carries watchFor: []", () => {
    const busy = computeWeeklyDigestStats([log(), log(), log({ context: "School" })], [], NOW);
    expect(busy.topBehavior).toBeTruthy();
    expect(fallbackDigestNarrative("Noa", busy).watchFor).toEqual([]);
  });

  it("the email builder renders no watch line from a fallback narrative", () => {
    const n = fallbackDigestNarrative("Noa", stats);
    const email = buildDigestEmail({ childName: "Noa", language: "en", narrative: n, stats });
    expect(n.watchFor).toEqual([]);
    expect(email.bodyText).not.toMatch(/came up most often/);
  });
});
