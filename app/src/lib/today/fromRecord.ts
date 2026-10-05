/**
 * B-TODAY-28 — "From your record": Today opens with ONE thing the family
 * already told Arbor, never with a generic prompt.
 *
 * Pure and on-device (zero model calls). Given the child's record it returns
 * at most ONE opener, in this priority:
 *   1. an active plan → its topic, quoting the last step tried/rated (else the
 *      parent's latest written note);
 *   2. the parent's last written note, when it is older than 14 days → quoted;
 *   3. a remembered fact with a time word in it (started, moved, new sibling,
 *      התחיל…) → "Is that still so?";
 *   4. nothing → null (Today keeps its existing day-0 / prompt chain).
 * An opener the parent answered in the last 7 days is skipped (the next
 * priority speaks instead), so the same question never repeats daily.
 *
 * CLINICAL FIREWALL: the quote is the parent's own text, verbatim; the opener
 * carries no count, percentage, trend word or verdict — only the parent's
 * words, their date and a question. The answer is the parent's read
 * ("Still easier · Hard again · Something else"), stored as a reflection on
 * the existing action-loop ledger (source "from-record"), never a score.
 */
import type { ActionPlan, BehaviorLog } from "../../types";
import type { ActionLoopEntry } from "../../actionLoop/model";
import { planStepStatus } from "../plans";

export type FromRecordKind = "plan" | "note" | "fact";
/** The three tap answers; stored verbatim as the reflection. */
export type FromRecordAnswer = "easier" | "hard_again" | "other";
export const FROM_RECORD_ANSWERS: readonly FromRecordAnswer[] = ["easier", "hard_again", "other"];

/** Where the quote came from: the parent's own words, or a plan step they tried. */
export type FromRecordQuoteSource = "parent" | "fact" | "step";

export interface FromRecordOpener {
  /** Stable id of what the opener is about: `plan:<id>` · `note:<id>` · `fact:<id>`. */
  key: string;
  kind: FromRecordKind;
  /** The plan's title (plan opener only) — a topic line, never a verdict. */
  topic: string | null;
  /** Verbatim text (trimmed only), or null when the plan has nothing to quote. */
  quote: string | null;
  quoteSource: FromRecordQuoteSource | null;
  /** ISO date the quoted text was written / the step was rated. */
  quoteAt: string | null;
}

export interface FromRecordFact {
  id: string;
  fact: string;
  createdAt: string;
  status?: string;
}

export interface FromRecordInput {
  now: Date;
  /** Newest first (the context's `actionPlans` order). */
  plans: readonly ActionPlan[];
  loop: readonly ActionLoopEntry[];
  logs: readonly BehaviorLog[];
  /** Memory facts; only `approved` (or status-less) ones are read. */
  facts: readonly FromRecordFact[];
}

const DAY_MS = 86_400_000;
/** A note newer than this is fresh: the parent is here, nothing to welcome back. */
export const NOTE_STALE_DAYS = 14;
/** An answered opener stays quiet this long. */
export const ANSWER_QUIET_DAYS = 7;
/** Shorter than this is not a sentence worth quoting back. */
const MIN_QUOTE = 12;

/** Time words that make a remembered fact worth re-asking (EN + HE). */
const TIME_WORDS_EN =
  /\b(start(s|ed|ing)?|began|begin(s|ning)?|moved|moving|move[sd]? to|entering|enter(s|ed)?|new (baby|sibling|brother|sister|school|kindergarten|preschool|home|house|class|teacher)|since|recently|lately|anymore|no longer|now)\b/i;
const TIME_WORDS_HE =
  /(התחיל|התחילה|התחילו|מתחיל|מתחילה|נכנס|נכנסה|עבר|עברה|עברנו|עברו|חדש|חדשה|לאחרונה|מאז|כבר לא|עכשיו|בעוד)/;

export function factHasTimeWord(text: string): boolean {
  return TIME_WORDS_EN.test(text) || TIME_WORDS_HE.test(text);
}

const ms = (iso: string | undefined | null): number => {
  const v = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(v) ? v : NaN;
};

