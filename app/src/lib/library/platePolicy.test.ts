/**
 * B-BOOK-27 — "a plate missing slot metadata or review fails the build", over
 * the current registry: every library book's plates are registered with their
 * slot metadata and reviewed (child-free, text-free, someone named as having
 * viewed them); every plate or overlay FILE in the bundle is accounted for by
 * a reviewed registry entry; a fixture book's unreviewed plates never ship;
 * the Everyday Plans pattern plates (shared by every family, painted in
 * product, provenance still empty) are a FROZEN list that may only shrink.
 * Negative controls prove each rule bites.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BOOK_PLATES, FIXTURE_BOOKS, LIBRARY_BOOKS } from "./books";
import { fiveSmoothStones } from "./books/fiveSmoothStones";
import type { BookPlate, PlateTable } from "./bookPlates";
import { PLAN_FIXTURE_BOOKS } from "./plans/planBooks";
import { planPlateTable } from "./plans/planPlates";
import { PATTERN_IDS } from "./plans/planVisibility";
import { bookPlateFindings, plateReviewed, reviewGap, shippedPlateFindings, strayPlateFindings, type ShippedBook } from "./platePolicy";
import type { Book } from "./types";

const here = path.dirname(fileURLToPath(import.meta.url));
const VISUALS = path.resolve(here, "..", "..", "..", "public", "visuals");

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const rel = (f: string) => path.relative(VISUALS, f).split(path.sep).join("/");

const SHIPPED: Record<string, ShippedBook> = Object.fromEntries(Object.values(LIBRARY_BOOKS).map((b) => [b.id, { book: b, table: BOOK_PLATES[b.id] }]));
const PLAN_TABLES: Record<string, PlateTable> = Object.fromEntries(PATTERN_IDS.map((p) => [p, planPlateTable(p)]));

/**
 * The Everyday Plans pattern plates (lib/library/plans/planPlates.ts, the
 * Plans track's files): authored with EMPTY provenance and served to every
 * family through GET /api/plans/plates once painted in product, with no
 * reviewed flag in the registry. FROZEN: entries may only shrink — a plate
 * leaves this list when its registry entry records the full-size review; a
 * new unreviewed shared plate fails the build.
 */
const UNREVIEWED_PLAN_PLATES: Readonly<Record<string, readonly string[]>> = {
  "plan-poo-sit": ["PP1", "PP2", "PP3", "PP4", "PP5", "PP6", "PP7", "PP8"],
  "plan-toilet-start": ["PT1", "PT2", "PT3", "PT4", "PT5", "PT6", "PT7", "PT8"],
  "plan-sleep-alone": ["PS1", "PS2", "PS3", "PS4", "PS5", "PS6", "PS7", "PS8"],
  "plan-stay-in-bed": ["PB1", "PB2", "PB3", "PB4", "PB5", "PB6", "PB7", "PB8"],
  "plan-dropoff": ["PD1", "PD2", "PD3", "PD4", "PD5", "PD6", "PD7", "PD8"],
  "plan-big-feelings": ["PF1", "PF2", "PF3", "PF4", "PF5", "PF6", "PF7", "PF8"],
  "plan-screen-end": ["PE1", "PE2", "PE3", "PE4", "PE5", "PE6", "PE7", "PE8"],
  "plan-new-food": ["PN1", "PN2", "PN3", "PN4", "PN5", "PN6", "PN7", "PN8"],
};

describe("B-BOOK-27: every library book's plates are reviewed and carry their slot metadata", () => {
  it.each(Object.values(LIBRARY_BOOKS).map((b) => [b.id, b] as const))("%s: no finding", (_id, book) => {
    expect(bookPlateFindings(book, BOOK_PLATES[book.id])).toEqual([]);
  });

  it("the registry is real (the proof book is a library book with its 19 plates)", () => {
    expect(Object.keys(LIBRARY_BOOKS)).toContain(fiveSmoothStones.id);
    expect(Object.keys(BOOK_PLATES[fiveSmoothStones.id]).length).toBeGreaterThanOrEqual(19);
  });

  it("every plan book's pages have their slot metadata (its plates' review is the frozen list below)", () => {
    expect(Object.keys(PLAN_FIXTURE_BOOKS).length).toBe(PATTERN_IDS.length);
    for (const book of Object.values(PLAN_FIXTURE_BOOKS)) {
      expect(bookPlateFindings(book, planPlateTable(book.pattern)).filter((f) => !/unreviewed plate/.test(f)), book.id).toEqual([]);
    }
  });
});

