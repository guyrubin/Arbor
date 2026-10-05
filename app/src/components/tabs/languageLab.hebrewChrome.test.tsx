/**
 * W2-GROWTH critic round 1 (#/language) — the guards that keep the round's
 * findings from returning:
 *  - Law 8: on the Hebrew screen, language NAMES are chrome and render in
 *    Hebrew (select labels, per-language counts, latest-word meta, the newest
 *    word line). Logged phrases and the child's name are data and are exempt.
 *  - The primary move's Add button cannot be clipped at 375: the input shrinks
 *    (min-w-0) and the row wraps below sm.
 *  - The bilingual note shows on first view only (dismissal remembered per
 *    child) and is an inline note, not a dialog.
 *  - Add phrase is the page's one --gradient-cta; "Got it" is a quiet button.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { languageName } from "../../lib/languageName";

const h = vi.hoisted(() => ({
  locale: "he" as "en" | "he",
  items: [] as Array<{ id: string; timestamp: string; language: string; phrase: string }>,
}));

vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({ childProfile: { id: "c1", name: "Dylan", languages: ["Hebrew", "English"] } }),
}));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({
    uiLang: h.locale,
    t: (k: string, v?: Record<string, string | number>) => translate(h.locale, k, v),
  }),
}));
vi.mock("../../hooks/useChildCollection", () => ({
  useChildCollection: () => ({ items: h.items, upsert: vi.fn(), remove: vi.fn() }),
}));

import { PhraseLogForm, WordsList, vocabNoteSeenKey } from "./LanguageLabVocabView";

const SRC = readFileSync(new URL("./LanguageLabVocabView.tsx", import.meta.url), "utf8");

// Icon ligatures (`<span class="msr" aria-hidden>menu_book</span>`) are glyphs, not words.
const text = (html: string) =>
  html.replace(/<span class="msr"[^>]*>[^<]*<\/span>/g, " ").replace(/<option[^>]*value="[^"]*"/g, "<option").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");

/** Latin words left once the parent's data (phrases, the child's name) is removed. */
function latinChrome(html: string, data: string[]): string[] {
  let s = text(html);
  for (const d of data) s = s.split(d).join(" ");
  return s.match(/[A-Za-z]{2,}/g) ?? [];
}

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

beforeEach(() => {
  h.locale = "he";
  h.items = [
    { id: "a", timestamp: "2026-10-01T09:00:00.000Z", language: "English", phrase: "moon" },
    { id: "b", timestamp: "2026-09-24T09:00:00.000Z", language: "Hebrew", phrase: "more juice" },
    { id: "c", timestamp: "2026-09-20T09:00:00.000Z", language: "Hebrew", phrase: "אבא" },
  ];
  try { globalThis.localStorage?.removeItem(vocabNoteSeenKey("c1")); } catch { /* none */ }
});

describe("languageName — the ONE rule", () => {
  it("localizes known names (with proficiency) and keeps free text", () => {
    const t = (k: string) => translate("he", k);
    expect(languageName("Hebrew", t)).toBe("עברית");
    expect(languageName(" english ", t)).toBe("אנגלית");
    expect(languageName("English (Native)", t)).toBe(`אנגלית (${translate("he", "elev.packet.langLevel.native")})`);
    expect(languageName("Amharic", t)).toBe("Amharic");
    expect(languageName("Hebrew", (k) => translate("en", k))).toBe("Hebrew");
  });
});

describe("#/language Hebrew screen — no Latin chrome (Law 8)", () => {
  it("the words list prints language names in Hebrew", () => {
    const html = renderToStaticMarkup(<WordsList />);
    expect(latinChrome(html, ["moon", "more juice", "Dylan"])).toEqual([]);
    expect(html).toContain("עברית");
    expect(html).toContain("אנגלית");
  });
  it("the capture form's language select labels are Hebrew; stored values stay as written", () => {
    const html = renderToStaticMarkup(
      <PhraseLogForm childId="c1" languages={["Hebrew", "English"]} onAdded={() => {}} t={(k, v) => translate("he", k, v)} />,
    );
    expect(html).toContain('value="Hebrew"');
    expect(html).toMatch(/<option[^>]*value="Hebrew"[^>]*>עברית<\/option>/);
    expect(latinChrome(html, [])).toEqual([]);
  });
});

describe("#/language words list — newest word first", () => {
  it("leads with the child's newest word, quoted and dated, then the rest", () => {
    h.locale = "en";
    const html = renderToStaticMarkup(<WordsList />);
    const newest = html.indexOf('data-testid="vl-newest-word"');
    expect(newest).toBeGreaterThan(-1);
    expect(newest).toBeLessThan(html.indexOf('data-testid="vl-total"'));
    expect(html).toContain("Dylan&#x27;s newest word");
    expect(html).toMatch(/<bdi dir="auto">“moon”<\/bdi>/);
    // the newest word is not repeated in the latest list
    const list = html.slice(html.indexOf('data-testid="vl-latest-words"'));
    expect(list).not.toContain(">moon<");
  });
});

describe("#/language primary move — the Add button cannot be clipped at 375", () => {
  it("the input shrinks and the row wraps below sm", () => {
    const html = renderToStaticMarkup(
      <PhraseLogForm childId="c1" languages={["Hebrew", "English"]} onAdded={() => {}} t={(k, v) => translate("en", k, v)} />,
    );
    const row = /<div class="([^"]*)" data-testid="vl-log-row"/.exec(html)?.[1] ?? "";
    expect(row).toContain("flex-wrap");
    expect(row).toContain("sm:flex-nowrap");
    const input = /<input[^>]*class="([^"]*)"/.exec(html)?.[1] ?? "";
    expect(input).toContain("min-w-0");
    expect(input).toContain("basis-full");
  });
  it("Add phrase is the one --gradient-cta (never an opacity-washed slab); Got it is quiet", () => {
    expect(SRC).toContain("background: T.gradientCta, color: T.onAccent");
    expect(SRC).not.toContain("disabled:opacity-40");
    expect(SRC.match(/T\.gradientCta/g)).toHaveLength(1);
    expect(SRC).not.toMatch(/background: T\.greenInk, color: T\.onAccent/);
  });
});

describe("#/language bilingual note — first view only, inline", () => {
  it("is not a dialog", () => {
    expect(SRC).not.toMatch(new RegExp("role=[\"']" + "dialog"));
  });
  it("shows on first view and stays hidden once dismissed for that child", () => {
    h.locale = "en";
    expect(renderToStaticMarkup(<WordsList />)).toContain('data-testid="vl-disclaimer"');
    globalThis.localStorage?.setItem(vocabNoteSeenKey("c1"), "1");
    const html = renderToStaticMarkup(<WordsList />);
    expect(html).not.toContain('data-testid="vl-disclaimer"');
    // re-access stays on the info toggle
    expect(html).toContain(translate("en", "vl.disclaimerToggle"));
  });
});
