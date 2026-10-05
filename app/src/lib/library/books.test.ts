/**
 * B-BOOK-02 — the authored books are complete, bounded and every path ends.
 * "Abram's Long Road" is lane A §6 as data: every page has EN + HE m + HE f,
 * every plate is registered, every slot sits inside the plate, no page carries
 * more than 40 English words (echo + closing + after-tap text included), the
 * decision offers exactly 3 typed choices of 1-2 branch pages, and all three
 * paths reach the same ending. Plus lane A's C8 fix and the label caps.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LIBRARY_BOOKS, getLibraryBook } from "./books";
import { abramsLongRoad } from "./books/abramsLongRoad";
import { getPlate, PLATE_MASTER } from "./bookPlates";
import { HERO_POSES } from "./heroSheet";
import { readPath } from "./bookFlow";
import type { Book, BookLine, Page, Slot } from "./types";

const here = path.dirname(fileURLToPath(import.meta.url));
const iconSubset = new Set(
  readFileSync(path.join(here, "..", "..", "..", "public", "fonts", "material-symbols-rounded-subset.icons.txt"), "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean),
);

const words = (text: string) => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]|\{hero\}/u.test(w)).length;

function allPages(book: Book): Page[] {
  return [book.cover, ...book.pages, ...book.decision.choices.flatMap((c) => c.branch)];
}

function lines(page: Page): BookLine[] {
  return [page.text, ...Object.values(page.echo ?? {}), ...(page.closing ? [page.closing] : []), ...(page.actionTap ? [page.actionTap.textAfter] : [])];
}

function slots(page: Page): Slot[] {
  return [page.hero, page.actionTap?.heroAfter].filter((s): s is Slot => !!s);
}

describe.each(Object.values(LIBRARY_BOOKS))("book $id", (book) => {
  it("is registered under its own id", () => {
    expect(getLibraryBook(book.id)).toBe(book);
    expect(getLibraryBook("no-such-book")).toBeUndefined();
  });

  it("every page has EN + HE m + HE f text (echo, closing and after-tap lines too)", () => {
    for (const page of allPages(book)) {
      for (const line of lines(page)) {
        expect(line.en.trim(), `${page.id} EN`).not.toBe("");
        expect(line.he.m.trim(), `${page.id} HE m`).not.toBe("");
        expect(line.he.f.trim(), `${page.id} HE f`).not.toBe("");
        expect(/[֐-׿]/.test(line.he.m) && /[֐-׿]/.test(line.he.f), `${page.id} HE is Hebrew`).toBe(true);
        expect(/[֐-׿]/.test(line.en), `${page.id} EN carries no Hebrew`).toBe(false);
      }
    }
    expect(book.title.en && book.title.he && book.coverLine.en && book.coverLine.he).toBeTruthy();
  });

  it("page ids are unique across the linear pages and every branch", () => {
    const ids = allPages(book).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every plateId is registered at the 3:2 master size", () => {
    for (const page of allPages(book)) {
      const plate = getPlate(book.id, page.plateId);
      expect(plate, `${page.id} → ${page.plateId}`).toBeDefined();
      expect(plate!.width / plate!.height).toBeCloseTo(PLATE_MASTER.width / PLATE_MASTER.height, 6);
      expect(plate!.file).toBe(`/visuals/books/${book.id}/${page.plateId}.webp`);
    }
  });

  it("every slot is inside the plate (0..1), uses a sheet pose, keeps head room; phoneCrop is a fraction", () => {
    for (const page of allPages(book)) {
      expect(page.phoneCrop, page.id).toBeGreaterThanOrEqual(0);
      expect(page.phoneCrop, page.id).toBeLessThanOrEqual(1);
      for (const s of slots(page)) {
        expect(HERO_POSES).toContain(s.pose);
        for (const v of [s.x, s.y]) {
          expect(v, page.id).toBeGreaterThan(0);
          expect(v, page.id).toBeLessThan(1);
        }
        expect(s.scale, page.id).toBeGreaterThan(0);
        expect(s.scale, page.id).toBeLessThan(1);
        expect(s.y - s.scale, `${page.id} head inside the plate`).toBeGreaterThan(0);
        expect(["left", "right"]).toContain(s.facing);
      }
    }
  });

  it("no page carries more than 40 English words (echo, closing and after-tap text included)", () => {
    for (const page of allPages(book)) {
      const echoMax = Math.max(0, ...Object.values(page.echo ?? {}).map((e) => words(e.en)));
      const total = words(page.text.en) + echoMax + (page.closing ? words(page.closing.en) : 0) + (page.actionTap ? words(page.actionTap.textAfter.en) : 0);
      expect(total, `${page.id}: ${total} words`).toBeLessThanOrEqual(40);
    }
  });

  it("the decision offers exactly 3 typed choices, each with 1-2 branch pages, a <= 5-word label and a shipped icon", () => {
    const { choices, pageId } = book.decision;
    expect(book.pages.some((p) => p.id === pageId)).toBe(true);
    expect(choices).toHaveLength(3);
    expect(choices.map((c) => c.type).sort()).toEqual(["easy", "hard", "third"]);
    for (const c of choices) {
      expect(c.branch.length).toBeGreaterThanOrEqual(1);
      expect(c.branch.length).toBeLessThanOrEqual(2);
      expect(words(c.label.en)).toBeLessThanOrEqual(5);
      expect(words(c.label.he)).toBeLessThanOrEqual(6);
      expect(iconSubset.has(c.icon), `${c.icon} is in the shipped icon subset`).toBe(true);
    }
    // Branches differ by at most one page (length never signals the answer).
    const lens = choices.map((c) => c.branch.length);
    expect(Math.max(...lens) - Math.min(...lens)).toBeLessThanOrEqual(1);
  });

  it("all three paths reach the same rejoin page and the same ending", () => {
    const endings = new Set<string>();
    for (const c of book.decision.choices) {
      const ids = readPath(book, c.id).map((p) => p.id);
      expect(ids).toContain(book.decision.pageId);
      expect(ids).toContain(book.rejoinPageId);
      expect(ids.indexOf(book.rejoinPageId)).toBe(ids.indexOf(c.branch[c.branch.length - 1].id) + 1);
      endings.add(ids[ids.length - 1]);
    }
    expect(endings.size).toBe(1);
    // Before a choice the path stops at the decision page.
    const open = readPath(book, null).map((p) => p.id);
    expect(open[open.length - 1]).toBe(book.decision.pageId);
  });

  it("the rejoin page and the last page carry one echo line per choice", () => {
    const last = book.pages[book.pages.length - 1];
    const rejoin = book.pages.find((p) => p.id === book.rejoinPageId)!;
    for (const p of [rejoin, last]) {
      expect(Object.keys(p.echo ?? {}).sort()).toEqual(book.decision.choices.map((c) => c.id).sort());
      for (const e of Object.values(p.echo!)) expect(words(e.en)).toBeLessThanOrEqual(12);
    }
  });

  it("only the EASY branch has a repair page, with exactly one action tap", () => {
    for (const c of book.decision.choices) {
      const taps = c.branch.filter((p) => p.actionTap);
      expect(taps.length, c.id).toBe(c.type === "easy" ? 1 : 0);
    }
    expect(book.pages.some((p) => p.actionTap)).toBe(false);
  });

  it("the parent panel is complete in both languages", () => {
    const pp = book.parent;
    for (const l of [pp.builds, pp.why, pp.sourceNote]) expect(l.en && l.he).toBeTruthy();
    expect(pp.askAfter.en && pp.askAfter.he.m && pp.askAfter.he.f).toBeTruthy();
  });
});

describe("Abram's Long Road — lane A specifics", () => {
  const p7b = abramsLongRoad.decision.choices.find((c) => c.id === "b")!.branch[1];

  it("C8 fix: p7b's before-text no longer says Abram is waiting (EN + HE m/f)", () => {
    expect(p7b.id).toBe("p7b");
    expect(p7b.text.en).toBe("{hero} stops. Everyone is waiting.");
    expect(p7b.text.en).not.toContain("Abram is waiting");
    expect(p7b.text.he.m).not.toContain("אברם מחכה");
    expect(p7b.text.he.f).not.toContain("אברם מחכה");
    expect(p7b.actionTap?.label).toEqual({ en: "Bring the goats!", he: "להביא את הגדיים!" });
  });

  it("uses the 9 plates of the ledger (§6.3) and the 6 poses", () => {
    const used = new Set(allPages(abramsLongRoad).map((p) => p.plateId));
    expect([...used].sort()).toEqual(["P1b", "P1c", "P1e", "P1m", "P2", "P3", "P4", "P5", "P6"]);
    const poses = new Set(allPages(abramsLongRoad).flatMap((p) => slots(p).map((s) => s.pose)));
    expect([...poses].sort()).toEqual([...HERO_POSES].sort());
  });

  it("slots match the manuscript (spot checks)", () => {
    const byId = Object.fromEntries(allPages(abramsLongRoad).map((p) => [p.id, p]));
    expect(byId.cover.hero).toMatchObject({ pose: "walk", x: 0.3, y: 0.88, scale: 0.4 });
    expect(byId.p2.hero).toMatchObject({ pose: "stand", x: 0.18, y: 0.94, scale: 0.48, z: "fg" });
    expect(byId.p8.hero).toMatchObject({ pose: "arms-wide", x: 0.45, y: 0.8, scale: 0.34, facing: "left" });
    expect(byId.p10.hero).toMatchObject({ pose: "sit", x: 0.52, y: 0.9, scale: 0.36 });
  });

  it("God is never named in the HE text as the Tetragrammaton", () => {
    for (const page of allPages(abramsLongRoad)) for (const l of lines(page)) expect(`${l.he.m}${l.he.f}`).not.toMatch(/יהוה|יְהוָה/);
  });
});
