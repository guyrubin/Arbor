import { describe, expect, it } from "vitest";
import {
  CRITICAL_HELPLINE_LITERALS,
  escalationLiteralsIntact,
  HELPLINE_REVIEW_INTERVAL_DAYS,
  HELPLINE_REVIEW_WARN_DAYS,
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

  it("reports the days remaining until the review is due (negative once overdue)", () => {
    expect(helplineReviewStatus(reviewedMs + DAY).daysRemaining).toBe(HELPLINE_REVIEW_INTERVAL_DAYS - 1);
    expect(helplineReviewStatus(reviewedMs + (HELPLINE_REVIEW_INTERVAL_DAYS + 3) * DAY).daysRemaining).toBe(-3);
  });
});

/* LC-15 — the REAL-clock tripwire. The "scheduled arbor-safety job" this hook
 * was designed for has never run; the only run that reliably happens is CI.
 * So the staleness check runs here against Date.now(): the December 2026
 * expiry of HELPLINES_REVIEWED_ON fails a real suite run, and a 14-day early
 * warning is printed so the re-review is scheduled before the failure lands.
 * Fixing a red run = re-verify every number against its national registry,
 * then bump HELPLINES_REVIEWED_ON (never widen the interval). */
describe("LC-15 — crisis numbers were re-verified within the interval (real clock)", () => {
  it("HELPLINES_REVIEWED_ON is within HELPLINE_REVIEW_INTERVAL_DAYS of today", () => {
    const status = helplineReviewStatus(Date.now());
    if (!status.stale && status.daysRemaining <= HELPLINE_REVIEW_WARN_DAYS) {
      console.warn(
        `[arbor-safety] crisis helpline review due in ${status.daysRemaining} day(s): ` +
          `re-verify every HELPLINE_DIRECTORY number and bump HELPLINES_REVIEWED_ON (${status.reviewedOn}).`,
      );
    }
    expect(
      status.stale,
      `crisis helpline numbers last verified ${status.reviewedOn} (${status.daysSince} days ago) — re-verify and bump HELPLINES_REVIEWED_ON`,
    ).toBe(false);
  });

  it("the early-warning window is 14 days and sits inside the interval", () => {
    expect(HELPLINE_REVIEW_WARN_DAYS).toBe(14);
    expect(HELPLINE_REVIEW_WARN_DAYS).toBeLessThan(HELPLINE_REVIEW_INTERVAL_DAYS);
  });
});