describe("B-BOOK-27: nothing unreviewed ships", () => {
  // the whole of public/visuals (round 2): a plate outside books/ and plans/ must not escape review
  const all = walk(VISUALS).map(rel);
  const files = all.filter((f) => /^(books|plans)\//.test(f));
  const KNOWN = {
    owners: new Set<string>([...Object.keys(BOOK_PLATES), ...PATTERN_IDS]),
    plateIds: new Set<string>([...Object.values(BOOK_PLATES).flatMap((t) => Object.keys(t)), ...Object.values(PLAN_TABLES).flatMap((t) => Object.keys(t))]),
  };

  it("the scan reads the whole of public/visuals, and no book or plan plate sits outside visuals/books and visuals/plans", () => {
    expect(all.length).toBeGreaterThan(files.length);
    expect(strayPlateFindings(all, KNOWN)).toEqual([]);
  });

  it("every plate and overlay file under public/visuals/books and /plans is a reviewed registry entry", () => {
    expect(files.some((f) => f.startsWith("books/five-smooth-stones/PL"))).toBe(true);
    expect(shippedPlateFindings(files, SHIPPED, PLAN_TABLES)).toEqual([]);
  });

  it("a fixture book's plates (unreviewed by design) never ship", () => {
    for (const book of Object.values(FIXTURE_BOOKS)) {
      expect(bookPlateFindings(book, BOOK_PLATES[book.id]).some((f) => /unreviewed plate/.test(f)), book.id).toBe(true);
      expect(files.filter((f) => f.startsWith(`books/${book.id}/`)), book.id).toEqual([]);
    }
  });

  it("the shared plan plates still unreviewed are EXACTLY the frozen list: a new one fails, and a reviewed one must leave it", () => {
    const unreviewed: Record<string, string[]> = {};
    for (const [pattern, table] of Object.entries(PLAN_TABLES)) {
      const ids = Object.keys(table).filter((id) => !plateReviewed(table[id]));
      if (ids.length) unreviewed[pattern] = ids.sort();
    }
    for (const [pattern, ids] of Object.entries(unreviewed)) {
      for (const id of ids) expect(UNREVIEWED_PLAN_PLATES[pattern] ?? [], `${pattern}/${id} is a new unreviewed shared plate`).toContain(id);
    }
    for (const [pattern, ids] of Object.entries(UNREVIEWED_PLAN_PLATES)) {
      for (const id of ids) expect(unreviewed[pattern] ?? [], `${pattern}/${id} is reviewed now: remove it from UNREVIEWED_PLAN_PLATES`).toContain(id);
    }
  });
});

describe("B-BOOK-27: negative controls — each rule bites", () => {
  const table = BOOK_PLATES[fiveSmoothStones.id];
  const withPlate = (id: string, patch: Partial<BookPlate>): PlateTable => ({ ...table, [id]: { ...table[id], ...patch } });
  const p1 = fiveSmoothStones.pages.find((p) => p.id === "p1")!;

  it("a child-painted plate, a text plate and an unviewed plate are each unreviewed", () => {
    for (const [patch, gap] of [
      [{ childFree: false }, "not recorded child-free"],
      [{ textFree: false }, "not recorded text-free"],
      [{ reviewedBy: null }, "nobody recorded as having viewed it"],
      [{ reviewedBy: "  " }, "nobody recorded as having viewed it"],
    ] as const) {
      const bad = withPlate(p1.plateId, { provenance: { ...table[p1.plateId].provenance, ...patch } });
      expect(reviewGap(bad[p1.plateId])).toBe(gap);
      expect(bookPlateFindings(fiveSmoothStones, bad)).toContain(`five-smooth-stones/${p1.plateId}: unreviewed plate (${gap})`);
    }
  });

  it("missing slot metadata: a size, a window, a variant base, a focus rect, a text rect, a hero slot", () => {
    const decisionPlate = fiveSmoothStones.pages.find((p) => p.id === fiveSmoothStones.decision.pageId)!.plateId;
    expect(bookPlateFindings(fiveSmoothStones, withPlate(p1.plateId, { width: 0 }))).toContain(`five-smooth-stones/${p1.plateId}: no master size`);
    expect(bookPlateFindings(fiveSmoothStones, withPlate(p1.plateId, { window: { cx: 1.4 } }))).toContain(`five-smooth-stones/${p1.plateId}: the 3:4 window centre is not inside the plate`);
    expect(bookPlateFindings(fiveSmoothStones, withPlate(p1.plateId, { variantOf: "PL-none" }))).toContain(`five-smooth-stones/${p1.plateId}: variant of an unregistered plate PL-none`);
    const noFocus = withPlate(decisionPlate, { focus: undefined });
    expect(bookPlateFindings(fiveSmoothStones, noFocus)).toContain(`five-smooth-stones/${fiveSmoothStones.decision.pageId}: choice a has no focus rect on the decision plate and no icon`);
    const spread = fiveSmoothStones.pages.find((p) => p.type === "spread")!;
    const noRect: Book = { ...fiveSmoothStones, pages: fiveSmoothStones.pages.map((p) => (p.id === spread.id ? { ...p, textRect: undefined } : p)) };
    expect(bookPlateFindings(noRect, withPlate(spread.plateId, { textZone: undefined }))).toContain(`five-smooth-stones/${spread.id}: a spread page with no text rect and no plate text zone`);
    const offPlate: Book = { ...fiveSmoothStones, pages: fiveSmoothStones.pages.map((p) => (p.id === "p1" ? { ...p, hero: { ...p.hero!, y: 0.2, scale: 0.5 } } : p)) };
    expect(bookPlateFindings(offPlate, table)).toContain(`five-smooth-stones/p1: hero slot (${p1.hero!.pose}) is not inside the plate with head room`);
  });

  it("an unregistered page plate or art-state plate is a finding", () => {
    const ghost: Book = { ...fiveSmoothStones, pages: fiveSmoothStones.pages.map((p) => (p.id === "p1" ? { ...p, plateId: "PL-ghost" } : p)) };
    expect(bookPlateFindings(ghost, table)).toContain("five-smooth-stones/p1: plate PL-ghost is not registered");
    const p9 = fiveSmoothStones.pages.find((p) => p.id === "p9")!;
    const ghostState: Book = { ...fiveSmoothStones, pages: fiveSmoothStones.pages.map((p) => (p.id === "p9" ? { ...p, artStates: [{ ...p9.artStates![0], plateId: "PL-state-ghost" }] } : p)) };
    expect(bookPlateFindings(ghostState, table)).toContain("five-smooth-stones: art-state plate PL-state-ghost is not registered");
  });

  it("shipped files: an unregistered plate, an unreviewed plate, a stray overlay, an unknown book, a committed unreviewed plan plate", () => {
    const unreviewed = { [fiveSmoothStones.id]: { book: fiveSmoothStones, table: withPlate("PL1", { provenance: { childFree: false, textFree: true, reviewedBy: "x" } }) } };
    expect(shippedPlateFindings([
      "books/five-smooth-stones/PL99.webp",
      "books/five-smooth-stones/overlays/crown.webp",
      "books/abrams-long-road/P1e.webp",
      "plans/plan-poo-sit/PP1.webp",
      "plans/plan-poo-sit/PP99.webp",
      "books/five-smooth-stones/sheet.json",
    ], SHIPPED, PLAN_TABLES)).toEqual([
      "books/five-smooth-stones/PL99.webp: not a registered plate of five-smooth-stones",
      "books/five-smooth-stones/overlays/crown.webp: an overlay no page of five-smooth-stones names (crown)",
      "books/abrams-long-road/P1e.webp: no shipped library book abrams-long-road",
      "plans/plan-poo-sit/PP1.webp: unreviewed shared plate (not recorded child-free)",
      "plans/plan-poo-sit/PP99.webp: not a registered plate of pattern plan-poo-sit",
      "books/five-smooth-stones/sheet.json: not a plate or overlay path",
    ]);
    expect(shippedPlateFindings(["books/five-smooth-stones/PL1.webp"], unreviewed)).toEqual(["books/five-smooth-stones/PL1.webp: unreviewed plate (not recorded child-free)"]);
  });

  it("a stray plate anywhere else under public/visuals is caught (a book's folder, an overlays/ folder, a plate id as a name)", () => {
    const known = { owners: new Set(["five-smooth-stones", "plan-poo-sit"]), plateIds: new Set(["PL1", "PP1"]) };
    expect(strayPlateFindings([
      "stories/five-smooth-stones/PL9.webp",
      "cards/overlays/helmet.webp",
      "worlds/PP1.webp",
      "books/five-smooth-stones/PL1.webp",
      "cards/web/story-noahs-ark-480.webp",
    ], known)).toEqual([
      "stories/five-smooth-stones/PL9.webp: a file of five-smooth-stones outside visuals/books and visuals/plans",
      "cards/overlays/helmet.webp: a plate or overlay folder outside visuals/books and visuals/plans",
      "worlds/PP1.webp: named like a registered plate (PP1) outside visuals/books and visuals/plans",
    ]);
  });
});
