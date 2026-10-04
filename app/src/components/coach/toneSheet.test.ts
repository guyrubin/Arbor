/**
 * B-ASKJB-12 — #/scholar retires into "How should Arbor talk with you?".
 *
 * The sheet is rendered with the REAL dictionaries (Modal portals into
 * document.body, so it renders inline here — same harness as
 * plans.tapComplete.test.ts). Guards: every one of the 8 lens ids is
 * selectable; every choice is ≥44 px; no Latin body copy on the Hebrew sheet;
 * the chosen lens is written to the ONE store (`selectedLens`) that reaches
 * /chat as `scholarLens`, unchanged.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { scholarsInfo } from "../../initialData";

vi.mock("../ui/Modal", () => ({
  Modal: ({ title, children }: { title?: string; children: React.ReactNode }) =>
    React.createElement("div", { "data-modal": title }, children),
}));

const { default: ToneSheet, TONE_CHOICES, MORE_APPROACHES, TONE_LENS_IDS, toneLabel } = await import("./ToneSheet");
const here = path.dirname(fileURLToPath(import.meta.url));

const render = (lang: "en" | "he", selectedLens = "Integrated Balanced") =>
  renderToStaticMarkup(React.createElement(ToneSheet, {
    open: true, onClose: () => {}, selectedLens, onSelect: () => {},
    t: (k: string, v?: Record<string, string | number>) => translate(lang, k, v),
  }));

/** Text nodes only (attributes carry lens ids, which are identifiers, not copy). */
const textOf = (html: string) => html
  .replace(/<span class="msr"[^>]*>[^<]*<\/span>/g, " ") // icon ligatures are aria-hidden glyph names, not copy
  .replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");

describe("B-ASKJB-12 — the ToneSheet", () => {
  it("maps the four tones to the lens ids of record", () => {
    expect(TONE_CHOICES.map((c) => [c.id, c.lens])).toEqual([
      ["warm", "Integrated Balanced"],
      ["steps", "Lev Vygotsky"],
      ["connection", "John Bowlby"],
      ["why", "Jean Piaget"],
    ]);
    expect(MORE_APPROACHES.map((m) => m.lens)).toEqual(["Donald Winnicott", "Maria Montessori", "Urie Bronfenbrenner", "Erik Erikson"]);
  });

  it("every one of the 8 lens ids stays selectable (Integrated + every scholar in the roster)", () => {
    const roster = ["Integrated Balanced", ...scholarsInfo.map((s) => s.name)];
    expect([...TONE_LENS_IDS].sort()).toEqual([...roster].sort());
    expect(TONE_LENS_IDS).toHaveLength(8);
    const html = render("en");
    for (const lens of roster) expect(html, lens).toContain(`data-tone-lens="${lens}"`);
  });

  for (const lang of ["en", "he"] as const) {
    it(`[${lang}] every choice is ≥44 px, one radiogroup, the selected one checked`, () => {
      const html = render(lang, "John Bowlby");
      const buttons = html.match(/<button\b[^>]*>/g) ?? [];
      expect(buttons).toHaveLength(8);
      for (const b of buttons) expect(b).toContain("min-h-11");
      expect((html.match(/role="radiogroup"/g) ?? []).length).toBe(1);
      expect(html).toMatch(/aria-checked="true"[^>]*data-tone-lens="John Bowlby"/);
      expect((html.match(/aria-checked="true"/g) ?? []).length).toBe(1);
    });
  }

  it("EN: the plain-language tones and the More approaches sentences render", () => {
    const html = render("en");
    for (const s of ["How should Arbor talk with you?", "Warm and brief", "Step by step", "Connection first", "Explain the why", "More approaches", "Winnicott", "Montessori"]) {
      expect(html, s).toContain(s);
    }
  });

  it("HE: no Latin body copy anywhere in the sheet", () => {
    const html = render("he");
    const text = textOf(html);
    expect(html).toContain('data-modal="איך ארבור תדבר איתכם?"');
    expect(text).toContain("ויניקוט");
    expect(text, "Latin leaked into the Hebrew sheet").not.toMatch(/[A-Za-z]/);
  });

  it("'Tone: {choice}' names every lens in both languages", () => {
    for (const lang of ["en", "he"] as const) {
      const t = (k: string) => translate(lang, k);
      for (const lens of TONE_LENS_IDS) expect(toneLabel(lens, t).trim(), `${lang} ${lens}`).not.toBe("");
      expect(toneLabel("Integrated Balanced", t)).toBe(t("coach.tone.warm"));
    }
    expect(translate("he", "coach.tone.label")).toBe("טון");
  });

  it("the choice writes the ONE store that reaches /chat as scholarLens, unchanged", () => {
    const coach = readFileSync(path.resolve(here, "../tabs/CoachTab.tsx"), "utf8");
    expect(coach).toContain("onSelect={setSelectedLens}");
    expect(coach).toContain("scholarLens: selectedLens,");
    const ctx = readFileSync(path.resolve(here, "../../context/ArborContext.tsx"), "utf8");
    expect(ctx).toContain('scholarLens: selectedLens || "Integrated Balanced"');
  });
});
