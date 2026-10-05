/**
 * B-BOOK-03 — computeBookPageLayout: one pure function, every rect.
 * - No stretch: wide, the art rect has the plate's own aspect (1920x1080 and
 *   1280x800 viewports, minus the 72 px reader bar).
 * - Facing pages: the text page never intersects the art. Spread pages: the
 *   paper panel sits inside the plate and never covers the hero's body (or the
 *   page falls back to facing).
 * - At 375x812 (minus the 56 px bar) the art is a 3:4 window that holds the
 *   hero, the after-repair hero and every repair item.
 * - Hebrew swaps the text page to the left; the art is not mirrored.
 * - The words fit (estimated) at >= the --kid-t-book floor (a dense page at
 *   1280 may step down <= 4 px).
 */
import { describe, expect, it } from "vitest";
import { abramsLongRoad } from "./books/abramsLongRoad";
import { getPlate } from "./books";
import { computeBookPageLayout, estimateTextHeight, kidBookTokenPx, overlapArea, phoneWindow, platePoint, type Box, type LayoutContent } from "./bookPageLayout";
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
const plateOf = (page: Page) => getPlate(book.id, page.plateId)!;
const choiceOf = (page: Page) => book.decision.choices.find((c) => c.branch.some((p) => p.id === page.id))?.id ?? "b";
const pages: Page[] = [book.cover, ...book.pages, ...book.decision.choices.flatMap((c) => c.branch)];

/** Every state a page is shown in: the decision page with its cards, a repair
 *  page before and after it is done, rejoin/ending pages with each echo. */
function states(page: Page, lang: BookLang): { content: LayoutContent; repaired: boolean }[] {
  if (page.id === "cover") return [{ content: { paras: [book.coverLine[lang].length], title: book.title[lang].length }, repaired: false }];
  const out: { content: LayoutContent; repaired: boolean }[] = [];
  const choiceIds = page.echo ? Object.keys(page.echo) : [choiceOf(page)];
  for (const choiceId of choiceIds) {
    for (const repaired of page.repair ? [false, true] : [false]) {
      for (const gender of ["m", "f"] as const) {
        const paras = paragraphChars(pageParagraphs(page, { lang, gender, choiceId, repaired }), NAME);
        out.push({
          repaired,
          content: { paras, choices: page.id === book.decision.pageId ? book.decision.choices.length : undefined, prompt: !!page.repair && !repaired },
        });
      }
    }
  }
  return out;
}

const layout = (page: Page, box: Box, lang: BookLang, content: LayoutContent, repaired = false) =>
  computeBookPageLayout(page, box, lang, { content, plate: plateOf(page), slot: repaired ? page.repair?.heroAfter ?? page.hero : page.hero });

describe("wide: the whole plate at its own aspect, never stretched", () => {
  it.each(SPREAD_BOXES)("$width x $height", (box) => {
    for (const lang of LANGS) {
      for (const page of pages) {
        for (const { content, repaired } of states(page, lang)) {
          const l = layout(page, box, lang, content, repaired);
          expect(l.mode).toBe("wide");
          expect(Math.abs(l.art.w / l.art.h - 1.5)).toBeLessThan(0.01);
          expect(l.plate).toEqual(l.art);
          expect(l.crop).toEqual({ x0: 0, x1: 1 });
          expect(l.book.x).toBeGreaterThanOrEqual(0);
          expect(l.book.y).toBeGreaterThanOrEqual(0);
          expect(l.book.x + l.book.w).toBeLessThanOrEqual(box.width);
          expect(l.book.y + l.book.h).toBeLessThanOrEqual(box.height);
          expect(l.art.x).toBeGreaterThan(l.artPage.x);
          expect(l.art.x + l.art.w).toBeLessThan(l.artPage.x + l.artPage.w);
          expect(l.fits, `${lang} ${page.id}`).toBe(true);
          const token = Math.ceil(kidBookTokenPx(box.width));
          const floor = box.width >= 1920 ? token : Math.max(20, token - 4);
          expect(l.typePx, `${box.width} ${lang} ${page.id}`).toBeGreaterThanOrEqual(floor);
          if (l.hero) expect(l.hero.inWindow, `${page.id} hero inside the plate`).toBe(true);
          if (l.pageType === "facing") {
            expect(overlapArea(l.textPage, l.art), `${box.width} ${lang} ${page.id}`).toBe(0);
          } else {
            // a spread panel lies inside the plate and never covers the hero's body
            expect(l.textPage.x).toBeGreaterThanOrEqual(l.art.x);
            expect(l.textPage.y).toBeGreaterThanOrEqual(l.art.y);
            expect(l.textPage.x + l.textPage.w).toBeLessThanOrEqual(l.art.x + l.art.w);
            expect(l.textPage.y + l.textPage.h).toBeLessThanOrEqual(l.art.y + l.art.h);
            if (l.heroBody) expect(overlapArea(l.textPage, l.heroBody), `${box.width} ${lang} ${page.id} panel vs hero`).toBe(0);
          }
        }
      }
    }
  });

  it("at 1920x1080 a facing page has big art and large type (>= 30 px)", () => {
    const l = computeBookPageLayout(book.pages[0], SPREAD_BOXES[0], "en", { content: { paras: [180] } });
    expect(l.pageType).toBe("facing");
    expect(l.art.h).toBeGreaterThanOrEqual(760);
    expect(l.typePx).toBeGreaterThanOrEqual(30);
  });

  it("spread pages are laid out as spreads at 1920 (cover, decision, rejoin, ending of the fixture)", () => {
    for (const page of pages.filter((p) => p.type === "spread")) {
      for (const lang of LANGS) {
        for (const { content } of states(page, lang)) {
          const l = layout(page, SPREAD_BOXES[0], lang, content);
          expect(l.pageType, `${lang} ${page.id}`).toBe("spread");
          expect(l.art.h).toBeGreaterThan(820);
        }
      }
    }
  });

  it("a spread whose zones all cover the hero falls back to facing", () => {
    const page: Page = { ...book.pages[0], type: "spread", hero: { pose: "stand", x: 0.5, y: 0.98, scale: 0.9, facing: "right", z: "fr" } };
    const l = computeBookPageLayout(page, SPREAD_BOXES[0], "en", { content: { paras: [200] } });
    expect(l.pageType).toBe("facing");
  });
});

