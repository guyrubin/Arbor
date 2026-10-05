/**
 * B-BOOK-04 — the new reader, rendered at each step of the flow (react-dom/
 * server; no jsdom in this repo — the state machine is the pure bookFlow
 * reducer, so each screen is rendered from the state the taps produce):
 * cover → open → the decision page (three picture cards, commit needs a second
 * act) → each branch → the repair (every item, any order) → the rejoin echo →
 * the ending with its echo + frame line → "The End" (no "Another way?").
 * Plus: HE (rtl, feminine frame), the 375 sheet, no digits anywhere the child
 * sees, the name isolated in <bdi>, the Next control only where a turn is
 * allowed.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/voice", () => ({ speakText: vi.fn(() => 0), stopVoice: vi.fn(), voiceSupported: () => true }));

import { BookReader } from "./BookReader";
import { bookFlowReducer, initialBookFlow, type BookFlowAction, type BookFlowState } from "../../lib/library/bookFlow";
import { fiveSmoothStones as book } from "../../lib/library/books/fiveSmoothStones";
import type { Box } from "../../lib/library/bookPageLayout";
import type { BookLang, BookReaderChild } from "../../lib/library/types";
import type { HeroSheet } from "../../lib/library/heroSheet";

const BOY: BookReaderChild = { id: "child-1", name: "Dylan", gender: "boy", heroSheetId: "placeholder" };
const GIRL: BookReaderChild = { id: "child-2", name: "נועה", gender: "girl" };
const WIDE: Box = { width: 1920, height: 1008 };
const PHONE: Box = { width: 375, height: 756 };

function run(...actions: BookFlowAction[]): BookFlowState {
  return actions.reduce((s, a) => bookFlowReducer(book, s, a), initialBookFlow());
}

function render(state: BookFlowState, opts: { lang?: BookLang; child?: BookReaderChild; box?: Box } = {}): string {
  return renderToStaticMarkup(
    <div className="arbor-play">
      <BookReader book={book} lang={opts.lang ?? "en"} child={opts.child ?? BOY} onClose={() => {}} dev narration="off" initialState={state} initialBox={opts.box ?? WIDE} />
    </div>,
  ).replace(/<!-- -->/g, "");
}

/** The text a child sees (tags, attributes and styles stripped). */
const visible = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");

const toDecision: BookFlowAction[] = [{ type: "open" }, { type: "next" }, { type: "next" }, { type: "next" }, { type: "next" }];
const pageOf = (html: string) => /data-book-page="([^"]+)"/.exec(html)?.[1];

describe("cover → open", () => {
  it("the cover shows the title as live text, the name line with the name isolated, and Open", () => {
    const html = render(initialBookFlow());
    expect(pageOf(html)).toBe("cover");
    expect(html).toContain("Five Smooth Stones");
    expect(html).toContain("<bdi data-book-name=\"\">Dylan</bdi> as David");
    expect(html).toContain("data-book-open");
    expect(html).not.toContain("data-book-back");
    expect(html).toContain('data-page-type="spread"');
  });

  it("open lands on p1 with the play frame and a Next page control", () => {
    const html = render(run({ type: "open" }));
    expect(pageOf(html)).toBe("p1");
    expect(html).toContain("Today, <bdi data-book-name=\"\">Dylan</bdi> is David, the shepherd.");
    expect(html).toContain("data-book-next");
    expect(html).toContain("data-book-back");
    expect(html).toContain('data-page-type="facing"');
    // the hero sprite comes from the DEV sheet named by the child
    expect(html).toContain('src="/_dev/hero-sheets/placeholder/sling-swing.webp"');
    // the plate tries the real file first, then the DEV placeholder
    expect(html).toContain('src="/visuals/books/five-smooth-stones/PL1.webp"');
  });
});

