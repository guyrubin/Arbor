/**
 * B-PROG-12 — the program SEED STATES (pack P6 §B-PROG-12 (2)): the demo
 * family enrolled in Talk Together at week 1 and at week 5 (with its own
 * first-week baseline and counts), a Steady Nights week with the routine taps
 * and diary nights, and the guided tier's booked first session.
 *
 * Opt-in STATES, never the base family: demoFamily.ts carries no enrolment,
 * so every other seeded surface renders exactly as before. The rendered sweep
 * writes ONE state into its throwaway context (`prog-*` cells on
 * #/development?view=program), and the seed's dry run lists every state's
 * enrolment row (scripts/seed-demo-family.mjs). Every document is built by
 * the app's own writers — enrolInProgram / syncCurrentWeek / captureBaseline
 * (lib/programs/enrolment), practiceDoseEntry (lib/practice/choosePractice),
 * tonightOutcomeEntry + tonightSelfCountEntry (lib/loop/tonight),
 * recordRoutineTap + recordSleepDiaryNight (lib/sleepDiary) — and every
 * collection is in CHILD_SUBCOLLECTIONS (export + erase). Invented data only:
 * the words are ordinary first words, the nights are ordinary clock times.
 */
import type { ActionLoopEntry } from "../actionLoop/model";
import type { SleepLogEntry } from "../types";
import type { LangObservation } from "../growth/vocabAgg";
import type { CoachSessionDoc } from "../components/program/CoachSessions";
import { PRACTICES } from "../content/practices";
import { programById } from "../content/programs";
import { ALL_MILESTONES } from "../lib/milestoneData";
import { captureBaseline, dayKey, enrolInProgram, syncCurrentWeek, type ProgramEnrolment } from "../lib/programs/enrolment";
import { practiceDoseEntry } from "../lib/practice/choosePractice";
import { tonightOutcomeEntry, tonightSelfCountEntry } from "../lib/loop/tonight";
import { recordRoutineTap, recordSleepDiaryNight } from "../lib/sleepDiary";
import { resolveHebrewSlash } from "../lib/hebrewSlashGender";
import { GUIDED_TIER_FLAG_KEY } from "../lib/entitlementsGuided";
import { DEMO_CHILD_ID, type DemoLang } from "./demoFamily";

export const DEMO_PROGRAM_STATES = ["prog-week1", "prog-week5", "prog-steady-nights", "prog-coach"] as const;
export type DemoProgramStateName = (typeof DEMO_PROGRAM_STATES)[number];

export type DemoProgramState = {
  name: DemoProgramStateName;
  programId: string;
  /** The program week the state renders in. */
  week: number;
  /** Per-child subcollections (merged by id into the family's record). */
  collections: {
    programs: ProgramEnrolment[];
    actionLoops: ActionLoopEntry[];
    langObs?: LangObservation[];
    sleepLogs?: (SleepLogEntry & { id: string })[];
    coachSessions?: CoachSessionDoc[];
  };
  /** Device flags the state needs (the guided tier's local flag). */
  flags?: Record<string, string>;
};

