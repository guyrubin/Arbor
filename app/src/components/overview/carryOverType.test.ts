// B-INF-09: the carry-over strip on Now holds no text under 12 px (it set its caption and its
// "Not today" at 11.5 px), and the chrome's avatar initial is never under 12 px either.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionLoopEntry } from "../../actionLoop/model";

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he", row: null as ActionLoopEntry | null }));
vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({ actionLoop: state.row ? [state.row] : [], childProfile: { id: "child-a", name: "Noa" }, recordTodayOutcome: () => {}, recordChildResponse: () => {} }),
}));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
import CarryOverActionAsk from "./CarryOverActionAsk";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, "..", rel), "utf8");

/** Font sizes a source sets below 12 px: Tailwind arbitrary text-[Npx] and inline fontSize N. */
export function sub12Sizes(src: string): string[] {
  const hits: string[] = [];
  for (const m of src.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) if (Number(m[1]) < 12) hits.push(m[0]);
  for (const m of src.matchAll(/fontSize:\s*(\d+(?:\.\d+)?)(?![\d.])/g)) if (Number(m[1]) < 12) hits.push(m[0]);
  return hits;
}

describe("B-INF-09 — no text under 12 px in the carry-over strip", () => {
  const src = read("overview/CarryOverActionAsk.tsx");

  it("CarryOverActionAsk sets no size under 12 px", () => {
    expect(sub12Sizes(src)).toEqual([]);
  });

  it("NEGATIVE CONTROL: the shipped 11.5 px caption, put back into the real source, is caught", () => {
    const shipped = src.replace('className="mt-1 text-xs leading-snug"', 'className="mt-1 text-[11.5px] leading-snug"');
    expect(shipped).not.toBe(src);
    expect(sub12Sizes(shipped)).toEqual(["text-[11.5px]"]);
  });

  it("the avatar initial is floored at 12 px (the strip's 24 px avatar drew a 10 px letter)", () => {
    const avatar = read("ui/Avatar.tsx");
    expect(avatar).toContain("fontSize: Math.max(12, Math.round(size * 0.4))");
    expect(avatar).not.toContain("fontSize: Math.round(size * 0.4) }}");
  });
});

/** Tailwind v4's named sizes (rem × 16) that a rendered class can carry. */
const NAMED_PX: Record<string, number> = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24 };

/** Every font size a rendered tree sets below 12 px: text-[Npx|Nrem] / named classes and inline font-size. */
export function renderedSub12(html: string): string[] {
  const hits: string[] = [];
  for (const m of html.matchAll(/class="([^"]*)"/g)) {
    for (const token of m[1].split(/\s+/)) {
      const arb = /^(?:[a-z0-9-]+:)*text-\[(\d+(?:\.\d+)?)(px|rem)\]$/.exec(token);
      const named = /^(?:[a-z0-9-]+:)*text-(xs|sm|base|lg|xl|2xl)$/.exec(token);
      const px = arb ? Number(arb[1]) * (arb[2] === "rem" ? 16 : 1) : named ? NAMED_PX[named[1]] : null;
      if (px !== null && px < 12) hits.push(token);
    }
  }
  for (const m of html.matchAll(/font-size:\s*(\d+(?:\.\d+)?)(px|rem)/g)) {
    const px = Number(m[1]) * (m[2] === "rem" ? 16 : 1);
    if (px < 12) hits.push(m[0]);
  }
  return hits;
}

describe("B-INF-09 — the rendered carry-over strip holds no text under 12 px (DOM guard)", () => {
  const base: ActionLoopEntry = { id: "today.child-a.2026-10-09", source: "coach", status: "accepted", capacity: "tiny", recommendation: "Name one feeling at bath time.", acceptedAt: "2026-10-09T12:00:00Z" } as ActionLoopEntry;
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-10T12:00:00Z")); });
  afterEach(() => { vi.useRealTimers(); state.row = null; });
  const variants: [string, ActionLoopEntry][] = [
    ["outcome buttons", base],
    ["observation door", { ...base, source: "onboarding", acceptanceKey: "onboarding-v1.child-a.exact" } as ActionLoopEntry],
    ["hard-moment ask", { ...base, source: "hard-moment" } as ActionLoopEntry],
  ];
  for (const lang of ["en", "he"] as const) {
    for (const [name, row] of variants) {
      it(`${name} (${lang}) renders and sets no size under 12 px`, () => {
        state.lang = lang; state.row = row;
        const html = renderToStaticMarkup(React.createElement(CarryOverActionAsk));
        expect(html).toContain('data-testid="carry-over-action"');
        expect(renderedSub12(html)).toEqual([]);
      });
    }
  }
  it("NEGATIVE CONTROL: the shipped 11.5 px caption, an inline 11 px size and a rem size are caught", () => {
    expect(renderedSub12('<p class="mt-1 text-[11.5px] leading-snug">a</p><b style="font-size:11px">b</b><i class="sm:text-[0.7rem]">c</i><p class="text-xs">d</p>'))
      .toEqual(["text-[11.5px]", "sm:text-[0.7rem]", "font-size:11px"]);
  });
});
