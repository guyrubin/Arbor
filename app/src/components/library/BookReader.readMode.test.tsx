/**
 * B-BOOK-45 / B-BOOK-46 — the reader in each mode, every screen of every path,
 * EN and HE (react-dom/server, as BookReader.test):
 *  - alone (and bedtime): not one Together prompt, not one parent-register
 *    Together string on any screen — the child-alone screen holds no parent copy;
 *  - together: the prompts on their five screens, larger words, Sound off at the start;
 *  - bedtime: the night stage, a Goodnight ending with Close only (no Read
 *    again, nothing that opens another book), no digits; the reader's sounds at
 *    half gain and its narration at 0.92x are wired (the element keeps its rate).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/voice", () => ({ speakText: vi.fn(() => 0), stopVoice: vi.fn(), voiceSupported: () => true, voiceState: () => ({ speaking: false, engine: "basic" }) }));

import { BookReader } from "./BookReader";
import { setRate } from "./useNarration";
import { fiveSmoothStones as book } from "../../lib/library/books/fiveSmoothStones";
import { END, readPath, type BookFlowState } from "../../lib/library/bookFlow";
import { BOOK_STRINGS } from "../../lib/library/bookStrings";
import type { ReadMode } from "../../lib/library/readMode";
import type { BookLang, BookReaderChild } from "../../lib/library/types";
import { readFileSync } from "node:fs";

const CHILD: BookReaderChild = { id: "child-synthetic", name: "Dana", gender: "girl" };
const html = (mode: ReadMode, state: BookFlowState, lang: BookLang = "en") =>
  renderToStaticMarkup(
    <div className="arbor-play">
      <BookReader book={book} lang={lang} child={CHILD} onClose={() => {}} dev={false} narration="off" readMode={mode} initialState={state} initialBox={{ width: 390, height: 756 }} />
    </div>,
  ).replace(/<!-- -->/g, "");
const visible = (h: string) => h.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
const st = (at: string, choiceId: string | null): BookFlowState => ({ at, choiceId, selected: null, repaired: [], dir: 1 });

/** Every screen of every path: the cover, each page, The End. */
function screens(): BookFlowState[] {
  const out: BookFlowState[] = [st("cover", null)];
  const decisionAt = book.pages.findIndex((p) => p.id === book.decision.pageId);
  for (const c of book.decision.choices) {
    for (const p of readPath(book, c.id)) {
      const before = book.pages.findIndex((x) => x.id === p.id);
      out.push(st(p.id, before >= 0 && before <= decisionAt ? null : c.id));
    }
    out.push(st(END, c.id));
  }
  return out;
}
const TOGETHER_COPY = (lang: BookLang) => ["together.label", "together.cover", "together.decision", "together.branch", "together.rejoin"].map((k) => BOOK_STRINGS[lang][k as keyof typeof BOOK_STRINGS.en]);

describe("B-BOOK-46: the child-alone screen holds no parent copy", () => {
  for (const mode of ["alone", "bedtime"] as const) {
    it.each(["en", "he"] as const)(`${mode} (%s): no Together prompt on any screen of any path`, (lang) => {
      for (const s of screens()) {
        const h = html(mode, s, lang);
        expect(h, `${mode} ${s.at}`).not.toContain("data-book-together-prompt");
        for (const copy of [...TOGETHER_COPY(lang), book.parent.together![lang]]) expect(visible(h), `${mode} ${s.at}`).not.toContain(copy);
      }
    });
  }
});

