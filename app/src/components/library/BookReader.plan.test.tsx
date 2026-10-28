/**
 * B-BOOK-75 — the reader renders a PLAN book from files with zero calls: the
 * cover with the name line, eight linear pages with a Next control and never
 * a Choose, Go, choice card or repair prompt, the win page's frame line in the
 * child's name, and the END screen whose grown-up panel carries the plan's
 * steps, red lines, sources and first week behind the parent-register toggle.
 * Phone portrait, phone landscape and the wide box of the matrix of record.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BookReader } from "./BookReader";
import { BookEnd, parentSections } from "./BookParts";
import { bookFlowReducer, END, initialBookFlow, type BookFlowAction, type BookFlowState } from "../../lib/library/bookFlow";
import { PLAN_FIXTURE_BOOKS } from "../../lib/library/plans/planBooks";
import type { Box } from "../../lib/library/bookPageLayout";
import type { BookLang, BookReaderChild } from "../../lib/library/types";

const book = PLAN_FIXTURE_BOOKS["plan-poo-sit--demo"];
const NOA: BookReaderChild = { id: "demo-child", name: "Noa", gender: "girl", heroSheetId: "placeholder" };
const WIDE: Box = { width: 1920, height: 1008 };
/** The phone boxes of the matrix of record (scripts/capture/release-config.mjs DEVICE_VIEWPORTS): portrait and landscape. */
const PHONE_PORTRAIT: Box = { width: 390, height: 788 };
const PHONE_LANDSCAPE: Box = { width: 844, height: 334 };

const run = (...actions: BookFlowAction[]): BookFlowState => actions.reduce((s, a) => bookFlowReducer(book, s, a), initialBookFlow());
const next = (n: number): BookFlowAction[] => [{ type: "open" }, ...Array.from({ length: n }, () => ({ type: "next" }) as BookFlowAction)];

function render(state: BookFlowState, opts: { lang?: BookLang; child?: BookReaderChild; box?: Box } = {}): string {
  return renderToStaticMarkup(
    <div className="arbor-play">
      <BookReader book={book} lang={opts.lang ?? "en"} child={opts.child ?? NOA} onClose={() => {}} dev narration="off" initialState={state} initialBox={opts.box ?? WIDE} />
    </div>,
  ).replace(/<!-- -->/g, "");
}
const pageOf = (html: string) => /data-book-page="([^"]+)"/.exec(html)?.[1];
const visible = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");

describe("a plan book in the reader", () => {
  it("the cover: the title, the name line with the child's name isolated, the cover line, Open; the pattern's shared plate", () => {
    const html = render(initialBookFlow());
    expect(pageOf(html)).toBe("cover");
    expect(html).toContain("The toilet champion");
    expect(html).toContain('<bdi data-book-name="">Noa</bdi>&#x27;s special plan');
    expect(html).toContain("data-book-open");
    // the pattern's shared plate: with no plate committed under public/visuals/plans
    // it is the shared-storage route, read with the app's auth after mount
    // (lib/plans/planPlateSource) and NEVER a plain <img src>; the DEV
    // placeholder stays the runtime fallback on an image error
    expect(html).not.toContain('src="/api/plans/plates/');
    expect(html).toContain('src="/_dev/plates/plan-poo-sit/PP1.webp"');
    expect(html).toContain('src="/_dev/hero-sheets/placeholder/hands-up.webp"');
  });

  it.each([
    ["wide", WIDE],
    ["phone portrait", PHONE_PORTRAIT],
    ["phone landscape", PHONE_LANDSCAPE],
  ])("turns through the eight pages to the win on %s with Next only: no Choose, Go, card or repair prompt, no count", (_name, box) => {
    const seen: string[] = [];
    for (let n = 0; n <= 7; n++) {
      const html = render(run(...next(n)), { box });
      seen.push(pageOf(html)!);
      expect(html, `page ${n}`).toContain("data-book-next");
      expect(html).not.toContain("data-book-choose");
      expect(html).not.toContain("data-book-go");
      expect(html).not.toContain("data-choice-card");
      expect(html).not.toContain("data-book-repair-prompt");
      expect(visible(html)).not.toMatch(/\b\d+\s*(of|\/)\s*\d+\b/);
    }
    expect(seen).toEqual(["p1", "p2", "p3", "p4", "s1-sit-after-meal-5m", "s2-the-box", "s3-just-try", "p8"]);
  });

  it("the step page says the parent's minutes; the win page keeps the name off the page body (the frame line is the END's)", () => {
    const step = render(run(...next(4)));
    expect(visible(step)).toContain("about 5 minutes");
    expect(step).toContain('src="/_dev/hero-sheets/placeholder/sit-calm.webp"');
    const win = render(run(...next(7)));
    expect(visible(win)).toContain("my body learns to let go at the right time");
    expect(visible(win)).toContain("we just try");
  });

  it("Next on the win page opens the END: 'The End', the frame line in the child's name, Read again and Close; the grown-up panel collapsed", () => {
    const end = run(...next(8));
    expect(end.at).toBe(END);
    const html = render(end);
    expect(html).toContain('data-book-page="end"');
    expect(html).toContain("The End");
    expect(html).toContain('<bdi data-book-name="">Noa</bdi>&#x27;s tummy is learning.');
    expect(html).toContain("data-book-read-again");
    expect(html).toContain("data-book-end-close");
    expect(html).toContain("data-book-grownup");
    expect(html).not.toContain("data-book-grownup-panel");
  });

  it("the grown-up panel carries the plan's steps, first week, red lines and sources under their own headings, in EN and HE", () => {
    for (const lang of ["en", "he"] as const) {
      const html = renderToStaticMarkup(<BookEnd book={book} lang={lang} gender="f" name="Noa" onReadAgain={() => {}} onClose={() => {}} initialGrownUp />);
      expect(html).toContain("data-book-grownup-panel");
      for (const key of ["grownUp.knows", "grownUp.planSteps", "grownUp.firstWeek", "grownUp.tomorrow", "grownUp.ask", "grownUp.watchFor", "grownUp.sources", "grownUp.source"]) {
        expect(html, `${lang} ${key}`).toContain(`data-grownup-section="${key}"`);
      }
      // one heading per list, one line per item
      expect(html.match(/data-grownup-section="grownUp.planSteps"/g)).toHaveLength(1);
      expect(html.match(/data-grownup-section="grownUp.watchFor"/g)).toHaveLength(1);
    }
    const sections = parentSections(book.parent, "en", "f");
    expect(sections.filter(([k]) => k === "grownUp.planSteps")).toHaveLength(3);
    expect(sections.filter(([k]) => k === "grownUp.watchFor")).toHaveLength(book.parent.watchFor.length);
    expect(sections.filter(([k]) => k === "grownUp.sources")).toHaveLength(book.parent.sources.length);
    expect(sections.find(([k]) => k === "grownUp.planSteps")![1]).toContain("5 minutes");
    expect(sections.find(([k]) => k === "grownUp.watchFor")![1]).toBe("There is blood in the poo.");
  });

  it("Hebrew: a girl reads the feminine lines, right-to-left, with the Hebrew title", () => {
    const html = render(run(...next(2)), { lang: "he", child: NOA });
    expect(html).toContain('dir="rtl"');
    expect(visible(html)).toContain("לפעמים אני עסוקה במשחק");
    expect(render(initialBookFlow(), { lang: "he" })).toContain("הבטן שלי לומדת לשחרר");
  });
});
