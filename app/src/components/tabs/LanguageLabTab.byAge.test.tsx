/**
 * B-GROWTH-36 — #/language follows the child's age.
 *   · 3 and over: the page leads with "Things {name} said" (HE gendered), the
 *     add box asks "What did he say today?", the kept quotes (the `quote`
 *     keepsakes) are the second module, no word ledger, no month list.
 *   · Under 3: the word ledger (PhraseLogForm + WordsList) as before.
 *   · After a keep, the say-back's words to say are the largest text in the
 *     capture module (19 px editorial serif), in the KEPT language.
 *   · The "Act now if…" line by age is a draft (data-review="draft").
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { sayBackFor } from "../../lib/language/sayBack";

const DAY = 86_400_000;
const birth = (months: number) => new Date(Date.now() - months * 30.44 * DAY).toISOString().slice(0, 10);

const h = vi.hoisted(() => ({
  locale: "he" as "en" | "he",
  profile: {} as Record<string, unknown>,
  keepsakes: [] as unknown[],
  obs: [] as unknown[],
}));

vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({ childProfile: h.profile, setActiveTab: vi.fn(), seedCoach: vi.fn() }),
}));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({
    uiLang: h.locale,
    t: (k: string, v?: Record<string, string | number>) => translate(h.locale, k, v),
  }),
}));
vi.mock("../../hooks/useChildCollection", () => ({
  useChildCollection: (_id: string, name: string) => ({
    items: name === "keepsakes" ? h.keepsakes : name === "langObs" ? h.obs : [],
    loaded: true,
    upsert: vi.fn(),
    remove: vi.fn(),
  }),
}));

import LanguageLabTab from "./LanguageLabTab";
import { SaidCapture, SayBackBlock } from "../growth/ThingsSaid";

const dylan = (months: number) => ({
  id: "c1",
  name: "Dylan",
  gender: "boy",
  birthDate: birth(months),
  languages: ["Hebrew (Native)", "English (Transition)"],
});

const quotes = [
  { id: "quote-2026-10-05-a1", kind: "quote", milestoneId: "", note: "Daddy, the moon is following our car", noticedOn: "2026-10-05", language: "English", createdAt: "", updatedAt: "" },
  { id: "quote-2026-10-02-b2", kind: "quote", milestoneId: "", note: "אבא, תראה מחפרון", noticedOn: "2026-10-02", language: "Hebrew", createdAt: "", updatedAt: "" },
  { id: "m-1", milestoneId: "cdc-36m-1", note: "a milestone keepsake, not a quote", noticedOn: "2026-10-01", createdAt: "", updatedAt: "" },
];

const h1 = (html: string) => (/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "").replace(/<[^>]+>/g, "").replace(/[\u2068\u2069]/g, "");
/** Rendered text with the entity escapes and bidi isolates React/translate add. */
const plain = (html: string) => html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/[\u2068\u2069]/g, "");
const sizes = (html: string): number[] => [
  ...[...html.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])),
  ...[...html.matchAll(/text-\[(\d+)px\]/g)].map((m) => Number(m[1])),
];

beforeEach(() => {
  h.locale = "he";
  h.keepsakes = quotes;
  h.obs = [];
});

