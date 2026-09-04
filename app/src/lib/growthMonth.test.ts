/**
 * GP-32 — month in review for Growth.
 *
 * BEHAVIOUR tests on the derivation, plus a firewall scan over the card that
 * renders it. The single most important property: a "month in review" must
 * never become a progress report on the child. Everything the module produces
 * is a count of what the PARENT did.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildGrowthMonthReview,
  growthMonthKey,
  growthMonthLabel,
  monthReviewSeenKey,
  previousMonthKey,
} from "./growthMonth";

const ms = (id: string, domain: string, at?: string, checked = true) => ({
  id,
  title: `Milestone ${id}`,
  domain,
  checked,
  observationUpdatedAt: at,
});

describe("month keys", () => {
  it("keys a date to its LOCAL year-month", () => {
    expect(growthMonthKey(new Date(2026, 7, 15))).toBe("2026-08");
    expect(growthMonthKey(new Date(2026, 0, 1))).toBe("2026-01");
  });

  it("reviews the month BEFORE the one being lived in", () => {
    expect(previousMonthKey(new Date(2026, 8, 4))).toBe("2026-08");
  });

  it("rolls back across a year boundary", () => {
    expect(previousMonthKey(new Date(2026, 0, 3))).toBe("2025-12");
  });

  it("returns an empty key for an unusable date rather than a wrong month", () => {
    expect(growthMonthKey(new Date("not-a-date"))).toBe("");
    expect(previousMonthKey(new Date("not-a-date"))).toBe("");
  });

  it("scopes the seen-marker to child AND month", () => {
    expect(monthReviewSeenKey("kid-1", "2026-08")).not.toBe(monthReviewSeenKey("kid-1", "2026-09"));
    expect(monthReviewSeenKey("kid-1", "2026-08")).not.toBe(monthReviewSeenKey("kid-2", "2026-08"));
  });

  it("derives the label from the key at render time, in the viewer's language", () => {
    expect(growthMonthLabel("2026-08", "en")).toMatch(/August/);
    expect(growthMonthLabel("2026-08", "he")).toBeTruthy();
    expect(growthMonthLabel("2026-08", "he")).not.toBe(growthMonthLabel("2026-08", "en"));
    expect(growthMonthLabel("nonsense", "en")).toBe("nonsense");
  });
});

describe("buildGrowthMonthReview — counts of what the PARENT did", () => {
  const milestones = [
    ms("a", "motor", "2026-08-03T10:00:00.000Z"),
    ms("b", "motor", "2026-08-19T10:00:00.000Z"),
    ms("c", "language", "2026-08-28T10:00:00.000Z"),
    ms("d", "social", "2026-07-30T10:00:00.000Z"), // previous month
    ms("e", "social", "2026-09-01T10:00:00.000Z"), // next month
    ms("f", "social", undefined), // checked but undated — cannot be attributed
    ms("g", "motor", "2026-08-10T10:00:00.000Z", false), // not marked noticed
  ];
  const moments = [
    "2026-08-02T08:00:00.000Z",
    "2026-08-02T20:00:00.000Z",
    "2026-08-31T23:00:00.000Z",
    "2026-07-31T23:00:00.000Z",
    "2026-09-01T00:30:00.000Z",
  ];

  const review = buildGrowthMonthReview({ monthKey: "2026-08", milestones, momentTimestamps: moments });

  it("counts only milestones NOTICED inside the month", () => {
    expect(review.noticedCount).toBe(3);
  });

  it("counts DISTINCT areas those marks landed in, never ranks them", () => {
    expect(review.areasTouchedCount).toBe(2); // motor + language
  });

  it("counts moments kept inside the month", () => {
    expect(review.momentsKeptCount).toBe(3);
  });

  it("ignores unchecked and undated milestones entirely", () => {
    const only = buildGrowthMonthReview({
      monthKey: "2026-08",
      milestones: [ms("f", "social", undefined), ms("g", "motor", "2026-08-10T10:00:00.000Z", false)],
      momentTimestamps: [],
    });
    expect(only.noticedCount).toBe(0);
    expect(only.areasTouchedCount).toBe(0);
    expect(only.hasEntries).toBe(false);
  });

  it("reports hasEntries=false for an empty month so the card never renders 0 · 0 · 0", () => {
    const empty = buildGrowthMonthReview({ monthKey: "2026-06", milestones, momentTimestamps: moments });
    expect(empty.noticedCount).toBe(0);
    expect(empty.momentsKeptCount).toBe(0);
    expect(empty.hasEntries).toBe(false);
  });

  it("emits ONLY count fields — no ratio, share, delta or level", () => {
    expect(Object.keys(review).sort()).toEqual(
      ["areasTouchedCount", "hasEntries", "momentsKeptCount", "monthKey", "noticedCount"],
    );
    for (const [k, v] of Object.entries(review)) {
      if (typeof v === "number") expect(Number.isInteger(v), `${k} is not an integer count`).toBe(true);
    }
  });
});

/* ── CLINICAL FIREWALL over the module and the card it feeds ──────────────── */
describe("GP-32 — the month card is not a progress report on the child", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const read = (rel: string) =>
    readFileSync(path.join(here, "..", rel), "utf8").replace(/\r\n/g, "\n");
  const CARD = read("components/growth/MonthInReview.tsx");
  const MODULE = read("lib/growthMonth.ts");

  it("both files were actually read (extraction proven)", () => {
    expect(CARD.length).toBeGreaterThan(1000);
    expect(MODULE.length).toBeGreaterThan(500);
  });

  it("NEGATIVE CONTROL — the banned shapes are what the matcher catches", () => {
    const banned = /\bpercent|\bpct\b|\bscore\b|\bratio\b|\bdelta\b|\bvs last month\b|\bcompared to\b|\bon[\s-]?track\b|\bbehind\b|\bweakest/i;
    for (const bad of [
      'const pct = noticed / total * 100;',
      'label: "up 2 vs last month"',
      'weakestDomain(domains)',
      '{ score: computeDevScore(milestones) }',
    ]) {
      expect(banned.test(bad), `matcher missed: ${bad}`).toBe(true);
    }
    // …and does not fire on the shapes this feature legitimately uses.
    for (const ok of ['noticedCount', 'areasTouchedCount', 'momentsKeptCount']) {
      expect(banned.test(ok)).toBe(false);
    }
  });

  it("neither the derivation nor the card computes a share, delta or verdict", () => {
    const banned = /\bpercent|\bpct\b|\bratio\b|\bdelta\b|\bcompared to\b|\bon[\s-]?track\b|\bweakest/i;
    // Comments describing the ban are stripped first — the rule is about code.
    const code = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    expect(banned.test(code(MODULE))).toBe(false);
    expect(banned.test(code(CARD))).toBe(false);
  });

  it("the card renders no colour fork keyed on any count", () => {
    // The chromatic-verdict shape: <count> >= n ? colourA : colourB.
    expect(CARD).not.toMatch(/Count\s*(?:>=|<=|>|<)\s*\d+\s*\?\s*"var\(--arbor-/);
  });

  it("the card offers exactly one thing to watch for, through the existing focus seam", () => {
    expect(CARD).toContain("selectWeeklyFocus");
    expect(CARD).toContain("writeWatchFocus");
    expect(CARD).toContain('data-testid="growth-month-watch-accept"');
  });

  it("the card is offered once per child per month and can be closed", () => {
    expect(CARD).toContain("monthReviewSeenKey(childProfile.id, monthKey)");
    expect(CARD).toContain('data-testid="growth-month-close"');
    expect(CARD).toMatch(/if \(dismissed \|\| !monthKey \|\| !review\.hasEntries\) return null;/);
  });
});
