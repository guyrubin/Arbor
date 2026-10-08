import { describe, expect, it } from "vitest";
import {
  HOME_PROFESSIONS,
  HOME_PROFESSION_SHELF,
  HOME_PROGRAM_DEFAULT_WEEKS,
  acceptProposedGoal,
  activeHomeEnrolments,
  exerciseDoneToday,
  homeAdherence,
  homeProgramFromRecord,
  homeProgramGoals,
  homeProgramWeeks,
  startHomeProgram,
  toggleExerciseDay,
  type HomeProgramEnrolment,
} from "./homeProgram";
import { DOMAINS } from "../../lib/domains/registry";
import { shelfDef } from "../../lib/shelves/registry";
import { validEnrolments, activeEnrolment } from "../../lib/programs/enrolment";
import { goalParentLine, type FamilyGoal } from "../../lib/goals";
import { en, he } from "../../lib/i18nElevation/practice";

const NOW = new Date(2026, 9, 8, 10, 0, 0); // 8 Oct 2026, local
const at = (d: number, h = 10) => new Date(2026, 9, d, h, 0, 0);
const SCALE = { "-2": "Not at all", "-1": "Once or twice", "0": "Most evenings", "1": "Every evening", "2": "Without a reminder" };

const entry = {
  profession: "ot" as const,
  exercises: [
    { text: "  Thread five big beads on a lace after breakfast ", shelf: "hands" as const },
    { text: "Crawl through the cushion tunnel twice", shelf: "moving" as const },
  ],
  goals: ["Dresses the top half alone", "Holds the spoon without help"],
  nextVisit: "2026-11-05",
};

const started = (): HomeProgramEnrolment => {
  const r = startHomeProgram([], entry, NOW);
  if (!("enrolment" in r)) throw new Error("expected an enrolment");
  return r.enrolment;
};

describe("B-PROG-09 template · two exercises → one enrolment, two practices on the right shelves, two proposed goals", () => {
  it("creates ONE home-<profession> enrolment carrying both exercises, each on the shelf the parent picked", () => {
    const r = startHomeProgram([], entry, NOW);
    expect("enrolment" in r).toBe(true);
    if (!("enrolment" in r)) return;
    const e = r.enrolment;
    expect(e.programId).toBe("home-ot");
    expect(e.id).toBe("home-ot.2026-10-08");
    expect(e.status).toBe("active");
    expect(e.home.exercises).toEqual([
      { id: "ex-1", text: "Thread five big beads on a lace after breakfast", shelf: "hands" },
      { id: "ex-2", text: "Crawl through the cushion tunnel twice", shelf: "moving" },
    ]);
    // weeks until the next visit: 28 days → 4 weeks
    expect(e.home.weeks).toBe(4);
    expect(e.home.nextVisit).toBe("2026-11-05");
    expect(r.superseded).toEqual([]);
    // the template's program shape carries the two practices every week
    const program = homeProgramFromRecord(e.home);
    expect(program.id).toBe("home-ot");
    expect(program.weeks).toHaveLength(4);
    expect(program.weeks.every((w) => w.practices.join() === "ex-1,ex-2")).toBe(true);
    expect(program.reviewStatus).toBe("draft");
    expect(program.evidence.sources).toEqual([]);
  });

  it("two proposed goals become two family goals ONLY when the parent accepts each in their words, marked proposed by the profession", () => {
    const e = started();
    expect(e.home.proposedGoals).toEqual(["Dresses the top half alone", "Holds the spoon without help"]);
    // nothing is written by the template itself
    expect(Object.keys(e)).not.toContain("goals");
    let goals: FamilyGoal[] = [];
    for (const [i, text] of ["Puts on the top half alone", "Holds the spoon by himself"].entries()) {
      const r = acceptProposedGoal(goals, { text, scale: SCALE }, "ot", at(8, 11 + i));
      expect("goal" in r).toBe(true);
      if ("goal" in r) goals = [...goals, r.goal];
    }
    expect(goals).toHaveLength(2);
    expect(goals.every((g) => g.proposedBy === "ot" && g.programId === "home-ot")).toBe(true);
    // the parent's own words, not the professional's
    expect(goals.map((g) => g.text)).toEqual(["Puts on the top half alone", "Holds the spoon by himself"]);
    expect(homeProgramGoals(goals, e)).toHaveLength(2);
    // the parent surface line stays words only
    expect(JSON.stringify(goals.map(goalParentLine))).not.toMatch(/\d/);
  });

  it("refuses an acceptance without the family's five words (nothing writes itself)", () => {
    const r = acceptProposedGoal([], { text: "Dresses alone", scale: { "-2": "a" } }, "ot", NOW);
    expect("reason" in r && r.reason).toBe("incomplete_scale");
  });
});

