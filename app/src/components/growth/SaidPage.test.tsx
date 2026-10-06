/**
 * B-GROWTH-37 — the "Things {name} said" month page (#/language?view=said).
 *   · age 5: one month of kept quotes, his first name and age at the top,
 *     each quote `dir="auto"` in the editorial serif with its day small;
 *     nothing on the sheet but name / age / month / quotes / days;
 *   · age 2: the same page is the first-words poster (langObs);
 *   · "Send to…" is text only — quote lines + one closing line, no URL;
 *   · "Print" goes through the existing print shell (lib/reportExport).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { buildLinesText } from "../../lib/share";

const DAY = 86_400_000;
const birth = (months: number) => new Date(Date.now() - months * 30.44 * DAY).toISOString().slice(0, 10);

const h = vi.hoisted(() => ({
  locale: "en" as "en" | "he",
  profile: {} as Record<string, unknown>,
  keepsakes: [] as unknown[],
  obs: [] as unknown[],
  query: "",
}));

vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: h.profile }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { displayName: "Guy Rubin" } }) }));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ uiLang: h.locale, t: (k: string, v?: Record<string, string | number>) => translate(h.locale, k, v) }),
}));
vi.mock("../../hooks/useChildCollection", () => ({
  useChildCollection: (_id: string, name: string) => ({
    items: name === "keepsakes" ? h.keepsakes : name === "langObs" ? h.obs : [],
    loaded: true,
    upsert: vi.fn(),
    remove: vi.fn(),
  }),
}));
vi.mock("../../hooks/useHashQuery", () => ({ useHashQuery: () => new URLSearchParams(h.query), goToRoute: vi.fn() }));

import SaidPage, { pickMonth, quotesOfMonth, saidPrintDoc, saidSendText } from "./SaidPage";

const q = (id: string, note: string, noticedOn: string, language?: string) => ({ id, kind: "quote", milestoneId: "", note, noticedOn, language, createdAt: "", updatedAt: "" });
const QUOTES = [
  q("quote-2026-10-05-a", "Daddy, the moon is following our car", "2026-10-05", "English"),
  q("quote-2026-10-02-b", "אבא, תראה מחפרון", "2026-10-02", "Hebrew"),
  q("quote-2026-09-20-c", "Why do dogs not talk?", "2026-09-20", "English"),
  { id: "m1", milestoneId: "cdc-60m-1", note: "a milestone keepsake", noticedOn: "2026-10-03", createdAt: "", updatedAt: "" },
];
const dylan = (months: number) => ({ id: "c1", name: "Dylan", gender: "boy", birthDate: birth(months), languages: ["Hebrew (Native)", "English (Transition)"] });

const sheet = (html: string) => {
  const at = html.indexOf('data-testid="said-sheet"');
  return html.slice(at, html.indexOf("</article>", at));
};
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/[⁨⁩]/g, "").replace(/\s+/g, " ").trim();

beforeEach(() => {
  h.keepsakes = QUOTES;
  h.obs = [];
  h.query = "view=said";
});

describe("B-GROWTH-37 · the month page for a 5-year-old", () => {
  for (const locale of ["en", "he"] as const) {
    it(`${locale}: the newest month's quotes, oldest first, dir=auto, name + age on top, nothing else on the sheet`, () => {
      h.locale = locale;
      h.profile = dylan(64);
      const html = renderToStaticMarkup(<SaidPage />);
      const s = sheet(html);
      expect(html).toMatch(/data-module="said-sheet" data-testid="said-sheet"/);
      expect(text(s)).toContain(translate(locale, "elev.words.said.title.boy", { name: "Dylan" }).replace(/[⁨⁩]/g, ""));
      expect(text(s)).toMatch(/Dylan, /);
      // October only, oldest first; September and the milestone keepsake are not on this page
      const lines = [...s.matchAll(/<p dir="auto"[^>]*>([^<]*)<\/p>/g)].map((m) => m[1]);
      expect(lines).toEqual(["“אבא, תראה מחפרון”", "“Daddy, the moon is following our car”"]);
      expect(s).not.toContain("Why do dogs");
      expect(s).not.toContain("milestone keepsake");
      expect(s).toMatch(/font-size:19px/);
      // nothing but the words, their days, the name/age/month: no count, no %, no link, no image
      expect(s).not.toMatch(/%|<img|href=|data-primary-move/);
      expect(text(s)).not.toMatch(/\b\d+\s+(quotes|words|things)\b/i);
      // two modules: the sheet and its actions
      expect(html.match(/data-module="/g)).toHaveLength(2);
      expect(html).toContain('data-testid="said-send"');
      expect(html).toContain('data-testid="said-print"');
      // two months with quotes → a month choice (pills)
      expect(html).toContain('role="radiogroup"');
    });
  }

  it("&month=YYYY-MM picks that month", () => {
    h.locale = "en";
    h.profile = dylan(64);
    h.query = "view=said&month=2026-09";
    const s = sheet(renderToStaticMarkup(<SaidPage />));
    expect(s).toContain("Why do dogs not talk?");
    expect(s).not.toContain("Daddy, the moon");
  });

  it("empty record: one calm sentence, actions disabled", () => {
    h.locale = "he";
    h.profile = dylan(64);
    h.keepsakes = [];
    const html = renderToStaticMarkup(<SaidPage />);
    expect(html).toContain('data-testid="said-page-empty"');
    expect(html).toMatch(/data-testid="said-send"[^>]*disabled/);
  });
});

describe("B-GROWTH-37 · under 3 the page is the first-words poster", () => {
  it("he: the langObs words, no quotes", () => {
    h.locale = "he";
    h.profile = { ...dylan(24), name: "Leni", gender: "girl" };
    h.obs = [
      { id: "o1", timestamp: "2026-09-01T10:00:00.000Z", language: "Hebrew", phrase: "עוד" },
      { id: "o2", timestamp: "2026-09-03T10:00:00.000Z", language: "English", phrase: "ball" },
    ];
    const html = renderToStaticMarkup(<SaidPage />);
    expect(html).toContain('data-testid="said-poster"');
    expect(html).not.toContain('data-testid="said-month"');
    expect(text(sheet(html))).toContain(text(translate("he", "elev.words.page.posterTitle", { name: "Leni" })));
    expect(sheet(html)).toContain("“עוד”");
    expect(sheet(html)).toContain("“ball”");
    expect(sheet(html)).not.toContain("Daddy, the moon");
  });
});

describe("B-GROWTH-37 · the text send and the print document", () => {
  const kept = [
    { id: "a", note: "Daddy, the moon is following our car", noticedOn: "2026-10-05" },
    { id: "b", note: "אבא, תראה מחפרון", noticedOn: "2026-10-02" },
  ];
  it("the share payload is the quotes as lines + the closing line, no URL, no code", () => {
    for (const lang of ["en", "he"] as const) {
      const closing = translate(lang, "elev.words.page.closing", { parent: "Guy", name: "Dylan" });
      const out = saidSendText(kept, { lang, closing });
      const lines = out.split("\n");
      expect(lines).toHaveLength(3);
      expect(lines[0]).toMatch(/^“Daddy, the moon is following our car” · /);
      expect(lines[2]).toBe(closing);
      expect(out).not.toMatch(/https?:|www\.|\.com|\.app|ref=|utm_/i);
    }
    expect(buildLinesText(["  a ", "", "b"], " c ")).toBe("a\nb\nc");
  });
  it("the print document is one month section of quote lines (existing print shell; lines dir=auto)", () => {
    const doc = saidPrintDoc(kept, { lang: "en", title: "Things Dylan said", subtitle: "Dylan, 5 years", month: "2026-10" });
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0].heading).toMatch(/October 2026/);
    expect(doc.sections[0].body).toEqual(saidSendText(kept, { lang: "en", closing: "" }).split("\n"));
    expect(doc.heroImageUrl).toBeUndefined();
    const shell = readFileSync(new URL("../../lib/reportExport.ts", import.meta.url), "utf8");
    expect(shell).toContain('`<li dir="auto">${esc(String(i))}</li>`');
  });
  it("pickMonth / quotesOfMonth", () => {
    const all = [...kept, { id: "c", note: "x", noticedOn: "2026-09-20" }];
    expect(pickMonth(all, null)).toBe("2026-10");
    expect(pickMonth(all, "2026-09")).toBe("2026-09");
    expect(pickMonth(all, "2025-01")).toBe("2026-10");
    expect(quotesOfMonth(all, "2026-10").map((x) => x.id)).toEqual(["b", "a"]);
  });
  it("source: no PNG, no shareCard, no referral, no link on the page", () => {
    const src = readFileSync(new URL("./SaidPage.tsx", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/shareCard|toDataURL|referral|SHARE_URL|buildShareUrl|html2canvas/);
  });
});
