import { describe, expect, it } from "vitest";
import {
  CRITICAL_HELPLINE_LITERALS,
  escalationLiteralsIntact,
  HELPLINE_REVIEW_INTERVAL_DAYS,
  HELPLINES_REVIEWED_ON,
  helplineReviewStatus,
} from "./escalation";

/* CI-05 — crisis-number currency hook. The mechanism must (a) flag an overdue
 * review (fail-loud) and (b) catch a dropped crisis literal. Deterministic:
 * uses fixed dates, never Date.now(), so CI is stable. The real-time fail-loud
 * runs in the scheduled arbor-safety job. */

const DAY = 86_400_000;
const reviewedMs = Date.parse(HELPLINES_REVIEWED_ON);

describe("CI-05 escalation currency hook", () => {
  it("is fresh right after review", () => {
    expect(helplineReviewStatus(reviewedMs + DAY).stale).toBe(false);
  });

  it("FAILS LOUD once the review interval is exceeded", () => {
    const overdue = helplineReviewStatus(reviewedMs + (HELPLINE_REVIEW_INTERVAL_DAYS + 1) * DAY);
    expect(overdue.stale).toBe(true);
    expect(overdue.daysSince).toBeGreaterThan(HELPLINE_REVIEW_INTERVAL_DAYS);
  });

  it("is not stale exactly at the interval boundary", () => {
    expect(helplineReviewStatus(reviewedMs + HELPLINE_REVIEW_INTERVAL_DAYS * DAY).stale).toBe(false);
  });

  it("every critical crisis literal is still present in the live copy", () => {
    expect(escalationLiteralsIntact()).toBe(true);
  });

  it("tracks the canonical crisis numbers (112 EU, 988 US, 113 NL, 101 IL)", () => {
    for (const lit of ["112", "988", "0800-0113", "101"]) {
      expect(CRITICAL_HELPLINE_LITERALS).toContain(lit);
    }
  });
});
