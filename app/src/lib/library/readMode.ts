/**
 * lib/library/readMode — B-BOOK-45 / B-BOOK-46: how one read of a book is
 * framed, chosen at the kid door and never by the child.
 *
 *  - "alone"    the child reads (today's reader, unchanged);
 *  - "bedtime"  the parent's bedtime time has come (the profile's
 *               `bedtimeFrom`, set in Settings › Kid Mode): a night stage
 *               with a lamp, narration at 0.92×, the reader's sounds at half
 *               gain, and a "Goodnight" ending whose only control closes the
 *               book — it can never open another (lane C T14);
 *  - "together" a grown-up reads with the child: narration off until the
 *               grown-up turns it on, larger type, and a few dialogic prompts
 *               in the PARENT register on the cover, the decision, the first
 *               branch page, the rejoin and the last page (the book's own
 *               `parent.together` talk prompt, BR3). Prompts never show in
 *               the other modes, so the child-alone screen holds no parent copy.
 *
 * Pure: no clock of its own, no storage. Bedtime ends at 06:00.
 */
import { decisionOf, rejoinPageIdOf } from "./bookShape";
import { COVER, readPath, type BookFlowState } from "./bookFlow";
import type { BookStringKey } from "./bookStrings";
import type { AnyBook, BookLabel } from "./types";

export type ReadMode = "alone" | "bedtime" | "together";
export const READ_MODES: readonly ReadMode[] = ["alone", "bedtime", "together"];

export const BEDTIME_PLAYBACK_RATE = 0.92;
export const BEDTIME_SFX_GAIN = 0.5;
export const TOGETHER_TYPE_SCALE = 1.25;
/** The times a parent can pick (Settings › Kid Mode); none = off. */
export const BEDTIME_TIMES = ["18:30", "19:00", "19:30", "20:00", "20:30"] as const;
const BEDTIME_ENDS_MIN = 6 * 60;

/** A stored bedtime (`HH:MM`, 24 h), or null when it is not one. */
export function validBedtime(value: unknown): string | null {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;
}

/** Is it bedtime now: from the parent's time until 06:00 the next morning. */
export function isBedtimeNow(from: unknown, now: Date): boolean {
  const t = validBedtime(from);
  if (!t) return false;
  const [h, m] = t.split(":").map(Number);
  const start = h * 60 + m;
  const at = now.getHours() * 60 + now.getMinutes();
  return start >= BEDTIME_ENDS_MIN ? at >= start || at < BEDTIME_ENDS_MIN : at >= start && at < BEDTIME_ENDS_MIN;
}

/** The mode of one read: Together when a grown-up asked for it, else bedtime by the clock, else alone. */
export function readModeFor(opts: { together?: boolean; bedtimeFrom?: unknown; now: Date }): ReadMode {
  if (opts.together) return "together";
  return isBedtimeNow(opts.bedtimeFrom, opts.now) ? "bedtime" : "alone";
}

export type TogetherPrompt = { key: Extract<BookStringKey, `together.${string}`> } | { label: BookLabel };

/** The parent-register prompt for the screen on show, in Together only (null elsewhere and on quiet pages). */
export function togetherPrompt(mode: ReadMode, book: AnyBook, state: Pick<BookFlowState, "at" | "choiceId">): TogetherPrompt | null {
  if (mode !== "together") return null;
  if (state.at === COVER) return { key: "together.cover" };
  const decision = decisionOf(book);
  if (decision && state.at === decision.pageId) return { key: "together.decision" };
  const choice = decision?.choices.find((c) => c.id === state.choiceId);
  if (choice && choice.branch[0]?.id === state.at) return { key: "together.branch" };
  if (state.at === rejoinPageIdOf(book)) return { key: "together.rejoin" };
  const path = readPath(book, state.choiceId);
  const last = path[path.length - 1];
  const talk = (book.parent as { together?: BookLabel }).together;
  if (last && state.at === last.id && talk) return { label: talk };
  return null;
}
