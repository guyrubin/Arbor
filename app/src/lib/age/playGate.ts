/**
 * B-PLAY-24 — the PARENT-side age gate on play, stories and the Kid Mode door:
 * a two-year-old is offered what fits two.
 *
 * Reads the band tags the Kids sessions put on their worlds and books
 * (`ageBands` on components/kidmode/kidWorlds; `ageRange` on the hero
 * stories) through lib/age `fits` — it never writes or re-tags kid-register
 * content. Unknown age metadata is HIDDEN under 36 months and shown from 36.
 *
 *   · under 36 months: Practice leads with three parent-led "together" cards
 *     (copy-me faces · roll the ball · the same bedtime) instead of game
 *     tiles; the Kid Mode door is hidden (never removed) and one line says
 *     "From 3, {name} can play on her own";
 *   · Tonight offers a story only when the shelf has one that fits her band,
 *     else the parent's own question (no Read button).
 * Pure; zero model calls. The only age a parent reads is the child's own.
 */
import { bandFor, fits, isUnderThree, yearsNotation, type AgedChild, type CanonicalBand } from "./forChild";

/** Months from which a child may play on her own (the Kid Mode door opens). */
export const KID_MODE_FROM_MONTHS = 36;

/** Anything a parent tile can offer, with its (optional) band tags. */
export type BandTagged = { readonly ageBands?: readonly string[] | null };

/** Does this tagged item fit the band? Untagged: hidden under 36 months, shown from 36. */
export function offerFits(item: BandTagged, band: CanonicalBand): boolean {
  const tags = item.ageBands ?? [];
  if (!tags.length) return band.minMonths >= KID_MODE_FROM_MONTHS;
  return fits(tags, band);
}

/** The items (worlds, tiles) that fit the child's band, in their own order. */
export function offersForChild<T extends BandTagged>(items: readonly T[], child: AgedChild | null | undefined, now?: Date): T[] {
  const band = bandFor(child, now);
  return items.filter((item) => offerFits(item, band));
}

/** The Kid Mode door opens from three (the band, so a corrected preterm age counts). */
export function kidModeOpenFor(child: AgedChild | null | undefined, now?: Date): boolean {
  return !isUnderThree(child, now);
}

/** A hero story's `ageRange` (inclusive whole years) fits the child's band. */
export function storyFitsChild(story: { ageRange?: readonly number[] | null }, child: AgedChild | null | undefined, now?: Date): boolean {
  const r = story.ageRange;
  const band = bandFor(child, now);
  if (!r || r.length < 2) return band.minMonths >= KID_MODE_FROM_MONTHS;
  return fits([yearsNotation(r[0], r[1])], band);
}

/** The three parent-led "together" cards for under-threes (i18n `elev.ages.together.<id>.*`). */
export const TOGETHER_CARDS = ["copy-faces", "roll-ball", "same-bedtime"] as const;
export type TogetherCardId = (typeof TOGETHER_CARDS)[number];
