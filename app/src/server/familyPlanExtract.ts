/**
 * Family plan v1 — the deterministic floor under /api/family-plan/extract.
 *
 * The prompt (ai/prompts.ts family_plan_extract) asks the model for the dated
 * things a school message asks of the family, each pointing at a numbered
 * line with an exact quote. Whatever the model returns, this file decides
 * what the parent is shown:
 *  - the source line is taken from the MESSAGE (by number), never from the
 *    model, so the Thread always shows the parent's own words;
 *  - a quote that is not an exact span of that line is replaced by the whole
 *    line (still the parent's words, never the model's);
 *  - an unknown kind, an empty or over-long title, a line number outside the
 *    message are dropped; an impossible or far-off day becomes "" (no day:
 *    the parent adds one) instead of a guessed date;
 *  - at most MAX_ITEMS, one per (line, title).
 * The route also screens the crisis words before the model and every model
 * string after it (safety/structuredOutput), like every generation route.
 */
import { addDays, isDay, isTime } from "../lib/familyPlan/model.js";

export const MESSAGE_MAX = 4000;
export const LINES_MAX = 60;
export const LINE_MAX = 400;
export const MAX_ITEMS = 12;
export const TITLE_MAX = 80;
/** A day more than a month back or a year ahead is not a school-message day. */
export const DAYS_BACK = 31;
export const DAYS_AHEAD = 400;

export type DraftKind = "deadline" | "event" | "join" | "note";
export const DRAFT_KINDS: readonly DraftKind[] = ["deadline", "event", "join", "note"];

export interface FamilyPlanDraftItem {
  id: string;
  /** 1-based line number in the message. */
  line: number;
  /** The whole line, from the message itself. */
  sourceLine: string;
  /** The exact words on that line the item comes from. */
  quote: string;
  kind: DraftKind;
  title: string;
  /** YYYY-MM-DD, or "" when the message gives no day. */
  date: string;
  /** HH:MM, or "". */
  time: string;
}

/** The message as numbered non-empty lines (what the prompt shows and the draft points at). */
export function messageLines(text: string): string[] {
  return text
    .slice(0, MESSAGE_MAX)
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim().slice(0, LINE_MAX))
    .filter(Boolean)
    .slice(0, LINES_MAX);
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "2026-11-16 (Monday)" for the prompt. */
export function todayLine(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  return `${today} (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

export function finalizeFamilyPlanDraft(raw: unknown, lines: readonly string[], today: string): FamilyPlanDraftItem[] {
  const obj = raw && typeof raw === "object" ? (raw as { familyPlanItems?: unknown; items?: unknown }) : {};
  const list = Array.isArray(obj.familyPlanItems) ? obj.familyPlanItems : Array.isArray(obj.items) ? obj.items : [];
  const earliest = addDays(today, -DAYS_BACK);
  const latest = addDays(today, DAYS_AHEAD);
  const seen = new Set<string>();
  const out: FamilyPlanDraftItem[] = [];
  for (const entry of list) {
    if (out.length >= MAX_ITEMS) break;
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const line = typeof e.line === "number" ? Math.trunc(e.line) : Number.parseInt(String(e.line ?? ""), 10);
    if (!Number.isFinite(line) || line < 1 || line > lines.length) continue;
    const kind = DRAFT_KINDS.includes(e.kind as DraftKind) ? (e.kind as DraftKind) : null;
    if (!kind) continue;
    const title = str(e.title, TITLE_MAX + 40);
    if (!title || title.length > TITLE_MAX) continue;
    const sourceLine = lines[line - 1];
    const quoted = str(e.quote, LINE_MAX);
    const quote = quoted && sourceLine.includes(quoted) ? quoted : sourceLine;
    const rawDate = str(e.date, 10);
    const date = isDay(rawDate) && rawDate >= earliest && rawDate <= latest ? rawDate : "";
    const rawTime = str(e.time, 5);
    const time = date && isTime(rawTime) ? rawTime : "";
    // A dated "note" is an event; an undated deadline/event/join stays its kind and the parent adds the day.
    const finalKind: DraftKind = kind === "note" && date ? "event" : kind;
    const key = `${line}|${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: `draft-${out.length + 1}`, line, sourceLine, quote, kind: finalKind, title, date, time });
  }
  return out;
}