describe("B-GROWTH-36 · #/language by age", () => {
  for (const locale of ["he", "en"] as const) {
    it(`${locale}: a 5-year-old — the page leads with Things {name} said; quotes, no word ledger, no month list`, () => {
      h.locale = locale;
      h.profile = dylan(64);
      const html = renderToStaticMarkup(<LanguageLabTab />);
      expect(h1(html)).toBe(locale === "he" ? "דברים שDylan אמר" : "Things Dylan said");
      expect(html).toContain('data-testid="said-capture"');
      expect(html).toContain(translate(locale, "elev.words.said.label.boy"));
      expect(html).not.toContain('data-testid="vl-log-add"');
      expect(html).not.toContain('data-testid="lang-words-list"');
      expect(html).not.toContain('data-testid="vl-month-list"');
      // the kept quotes, newest first; a milestone keepsake is not a quote
      const list = html.slice(html.indexOf('data-testid="said-list"'));
      expect(list.indexOf("Daddy, the moon")).toBeLessThan(list.indexOf("אבא, תראה מחפרון"));
      expect(html).not.toContain("a milestone keepsake");
      // capture before the quotes; the primary move stays on the capture module
      expect(html.indexOf('data-module="language-capture"')).toBeLessThan(html.indexOf('data-testid="said-list"'));
      expect(html.match(/data-primary-move="/g)).toHaveLength(1);
      // the "Act now if…" line for 5 and over is the teacher line, shipped as a draft
      expect(html).toMatch(/data-testid="lang-act-now" data-review="draft"/);
      expect(plain(html)).toContain(plain(translate(locale, "elev.words.actNow.school.boy", { name: "Dylan" })));
      // the disclosure no longer promises words by month
      expect(html).toContain(translate(locale, "elev.words.more.title"));
      expect(html).not.toContain(translate(locale, "elev.growth.lang.more.title"));
    });
  }

  it("he: a 2-year-old keeps the word ledger (PhraseLogForm + WordsList); no quote box", () => {
    h.profile = { ...dylan(24), name: "Leni", gender: "girl" };
    const html = renderToStaticMarkup(<LanguageLabTab />);
    expect(h1(html)).toBe(translate("he", "lang.title"));
    expect(html).toContain('data-testid="vl-log-add"');
    expect(html).toContain('data-testid="lang-words-list"');
    expect(html).not.toContain('data-testid="said-capture"');
    expect(plain(html)).toContain(plain(translate("he", "elev.words.actNow.words.girl", { name: "Leni" })));
  });

  it("after a keep, the words to say are the largest text in the capture module, in Hebrew for the bilingual 5-year-old", () => {
    h.locale = "he";
    const back = sayBackFor({ text: "I saw a digger at the park", language: "English", languages: dylan(64).languages, months: 64 })!;
    const html = renderToStaticMarkup(
      <div>
        <SaidCapture childId="c1" languages={dylan(64).languages} first="Dylan" gender="boy" onKept={() => {}} />
        <SayBackBlock back={back} first="Dylan" gender="boy" />
      </div>,
    );
    const line = /data-testid="say-back-line"[^>]*>([\s\S]*?)<\/blockquote>/.exec(html)!;
    expect(line[0]).toContain('lang="he"');
    expect(line[1]).toContain("ואז מה?");
    expect(line[0]).toMatch(/font-size:19px/);
    expect(Math.max(...sizes(html))).toBe(19);
    expect(sizes(html).filter((s) => s === 19)).toHaveLength(1);
    expect(Math.min(...sizes(html))).toBeGreaterThanOrEqual(12);
    expect(plain(html)).toContain("הוא אמר את זה באנגלית. אמרו את זה בחזרה בעברית והוסיפו עוד משהו:");
  });
});

describe("B-GROWTH-36 · source pins", () => {
  const tab = readFileSync(new URL("./LanguageLabTab.tsx", import.meta.url), "utf8");
  const said = readFileSync(new URL("../growth/ThingsSaid.tsx", import.meta.url), "utf8");
  it("the age branch reads lib/age/forChild (no local age arithmetic)", () => {
    expect(tab).toContain('from "../../lib/age/forChild"');
    expect(tab).toMatch(/isUnderThree\(childProfile\)/);
  });
  it("Things said reads and writes the Tonight quote keepsake, never a new collection; no model call; no gradient, no upper-case", () => {
    expect(said).toContain("quoteKeepsakeDoc(");
    expect(said).toContain("quotesFromDocs(");
    expect([...said.matchAll(/useChildCollection<[^>]+>\([^,]+,\s*"(\w+)"/g)].map((m) => m[1])).toEqual(["keepsakes", "keepsakes"]);
    expect(said).not.toMatch(/gradient|uppercase|fetch\(|modelRouter/);
  });
});
