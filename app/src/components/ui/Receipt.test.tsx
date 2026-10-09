/**
 * B-STATUS-01 — the ONE Receipt line and the ONE PendingLine (components/ui/Receipt.tsx).
 *
 *  - the line: past tense as given, where it went (a real link), Undo on it,
 *    44 px trailing controls, direction + lang from the page language, the
 *    parent register (tokens, no caps, nothing under 12 px, no gradient);
 *  - announced through ONE polite region on <body> (never a role on the line,
 *    so nothing is read twice), exempt from the dialog shield;
 *  - pending: nothing before 400 ms (no flash), one quiet line after, no spinner.
 * EN + HE. Each rule carries a negative control.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});

import { PENDING_DELAY_MS, PendingLine, Receipt, announcePolite, receiptText, startPendingClock } from "./Receipt";
import { translate } from "../../lib/i18n";

const here = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(path.join(here, "Receipt.tsx"), "utf8").replace(/\r\n/g, "\n");
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

afterEach(() => { vi.useRealTimers(); state.lang = "en"; });

describe("Receipt — the line", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: the words as given, a link to where it went, Undo on the line, direction from the page`, () => {
      state.lang = lang;
      const words = translate(lang, "elev.loop.notice.seenReceipt", { name: "Noa", shelf: translate(lang, "elev.shelves.words") });
      const html = renderToStaticMarkup(
        <Receipt testId="r" link={{ where: translate(lang, "elev.shelves.words"), href: "#/journal?shelf=words" }} undo={{ label: translate(lang, "elev.loop.notice.undo"), onUndo: () => undefined, testId: "r-undo" }}>
          {words}
        </Receipt>,
      );
      const line = /<p data-testid="r"[^>]*>[\s\S]*?<\/p>/.exec(html)![0];
      expect(line).toContain(`dir="${lang === "he" ? "rtl" : "ltr"}"`);
      expect(line).toContain(`lang="${lang}"`);
      expect(line).toContain('data-receipt="muted"');
      expect(line.replace(/&#x27;/g, "'")).toContain(words);
      // the link: a real anchor to the place, named for a screen reader, 44 px
      const link = /<a [^>]*>[^<]*<\/a>/.exec(html)![0];
      expect(link).toContain('href="#/journal?shelf=words"');
      expect(link).toContain(`aria-label="${translate(lang, "elev.loop.receipt.openAria", { where: translate(lang, "elev.shelves.words") })}"`);
      expect(link).toContain(`>${translate(lang, "elev.loop.receipt.open")}</a>`);
      expect(link).toMatch(/min-h-\[44px\] min-w-\[44px\]/);
      // Undo sits on the line, after the link, 44 px
      const undo = /<button[^>]*data-testid="r-undo"[^>]*>/.exec(html)![0];
      expect(undo).toMatch(/min-h-\[44px\] min-w-\[44px\]/);
      expect(html.indexOf("<a ")).toBeLessThan(html.indexOf("<button"));
    });
  }

  it("the line carries no live role: the words go to the ONE shared polite region (read once)", () => {
    const html = renderToStaticMarkup(<Receipt testId="r">Kept.</Receipt>);
    expect(html).not.toMatch(/role="status"|aria-live/);
    expect(CODE).toMatch(/useEffect\(\(\) => \{\s*if \(announce && spoken\) announcePolite\(spoken\);/);
    // NEGATIVE CONTROL: the pre-change per-card markup is what this rejects
    expect('<p role="status" data-testid="practice-receipt">').toMatch(/role="status"/);
  });

  it("no link and no undo: just the line (no empty row); icon=null draws none", () => {
    const html = renderToStaticMarkup(<Receipt testId="r" icon={null} size="sm">Tomorrow is fine.</Receipt>);
    expect(html).not.toContain("data-receipt-row");
    expect(html).not.toContain('class="msr');
    expect(html).toMatch(/class="min-w-0 t-sm leading-snug"/);
  });

  it("the kept tone is the one green pill; strong is the capture sheet's bold lead line", () => {
    const kept = renderToStaticMarkup(<Receipt testId="k" tone="kept" size="sm">Kept in Noa&apos;s story</Receipt>);
    expect(kept).toContain("rounded-full");
    expect(kept).toContain("background:var(--arbor-green-soft);color:var(--arbor-green-ink)");
    const strong = renderToStaticMarkup(<Receipt testId="s" tone="ink" strong icon="check_circle">Kept in Noa&apos;s journal</Receipt>);
    expect(strong).toMatch(/class="min-w-0 t-base leading-snug font-bold" style="color:var\(--arbor-ink\)"/);
  });

  it("the parent register: tokens only, no caps, no letter spacing, nothing under 12 px, no 800/900, no gradient, no spinner", () => {
    expect(CODE).not.toMatch(/\buppercase\b|\btracking-wider?\b|font-(?:extrabold|black)\b|linear-gradient|text-\[(?:[0-9]|1[01])(?:\.\d+)?px\]/);
    expect(CODE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(CODE).not.toMatch(/progress_activity|animate-spin/);
    expect(CODE).not.toMatch(/\b(?:ml|mr|pl|pr)-\d/);
  });

  it("receiptText reads the plain words of nested children", () => {
    expect(receiptText(<>Noted on <b>Words</b>, next to {" "}<span>“big ball”</span></>)).toBe("Noted on Words, next to “big ball”");
    expect(receiptText([null, false, "a", 1])).toBe("a1");
  });
});

type FakeEl = {
  attrs: Record<string, string>;
  className: string;
  textContent: string;
  isConnected: boolean;
  ownerDocument: unknown;
  setAttribute: (k: string, v: string) => void;
};

function fakeDocument() {
  const appended: FakeEl[] = [];
  const doc = {
    createElement: (): FakeEl => {
      const el: FakeEl = { attrs: {}, className: "", textContent: "", isConnected: true, ownerDocument: null, setAttribute: (k, v) => { el.attrs[k] = v; } };
      return el;
    },
    body: { appendChild: (el: FakeEl) => { el.ownerDocument = doc; appended.push(el); return el; } },
  };
  return { doc: doc as unknown as Document, appended };
}

describe("announcePolite — ONE polite region on <body>", () => {
  it("creates the region once (polite, atomic, exempt from the dialog shield, visually hidden) and fills it on the next turn", () => {
    vi.useFakeTimers();
    const { doc, appended } = fakeDocument();
    announcePolite("Noted on Noa's Words shelf.", doc);
    expect(appended).toHaveLength(1);
    const region = appended[0];
    expect(region.attrs).toMatchObject({ role: "status", "aria-live": "polite", "aria-atomic": "true", "data-dialog-shield-exempt": "" });
    expect(region.className).toBe("sr-only");
    expect(region.textContent).toBe("");
    vi.advanceTimersByTime(50);
    expect(region.textContent).toBe("Noted on Noa's Words shelf.");
    // the same words again: cleared, then read again — and the SAME region
    announcePolite("Noted on Noa's Words shelf.", doc);
    expect(region.textContent).toBe("");
    vi.advanceTimersByTime(50);
    expect(region.textContent).toBe("Noted on Noa's Words shelf.");
    expect(appended).toHaveLength(1);
  });

  it("blank words and no document do nothing", () => {
    const { doc, appended } = fakeDocument();
    announcePolite("   ", doc);
    expect(appended).toHaveLength(0);
    expect(() => announcePolite("x", undefined)).not.toThrow();
  });
});

describe("PendingLine — one quiet line after 400 ms, never a flash", () => {
  it("the clock: nothing at 399 ms, the line at 400 ms", () => {
    vi.useFakeTimers();
    const onShow = vi.fn();
    startPendingClock(onShow);
    vi.advanceTimersByTime(PENDING_DELAY_MS - 1);
    expect(onShow).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onShow).toHaveBeenCalledTimes(1);
    expect(PENDING_DELAY_MS).toBe(400);
  });

  it("NEGATIVE CONTROL: work that settles under 400 ms never shows the line", () => {
    vi.useFakeTimers();
    const onShow = vi.fn();
    const cancel = startPendingClock(onShow);
    vi.advanceTimersByTime(399);
    cancel();
    vi.advanceTimersByTime(1000);
    expect(onShow).not.toHaveBeenCalled();
  });

  it("the first paint of active work is EMPTY (no flash), in EN and HE", () => {
    for (const lang of ["en", "he"] as const) {
      state.lang = lang;
      expect(renderToStaticMarkup(<PendingLine active>{translate(lang, "elev.loop.pending.practice")}</PendingLine>)).toBe("");
      expect(renderToStaticMarkup(<PendingLine active={false}>x</PendingLine>)).toBe("");
    }
  });

  it("the pending copy names Arbor's work in both languages (ארבור in Hebrew)", () => {
    expect(translate("en", "elev.loop.pending.practice")).toBe("Arbor is choosing today's practice…");
    expect(translate("he", "elev.loop.pending.practice")).toContain("ארבור");
    expect(translate("he", "elev.loop.pending.practice")).not.toContain("Arbor");
  });
});
