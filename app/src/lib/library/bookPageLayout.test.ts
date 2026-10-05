/**
 * B-BOOK-03 — computeBookPageLayout: one pure function, every rect.
 * - No stretch: on the spread the art rect has the plate's own aspect
 *   (1920x1080 and 1280x800 viewports, minus the 72 px reader bar).
 * - At 375x812 (minus the 56 px bar) the art is a 3:4 window that holds the
 *   whole hero box — for every page, the cover and the after-tap hero.
 * - Hebrew swaps the text page to the left; the art is not mirrored.
 * - The text page never intersects the art (both modes, both languages).
 * - The words fit (estimated) at >= the --kid-t-book floor on every page.
 */
import { describe, expect, it } from "vitest";
import { abramsLongRoad } from "./books/abramsLongRoad";
import { computeBookPageLayout, estimateTextHeight, kidBookTokenPx, overlapArea, phoneWindow, type Box, type LayoutContent } from "./bookPageLayout";
import { heroDisplayName, pageParagraphs, paragraphChars } from "./bookText";
import type { BookLang, Page } from "./types";

const SPREAD_BOXES: Box[] = [
  { width: 1920, height: 1080 - 72 },
  { width: 1280, height: 800 - 72 },
];
const PHONE: Box = { width: 375, height: 812 - 56 };
const LANGS: BookLang[] = ["en", "he"];
const NAME = heroDisplayName({ name: "Dylan" });

const book = abramsLongRoad;
const choiceOf = (page: Page) => book.decision.choices.find((c) => c.branch.some((p) => p.id === page.id))?.id ?? "b";
const pages: Page[] = [book.cover, ...book.pages, ...book.decision.choices.flatMap((c) => c.branch)];

/** Every state a page is shown in: the decision page with its cards, a repair
 *  page before and after its tap, rejoin/ending pages with the longest echo. */
function states(page: Page, lang: BookLang): { content: LayoutContent; tapped: boolean }[] {
  const g = "f" as const;
  if (page.id === "cover") return [{ content: { paras: [book.coverLine[lang].length], title: book.title[lang].length }, tapped: false }];
  const out: { content: LayoutContent; tapped: boolean }[] = [];
  const choiceIds = page.echo ? Object.keys(page.echo) : [choiceOf(page)];
  for (const choiceId of choiceIds) {
    for (const tapped of page.actionTap ? [false, true] : [false]) {
      const paras = paragraphChars(pageParagraphs(page, { lang, gender: g, choiceId, tapped }), NAME);
      out.push({
        tapped,
        content: { paras, choices: page.id === book.decision.pageId ? book.decision.choices.length : undefined, action: !!page.actionTap && !tapped },
      });
    }
  }
  return out;
}

describe("spread: the whole plate at its own aspect, never stretched", () => {
  it.each(SPREAD_BOXES)("$width x $height", (box) => {
    for (const lang of LANGS) {
      for (const page of pages) {
        for (const { content } of states(page, lang)) {
          const l = computeBookPageLayout(page, box, lang, { content });
          expect(l.mode).toBe("spread");
          expect(Math.abs(l.art.w / l.art.h - 1.5)).toBeLessThan(0.01);
          expect(l.plate).toEqual(l.art);
          expect(l.crop).toEqual({ x0: 0, x1: 1 });
          // the book fits the box
          expect(l.book.x).toBeGreaterThanOrEqual(0);
          expect(l.book.y).toBeGreaterThanOrEqual(0);
          expect(l.book.x + l.book.w).toBeLessThanOrEqual(box.width);
          expect(l.book.y + l.book.h).toBeLessThanOrEqual(box.height);
          // the art sits inside its paper page
          expect(l.art.x).toBeGreaterThan(l.artPage.x);
          expect(l.art.x + l.art.w).toBeLessThan(l.artPage.x + l.artPage.w);
          // words fit at >= the --kid-t-book floor
          expect(l.fits, `${lang} ${page.id}`).toBe(true);
          // >= the --kid-t-book token at 1920; a dense page at 1280 may step down <= 4 px
          const token = Math.ceil(kidBookTokenPx(box.width));
          const floor = box.width >= 1920 ? token : Math.max(20, token - 4);
          expect(l.typePx, `${box.width} ${lang} ${page.id}`).toBeGreaterThanOrEqual(floor);
          if (l.hero) expect(l.hero.inWindow, `${page.id} hero inside the plate`).toBe(true);
        }
      }
    }
  });

  it("at 1920x1080 the art is big and the type is large (>= 30 px)", () => {
    const l = computeBookPageLayout(book.pages[0], SPREAD_BOXES[0], "en", { content: { paras: [180] } });
    expect(l.art.h).toBeGreaterThanOrEqual(760);
    expect(l.typePx).toBeGreaterThanOrEqual(30);
  });
});

