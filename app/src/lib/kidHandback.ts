/**
 * kidHandback — B-BOOK-66 (mechanism half) + B-GAME-23: what the child's Kid
 * Mode hands back to the parent's Today, as receipt-sized rows inside the
 * existing "Today at a glance" list (never a card, never a module).
 *
 *  · book — the day after a finished library book (the `bookReads` ledger, the
 *    only thing the kid side writes), the book's hero-free cover plate, its
 *    authored `tomorrow` line and its `askAfter` question. Dismissible; "Log
 *    it" opens the existing capture sheet EMPTY, so only the parent's own
 *    words, confirmed by the parent, become a Journal moment (no automatic
 *    record, no observation from a read).
 *  · play — "Play at home": the Sneak & Freeze visits of the last seven days,
 *    the experiences met (the cat's tricks, never an ability) and one
 *    off-screen idea. No arrow, delta, band, trend or count of firsts.
 *
 * FIREWALL (binding): a read row is read for `id`, `bookId` and `finishedAt`
 * only (never the path or a choice: the ledger holds none); a sitting row for
 * `id`, `game`, `day` and `experiences` only (never rounds, prizes, duration,
 * catches or a level). Parent register only: nothing here is imported under
 * components/kidmode, and the child never sees either row.
 *
 * Wrong-child, unfinished, unreleased (a fixture or unknown book) and
 * missing-metadata (no `tomorrow`) controls all yield no row. Pure functions
 * plus one per-child device key for the dismissals (swept with the child).
 */
import { LIBRARY_BOOKS, getPlate } from "./library/books";
import { bookAskAfter } from "./bookAskAfter";
import type { BookRead } from "./bookReads";
import { dayKey } from "../practice/signals";
import { SNEAK_GAME_ID } from "../components/kidmode/games/sneakFreeze/record";

export interface BookTomorrowRow {
  /** The dismissal key: the read row's id. */
  key: string;
  bookId: string;
  title: string;
  tomorrow: string;
  askAfter: string;
  /** The book's cover PLATE (child-free by provenance), else null. */
  cover: string | null;
}

/** The experiences a Sneak & Freeze sitting can meet, in display order. */
export const PLAY_EXPERIENCES = ["sunglasses", "fake-turn", "dash"] as const;
export type PlayExperience = (typeof PLAY_EXPERIENCES)[number];

export interface PlayAtHomeRow {
  /** The dismissal key: the latest sitting's id. */
  key: string;
  game: typeof SNEAK_GAME_ID;
  /** Finished sittings in the last seven days (a count of visits, nothing else). */
  visits: number;
  experiences: PlayExperience[];
}

export interface HandbackDismissed {
  book?: string;
  play?: string;
}

const DAY_MS = 86_400_000;

/** The calendar day before `now`, local time. */
function yesterdayKey(now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12);
  return dayKey(d);
}

/**
 * The book row for today: the latest read that finished YESTERDAY (local
 * day) of a released library book carrying a `tomorrow` line, unless the
 * parent dismissed that read. Reads only id, bookId and finishedAt.
 */
export function bookTomorrowRow(
  reads: readonly Pick<BookRead, "id" | "bookId" | "finishedAt">[],
  now: Date,
  who: { lang: "en" | "he"; gender?: string; name: string },
  dismissed: HandbackDismissed = {},
): BookTomorrowRow | null {
  const yesterday = yesterdayKey(now);
  let best: { id: string; bookId: string; ms: number } | null = null;
  for (const r of reads) {
    if (typeof r?.id !== "string" || typeof r.bookId !== "string" || typeof r.finishedAt !== "string") continue;
    const ms = Date.parse(r.finishedAt);
    if (!Number.isFinite(ms) || dayKey(new Date(ms)) !== yesterday) continue;
    if (!Object.prototype.hasOwnProperty.call(LIBRARY_BOOKS, r.bookId)) continue; // unreleased or unknown
    if (!LIBRARY_BOOKS[r.bookId].parent.tomorrow) continue; // missing metadata
    if (!best || ms > best.ms) best = { id: r.id, bookId: r.bookId, ms };
  }
  if (!best || dismissed.book === best.id) return null;
  const book = LIBRARY_BOOKS[best.bookId];
  const asked = bookAskAfter(book.id, who.lang, who.gender, who.name);
  const tomorrow = book.parent.tomorrow![who.lang].trim();
  if (!asked || !asked.question || !tomorrow) return null;
  const plate = getPlate(book.id, book.cover.plateId);
  return {
    key: best.id,
    bookId: book.id,
    title: asked.title,
    tomorrow,
    askAfter: asked.question,
    cover: plate && plate.provenance.childFree ? plate.file : null,
  };
}

/**
 * The "Play at home" row: the finished Sneak & Freeze sittings of the last
 * seven days (today included), the experiences met in them, unless the parent
 * dismissed the latest sitting. Reads only id, game, day and experiences.
 */
export function playAtHomeRow(
  events: readonly { id?: unknown; game?: unknown; day?: unknown; experiences?: unknown }[],
  now: Date,
  dismissed: HandbackDismissed = {},
): PlayAtHomeRow | null {
  const days = new Set(Array.from({ length: 7 }, (_, i) => dayKey(new Date(now.getTime() - i * DAY_MS))));
  let visits = 0;
  let latest: { id: string; day: string } | null = null;
  const met = new Set<string>();
  for (const e of events) {
    if (e?.game !== SNEAK_GAME_ID || typeof e.day !== "string" || !days.has(e.day) || typeof e.id !== "string") continue;
    visits += 1;
    if (Array.isArray(e.experiences)) for (const x of e.experiences) if (typeof x === "string") met.add(x);
    if (!latest || e.day > latest.day || (e.day === latest.day && e.id > latest.id)) latest = { id: e.id, day: e.day };
  }
  if (!latest || visits === 0 || dismissed.play === latest.id) return null;
  return { key: latest.id, game: SNEAK_GAME_ID, visits, experiences: PLAY_EXPERIENCES.filter((x) => met.has(x)) };
}

/* ── Dismissals: one device key per child (`.${childId}` last, so the child
 *    sweep removes it — lib/childLocalState isChildScopedKey). ─────────── */

export const handbackDismissKey = (childId: string): string => `arbor.today.handback.${childId}`;

export function readHandbackDismissed(childId: string, storage: Pick<Storage, "getItem"> | null = safeStorage()): HandbackDismissed {
  if (!childId || !storage) return {};
  try {
    const raw = JSON.parse(storage.getItem(handbackDismissKey(childId)) ?? "{}") as Record<string, unknown>;
    return {
      ...(typeof raw.book === "string" ? { book: raw.book } : {}),
      ...(typeof raw.play === "string" ? { play: raw.play } : {}),
    };
  } catch {
    return {};
  }
}

export function writeHandbackDismissed(childId: string, next: HandbackDismissed, storage: Pick<Storage, "setItem"> | null = safeStorage()): void {
  if (!childId || !storage) return;
  try {
    storage.setItem(handbackDismissKey(childId), JSON.stringify(next));
  } catch {
    /* a full or blocked store only means the row shows again */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
