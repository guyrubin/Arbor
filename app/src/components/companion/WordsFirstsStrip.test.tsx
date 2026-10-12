import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KeptThing } from "../../lib/kept/keptThings";

/* v3 FEAT-08 — the words-and-firsts strip on My child. Invented words and
   firsts only; no child data. Names and words only: no count, no per-month
   number, no comparison. "First:" belongs to kind "first" alone, and every
   word keeps the language it was said in. */

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  buttons: [] as { onClick?: () => void; "data-testid"?: string }[],
}));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
// KeptItem (for keptTextLanguage) imports the share sheet; it has its own tests.
vi.mock("../share/SendSheet", () => ({ SendSheet: () => null }));
const capture = vi.hoisted(() => (type: unknown, props: unknown) => {
  if (type === "button" && props && typeof props === "object") state.buttons.push(props as typeof state.buttons[number]);
});
vi.mock("react/jsx-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return { ...runtime, jsx: (...a: Parameters<typeof runtime.jsx>) => { capture(a[0], a[1]); return runtime.jsx(...a); }, jsxs: (...a: Parameters<typeof runtime.jsxs>) => { capture(a[0], a[1]); return runtime.jsxs(...a); } };
});
vi.mock("react/jsx-dev-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...a: Parameters<typeof runtime.jsxDEV>) => { capture(a[0], a[1]); return runtime.jsxDEV(...a); } };
});
import WordsFirstsStrip, { WORDS_STRIP_MONTHS, WORDS_STRIP_WORDS_PER_MONTH, wordsStripMonthLabel, wordsStripMonths } from "./WordsFirstsStrip";
import { translate } from "../../lib/i18n";

const kept = (id: string, kind: KeptThing["kind"], at: string, text: string, language?: string): KeptThing =>
  ({ id, kind, at, text, attribution: "parent", ...(language ? { language } : {}) });
/** Invented: a Hebrew word, an English sentence, a confirmed first, a by-herself moment, and an older quote. */
const ITEMS: KeptThing[] = [
  kept("langObs:w-he", "said", "2026-10-05T12:00:00Z", "ירח", "Hebrew"),
  kept("milestones:ms-a", "first", "2026-10-04", "Three steps to the sofa"),
  kept("langObs:w-en", "said", "2026-10-03T12:00:00Z", "The moon is following us", "English"),
  kept("behaviorLogs:b-1", "by_herself", "2026-10-06T12:00:00Z", "Put on her own boots"),
  kept("keepsakes:q-1", "said", "2026-09-12", "Why is the sky so big"),
];
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
/** Visible words: icon ligatures (<span class="msr">star</span>) are glyphs, not text. */
const words = (html: string) => html.replace(/<span class="msr[^"]*"[^>]*>[^<]*<\/span>/g, " ").replace(/<[^>]+>/g, " ");
const cards = (html: string) => [...html.matchAll(/<li class="words-strip-card" data-testid="words-strip-card" data-kind="([a-z_]+)">([\s\S]*?)<\/li>/g)].map(m => ({ kind: m[1], html: m[2] }));
const render = (props: Partial<React.ComponentProps<typeof WordsFirstsStrip>> = {}) => {
  state.buttons = [];
  return renderToStaticMarkup(<WordsFirstsStrip name="Noa" months={wordsStripMonths(ITEMS)} onAllWords={vi.fn()} {...props} />);
};

beforeEach(() => { state.lang = "en"; state.buttons = []; });

