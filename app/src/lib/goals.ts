/**
 * B-PROG-07 — FAMILY GOALS with goal attainment scaling (thesis §3.4), PURE
 * (no React, no Firebase). Up to three goals in the family's OWN words, each
 * with a five-step scale whose labels the FAMILY writes (−2 "much less than
 * hoped" … +2 "much more than hoped" are only the shape, never imposed text),
 * scored by the family. The caller persists the returned document at
 * users/{uid}/children/{childId}/familyGoals/{goal.id}
 * (useChildCollection(childId, "familyGoals"); registered in lib/childData
 * CHILD_SUBCOLLECTIONS → export + erase).
 *
 * FIREWALL: a parent surface shows the goal in the family's words and the
 * family's own label for the last score (`latestScoreWord` / `goalParentLine`)
 * — never the number. The number lives only in the professional packet
 * (`goalForPacket`), labelled as the family's own scale ("family-set scale").
 * The AI never scores, proposes a score or reads the goals into a verdict.
 */
import type { LocalizedText } from "../content/governance";

export type GoalScaleValue = -2 | -1 | 0 | 1 | 2;
export const GOAL_SCALE_VALUES: readonly GoalScaleValue[] = [-2, -1, 0, 1, 2];
export type GoalScaleKey = "-2" | "-1" | "0" | "1" | "2";

/** The family's five labels, keyed by scale value. */
export type GoalScaleLabels = Record<GoalScaleKey, string>;

export interface GoalScore {
  /** ISO time of the score. */
  at: string;
  value: GoalScaleValue;
}

export interface FamilyGoal {
  /** Document id. */
  id: string;
  /** The goal in the family's own words (verbatim, trimmed). */
  text: string;
  /** ISO time the family set it. */
  setAt: string;
  /** The family-written label for each step of the scale. */
  scale: GoalScaleLabels;
  /** Oldest first; one score per local day (a later score that day replaces it). */
  scores: GoalScore[];
  /** The program enrolment the goal was set under, when one was active. */
  programId?: string;
  /** B-PROG-09: PROVENANCE only — the professional who proposed the goal at a
   *  visit (consult intake profession id: "slp" · "ot" · "pt" · "psychology" ·
   *  "pediatrician"). The family accepted it in their own words; the app never
   *  turns it into an instruction. Absent on a goal the family wrote alone. */
  proposedBy?: string;
  /** ISO time the family put the goal aside (it stays on the record and in the export). */
  archivedAt?: string;
  updatedAt: string;
}

export const MAX_FAMILY_GOALS = 3;
export const GOAL_TEXT_MAX = 200;
export const GOAL_LABEL_MAX = 80;

/** The packet's label for the number (the family's own scale, never a clinical one). */
export const FAMILY_SET_SCALE_LABEL: LocalizedText = { en: "family-set scale", he: "סולם שהמשפחה קבעה" };

const clean = (value: unknown, cap: number): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, cap) : "";

const dayOf = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const isGoalScaleValue = (value: unknown): value is GoalScaleValue =>
  typeof value === "number" && (GOAL_SCALE_VALUES as readonly number[]).includes(value);

/** Goals that are not put aside (the ones that count toward the three). */
export const activeGoals = (goals: readonly FamilyGoal[]): FamilyGoal[] => goals.filter((g) => !g.archivedAt);

/** The family's five labels, cleaned; null when any step is empty. */
export function cleanScale(scale: Partial<Record<GoalScaleKey, unknown>>): GoalScaleLabels | null {
  const out = {} as GoalScaleLabels;
  for (const v of GOAL_SCALE_VALUES) {
    const key = String(v) as GoalScaleKey;
    const label = clean(scale[key], GOAL_LABEL_MAX);
    if (!label) return null;
    out[key] = label;
  }
  return out;
}

/** Narrow with `"goal" in result` / `"reason" in result` (the app tsconfig is not strict). */
export type SetGoalResult =
  | { ok: true; goal: FamilyGoal }
  | { ok: false; reason: "empty_text" | "incomplete_scale" | "too_many" };

