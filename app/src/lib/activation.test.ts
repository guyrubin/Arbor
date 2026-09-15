import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * N1-03 — the activation definition, which is the deliverable; the count
 * follows from it.
 *
 * The failure mode this file exists to prevent is not a crash. It is a number
 * that flatters: counting a loop completed INSIDE the onboarding session would
 * roughly double "activated families" and would measure onboarding twice
 * (critic C10). So the day-0 / day-1 / day-7 / day-8 boundaries are tested as
 * a table, with the same-day case as a named negative control, and the
 * definition string is asserted to describe what the code actually does.
 *
 * The second failure mode is a firewall breach by the back door (critic C11):
 * activation is a RATE, and a rate on a parent surface is a Law 1 violation.
 * The import scan at the bottom is that guard.
 */

const trackSpy = vi.hoisted(() => vi.fn());
vi.mock("./analytics", () => ({ track: trackSpy }));

import {
  ACTIVATION_DEFINITION,
  ACTIVATION_LOOP_EVENTS,
  ACTIVATION_STAMP_KEY,
  ACTIVATION_WINDOW_DAYS,
  activationCohort,
  evaluateActivation,
  hasReportedActivation,
  maybeReportActivation,
  reportActivation,
  type ActivationEvent,
} from "./activation";

const DAY = 86_400_000;
const T0 = Date.parse("2026-09-01T09:00:00Z");

const onboarded = (at = T0): ActivationEvent => ({ event: "onboarding_completed", at });
const loop = (event: string, dayOffset: number, hour = 10): ActivationEvent => ({
  event,
  at: T0 + dayOffset * DAY + (hour - 9) * 3_600_000,
});

/** Map-backed localStorage of the recapEmail opt-in shape. */
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

const calls = (name: string) =>
  (trackSpy.mock.calls as [string, Record<string, unknown>?][]).filter((c) => c[0] === name);

describe("N1-03 — the definition, as a boundary table", () => {
  const cases: { day: number | null; expected: boolean; why: string }[] = [
    { day: null, expected: false, why: "no loop at all — onboarding only" },
    { day: 0, expected: false, why: "SAME DAY: this is onboarding, not a return" },
    { day: 1, expected: true, why: "the first later day — the definition's floor" },
    { day: 2, expected: true, why: "inside the window" },
    { day: 7, expected: true, why: "the window's last day, inclusive" },
    { day: 8, expected: false, why: "past the window — that is retention, not activation" },
    { day: 30, expected: false, why: "far past the window" },
  ];

  for (const c of cases) {
    it(`day ${c.day ?? "—"} → activated: ${c.expected} (${c.why})`, () => {
      const events = [onboarded(), ...(c.day === null ? [] : [loop("capture_saved", c.day)])];
      const verdict = evaluateActivation(events);
      expect(verdict.activated).toBe(c.expected);
      expect(verdict.dayOffset).toBe(c.expected ? c.day : null);
      expect(verdict.via).toBe(c.expected ? "capture_saved" : null);
      // Eligible either way: onboarding completed, so this family is in the
      // denominator. A count without its denominator is unusable.
      expect(verdict.eligible).toBe(true);
    });
  }

  it("day-0 account: no onboarding → not activated AND not in the denominator", () => {
    const verdict = evaluateActivation([loop("capture_saved", 3)]);
    expect(verdict).toEqual({ activated: false, dayOffset: null, via: null, eligible: false });
  });

  it("every qualifying event name activates, and reports itself as `via`", () => {
    for (const name of ACTIVATION_LOOP_EVENTS) {
      const verdict = evaluateActivation([onboarded(), loop(name, 2)]);
      expect(verdict.activated).toBe(true);
      expect(verdict.via).toBe(name);
    }
  });

  it("NEGATIVE CONTROL: opening the app is not activation", () => {
    for (const name of ["session_open", "app_open", "bell_open", "sincevisit_shown"]) {
      expect(evaluateActivation([onboarded(), loop(name, 2)]).activated).toBe(false);
    }
  });

  it("the EARLIEST qualifying return is the one reported", () => {
    const verdict = evaluateActivation([
      onboarded(),
      loop("today_action_outcome", 5),
      loop("keep_this", 2),
      loop("capture_saved", 6),
    ]);
    expect(verdict.dayOffset).toBe(2);
    expect(verdict.via).toBe("keep_this");
  });

  it("a re-run of setup does not reset the clock", () => {
    const verdict = evaluateActivation([
      onboarded(T0),
      onboarded(T0 + 4 * DAY), // the parent went through setup again
      loop("capture_saved", 2),
    ]);
    expect(verdict.dayOffset).toBe(2);
  });

  it("local days are the PARENT's days, not UTC's", () => {
    // 23:30 UTC on day 0 is already day 1 in a +02:00 family's evening.
    const late: ActivationEvent = { event: "capture_saved", at: Date.parse("2026-09-01T23:30:00Z") };
    expect(evaluateActivation([onboarded(), late], 0).activated).toBe(false);
    expect(evaluateActivation([onboarded(), late], 120).activated).toBe(true);
  });

  it("an unparseable timestamp is dropped, never counted as day 0 or day 1", () => {
    const junk: ActivationEvent = { event: "capture_saved", at: "not a date" };
    expect(evaluateActivation([onboarded(), junk]).activated).toBe(false);
    expect(evaluateActivation([{ event: "onboarding_completed", at: "nope" }, loop("keep_this", 2)]).eligible).toBe(
      false,
    );
  });

  it("the printed definition describes what the code does", () => {
    expect(ACTIVATION_WINDOW_DAYS).toBe(7);
    for (const name of ACTIVATION_LOOP_EVENTS) expect(ACTIVATION_DEFINITION).toContain(name);
    expect(ACTIVATION_DEFINITION).toContain("later local day");
    expect(ACTIVATION_DEFINITION).toContain(String(ACTIVATION_WINDOW_DAYS));
    expect(ACTIVATION_DEFINITION).toContain("onboarding_completed");
  });
});