describe("v3 FEAT-08 — which words and firsts the strip carries", () => {
  it("keeps quotes and firsts only, months newest first, items newest first", () => {
    const months = wordsStripMonths(ITEMS);
    expect(months.map(m => [m.monthKey, m.items.map(i => i.id)])).toEqual([
      ["2026-10", ["langObs:w-he", "milestones:ms-a", "langObs:w-en"]],
      ["2026-09", ["keepsakes:q-1"]],
    ]);
    expect(months.flatMap(m => m.items).some(i => i.kind === "by_herself" || i.kind === "week")).toBe(false);
  });

  it("holds the last six months, and a busy month keeps every first beside its newest words", () => {
    const many = Array.from({ length: 9 }, (_, i) => kept(`keepsakes:m-${i}`, "said", `2026-0${i + 1}-15`, `Quote ${String.fromCharCode(97 + i)}`));
    expect(wordsStripMonths(many).map(m => m.monthKey)).toEqual(["2026-09", "2026-08", "2026-07", "2026-06", "2026-05", "2026-04"]);
    expect(wordsStripMonths(many)).toHaveLength(WORDS_STRIP_MONTHS);
    const busy = [
      ...Array.from({ length: 12 }, (_, i) => kept(`langObs:w-${i}`, "said", `2026-10-${String(20 - i).padStart(2, "0")}T12:00:00Z`, `word ${String.fromCharCode(97 + i)}`)),
      kept("milestones:old-first", "first", "2026-10-01", "Climbed the slide ladder"),
    ];
    const [october] = wordsStripMonths(busy);
    expect(october.items.filter(i => i.kind === "said")).toHaveLength(WORDS_STRIP_WORDS_PER_MONTH);
    expect(october.items.filter(i => i.kind === "said").map(i => i.id)).toEqual(Array.from({ length: WORDS_STRIP_WORDS_PER_MONTH }, (_, i) => `langObs:w-${i}`));
    expect(october.items.map(i => i.id)).toContain("milestones:old-first");
  });

  it("names the month in the page locale, with the year only when it is not this one", () => {
    expect(wordsStripMonthLabel("2026-10", "en", 2026)).toBe("October");
    expect(wordsStripMonthLabel("2025-12", "en", 2026)).toBe("December 2025");
    expect(wordsStripMonthLabel("2026-10", "he", 2026)).toBe(new Date("2026-10-01T12:00:00Z").toLocaleDateString("he-IL", { month: "long", timeZone: "UTC" }));
    expect(wordsStripMonthLabel("not-a-month", "en", 2026)).toBe("");
  });
});

describe("v3 FEAT-08 — the strip on My child", () => {
  it.each(["en", "he"] as const)("a titled strip of month groups, newest first, with no number, module or primary move (%s)", lang => {
    state.lang = lang;
    const html = render();
    expect(html).toMatch(/^<section class="words-strip" data-testid="words-strip" aria-labelledby="([^"]+)"><h2 id="\1" class="words-strip-title">/);
    expect(html).toContain(esc(translate(lang, "companion.portrait.words.title", { name: "Noa" })));
    const months = [...html.matchAll(/<li class="words-strip-month" data-testid="words-strip-month"><h3>([^<]*)<\/h3>/g)].map(m => m[1]);
    expect(months).toEqual(["2026-10", "2026-09"].map(key => esc(wordsStripMonthLabel(key, lang))));
    expect(cards(html).map(c => c.kind)).toEqual(["said", "first", "said", "said"]);
    expect(html).not.toContain("data-module");
    expect(html).not.toContain("data-primary-move");
    // Counts only, and here not even a count: no digit outside the month headings, no share, no fraction.
    const text = words(html.replace(/<h3>[^<]*<\/h3>/g, " "));
    expect(text).not.toMatch(/\d|%|\/|companion\.|kept\./);
    expect(html).not.toMatch(/progress|role="meter"/);
  });

  it("each word keeps its own language in a bdi, whatever the page language", () => {
    for (const lang of ["en", "he"] as const) {
      state.lang = lang;
      const html = render();
      expect(html).toContain('<bdi dir="auto" lang="he">ירח</bdi>');
      expect(html).toContain('<bdi dir="auto" lang="en">The moon is following us</bdi>');
      // An unrecorded language is marked undetermined, never guessed.
      expect(html).toContain('<bdi dir="auto" lang="und">Why is the sky so big</bdi>');
    }
  });

  it.each(["en", "he"] as const)("only a parent-confirmed first carries the First prefix and the star; quotes carry the quote glyph (%s)", lang => {
    state.lang = lang;
    const html = render();
    const prefix = esc(translate(lang, "companion.portrait.words.first"));
    expect(html.split(prefix)).toHaveLength(2);
    for (const card of cards(html)) {
      if (card.kind === "first") {
        expect(card.html).toContain(`<span class="words-strip-first">${prefix}</span> <bdi`);
        expect(card.html).toContain(">star</span>");
        expect(card.html).not.toContain(">format_quote</span>");
      } else {
        expect(card.html).not.toContain(prefix);
        expect(card.html).toContain(">format_quote</span>");
        expect(card.html).not.toContain(">star</span>");
      }
    }
  });

  it("Add or see all words is a real button that opens the words place, its arrow mirrored once in Hebrew", () => {
    const onAllWords = vi.fn();
    const html = render({ onAllWords });
    expect(html).toContain(`<button type="button" class="words-strip-all" data-testid="words-strip-all"><span>${esc(translate("en", "kept.allWords"))}</span><span class="msr rtl:-scale-x-100"`);
    const link = state.buttons.find(b => b["data-testid"] === "words-strip-all");
    expect(link).toBeDefined();
    link!.onClick!();
    expect(onAllWords).toHaveBeenCalledOnce();
    expect(state.buttons).toHaveLength(1);
  });

  it("with nothing kept, the strip is absent (no empty card)", () => {
    expect(render({ months: [] })).toBe("");
    expect(render({ months: [{ monthKey: "2026-10", items: [] }] })).toBe("");
    expect(render({ months: wordsStripMonths([kept("behaviorLogs:b-2", "by_herself", "2026-10-06", "Zipped her coat")]) })).toBe("");
  });
});

