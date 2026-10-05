/**
 * lib/library/heroSheet — B-BOOK-01: where the child's hero sprites come from.
 *
 * A hero sheet is one transparent sprite per pose (WebP/PNG with alpha), feet
 * at the bottom centre of the image, authored facing the viewer's right (the
 * compositor flips). The reader asks `resolveHeroSheet(child)` once at book
 * open; a missing sheet or a missing pose renders the page without the hero
 * (never a crash, never a real photo).
 *
 * Providers, in order:
 *  1. DEV fixture (the proof only): files at
 *     `public/_dev/hero-sheets/<sheetId>/<pose>.webp`, selected by the review
 *     URL's `?hero=<sheetId>`. `public/_dev/` is git-ignored: a sheet made
 *     from a real child's likeness must never be committed.
 *  2. (later) the child's stored sheet — lane B §5.6; not built.
 */
import type { BookReaderChild, Pose } from "./types";

export const HERO_POSES: readonly Pose[] = ["run", "stand", "wave", "walk", "arms-wide", "sit"];

export interface HeroSheet {
  id: string;
  /** Public URL per pose. */
  poses: Record<Pose, string>;
}

/** A sheet id is a path segment: letters, digits, '-' and '_' only. */
const SHEET_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** The DEV fixture sheet for an id (no existence check: a missing file is
 *  handled by the renderer's image error). */
export function devHeroSheet(sheetId: string): HeroSheet | null {
  if (!SHEET_ID.test(sheetId)) return null;
  const poses = {} as Record<Pose, string>;
  for (const pose of HERO_POSES) poses[pose] = `/_dev/hero-sheets/${sheetId}/${pose}.webp`;
  return { id: sheetId, poses };
}

/** The hero sheet for this child, or null (the book reads without a hero). */
export function resolveHeroSheet(child: Pick<BookReaderChild, "heroSheetId">, opts: { dev: boolean }): HeroSheet | null {
  const id = child.heroSheetId?.trim();
  if (opts.dev && id) return devHeroSheet(id);
  return null;
}
