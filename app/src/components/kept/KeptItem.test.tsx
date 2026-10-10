import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { translate } from "../../lib/i18n";

const h = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.lang, t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars) }) }));
vi.mock("../share/SendSheet", () => ({ SendSheet: () => null }));
import KeptItem, { keptDateLabel, keptItemText, keptTextLanguage } from "./KeptItem";

const item = { id: "word:a", kind: "said" as const, at: "2026-10-05", text: "The moon follows us", language: "English", area: "talking", attribution: "parent" as const };
beforeEach(() => { h.lang = "en"; });

describe("one kept paper row", () => {
  for (const lang of ["en", "he"] as const) it(`${lang}: preserves words, date, attribution and a quiet Send action`, () => {
    h.lang = lang;
    const html = renderToStaticMarkup(<KeptItem beforeExport={() => true} item={item} childName="Noa" />);
    expect(html).toContain('<bdi dir="auto" lang="en">The moon follows us</bdi>');
    expect(html).toContain('dateTime="2026-10-05"');
    expect(html).toContain(translate(lang, "kept.noted"));
    expect(html).toContain(translate(lang, "kept.send"));
    expect(html).not.toMatch(/<img|https?:|progressbar|%|gradient|uppercase/);
  });
  it("formats a UTC-stable date and a plain-text share with no generated URL", () => {
    expect(keptDateLabel("2026-10-01T01:00:00+03:00", "en")).toBe("30 Sept");
    expect(keptItemText(item, "Noa", "en")).toBe("5 Oct — Noa: “The moon follows us”");
    expect(keptTextLanguage("Hebrew")).toBe("he");
    expect(keptTextLanguage("not a language")).toBe("und");
  });
  it("pins the shared SendSheet and readable serif/touch floors; negative controls fail", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "kept.css"), "utf8");
    const source = fs.readFileSync(path.resolve(__dirname, "KeptItem.tsx"), "utf8");
    expect(source).toContain('text={keptItemText(item, childName, lang)}');
    expect(source).toContain('<SendSheet open');
    const words = (code: string) => /\.kept-words\s*\{[^}]*font-family: var\(--font-editorial\);[^}]*font-size: 19px/.test(code);
    const touch = (code: string) => /\.kept-text-button\s*\{[^}]*min-block-size: 44px/.test(code);
    expect(words(css)).toBe(true); expect(words(css.replace(/font-size: 19px/g, "font-size: 11px"))).toBe(false);
    expect(touch(css)).toBe(true); expect(touch(css.replace(/min-block-size: 44px/g, "min-block-size: 24px"))).toBe(false);
  });
});
