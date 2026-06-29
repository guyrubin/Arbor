import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COSMETICS, type CosmeticStats } from "./cosmetics";

/* BLOCKER 1 firewall guard (Kid Mode viral redesign, P0).
 *
 * The redesigned kid dashboard surfaces the cosmetics economy (star counter,
 * earned titles) prominently to a CHILD. A consecutive-day streak metric or a
 * "X days in a row" / loss-framed reward is banned streak-anxiety on a child who
 * can't consent. This guard makes that enforceable: any reward driven by a
 * streak, or worded as a loss/countdown, turns CI red. A documented principle
 * would not. See docs/KID-MODE-VIRAL-REDESIGN-PLAN.md §8.
 *
 * The child-safe consistency signal is daysPracticed (monotonic, never resets).
 */

// Every metric a child-facing cosmetic may key on. All are monotonic-or-breadth
// and none is a consecutive-day streak. Adding a streak metric here is the change
// this guard exists to block — it must be a deliberate, reviewed edit, not a slip.
const ALLOWED_METRICS: ReadonlyArray<keyof CosmeticStats> = [
  "totalSessions",
  "daysPracticed",
  "domainsTouched",
];

const LOSS_FRAMED = /in a row|streak|don'?t break|keep the streak|days? straight|consecutiv/i;

describe("cosmetics firewall — no streak-anxiety reaches the child", () => {
  it("keys every cosmetic on an allowed (non-streak) metric", () => {
    for (const c of COSMETICS) {
      expect(ALLOWED_METRICS, `${c.id} keys on a non-allowed metric: ${c.metric}`).toContain(c.metric);
    }
  });

  it("never uses a streakDays metric", () => {
    for (const c of COSMETICS) {
      expect(c.metric, `${c.id} must not key on streakDays`).not.toBe("streakDays");
    }
  });

  it("has no loss-framed / countdown requirement copy", () => {
    for (const c of COSMETICS) {
      expect(LOSS_FRAMED.test(c.requirement), `${c.id} requirement is loss-framed: "${c.requirement}"`).toBe(false);
    }
  });

  it("uses no fire/streak emoji on any reward", () => {
    for (const c of COSMETICS) {
      expect(c.emoji, `${c.id} uses a streak/fire emoji`).not.toBe("🔥");
    }
  });

  it("the cosmetics source itself contains no streak metric, fire emoji, or 'in a row' copy", () => {
    const src = readFileSync(new URL("./cosmetics.ts", import.meta.url), "utf8");
    expect(src).not.toContain("streakDays");
    expect(src).not.toContain("🔥");
    expect(src).not.toMatch(/in a row/i);
  });
});
