import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* B-OCCL-03 (6 Oct) — #/screening at 375 × 812: data-primary-move
   (complete-check) sat on the check module's display:contents wrapper,
   measured y 517 h 353 EN · y 488 h 313 HE (sweeps/ship-275042b9), so the
   stamp ran under the fixed capture dock and "Start the check" sat at
   ≈ 845 EN / 776 HE. Fix: the ONE literal (Screening CHECK_STAMP) is spread
   on "Start the check" (intro) / "See the result" (questions) when the page
   renders ScreeningFlow `stamped` (a static-const spread, so whiteLabelContrast
   can prove the fill); the TrustSafetyBar moves UNDER the check; the
   PageHeader is flush; in the intro the button follows the body and the
   basis line, the corrected-age note and the last check follow the button.

   jsdom has no layout: this guard asserts the stamp seam (source + rendered
   EN/HE), the order, and a line model CALIBRATED on the measured pre-fix
   rect (button bottom = card bottom − p-6 − border) minus the blocks this fix
   moved out from above the button. OWED to a rendered check: rendered-sweep
   primaryMoveOccluded false and the stamp bottom ≤ 640 on #/screening 375
   EN + HE. */

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  arbor: {
    childProfile: { id: "c1", name: "Dylan", age: 3, birthDate: "2023-08-01", ageMonths: 38 },
    milestones: [] as unknown[],
    behaviorLogs: [] as unknown[],
    setActiveTab: () => undefined,
    requestConsultPrefill: () => undefined,
  },
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => state.arbor }));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: () => undefined }) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});
vi.mock("../../hooks/useChildCollection", () => ({
  useChildCollection: () => ({ items: [], upsert: () => undefined, remove: () => undefined, loading: false }),
}));
vi.mock("../../hooks/useMonitoring", () => ({
  useMonitoring: () => ({ elevated: false, watchAreas: [], domains: [] }),
}));
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  motion: new Proxy({}, {
    get: (_t, tag: string) => ({ children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) => {
      const { initial, animate, exit, transition, whileTap, whileHover, layout, ...safe } = rest as Record<string, unknown>;
      void initial; void animate; void exit; void transition; void whileTap; void whileHover; void layout;
      return React.createElement(tag, safe, children);
    },
  }),
}));

import Screening, { ScreeningFlow } from "./Screening";
import { translate } from "../../lib/i18n";

