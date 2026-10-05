/**
 * tonightsStory — the KID-25 seam: ONE story for tonight, not a catalogue.
 *
 * The kid home's banner says "Today's adventure / Start a hero story", and it
 * opened the full 18-story catalogue (5,287 px tall). A promise of one thing
 * that delivers a library is the same broken promise as a button that does
 * nothing: the child has to read, compare and choose before anything happens.
 *
 * B-PLAY-16 — the pick now comes from the FAMILY, not a hash alone. In order:
 *   1. age-visible stories only (the same lib/ageFilter view the Stories page
 *      applies; "Show all ages" lifts it);
 *   2. unread first — a story with a heroRuns record is not re-picked while an
 *      unread one exists;
 *   3. the family charter's aims (aimVirtues(loadCharter()), lib/becoming);
 *   4. a stable hash of the local day + child as the tie-break, so the pick
 *      holds all day and rotates nightly.
 * It returns `{ story, reason }`; the parent cover shows the reason line, the
 * kid home ignores it. Both surfaces pass the SAME inputs, so the same child on
 * the same day gets the same story on the banner and the cover.
 *
 * Pure — no clock, no storage, no model call: the caller passes `today`, the
 * read ids, the aims and the child's age.
 */
import { HERO_STORIES } from "../../lib/heroJourneys";
import { filterByAge, windowFromRange } from "../../lib/ageFilter";
import type { HeroStorySpec, DevelopmentMetricId } from "../../types";

/** Stable 32-bit hash of a short string (FNV-1a). No crypto, no dependencies. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** What the family's record says about tonight's pick. */
export type TonightReason =
  | { kind: "aim"; metric: DevelopmentMetricId }
  | { kind: "unread" }
  | { kind: "day" }
  | { kind: "none" };

export interface TonightContext {
  /** Story ids with a heroRuns record (read at least once). */
  readIds?: Iterable<string>;
  /** The family charter's aims, in charter order. */
  aims?: readonly DevelopmentMetricId[];
  /** The child's age in months; null/undefined = no age view. */
  ageMonths?: number | null;
  /** The Stories page's "Show all ages" preference. */
  showAllAges?: boolean;
  /** The catalogue (defaults to HERO_STORIES; injectable for tests). */
  stories?: readonly HeroStorySpec[];
}

/** The reason line's key per aimed virtue — static keys, EN + HE in celebrate.ts. */
export const TONIGHT_AIM_REASON_KEY: Record<DevelopmentMetricId, string> = {
  courage: "elev.stories.tonight.reason.aim.courage",
  responsibility: "elev.stories.tonight.reason.aim.responsibility",
  resilience: "elev.stories.tonight.reason.aim.resilience",
  empathy: "elev.stories.tonight.reason.aim.empathy",
  wisdom: "elev.stories.tonight.reason.aim.wisdom",
  truth: "elev.stories.tonight.reason.aim.truth",
};

/** Tonight's story and why it was chosen. */
export function pickTonightsStory(
  today: string,
  seed = "",
  ctx: TonightContext = {},
): { story: HeroStorySpec | null; reason: TonightReason } {
  const all = ctx.stories ?? HERO_STORIES;
  const candidates =
    ctx.showAllAges || ctx.ageMonths == null
      ? [...all]
      : filterByAge(all, (s) => windowFromRange(s.ageRange), ctx.ageMonths).visible;
  if (candidates.length === 0) return { story: null, reason: { kind: "none" } };

  const read = new Set(ctx.readIds ?? []);
  const unread = candidates.filter((s) => !read.has(s.id));
  const pool = unread.length > 0 ? unread : candidates;

  const aims = ctx.aims ?? [];
  const aimed = pool.filter((s) => aims.includes(s.primaryMetric));
  const finalPool = aimed.length > 0 ? aimed : pool;

  const story = finalPool[hash(`${today}|${seed}`) % finalPool.length];
  const reason: TonightReason =
    aimed.length > 0
      ? { kind: "aim", metric: story.primaryMetric }
      : unread.length > 0 && unread.length < candidates.length
        ? { kind: "unread" }
        : { kind: "day" };
  return { story, reason };
}

/**
 * The id of tonight's hero story (the kid home's call site — signature
 * unchanged; the optional context makes it the same pick as the cover).
 *
 * @param today  local day key, `YYYY-MM-DD` (usePracticeData's `today`)
 * @param seed   optional per-child seed so two children do not share a rotation
 */
export function chooseTonightsStory(today: string, seed = "", ctx: TonightContext = {}): string {
  return pickTonightsStory(today, seed, ctx).story?.id ?? "";
}