describe("N1-03 — `activated` fires at most once per family", () => {
  beforeEach(() => trackSpy.mockClear());

  it("emits once with day_offset + via, and stamps the account", () => {
    const store = fakeStorage();
    const verdict = maybeReportActivation("acct-1", [onboarded(), loop("capture_saved", 2)], {
      storage: store,
    });
    expect(verdict.activated).toBe(true);
    expect(calls("activated")).toHaveLength(1);
    expect(calls("activated")[0][1]).toEqual({ day_offset: 2, via: "capture_saved" });
    expect(hasReportedActivation("acct-1", store)).toBe(true);
    expect(JSON.parse(store.map.get(ACTIVATION_STAMP_KEY) ?? "{}")).toEqual({ "acct-1": true });
  });

  it("NEGATIVE CONTROL: a second qualifying event does not emit a second `activated`", () => {
    const store = fakeStorage();
    maybeReportActivation("acct-1", [onboarded(), loop("capture_saved", 2)], { storage: store });
    trackSpy.mockClear();
    maybeReportActivation("acct-1", [onboarded(), loop("capture_saved", 2), loop("keep_this", 3)], {
      storage: store,
    });
    maybeReportActivation("acct-1", [onboarded(), loop("today_action_accepted", 4)], { storage: store });
    expect(calls("activated")).toHaveLength(0);
  });

  it("a different account is a different family", () => {
    const store = fakeStorage();
    maybeReportActivation("acct-1", [onboarded(), loop("capture_saved", 2)], { storage: store });
    maybeReportActivation("acct-2", [onboarded(), loop("capture_saved", 3)], { storage: store });
    expect(calls("activated")).toHaveLength(2);
  });

  it("NEGATIVE CONTROL: a non-activated family emits nothing", () => {
    const store = fakeStorage();
    maybeReportActivation("acct-1", [onboarded(), loop("capture_saved", 0)], { storage: store });
    maybeReportActivation("acct-2", [onboarded()], { storage: store });
    maybeReportActivation("acct-3", [], { storage: store });
    expect(trackSpy).not.toHaveBeenCalled();
  });

  it("blocked storage still reports the family (and says so by not deduping)", () => {
    const verdict = evaluateActivation([onboarded(), loop("keep_this", 1)]);
    expect(reportActivation("acct-1", verdict, null)).toBe(true);
    expect(reportActivation("acct-1", verdict, null)).toBe(true);
    expect(calls("activated")).toHaveLength(2);
  });

  it("the payload is a count and an event name — nothing else", () => {
    const store = fakeStorage();
    maybeReportActivation("acct-1", [onboarded(), loop("keep_this", 1)], { storage: store });
    const props = calls("activated")[0][1] as Record<string, unknown>;
    expect(Object.keys(props).sort()).toEqual(["day_offset", "via"]);
    expect(typeof props.day_offset).toBe("number");
    expect(JSON.stringify(props)).not.toContain("acct-1");
  });
});

describe("N1-03 — the cohort reports a count AND a denominator", () => {
  it("counts activated families against families that could have activated", () => {
    const report = activationCohort([
      { events: [onboarded(), loop("capture_saved", 2)] }, // activated
      { events: [onboarded(), loop("capture_saved", 0)] }, // same-day only
      { events: [onboarded()] }, // eligible, not activated
      { events: [loop("capture_saved", 2)] }, // never onboarded — not eligible
    ]);
    expect(report).toEqual({ activated: 1, eligible: 3, definition: ACTIVATION_DEFINITION });
  });

  it("an empty cohort reports zeros, never a rate", () => {
    const report = activationCohort([]);
    expect(report.activated).toBe(0);
    expect(report.eligible).toBe(0);
    expect(JSON.stringify(report)).not.toContain("%");
  });
});

describe("N1-03 — Law 1: activation is never rendered to a parent (critic C11)", () => {
  const SRC = path.resolve(__dirname, "..");

  const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
  };

  it("ZERO files under components/ import lib/activation", () => {
    const components = walk(path.join(SRC, "components"));
    // The scan must actually see files — a vacuous pass is not a pass.
    expect(components.length).toBeGreaterThan(100);
    const importers = components.filter((f) =>
      /from\s+["'][^"']*\/activation["']/.test(fs.readFileSync(f, "utf8")),
    );
    expect(importers).toEqual([]);
  });

  it("the module renders nothing: no JSX, no copy, no percentage", () => {
    const src = fs.readFileSync(path.join(SRC, "lib", "activation.ts"), "utf8");
    // A .ts module cannot carry JSX; what it must also not do is reach for
    // React or a component, which is how a metric becomes a card.
    expect(src).not.toMatch(/from "react"|\.\.\/components/);
    expect(src).not.toContain("useLanguage");
    // A percentage anywhere in this module is one careless import from a card.
    expect(src.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/%|toFixed|Math\.round\([^)]*100/);
  });
});
