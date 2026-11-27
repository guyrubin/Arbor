/**
 * B-BOOK-27 — "a plate missing slot metadata or review fails the build", over
 * the current registry: every library book's plates are registered with their
 * slot metadata and reviewed (child-free, text-free, someone named as having
 * viewed them); every plate or overlay FILE in the bundle is accounted for by
 * a reviewed registry entry; a fixture book's unreviewed plates never ship;
 * the Everyday Plans pattern plates (shared by every family, painted in
 * product, provenance still empty) are a FROZEN, dated list that may only
 * shrink, and the server never serves them unreviewed (server/planPlates).
 *
 * The book list is derived from the live registry, never written out here:
 * every canonical and fixture book (books/index), every authored pattern
 * (plans/planBooks.PATTERNS) with its `--demo` book AND one composed book per
 * non-default menu item (planMenuCoverageBooks), so a new book, pattern or
 * menu item is covered with no list to update. Negative controls mutate the
 * real registry entries (never synthetic strings) and prove each rule bites.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { allBooks, BOOK_PLATES, bookPlatesFor, FIXTURE_BOOKS, LIBRARY_BOOKS } from "./books";
import { allBookPages } from "./bookShape";
import { fiveSmoothStones } from "./books/fiveSmoothStones";
import type { BookPlate, PlateTable } from "./bookPlates";
import { authoredPatterns, PLAN_FIXTURE_BOOKS, planMenuCoverageBooks } from "./plans/planBooks";
import type { PatternDef } from "./plans/patterns";
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
/** Every authored pattern (the live registry), not the visibility list: the two must agree (asserted below). */
const AUTHORED = authoredPatterns().map((d) => d.id);
const PLAN_TABLES: Record<string, PlateTable> = Object.fromEntries(AUTHORED.map((p) => [p, planPlateTable(p)]));
/** Every plan book the checks read: each pattern's default book and one per non-default menu item. */
const PLAN_BOOKS = [...Object.values(PLAN_FIXTURE_BOOKS), ...planMenuCoverageBooks()];
const nonReview = (f: string) => !/unreviewed plate/.test(f);

/**
 * The Everyday Plans pattern plates (lib/library/plans/planPlates.ts, the
 * Plans track's files): authored with EMPTY provenance; none is committed
 * (planPlateManifest is empty) and the in-product paints are served through
 * GET /api/plans/plates only once their stored record says reviewed
 * (server/planPlates.sharedPlateServable, B-BOOK-27, fail closed). FROZEN
 * and DATED: entries may only shrink — a plate leaves this list when its
 * registry entry records the full-size review; a new unreviewed shared plate
 * fails the build. These cannot pass without reviewed art (no art change here).
 */
const PLAN_ART_PENDING = { since: "2026-11-27", reason: "pattern plates not yet painted and viewed full size; the registry holds no review, so they ship nowhere and the read route refuses them" } as const;
const UNREVIEWED_PLAN_PLATES: Readonly<Record<string, { since: string; reason: string; plates: readonly string[] }>> = {
  "plan-poo-sit": { ...PLAN_ART_PENDING, plates: ["PP1", "PP2", "PP3", "PP4", "PP5", "PP6", "PP7", "PP8"] },
  "plan-toilet-start": { ...PLAN_ART_PENDING, plates: ["PT1", "PT2", "PT3", "PT4", "PT5", "PT6", "PT7", "PT8"] },
  "plan-sleep-alone": { ...PLAN_ART_PENDING, plates: ["PS1", "PS2", "PS3", "PS4", "PS5", "PS6", "PS7", "PS8"] },
  "plan-stay-in-bed": { ...PLAN_ART_PENDING, plates: ["PB1", "PB2", "PB3", "PB4", "PB5", "PB6", "PB7", "PB8"] },
  "plan-dropoff": { ...PLAN_ART_PENDING, plates: ["PD1", "PD2", "PD3", "PD4", "PD5", "PD6", "PD7", "PD8"] },
  "plan-big-feelings": { ...PLAN_ART_PENDING, plates: ["PF1", "PF2", "PF3", "PF4", "PF5", "PF6", "PF7", "PF8"] },
  "plan-screen-end": { ...PLAN_ART_PENDING, plates: ["PE1", "PE2", "PE3", "PE4", "PE5", "PE6", "PE7", "PE8"] },
  "plan-new-food": { ...PLAN_ART_PENDING, plates: ["PN1", "PN2", "PN3", "PN4", "PN5", "PN6", "PN7", "PN8"] },
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
    expect(Object.keys(PLAN_FIXTURE_BOOKS).length).toBe(AUTHORED.length);
    for (const book of PLAN_BOOKS) {
      expect(bookPlateFindings(book, planPlateTable(book.pattern)).filter(nonReview), book.id).toEqual([]);
    }
  });
});

