/**
 * tonightsStory — the KID-25 seam: ONE story for tonight, not a catalogue.
 *
 * The kid home's banner says "Today's adventure / Start a hero story", and it
 * opened the full 18-story catalogue (5,287 px tall). A promise of one thing
 * that delivers a library is the same broken promise as a button that does
 * nothing: the child has to read, compare and choose before anything happens.
 *
 * This picks tonight's story deterministically from the local day key, so it is
 * stable for the whole day (the banner and the surface it opens name the same
 * story), rotates every night, and needs no state, no clock inside the maths
 * and no model call. Pure — the caller passes `today`.
 *
 * Age is NOT decided here. The chosen id is a REQUEST; HeroJourneyTab honours it
 * only if the story survives that surface's own age view (W0.7), so a child too
 * young for the canon still gets the honest empty state instead of a story
 * written for someone else.
 */
import { HERO_STORIES } from "../../lib/heroJourneys";

/** Stable 32-bit hash of a short string (FNV-1a). No crypto, no dependencies. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The id of tonight's hero story.
 *
 * @param today  local day key, `YYYY-MM-DD` (usePracticeData's `today`)
 * @param seed   optional per-child seed so two children do not share a rotation
 */
export function chooseTonightsStory(today: string, seed = ""): string {
  const stories = HERO_STORIES;
  if (stories.length === 0) return "";
  return stories[hash(`${today}|${seed}`) % stories.length].id;
}
