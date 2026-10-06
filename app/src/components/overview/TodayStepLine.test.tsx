import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

/* P5 r1 pass A5 (option b, ratified 6 Oct): an ACCEPTED step still open
   today keeps ONE visible line on Today (inside the door) — it may not vanish
   into Ask. The line's two chips write the SAME outcomes through the SAME
   path TodayActionLoop used (recordTodayOutcome). */

const h = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  step: null as null | { id: string; status: string; recommendation: string },
  record: (() => undefined) as (...a: unknown[]) => void,
}));
vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({ activeTodayAction: h.step, recordTodayOutcome: h.record }),
}));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ t: (k: string, v?: Record<string, string | number>) => translate(h.lang, k, v), uiLang: h.lang }) };
});

import TodayStepLine from "./TodayStepLine";
import { translate } from "../../lib/i18n";

type El = React.ReactElement<{ children?: React.ReactNode; onClick?: () => void; "data-outcome"?: string }>;
const buttons = (node: React.ReactNode, out: El[] = []): El[] => {
  if (Array.isArray(node)) node.forEach((n) => buttons(n, out));
  else if (React.isValidElement(node)) {
    const el = node as El;
    if (el.type === "button") out.push(el);
    buttons(el.props.children, out);
  }
  return out;
};

beforeEach(() => {
  h.step = null;
  h.record = vi.fn();
});

describe("TodayStepLine — the accepted step keeps its line on Today", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: an open accepted step renders ONE line with its words and two answers; a tap writes the outcome`, () => {
      h.lang = lang;
      h.step = { id: "step-1", status: "accepted", recommendation: "Name the feeling once, then wait" };
      const html = renderToStaticMarkup(<TodayStepLine />);
      expect(html).toContain('data-testid="today-door-step"');
      expect(html).toContain("Name the feeling once, then wait");
      expect(html).toContain(translate(lang, "elev.loop.door.step"));
      const tree = TodayStepLine();
      const chips = buttons(tree);
      expect(chips.map((b) => b.props["data-outcome"])).toEqual(["helped", "not_today"]);
      chips[0].props.onClick?.();
      expect(h.record).toHaveBeenCalledWith("step-1", "helped");
      chips[1].props.onClick?.();
      expect(h.record).toHaveBeenCalledWith("step-1", "not_today");
      for (const b of html.match(/<button[^>]*>/g) ?? []) expect(b).toMatch(/min-h-11/);
    });
  }
  it("an answered step keeps the receipt, no chips", () => {
    h.lang = "en";
    h.step = { id: "step-1", status: "completed", recommendation: "Name the feeling once" };
    const html = renderToStaticMarkup(<TodayStepLine />);
    expect(html).toContain('data-testid="today-door-step-receipt"');
    expect(html).not.toContain("<button");
  });
  it("no accepted step: nothing renders", () => {
    expect(renderToStaticMarkup(<TodayStepLine />)).toBe("");
  });
});