describe("B-BOOK-46: reading together", () => {
  it.each(["en", "he"] as const)("%s: the prompts on the cover, the decision, the first branch page, the rejoin and the last page", (lang) => {
    const c = book.decision.choices[0];
    const withPrompt = screens().filter((s) => s.at === "cover" || s.choiceId === c.id || s.choiceId === null).filter((s) => html("together", s, lang).includes("data-book-together-prompt")).map((s) => s.at);
    expect([...new Set(withPrompt)]).toEqual(["cover", book.decision.pageId, c.branch[0].id, book.rejoinPageId, book.pages[book.pages.length - 1].id]);
    expect(html("together", st(book.pages[book.pages.length - 1].id, c.id), lang)).toContain(book.parent.together![lang].replace(/"/g, "&quot;"));
  });
  it("round 2: the grown-up can turn sound on in Together even when the child muted their own reader", () => {
    const reader = readFileSync(new URL("./BookReader.tsx", import.meta.url), "utf8");
    expect(reader).toContain('const muted = readMode === "together" ? !togetherSound : childMuted;');
    expect(reader).not.toContain("childMuted || (readMode === \"together\"");
  });
  it("larger words than the child's own read; the Sound toy starts off", () => {
    const size = (h: string) => Number(/class="bk-words"[^>]*style="font-size:(\d+)px/.exec(h)?.[1]);
    const s = st("p2", null);
    expect(size(html("together", s))).toBeGreaterThan(size(html("alone", s)));
    expect(html("together", s)).toMatch(/data-book-sound=""[^>]*data-muted=""/);
    expect(html("together", s)).toContain('data-read-mode="together"');
  });
});

describe("B-BOOK-45: the bedtime read", () => {
  it.each(["en", "he"] as const)("%s: the night stage; a Goodnight ending whose only control closes the book; no digits", (lang) => {
    const end = html("bedtime", st(END, "a"), lang);
    expect(end).toContain('data-read-mode="bedtime"');
    expect(end).toContain("data-goodnight");
    expect(visible(end)).toContain(BOOK_STRINGS[lang].goodnight);
    expect(visible(end)).not.toContain(BOOK_STRINGS[lang].theEnd);
    expect(end).not.toContain("data-book-read-again");
    expect(end).toContain("data-book-end-close");
    for (const s of screens()) expect(visible(html("bedtime", s, lang)), s.at).not.toMatch(/\d/);
    // the child's own read keeps The End and Read again
    expect(html("alone", st(END, "a"), lang)).toContain("data-book-read-again");
  });
  it.each(["en", "he"] as const)("%s: the night reaches the words panel and the button (tokens only, nothing new moves)", (lang) => {
    // the bedtime page carries the words panel and the Next toy inside the night stage
    const page = html("bedtime", st("p2", null), lang);
    expect(page).toContain('data-read-mode="bedtime"');
    expect(page).toMatch(/class="bk-text"[^>]*data-kind="/);
    expect(page).toMatch(/class="kid-toy[^"]*"[^>]*data-book-next=""|data-book-next=""[^>]*class="kid-toy/);
    const css = readFileSync(new URL("./bookReader.css", import.meta.url), "utf8");
    const rule = (sel: string) => { const at = css.indexOf(`${sel} {`); return at < 0 ? "" : css.slice(at, css.indexOf("}", at)); };
    const panel = rule('.arbor-play .bk-reader[data-read-mode="bedtime"] .bk-text');
    const floating = rule('.arbor-play .bk-reader[data-read-mode="bedtime"] .bk-text[data-kind="panel"]');
    const toy = rule('.arbor-play .bk-reader[data-read-mode="bedtime"] .kid-toy');
    // dimmed through the night's own means: the paper mixed with the ink token, the pictures' night filter
    expect(panel).toContain("color-mix(in oklab, var(--arbor-paper-elevated) 82%, var(--arbor-ink))");
    expect(floating).toContain("color-mix(in oklab, var(--arbor-paper-elevated) 82%, var(--arbor-ink))");
    expect(toy).toContain("filter: brightness(0.78) saturate(0.85)");
    expect(rule('.arbor-play .bk-reader[data-read-mode="bedtime"] .bk-stage img')).toContain("filter: brightness(0.78) saturate(0.85)");
    for (const r of [panel, floating, toy]) {
      expect(r, "no raw colour").not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
      expect(r, "nothing new moves").not.toMatch(/animation|transition/);
    }
    // the child's own daytime read keeps the daylight panel (the night rules are bedtime-scoped only)
    const night = css.match(/[^}\n]*\.bk-text[^{]*\{[^}]*82%, var\(--arbor-ink\)/g) ?? [];
    expect(night.length).toBe(2);
    expect(night.every((r) => r.includes('[data-read-mode="bedtime"]'))).toBe(true);
    expect(html("alone", st("p2", null), lang)).toContain('data-read-mode="alone"');
  });
  it("narration plays at 0.92x and the reader's sounds at half gain (the shared element keeps its rate across a load)", () => {
    const el = { defaultPlaybackRate: 1, playbackRate: 1 } as unknown as HTMLAudioElement;
    setRate(el, 0.92);
    expect([el.defaultPlaybackRate, el.playbackRate]).toEqual([0.92, 0.92]);
    const reader = readFileSync(new URL("./BookReader.tsx", import.meta.url), "utf8");
    expect(reader).toContain('rate: readMode === "bedtime" ? BEDTIME_PLAYBACK_RATE : 1');
    expect(reader).toContain('kidSfx("pageTurn", sfxGain)');
    expect(reader).toContain('kidSfx("tap", sfxGain)');
    expect(reader).toContain('const sfxGain = readMode === "bedtime" ? BEDTIME_SFX_GAIN : 1;');
    const narration = readFileSync(new URL("./useNarration.ts", import.meta.url), "utf8");
    expect(narration.match(/setRate\(a, rateRef\.current\);/g)).toHaveLength(2);
  });
});

describe("the kid door chooses the mode (never the child)", () => {
  it("bedtime from the profile's time, Together only from a grown-up's door; a child's tap reads alone", () => {
    const view = readFileSync(new URL("../kidmode/KidBookReaderView.tsx", import.meta.url), "utf8");
    expect(view).toContain("readModeFor({ together, bedtimeFrom: childProfile.bedtimeFrom, now: new Date() })");
    expect(view).toMatch(/<BookReader [^>]*readMode=\{readMode\}/);
    const overlay = readFileSync(new URL("../kidmode/KidModeOverlay.tsx", import.meta.url), "utf8");
    expect(overlay).toContain("if (p.book) { setOpenBookId(p.book); setReadTogether(p.together === true); }");
    expect(overlay).toContain("onOpenBook={setOpenBookId}"); // a child's own tap: Together stays off
    const settings = readFileSync(new URL("../layout/SettingsModal.tsx", import.meta.url), "utf8");
    expect(settings).toContain('data-testid="settings-bedtime"');
  });
});
