import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionLoopEntry } from "../../actionLoop/model";
const state = vi.hoisted(() => ({ lang: "en" as "en" | "he", row: null as ActionLoopEntry | null }));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ activeTodayAction: state.row, actionLoop: state.row ? [state.row] : [], childProfile: { id: "child-a" } }) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
import TodayActionLoop from "./TodayActionLoop";
import CarryOverActionAsk from "./CarryOverActionAsk";
const row: ActionLoopEntry = { id: "today.child-a.2026-10-09", source: "onboarding", status: "accepted", capacity: "tiny", recommendation: "The full question?\nSay-back detail.", acceptedAt: "2026-10-09T12:00:00Z", acceptanceKey: "onboarding-v1.child-a.exact" };
beforeEach(() => { state.row = { ...row }; vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-10T12:00:00Z")); });
afterEach(() => vi.useRealTimers());
describe("legacy action readers preserve observation semantics", () => {
  it.each(["en", "he"] as const)("open observation links to the canonical recording seam without efficacy choices (%s)", lang => {
    state.lang = lang;
    for (const component of [<TodayActionLoop />, <CarryOverActionAsk />]) {
      const html = renderToStaticMarkup(component);
      expect(html).toContain(row.recommendation);
      expect(html).toContain('href="#/overview"');
      expect(html).not.toMatch(/It helped|A little|Not today|זה עזר|קצת|לא היום/);
    }
  });
  it("a completed observation reads its recorded words without an efficacy receipt", () => {
    state.lang = "en"; state.row = { ...row, observation: true, status: "completed", whatHappened: "The parent's exact moment." };
    const html = renderToStaticMarkup(<TodayActionLoop />);
    expect(html).toContain("The parent&#x27;s exact moment.");
    expect(html).toContain("Moment kept in your record.");
    expect(html).not.toContain("It helped");
    expect(renderToStaticMarkup(<CarryOverActionAsk />)).toBe("");
  });
});
