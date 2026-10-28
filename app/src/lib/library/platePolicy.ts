/**
 * lib/library/platePolicy — B-BOOK-27: the plate contract a book's pages must
 * meet before its plates ship, as ONE pure check the build runs
 * (platePolicy.test.ts over every book of the registry and every file under
 * public/visuals). A new file because nothing existing fits: books.test.ts
 * pins registration and geometry book by book, and bookRelease.guard pins the
 * file NAMES in the bundle; neither reads the plate's provenance, and neither
 * ties a shipped file back to a reviewed registry entry.
 *
 *  - Review (standard §4 "Provenance childFree / textFree recorded; a plate
 *    without it fails the build"; lane B §4.9): a plate is reviewed only when
 *    it is recorded child-free AND text-free AND someone is named as having
 *    viewed it. A child-painted plate (childFree false) is never reviewed.
 *  - Slot metadata (standard §4 plate spec, §7 geometry): every plate a page
 *    or an art state names is registered at a real 3:2 master size with its
 *    3:4 window inside the plate; a page's hero slot sits inside the plate
 *    with head room; a spread page carries its calm text rect (or the plate a
 *    text zone); the decision plate has a focus rect per choice unless the
 *    choice carries its own icon; a branch variant names a registered base.
 *  - Shipped files: every plate file under public/visuals/books is a
 *    reviewed, registered plate of a library book, every overlay file is one
 *    a page of that book names, and every committed plan plate
 *    (public/visuals/plans) is a reviewed plate of its pattern.
 *
 * Pure: no fs, no React; the test hands it the file list.
 */
import { allBookPages, bookChoices, decisionOf } from "./bookShape";
import type { BookPlate, PlateTable } from "./bookPlates";
import type { AnyBook } from "./types";

/** Recorded child-free and text-free, and someone is named as having viewed it. */
export function plateReviewed(plate: Pick<BookPlate, "provenance"> | undefined): boolean {
  const p = plate?.provenance;
  return !!p && p.childFree === true && p.textFree === true && typeof p.reviewedBy === "string" && p.reviewedBy.trim().length > 0;
}

/** Why a plate is not reviewed, in words a finding can carry. */
export function reviewGap(plate: Pick<BookPlate, "provenance">): string | null {
  const p = plate.provenance;
  if (!p) return "no provenance";
  if (p.childFree !== true) return "not recorded child-free";
  if (p.textFree !== true) return "not recorded text-free";
  if (typeof p.reviewedBy !== "string" || !p.reviewedBy.trim()) return "nobody recorded as having viewed it";
  return null;
}

const inUnit = (v: unknown): boolean => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
const inOpenUnit = (v: unknown): boolean => typeof v === "number" && Number.isFinite(v) && v > 0 && v < 1;

/** Slot metadata of one plate (size, window, variant base, focus rects inside). */
export function plateSlotFindings(plate: BookPlate, table: PlateTable): string[] {
  const out: string[] = [];
  const at = `${plate.bookId}/${plate.id}`;
  if (!(plate.width > 0 && plate.height > 0)) out.push(`${at}: no master size`);
  else if (Math.abs(plate.width / plate.height - 1.5) >= 0.01) out.push(`${at}: master is not 3:2 (${plate.width}x${plate.height})`);
  if (!inUnit(plate.window?.cx)) out.push(`${at}: the 3:4 window centre is not inside the plate`);
  if (plate.variantOf && !Object.prototype.hasOwnProperty.call(table, plate.variantOf)) out.push(`${at}: variant of an unregistered plate ${plate.variantOf}`);
  for (const [id, r] of Object.entries(plate.focus ?? {})) {
    if (!(inUnit(r.x) && inUnit(r.y) && r.w > 0 && r.h > 0 && r.x + r.w <= 1 && r.y + r.h <= 1)) out.push(`${at}: focus rect ${id} is not inside the plate`);
  }
  return out;
}

/**
 * Every finding for one book: each plate a page or an art state names is
 * registered, reviewed and carries its slot metadata; each page's hero slot
 * and each spread's text rect are present and inside the plate; the decision
 * plate shows each choice. An empty list = the book's plates may ship.
 */
