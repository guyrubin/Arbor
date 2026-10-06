import { describe, expect, it } from "vitest";
import { programById } from "../../content/programs";
import { ALL_MILESTONES } from "../milestoneData";
import type { ActionLoopEntry } from "../../actionLoop/model";
import type { Milestone, SleepLogEntry } from "../../types";
import {
  activeEnrolment, activeProgramWeek, captureBaseline, chooserProgram, enrolInProgram, finishEnrolment, pauseEnrolment, programWeekAt,
  resumeEnrolment, setEnrolmentNote, syncCurrentWeek, type ProgramEnrolment,
} from "./enrolment";
import { doseDays, programWeekDays, programWeekMeasures, turnsWaitedWeek } from "./measures";
import { programWatchForPicks, selectNoticeWithProgram } from "./notice";
import { selectNextMilestonesByShelf } from "../milestones/selectByShelf";

/* B-PROG-01 — the engine seams session A's program page (B-PROG-05) wires:
   enrol / pause / resume / finish (one active program per child), the week
   schedule, the measures accessors, and the Notice-today hook. Pure. */

const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h, 0);
const TT = programById("talk-together")!;
const SN = programById("steady-nights")!;

const enrol = (programId: string, now: Date, rows: unknown[] = []): ProgramEnrolment => {
  const r = enrolInProgram(rows, programId, now);
  if (!r.ok) throw new Error(r.reason);
  return r.enrolment;
};

describe("B-PROG-01 — enrolment", () => {
  it("enrols today: week 1, active, empty baseline, local start day, stable id", () => {
    const e = enrol("talk-together", at(2026, 10, 6, 23));
    expect(e).toMatchObject({ id: "talk-together.2026-10-06", programId: "talk-together", startedAt: "2026-10-06", currentWeek: 1, status: "active", baseline: { childProxy: null, capturedAt: null } });
    expect(enrolInProgram([], "nope", at(2026, 10, 6))).toEqual({ ok: false, reason: "unknown_program" });
  });

  it("ONE active program per child: a second enrolment is refused while one is active", () => {
    const tt = enrol("talk-together", at(2026, 10, 6));
    const r = enrolInProgram([tt], "steady-nights", at(2026, 10, 7));
    expect(r).toMatchObject({ ok: false, reason: "already_active", active: { id: tt.id } });
    expect(enrolInProgram([tt], "talk-together", at(2026, 10, 7))).toMatchObject({ ok: false, reason: "already_active" });
    // after a pause, another program may start; the paused one stays paused
    const paused = pauseEnrolment(tt, at(2026, 10, 8));
    expect(enrolInProgram([paused], "steady-nights", at(2026, 10, 8)).ok).toBe(true);
    // a malformed or unknown row never counts as active
    expect(activeEnrolment([{ programId: "x", startedAt: "2026-10-01", status: "active" }, { programId: "talk-together", startedAt: "bad", status: "active" }, null])).toBeNull();
  });

  it("the week advances by the calendar while active and clamps to the program's weeks", () => {
    const e = enrol("talk-together", at(2026, 10, 6));
    expect(programWeekAt(e, TT, at(2026, 10, 12))).toBe(1);
    expect(programWeekAt(e, TT, at(2026, 10, 13))).toBe(2);
    expect(programWeekAt(e, TT, at(2027, 6, 1))).toBe(TT.weeks.length);
    const synced = syncCurrentWeek(e, at(2026, 10, 20));
    expect(synced.currentWeek).toBe(3);
    expect(syncCurrentWeek(synced, at(2026, 10, 21))).toBe(synced); // unchanged → same object (no write)
  });

  it("pause freezes the week; resume comes back to the week the family left; resuming the same program via enrol resumes", () => {
    const e = enrol("talk-together", at(2026, 10, 6));
    const paused = pauseEnrolment(e, at(2026, 10, 15)); // week 2
    expect(paused).toMatchObject({ status: "paused", pausedAt: "2026-10-15", currentWeek: 2 });
    expect(programWeekAt(paused, TT, at(2026, 11, 30))).toBe(2);
    const r = enrolInProgram([paused], "talk-together", at(2026, 10, 29)); // 14 days later
    expect(r).toMatchObject({ ok: true, resumed: true, enrolment: { status: "active", startedAt: "2026-10-20" } });
    if (!r.ok) throw new Error("x");
    expect("pausedAt" in r.enrolment).toBe(false);
    expect(programWeekAt(r.enrolment, TT, at(2026, 10, 29))).toBe(2);
    // resume is refused while another program is active
    const sn = enrol("steady-nights", at(2026, 10, 16), [paused]);
    expect(resumeEnrolment([paused, sn], paused, at(2026, 10, 20))).toMatchObject({ ok: false, reason: "already_active" });
  });

  it("finish is final (from active or paused); baseline is captured once; notes are verbatim and removable", () => {
    const e = enrol("steady-nights", at(2026, 10, 6));
    const done = finishEnrolment(pauseEnrolment(e, at(2026, 10, 20)), at(2026, 10, 21));
    expect(done).toMatchObject({ status: "done", currentWeek: 3 });
    expect("pausedAt" in done).toBe(false);
    expect(finishEnrolment(done, at(2026, 12, 1))).toBe(done);
    expect(activeEnrolment([done])).toBeNull();
    const b = captureBaseline(e, 4, at(2026, 10, 13));
    expect(b.baseline).toMatchObject({ childProxy: 4 });
    expect(captureBaseline(b, 9, at(2026, 10, 20))).toBe(b);
    const n = setEnrolmentNote(e, "the-step-we-chose", "  one less song  ", at(2026, 10, 8));
    expect(n.notes).toEqual({ "the-step-we-chose": "one less song" });
    expect(setEnrolmentNote(n, "the-step-we-chose", " ", at(2026, 10, 9)).notes).toEqual({});
  });

  it("activeProgramWeek + chooserProgram give the chooser the current week's lists", () => {
    const e = enrol("talk-together", at(2026, 10, 6));
    const a = activeProgramWeek([e], at(2026, 10, 14))!;
    expect(a).toMatchObject({ week: 2, content: { n: 2 } });
    const c = chooserProgram(a)!;
    expect(c).toMatchObject({ programId: "talk-together", startedAt: "2026-10-06" });
    expect(c.weeks).toEqual(TT.weeks.map((w) => w.practices));
    expect(chooserProgram(null)).toBeNull();
    expect(activeProgramWeek([], at(2026, 10, 14))).toBeNull();
  });
});

