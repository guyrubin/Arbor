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

import { BookReader, nextIntent } from "./BookReader";
import { BookEnd } from "./BookParts";
import { narrationCandidates } from "./useNarration";
import { BOOK_PLATES } from "../../lib/library/books";
import { makePlate } from "../../lib/library/bookPlates";
import { bookFlowReducer, END, initialBookFlow, type BookFlowAction, type BookFlowState } from "../../lib/library/bookFlow";
import { fiveSmoothStones as book } from "../../lib/library/books/fiveSmoothStones";
import type { Box } from "../../lib/library/bookPageLayout";
import type { BookLang, BookReaderChild } from "../../lib/library/types";
import { applySheetManifest, choicePictureSources, resolvePose, type HeroSheet } from "../../lib/library/heroSheet";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const BOY: BookReaderChild = { id: "child-1", name: "Dylan", gender: "boy", heroSheetId: "placeholder" };
const GIRL: BookReaderChild = { id: "child-2", name: "נועה", gender: "girl" };
const WIDE: Box = { width: 1920, height: 1008 };
const PHONE: Box = { width: 375, height: 756 };

function run(...actions: BookFlowAction[]): BookFlowState {
  return actions.reduce((s, a) => bookFlowReducer(book, s, a), initialBookFlow());
}

function render(state: BookFlowState, opts: { lang?: BookLang; child?: BookReaderChild; box?: Box; revealed?: boolean | number; choosing?: boolean } = {}): string {
  return renderToStaticMarkup(
    <div className="arbor-play">
      <BookReader book={book} lang={opts.lang ?? "en"} child={opts.child ?? BOY} onClose={() => {}} dev narration="off" initialState={state} initialBox={opts.box ?? WIDE} initialRevealed={opts.revealed} initialChoosing={opts.choosing} />
    </div>,
  ).replace(/<!-- -->/g, "");
}

/** The text a child sees (tags, attributes and styles stripped). */
const visible = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");

// manuscript v3: cover → p1, p2, p2b, p3, p3b, p4, p4b → p5
const toDecision: BookFlowAction[] = [{ type: "open" }, ...Array.from({ length: 7 }, () => ({ type: "next" }) as BookFlowAction)];
const pageOf = (html: string) => /data-book-page="([^"]+)"/.exec(html)?.[1];