export function bookPlateFindings(book: AnyBook, table: PlateTable): string[] {
  const out: string[] = [];
  const named = new Set<string>();
  const own = (id: string) => Object.prototype.hasOwnProperty.call(table, id);
  for (const page of allBookPages(book)) {
    const at = `${book.id}/${page.id}`;
    named.add(page.plateId);
    for (const st of page.artStates ?? []) if (st.plateId) named.add(st.plateId);
    if (!own(page.plateId)) {
      out.push(`${at}: plate ${page.plateId} is not registered`);
      continue;
    }
    for (const slot of [page.hero, page.repair?.heroAfter, ...Object.values(page.heroAlt ?? {})]) {
      if (!slot) continue;
      if (!(inOpenUnit(slot.x) && inOpenUnit(slot.y) && inOpenUnit(slot.scale) && slot.y - slot.scale > 0)) out.push(`${at}: hero slot (${slot.pose}) is not inside the plate with head room`);
    }
    if (page.type === "spread" && !page.textRect && !table[page.plateId].textZone) out.push(`${at}: a spread page with no text rect and no plate text zone`);
    if (page.textRect && !page.textRect.every(inUnit)) out.push(`${at}: text rect is not inside the plate`);
    if (page.phoneCrop != null && !inUnit(page.phoneCrop)) out.push(`${at}: phone window is not inside the plate`);
  }
  const decision = decisionOf(book);
  if (decision) {
    const page = book.pages.find((p) => p.id === decision.pageId);
    const plate = page && own(page.plateId) ? table[page.plateId] : undefined;
    for (const c of bookChoices(book)) {
      if (!plate?.focus?.[c.id] && !c.icon) out.push(`${book.id}/${decision.pageId}: choice ${c.id} has no focus rect on the decision plate and no icon`);
    }
  }
  for (const id of [...named].sort()) {
    if (!own(id)) {
      if (!out.some((f) => f.endsWith(`plate ${id} is not registered`))) out.push(`${book.id}: art-state plate ${id} is not registered`);
      continue;
    }
    const plate = table[id];
    const gap = reviewGap(plate);
    if (gap) out.push(`${book.id}/${id}: unreviewed plate (${gap})`);
    out.push(...plateSlotFindings(plate, table));
  }
  return out;
}

export interface ShippedBook {
  book: AnyBook;
  table: PlateTable;
}

/**
 * The shipped-file half: `files` are paths relative to public/visuals
 * (`books/<bookId>/<plateId>.webp`, `books/<bookId>/overlays/<id>.webp`,
 * `plans/<patternId>/<plateId>.webp`). `books` = the library books that may
 * ship plates, by id; `planTables` = each pattern's shared plate table. A file
 * that no reviewed registry entry accounts for is a finding.
 */
export function shippedPlateFindings(
  files: readonly string[],
  books: Readonly<Record<string, ShippedBook>>,
  planTables: Readonly<Record<string, PlateTable>> = {},
): string[] {
  const out: string[] = [];
  const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
  for (const rel of files) {
    const plate = /^books\/([a-z0-9-]+)\/([A-Za-z0-9_-]+)\.webp$/.exec(rel);
    const overlay = /^books\/([a-z0-9-]+)\/overlays\/([A-Za-z0-9_-]+)\.webp$/.exec(rel);
    const plan = /^plans\/([a-z0-9-]+)\/([A-Za-z0-9_-]+)\.webp$/.exec(rel);
    if (plate) {
      const [, bookId, plateId] = plate;
      const shipped = own(books, bookId) ? books[bookId] : undefined;
      const entry = shipped && own(shipped.table, plateId) ? shipped.table[plateId] : undefined;
      if (!shipped) out.push(`${rel}: no shipped library book ${bookId}`);
      else if (!entry) out.push(`${rel}: not a registered plate of ${bookId}`);
      else if (!plateReviewed(entry)) out.push(`${rel}: unreviewed plate (${reviewGap(entry)})`);
    } else if (overlay) {
      const [, bookId, id] = overlay;
      const shipped = own(books, bookId) ? books[bookId] : undefined;
      const named = shipped ? allBookPages(shipped.book).some((p) => (p.overlays ?? []).some((o) => o.file === `/visuals/${rel}`)) : false;
      if (!named) out.push(`${rel}: an overlay no page of ${bookId} names (${id})`);
    } else if (plan) {
      const [, patternId, plateId] = plan;
      const table = own(planTables, patternId) ? planTables[patternId] : undefined;
      const entry = table && own(table, plateId) ? table[plateId] : undefined;
      if (!entry) out.push(`${rel}: not a registered plate of pattern ${patternId}`);
      else if (!plateReviewed(entry)) out.push(`${rel}: unreviewed shared plate (${reviewGap(entry)})`);
    } else out.push(`${rel}: not a plate or overlay path`);
  }
  return out;
}