describe("B-PROG-01 — measures", () => {
  const e = enrol("talk-together", at(2026, 10, 6));
  const dose = (day: string, extra: Partial<ActionLoopEntry> = {}): ActionLoopEntry => ({
    id: `practice.kid-1.${day}`, recommendation: "x", source: "practice", capacity: "tiny", status: "completed", acceptedAt: `${day}T08:00:00.000Z`, practiceId: "pr-cdc-15m-4", shelf: "words", ...extra,
  });

  it("week n = local days startedAt + 7(n−1) … startedAt + 7n − 1", () => {
    expect(programWeekDays(e, 1)).toEqual({ from: "2026-10-06", to: "2026-10-12" });
    expect(programWeekDays(e, 2)).toEqual({ from: "2026-10-13", to: "2026-10-19" });
  });

  it("dose = practice days in the week; Not today, another child and another week never count", () => {
    const rows = [dose("2026-10-06"), dose("2026-10-07", { outcome: "not_today" }), dose("2026-10-08"), dose("2026-10-13"), { ...dose("2026-10-09"), id: "practice.kid-2.2026-10-09" }];
    expect(doseDays(rows, "kid-1", e, 1)).toBe(2);
    expect(doseDays(rows, "kid-1", e, 2)).toBe(1);
  });

  it("Talk Together parent proxy: the sum of the parent's turn taps (5+ = 5) with the days it came from", () => {
    const rows = [dose("2026-10-06", { selfCount: 3 }), dose("2026-10-07", { selfCount: 9 }), dose("2026-10-08")];
    expect(turnsWaitedWeek(rows, "kid-1", e, 1)).toEqual({ turns: 8, days: 2 });
    const m = programWeekMeasures(e, 1, { childId: "kid-1", actionLoops: rows, observations: [
      { at: new Date(2026, 9, 7, 10).toISOString(), shelf: "words", value: { type: "word", language: "he", phrase: "בננה" } },
      { at: new Date(2026, 9, 7, 11).toISOString(), shelf: "words", value: { type: "fact", fact: "x" } },
      { at: new Date(2026, 9, 20, 11).toISOString(), shelf: "words", value: { type: "word", language: "he", phrase: "עוד" } },
    ] })!;
    expect(m).toMatchObject({ week: 1, dose: 3, parentProxy: { id: "turns-waited", value: 8, from: 2 }, childProxy: { id: "new-words", value: 1 } });
    expect(programWeekMeasures(e, 1, { childId: "kid-1" })).toMatchObject({ dose: null, parentProxy: null, childProxy: null });
  });

  it("Steady Nights: routine nights and the week's middle diary night from sleepLogs", () => {
    const sn = enrol("steady-nights", at(2026, 10, 6));
    const night = (date: string, bedtime: string, wake: string, routine?: SleepLogEntry["routine"]): SleepLogEntry => ({ date, bedtime, wake, ...(routine ? { routine } : {}), updatedAt: "t" });
    const logs = [night("2026-10-06", "20:00", "06:00", "done_in_order"), night("2026-10-07", "20:30", "06:00", "not_tonight"), night("2026-10-08", "21:00", "06:00", "done_in_order")];
    const m = programWeekMeasures(sn, 1, { childId: "kid-1", sleepLogs: logs, actionLoops: [] })!;
    expect(m.parentProxy).toEqual({ id: "routine-in-order", value: 2 });
    expect(m.childProxy).toEqual({ id: "longest-stretch", value: 9.5, from: 3 });
    expect(SN.measures.childProxy.id).toBe("longest-stretch");
  });
});

