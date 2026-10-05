/**
 * lib/library/heroSheet — B-BOOK-01: where the child's hero sprites come from.
 *
 * A hero sheet is one transparent sprite per pose (WebP/PNG with alpha), feet
 * at the bottom centre of the image, authored facing the viewer's right (the
 * compositor flips). Pose ids are an OPEN set (RULINGS, ruling 2): a page asks
 * for a pose by name and the sheet resolves it — from its manifest
 * (`poses`), else (DEV fixture) from the file convention `<base>/<pose>.webp`.
 * A missing sheet or pose renders the page without the hero (never a crash,
 * never a real photo).
 *
 * Providers, in order:
 *  1. DEV fixture (the proof only): files at
 *     `public/_dev/hero-sheets/<sheetId>/<pose>.webp`, selected by the review
 *     URL's `?hero=<sheetId>`. `public/_dev/` is git-ignored: a sheet made
 *     from a real child's likeness must never be committed.
 *  2. (later) the child's stored sheet — lane B §5.6; not built.
 */
import type { BookReaderChild, Pose } from "./types";

export interface HeroSheet {
  id: string;
  /** Manifest: public URL per pose id. */
  poses: Record<Pose, string>;
  /** File convention for poses not in the manifest: `<base>/<pose>.webp`. */
  base?: string;
}

/** A sheet id / pose id is a path segment: letters, digits, '-' and '_'. */
const SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;

/** The DEV fixture sheet for an id (no existence check: a missing file is
 *  handled by the renderer's image error). */
export function devHeroSheet(sheetId: string): HeroSheet | null {
  if (!SEGMENT.test(sheetId)) return null;
  return { id: sheetId, poses: {}, base: `/_dev/hero-sheets/${sheetId}` };
}

/** The sprite URL for a pose, or null when the sheet cannot provide it. */
export function heroSpriteUrl(sheet: HeroSheet | null, pose: Pose | undefined): string | null {
  if (!sheet || !pose) return null;
  if (Object.prototype.hasOwnProperty.call(sheet.poses, pose)) return sheet.poses[pose];
  return sheet.base && SEGMENT.test(pose) ? `${sheet.base}/${pose}.webp` : null;
}

/** The hero sheet for this child, or null (the book reads without a hero). */
export function resolveHeroSheet(child: Pick<BookReaderChild, "heroSheetId">, opts: { dev: boolean }): HeroSheet | null {
  const id = child.heroSheetId?.trim();
  if (opts.dev && id) return devHeroSheet(id);
  return null;
}
