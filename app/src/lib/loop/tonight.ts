/**
 * B-LOOP-10 — TONIGHT: three questions, each answer lands where the item
 * says, nothing is inferred.
 *   1 · Practice — did you try today's "say"? (outcome chosen by the parent:
 *       helped · somewhat · not_today → the day's actionLoops dose row);
 *       "What happened?" is one line saved as a moment filed on the
 *       practice's shelf (the parent is answering about that shelf).
 *   2 · Her day — ONE question from today's own moment (template + the
 *       parent's own words, zero model calls) or the generic "What did {name}
 *       say today?"; the answer is a `quote` keepsake → "Things {name} said".
 *   3 · Notice — one watch-for card from a shelf step 1 did not use.
 * Skipping a step writes nothing. Progress is "1 of 3" only.
 */
import type { BehaviorLog } from "../../types";
import type { ActionLoopEntry, ActionOutcome } from "../../actionLoop/model";
import type { KeepsakeDoc } from "../firstsKeepsake";
import { dayKey } from "../../practice/signals";
import { localDay } from "../milestones/observe";
import { WHAT_HAPPENED_CAP } from "../../ai/journalContext";

export const TONIGHT_STEPS = 3;

/** Step 2's question: the key and its vars (the caller resolves Hebrew slash forms). */
export function tonightDayQuestion(logs: readonly BehaviorLog[], now: Date = new Date()): { key: string; vars: Record<string, string> } {
  const today = dayKey(now);
  const moment = logs
    .filter((l) => l.timestamp && dayKey(new Date(l.timestamp)) === today && (l.trigger ?? "").trim().length >= 3)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  if (!moment) return { key: "elev.loop.tonight.day.generic", vars: {} };
  const words = moment.trigger.replace(/\s+/g, " ").trim();
  const clipped = words.length > 60 ? `${words.slice(0, 57).trimEnd()}…` : words;
  return { key: "elev.loop.tonight.day.fromMoment", vars: { moment: clipped } };
}

/** The outcome write for step 1: today's dose row with the parent's outcome. */
export function tonightOutcomeEntry(dose: ActionLoopEntry, outcome: ActionOutcome, at: Date = new Date()): ActionLoopEntry {
  return { ...dose, status: "completed", outcome, outcomeAt: at.toISOString() };
}

/** Step 1's "What happened?" line on the day's dose row (B-LOOP-13: the
 *  night answer tomorrow's practice is chosen from, and — P5-LOOP critic
 *  c2 r1 — tomorrow morning's line 1 on Today). One line, whitespace folded,
 *  <= WHAT_HAPPENED_CAP; an empty line writes nothing (null). */
export function tonightLineEntry(dose: ActionLoopEntry, text: string): ActionLoopEntry | null {
  const line = text.replace(/\s+/g, " ").trim().slice(0, WHAT_HAPPENED_CAP);
  return line ? { ...dose, whatHappened: line } : null;
}

/** FNV-1a for a stable quote id. */
const fnv = (s: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
};

export const QUOTE_MAX = 280;

/**
 * Step 2's write: a `quote` keepsake in the registered `keepsakes`
 * collection (exported and erased with the child). It carries no milestone
 * id, so every milestone-keepsake reader skips it (`keepsakeMapFromDocs`
 * requires one; the record folds none).
 */
export function quoteKeepsakeDoc(note: string, at: Date = new Date()): KeepsakeDoc | null {
  const text = note.replace(/\s+/g, " ").trim().slice(0, QUOTE_MAX);
  if (!text) return null;
  const iso = at.toISOString();
  return {
    id: `quote-${dayKey(at)}-${fnv(text)}`,
    kind: "quote",
    milestoneId: "",
    note: text,
    noticedOn: localDay(at),
    createdAt: iso,
    updatedAt: iso,
  };
}

export interface KeptQuote {
  id: string;
  note: string;
  noticedOn: string;
}

/** The quote keepsakes, newest first (anything else in the collection is skipped). */
export function quotesFromDocs(docs: readonly unknown[]): KeptQuote[] {
  const out: KeptQuote[] = [];
  for (const raw of docs) {
    if (!raw || typeof raw !== "object") continue;
    const d = raw as Record<string, unknown>;
    if (d.kind !== "quote" || typeof d.id !== "string" || typeof d.note !== "string" || !d.note.trim()) continue;
    const on = typeof d.noticedOn === "string" ? d.noticedOn : "";
    out.push({ id: d.id, note: d.note, noticedOn: on });
  }
  return out.sort((a, b) => b.noticedOn.localeCompare(a.noticedOn) || b.id.localeCompare(a.id));
}

/** Quotes grouped by month (YYYY-MM), newest month first. */
export function quotesByMonth(quotes: readonly KeptQuote[]): { month: string; quotes: KeptQuote[] }[] {
  const groups = new Map<string, KeptQuote[]>();
  for (const q of quotes) {
    const month = q.noticedOn.slice(0, 7) || "undated";
    const list = groups.get(month) ?? [];
    list.push(q);
    groups.set(month, list);
  }
  return [...groups.entries()].map(([month, list]) => ({ month, quotes: list }));
}

/** ONE quote as plain text (never a list share): the words and the day. */
export function quoteShareText(q: KeptQuote, childName: string, dateLabel: string): string {
  const who = childName.trim();
  return [`“${q.note}”`, [who, dateLabel].filter(Boolean).join(", ")].filter(Boolean).join("\n");
}
