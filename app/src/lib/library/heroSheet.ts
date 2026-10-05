/**
 * lib/library/heroSheet — B-BOOK-01/08: where the child's hero sprites come from.
 *
 * A hero sheet is one transparent sprite per pose (WebP with alpha), cropped
 * to its opaque box, authored facing the viewer's right unless the pose id
 * says otherwise (`run-staff-left`). Pose ids are an OPEN set (RULINGS ruling
 * 2): a page asks for a pose by name and the sheet resolves it — from its
 * manifest, else (DEV fixture) from the file convention `<base>/<pose>.webp`.
 * A missing sheet or pose renders the page without the hero (never a crash,
 * never a real photo).
 *
 * The sheet's `manifest.json` (written by scripts/import-book-art.py) adds,
 * per pose, the measured geometry the compositor needs (aspect, feet anchor,
 * feet width) and, per page, an optional PRINT: the page's composite after the
 * one-time print pass (BR4), shown as the page's whole art instead of plate +
 * sprite.
 *
 * Providers, in order:
 *  1. DEV fixture (the proof only): `public/_dev/hero-sheets/<sheetId>/`,
 *     selected by the review URL's `?hero=<sheetId>`. `public/_dev/` is
 *     git-ignored: a sheet made from a real child's likeness is never committed.
 *  2. (later) the child's stored sheet — lane B §5.6; not built.
 */
import type { AnchorOf, SpriteAnchor } from "./bookPageLayout";
import { loadStaticJson } from "./staticJson";
import type { BookReaderChild, Pose } from "./types";

export interface HeroPrint {
  url: string;
  width: number;
  height: number;
}

export interface HeroSheet {
  id: string;
  /** Manifest: public URL per pose id. */
  poses: Record<Pose, string>;
  /** File convention for poses not in the manifest: `<base>/<pose>.webp`. */
  base?: string;
  /** Measured sprite geometry per pose. */
  anchors?: Record<Pose, SpriteAnchor>;
  /** Printed pages by page id. */
  prints?: Record<string, HeroPrint>;
}

/** A sheet id / pose id / file is a path segment: letters, digits, '-', '_'. */
const SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;
const FILE = /^(?:prints\/)?[A-Za-z0-9_-]{1,64}\.webp$/;

/** The DEV fixture sheet for an id, before its manifest is read. */
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

/** The layout's anchor lookup for this sheet (undefined pose → no anchor). */
export function sheetAnchorOf(sheet: HeroSheet | null): AnchorOf {
  return (pose) => (sheet?.anchors && Object.prototype.hasOwnProperty.call(sheet.anchors, pose) ? sheet.anchors[pose] : undefined);
}

/** The print for a page, when the sheet has one. */
export function heroPrint(sheet: HeroSheet | null, pageId: string): HeroPrint | null {
  return sheet?.prints && Object.prototype.hasOwnProperty.call(sheet.prints, pageId) ? sheet.prints[pageId] : null;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const n01 = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
const pos = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/** Merge a manifest (untrusted JSON) into a base sheet. Bad entries are dropped. */
export function applySheetManifest(base: HeroSheet, raw: unknown): HeroSheet {
  if (!isObj(raw) || !base.base) return base;
  const poses: Record<Pose, string> = { ...base.poses };
  const anchors: Record<Pose, SpriteAnchor> = { ...(base.anchors ?? {}) };
  for (const [pose, v] of isObj(raw.poses) ? Object.entries(raw.poses) : []) {
    if (!SEGMENT.test(pose) || !isObj(v)) continue;
    if (typeof v.file === "string" && FILE.test(v.file)) poses[pose] = `${base.base}/${v.file}`;
    if (pos(v.aspect) && n01(v.footX) && n01(v.footW)) anchors[pose] = { aspect: v.aspect, footX: v.footX, footW: v.footW };
  }
  const prints: Record<string, HeroPrint> = { ...(base.prints ?? {}) };
  for (const [pageId, v] of isObj(raw.prints) ? Object.entries(raw.prints) : []) {
    if (!SEGMENT.test(pageId)) continue;
    const file = typeof v === "string" ? v : isObj(v) && typeof v.file === "string" ? v.file : null;
    if (!file || !FILE.test(file)) continue;
    const w = isObj(v) && pos(v.w) ? v.w : 1920;
    const h = isObj(v) && pos(v.h) ? v.h : 1280;
    prints[pageId] = { url: `${base.base}/${file}`, width: w, height: h };
  }
  return { ...base, poses, anchors, prints };
}

/** The hero sheet for this child (sync: no manifest), or null. */
export function resolveHeroSheet(child: Pick<BookReaderChild, "heroSheetId">, opts: { dev: boolean }): HeroSheet | null {
  const id = child.heroSheetId?.trim();
  if (opts.dev && id) return devHeroSheet(id);
  return null;
}

/** The hero sheet with its manifest read (pose files, anchors, prints). A
 *  missing manifest = the file convention, no anchors, no prints. */
export async function loadHeroSheet(child: Pick<BookReaderChild, "heroSheetId">, opts: { dev: boolean }): Promise<HeroSheet | null> {
  const base = resolveHeroSheet(child, opts);
  if (!base?.base) return base;
  return applySheetManifest(base, await loadStaticJson(`${base.base}/manifest.json`));
}