/** Set a new goal in the family's words with their own five labels. At most three active goals. */
export function setGoal(
  existing: readonly FamilyGoal[],
  input: { text: string; scale: Partial<Record<GoalScaleKey, unknown>>; programId?: string; proposedBy?: string },
  now: Date = new Date(),
): SetGoalResult {
  const text = clean(input.text, GOAL_TEXT_MAX);
  if (!text) return { ok: false, reason: "empty_text" };
  const scale = cleanScale(input.scale);
  if (!scale) return { ok: false, reason: "incomplete_scale" };
  if (activeGoals(existing).length >= MAX_FAMILY_GOALS) return { ok: false, reason: "too_many" };
  const iso = now.toISOString();
  const ids = new Set(existing.map((g) => g.id));
  let n = existing.length + 1;
  while (ids.has(`goal-${dayOf(iso)}-${n}`)) n += 1;
  return {
    ok: true,
    goal: {
      id: `goal-${dayOf(iso)}-${n}`,
      text,
      setAt: iso,
      scale,
      scores: [],
      ...(input.programId ? { programId: input.programId } : {}),
      ...(input.proposedBy ? { proposedBy: input.proposedBy } : {}),
      updatedAt: iso,
    },
  };
}

/** Change the goal's words or labels (the family's own edit); invalid input leaves it unchanged. */
export function editGoal(goal: FamilyGoal, input: { text?: string; scale?: Partial<Record<GoalScaleKey, unknown>> }, now: Date = new Date()): FamilyGoal {
  const text = input.text === undefined ? goal.text : clean(input.text, GOAL_TEXT_MAX);
  const scale = input.scale === undefined ? goal.scale : cleanScale(input.scale);
  if (!text || !scale) return goal;
  return { ...goal, text, scale, updatedAt: now.toISOString() };
}

/** Score the goal on the family's scale. One score per local day (a later one that day replaces it). */
export function scoreGoal(goal: FamilyGoal, value: GoalScaleValue, now: Date = new Date()): FamilyGoal {
  if (!isGoalScaleValue(value)) return goal;
  const at = now.toISOString();
  const day = dayOf(at);
  const scores = goal.scores.filter((s) => dayOf(s.at) !== day);
  scores.push({ at, value });
  scores.sort((a, b) => a.at.localeCompare(b.at));
  return { ...goal, scores, updatedAt: at };
}

/** Put a goal aside (kept on the record); it no longer counts toward the three. */
export function archiveGoal(goal: FamilyGoal, now: Date = new Date()): FamilyGoal {
  return goal.archivedAt ? goal : { ...goal, archivedAt: now.toISOString(), updatedAt: now.toISOString() };
}

/** The latest valid score, or null. */
export function latestScore(goal: Pick<FamilyGoal, "scores">): GoalScore | null {
  let best: GoalScore | null = null;
  for (const s of goal.scores ?? []) {
    if (!isGoalScaleValue(s?.value) || !Number.isFinite(Date.parse(s.at))) continue;
    if (!best || s.at > best.at) best = s;
  }
  return best;
}

/** PARENT SURFACE: the family's own label for the latest score — a word, never the number; null before the first score. */
export function latestScoreWord(goal: Pick<FamilyGoal, "scores" | "scale">): string | null {
  const s = latestScore(goal);
  return s ? goal.scale[String(s.value) as GoalScaleKey] ?? null : null;
}

/** PARENT SURFACE: what a goal row may show — the family's words and their own last score word. Nothing numeric. */
export function goalParentLine(goal: FamilyGoal): { text: string; word: string | null } {
  return { text: goal.text, word: latestScoreWord(goal) };
}

/** PROFESSIONAL PACKET ONLY: the GAS number with the family's label, marked as the family-set scale. */
export function goalForPacket(goal: FamilyGoal, lang: "en" | "he" = "en"): {
  text: string;
  scaleLabel: string;
  latest: { value: GoalScaleValue; word: string; at: string } | null;
  scored: number;
  scale: GoalScaleLabels;
} {
  const s = latestScore(goal);
  return {
    text: goal.text,
    scaleLabel: FAMILY_SET_SCALE_LABEL[lang],
    latest: s ? { value: s.value, word: goal.scale[String(s.value) as GoalScaleKey], at: s.at } : null,
    scored: goal.scores.filter((x) => isGoalScaleValue(x?.value)).length,
    scale: goal.scale,
  };
}