describe("B-BOOK-27: the checks read the live registry, so nothing in it is left out", () => {
  it("every canonical and fixture book has a plate table, and no table belongs to no book", () => {
    const ids = allBooks().map((b) => b.id).sort();
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(BOOK_PLATES).sort()).toEqual(ids);
    for (const book of allBooks()) expect(bookPlatesFor(book), book.id).toBe(BOOK_PLATES[book.id]);
    for (const id of Object.keys(LIBRARY_BOOKS)) expect(Object.keys(FIXTURE_BOOKS), id).not.toContain(id);
  });

  it("the authored patterns and the visibility list are the same set (a new pattern cannot dodge the checks or the read route)", () => {
    expect([...AUTHORED].sort()).toEqual([...PATTERN_IDS].sort());
  });

  it("every menu item of every pattern is read by some checked plan book, and so is every plate of each pattern's table", () => {
    for (const def of authoredPatterns()) {
      const books = PLAN_BOOKS.filter((b) => b.pattern === def.id);
      const items = new Set(books.flatMap((b) => b.steps.map((s) => s.menuId)));
      for (const m of def.menu) expect(items, `${def.id}: menu item ${m.id}`).toContain(m.id);
      const named = new Set(books.flatMap((b) => allBookPages(b).map((p) => p.plateId)));
      expect([...named].sort(), def.id).toEqual(Object.keys(planPlateTable(def.id)).sort());
    }
    // the menu coverage reaches beyond the default steps (else it would add nothing)
    expect(planMenuCoverageBooks().length).toBe(authoredPatterns().reduce((n, d) => n + d.menu.filter((m) => d.defaultSteps[m.slot - 1] !== m.id).length, 0));
    expect(planMenuCoverageBooks().length).toBeGreaterThan(0);
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
      for (const id of ids) expect(UNREVIEWED_PLAN_PLATES[pattern]?.plates ?? [], `${pattern}/${id} is a new unreviewed shared plate`).toContain(id);
    }
    for (const [pattern, entry] of Object.entries(UNREVIEWED_PLAN_PLATES)) {
      expect(entry.since, pattern).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.reason.trim().length, pattern).toBeGreaterThan(20);
      for (const id of entry.plates) expect(unreviewed[pattern] ?? [], `${pattern}/${id} is reviewed now: remove it from UNREVIEWED_PLAN_PLATES`).toContain(id);
    }
  });

  it("an allow-listed shared plate ships nowhere: none is committed under public/visuals/plans", () => {
    for (const [pattern, entry] of Object.entries(UNREVIEWED_PLAN_PLATES)) {
      for (const id of entry.plates) expect(files, `${pattern}/${id}`).not.toContain(`plans/${pattern}/${id}.webp`);
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

  it("a shared plan plate recorded child-painted is rejected even with a reviewer named (real pattern table)", () => {
    const pattern = AUTHORED[0];
    const real = PLAN_TABLES[pattern];
    const id = Object.keys(real)[0];
    const reviewed = { ...real, [id]: { ...real[id], provenance: { childFree: true, textFree: true, reviewedBy: "art-review" } } };
    expect(shippedPlateFindings([`plans/${pattern}/${id}.webp`], SHIPPED, { ...PLAN_TABLES, [pattern]: reviewed })).toEqual([]);
    const childPainted = { ...real, [id]: { ...real[id], provenance: { childFree: false, textFree: true, reviewedBy: "art-review" } } };
    expect(plateReviewed(childPainted[id])).toBe(false);
    expect(shippedPlateFindings([`plans/${pattern}/${id}.webp`], SHIPPED, { ...PLAN_TABLES, [pattern]: childPainted })).toEqual([`plans/${pattern}/${id}.webp: unreviewed shared plate (not recorded child-free)`]);
    // and a book's plate the same way: reviewed, then child-painted
    const t = BOOK_PLATES[fiveSmoothStones.id];
    const plate = fiveSmoothStones.pages[0].plateId;
    const painted = { ...t, [plate]: { ...t[plate], provenance: { ...t[plate].provenance, childFree: false } } };
    expect(bookPlateFindings(fiveSmoothStones, painted)).toContain(`five-smooth-stones/${plate}: unreviewed plate (not recorded child-free)`);
  });

  it("a broken NON-default menu item (real pattern, its own art mutated) is caught only because the menu coverage books read it", () => {
    const def = authoredPatterns().find((d) => d.menu.some((m) => d.defaultSteps[m.slot - 1] !== m.id))!;
    const item = def.menu.find((m) => def.defaultSteps[m.slot - 1] !== m.id)!;
    const broken: PatternDef = { ...def, menu: def.menu.map((m) => (m.id === item.id ? { ...m, art: { ...m.art, slot: { ...m.art.slot, y: 0.2, scale: 0.5 }, phoneCrop: 1.4 } } : m)) };
    const table = planPlateTable(def.id);
    const book = planMenuCoverageBooks([broken]).find((b) => b.steps.some((s) => s.menuId === item.id))!;
    const findings = bookPlateFindings(book, table).filter(nonReview);
    expect(findings.some((f) => /hero slot .* is not inside the plate with head room/.test(f)), findings.join("; ")).toBe(true);
    expect(findings.some((f) => /phone window is not inside the plate/.test(f)), findings.join("; ")).toBe(true);
    // the default book alone never reads that item (the gap this coverage closes)
    expect(PLAN_FIXTURE_BOOKS[`${def.id}--demo`].steps.map((s) => s.menuId)).not.toContain(item.id);
    // an unregistered plate on that item is caught the same way
    const ghost: PatternDef = { ...def, menu: def.menu.map((m) => (m.id === item.id ? { ...m, art: { ...m.art, plateId: "PX-ghost" } } : m)) };
    const ghostBook = planMenuCoverageBooks([ghost]).find((b) => b.steps.some((s) => s.menuId === item.id))!;
    expect(bookPlateFindings(ghostBook, table).some((f) => f.endsWith("plate PX-ghost is not registered"))).toBe(true);
  });
});