describe("B-PROG-09 template · the rules", () => {
  it("defaults each exercise to the profession's shelf, a shelf over a domain the profession owns", () => {
    for (const p of HOME_PROFESSIONS) {
      const domain = shelfDef(HOME_PROFESSION_SHELF[p]).domain;
      const owners = DOMAINS.find((d) => d.id === domain)!.professions as readonly string[];
      const lens: Record<string, readonly string[]> = {
        slp: ["slp"],
        ot: ["ot"],
        pt: ["pt"],
        psychology: ["developmental_psychologist", "educational_psychologist", "child_psychologist"],
        pediatrician: ["pediatrician"],
      };
      expect(lens[p].some((x) => owners.includes(x)), p).toBe(true);
    }
    const r = startHomeProgram([], { profession: "slp", exercises: [{ text: "Name the toy, then wait" }] }, NOW);
    expect("enrolment" in r && r.enrolment.home.exercises[0].shelf).toBe("words");
  });

  it("weeks = until the next visit, 4 when no date (or a past one), at most 12", () => {
    expect(homeProgramWeeks(null, NOW)).toBe(HOME_PROGRAM_DEFAULT_WEEKS);
    expect(homeProgramWeeks("2026-10-01", NOW)).toBe(HOME_PROGRAM_DEFAULT_WEEKS);
    expect(homeProgramWeeks("2026-10-12", NOW)).toBe(1);
    expect(homeProgramWeeks("2026-10-16", NOW)).toBe(2);
    expect(homeProgramWeeks("2027-06-01", NOW)).toBe(12);
  });

  it("drops empty exercises and refuses an entry with none", () => {
    const r = startHomeProgram([], { profession: "pt", exercises: [{ text: "   " }] }, NOW);
    expect("reason" in r && r.reason).toBe("no_exercises");
  });

  it("is invisible to the content-program engine (no chooser, page or AI context reads it) and coexists with it", () => {
    const e = started();
    const tt = { id: "talk-together.2026-10-01", programId: "talk-together", startedAt: "2026-10-01", status: "active", currentWeek: 2, baseline: { childProxy: null, capturedAt: null }, enrolledAt: "", updatedAt: "" };
    expect(validEnrolments([e])).toEqual([]);
    expect(activeEnrolment([e, tt])?.programId).toBe("talk-together");
    expect(activeHomeEnrolments([e, tt]).map((x) => x.id)).toEqual([e.id]);
  });

  it("a newer program from the same profession finishes the older one", () => {
    const old = started();
    const r = startHomeProgram([old], entry, at(20));
    expect("enrolment" in r).toBe(true);
    if (!("enrolment" in r)) return;
    expect(r.superseded.map((x) => [x.id, x.status])).toEqual([[old.id, "done"]]);
    expect(r.enrolment.id).toBe("home-ot.2026-10-20");
  });
});

describe("B-PROG-09 template · adherence is practice DAYS as counts", () => {
  it("counts distinct practice days this week and per exercise; toggling the same day undoes it", () => {
    let e = started();
    e = toggleExerciseDay(e, "ex-1", at(8));
    e = toggleExerciseDay(e, "ex-2", at(8, 18));
    e = toggleExerciseDay(e, "ex-1", at(9));
    e = toggleExerciseDay(e, "ex-1", at(16)); // week 2
    expect(exerciseDoneToday(e, "ex-1", at(16))).toBe(true);
    const a = homeAdherence(e, at(16, 20));
    expect(a.week).toBe(2);
    expect(a.weeks).toBe(4);
    expect(a.daysThisWeek).toBe(1);
    expect(a.daysInAll).toBe(3);
    expect(a.exercises.map((x) => [x.id, x.days])).toEqual([["ex-1", 3], ["ex-2", 1]]);
    const undone = toggleExerciseDay(e, "ex-1", at(16, 21));
    expect(homeAdherence(undone, at(16, 22)).daysThisWeek).toBe(0);
    // an unknown exercise leaves the enrolment unchanged
    expect(toggleExerciseDay(e, "ex-9", at(16))).toBe(e);
    // no rate, no %
    expect(JSON.stringify(a)).not.toMatch(/%|rate|ratio|score/i);
  });
});

describe("B-PROG-09 template · strings", () => {
  it("every home-program string is in EN and HE", () => {
    const keys = Object.keys(en).filter((k) => k.startsWith("elev.homeProgram."));
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) expect(he[k], k).toBeTruthy();
    expect(Object.keys(he).filter((k) => k.startsWith("elev.homeProgram.")).sort()).toEqual(keys.sort());
  });
});