function installStorage() {
  const make = () => {
    const map = new Map<string, string>();
    return {
      get length() { return map.size; },
      clear: () => map.clear(),
      key: (i: number) => [...map.keys()][i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, String(v)); },
      removeItem: (k: string) => { map.delete(k); },
    } as Storage;
  };
  vi.stubGlobal("sessionStorage", make());
  vi.stubGlobal("localStorage", make());
}
beforeEach(installStorage);

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(here, "Screening.tsx"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

/* Measured pre-fix (ship-275042b9, 375 × 812): wrapper top + height. */
const MEASURED = { en: { y: 517, h: 353 }, he: { y: 488, h: 313 } } as const;
const FOLD_LIMIT = 640;
/* Trust bar at 375: 343 px wide, p-3.5, --t-sm 13 px (19.5 px lines), three
   posture spans wrapping with gap-x 16, the note on its own line(s), gap-y 6;
   then the page's space-y-6. Basis pill: 12 px (18 px lines) over 295 − 24
   padding − 22 icon. Characters at 0.5 em (EN widths for HE: conservative
   — wider text means MORE height moved out, so the HE bound uses EN-length
   strings measured in the HE dictionary itself). */
const lines = (chars: number, px: number, width: number, em = 0.5) => Math.max(1, Math.ceil((chars * px * em) / width));
function trustHeight(lang: "en" | "he") {
  const t = (k: string) => translate(lang, k);
  const W = 343 - 28;
  const spans = ["kit.trust.calm", "kit.trust.nonDiagnostic", "kit.trust.escalation"].map((k) => t(k).length * 13 * 0.5);
  let rows = 1;
  let x = 0;
  for (const w of spans) {
    if (x > 0 && x + 16 + w > W) { rows += 1; x = w; } else x += (x > 0 ? 16 : 0) + w;
  }
  rows += lines(t("screen.trustNote").length, 13, W);
  return 28 + rows * 19.5 + (rows - 1) * 6 + 24;
}
function basisHeight(lang: "en" | "he") {
  return 12 + 12 + lines(translate(lang, "screen.intro.basis").length, 12, 295 - 24 - 22) * 18;
}
function startBottom(lang: "en" | "he") {
  const preFixBottom = MEASURED[lang].y + MEASURED[lang].h - 24 - 1;
  return Math.round(preFixBottom - trustHeight(lang) - 28 /* mb-7 */ - basisHeight(lang));
}

const renderPage = (lang: "en" | "he") => {
  state.lang = lang;
  return renderToStaticMarkup(<Screening />);
};

describe("#/screening — the move is the start button, above the capture dock at 375", () => {
  it("ONE data-primary-move literal: a shared const spread (or undefined) on start + submit; the wrapper carries none", () => {
    expect(SRC.match(/\bdata-primary-move\b(?!-)/g)).toHaveLength(1);
    expect(SRC).toContain('const CHECK_STAMP = { "data-primary-move": "complete-check" } as const;');
    expect(SRC).toContain("<ScreeningFlow stamped />");
    expect(SRC).toMatch(/<div data-module="screening-check" style=\{\{ display: "contents" \}\}>/);
    expect(SRC).toMatch(/onClick=\{\(\) => setPhase\("questions"\)\}\s+\{\.\.\.\(stamped \? CHECK_STAMP : undefined\)\}\s+data-testid="screen-start"/);
    expect(SRC).toMatch(/onClick=\{submit\}\s+disabled=\{!allAnswered\}\s+\{\.\.\.\(stamped \? CHECK_STAMP : undefined\)\}/);
    // No prop spread anywhere on a button (whiteLabelContrast cannot resolve one).
    expect(SRC).not.toMatch(/\{\.\.\.moveAttrs\}/);
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: rendered page — one stamp, on "Start the check"; header flush → check → trust note → monitoring`, () => {
      const html = renderPage(lang);
      expect(html.match(/data-primary-move=/g)).toHaveLength(1);
      expect(html).toMatch(/<button[^>]*data-primary-move="complete-check"[^>]*data-testid="screen-start"/);
      expect(html).not.toMatch(/<div[^>]*data-module="screening-check"[^>]*data-primary-move/);
      const at = (s: string) => html.indexOf(s);
      const order = [
        at("<h1"),
        at("<h2"),
        at('data-testid="screen-start"'),
        at('data-testid="screen-basis"'),
        at(translate(lang, "screen.trustNote")),
        at('data-module="screening-monitoring"'),
      ];
      expect(order.every((i) => i >= 0)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      expect(html).not.toMatch(/justify-between gap-3 mb-7/);
    });

    it(`${lang}: the sheet's flow (not stamped) carries no stamp`, () => {
      state.lang = lang;
      expect(renderToStaticMarkup(<ScreeningFlow />)).not.toContain("data-primary-move");
    });

    it(`${lang}: no text under 12 px and no uppercase in the intro card`, () => {
      const html = renderPage(lang);
      expect(html).not.toMatch(/text-\[(?:11|11\.5)px\]/);
      const intro = html.slice(html.indexOf('data-module="screening-check"'), html.indexOf(translate(lang, "screen.trustNote")));
      expect(intro).not.toMatch(/\buppercase\b/);
    });

    it(`${lang}: "Start the check" bottom ≤ ${FOLD_LIMIT} px at 375 × 812 (calibrated line model)`, () => {
      expect(startBottom(lang)).toBeLessThanOrEqual(FOLD_LIMIT);
    });
  }

  it("negative control: the measured pre-fix button sat under the dock in both locales", () => {
    for (const lang of ["en", "he"] as const) expect(MEASURED[lang].y + MEASURED[lang].h - 25).toBeGreaterThan(FOLD_LIMIT);
  });
});