/** The parent's own written words on a moment (notes, else the resolution note). */
export function parentWords(log: Pick<BehaviorLog, "notes" | "resolutionNotes">): string | null {
  for (const raw of [log.notes, log.resolutionNotes]) {
    const s = (raw ?? "").trim();
    if (s.length >= MIN_QUOTE) return s;
  }
  return null;
}

/** The parent's newest written note (any age), or null. */
function latestNote(logs: readonly BehaviorLog[]): { id: string; text: string; at: string } | null {
  let best: { id: string; text: string; at: string; t: number } | null = null;
  for (const l of logs) {
    const text = parentWords(l);
    const t = ms(l.timestamp);
    if (!text || !Number.isFinite(t)) continue;
    if (!best || t > best.t) best = { id: l.id, text, at: l.timestamp, t };
  }
  return best ? { id: best.id, text: best.text, at: best.at } : null;
}

/** The record rows this module writes, for one child. */
export function isFromRecordRow(row: Pick<ActionLoopEntry, "source">): boolean {
  return row.source === "from-record";
}

/** Keys the parent answered within ANSWER_QUIET_DAYS of `now`. */
function quietKeys(loop: readonly ActionLoopEntry[], now: Date): Set<string> {
  const out = new Set<string>();
  for (const r of loop) {
    if (!isFromRecordRow(r) || !r.recordKey) continue;
    const t = ms(r.outcomeAt ?? r.acceptedAt);
    if (Number.isFinite(t) && now.getTime() - t < ANSWER_QUIET_DAYS * DAY_MS) out.add(r.recordKey);
  }
  return out;
}

/** The plan opener: an active plan (a step not done) — newest plan first. */
function planOpener(input: FromRecordInput, note: ReturnType<typeof latestNote>): FromRecordOpener | null {
  const plan = input.plans.find((p) => (p.phases ?? []).some((ph) => (ph.steps ?? []).some((s) => planStepStatus(s) !== "done")));
  if (!plan) return null;
  // the last step the parent rated (loop outcome) …
  const rated = input.loop
    .filter((r) => r.source === "plan" && r.planId === plan.id && r.outcome && r.recommendation.trim())
    .sort((a, b) => (b.outcomeAt ?? "").localeCompare(a.outcomeAt ?? ""))[0];
  if (rated) {
    return { key: `plan:${plan.id}`, kind: "plan", topic: plan.title?.trim() || null, quote: rated.recommendation.trim(), quoteSource: "step", quoteAt: rated.outcomeAt ?? rated.acceptedAt };
  }
  // … else the parent's latest written note, else the topic alone
  return {
    key: `plan:${plan.id}`,
    kind: "plan",
    topic: plan.title?.trim() || null,
    quote: note?.text ?? null,
    quoteSource: note ? "parent" : null,
    quoteAt: note?.at ?? null,
  };
}

/**
 * The ONE opener for Today, or null. Pure: same input, same output.
 */
export function selectFromRecord(input: FromRecordInput): FromRecordOpener | null {
  const quiet = quietKeys(input.loop, input.now);
  const note = latestNote(input.logs);

  const plan = planOpener(input, note);
  if (plan && !quiet.has(plan.key)) return plan;

  if (note && input.now.getTime() - ms(note.at) > NOTE_STALE_DAYS * DAY_MS) {
    const key = `note:${note.id}`;
    if (!quiet.has(key)) return { key, kind: "note", topic: null, quote: note.text, quoteSource: "parent", quoteAt: note.at };
  }

  const facts = input.facts
    .filter((f) => (!f.status || f.status === "approved") && f.fact?.trim() && factHasTimeWord(f.fact) && Number.isFinite(ms(f.createdAt)))
    .sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
  for (const f of facts) {
    const key = `fact:${f.id}`;
    if (quiet.has(key)) continue;
    return { key, kind: "fact", topic: null, quote: f.fact.trim(), quoteSource: "fact", quoteAt: f.createdAt };
  }
  return null;
}

/** The local day key (YYYY-MM-DD) — same calendar the action loop ids use. */
function localDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The ledger id of today's answer for a child (one answer per day). */
export function fromRecordRowId(childId: string, at: Date = new Date()): string {
  return `record.${childId}.${localDay(at)}`;
}

