/**
 * kidBooks — B-KID-88 / B-KID-85: the ONE list of books a child sees in Kid
 * Mode ("My books" on the home row and the library grid read the same list).
 *
 * Rules, in order (the same rules the story catalogue and Tonight's pick use):
 *   1. language — only stories that can be told in the child's story language
 *      (storiesForLanguage, B-KID-46);
 *   2. age — the child's age view (filterByAge, W0.7); "Show all ages" lifts
 *      it. The same view gates the reader's pin, so every cover opens its book;
 *   3. order — books the child has opened first (most recent first), then the
 *      rest, where books illustrated in the child's theme lead (a stable
 *      partition, so the catalogue order holds inside each half).
 *
 * No storage or model calls. A bounded clock check rejects corrupt/future-dated
 * history without modifying the stored records; tests can pin nowMs.
 */
import { KID_SHELF_STORIES, kidShelfHolds, storiesForLanguage, storyHasLanguage } from "../../lib/heroJourneys";
import { filterByAge, windowFromRange } from "../../lib/ageFilter";
import type { HeroStorySpec } from "../../types";

export type KidBookState = "finished" | "started" | "new";

export interface KidBook {
  story: HeroStorySpec;
  state: KidBookState;
}

export interface KidBooksInput {
  lang: "en" | "he";
  /** Child's age in months; null = no age view. */
  ageMonths: number | null;
  showAllAges: boolean;
  /** True when the child's theme has a cover for the story. */
  hasCover: (storyId: string) => boolean;
  /** The child's heroRuns (storyId + completion + start time). */
  runs: readonly { storyId: string; startedAt?: string; completedAt?: string }[];
  /** Test seam: the catalogue (defaults to the kid shelf, B-BOOK-29). */
  stories?: readonly HeroStorySpec[];
  /** Fixed reference instant for deterministic imported-history checks (defaults to now). */
  nowMs?: number;
}

/**
 * K2 (one David book per child): the kid shelf for THIS child - the shelf
 * without every legacy story a library book the child has supersedes
 * (Book.replacesStory: Five Smooth Stones replaces david-and-goliath). A child
 * without the library book keeps the legacy story.
 */
export function kidShelfFor(libraryBooks: readonly { book: { kind?: string; replacesStory?: string } }[], shelf: readonly HeroStorySpec[] = KID_SHELF_STORIES): HeroStorySpec[] {
  // B-BOOK-75: a PLAN book supersedes no legacy story
  const replaced = new Set(libraryBooks.map((e) => (e.book.kind === "plan" ? undefined : e.book.replacesStory)).filter((id): id is string => !!id));
  return shelf.filter((s) => !replaced.has(s.id));
}

/**
 * Untrusted imported/offline history must not change a child's shelf state or
 * sort order unless it contains a valid, non-future ISO timestamp. Compare
 * instants, not their textual timezone offsets.
 */
function validRunInstant(timestamp: string | undefined, nowMs: number): number | null {
  // Date.parse normalizes impossible dates (e.g. 2026-02-30 becomes March 2).
  // Never let an imported/offline timestamp invent a finished book or reorder
  // a child's shelf. Check the civil date before converting its offset to UTC.
  if (typeof timestamp !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(timestamp);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const hour = Number(match[4]), minute = Number(match[5]), second = Number(match[6]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1] || hour > 23 || minute > 59 || second > 59) return null;
  const instant = Date.parse(timestamp);
  return Number.isFinite(instant) && instant >= 0 && instant <= nowMs + 5 * 60_000 ? instant : null;
}

export function kidBooks(input: KidBooksInput): KidBook[] {
  // B-BOOK-29: the kid shelf (canonical-text books only) unless a list is injected.
  const told = storiesForLanguage(input.stories ?? KID_SHELF_STORIES, input.lang);
  // Latest valid run per story → truthful state and absolute-time recency.
  // A corrupt completion cannot make a never-finished story appear finished.
  const nowMs = input.nowMs ?? Date.now();
  const opened = new Map<string, { state: KidBookState; at: number }>();
  for (const r of input.runs) {
    const completed = validRunInstant(r.completedAt, nowMs);
    const started = validRunInstant(r.startedAt, nowMs);
    if (completed === null && started === null) continue;
    const at = Math.max(completed ?? -1, started ?? -1);
    const state: KidBookState = completed !== null ? "finished" : "started";
    const prev = opened.get(r.storyId);
    if (!prev) opened.set(r.storyId, { state, at });
    else opened.set(r.storyId, { state: prev.state === "finished" || state === "finished" ? "finished" : "started", at: Math.max(at, prev.at) });
  }
  const ageVisible = input.showAllAges ? told : filterByAge(told, (s) => windowFromRange(s.ageRange), input.ageMonths).visible;
  const visibleIds = new Set(ageVisible.map((s) => s.id));
  const illustratedFirst = (list: HeroStorySpec[]) => [...list.filter((s) => input.hasCover(s.id)), ...list.filter((s) => !input.hasCover(s.id))];
  const openedStories = told
    .filter((s) => visibleIds.has(s.id) && opened.has(s.id))
    .sort((a, b) => opened.get(b.id)!.at - opened.get(a.id)!.at);
  const fresh = illustratedFirst(told.filter((s) => visibleIds.has(s.id) && !opened.has(s.id)));
  return [
    ...openedStories.map((story) => ({ story, state: opened.get(story.id)!.state })),
    ...fresh.map((story) => ({ story, state: "new" as const })),
  ];
}

/**
 * B-KID-124: the ONE gate a tapped or pinned book passes before the reader
 * opens it - the same two rules as the list (language, then the age view).
 * Every id the home row, the Tonight banner and the library grid show passes
 * it (guard: kidBookPin.test), so a cover never opens anything but its book.
 * A single story is judged on its own: a near-band story the full list hides
 * (enough in-band books) still opens when pinned, never the reverse.
 */
export function kidBookOpenable(
  story: HeroStorySpec,
  ctx: { lang: "en" | "he"; ageMonths: number | null; showAllAges: boolean },
): boolean {
  if (kidShelfHolds(story.id)) return false; // B-BOOK-29: retired or held
  if (!storyHasLanguage(story, ctx.lang)) return false;
  return ctx.showAllAges || filterByAge([story], (s) => windowFromRange(s.ageRange), ctx.ageMonths).visible.length > 0;
}