describe("cover → open", () => {
  it("the cover shows the title as live text, the name line with the name isolated, and Open", () => {
    const html = render(initialBookFlow());
    expect(pageOf(html)).toBe("cover");
    expect(html).toContain("Five Smooth Stones");
    expect(html).toContain("<bdi data-book-name=\"\">Dylan</bdi> as David");
    expect(html).toContain("data-book-open");
    expect(html).not.toContain("data-book-back");
    // fix round 1: the cover is the book's front at 1920 — the title in the
    // plate's calm band (no card), ONE Open toy under the plate
    expect(html).toContain('data-page-type="cover"');
    expect(html).toContain('data-kind="cover"');
    expect(html).toContain("bk-open-row");
    expect(html).not.toContain('data-kind="panel"');
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
  it("fix round 2: first the words with a Choose toy (the same book page, no cards yet)", () => {
    const html = render(run(...toDecision));
    expect(pageOf(html)).toBe("p5");
    expect(html).toContain("What will David do?");
    expect(html).toContain("data-book-choose");
    expect(html).not.toContain("data-choice-card");
    expect(html).not.toContain("data-book-go");
  });

  it("then the cards state: three picture cards, no letters, Go disabled until a card is selected, no Next", () => {
    const html = render(run(...toDecision), { choosing: true });
    expect(pageOf(html)).toBe("p5");
    expect(html).toContain("data-choosing");
    expect(html).not.toContain("What will David do?");
    expect(html.match(/data-choice-card="/g)).toHaveLength(3);
    expect(html).toMatch(/data-book-go=""[^>]*disabled/);
    expect(html).not.toContain("data-book-next");
    // the card picture is a crop of the decision plate (focus rect), not an icon
    expect(html).toContain("bk-card-pic");
    expect(html).toContain('url(&quot;/visuals/books/five-smooth-stones/PL4.webp&quot;)');
    for (const label of ["Go as I am", "Wear the king&#x27;s armour", "Wait for someone bigger"]) expect(html).toContain(label);
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

  it("EASY: p6b (helmet + sword overlays) → p7b: helmet → sword → coat, only the next piece can be tapped", () => {
    let s = run(...toDecision, { type: "choose", choiceId: "b" }, { type: "go" });
    const p6b = render(s);
    expect(p6b).toContain('data-book-overlay="helmet-worn"');
    expect(p6b).toContain('data-book-overlay="sword"');
    s = bookFlowReducer(book, s, { type: "next" });
    let html = render(s);
    expect(pageOf(html)).toBe("p7b");
    expect(html).toContain("data-book-repair-prompt");
    expect(html).toContain("Take it off");
    // only the next piece glows and can be tapped (fix round 1, ruling 4)
    expect(html.match(/data-book-item="/g)).toHaveLength(1);
    expect(html).toContain('data-book-item="helmet"');
    expect(html).toMatch(/class="bk-hint"[^>]*>[\s\S]*<svg class="bk-hand"/);
    expect(html).not.toContain("bk-prompt-row");
    expect(html).not.toContain("data-book-next");
    // the page cannot turn yet
    expect(bookFlowReducer(book, s, { type: "next" }).at).toBe("p7b");
    // before: the worn helmet and the sword on the rug show, the heap pieces wait
    expect(html).not.toMatch(/data-book-overlay="helmet-worn"[^>]*data-hidden/);
    expect(html).toMatch(/data-book-overlay="helmet-heap"[^>]*data-hidden=""/);
    // out of order is ignored
    expect(bookFlowReducer(book, s, { type: "repair", itemId: "coat" })).toBe(s);
    s = bookFlowReducer(book, s, { type: "repair", itemId: "helmet" });
    html = render(s);
    expect(html).toMatch(/data-book-overlay="helmet-worn"[^>]*data-hidden=""/);
    expect(html).toMatch(/data-book-overlay="helmet-heap" data-hop=""/);
    expect(html).toContain("Off comes the helmet.");
    expect(html.match(/data-book-item="/g)).toHaveLength(1);
    expect(html).toContain('data-book-item="sword"');
    // the coat is still worn: no coat on the rug yet, the sprite is armour-stuck
    expect(html).toMatch(/data-book-overlay="coat-heap"[^>]*data-hidden=""/);
    expect(html).toContain("/armour-stuck.webp");
    expect(html).not.toContain("data-book-next");
    s = bookFlowReducer(book, s, { type: "repair", itemId: "sword" });
    html = render(s);
    expect(html).toMatch(/data-book-overlay="sword-rug"[^>]*data-hidden=""/);
    expect(html).toContain('data-book-item="coat"');
    s = bookFlowReducer(book, s, { type: "repair", itemId: "coat" });
    html = render(s);
    expect(html).toContain("Off comes the helmet. Off comes the sword. Off comes the coat.");
    expect(html).not.toContain("data-book-item=");
    expect(html).toContain("David can see again. His own staff, his own sling. Now he runs!");
    expect(html).toContain('src="/_dev/hero-sheets/placeholder/free-stretch.webp"');
    expect(html).not.toContain("data-book-repair-prompt");
    expect(html).toContain("data-book-next");
    const p8 = render(bookFlowReducer(book, s, { type: "next" }));
    expect(pageOf(p8)).toBe("p8");
    expect(p8).toContain("His shoulders still ache from the heavy coat.");
  });

  it("THIRD: p6c → p7c's 'Stand up!' tap on the boy (hint, not a button) → p8 'The waiting took all morning.'", () => {
    let s = run(...toDecision, { type: "choose", choiceId: "c" }, { type: "go" }, { type: "next" });
    let html = render(s);
    expect(pageOf(html)).toBe("p7c");
    expect(html).toContain('data-book-item="stand"');
    expect(html).toMatch(/class="bk-hint"[^>]*>[\s\S]*Stand up!/);
    expect(html).not.toContain("data-book-next");
    s = bookFlowReducer(book, s, { type: "repair", itemId: "stand" });
    html = render(s);
    expect(html).toContain("David stands up tall. If nobody goes, David will go.");
    expect(html).toContain("data-book-next");
    // v2: the page ENDS on David standing (stand-tall; until the sheet has it, its stopgap)
    expect(html).toMatch(/\/(stand-tall|look-up)\.webp/);
    expect(html).not.toContain("/run-staff");
    const p8 = render(bookFlowReducer(book, s, { type: "next" }));
    expect(p8).toContain("The sun is high. The waiting took all morning.");
  });
});

describe("the ending", () => {
  const toPage = (cid: string, target: string) => {
    let s = run(...toDecision, { type: "choose", choiceId: cid }, { type: "go" });
    for (let i = 0; i < 8 && s.at !== target; i++) {
      for (const it of book.decision.choices.find((c) => c.id === cid)!.branch.find((p) => p.id === s.at)?.repair?.items ?? []) s = bookFlowReducer(book, s, { type: "repair", itemId: it.id });
      s = bookFlowReducer(book, s, { type: "next" });
    }
    return s;
  };

  it.each([
    ["a", "His own staff. His own sling."],
    ["b", "Armour? One day, after a hundred tries."],
    ["c", "His knees remember the long wait."],
  ])("path %s: p10 shows its echo + frame line and a Next that opens the END screen — no 'Another way?'", (cid, echo) => {
    const s = toPage(cid, "p10");
    const html = render(s);
    expect(pageOf(html)).toBe("p10");
    expect(html).toContain(echo);
    expect(html).toContain("And today, <bdi data-book-name=\"\">Dylan</bdi> was David, the shepherd.");
    expect(html).toContain("data-book-next");
    expect(html).not.toMatch(/Another way|דרך אחרת/);
    const end = bookFlowReducer(book, s, { type: "next" });
    expect(end.at).toBe(END);
  });

  it("the END screen: 'The End', the frame line, Read again + close, the grown-up panel collapsed (a >= 48 px control)", () => {
    const end = bookFlowReducer(book, toPage("b", "p10"), { type: "next" });
    const html = render(end);
    expect(html).toContain('data-book-end-screen=""');
    expect(html).toMatch(/class="bk-end-title"[^>]*>The End</);
    // fix round 2: the end screen is the book's last page — the book frame,
    // the last page's art on the art page, the words on the paper page
    expect(html).toContain('data-book-page="end"');
    expect(html).toContain('class="bk-art"');
    expect(html).toContain('/PL1d.webp');
    expect(html).toContain('data-end=""');
    expect(html).toContain("And today, <bdi data-book-name=\"\">Dylan</bdi> was David, the shepherd.");
    expect(html).toContain("data-book-read-again");
    expect(html).toContain("data-book-end-close");
    expect(html).toMatch(/data-book-grownup="" aria-expanded="false"/);
    expect(html).not.toContain("data-book-grownup-panel");
    // Read again → the cover; back → the last page (never a silent snap to the cover)
    expect(bookFlowReducer(book, end, { type: "toCover" }).at).toBe("cover");
    expect(bookFlowReducer(book, end, { type: "back" }).at).toBe("p10");
    expect(bookFlowReducer(book, end, { type: "next" }).at).toBe(END);
  });

  it.each([
    ["en", ["What the story knows", "Why it matters at five, this week", "One thing to do tomorrow", "Ask after", "Ask after, optional (5–7)", "Reading together", "Source note"], "Nobody sent him: he volunteered."],
    ["he", ["מה הסיפור יודע", "למה זה חשוב בגיל חמש, השבוע", "דבר אחד לעשות מחר", "שאלה אחרי הקריאה", "שאלה נוספת, לבחירה (5–7)", "כשקוראים יחד", "הערת מקור"], "אף אחד לא שלח אותו: הוא התנדב."],
  ] as const)("manuscript v2: the grown-up panel shows the v2 sections with their headings, in order (%s)", (lang, headings, knows) => {
    const html = renderToStaticMarkup(
      <BookEnd book={book} lang={lang} gender="m" name="Dylan" onReadAgain={() => {}} onClose={() => {}} initialGrownUp />,
    );
    expect(html).toContain("data-book-grownup-panel");
    const shown = [...html.matchAll(/<dt data-grownup-section="[^"]+">([^<]+)<\/dt>/g)].map((m) => m[1]);
    expect(shown).toEqual([...headings]);
    expect(html).toContain(knows);
    // the v1 sections are gone for this book
    expect(html).not.toContain("grownUp.builds");
    expect(html).not.toMatch(/What it builds|מה הסיפור בונה/);
  });

  it("p9: the dust waits for the narration; the first Next reveals it, then 1.5 s of stillness, then Next turns", () => {
    const s = toPage("a", "p9");
    const p9 = render(s);
    expect(pageOf(p9)).toBe("p9");
    expect(p9).toMatch(/data-book-overlay="dust-cloud"[^>]*data-hidden=""/);
    expect(nextIntent(true, false, false)).toBe("reveal");
    expect(nextIntent(true, true, true)).toBe("hold");
    expect(nextIntent(true, true, false)).toBe("turn");
    expect(nextIntent(false, false, false)).toBe("turn");
    // v3: stage 1 = the stone in flight, stage 2 = the dust
    const shown = render(s, { revealed: 2 });
    expect(shown).not.toMatch(/data-book-overlay="dust-cloud"[^>]*data-hidden=""/);
    // the last state is the quiet on PL7-rise
    const all = render(s, { revealed: true });
    expect(all).toContain('data-book-state-plate="PL7-rise"');
    expect(all).toMatch(/data-book-overlay="dust-cloud"[^>]*data-hidden=""/);
  });

  it("v2 art states: p9 = swing → dust → 'the soldiers rise' plate cross-fading in over PL7 (the hero stays, the dust goes)", () => {
    const s = toPage("a", "p9");
    const RISE = [
      { id: "dust", overlays: ["dust-cloud"], cue: { atFraction: 0.93 }, silentAfterMs: 4000 },
      { id: "rise", plateId: "PL7-rise", overlays: [], cue: "audioEnd" as const, silentAfterMs: 3000 },
    ];
    const riseBook = { ...book, pages: book.pages.map((p) => (p.id === "p9" ? { ...p, artStates: RISE } : p)) };
    const plates = { ...BOOK_PLATES[book.id], "PL7-rise": makePlate(book.id, "PL7-rise", "day", { width: 1920, height: 1280 }) };
    const { "PL7-rise": _rise, ...withoutRise } = plates;
    const at = (stage: number | boolean, withPlate = true) =>
      renderToStaticMarkup(<BookReader book={riseBook} lang="en" child={BOY} onClose={() => {}} dev narration="off" initialState={s} initialBox={WIDE} plates={withPlate ? plates : withoutRise} initialRevealed={stage} />);
    const s0 = at(0);
    expect(s0).toMatch(/data-book-overlay="dust-cloud"[^>]*data-hidden=""/);
    expect(s0).not.toContain("data-book-state-plate");
    const s1 = at(1);
    expect(s1).not.toMatch(/data-book-overlay="dust-cloud"[^>]*data-hidden=""/);
    expect(s1).not.toContain("data-book-state-plate");
    const s2 = at(2);
    expect(s2).toContain('data-book-state-plate="PL7-rise"');
    expect(s2).toContain("/PL7-rise.webp");
    expect(s2).toMatch(/data-book-overlay="dust-cloud"[^>]*data-hidden=""/);
    expect(s2).toContain("data-book-hero");
    // the plate not delivered: the page is the v1 page (the dust state only)
    const noPlate = at(true, false);
    expect(noPlate).not.toContain("data-book-state-plate");
    expect(noPlate).not.toMatch(/data-book-overlay="dust-cloud"[^>]*data-hidden=""/);
  });

  it("v2 engine 2: a pose the sheet lacks shows its stopgap; a sheet that has it shows it (p7c ends standing)", () => {
    let s = run(...toDecision, { type: "choose", choiceId: "c" }, { type: "go" }, { type: "next" });
    s = bookFlowReducer(book, s, { type: "repair", itemId: "stand" });
    const base = "/_dev/hero-sheets/x";
    const lacking: HeroSheet = { id: "x", base, poses: { "look-up": `${base}/look-up.webp`, sit: `${base}/sit.webp` } };
    const having: HeroSheet = { ...lacking, poses: { ...lacking.poses, "stand-tall": `${base}/stand-tall.webp` } };
    const html = (sheet: HeroSheet) => renderToStaticMarkup(<BookReader book={book} lang="en" child={BOY} onClose={() => {}} dev narration="off" initialState={s} initialBox={WIDE} sheet={sheet} />);
    expect(html(lacking)).toContain(`src="${base}/look-up.webp"`);
    expect(html(having)).toContain(`src="${base}/stand-tall.webp"`);
    expect(resolvePose(null, "stand-tall", book.poseFallbacks)).toBe("stand-tall");
  });

  it("v3 (round 4): p9 = swing → the stone in flight (PL7-flight2 + sling-release) → dust on the duel plate → quiet (PL7-rise); a narration set may be WAV", () => {
    const s = toPage("a", "p9");
    const at = (stage: number) => render(s, { revealed: stage });
    expect(at(0)).not.toContain("data-book-state-plate");
    const flight = at(1);
    expect(flight).toContain('data-book-state-plate="PL7-flight2"');
    expect(flight).toContain("/sling-release.webp");
    expect(flight).toMatch(/data-book-overlay="dust-cloud"[^>]*data-hidden=""/);
    const dust = at(2);
    expect(dust).toContain('data-book-state-plate="PL7"');
    expect(dust).toContain("/sling-swing-face-right.webp");
    expect(dust).not.toMatch(/data-book-overlay="dust-cloud"[^>]*data-hidden=""/);
    const quiet = at(3);
    expect(quiet).toContain('data-book-state-plate="PL7-rise"');
    expect(quiet).toMatch(/data-book-overlay="dust-cloud"[^>]*data-hidden=""/);
    expect(narrationCandidates("/_dev/narration/five-smooth-stones/dylan-v2-expressive/en/p9.mp3")).toEqual([
      "/_dev/narration/five-smooth-stones/dylan-v2-expressive/en/p9.mp3",
      "/_dev/narration/five-smooth-stones/dylan-v2-expressive/en/p9.wav",
    ]);
  });

  it("p9 lays out with the PLATE's size whether the print or the composite shows (no frame jump)", () => {
    const sheet: HeroSheet = { id: "placeholder", poses: {}, base: "/_dev/hero-sheets/placeholder", prints: { p9: { url: "/_dev/hero-sheets/placeholder/prints/p9.webp", width: 1920, height: 1280 } } };
    const s = toPage("a", "p9");
    const html = (revealed: boolean) =>
      renderToStaticMarkup(<BookReader book={book} lang="en" child={BOY} onClose={() => {}} dev narration="off" initialState={s} initialBox={WIDE} sheet={sheet} initialRevealed={revealed} />);
    const art = (h: string) => /class="bk-art"[^>]*style="([^"]+)"/.exec(h)![1];
    const before = html(false);
    const after = html(true);
    expect(before).toContain("prints/p9.webp");
    expect(after).not.toContain("prints/p9.webp");
    expect(art(before)).toBe(art(after));
  });
});

describe("real art: prints, shadow + grade, occluder, costume", () => {
  const sheet: HeroSheet = {
    id: "placeholder",
    poses: {},
    base: "/_dev/hero-sheets/placeholder",
    anchors: { "look-across": { aspect: 0.5, footX: 0.45, footW: 0.5 } },
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
    expect(off).toContain('src="/_dev/hero-sheets/placeholder/look-across.webp"');
    expect(off).toContain('data-book-shadow="core"');
    expect(off).toContain('data-book-shadow="spill"');
    // the grade layer is masked by the sprite itself
    expect(off).toMatch(/bk-hero-tint[^>]*mask-image:url\(&quot;\/_dev\/hero-sheets\/placeholder\/look-across\.webp/);
  });

  it("a plate occluder (a patch of the plate) draws OVER the hero", () => {
    const s = run(...toDecision, { type: "choose", choiceId: "a" }, { type: "go" }, { type: "next" });
    const p8 = book.pages.find((p) => p.id === "p8")!;
    const withOcc = { ...book, pages: book.pages.map((p) => (p.id === "p8" ? { ...p8, occluders: [{ box: [0.4, 0.4, 0.5, 0.5] as [number, number, number, number], opacity: 0.8, feather: 0.01, featherTop: 0.004 }] } : p)) };
    const html = renderToStaticMarkup(<BookReader book={withOcc} lang="en" child={BOY} onClose={() => {}} dev narration="off" initialState={s} initialBox={WIDE} />);
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

describe("fix round 1: bar, accent, choice cards", () => {
  it("the bar: a 48 px close toy with the close glyph, a paper Sound toy", () => {
    const html = render(run({ type: "open" }));
    const tag = (attr: string) => new RegExp(`<button[^>]*${attr}[^>]*>`).exec(html)?.[0] ?? "";
    for (const attr of ["data-book-close", "data-book-sound"]) {
      expect(tag(attr), attr).toContain('data-tone="paper"');
      expect(tag(attr), attr).toContain('data-size="s"'); // 48 px round toy
      expect(tag(attr), attr).toContain('data-shape="round"');
    }
    expect(html).toMatch(/data-book-close=""[^>]*>[\s\S]*?>close</);
    expect(tag("data-book-sound")).toContain('aria-pressed="true"');
  });

  it("the child's name in running text wears the cover's accent colour (CSS)", () => {
    const css = readFileSync(path.join(here, "bookReader.css"), "utf8");
    expect(css).toMatch(/\.bk-words bdi,[\s\S]*?\{ font-weight: 700; color: var\(--arbor-clay\); \}/);
    // the card lips are solid colours (the -soft tokens are gradients)
    expect(css).not.toMatch(/--card-lip: var\(--arbor-[a-z]+-soft\)/);
  });

  it("decision cards at 1920: the cards state stacks three LARGE cards (pictures >= 300 px wide, 4:3) in the same book", () => {
    const html = render(run(...toDecision), { choosing: true });
    expect(html).toContain('data-arrangement="threeDown"');
    expect(html).toContain('data-plan="second"');
    const picW = Number(/--pic-w:([\d.]+)px/.exec(html)![1]);
    const picH = Number(/--pic-h:([\d.]+)px/.exec(html)![1]);
    expect(picW).toBeGreaterThanOrEqual(300);
    expect(picH / picW).toBeCloseTo(0.75, 1);
    // the art page is the same as p4's
    const artOf = (h: string) => /class="bk-art"[^>]*style="([^"]+)"/.exec(h)![1];
    const p4 = render(run(...toDecision.slice(0, -2)));
    expect(pageOf(p4)).toBe("p4");
    expect(artOf(html)).toBe(artOf(p4));
  });
});

describe("fix round 2: dedicated choice-card pictures", () => {
  it("the child's own card picture wins, then the book's scene picture, else the plate crop", () => {
    const sheet: HeroSheet = { id: "placeholder", poses: {}, base: "/_dev/hero-sheets/placeholder", choices: { a: "/_dev/hero-sheets/placeholder/choices/a.webp" } };
    const withArt = { ...book, decision: { ...book.decision, choiceArt: { a: "/visuals/books/five-smooth-stones/choices/a.webp", b: "/visuals/books/five-smooth-stones/choices/b.webp" } } };
    const html = renderToStaticMarkup(<BookReader book={withArt} lang="en" child={BOY} onClose={() => {}} dev narration="off" initialState={run(...toDecision)} initialBox={WIDE} sheet={sheet} initialChoosing />);
    const card = (id: string) => new RegExp(`data-choice-card="${id}"[^]*?</button>`).exec(html)![0];
    expect(card("a")).toContain('src="/_dev/hero-sheets/placeholder/choices/a.webp"');
    expect(card("b")).toContain('src="/visuals/books/five-smooth-stones/choices/b.webp"');
    expect(card("c")).toContain("url(&quot;/visuals/books/five-smooth-stones/PL4.webp&quot;)");
    expect(choicePictureSources(sheet, withArt.decision.choiceArt, "a")).toEqual(["/_dev/hero-sheets/placeholder/choices/a.webp", "/visuals/books/five-smooth-stones/choices/a.webp"]);
  });

  it("a sheet manifest lists per-child card pictures under choices/", () => {
    const base = { id: "s", poses: {}, base: "/_dev/hero-sheets/s" };
    const s2 = applySheetManifest(base, { choices: { a: "choices/a.webp", b: "../x.webp", "c d": "choices/c.webp" } });
    expect(s2.choices).toEqual({ a: "/_dev/hero-sheets/s/choices/a.webp" });
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

  it("375 x 812: the art window is never under 300 px wide; p5's cards replace the words below the art, never over David", () => {
    const widthOf = (html: string) => Number(/class="bk-art"[^>]*style="left:[\d.]+px;top:[\d.]+px;width:([\d.]+)px/.exec(html)![1]);
    const p5 = render(run(...toDecision), { box: PHONE });
    expect(widthOf(p5)).toBeGreaterThanOrEqual(300);
    expect(p5).toContain("data-book-choose");
    const cards = render(run(...toDecision), { box: PHONE, choosing: true });
    expect(widthOf(cards)).toBe(widthOf(p5));
    expect(cards.match(/data-choice-card="/g)).toHaveLength(3);
    expect(cards).not.toContain("data-overlap");
    const s10 = run(...toDecision, { type: "choose", choiceId: "a" }, { type: "go" }, { type: "next" }, { type: "next" }, { type: "next" }, { type: "next" });
    const p10 = render(s10, { box: PHONE, lang: "he" });
    expect(pageOf(p10)).toBe("p10");
    expect(widthOf(p10)).toBeGreaterThanOrEqual(300);
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
    screens.push({ ...initialBookFlow(), at: END, choiceId: "a" });
    for (const lang of ["en", "he"] as const) {
      for (const s of screens) expect(visible(render(s, { lang })), `${lang} ${s.at}`).not.toMatch(/\d/);
    }
  });
});
