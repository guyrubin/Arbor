/**
 * lib/library/plans/composePlanBook — B-BOOK-75/77: ONE pure function turns a
 * pattern and a parent's choices into the PLAN book the child reads (standard
 * §2 skeleton, §6 composition, §7 contract). No model call, no I/O: the words
 * are the pattern's authored frames and menu lines, the parent's choices are
 * which menu items, how many minutes, which time, which box items, how long.
 *
 * Screens: cover · p1 body good · p2 how it works · p3 sometimes hard ·
 * p4 we have a plan · s1 step one · s2 step two · s3 step three · p8 the win ·
 * the END screen. The step pages are keyed `s<n>-<menuId>` so their narration
 * files are shared per pattern and menu item (a minutes value is spoken, so a
 * step with minutes carries them in the id too: `s1-sit-after-meal-5m`).
 *
 * A composition that names a menu item of the wrong slot, a minutes value
 * outside the pattern's bounds or an unknown box item is REFUSED (the server
 * route and the composer both call `validatePlanComposition` first).
 */
import type { BookLine, Page, PlanBook, PlanStep, Slot } from "../types";
import type { PatternDef, PatternFramePage, PlanMenuItem } from "./patterns";

/** The parent's choices for one child (also the persisted document's core —
 *  lib/library/plans/planBookDoc). */
/** B-BOOK-77 / B-GA-11: a step in the parent's OWN words, phrased server-side
 *  into the book's register (one model call at composition, never at read
 *  time), screened, shown as AI-phrased, and APPROVED by the parent exactly
 *  as the child will hear it. The menu id of that slot is `OWN_STEP`. */
export interface OwnStep {
  slot: 1 | 2 | 3;
  /** What the parent typed, verbatim (never read to the child). */
  sourceText: string;
  /** The phrased line, in both languages (the child's text). */
  text: BookLine;
  aiPhrased: true;
  /** ISO time of the parent's explicit approval of the exact line; absent = not approved. */
  approvedAt?: string;
}

export const OWN_STEP = "own";

export interface PlanComposition {
  /** The composed book's id (one per child and pattern, e.g. `plan-poo-sit.c1`). */
  bookId: string;
  /** Menu ids per slot; `OWN_STEP` names the parent's own-words step (`ownStep`). */
  stepMenuIds: [string, string, string];
  ownStep?: OwnStep;
  /** Minutes for the step that takes a duration (the slot-1 item). */
  minutes: number;
  /** The time-of-day key for the slot-1 item. */
  time: string;
  boxItemIds: string[];
  durationDays: number;
  approvedAt: string;
  approvedBy: string;
}

export type CompositionProblem =
  | { code: "bad_step"; stepIndex: number; menuId: string }
  | { code: "own_step_unapproved"; stepIndex: number }
  | { code: "own_step_empty"; stepIndex: number }
  | { code: "bad_minutes"; minutes: number }
  | { code: "bad_box_item"; itemId: string }
  | { code: "bad_duration"; durationDays: number }
  | { code: "bad_time"; time: string };

/** Times of day the composer offers (keys; the words come from TIME_WORDS). */
export const PLAN_TIMES = ["morning", "after-meal", "afternoon", "evening", "bedtime"] as const;
export type PlanTime = (typeof PLAN_TIMES)[number];

/** The time of day as the child's text says it, filled into `{time}`. */
export const TIME_WORDS: Record<PlanTime, BookLine> = {
  morning: { en: "morning", he: { m: "בוקר", f: "בוקר" } },
  "after-meal": { en: "day after lunch", he: { m: "יום אחרי ארוחת הצהריים", f: "יום אחרי ארוחת הצהריים" } },
  afternoon: { en: "afternoon", he: { m: "אחר צהריים", f: "אחר צהריים" } },
  evening: { en: "evening", he: { m: "ערב", f: "ערב" } },
  bedtime: { en: "night before bed", he: { m: "לילה לפני השינה", f: "לילה לפני השינה" } },
};

export const DURATION_DAYS_RANGE: [number, number] = [14, 28];

const isPlanTime = (t: string): t is PlanTime => (PLAN_TIMES as readonly string[]).includes(t);