/** Today's answer row, when the parent already answered (the card becomes a receipt). */
export function answeredToday(loop: readonly ActionLoopEntry[], childId: string, now: Date = new Date()): ActionLoopEntry | null {
  const id = fromRecordRowId(childId, now);
  return loop.find((r) => r.id === id && isFromRecordRow(r)) ?? null;
}

/**
 * What an answer writes — one row on the existing action-loop ledger
 * (`actionLoops`, already in CHILD_SUBCOLLECTIONS), never a new collection.
 * `outcome` stays unset: the reflection is the parent's read of how things
 * are, not a rating of a step Arbor suggested.
 */
export function fromRecordEntry(
  opener: FromRecordOpener,
  answer: FromRecordAnswer,
  childId: string,
  at: Date = new Date(),
): ActionLoopEntry {
  const iso = at.toISOString();
  return {
    id: fromRecordRowId(childId, at),
    recommendation: (opener.quote ?? opener.topic ?? "").trim(),
    source: "from-record",
    capacity: "tiny",
    status: "completed",
    acceptedAt: iso,
    outcomeAt: iso,
    recordKey: opener.key,
    reflection: answer,
  };
}

/** i18n keys for an opener's question and answers (EN + HE in lib/i18n.ts). */
export function fromRecordQuestionKey(opener: FromRecordOpener): string {
  return opener.kind === "fact" ? "today.record.q.fact" : opener.kind === "plan" ? "today.record.q.plan" : "today.record.q.note";
}
export function fromRecordAnswerKey(opener: FromRecordOpener, answer: FromRecordAnswer): string {
  return `today.record.a.${opener.kind === "fact" ? "fact" : "change"}.${answer}`;
}
export function fromRecordMetaKey(opener: FromRecordOpener): string | null {
  if (!opener.quoteSource) return null;
  return opener.quoteSource === "step" ? "today.record.meta.step" : opener.quoteSource === "fact" ? "today.record.meta.fact" : "today.record.meta.note";
}

/* ── Pronouns (B-TODAY-28) ─────────────────────────────────────────────────
   EN strings that refer to the child with "they/their/them" read as he/she
   when the profile says boy/girl; 'other'/'unspecified' keep the neutral
   forms. HE prompt strings are impersonal (plural-impersonal verbs) and stay
   as written; new HE strings carry .boy/.girl variants. */
export type ChildGender = "girl" | "boy" | "other" | "unspecified" | undefined;

export function genderedEn(text: string, gender: ChildGender): string {
  if (gender !== "boy" && gender !== "girl") return text;
  const he = gender === "boy";
  const subj = he ? "he" : "she";
  const obj = he ? "him" : "her";
  const poss = he ? "his" : "her";
  const cap = (s: string, like: string) => (like[0] === like[0].toUpperCase() ? s[0].toUpperCase() + s.slice(1) : s);
  return text
    .replace(/\b(are) (they)\b/gi, (_m, a: string, b: string) => `${cap("is", a)} ${cap(subj, b)}`)
    .replace(/\b(they)'re\b/gi, (_m, a: string) => `${cap(subj, a)}'s`)
    .replace(/\b(they) (are)\b/gi, (_m, a: string) => `${cap(subj, a)} is`)
    .replace(/\b(they) (were)\b/gi, (_m, a: string) => `${cap(subj, a)} was`)
    .replace(/\b(they) (have)\b/gi, (_m, a: string) => `${cap(subj, a)} has`)
    .replace(/\bthemselves\b/gi, (m) => cap(he ? "himself" : "herself", m))
    .replace(/\bthey\b/gi, (m) => cap(subj, m))
    .replace(/\btheir\b/gi, (m) => cap(poss, m))
    .replace(/\bthem\b/gi, (m) => cap(obj, m));
}

/** The HE variant key for a string about the child: `.boy` / `.girl`, else the neutral key. */
export function genderedKey(key: string, gender: ChildGender): string {
  return gender === "boy" || gender === "girl" ? `${key}.${gender}` : key;
}
