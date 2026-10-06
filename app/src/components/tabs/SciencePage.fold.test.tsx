import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

/* B-OCCL-05 (6 Oct) — #/science at 375 × 812: data-primary-move
   (open-evidence) sat on the hub nav wrapper, measured y 678 EN / 632 HE,
   h 165 (sweeps/ship-275042b9) — the nav itself started under the fixed
   capture dock. Fix: the ONE literal (EVIDENCE_STAMP) is spread on the nav's
   FIRST section door (a static const or undefined — whiteLabelContrast
   resolves it), and the VERBATIM AP-060 disclaimer renders on load directly
   UNDER the nav instead of above it (≈ 285 px at 375).

   jsdom has no layout: this guard asserts the stamp seam (source + rendered
   EN/HE), the order, and a line model from the measured nav top minus the
   disclaimer that no longer sits above it. OWED to a rendered check:
   rendered-sweep primaryMoveOccluded false and the stamp bottom ≤ 640 on
   #/science 375 EN + HE. */

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
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ setActiveTab: () => undefined }) }));
vi.mock("../../lib/analytics", () => ({ track: () => undefined }));

import SciencePage from "./SciencePage";
import { translate } from "../../lib/i18n";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(here, "SciencePage.tsx"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

const render = (lang: "en" | "he") => {
  state.lang = lang;
  return renderToStaticMarkup(<SciencePage />);
};

/* Measured nav top (ship-275042b9, 375 × 812). The disclaimer card that no
   longer sits above it: 1 px border × 2 + p-4 + the 14 px / 22.75 px-line
   text over 375 − 2 · 16 − 2 − 32 − 20 − 12 = 277 px (0.5 em per character,
   EN widths for HE: conservative), then the page's space-y-6. The first door:
   py-1.5 + one 18 px line (12 px text, 14 px icon) = 30. */
const MEASURED_NAV_TOP = { en: 678, he: 632 } as const;
const FOLD_LIMIT = 640;
const lines = (chars: number, px: number, width: number) => Math.max(1, Math.ceil((chars * px * 0.5) / width));
function disclaimerHeight(lang: "en" | "he") {
  return 2 + 32 + Math.max(20, lines(translate(lang, "sci.disclaimer").length, 14, 277) * 22.75) + 24;
}
function firstDoorBottom(lang: "en" | "he") {
  return Math.round(MEASURED_NAV_TOP[lang] - disclaimerHeight(lang) + 30);
}

describe("#/science — the move is the first section door, above the capture dock at 375", () => {
  it("ONE data-primary-move literal: a shared const spread (or undefined) on the first door; the nav carries none", () => {
    expect(SRC.match(/\bdata-primary-move\b(?!-)/g)).toHaveLength(1);
    expect(SRC).toContain('const EVIDENCE_STAMP = { "data-primary-move": "open-evidence" } as const;');
    expect(SRC).toContain("{...(id === SECTION_IDS[0] ? EVIDENCE_STAMP : undefined)}");
    expect(SRC).toMatch(/<nav data-module="science-nav" aria-label/);
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: rendered — one stamp, on the first door; header → spine → nav → the verbatim disclaimer (on load) → the document`, () => {
      const html = render(lang);
      expect(html.match(/data-primary-move=/g)).toHaveLength(1);
      expect(html).toMatch(/<button[^>]*data-primary-move="open-evidence"[^>]*data-testid="trust-nav-how"/);
      expect(html).not.toMatch(/<nav[^>]*data-primary-move/);
      const at = (s: string) => html.indexOf(s);
      const order = [
        at("<h1"),
        at('data-testid="trust-spine-ribbon"'),
        at('data-testid="trust-hub-nav"'),
        at('data-testid="trust-nav-how"'),
        at('data-testid="science-disclaimer"'),
        at('data-testid="trust-section-how"'),
      ];
      expect(order.every((i) => i >= 0)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    it(`${lang}: the first door's bottom ≤ ${FOLD_LIMIT} px at 375 × 812 (line model)`, () => {
      expect(firstDoorBottom(lang)).toBeLessThanOrEqual(FOLD_LIMIT);
    });
  }

  it("negative control: with the disclaimer still above (the pre-fix order) the door sat under the dock", () => {
    for (const lang of ["en", "he"] as const) expect(MEASURED_NAV_TOP[lang] + 30).toBeGreaterThan(FOLD_LIMIT);
  });
});
