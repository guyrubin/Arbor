/**
 * B-TODAY-37 (critic r2) — bring the requested question to the top of Now by
 * scrolling the app's ONE scrollport, `<main>`, and nothing else.
 *
 * `scrollIntoView` on the question's title scrolled every scrollable ancestor
 * on its way: the shell wrapper (the top bar left the screen, the Ask dock
 * lifted off the bottom nav) and the plan card's `overflow: hidden` art panel
 * (the hero art was clipped). Here only `main.scrollTop` moves: the title lands
 * its own `scroll-margin-block-start` (the sticky pill rail's
 * --sticky-offset + 12px, about 88px) below main's top edge, i.e. just under
 * the pills. No main (a test host) → nothing scrolls.
 */
export interface ScrollTitle {
  closest(selector: string): ScrollMain | null;
  getBoundingClientRect(): { top: number };
}
export interface ScrollMain {
  scrollTop: number;
  getBoundingClientRect(): { top: number };
  scrollTo(options: { top: number }): void;
}

export function scrollQuestionIntoMain(
  title: ScrollTitle | null | undefined,
  marginOf: (title: ScrollTitle) => number = defaultMargin,
): number | null {
  const main = title?.closest("main");
  if (!title || !main) return null;
  const top = Math.max(0, Math.round(title.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop - marginOf(title)));
  main.scrollTo({ top });
  return top;
}

function defaultMargin(title: ScrollTitle): number {
  try {
    const value = getComputedStyle(title as unknown as Element).scrollMarginBlockStart || getComputedStyle(title as unknown as Element).scrollMarginTop;
    const px = parseFloat(value);
    return Number.isFinite(px) ? px : 0;
  } catch {
    return 0;
  }
}