describe("stacked at 375x812: a 3:4 window that holds the hero", () => {
  it("every page, both languages, before and after the tap", () => {
    for (const lang of LANGS) {
      for (const page of pages) {
        for (const { content, tapped } of states(page, lang)) {
          const slot = tapped ? page.actionTap?.heroAfter ?? page.hero : page.hero;
          const l = computeBookPageLayout(page, PHONE, lang, { content, slot, alsoContain: page.actionTap?.heroAfter });
          expect(l.mode).toBe("stacked");
          expect(Math.abs(l.art.w / l.art.h - 0.75)).toBeLessThan(0.01);
          // the plate behind the window keeps its aspect (cropped, not stretched)
          expect(Math.abs(l.plate.w / l.plate.h - 1.5)).toBeLessThan(0.001);
          expect(l.crop.x1 - l.crop.x0).toBeCloseTo(0.5, 6);
          expect(l.crop.x0).toBeGreaterThanOrEqual(0);
          expect(l.crop.x1).toBeLessThanOrEqual(1);
          if (l.hero) expect(l.hero.inWindow, `${lang} ${page.id} tapped=${tapped}`).toBe(true);
          expect(l.fits, `${lang} ${page.id} fits`).toBe(true);
          expect(l.art.x).toBeGreaterThanOrEqual(0);
          expect(l.art.x + l.art.w).toBeLessThanOrEqual(PHONE.width);
          expect(l.textPage.y + l.textPage.h).toBeLessThanOrEqual(PHONE.height);
        }
      }
    }
  });

  it("the window moves off phoneCrop only as far as the hero needs", () => {
    const p2 = book.pages.find((p) => p.id === "p2")!;
    const win = phoneWindow({ ...p2, phoneCrop: 0.75 }, [p2.hero], 1.5, 1);
    const half = (p2.hero!.scale * 1) / 1.5 / 2;
    expect(win.x0).toBeLessThanOrEqual(p2.hero!.x - half);
    expect(win.x1 - win.x0).toBeCloseTo(0.5, 6);
    // a centred hero leaves the authored crop alone
    const p5 = book.pages.find((p) => p.id === "p5")!;
    expect(phoneWindow(p5, [p5.hero], 1.5, 1)).toEqual({ x0: 0.25, x1: 0.75 });
  });
});

describe("Hebrew swaps the text side; the art is not mirrored", () => {
  it.each([SPREAD_BOXES[0], SPREAD_BOXES[1]])("$width x $height", (box) => {
    const page = book.pages[0];
    const en = computeBookPageLayout(page, box, "en");
    const he = computeBookPageLayout(page, box, "he");
    expect(en.textPage.x).toBeGreaterThan(en.art.x);
    expect(he.textPage.x).toBeLessThan(he.art.x);
    expect(en.spine).toBe("left");
    expect(he.spine).toBe("right");
    expect(he.dir).toBe("rtl");
    // same hero placement on the plate in both languages (no mirror in v1)
    expect(he.hero!.flip).toBe(en.hero!.flip);
    expect((he.hero!.x - he.art.x) / he.art.w).toBeCloseTo((en.hero!.x - en.art.x) / en.art.w, 6);
  });
});

describe("the words never cover the art", () => {
  it("text page ∩ art = 0 on every page, both modes, both languages", () => {
    for (const box of [...SPREAD_BOXES, PHONE]) {
      for (const lang of LANGS) {
        for (const page of pages) {
          for (const { content } of states(page, lang)) {
            const l = computeBookPageLayout(page, box, lang, { content });
            expect(overlapArea(l.textPage, l.art), `${box.width} ${lang} ${page.id}`).toBe(0);
            expect(overlapArea(l.text, l.art)).toBe(0);
          }
        }
      }
    }
  });
});

describe("hero, shadow and the feet anchor", () => {
  it("the sprite box stands on the slot's feet point; the shadow sits under the feet", () => {
    const p1 = book.pages[0];
    const l = computeBookPageLayout(p1, SPREAD_BOXES[0], "en");
    const s = p1.hero!;
    expect(l.hero!.h).toBeCloseTo(s.scale * l.plate.h, 6);
    expect(l.hero!.x + l.hero!.w / 2).toBeCloseTo(l.plate.x + s.x * l.plate.w, 6);
    expect(l.hero!.y + l.hero!.h).toBeCloseTo(l.plate.y + s.y * l.plate.h, 6);
    expect(l.hero!.flip).toBe(s.facing === "left");
    expect(l.shadow!.cy).toBeCloseTo(l.hero!.y + l.hero!.h, 6);
    expect(l.shadow!.rx).toBeGreaterThan(l.shadow!.ry);
  });

  it("a page without a slot has no hero and no shadow", () => {
    const l = computeBookPageLayout({ ...book.pages[0], hero: null }, PHONE, "en");
    expect(l.hero).toBeNull();
    expect(l.shadow).toBeNull();
  });
});

describe("estimateTextHeight", () => {
  it("grows with the words and shrinks with the width", () => {
    expect(estimateTextHeight([200], 300, 20, 1.5)).toBeGreaterThan(estimateTextHeight([100], 300, 20, 1.5));
    expect(estimateTextHeight([200], 600, 20, 1.5)).toBeLessThan(estimateTextHeight([200], 300, 20, 1.5));
    expect(estimateTextHeight([10, 10], 300, 20, 1.5)).toBeGreaterThan(estimateTextHeight([20], 300, 20, 1.5));
  });
});