const DAY = 86_400_000;
/** Local noon-ish `daysAgo` before `now` at `hour` — the day keys stay local. */
const on = (now: number, daysAgo: number, hour: number): Date => {
  const d = new Date(now - daysAgo * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
};

/** A program dose day: practice day `daysAgo`, the week's practice by rotation, Tonight's outcome and (Talk Together) the turn tap. */
type Dose = { daysAgo: number; night?: "helped" | "somewhat"; turns?: number };

function programDoses(now: number, childId: string, programId: string, enrolment: ProgramEnrolment, doses: readonly Dose[], lang: DemoLang, gender: string | null): ActionLoopEntry[] {
  const program = programById(programId)!;
  return doses.map((d, i) => {
    const day = on(now, d.daysAgo, 9);
    const weekIndex = Math.min(program.weeks.length, Math.floor((Date.parse(`${dayKey(day)}T12:00:00`) - Date.parse(`${enrolment.startedAt}T12:00:00`)) / (7 * DAY)) + 1) - 1;
    const ids = program.weeks[Math.max(0, weekIndex)].practices;
    const practice = PRACTICES.find((p) => p.id === ids[i % ids.length]);
    if (!practice) throw new Error(`B-PROG-12 seed: practice ${ids[i % ids.length]} not in content/practices`);
    const milestone = practice.milestoneId ? ALL_MILESTONES.find((m) => m.id === practice.milestoneId) ?? null : null;
    const say = lang === "he" ? resolveHebrewSlash(practice.say.he, gender) : practice.say.en;
    let row = practiceDoseEntry({ practice, milestone, shelf: practice.shelf, programId }, "did", childId, say, day);
    if (d.night) row = tonightOutcomeEntry(row, d.night, on(now, d.daysAgo, 20));
    if (typeof d.turns === "number") row = tonightSelfCountEntry(row, d.turns) ?? row;
    return row;
  });
}

/** Words written down on the Words shelf (the child proxy's entries): ordinary first words. */
const WORDS: Record<DemoLang, string[]> = {
  en: ["ball", "more", "dog", "shoe", "up", "bath", "moon", "car"],
  he: ["כדור", "עוד", "כלב", "נעל", "למעלה", "אמבטיה", "ירח", "אוטו"],
};
const words = (now: number, lang: DemoLang, daysAgo: readonly number[], prefix: string): LangObservation[] =>
  daysAgo.map((d, i) => ({ id: `${prefix}-${i + 1}`, timestamp: on(now, d, 18).toISOString(), language: lang === "he" ? "Hebrew" : "English", phrase: WORDS[lang][i % WORDS[lang].length] }));

function enrolled(programId: string, now: number, daysAgo: number): ProgramEnrolment {
  const r = enrolInProgram([], programId, on(now, daysAgo, 20));
  if ("reason" in r) throw new Error(`B-PROG-12 seed: ${r.reason}`);
  return syncCurrentWeek(r.enrolment, new Date(now));
}

/** One named program state, deterministic for a given `now`. */
export function buildDemoProgramState(
  name: DemoProgramStateName,
  { now = Date.now(), lang = "en" as DemoLang, childId = DEMO_CHILD_ID, gender = "boy" as string | null }: { now?: number; lang?: DemoLang; childId?: string; gender?: string | null } = {},
): DemoProgramState {
  if (name === "prog-week1" || name === "prog-coach") {
    // Day 3 of week 1: two practice days with Tonight's answer and the turn tap; today still open.
    const enrolment = enrolled("talk-together", now, 2);
    const actionLoops = programDoses(now, childId, "talk-together", enrolment, [
      { daysAgo: 2, night: "somewhat", turns: 1 },
      { daysAgo: 1, night: "helped", turns: 3 },
    ], lang, gender);
    const state: DemoProgramState = {
      name, programId: "talk-together", week: 1,
      collections: { programs: [enrolment], actionLoops, langObs: words(now, lang, [1], "demo-prog-word") },
    };
    if (name === "prog-coach") {
      // B-PROG-10: the guided tier's first session, booked for the day after tomorrow.
      const iso = new Date(now).toISOString();
      state.collections.coachSessions = [{
        id: `${enrolment.id}.kickoff`, enrolmentId: enrolment.id, programId: enrolment.programId, slot: "kickoff",
        bookedFor: dayKey(on(now, -2, 12)), createdAt: iso, updatedAt: iso,
      }];
      state.flags = { [GUIDED_TIER_FLAG_KEY]: "1" };
    }
    return state;
  }
  if (name === "prog-week5") {
    // Day 31 = week 5, day 3. Week 1 is the family's own baseline (3 days, 4 turns, 1 word).
    let enrolment = enrolled("talk-together", now, 30);
    enrolment = captureBaseline(enrolment, 1, on(now, 23, 9));
    const doses: Dose[] = [
      { daysAgo: 30, night: "somewhat", turns: 1 }, { daysAgo: 28, night: "somewhat", turns: 1 }, { daysAgo: 26, night: "helped", turns: 2 },
      { daysAgo: 22, night: "helped", turns: 2 }, { daysAgo: 20, night: "helped", turns: 2 }, { daysAgo: 18, turns: 3 }, { daysAgo: 17, night: "helped", turns: 2 },
      { daysAgo: 15, night: "somewhat", turns: 3 }, { daysAgo: 13, night: "helped", turns: 3 }, { daysAgo: 11, night: "helped", turns: 4 },
      { daysAgo: 8, night: "helped", turns: 3 }, { daysAgo: 6, night: "helped", turns: 4 }, { daysAgo: 4, night: "helped", turns: 4 },
      { daysAgo: 2, night: "helped", turns: 5 }, { daysAgo: 1, night: "helped", turns: 4 },
    ];
    return {
      name, programId: "talk-together", week: 5,
      collections: {
        programs: [enrolment],
        actionLoops: programDoses(now, childId, "talk-together", enrolment, doses, lang, gender),
        langObs: words(now, lang, [29, 19, 12, 9, 2, 1, 1], "demo-prog-word"),
      },
    };
  }
  // prog-steady-nights — day 10 = week 2, day 3: a diary first week (4 nights) and two nights this week.
  const enrolment = enrolled("steady-nights", now, 9);
  const nights: { daysAgo: number; routine: "done_in_order" | "not_tonight"; bedtime: string; wakings?: string[]; wake: string }[] = [
    { daysAgo: 9, routine: "not_tonight", bedtime: "21:15", wakings: ["01:30", "04:10"], wake: "06:30" },
    { daysAgo: 8, routine: "done_in_order", bedtime: "20:45", wakings: ["02:00"], wake: "06:40" },
    { daysAgo: 6, routine: "done_in_order", bedtime: "20:30", wakings: ["03:00"], wake: "06:45" },
    { daysAgo: 4, routine: "done_in_order", bedtime: "20:30", wake: "06:30" },
    { daysAgo: 2, routine: "done_in_order", bedtime: "20:15", wakings: ["02:30"], wake: "06:50" },
    { daysAgo: 1, routine: "done_in_order", bedtime: "20:20", wake: "06:40" },
  ];
  const sleepLogs = nights.map((n) => {
    const date = dayKey(on(now, n.daysAgo, 20));
    const tapped = recordRoutineTap(undefined, { date, answer: n.routine, now: on(now, n.daysAgo, 21).toISOString(), programId: "steady-nights" });
    const night = recordSleepDiaryNight(tapped, { date, bedtime: n.bedtime, wake: n.wake, wakings: n.wakings, now: on(now, n.daysAgo - 1, 7).toISOString(), programId: "steady-nights" });
    if (!night) throw new Error(`B-PROG-12 seed: diary night ${date} does not make a night`);
    return { ...night, id: date };
  });
  return {
    name, programId: "steady-nights", week: 2,
    collections: {
      programs: [enrolment],
      actionLoops: programDoses(now, childId, "steady-nights", enrolment, [
        { daysAgo: 8, night: "somewhat" }, { daysAgo: 6, night: "helped" }, { daysAgo: 4, night: "helped" }, { daysAgo: 2, night: "helped" }, { daysAgo: 1, night: "helped" },
      ], lang, gender),
      sleepLogs,
    },
  };
}

/** Every state, for the seed's dry run. */
export const buildDemoProgramStates = (opts: Parameters<typeof buildDemoProgramState>[1] = {}): DemoProgramState[] =>
  DEMO_PROGRAM_STATES.map((name) => buildDemoProgramState(name, opts));

/** The dry run's one line per state: the enrolment row and what rides with it (counts of documents, never their text). */
export function demoProgramStateLine(s: DemoProgramState): string {
  const e = s.collections.programs[0];
  const program = programById(e.programId);
  const docs = Object.entries(s.collections).map(([k, v]) => `${k} ${v?.length ?? 0}`).join(" · ");
  return `${s.name.padEnd(19)} ${e.programId} · started ${e.startedAt} · week ${s.week} of ${program?.weeks.length ?? "?"} · baseline ${e.baseline.childProxy ?? "—"} · ${docs}${s.flags ? ` · flags ${Object.keys(s.flags).join(",")}` : ""}`;
}
