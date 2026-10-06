/**
 * B-PROG-01 shape (pack P6-PRACTICE, written by B-PROG-02 so the engine builds
 * on it) — a PROGRAM is six to twelve weeks on ONE shelf with one parent skill
 * set, built from public evidence, described as "developmentally informed",
 * never clinical, never a brand. Content only: enrolment, the chooser rule,
 * CompanionContext and the page are B-PROG-01 / B-PROG-03 / B-PROG-05.
 *
 *  - `weeks[n].practices` are ids of content/practices.ts on the program's
 *    shelf (5–7 per week; reused, never authored inside a program).
 *  - `weeks[n].coachScripts` are in-the-moment lines for the week's skill:
 *    the PARENT's behaviour only, EN + HE, screened by the practice scan lists.
 *  - `weeks[n].watchFor` are lib/milestoneData catalogue ids on the shelf;
 *    the engine shows them only inside the child's age window.
 *  - `measures` are counts over time against the child's own first week —
 *    never a grade (clinical firewall). `dose` is always the actionLoops
 *    practice-day count (B-LOOP-09 ledger).
 *  - `reviewStatus` stays "draft" until the clinical reviewer (G-01) signs;
 *    nothing publishes to the public before that.
 */
import type { ShelfId } from "../../lib/shelves/registry";
import type { Practice, PracticeSource, PracticeTechnique } from "../practices";
import type { LocalizedText } from "../governance";

/** A practice id (`Practice.id`, e.g. "pr-cdc-24m-3", "pr-sleep-01"). Declared
 *  HERE, not in content/practices.ts: that file's whole text is content-hashed
 *  for the milestone-loop-v1 eval (src/eval/contentHashes), so even a type-only
 *  line there would mark the 512-scenario suite stale. */
export type PracticeId = Practice["id"];

/** A Learn card id (learn/learnLibrary `LearnCard.id`). The Learn library
 *  declares no id type of its own, so this is `string`. */
export type LearnCardId = string;

/** A catalogue row id (lib/milestoneData `ALL_MILESTONES[].id`). The catalogue
 *  declares no id type of its own, so this is `string`. */
export type MilestoneId = string;

/** An in-the-moment line for this week's skill (parent behaviour only, ≤ 20 words). */
export interface CoachScript {
  id: string;
  text: LocalizedText;
}

/** Where a measure's count comes from. */
export type MeasureSource = "actionLoops" | "selfCount" | "shelfEntries" | "milestone" | "sleepLogs";

/** A count the family sees over time against its own first week. */
export interface MeasureDef {
  id: string;
  label: LocalizedText;
  /** The exact counting rule, in words a reviewer can check. */
  countingRule: LocalizedText;
  source: MeasureSource;
  unit: LocalizedText;
}

export interface ProgramWeek {
  /** 1-based week number. */
  n: number;
  skill: LocalizedText;
  lesson?: LearnCardId;
  practices: PracticeId[];
  coachScripts: CoachScript[];
  watchFor: MilestoneId[];
}

export type ProgramReviewStatus = "draft" | "approved" | "retired";

export interface Program {
  id: string;
  shelf: ShelfId;
  weeks: ProgramWeek[];
  parentSkill: LocalizedText;
  evidence: { techniques: PracticeTechnique[]; sources: PracticeSource[] };
  measures: { dose: true; parentProxy: MeasureDef; childProxy: MeasureDef };
  reviewStatus: ProgramReviewStatus;
}