describe("stacked at 375x812: a 3:4 window that holds the hero and the repair items", () => {
  it("every page, both languages, before and after the repair", () => {
    for (const lang of LANGS) {
      for (const page of pages) {
        for (const { content, repaired } of states(page, lang)) {
          const l = layout(page, PHONE, lang, content, repaired);
          expect(l.mode).toBe("stacked");
          expect(Math.abs(l.art.w / l.art.h - 0.75)).toBeLessThan(0.01);
          expect(Math.abs(l.plate.w / l.plate.h - 1.5)).toBeLessThan(0.001);
          expect(l.crop.x1 - l.crop.x0).toBeCloseTo(0.5, 6);
          expect(l.crop.x0).toBeGreaterThanOrEqual(0);
          expect(l.crop.x1).toBeLessThanOrEqual(1);
          if (l.hero) expect(l.hero.inWindow, `${lang} ${page.id} repaired=${repaired}`).toBe(true);
          for (const it of page.repair?.items ?? []) {
            const p = platePoint(l, it.x, it.y);
            expect(p.x, `${page.id} ${it.id} in window`).toBeGreaterThan(l.art.x);
            expect(p.x).toBeLessThan(l.art.x + l.art.w);
          }
          expect(l.fits, `${lang} ${page.id} fits`).toBe(true);
          expect(l.art.x).toBeGreaterThanOrEqual(0);
          expect(l.art.x + l.art.w).toBeLessThanOrEqual(PHONE.width);
          expect(l.textPage.y + l.textPage.h).toBeLessThanOrEqual(PHONE.height);
          expect(overlapArea(l.textPage, l.art)).toBe(0);
          expect(overlapArea(l.text, l.art)).toBe(0);
        }
      }
    }
  });

  it("the window starts at the page override, else the plate's authored window, and moves only as far as the hero needs", () => {
    const p2 = book.pages.find((p) => p.id === "p2")!;
    const win = phoneWindow({ ...p2, phoneCrop: 0.75 }, p2.hero, { width: 1536, height: 1024 });
    const half = p2.hero!.scale / 1.5 / 2;
    expect(win.x0).toBeLessThanOrEqual(p2.hero!.x - half);
    expect(win.x1 - win.x0).toBeCloseTo(0.5, 6);
    const p5 = book.pages.find((p) => p.id === "p5")!;
    expect(phoneWindow(p5, p5.hero, { width: 1536, height: 1024 })).toEqual({ x0: 0.25, x1: 0.75 });
    // no page override → the plate's window
    const noOverride: Page = { ...p5, phoneCrop: undefined, hero: { ...p5.hero!, x: 0.6, scale: 0.2 } };
    const w = phoneWindow(noOverride, noOverride.hero, { width: 1536, height: 1024, window: { cx: 0.6 } });
    expect((w.x0 + w.x1) / 2).toBeCloseTo(0.6, 6);
  });
});

describe("Hebrew swaps the text side; the art is not mirrored", () => {
  it.each(SPREAD_BOXES)("$width x $height", (box) => {
    const page = book.pages[0];
    const en = computeBookPageLayout(page, box, "en");
    const he = computeBookPageLayout(page, box, "he");
    expect(en.textPage.x).toBeGreaterThan(en.art.x);
    expect(he.textPage.x).toBeLessThan(he.art.x);
    expect(en.spine).toBe("left");
    expect(he.spine).toBe("right");
    expect(he.dir).toBe("rtl");
    expect(he.hero!.flip).toBe(en.hero!.flip);
    expect((he.hero!.x - he.art.x) / he.art.w).toBeCloseTo((en.hero!.x - en.art.x) / en.art.w, 6);
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
