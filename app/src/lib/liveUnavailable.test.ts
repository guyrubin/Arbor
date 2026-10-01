/**
 * B-PROV-06 — Live "closed before open" becomes a counted event (the balance
 * alarm). One event per failed attempt, closed enum, no text; Kid Mode never
 * emits.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const calls = vi.hoisted(() => ({ track: [] as Array<[string, Record<string, unknown>]>, kid: false }));
vi.mock("./analytics", () => ({ track: (e: string, p: Record<string, unknown>) => calls.track.push([e, p]) }));
vi.mock("./kidModeGate", () => ({ isKidModeActive: () => calls.kid }));

import { KpiEvent, LIVE_UNAVAILABLE_REASONS, liveUnavailableReason, trackLiveUnavailable, UNKNOWN_ID } from "./kpiEvents";
// Same banned prop names as analyticsProps.guard.test.ts (prose carriers).
const BANNED_PROP_NAMES = ["title", "text", "note", "summary", "name", "transcript"] as const;

beforeEach(() => {
  calls.track.length = 0;
  calls.kid = false;
});

describe("B-PROV-06 — the reason classifier", () => {
  it("maps the Live client's rejections to the closed enum", () => {
    expect(liveUnavailableReason(new Error("live-closed-before-open"), "socket")).toBe("closed_before_open");
    expect(liveUnavailableReason(new Error("live-closed-during-start"), "socket")).toBe("closed_during_start");
    expect(liveUnavailableReason(new Error("HTTP 503"), "mint")).toBe("token_error");
  });

  it("other start failures are not availability signals (no event)", () => {
    expect(liveUnavailableReason(new Error("Gemini Live error"), "socket")).toBeNull();
    expect(liveUnavailableReason("weird", "socket")).toBeNull();
  });
});

describe("B-PROV-06 — the event", () => {
  it("emits live_unavailable {reason} only — no text, off-list values degrade", () => {
    trackLiveUnavailable("closed_before_open");
    trackLiveUnavailable("Noa's socket closed at 7pm");
    expect(calls.track).toEqual([
      [KpiEvent.LiveUnavailable, { reason: "closed_before_open" }],
      [KpiEvent.LiveUnavailable, { reason: UNKNOWN_ID }],
    ]);
    expect([...LIVE_UNAVAILABLE_REASONS]).toEqual(["closed_before_open", "closed_during_start", "token_error"]);
    for (const [, props] of calls.track) {
      for (const banned of BANNED_PROP_NAMES) expect(props).not.toHaveProperty(banned);
    }
  });

  it("Kid Mode never emits (kid egress gate)", () => {
    calls.kid = true;
    trackLiveUnavailable("closed_before_open");
    expect(calls.track).toEqual([]);
  });
});

describe("B-PROV-06 — CoachTab emits exactly one event per failed attempt", () => {
  const coach = readFileSync(path.join(__dirname, "..", "components", "tabs", "CoachTab.tsx"), "utf8");
  const start = coach.indexOf("const toggleVoice = async () => {");
  const body = coach.slice(start, coach.indexOf("startBrowserVoice();\n  };", start));

  it("one emit on the unavailable-token branch and one on the catch fallback, nowhere else", () => {
    expect((body.match(/trackLiveUnavailable\(/g) ?? []).length).toBe(2);
    expect(body).toMatch(/if \(!\(fresh\.available && fresh\.token && fresh\.model\)\) trackLiveUnavailable\("token_error"\);/);
    expect(body).toMatch(/const unavailable = liveUnavailableReason\(err, liveStage\);\s*if \(unavailable\) trackLiveUnavailable\(unavailable\);/);
    // The two branches are exclusive: the first falls through without
    // throwing, the second is the catch — so one attempt, one event.
    expect(body.indexOf('trackLiveUnavailable("token_error")')).toBeLessThan(body.indexOf("} catch (err) {"));
    expect(body.indexOf("liveUnavailableReason(err, liveStage)")).toBeGreaterThan(body.indexOf("} catch (err) {"));
  });

  it("refusals the parent is already told about return before the emit", () => {
    const catchBlock = body.slice(body.indexOf("} catch (err) {"));
    const emitAt = catchBlock.indexOf("liveUnavailableReason(err, liveStage)");
    for (const early of ["err instanceof PaywallError", "err.status === 429 || err.status === 451", '"NotAllowedError"']) {
      expect(catchBlock.indexOf(early)).toBeGreaterThan(-1);
      expect(catchBlock.indexOf(early)).toBeLessThan(emitAt);
    }
  });
});