/** Every problem with a composition against its pattern ([] = valid). */
export function validatePlanComposition(def: PatternDef, c: PlanComposition): CompositionProblem[] {
  const out: CompositionProblem[] = [];
  c.stepMenuIds.forEach((menuId, i) => {
    if (menuId === OWN_STEP) {
      const own = c.ownStep;
      if (!own || own.slot !== i + 1 || own.aiPhrased !== true) return void out.push({ code: "bad_step", stepIndex: i, menuId });
      if (!own.text?.en?.trim() || !own.text.he?.m?.trim() || !own.text.he?.f?.trim()) out.push({ code: "own_step_empty", stepIndex: i });
      // B-GA-11: an AI-phrased line reaches the child only once the parent approved the exact line
      if (!own.approvedAt) out.push({ code: "own_step_unapproved", stepIndex: i });
      return;
    }
    const item = def.menu.find((m) => m.id === menuId);
    if (!item || item.slot !== i + 1) out.push({ code: "bad_step", stepIndex: i, menuId });
  });
  const [min, max] = def.minutesRange;
  if (!Number.isInteger(c.minutes) || c.minutes < min || c.minutes > max) out.push({ code: "bad_minutes", minutes: c.minutes });
  if (!isPlanTime(c.time)) out.push({ code: "bad_time", time: c.time });
  for (const id of c.boxItemIds) if (!def.boxItems.some((b) => b.id === id)) out.push({ code: "bad_box_item", itemId: id });
  if (!Number.isInteger(c.durationDays) || c.durationDays < DURATION_DAYS_RANGE[0] || c.durationDays > DURATION_DAYS_RANGE[1]) out.push({ code: "bad_duration", durationDays: c.durationDays });
  return out;
}

/** The default composition of a pattern (what the composer proposes first). */
export function defaultPlanComposition(def: PatternDef, ids: { bookId: string; approvedAt: string; approvedBy: string }): PlanComposition {
  const first = def.menu.find((m) => m.id === def.defaultSteps[0]);
  return {
    bookId: ids.bookId,
    stepMenuIds: [...def.defaultSteps],
    minutes: first?.defaultMinutes ?? 5,
    time: first?.defaultTime ?? "evening",
    boxItemIds: def.boxItems.slice(0, 3).map((b) => b.id),
    durationDays: def.defaultDurationDays,
    approvedAt: ids.approvedAt,
    approvedBy: ids.approvedBy,
  };
}