describe("v3 FEAT-08 — wordsFirstsStrip.css", () => {
  const css = readFileSync(new URL("./wordsFirstsStrip.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const rule = (sel: string) => css.match(new RegExp(`${sel.replace(/[.]/g, "\\.")} \\{([^}]*)\\}`))?.[1] ?? "";
  it("the track scrolls on its own and snaps card by card; the strip never widens the page", () => {
    expect(rule(".words-strip")).toContain("contain: inline-size");
    expect(rule(".words-strip")).toContain("min-inline-size: 0");
    expect(rule(".words-strip-track")).toContain("overflow-x: auto");
    expect(rule(".words-strip-track")).toContain("scroll-snap-type: inline mandatory");
    expect(rule(".words-strip-track")).toContain("overscroll-behavior-inline: contain");
    expect(rule(".words-strip-card")).toContain("scroll-snap-align: start");
    expect(rule(".words-strip-card")).toContain("min-inline-size: 14rem");
  });
  it("keeps the 44 px floor, the editorial face for the words, and a logical layout only", () => {
    expect(rule(".words-strip-all")).toContain("min-block-size: var(--touch-min)");
    expect(rule(".words-strip-card")).toContain("min-block-size: var(--touch-min)");
    expect(rule(".words-strip-words")).toContain("font-family: var(--font-editorial)");
    expect(css).not.toMatch(/(?:^|[\s;{])(?:margin|padding|border)-(?:left|right)\s*:|(?:^|[\s;{])(?:left|right)\s*:|text-align:\s*(?:left|right)|float:\s*(?:left|right)/);
  });
  it("paints no verdict: no percentage width, nothing that reads as a bar", () => {
    expect(css).not.toMatch(/progress|(?:width|inline-size):\s*(?!100%)\d+(?:\.\d+)?%/);
  });
});

describe("v3 FEAT-08 — where the strip lives", () => {
  const strip = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const portrait = strip("./ChildPortrait.tsx").replace(/\{\s*\}/g, "");
  it("mounts inside the overview, after the watch row and before the keepsake disclosure; the budget stays three", () => {
    const overview = portrait.slice(portrait.indexOf('data-module="child-portrait-overview"'), portrait.indexOf('data-module="child-portrait-evidence"'));
    const at = overview.indexOf("<WordsFirstsStrip ");
    expect(at).toBeGreaterThan(overview.indexOf("<PortraitWatchRow key={childProfile.id} />"));
    expect(at).toBeLessThan(overview.indexOf("<PortraitKeepsakes />"));
    expect(overview).toContain('onAllWords={() => setActiveTab("language")}');
    expect((portrait.match(/\bdata-module=/g) ?? []).length).toBe(3);
  });
  it("reads the record the portrait already loaded: no history listener, fetch or write of its own", () => {
    const source = strip("./WordsFirstsStrip.tsx");
    expect(source).not.toMatch(/useChildHistory|useObservationRecord|useArbor|fetch\(|\.upsert\(|localStorage/);
    expect(source).not.toMatch(/\bdata-module\b|data-primary-move/);
    expect(portrait).toContain("wordsStripMonths(keptThings(");
    expect(portrait).toContain("record.sources.langObs");
  });
});
