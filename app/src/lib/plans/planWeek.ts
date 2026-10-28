/**
 * lib/plans/planWeek — B-BOOK-78: the plan reaches the parent's week. PURE.
 *
 *  - An ACTIVE plan is a stored plan book (`books`, lib/library/plans/
 *    planBookDoc) with status "active" whose duration has not run out; it
 *    sits first in the child's Tonight and leads the parent's Today.
 *  - The night question: the parent confirms, in one tap, that tonight's
 *    sit / night happened; `recordNight` returns the row to write (a LOCAL
 *    day key appended to `nights`). COUNTS only: `nightsCount` is what the
 *    shelf shows — never a rate, a streak, a percentage or a verdict, and
 *    never anything the child sees.
 *  - After the duration the parent keeps (extends), changes (returns to the
 *    composer) or closes the plan (`closePlan`); a closed plan leaves
 *    Tonight and Today.
 *  - Only an explicit parent confirmation writes a journal moment; this
 *    module returns the words for it (`nightMomentText`) and never writes.
 */
import { daysBetween, dayKey as localDayKey } from "../programs/enrolment";
import { planBookFromDoc, readPlanBookDoc, type PlanBookDoc } from "../library/plans/planBookDoc";
import { getPattern } from "../library/plans/planBooks";
import type { PatternDef } from "../library/plans/patterns";
import { isolate } from "../i18n";
import type { ShelfId } from "../shelves/registry";
import type { BookLang, HeGender, PatternId } from "../library/types";

export { localDayKey as dayKey };

export interface ActivePlan {
  doc: PlanBookDoc;
  def: PatternDef;
  /** 1-based day of the plan today (1 on the approval day). */
  day: number;
  /** Days left including today (0 = the duration has run out). */
  daysLeft: number;
  /** The duration ran out: the parent chooses keep / change / close. */
  review: boolean;
}

/** The day key of an ISO time, in the local zone of `now`'s environment. */
const dayOfIso = (iso: string): string => localDayKey(new Date(iso));

/** The child's active plans, newest approval first. A plan past its duration
 *  stays active (for the keep / change / close choice) until the parent
 *  closes it. */
export function activePlans(rows: readonly unknown[], now: Date): ActivePlan[] {
  const today = localDayKey(now);
  const out: ActivePlan[] = [];
  for (const raw of rows) {
    const doc = readPlanBookDoc(raw);
    if (!doc || doc.status !== "active") continue;
    const def = getPattern(doc.pattern);
    if (!def) continue;
    const start = dayOfIso(doc.approvedAt);
    const day = Math.max(1, daysBetween(start, today) + 1);
    const daysLeft = Math.max(0, doc.durationDays - day + 1);
    out.push({ doc, def, day, daysLeft, review: daysLeft === 0 });
  }
  return out.sort((a, b) => (a.doc.approvedAt < b.doc.approvedAt ? 1 : -1));
}

/** The one plan Today and Tonight lead with (the newest active one). */
export const leadPlan = (rows: readonly unknown[], now: Date): ActivePlan | null => activePlans(rows, now)[0] ?? null;

/** How many nights / sits the parent confirmed, over the whole plan. A count. */
export const nightsCount = (doc: Pick<PlanBookDoc, "nights">): number => doc.nights?.length ?? 0;

/** Was tonight already confirmed? */
export const nightRecorded = (doc: Pick<PlanBookDoc, "nights">, now: Date): boolean => !!doc.nights?.includes(localDayKey(now));

/** The row to write after the parent confirms tonight (idempotent per day). */
export function recordNight(doc: PlanBookDoc, now: Date): PlanBookDoc {
  const key = localDayKey(now);
  const nights = [...new Set([...(doc.nights ?? []), key])].sort();
  return { ...doc, nights, updatedAt: now.toISOString() };
}

/** Undo tonight's confirmation (the parent tapped by mistake). */
export function unrecordNight(doc: PlanBookDoc, now: Date): PlanBookDoc {
  const key = localDayKey(now);
  const nights = (doc.nights ?? []).filter((d) => d !== key);
  return { ...doc, ...(nights.length ? { nights } : { nights: [] }), updatedAt: now.toISOString() };
}