describe("B-PROG-01 — the Notice-today hook", () => {
  const NOW = at(2026, 10, 6, 7);
  const catalogue = (): Milestone[] => ALL_MILESTONES.map((m) => ({ ...m }));
  const week1 = { shelf: "words" as const, watchFor: TT.weeks[0].watchFor };

  it("the program's shelf is skipped by the selection; the week's in-window watch-for rows are served first", () => {
    const picks = selectNoticeWithProgram(catalogue(), 20, { perShelf: 1, total: 3, now: NOW, excludeShelves: ["words"] }, week1);
    const watch = picks.filter((p) => p.fromProgram);
    expect(watch.length).toBeGreaterThan(0);
    expect(watch.every((p) => week1.watchFor.includes(p.milestone.id) && p.shelf === "words")).toBe(true);
    expect(picks.slice(0, watch.length).every((p) => p.fromProgram)).toBe(true);
    expect(picks.filter((p) => !p.fromProgram).some((p) => p.shelf === "words")).toBe(false);
    expect(picks.length).toBeLessThanOrEqual(3);
  });

  it("never ahead of band and never a noticed row; a shelf answered today serves no watch-for until tomorrow", () => {
    // at 12 months both week-1 rows (15 m, 18 m) are ahead of band
    expect(programWatchForPicks(catalogue(), 12, week1, NOW)).toEqual([]);
    const noticed = catalogue().map((m) => (m.id === week1.watchFor[0] ? { ...m, checked: true, observationStatus: "yes" as const, observationUpdatedAt: new Date(2026, 8, 1).toISOString() } : m));
    expect(programWatchForPicks(noticed, 20, week1, NOW).map((p) => p.milestone.id)).not.toContain(week1.watchFor[0]);
    const answered = catalogue().map((m) => (m.id === "cdc-24m-3" ? { ...m, observationStatus: "not_sure" as const, observationUpdatedAt: NOW.toISOString() } : m));
    expect(programWatchForPicks(answered, 20, week1, NOW)).toEqual([]);
  });

  it("without a program the hook returns exactly the selector's picks; a program with no watch-for only skips its shelf", () => {
    const opts = { perShelf: 1, total: 3, now: NOW };
    expect(selectNoticeWithProgram(catalogue(), 26, opts, null)).toEqual(selectNextMilestonesByShelf(catalogue(), 26, opts));
    const sleep = selectNoticeWithProgram(catalogue(), 26, opts, { shelf: "sleep", watchFor: [] });
    expect(sleep.some((p) => p.shelf === "sleep")).toBe(false);
  });
});
