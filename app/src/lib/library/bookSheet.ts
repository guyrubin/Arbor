/**
 * lib/library/bookSheet — K2 block 4: the child's OWN book sheet, drawn on the
 * one hero pipeline (/api/hero-pose, book poses), keyed on the parent's device
 * and stored with the child's private book files (lib/library/bookAssetPaths):
 *
 *   children/{cid}/books/{bookId}/hero-sheets/h-<avatarHash>/<pose>.webp | .png
 *   children/{cid}/books/{bookId}/hero-sheets/h-<avatarHash>/choices/<choiceId>.webp | .png
 *
 * WebP (<= 300 KB) where the device can encode it, else PNG (<= 900 KB):
 * Safari's canvas cannot encode WebP (toBlob('image/webp') returns a PNG).
 *
 * The folder is named by the hero (`h-` + the hero's avatar hash), so two
 * heroes can never mix in one sheet; a sheet id without the `h-` prefix is an
 * admin-uploaded sheet (scripts/upload-book-assets.py) and is never replaced.
 * Shared by the server write path (server/bookSheet.ts) and the device builder
 * (components/kidmode/hero/buildBookSheet.ts). Pure.
 */
import type { SpriteAnchor } from "./bookPageLayout";
import type { Book, Page } from "./types";

/** One sprite file may be at most this big (WebP with alpha). */
export const BOOK_SPRITE_MAX_BYTES = 300 * 1024;
/** The same file as PNG (a device that cannot encode WebP). */
export const BOOK_PNG_MAX_BYTES = 900 * 1024;
export type SheetImageExt = "webp" | "png";
export const SHEET_IMAGE_EXTS: readonly SheetImageExt[] = ["webp", "png"];
export const sheetImageMaxBytes = (ext: SheetImageExt): number => (ext === "png" ? BOOK_PNG_MAX_BYTES : BOOK_SPRITE_MAX_BYTES);
/** A choice card picture: 4:3 (the reader's card), WebP. */
export const BOOK_CHOICE_W = 800;
export const BOOK_CHOICE_H = 600;

const HASH = /^[0-9a-f]{16}$/;
/** The sheet id of a hero: `h-<avatarHash>`. */
export const bookSheetId = (avatarHash: string): string => `h-${avatarHash}`;
/** A sheet id this pipeline built (vs an admin-uploaded one). */
export const isHeroBookSheetId = (sheetId: unknown): boolean => typeof sheetId === "string" && /^h-[0-9a-f]{16}$/.test(sheetId);
export const isAvatarHash = (v: unknown): v is string => typeof v === "string" && HASH.test(v);

export const bookSheetPoseRel = (sheetId: string, pose: string, ext: SheetImageExt = "webp"): string => `hero-sheets/${sheetId}/${pose}.${ext}`;
export const bookSheetChoiceRel = (sheetId: string, choiceId: string, ext: SheetImageExt = "webp"): string => `hero-sheets/${sheetId}/choices/${choiceId}.${ext}`;
/** The stored file of a pose / choice in a listing, whichever format it has (WebP first). */
export function sheetFileIn(have: Iterable<string>, relOf: (ext: SheetImageExt) => string): string | null {
  const set = new Set(have);
  for (const ext of SHEET_IMAGE_EXTS) if (set.has(relOf(ext))) return relOf(ext);
  return null;
}

function pagesOf(book: Book): Page[] {
  return [book.cover, ...book.pages, ...book.decision.choices.flatMap((c) => c.branch)];
}

/** The poses the builder draws: every pose a page slot, a repair end or an art
 *  state shows — NOT a costume-only pose (`heroAlt`: the kid door never passes
 *  a costume; Book.poseFallbacks covers it). Sorted. */
export function bookSheetDrawPoses(book: Book): string[] {
  const out = new Set<string>();
  for (const p of pagesOf(book)) {
    if (p.hero) out.add(p.hero.pose);
    if (p.repair?.heroAfter) out.add(p.repair.heroAfter.pose);
    for (const st of p.artStates ?? []) if (st.pose) out.add(st.pose);
  }
  return [...out].sort();
}

/** A measured sprite anchor (untrusted input): aspect > 0, foot fractions in [0, 1]. */
export function readSpriteAnchor(raw: { aspect?: unknown; footX?: unknown; footW?: unknown } | null | undefined): SpriteAnchor | null {
  if (!raw) return null;
  const n = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
  const aspect = n(raw.aspect), footX = n(raw.footX), footW = n(raw.footW);
  if (!(aspect > 0.05 && aspect < 5) || !(footX >= 0 && footX <= 1) || !(footW > 0 && footW <= 1)) return null;
  const r4 = (v: number) => Math.round(v * 10000) / 10000;
  return { aspect: r4(aspect), footX: r4(footX), footW: r4(footW) };
}
