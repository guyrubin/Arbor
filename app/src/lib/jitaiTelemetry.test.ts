/* ENG-11 — the JITAI cue is measured, and measurement leaks nothing.
 *
 * The engine may spend TWO cues a day. Which cue earns a slot was being
 * decided blind: nothing recorded a cue being shown, and nothing recorded the
 * parent taking it. (growth/jitaiPrefs.recordNudgeShown is the CEILING's
 * ledger — device-local, never telemetry.) These tests pin both halves: the
 * events exist, and their props are an allow-list projection that cannot leak
 * the child's name, the cue's interpolated copy, or anything about the child.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const trackSpy = vi.fn();
vi.mock("./analytics", () => ({ track: (...args: unknown[]) => trackSpy(...args) }));

import {
  NUDGE_ACTED_EVENT,
  NUDGE_DISMISSED_EVENT,
  NUDGE_SHOWN_EVENT,
  nudgeEventProps,
  trackNudgeActed,
  trackNudgeDismissed,
  trackNudgeShown,
} from "./jitaiTelemetry";
import type { Nudge } from "./jitai";
import { ROUTE_IDS } from "./routes";

const bedtimeCue: Nudge = {
  kind: "bedtime",
  headlineKey: "elev.evening.nudge.headline",
  bodyKey: "elev.evening.nudge.body",
  ctaKey: "elev.evening.nudge.cta",
  vars: { name: "Dylan", hour: "6:00 pm" },
  action: "bedtime-stories",
  tone: "lav",
};

beforeEach(() => trackSpy.mockClear());

describe("ENG-11 — nudge telemetry exists at all", () => {
  it("shown / acted / dismissed each emit one event with a stable name", () => {
    trackNudgeShown(bedtimeCue, "coach", new Date(2026, 8, 4, 19).getTime());
    trackNudgeActed(bedtimeCue, "coach", new Date(2026, 8, 4, 19).getTime());
    trackNudgeDismissed(bedtimeCue, "coach", new Date(2026, 8, 4, 19).getTime());
    expect(trackSpy.mock.calls.map((c) => c[0])).toEqual([
      NUDGE_SHOWN_EVENT,
      NUDGE_ACTED_EVENT,
      NUDGE_DISMISSED_EVENT,
    ]);
    expect(NUDGE_SHOWN_EVENT).toBe("jitai_nudge_shown");
    expect(NUDGE_ACTED_EVENT).toBe("jitai_nudge_acted");
  });

  it("records the cue, its destination, the surface and the day part", () => {
    const props = nudgeEventProps(bedtimeCue, "coach", 19);
    expect(props.nudge_kind).toBe("bedtime");
    expect(props.nudge_action).toBe("bedtime-stories");
    expect(props.surface).toBe("coach");
    expect(props.day_part).toBe("evening");
    // the destination is always a real route (ENG-01 holds through telemetry)
    expect(new Set<string>(ROUTE_IDS).has(props.nudge_action)).toBe(true);
    // afternoon/morning derive from the injected hour, not from Date.now()
    expect(nudgeEventProps(bedtimeCue, "bell", 14).day_part).toBe("afternoon");
    expect(nudgeEventProps(bedtimeCue, "bell", 8).day_part).toBe("morning");
  });
});

describe("ENG-11 — clinical firewall / privacy on the wire", () => {
  const PROP_ALLOW_LIST = ["nudge_kind", "nudge_action", "surface", "day_part"];

  it("emits ONLY the allow-listed keys — never vars, never the child's name", () => {
    const props = nudgeEventProps(bedtimeCue, "coach", 19);
    expect(Object.keys(props).sort()).toEqual([...PROP_ALLOW_LIST].sort());
    expect(JSON.stringify(props)).not.toContain("Dylan");
    expect(JSON.stringify(props)).not.toContain("6:00 pm");
  });

  it("NEGATIVE CONTROL — a spread of the nudge (the shape one reaches for first) DOES leak", () => {
    const spread = { ...bedtimeCue, surface: "coach" };
    expect(JSON.stringify(spread)).toContain("Dylan");
    // …and the projection under test rejects exactly that.
    expect(JSON.stringify(nudgeEventProps(bedtimeCue, "coach", 19))).not.toContain("Dylan");
  });

  it("a field added to Nudge later cannot ride along by default", () => {
    const withNewField = { ...bedtimeCue, riskLevel: "elevated", childNotes: "hit sibling" } as unknown as Nudge;
    const json = JSON.stringify(nudgeEventProps(withNewField, "coach", 19));
    expect(json).not.toContain("riskLevel");
    expect(json).not.toContain("elevated");
    expect(json).not.toContain("hit sibling");
  });
});
