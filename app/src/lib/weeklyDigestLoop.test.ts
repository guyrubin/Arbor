import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { en, he } from "./i18n";

/**
 * AIX-S6 — the weekly digest's tryThisWeek feeds the action loop (source-tier
 * guards, coachCaptureHonesty.test.ts style).
 *
 * The digest is the reference AI surface but its "Try this week" card was
 * inert text. The CTA routes through the EXISTING acceptTodayAction seam with
 * digest provenance. TODAY-1 firewall guard: only AI-generated digests
 * (generated === "ai") may offer the CTA — fallback digests keep the plain
 * card, so deterministic copy can never be persisted into actionLoops.
 */

const SRC_ROOT = path.resolve(__dirname, "..");
const read = (rel: string): string => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");

describe("AIX-S6 — WeeklyTab digest CTA", () => {
  const code = read("components/tabs/WeeklyTab.tsx");

  it("the CTA is gated on generated === 'ai' (fallback digests keep the plain card)", () => {
    expect(code).toMatch(/selected\.digest\.generated === "ai" &&/);
  });

  it("routes through the EXISTING acceptTodayAction seam with digest provenance", () => {
    expect(code).toMatch(/acceptTodayAction\(selected\.digest!\.tryThisWeek, "standard", "digest"\)/);
    // No parallel write path: WeeklyTab never touches the actionLoops
    // collection directly.
    expect(code).not.toContain('useChildCollection<ActionLoopEntry>');
    expect(code).not.toContain('"actionLoops"');
  });

  it("shows an honest done-state instead of a second accept when today's step is already this text", () => {
    expect(code).toMatch(/activeTodayAction\?\.recommendation === selected\.digest\.tryThisWeek\.trim\(\)/);
    expect(code).toContain('t("wk.todayStepSet")');
  });

  it("CTA copy reuses the canonical today.action.make key (no duplicated literal)", () => {
    expect(code).toContain('t("today.action.make")');
    expect(code).not.toContain('"Make this today\'s step"');
  });
});

describe("AIX-S6 — acceptTodayAction carries provenance", () => {
  const code = read("context/ArborContext.tsx");

  it("source defaults to today-guidance and is persisted on the entry", () => {
    expect(code).toMatch(/acceptTodayAction = \(recommendation: string, capacity: ActionCapacity, source: ActionLoopEntry\["source"\] = "today-guidance"\)/);
    expect(code).toMatch(/recommendation: recommendation\.trim\(\), source, capacity/);
  });
});

describe("AIX-S6 — Today surface shows digest provenance honestly", () => {
  const code = read("components/overview/TodayActionLoop.tsx");

  it("a digest-sourced step renders the digest eyebrow", () => {
    expect(code).toMatch(/activeTodayAction\.source === "digest" \? t\("today\.action\.eyebrow\.digest"\)/);
  });
});

describe("AIX-S6 — EN + HE copy", () => {
  const KEYS = ["wk.todayStepSet", "today.action.eyebrow.digest", "today.action.make"];

  it("every key exists in BOTH dictionaries with non-empty values", () => {
    for (const k of KEYS) {
      expect(en[k], `en missing ${k}`).toBeTruthy();
      expect(he[k], `he missing ${k}`).toBeTruthy();
    }
  });

  it("copy stays clinical-firewall clean — no scores, verdicts or diagnoses", () => {
    const banned = /(score|verdict|diagnos|percentile|%)/i;
    for (const k of KEYS) {
      expect(en[k]).not.toMatch(banned);
      expect(he[k]).not.toMatch(banned);
    }
  });
});