/* ── S1 (surfacing): the child's "I tried!" and tonight's step ─────────────
 *  The kid home rail records the child's own tap as a LOCAL day key under
 *  `tries` (beside the parent's `nights`); both are counts. The parent card
 *  shows "{k} tries this week": the distinct days of the last seven (today and
 *  the six before) with a confirmed night or a child's try. Never a streak,
 *  never "missed". */

/** Did the child already tap "I tried!" today? */
export const tryRecorded = (doc: Pick<PlanBookDoc, "tries">, now: Date): boolean => !!doc.tries?.includes(localDayKey(now));

/** The row to write after the child's tap (idempotent per day). */
export function recordTry(doc: PlanBookDoc, now: Date): PlanBookDoc {
  const key = localDayKey(now);
  const tries = [...new Set([...(doc.tries ?? []), key])].sort();
  return { ...doc, tries, updatedAt: now.toISOString() };
}

/** Days with a try this week (the parent's confirmed nights and the child's
 *  taps, one per day), over today and the six days before. A count. */
export function triesThisWeek(doc: Pick<PlanBookDoc, "nights" | "tries">, now: Date): number {
  const today = localDayKey(now);
  let n = 0;
  for (const day of new Set([...(doc.nights ?? []), ...(doc.tries ?? [])])) {
    const back = daysBetween(day, today);
    if (back >= 0 && back < 7) n += 1;
  }
  return n;
}

const STEP_LABEL = /^(?:step\s+(?:one|1)|שלב\s+(?:ראשון|1))\s*[:：]\s*/i;

/** Tonight's step for the CHILD: the first sentence of step one (the act) in
 *  the child's own first-person words, without its "Step one:" label. Kid
 *  register only — never the parent line. Null when the stored choices no
 *  longer compose. */
export function tonightStepForChild(doc: PlanBookDoc, lang: BookLang, gender: HeGender): string | null {
  const book = planBookFromDoc(doc);
  if (!book) return null;
  const line = book.steps[0].text;
  const text = (lang === "he" ? line.he[gender] : line.en).replace(STEP_LABEL, "").trim();
  return text.match(/^[^.!?]*[.!?]/)?.[0] ?? text;
}

/** Tonight's step for the PARENT: step one as the grown-ups do it (the
 *  pattern's parent line, minutes and time filled). Parent register only. */
export function tonightStepForParent(doc: PlanBookDoc, lang: BookLang): string | null {
  const book = planBookFromDoc(doc);
  return book ? book.parent.planSteps[0][lang] : null;
}

/** Keep going: the same plan for another stretch (bounded like the composer's). */
export function keepPlan(doc: PlanBookDoc, now: Date, moreDays = 14): PlanBookDoc {
  const extra = Math.max(7, Math.min(28, Math.round(moreDays)));
  return { ...doc, durationDays: doc.durationDays + extra, updatedAt: now.toISOString() };
}

/** Close the plan: it leaves Tonight and Today; the book and its counts stay in the child's data (export + erase). */
export function closePlan(doc: PlanBookDoc, now: Date): PlanBookDoc {
  return { ...doc, status: "closed", closedAt: now.toISOString(), updatedAt: now.toISOString() };
}

/** The pattern's parent-side shelf: a real shelf id, or null for the body
 *  domain's door (the standard's "Body" shelf is not one of the nine; the
 *  Parent host places it — recorded as Guy's decision, Wave 3 report). */
export function planShelf(def: Pick<PatternDef, "shelf">): ShelfId | null {
  return def.shelf === "body" ? null : def.shelf;
}

/** The patterns whose door sits on a shelf page. */
export function patternsOnShelf(defs: readonly PatternDef[], shelf: ShelfId): PatternDef[] {
  return defs.filter((d) => planShelf(d) === shelf);
}

/** The journal moment's words when the parent EXPLICITLY asks to keep
 *  tonight in the journal (never written without that tap): the pattern's
 *  parent words and the night, in the parent's language — no count, no
 *  verdict. */
export function nightMomentText(def: Pick<PatternDef, "parentWords" | "title">, lang: BookLang, childName: string): string {
  return lang === "he" ? `הלילה עשינו את התוכנית של ${isolate(childName)}: ${def.title.he}.` : `Tonight we did ${isolate(childName)}'s plan: ${def.title.en}.`;
}

/** The ids a child has an active plan for (the door hides a pattern already running). */
export function runningPatternIds(rows: readonly unknown[], now: Date): PatternId[] {
  return activePlans(rows, now).map((p) => p.def.id);
}
