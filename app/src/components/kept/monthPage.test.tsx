import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { buildMonthPage } from "../../lib/keepsakeMonth";
import { renderPrintableHtml } from "../../lib/reportExport";
import { translate } from "../../lib/i18n";
const h = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.lang, t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars) }) }));
vi.mock("../share/SendSheet", () => ({ SendSheet: () => null }));
import KeptMonthPage, { monthPageDoc, monthPageText } from "./KeptMonthPage";
import { keptMonthLabel } from "./KeptThingsPage";
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({}) }));
vi.mock("../../hooks/useChildHistory", () => ({ useChildHistory: () => ({}) }));

const page = buildMonthPage({ monthKey: "2026-10", kept: [
  { id: "a", kind: "said", at: "2026-10-05", text: 'Moon <script>alert("x")</script>', language: "English", attribution: "parent" },
  { id: "b", kind: "first", at: "2026-10-08", text: "שלושה צעדים אליי", language: "Hebrew", attribution: "parent" },
] })!;

describe("the plain printable month page", () => {
  for (const lang of ["en", "he"] as const) it(`${lang}: prints only the name, month, words and dates in the existing shell`, () => {
    h.lang = lang;
    const month = keptMonthLabel(page.monthKey, lang, 2026);
    const doc = monthPageDoc(page, "Noa", month, lang);
    const html = renderPrintableHtml(doc, "Noa", lang);
    expect(html).toContain(`<html lang="${lang}" dir="${lang === "he" ? "rtl" : "ltr"}">`);
    expect(html).toContain("@page { size: A4;");
    expect(html).toContain("<h1>Noa</h1>");
    expect(html).toContain(`<p class="month">${month}</p>`);
    expect(html).toContain('lang="en">Moon &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).toContain('<bdi dir="auto" lang="he">שלושה צעדים אליי</bdi>');
    expect(html).not.toMatch(/class="brand"|class="meta"|class="footer"|<img|<script>alert|\bcount\b|\bscore\b|\bprogress\b|https?:/);
    const body = html.slice(html.indexOf("<body>"), html.indexOf("<script>window.onload"));
    expect(body.match(/<li>/g)).toHaveLength(2);
    const shown = renderToStaticMarkup(<KeptMonthPage beforeExport={() => true} page={page} childName="Noa" monthLabel={month} disabled={false} />);
    expect(shown).toContain('data-testid="kept-month-print"');
    expect(shown).toContain('data-testid="kept-month-send"');
  });
  it("shares verbatim dated text without a branded image or generated link", () => {
    expect(monthPageText(page, "Noa", "October", "en")).toBe('Noa\nOctober\n\n5 Oct — Noa: “Moon <script>alert("x")</script>”\n8 Oct — Noa: שלושה צעדים אליי');
  });
  it("disables both egress actions for an incomplete or unconfirmed month", () => {
    const html = renderToStaticMarkup(<KeptMonthPage beforeExport={() => true} page={page} childName="Noa" monthLabel="October" disabled />);
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
  it("retains the unchanged report layout for ordinary reports", () => {
    const html = renderPrintableHtml({ title: "Record", sections: [{ heading: "Note", body: "Parent record" }] }, "Noa");
    expect(html).toContain('class="brand"');
    expect(html).toContain('class="footer"');
    expect(html).not.toContain('class="month"');
  });
});