const fill = (text: string, vars: Record<string, string>) => text.replace(/\{(minutes|time)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);

/** A menu line with `{minutes}` and `{time}` filled for this composition. */
export function fillStepLine(line: BookLine, c: Pick<PlanComposition, "minutes" | "time">): BookLine {
  const t = isPlanTime(c.time) ? TIME_WORDS[c.time] : TIME_WORDS.evening;
  return {
    en: fill(line.en, { minutes: String(c.minutes), time: t.en }),
    he: { m: fill(line.he.m, { minutes: String(c.minutes), time: t.he.m }), f: fill(line.he.f, { minutes: String(c.minutes), time: t.he.f }) },
  };
}

const slotOf = (art: PatternFramePage["art"], pose: string): Slot => ({ ...art.slot, pose });

function framePage(f: PatternFramePage): Page {
  return {
    id: f.id,
    plateId: f.art.plateId,
    ...(f.spread ? { type: "spread" as const } : {}),
    ...(f.art.phoneCrop != null ? { phoneCrop: f.art.phoneCrop } : {}),
    hero: slotOf(f.art, f.pose),
    text: f.text,
    ...(f.closing ? { closing: f.closing } : {}),
  };
}

/** The step's page id: shared per pattern + menu item (+ minutes when spoken). */
export function stepPageId(n: 1 | 2 | 3, item: PlanMenuItem, minutes: number): string {
  const spoken = /\{minutes\}/.test(item.text.en);
  return `s${n}-${item.id}${spoken ? `-${minutes}m` : ""}`;
}

/** The own-words step takes the slot's default menu item's plate and pose
 *  (the words are the parent's; the picture is the pattern's). */
function ownStepOf(def: PatternDef, c: PlanComposition, n: 1 | 2 | 3): { step: PlanStep; page: Page } {
  const own = c.ownStep!;
  const stand = def.menu.find((m) => m.id === def.defaultSteps[n - 1])!;
  const id = `s${n}-own`;
  const step: PlanStep = { id, menuId: OWN_STEP, text: own.text, plateId: stand.art.plateId, pose: stand.pose, aiPhrased: true };
  const page: Page = { id, plateId: stand.art.plateId, ...(stand.art.phoneCrop != null ? { phoneCrop: stand.art.phoneCrop } : {}), hero: slotOf(stand.art, stand.pose), text: own.text };
  return { step, page };
}

function stepOf(def: PatternDef, c: PlanComposition, n: 1 | 2 | 3): { step: PlanStep; page: Page } {
  if (c.stepMenuIds[n - 1] === OWN_STEP) return ownStepOf(def, c, n);
  const item = def.menu.find((m) => m.id === c.stepMenuIds[n - 1])!;
  const text = fillStepLine(item.text, c);
  const id = stepPageId(n, item, c.minutes);
  const spoken = /\{minutes\}/.test(item.text.en);
  const step: PlanStep = {
    id,
    menuId: item.id,
    text,
    ...(spoken ? { minutes: c.minutes, time: c.time } : {}),
    plateId: item.art.plateId,
    pose: item.pose,
  };
  const page: Page = {
    id,
    plateId: item.art.plateId,
    ...(item.art.phoneCrop != null ? { phoneCrop: item.art.phoneCrop } : {}),
    hero: slotOf(item.art, item.pose),
    text,
  };
  return { step, page };
}

/** The PLAN book for one composition. The caller validated it first. */
export function composePlanBook(def: PatternDef, c: PlanComposition): PlanBook {
  const problems = validatePlanComposition(def, c);
  if (problems.length) throw new Error(`invalid plan composition: ${JSON.stringify(problems)}`);
  const s1 = stepOf(def, c, 1);
  const s2 = stepOf(def, c, 2);
  const s3 = stepOf(def, c, 3);
  const f = def.frames;
  const chosenBox = def.boxItems.filter((b) => c.boxItemIds.includes(b.id));
  const steps = [s1.step, s2.step, s3.step] as [PlanStep, PlanStep, PlanStep];
  const sourceIds = [...new Set(steps.flatMap((s) => def.menu.find((m) => m.id === s.menuId)?.sourceIds ?? []))];
  const planSteps = steps.map((s) => {
    if (s.menuId === OWN_STEP) {
      // B-GA-11 disclosure, in the parent's panel: the line is theirs, phrased by Arbor, approved by them
      const own = c.ownStep!;
      return { en: `${own.text.en} (your own step: "${own.sourceText}", phrased by Arbor and approved by you)`, he: `${own.text.he.m} (השלב שלכם: "${own.sourceText}", נוסח על ידי Arbor ואושר על ידיכם)` };
    }
    const item = def.menu.find((m) => m.id === s.menuId)!;
    const t = isPlanTime(c.time) ? TIME_WORDS[c.time] : TIME_WORDS.evening;
    return { en: fill(item.parentLine.en, { minutes: String(c.minutes), time: t.en }), he: fill(item.parentLine.he, { minutes: String(c.minutes), time: t.he.m }) };
  });
  return {
    kind: "plan",
    id: c.bookId,
    pattern: def.id,
    title: def.title,
    coverLine: def.coverLine,
    coverNameLine: def.coverNameLine,
    sourceRef: def.sources.map((s) => s.id).join(", "),
    knowledge: def.knowledge,
    childRole: "SELF (the avatar as themself, at home)",
    additions: [],
    ageBand: def.ageText,
    ageBands: def.ageBands,
    cover: framePage(f.cover),
    pages: [framePage(f.bodyGood), framePage(f.howItWorks), framePage(f.sometimesHard), framePage(f.wePlan), s1.page, s2.page, s3.page, framePage(f.win)],
    steps,
    ...(chosenBox.length ? { box: chosenBox, boxPageId: s2.page.id } : {}),
    durationDays: c.durationDays,
    approvedAt: c.approvedAt,
    approvedBy: c.approvedBy,
    sourceIds,
    parent: {
      knows: def.parent.knows,
      whyNow: def.parent.whyNow,
      tomorrow: def.parent.tomorrow,
      askAfter: def.parent.askAfter,
      together: def.parent.together,
      sourceNote: def.parent.sourceNote,
      planSteps,
      watchFor: def.watchFor.map((w) => w.text),
      sources: def.sources.filter((s) => sourceIds.includes(s.id)).map((s) => s.label),
      firstWeek: def.parent.firstWeek,
    },
    ...(def.poseFallbacks ? { poseFallbacks: def.poseFallbacks } : {}),
  };
}
