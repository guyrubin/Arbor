import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { scrollQuestionIntoMain, type ScrollMain, type ScrollTitle } from "./nowDeepLinkScroll";

/* B-TODAY-37 (critic r2) — the deep link scrolls <main> only. The r2 build
   called scrollIntoView on the question's title, which also scrolled the shell
   wrapper (scrollTop 60: the top bar left, the Ask dock lifted off the nav) and
   the plan card's art panel (scrollTop 50: the hero clipped). */

function layout() {
  // The real ancestor chain: shell wrapper › main (the scrollport) › … › .now-plan-art › h2.
  const wrapper = { className: "flex", scrollTop: 0 };
  const art = { className: "now-plan-art", scrollTop: 0 };
  const main: ScrollMain = { scrollTop: 400, getBoundingClientRect: () => ({ top: 52 }), scrollTo: vi.fn(({ top }: { top: number }) => { main.scrollTop = top; }) };
  const scrollIntoView = vi.fn(() => { wrapper.scrollTop = 60; art.scrollTop = 50; main.scrollTop = 475; });
  const title: ScrollTitle & { scrollIntoView: typeof scrollIntoView } = {
    closest: (selector: string) => (selector === "main" ? main : null),
    getBoundingClientRect: () => ({ top: 700 }),
    scrollIntoView,
  };
  return { wrapper, art, main, title, scrollIntoView };
}

describe("B-TODAY-37 · the deep link moves <main> alone", () => {
  it("puts the question its 88px scroll margin under main's top; the shell wrapper and the art panel stay at scrollTop 0", () => {
    const { wrapper, art, main, title, scrollIntoView } = layout();
    const top = scrollQuestionIntoMain(title, () => 88);
    expect(top).toBe(700 - 52 + 400 - 88);
    expect(main.scrollTo).toHaveBeenCalledWith({ top: 960 });
    expect(main.scrollTop).toBe(960);
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(wrapper.scrollTop).toBe(0);
    expect(art.scrollTop).toBe(0);
  });

  it("never scrolls above the top, and does nothing without a main or a title", () => {
    const { main, title } = layout();
    main.scrollTop = 0;
    expect(scrollQuestionIntoMain({ ...title, getBoundingClientRect: () => ({ top: 80 }) }, () => 88)).toBe(0);
    expect(scrollQuestionIntoMain({ closest: () => null, getBoundingClientRect: () => ({ top: 10 }) })).toBeNull();
    expect(scrollQuestionIntoMain(null)).toBeNull();
  });

  it("NEGATIVE CONTROL — the r2 call (scrollIntoView on the title) is what moved the wrapper and the art", () => {
    const { wrapper, art, title } = layout();
    title.scrollIntoView();
    expect(wrapper.scrollTop).toBe(60);
    expect(art.scrollTop).toBe(50);
  });

  it("NowView uses the helper and no scrollIntoView on the deep link", () => {
    const src = readFileSync(path.resolve(__dirname, "NowView.tsx"), "utf8");
    expect(src).toContain("scrollQuestionIntoMain(stepTitle.current);");
    expect(src).not.toMatch(/stepTitle\.current[^;]*scrollIntoView|\.scrollIntoView\?\.\(\{ block: "start" \}\)/);
  });
});
