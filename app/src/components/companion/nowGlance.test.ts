import { describe, expect, it } from "vitest";
import type { Appointment } from "../../lib/careTrack";
import type { Observation, ObservationKind, ObservationSource } from "../../lib/observations";
import { daysUntil, lastPastVisitMs, momentsSinceLastVisit, planDay, storyInProgress } from "./nowGlance";
import { NOW_COPY } from "./nowViewCopy";

/**
 * v3 F-NOW-2 — the pure reads behind Now's "Today at a glance" rows. Each one
 * returns a date or a count (never a ratio, a score or a verdict about the
 * child), and each is null when there is nothing honest to say. Invented
 * examples only (the repo is public).
 */
const NOW = new Date(2026, 9, 12, 9, 0);
const local = (day: number, hour = 10) => `2026-10-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00`;
const appt = (id: string, whenIso: string | undefined, status?: Appointment["status"]): Appointment => ({ id, who: "Dr. Example", role: "Pediatrician", when: "", mode: "in person", whenIso, status });
const obs = (id: string, at: string, kind: ObservationKind = "moment", source: ObservationSource = "parent_typed"): Observation => ({
  id: `behaviorLogs:${id}`,
  childId: "child-a",
  at,
  domains: [],
  kind,
  value: { type: "moment", behaviorType: "play" },
  source,
  origin: "behaviorLogs",
  ageAtObservationMonths: 40,
  pretermCorrected: false,
});

describe("v3 F-NOW-2 — daysUntil (the visit row's 'Today' / 'In N days')", () => {
  it("counts whole local days, 0 for today, whatever the hour", () => {
    expect(daysUntil(local(12, 16), NOW)).toBe(0);
    expect(daysUntil(local(12, 8), NOW)).toBe(0);
    expect(daysUntil(local(13, 8), NOW)).toBe(1);
    expect(daysUntil(local(14, 18), NOW)).toBe(2);
  });
  it("is null for a missing or unreadable date, never NaN", () => {
    expect(daysUntil(undefined, NOW)).toBeNull();
    expect(daysUntil("next week", NOW)).toBeNull();
    expect(daysUntil(local(14), new Date(Number.NaN))).toBeNull();
  });
});

describe("v3 F-NOW-2 — moments since the last visit (a count, never 'n of m')", () => {
  const appointments = [
    appt("past-done", local(1), "done"),
    appt("asked-for", local(8), "requested"),
    appt("undated", undefined),
    appt("upcoming", local(14), "confirmed"),
  ];
  const observations = [
    obs("before", local(1, 8)),
    obs("a", local(3)),
    obs("b", local(9)),
    obs("c", local(11, 20), "moment", "parent_voice"),
    obs("kid", local(10), "moment", "kid_practice"),
    obs("first", local(10), "milestone"),
    obs("later", local(13)),
  ];

  it("the last visit is the newest dated one that already took place: never a requested one, never the upcoming one", () => {
    expect(lastPastVisitMs(appointments, NOW, "upcoming")).toBe(Date.parse(local(1)));
    expect(lastPastVisitMs([...appointments, appt("yesterday", local(11), "confirmed")], NOW, "yesterday")).toBe(Date.parse(local(1)));
    expect(lastPastVisitMs([...appointments, appt("yesterday", local(11), "confirmed")], NOW, "upcoming")).toBe(Date.parse(local(11)));
  });

  it("counts only the parent's own moments kept after it, up to now", () => {
    expect(momentsSinceLastVisit({ appointments, visitId: "upcoming", observations, now: NOW })).toBe(3);
  });

  it("is null when there was no earlier visit to count from (the row then shows the date alone)", () => {
    const none = [appt("asked-for", local(8), "requested"), appt("upcoming", local(14), "confirmed")];
    expect(momentsSinceLastVisit({ appointments: none, visitId: "upcoming", observations, now: NOW })).toBeNull();
    expect(momentsSinceLastVisit({ appointments: [], observations, now: NOW })).toBeNull();
  });

  it("the row it feeds reads as a date and a count in both languages, never a ratio or a percent", () => {
    for (const lang of ["en", "he"] as const) {
      const line = NOW_COPY[lang].visitLine(2, 3);
      expect(line).toContain("3");
      expect(line).not.toMatch(/%|\d+\s*\/\s*\d+|\bof\b/);
      expect(NOW_COPY[lang].visitLine(0, null)).not.toMatch(/\d/);
    }
  });
});

describe("v3 F-NOW-2 — storyInProgress (Tonight's 'continue the story' row)", () => {
  const run = (id: string, startedAt: string, completedAt?: string) => ({ id, startedAt, completedAt });

  it("picks the newest story started this week and not yet finished", () => {
    const runs = [
      run("older", local(10, 19)),
      run("finished", local(11, 19), local(11, 20)),
      run("newest", local(11, 18)),
      run("long-ago", local(2, 19)),
      run("future", local(13, 19)),
      run("broken", "someday"),
    ];
    expect(storyInProgress(runs, NOW)?.id).toBe("newest");
  });

  it("is null when every story was finished, was started more than a week ago, or none exists", () => {
    expect(storyInProgress([run("done", local(11), local(11, 11))], NOW)).toBeNull();
    expect(storyInProgress([run("stale", local(4, 8))], NOW)).toBeNull();
    expect(storyInProgress([], NOW)).toBeNull();
  });
});

describe("v3 F-NOW-2 — planDay ('Plan · day N' in the lead's meta)", () => {
  it("day 1 is the start day; it counts calendar days, not hours", () => {
    expect(planDay({ startedAt: "2026-10-12" }, NOW)).toBe(1);
    expect(planDay({ startedAt: "2026-10-12T23:30:00.000Z" }, NOW)).toBe(1);
    expect(planDay({ startedAt: "2026-10-05" }, NOW)).toBe(8);
  });

  it("a paused plan stops counting on the pause day; a pause with no date counts to today", () => {
    expect(planDay({ startedAt: "2026-10-01", status: "paused", pausedAt: "2026-10-04T12:00:00.000Z" }, NOW)).toBe(4);
    expect(planDay({ startedAt: "2026-10-01", status: "paused" }, NOW)).toBe(12);
    expect(planDay({ startedAt: "2026-10-01", status: "active", pausedAt: "2026-10-04" }, NOW)).toBe(12);
  });

  it("is null for an unreadable start or a start still ahead", () => {
    expect(planDay({ startedAt: "soon" }, NOW)).toBeNull();
    expect(planDay({ startedAt: "2026-10-20" }, NOW)).toBeNull();
  });
});
