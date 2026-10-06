import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* B-OCCL-01 (6 Oct) — #/smart-reminders at 375 × 812: data-primary-move
   (set-reminder-prefs) sat on the prefs module's display:contents wrapper,
   measured y 595, h 276 EN / 239 HE (sweeps/ship-275042b9) — under the fixed
   capture dock; the first switch's bottom edge sat at ≈ 712 EN. Fix: the ONE
   literal (PREFS_STAMP) is spread on the FIRST nudge-type switch (Toggle
   stamped, a static const or undefined — whiteLabelContrast resolves it), and
   the prefs block comes BEFORE the max-2 contract card (the contract stays
   always visible, directly under it).

   jsdom has no layout: this guard asserts the stamp seam (source + rendered
   EN/HE), the order, and a line model from the measured wrapper top minus the
   contract card that no longer sits above it. OWED to a rendered check:
   rendered-sweep primaryMoveOccluded false and the stamp bottom ≤ 640 on
   #/smart-reminders 375 EN + HE. */

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  arbor: {
    setActiveTab: () => undefined,
    childProfile: { id: "c1", name: "Dylan", age: 3, birthDate: "2023-08-01", ageMonths: 38 },
    behaviorLogs: [] as unknown[],
  },
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => state.arbor }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});
vi.mock("../../hooks/usePushPriming", () => ({
  usePushPriming: () => ({ capable: false, permission: "default", registered: false, pending: false, onToggle: () => undefined }),
}));
vi.mock("../nextopen/PushPrimingCard", () => ({ default: () => null }));
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

import SmartRemindersPanel from "./SmartRemindersPanel";
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
const SRC = readFileSync(path.join(here, "SmartRemindersPanel.tsx"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/^\s*\/\/.*$/gm, "");

const render = (lang: "en" | "he") => {
  state.lang = lang;
  return renderToStaticMarkup(<SmartRemindersPanel />);
};

/* The 375 model. Measured: the prefs wrapper top at y 595 (EN = HE). Content
   width 375 − 2 · 16 = 343. The contract card that no longer sits above it:
   half 1 = p-4 + max(36, the max-2 line at 13 px / 21 px lines over
   343 − 2 − 32 − 36 − 12 = 261 px + mt-1 + the 18 px count line); half 2 =
   1 px rule + p-4 + the 12 px label (18) + mb-2 + the 36 px nudge row; card
   border 2; then the page's space-y-6. The first switch: the section heading
   (28 + mb-3), the row's p-4 + border, the switch (44) centred against the
   label (13 px, 19.5) + mt-0.5 + the description (12 px / 18 px lines over
   343 − 2 − 32 − 44 − 16 = 249 px). 0.5 em per character, EN widths for HE
   (conservative). */
const FOLD_LIMIT = 640;
const lines = (chars: number, px: number, width: number) => Math.max(1, Math.ceil((chars * px * 0.5) / width));
function contractHeight(lang: "en" | "he") {
  const half1 = 32 + Math.max(36, lines(translate(lang, "sr.max2").length, 13, 261) * 21 + 4 + 18);
  const half2 = 1 + 32 + 18 + 8 + 36;
  return half1 + half2 + 2 + 24;
}
function firstSwitchBottom(lang: "en" | "he") {
  const top = 595 - contractHeight(lang);
  const text = 19.5 + 2 + lines(translate(lang, "sr.types.guidance.desc").length, 12, 249) * 18;
  return Math.round(top + 28 + 12 + 1 + 16 + (Math.max(text, 44) + 44) / 2);
}

describe("#/smart-reminders — the move is the first switch, above the capture dock at 375", () => {
  it("ONE data-primary-move literal: a shared const spread (or undefined) on the Toggle; the prefs wrapper carries none", () => {
    expect(SRC.match(/\bdata-primary-move\b(?!-)/g)).toHaveLength(1);
    expect(SRC).toContain('const PREFS_STAMP = { "data-primary-move": "set-reminder-prefs" } as const;');
    expect(SRC).toContain("{...(stamped ? PREFS_STAMP : undefined)}");
    expect(SRC).toContain("stamped={i === 0}");
    expect(SRC).toMatch(/<div data-module="reminders-prefs" style=\{\{ display: "contents" \}\}>/);
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: rendered — one stamp, on the first nudge-type switch; prefs before the contract card, contract still on the page`, () => {
      const html = render(lang);
      expect(html.match(/data-primary-move=/g)).toHaveLength(1);
      const first = html.indexOf('data-testid="sr-toggle-guidance"');
      const second = html.indexOf('data-testid="sr-toggle-moments"');
      const stamp = html.indexOf('data-primary-move="set-reminder-prefs"');
      expect(first).toBeGreaterThan(0);
      expect(stamp).toBeGreaterThan(first);
      expect(stamp).toBeLessThan(second);
      expect(html).toMatch(/<button[^>]*role="switch"[^>]*data-primary-move="set-reminder-prefs"/);
      const contract = html.indexOf('data-testid="sr-max2-contract"');
      const delivery = html.indexOf('data-module="reminders-delivery"');
      expect(html.indexOf("<h1")).toBeLessThan(first);
      expect(second).toBeLessThan(contract);
      expect(contract).toBeLessThan(delivery);
    });

    it(`${lang}: the first switch's bottom ≤ ${FOLD_LIMIT} px at 375 × 812 (line model)`, () => {
      expect(firstSwitchBottom(lang)).toBeLessThanOrEqual(FOLD_LIMIT);
    });
  }

  it("negative control: with the contract card still above (the pre-fix order) the switch sat under the dock", () => {
    expect(firstSwitchBottom("en") + contractHeight("en")).toBeGreaterThan(FOLD_LIMIT);
  });
});
