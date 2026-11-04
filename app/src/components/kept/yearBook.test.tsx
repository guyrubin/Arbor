import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { renderPrintableHtml } from "../../lib/reportExport";
import { searchCatalog } from "../../lib/searchIndex";
import { buildYearBook } from "../../lib/keepsakeYear";

const h = vi.hoisted(() => ({ lang: "en" as "en" | "he", query: "", go: vi.fn() }));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  childProfile: { id: "child-a", name: "Noa Example", gender: "girl" },
  behaviorLogs: [], milestoneHistory: [], setActiveTab: vi.fn(),
}) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.lang, t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars) }) }));
vi.mock("../../hooks/useHashQuery", () => ({ useHashQuery: () => new URLSearchParams(h.query), goToRoute: h.go }));
vi.mock("../../hooks/useChildHistory", () => ({ useChildHistory: (_childId: string, name: string) => ({
  items: name === "langObs" ? [
    { id: "early", timestamp: "2026-03-02T12:00:00Z", phrase: "Morning light", language: "English" },
    { id: "late", timestamp: "2026-10-05T12:00:00Z", phrase: 'Moon <script>alert("x")</script>', language: "English" },
    { id: "prior", timestamp: "2025-12-01T12:00:00Z", phrase: "שלושה צעדים", language: "Hebrew" },
  ] : [],
  loading: false, error: false, confirmed: true, more: false, loadMore: vi.fn(), reload: vi.fn(), isCurrent: () => true,
}) }));
vi.mock("../share/SendSheet", () => ({ SendSheet: () => null }));
import KeptThingsPage from "./KeptThingsPage";
import KeptYearBook, { yearPageDoc, yearPageText } from "./KeptYearBook";

const book = buildYearBook({ yearKey: "2026", kept: [
  { id: "a", kind: "said", at: "2026-03-02", text: "Morning light", language: "English", attribution: "parent" },
  { id: "b", kind: "said", at: "2026-10-05", text: 'Moon <script>alert("x")</script>', language: "English", attribution: "parent" },
  { id: "c", kind: "said", at: "2025-12-01", text: "שלושה צעדים", language: "Hebrew", attribution: "parent" },
] })!;

beforeEach(() => { h.lang = "en"; h.query = ""; h.go.mockClear(); });

describe("the year book", () => {
  for (const lang of ["en", "he"] as const) it(`${lang}: prints the name, the year, and each month's words`, () => {
    h.lang = lang;
    const doc = yearPageDoc(book, "Noa", lang);
    const html = renderPrintableHtml(doc, "Noa", lang);
    expect(html).toContain(`<html lang="${lang}" dir="${lang === "he" ? "rtl" : "ltr"}">`);
    expect(html).toContain("<h1>Noa</h1>");
    expect(html).toContain('<p class="year">2026</p>');
    expect(html).toContain(lang === "he" ? "<h2>מרץ</h2>" : "<h2>March</h2>");
    expect(html).toContain(lang === "he" ? "<h2>אוקטובר</h2>" : "<h2>October</h2>");
    expect(html.indexOf(lang === "he" ? "<h2>מרץ</h2>" : "<h2>March</h2>")).toBeLessThan(html.indexOf(lang === "he" ? "<h2>אוקטובר</h2>" : "<h2>October</h2>"));
    expect(html).toContain('lang="en">Moon &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).not.toContain("שלושה צעדים");
    expect(html).not.toMatch(/class="brand"|class="meta"|class="footer"|<img|<script>alert|\bcount\b|\bscore\b|\bprogress\b|https?:/);
    const shown = renderToStaticMarkup(<KeptYearBook beforeExport={() => true} book={book} childName="Noa" disabled={false} asPage />);
    expect(shown).toContain('data-testid="kept-year-print"');
    expect(shown).toContain('data-testid="kept-year-send"');
    expect(shown).toContain("<h1");
    expect(shown).not.toContain("<img");
  });

  it("shares dated parent words and no link or picture", () => {
    expect(yearPageText(book, "Noa", "en")).toBe('Noa\n2026\n\nMarch\n2 Mar — Noa: “Morning light”\n\nOctober\n5 Oct — Noa: “Moon <script>alert("x")</script>”');
    expect(yearPageText(book, "Noa", "en")).not.toMatch(/https?:|<img/);
  });

  it("disables print and send while the year is incomplete", () => {
    const html = renderToStaticMarkup(<KeptYearBook beforeExport={() => true} book={book} childName="Noa" disabled />);
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });

  it("opens one whole year from the kept list and leaves the other year out", () => {
    const list = renderToStaticMarkup(<KeptThingsPage />);
    expect(list).toContain('data-year="2026"');
    expect(list).toContain('data-year="2025"');
    expect(list).toContain("Morning light");
    expect(list).toContain("שלושה צעדים");
    h.query = "year=2026";
    const open = renderToStaticMarkup(<KeptThingsPage asPage />);
    expect(open).toContain('data-testid="kept-year-book"');
    expect(open).toContain("Morning light");
    expect(open).toContain('Moon &lt;script&gt;');
    expect(open).not.toContain("שלושה צעדים");
    expect(open).not.toContain('data-testid="kept-month"');
    expect(open.match(/<h1\b/g)).toHaveLength(1);
    const source = readFileSync(new URL("./KeptYearBook.tsx", import.meta.url), "utf8");
    expect(source).not.toMatch(/<img|photoUrl|releaseChildLikeness\(/);
  });

  it("is a parent door on Moments, and search can name it", () => {
    const moments = readFileSync(new URL("../moments/MomentsBody.tsx", import.meta.url), "utf8");
    expect(moments).toContain('data-testid="moments-year-book"');
    expect(moments).toContain('goToRoute("development", { view: "kept" })');
    expect(searchCatalog("year book").some(row => row.id === "page:development:year-book" && row.view === "kept")).toBe(true);
    expect(searchCatalog("ספר השנה").some(row => row.id === "page:development:year-book")).toBe(true);
    for (const lang of ["en", "he"] as const) expect(translate(lang, "kept.yearBook")).not.toBe("kept.yearBook");
  });
});