describe("the decision page", () => {
  it("three picture cards, no letters, Go disabled until a card is selected, no Next", () => {
    const html = render(run(...toDecision));
    expect(pageOf(html)).toBe("p5");
    expect(html.match(/data-choice-card="/g)).toHaveLength(3);
    expect(html).toMatch(/data-book-go=""[^>]*disabled/);
    expect(html).not.toContain("data-book-next");
    // the card picture is a crop of the decision plate (focus rect), not an icon
    expect(html).toContain("bk-card-pic");
    expect(html).toContain('url(&quot;/visuals/books/five-smooth-stones/PL4.webp&quot;)');
    for (const label of ["Go as I am", "Wear the king&#x27;s armour", "Wait for a soldier"]) expect(html).toContain(label);
    expect(visible(html)).not.toMatch(/(^|\s)[ABC](\s|$)/);
  });

  it("one tap selects (Go enables), a second tap on the same card commits into the branch", () => {
    const selected = run(...toDecision, { type: "choose", choiceId: "b" });
    const html = render(selected);
    expect(pageOf(html)).toBe("p5");
    expect(html).toMatch(/data-choice-card="b"[^>]*data-selected=""/);
    expect(html).not.toMatch(/data-book-go=""[^>]*disabled/);
    const committed = bookFlowReducer(book, selected, { type: "choose", choiceId: "b" });
    expect(committed.at).toBe("p6b");
    // Go commits the same way
    expect(bookFlowReducer(book, selected, { type: "go" }).at).toBe("p6b");
  });
});

describe("each branch reaches the rejoin with its own echo", () => {
  it("HARD: p6a → p8 'His feet are light.'", () => {
    const s = run(...toDecision, { type: "choose", choiceId: "a" }, { type: "go" });
    expect(pageOf(render(s))).toBe("p6a");
    const p8 = render(bookFlowReducer(book, s, { type: "next" }));
    expect(pageOf(p8)).toBe("p8");
    expect(p8).toContain("His feet are light. He got here first.");
    expect(p8).not.toContain("His shoulders still ache");
  });

  it("EASY: p6b (helmet + sword overlays) → p7b holds until every piece is off, any order", () => {
    let s = run(...toDecision, { type: "choose", choiceId: "b" }, { type: "go" });
    const p6b = render(s);
    expect(p6b).toContain('data-book-overlay="helmet-worn"');
    expect(p6b).toContain('data-book-overlay="sword"');
    s = bookFlowReducer(book, s, { type: "next" });
    let html = render(s);
    expect(pageOf(html)).toBe("p7b");
    expect(html).toContain("data-book-repair-prompt");
    expect(html).toContain("Take it off");
    expect(html.match(/data-book-item="/g)).toHaveLength(3);
    expect(html).not.toContain("data-book-next");
    // the page cannot turn yet
    expect(bookFlowReducer(book, s, { type: "next" }).at).toBe("p7b");
    // before: the worn helmet and the sword on the rug show, the heap pieces wait
    expect(html).not.toMatch(/data-book-overlay="helmet-worn"[^>]*data-hidden/);
    expect(html).toMatch(/data-book-overlay="helmet-heap"[^>]*data-hidden=""/);
    s = bookFlowReducer(book, s, { type: "repair", itemId: "sword" });
    html = render(s);
    expect(html).toMatch(/data-book-overlay="sword-rug"[^>]*data-hidden=""/);
    expect(html).toMatch(/data-book-overlay="sword-heap" data-hop=""/);
    expect(html).toContain("Off comes the sword.");
    expect(html).toMatch(/data-book-item="sword"[^>]*data-done=""/);
    expect(html).not.toContain("data-book-next");
    s = bookFlowReducer(book, s, { type: "repair", itemId: "helmet" });
    s = bookFlowReducer(book, s, { type: "repair", itemId: "coat" });
    html = render(s);
    expect(html).toContain("Off comes the sword. Off comes the helmet. Off comes the coat.");
    expect(html).toContain("David stretches. Light again!");
    expect(html).toContain('src="/_dev/hero-sheets/placeholder/free-stretch.webp"');
    expect(html).not.toContain("data-book-repair-prompt");
    expect(html).toContain("data-book-next");
    const p8 = render(bookFlowReducer(book, s, { type: "next" }));
    expect(pageOf(p8)).toBe("p8");
    expect(p8).toContain("His shoulders still ache from the heavy coat.");
  });

  it("THIRD: p6c → p7c's one big 'Stand up!' → p8 'The waiting took all morning.'", () => {
    let s = run(...toDecision, { type: "choose", choiceId: "c" }, { type: "go" }, { type: "next" });
    let html = render(s);
    expect(pageOf(html)).toBe("p7c");
    expect(html).toMatch(/data-book-repair="stand"[^>]*>[\s\S]*Stand up!/);
    expect(html).not.toContain("data-book-item=");
    expect(html).not.toContain("data-book-next");
    s = bookFlowReducer(book, s, { type: "repair", itemId: "stand" });
    html = render(s);
    expect(html).toContain("Then David stands up tall.");
    expect(html).toContain("data-book-next");
    const p8 = render(bookFlowReducer(book, s, { type: "next" }));
    expect(p8).toContain("The sun is high. The waiting took all morning.");
  });
});

describe("the ending", () => {
  const atEnd = (cid: string) => {
    let s = run(...toDecision, { type: "choose", choiceId: cid }, { type: "go" });
    for (let i = 0; i < 6; i++) {
      for (const it of book.decision.choices.find((c) => c.id === cid)!.branch.find((p) => p.id === s.at)?.repair?.items ?? []) s = bookFlowReducer(book, s, { type: "repair", itemId: it.id });
      s = bookFlowReducer(book, s, { type: "next" });
    }
    return s;
  };

  it.each([
    ["a", "His own staff. His own sling. All tried."],
    ["b", "The king&#x27;s armour? One day, after a hundred tries."],
    ["c", "Next time a giant shouts, David won&#x27;t wait."],
  ])("path %s ends on p10 with its echo, the frame line and 'The End' — no 'Another way?'", (cid, echo) => {
    const html = render(atEnd(cid));
    expect(pageOf(html)).toBe("p10");
    expect(html).toContain(echo);
    expect(html).toContain("And today, <bdi data-book-name=\"\">Dylan</bdi> was David, the shepherd.");
    expect(html).toContain("data-book-end");
    expect(html).not.toContain("data-book-next");
    expect(html).not.toMatch(/Another way|דרך אחרת/);
  });

  it("p9's dust cloud waits for the narration (hidden on a silent page until a tap)", () => {
    const s = atEnd("a");
    const p9 = render(bookFlowReducer(book, s, { type: "back" }));
    expect(pageOf(p9)).toBe("p9");
    expect(p9).toMatch(/data-book-overlay="dust-cloud"[^>]*data-hidden=""/);
  });
});

describe("real art: prints, shadow + grade, occluder, costume", () => {
  const sheet: HeroSheet = {
    id: "placeholder",
    poses: {},
    base: "/_dev/hero-sheets/placeholder",
    anchors: { "walk-bag-left": { aspect: 0.5, footX: 0.45, footW: 0.5 } },
    prints: { cover: { url: "/_dev/hero-sheets/placeholder/prints/cover.webp", width: 1920, height: 1280 } },
  };
  const withSheet = (state: BookFlowState, extra: Partial<React.ComponentProps<typeof BookReader>> = {}) =>
    renderToStaticMarkup(
      <div className="arbor-play">
        <BookReader book={book} lang="en" child={BOY} onClose={() => {}} dev narration="off" initialState={state} initialBox={WIDE} sheet={sheet} {...extra} />
      </div>,
    );

  it("a printed page shows the print in place of plate + sprite; prints off shows the composite", () => {
    const html = withSheet(initialBookFlow());
    expect(html).toContain('src="/_dev/hero-sheets/placeholder/prints/cover.webp"');
    expect(html).toContain("data-printed");
    expect(html).not.toContain("data-book-hero");
    const off = withSheet(initialBookFlow(), { prints: false });
    expect(off).not.toContain("prints/cover.webp");
    expect(off).toContain('src="/_dev/hero-sheets/placeholder/walk-bag-left.webp"');
    expect(off).toContain('data-book-shadow="core"');
    expect(off).toContain('data-book-shadow="spill"');
    // the grade layer is masked by the sprite itself
    expect(off).toMatch(/bk-hero-tint[^>]*mask-image:url\(&quot;\/_dev\/hero-sheets\/placeholder\/walk-bag-left\.webp/);
  });

  it("p8 draws the water occluder over the hero", () => {
    const s = run(...toDecision, { type: "choose", choiceId: "a" }, { type: "go" }, { type: "next" });
    const html = render(s);
    expect(pageOf(html)).toBe("p8");
    expect(html).toContain("data-book-occluder");
    expect(html.indexOf("data-book-hero")).toBeLessThan(html.indexOf("data-book-occluder"));
  });

  it("costume=tunic swaps p5's pose to worried-tunic (the BR5 A/B)", () => {
    const s = run(...toDecision);
    expect(render(s)).toContain("/worried.webp");
    const tunic = withSheet(s, { costume: "tunic" });
    expect(tunic).toContain("/worried-tunic.webp");
  });
});

describe("Hebrew, the phone sheet, and what the child never sees", () => {
  it("HE: rtl, the girl's frame line, her Hebrew name isolated", () => {
    const html = render(run({ type: "open" }), { lang: "he", child: GIRL });
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="he"');
    expect(html).toContain("היום <bdi data-book-name=\"\">נועה</bdi> היא דוד, הרועה.");
    // no hero sheet for this child → the page renders without a sprite
    expect(html).not.toContain("data-book-hero");
  });

  it("375 x 812: the stacked sheet, Next as a big bar", () => {
    const html = render(run({ type: "open" }), { box: PHONE });
    expect(html).toContain('data-mode="stacked"');
    expect(html).toContain('data-kind="sheet"');
    expect(html).toContain("data-book-next");
  });

  it("no digits anywhere the child sees, on every screen of every path, EN and HE", () => {
    const screens: BookFlowState[] = [initialBookFlow()];
    for (const cid of ["a", "b", "c"]) {
      let s = run(...toDecision, { type: "choose", choiceId: cid }, { type: "go" });
      for (let i = 0; i < 8; i++) {
        screens.push(s);
        const page = book.decision.choices.find((c) => c.id === cid)!.branch.find((p) => p.id === s.at);
        for (const it of page?.repair?.items ?? []) s = bookFlowReducer(book, s, { type: "repair", itemId: it.id });
        screens.push(s);
        s = bookFlowReducer(book, s, { type: "next" });
      }
    }
    for (const lang of ["en", "he"] as const) {
      for (const s of screens) expect(visible(render(s, { lang })), `${lang} ${s.at}`).not.toMatch(/\d/);
    }
  });
});
