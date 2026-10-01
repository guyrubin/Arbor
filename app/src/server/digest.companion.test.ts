/**
 * B-AI-02 — the weekly digest reads the parent's own steps (CompanionContext,
 * absorbs B-TODAY-23's digest input) and the fallback states no totals (the
 * B-TODAY-03 framer decision).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildDigestPrompt, computeWeeklyDigestStats, fallbackDigestNarrative } from "./digest.js";

const NOW = Date.parse("2026-10-01T12:00:00.000Z");
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

describe("B-AI-02 — the digest reads the parent's own steps; the fallback states no totals", () => {
  const stats = computeWeeklyDigestStats(
    [{ id: "l1", behaviorType: "Tantrum", timestamp: daysAgo(1), intensity: 3 } as never],
    [{ title: "m", checked: true }, { title: "n", checked: false }],
    NOW,
  );

  it("a family whose last outcome is not_today on '2-minute warning' → the prompt carries it and forbids re-proposing it", () => {
    const prompt = buildDigestPrompt({
      contract: "CONTRACT", childJson: "{}", childName: "Noa", stats, languageDirective: "",
      recentSteps: [{ recommendation: "2-minute warning before leaving the park", outcome: "not_today" }],
    });
    expect(prompt).toContain('{"step":"2-minute warning before leaving the park","reported":"not today"}');
    expect(prompt).toContain('Never propose again, as-is, a step the parent reported "not today"');
  });

  it("no steps → the B-TODAY-03 bytes (the line is purely additive)", () => {
    const base = buildDigestPrompt({ contract: "C", childJson: "{}", childName: "Noa", stats, languageDirective: "" });
    expect(buildDigestPrompt({ contract: "C", childJson: "{}", childName: "Noa", stats, languageDirective: "", recentSteps: [] })).toBe(base);
    expect(base).not.toContain("Steps the parent chose");
  });

  it("the fallback digest's milestone line is a count, never 'X of Y reached'", () => {
    const n = fallbackDigestNarrative("Noa", stats);
    const text = [n.summary, ...n.highlights, n.preheader].join(" ");
    expect(text).toContain("1 milestone noticed so far.");
    expect(text).not.toMatch(/\bof \d+ reached|Milestones: \d+ of \d+/);
    // Negative control: the stats DO carry a denominator the line no longer states.
    expect(stats.milestonesTotal).toBe(2);
  });

  it("the /digest route passes the CompanionContext steps into buildDigestPrompt", () => {
    const api = readFileSync(path.join(__dirname, "..", "routes", "api.ts"), "utf8");
    const route = api.slice(api.indexOf('router.post("/digest",'), api.indexOf('router.get("/digest/email-status"'));
    expect(route).toMatch(/companionFor\(req, "digest", childProfile, ""\)/);
    expect(route).toMatch(/recentSteps: companion\.acceptedActions\.map/);
  });
});
