import { describe, expect, it } from "vitest";
import { PROGRAMS } from "../../content/programs";
import { PRACTICES } from "../../content/practices";
import { ALL_MILESTONES } from "../milestoneData";
import type { Milestone } from "../../types";
import { choosePractice, todaysCandidates } from "../practice/choosePractice";
import { activeProgramWeek, chooserProgram, enrolInProgram, type ProgramEnrolment } from "./enrolment";
import { programWeekDays } from "./measures";
import { selectNoticeWithProgram } from "./notice";

/* B-PROG-03 — both programs select the correct week's practice and watch-for
   on every day of a week and across week boundaries: the day (local) decides
   the week, the practice is one of THAT week's list, never two days the same
   (answered or not), and Notice leads with that week's watch-for rows only. */

const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h, 0);
const START = at(2026, 10, 5, 20); // enrolled on an evening; week 1 starts that local day
const fresh = (): Milestone[] => ALL_MILESTONES.map((m) => ({ ...m, checked: false, observationStatus: undefined, observationUpdatedAt: undefined }) as Milestone);

const enrol = (programId: string): ProgramEnrolment => {
  const r = enrolInProgram([], programId, START);
  if ("reason" in r) throw new Error(r.reason);
  return r.enrolment;
};

describe.each(PROGRAMS.map((p) => [p.id, p] as const))("B-PROG-03 — %s, day by day", (_id, program) => {
  const enrolment = enrol(program.id);
  const months = program.id === "talk-together" ? 24 : 30;
  const milestones = fresh();
  const days = program.weeks.length * 7 + 3; // past the last week: clamped to the last

  it("the week follows the local day: days 0–6 week 1, day 7 week 2 … clamped to the last week", () => {
    for (let d = 0; d < days; d += 1) {
      const today = at(2026, 10, 5 + d, d % 2 ? 7 : 22); // early morning and late evening both sit on their own day
      const active = activeProgramWeek([enrolment], today)!;
      expect(active.week, `day ${d}`).toBe(Math.min(program.weeks.length, Math.floor(d / 7) + 1));
      const range = programWeekDays(enrolment, active.week);
      const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      if (d < program.weeks.length * 7) expect(key >= range.from && key <= range.to, `day ${d}`).toBe(true);
    }
  });

  it("the practice is one of THIS week's practices, never yesterday's, on every day and across every boundary", () => {
    let yesterday: string | undefined;
    for (let d = 0; d < days; d += 1) {
      const today = at(2026, 10, 5 + d, 9);
      const active = activeProgramWeek([enrolment], today)!;
      const chooser = chooserProgram(active);
      const input = { childId: "c1", milestones, comparisonMonths: months, practices: PRACTICES, coverage: {}, today, recentPracticeIds: yesterday ? [yesterday] : [], program: chooser };
      const pick = choosePractice(input)!;
      expect(pick, `day ${d}`).toBeTruthy();
      expect(pick.via, `day ${d}`).toBe("program");
      expect(pick.programId).toBe(program.id);
      expect(pick.programWeek, `day ${d}`).toBe(active.week);
      expect(active.content.practices, `day ${d}`).toContain(pick.practice.id);
      if (yesterday) expect(pick.practice.id, `day ${d} repeats day ${d - 1}`).not.toBe(yesterday);
      // the focus route's candidates (B-LOOP-13) are the same week's list
      for (const c of todaysCandidates(input)) expect(active.content.practices).toContain(c.practice.id);
      yesterday = pick.practice.id;
    }
  });

  it("an unanswered yesterday is still never repeated today (the rotation, not the dose row)", () => {
    for (let d = 1; d < days; d += 1) {
      const pickOn = (day: number) => {
        const today = at(2026, 10, 5 + day, 9);
        return choosePractice({ childId: "c1", milestones, comparisonMonths: months, practices: PRACTICES, coverage: {}, today, program: chooserProgram(activeProgramWeek([enrolment], today)) })!;
      };
      expect(pickOn(d).practice.id, `day ${d}`).not.toBe(pickOn(d - 1).practice.id);
    }
  });

  it("Notice leads with this week's watch-for rows only (open, in the child's window), then other shelves", () => {
    let served = 0;
    for (let d = 0; d < days; d += 1) {
      const today = at(2026, 10, 5 + d, 9);
      const active = activeProgramWeek([enrolment], today)!;
      const picks = selectNoticeWithProgram(milestones, months, { perShelf: 1, total: 3, now: today }, { shelf: active.program.shelf, watchFor: active.content.watchFor });
      expect(picks.length).toBeLessThanOrEqual(3);
      const fromProgram = picks.filter((p) => p.fromProgram);
      for (const p of fromProgram) expect(active.content.watchFor, `day ${d}`).toContain(p.milestone.id);
      // program rows come first; the rest never repeat the program's shelf
      const firstOther = picks.findIndex((p) => !p.fromProgram);
      if (firstOther >= 0) expect(picks.slice(firstOther).some((p) => p.fromProgram)).toBe(false);
      for (const p of picks.filter((x) => !x.fromProgram)) expect(p.shelf).not.toBe(active.program.shelf);
      served += fromProgram.length;
    }
    // non-vacuous where the program names in-window watch-for rows
    if (program.weeks.some((w) => w.watchFor.length)) expect(served).toBeGreaterThan(0);
  });
});

describe("B-PROG-03 — a week boundary moves the practice list and the watch-for together", () => {
  it("Talk Together: day 6 serves week 1, day 7 serves week 2 (practice and watch-for)", () => {
    const enrolment = enrol("talk-together");
    const milestones = fresh();
    const on = (d: number) => {
      const today = at(2026, 10, 5 + d, 9);
      const active = activeProgramWeek([enrolment], today)!;
      const pick = choosePractice({ childId: "c1", milestones, comparisonMonths: 30, practices: PRACTICES, coverage: {}, today, program: chooserProgram(active) })!;
      const notice = selectNoticeWithProgram(milestones, 30, { perShelf: 1, total: 3, now: today }, { shelf: active.program.shelf, watchFor: active.content.watchFor });
      return { active, pick, notice };
    };
    const d6 = on(6), d7 = on(7);
    expect(d6.active.week).toBe(1);
    expect(d7.active.week).toBe(2);
    expect(d6.active.content.practices).toContain(d6.pick.practice.id);
    expect(d7.active.content.practices).toContain(d7.pick.practice.id);
    for (const p of d7.notice.filter((x) => x.fromProgram)) expect(d7.active.content.watchFor).toContain(p.milestone.id);
  });

  it("no program (or a paused one): the thinnest-shelf chooser is unchanged", () => {
    const enrolment = { ...enrol("talk-together"), status: "paused" as const, pausedAt: "2026-10-06" };
    const today = at(2026, 10, 9, 9);
    expect(activeProgramWeek([enrolment], today)).toBeNull();
    const pick = choosePractice({ childId: "c1", milestones: fresh(), comparisonMonths: 30, practices: PRACTICES, coverage: {}, today, program: chooserProgram(null) });
    expect(pick?.via).not.toBe("program");
  });
});
