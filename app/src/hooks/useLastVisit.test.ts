import { describe, it, expect } from "vitest";
import { computeVisitTransition, VISIT_GAP_MS, VISIT_BUMP_MIN_MS } from "./useLastVisit";

/**
 * W1 1.1 — two-slot visit tracking, pure transition (masterplan 2026-08-11 §3).
 *
 * The contract under test:
 *   - first-ever open establishes the current slot ONLY (previous = null, and
 *     the patch must NOT carry an undefined lastVisitPreviousAt — Firestore's
 *     updateDoc throws on undefined field values),
 *   - a refresh / quick reopen (< 30 min) is NOT a new visit: slots never
 *     rotate, and within 60s nothing is even written (StrictMode double-mount
 *     writes zero),
 *   - a 30+ min gap IS a new visit: the old current slot becomes the previous
 *     visit (two slots — the stamp never overwrites what the strip reads).
 */

const T0 = Date.parse("2026-08-11T08:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

describe("computeVisitTransition — first visit", () => {
  it("no slots at all → previous null, patch stamps the current slot only", () => {
    const r = computeVisitTransition(undefined, undefined, T0);
    expect(r.previousVisitAt).toBeNull();
    expect(r.patch).toEqual({ lastVisitAt: iso(T0) });
    // Firestore updateDoc throws on undefined values — the key must be ABSENT.
    expect(Object.prototype.hasOwnProperty.call(r.patch, "lastVisitPreviousAt")).toBe(false);
  });

  it("corrupt current slot → treated as a first visit", () => {
    const r = computeVisitTransition(undefined, "not-a-date", T0);
    expect(r.previousVisitAt).toBeNull();
    expect(r.patch).toEqual({ lastVisitAt: iso(T0) });
  });
});

describe("computeVisitTransition — same visit (30-min debounce)", () => {
  it("a tab refresh 10s later writes NOTHING and rotates nothing", () => {
    const curr = iso(T0);
    const r = computeVisitTransition(undefined, curr, T0 + 10_000);
    expect(r.patch).toBeNull();
    expect(r.previousVisitAt).toBeNull(); // first session — nothing to report
  });

  it("a reopen 10 min later bumps the current slot but keeps the previous slot", () => {
    const prev = iso(T0 - 2 * 86_400_000); // the visit 2 days ago
    const curr = iso(T0);
    const now = T0 + 10 * 60_000;
    const r = computeVisitTransition(prev, curr, now);
    expect(r.previousVisitAt).toBe(prev); // strip still anchors on the real prior visit
    expect(r.patch).toEqual({ lastVisitAt: iso(now) }); // no rotation
  });

  it("within the 60s bump floor nothing is written (StrictMode double-mount)", () => {
    const prev = iso(T0 - 86_400_000);
    const curr = iso(T0);
    const r = computeVisitTransition(prev, curr, T0 + VISIT_BUMP_MIN_MS - 1);
    expect(r.patch).toBeNull();
    expect(r.previousVisitAt).toBe(prev);
  });

  it("a garbled previous slot inside the same visit reports no prior visit", () => {
    const r = computeVisitTransition("garbage", iso(T0), T0 + 5 * 60_000);
    expect(r.previousVisitAt).toBeNull();
  });

  it("clock skew (current slot in the future) is same-visit, not a rotation", () => {
    const prev = iso(T0 - 86_400_000);
    const curr = iso(T0 + 5 * 60_000); // written by a fast device clock
    const r = computeVisitTransition(prev, curr, T0);
    expect(r.previousVisitAt).toBe(prev);
    expect(r.patch).toBeNull();
  });
});

describe("computeVisitTransition — new visit (rotation)", () => {
  it("a 31-min gap rotates: previous ← current, current ← now", () => {
    const prevOld = iso(T0 - 3 * 86_400_000);
    const curr = iso(T0);
    const now = T0 + 31 * 60_000;
    const r = computeVisitTransition(prevOld, curr, now);
    expect(r.previousVisitAt).toBe(curr); // the strip anchors on the LAST visit
    expect(r.patch).toEqual({ lastVisitAt: iso(now), lastVisitPreviousAt: curr });
  });

  it("exactly the 30-min boundary counts as a new visit (>= gap)", () => {
    const curr = iso(T0);
    const r = computeVisitTransition(undefined, curr, T0 + VISIT_GAP_MS);
    expect(r.previousVisitAt).toBe(curr);
    expect(r.patch?.lastVisitPreviousAt).toBe(curr);
  });

  it("second-ever visit (no previous slot yet) still reports the first visit", () => {
    const curr = iso(T0);
    const r = computeVisitTransition(undefined, curr, T0 + 2 * 86_400_000);
    expect(r.previousVisitAt).toBe(curr);
  });
});
