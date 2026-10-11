import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Observation } from "../../lib/observations";
import { PORTRAIT_COPY } from "./portraitCopy";

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he", loading: false, error: false, more: false, confirmed: true,
  observations: [] as Observation[], setActiveTab: vi.fn(), loadMore: vi.fn(),
  buttons: [] as { children?: React.ReactNode; onClick?: () => void }[],
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: "child-a", name: "Noa", interests: [], strengths: ["Curiosity"] }, milestones: [], setActiveTab: state.setActiveTab, seedCoach: vi.fn(), openCaptureSheet: vi.fn(), requestJournalFocus: vi.fn() }) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string) => translate(state.lang, key) }) };
});
vi.mock("../../hooks/useObservationRecord", () => ({ useObservationRecord: () => ({ ...state, sources: { behaviorLogs: [] }, reload: vi.fn() }) }));
vi.mock("../ui/Modal", () => ({ Modal: () => null }));
// Parity 9 Oct: the watch row and the keepsake disclosure have their own tests.
vi.mock("./PortraitWatchRow", () => ({ default: () => <div data-testid="watch-row" /> }));
vi.mock("./PortraitKeepsakes", () => ({ default: () => null }));
// B-SHELL-39: the kept-description card has its own tests (components/describe).
vi.mock("../describe/KeptDescription", () => ({ default: () => null }));
const capture = (type: unknown, props: unknown) => { if (type === "button" && props && typeof props === "object") state.buttons.push(props as typeof state.buttons[number]); };
vi.mock("react/jsx-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return { ...runtime, jsx: (...args: Parameters<typeof runtime.jsx>) => { capture(args[0], args[1]); return runtime.jsx(...args); }, jsxs: (...args: Parameters<typeof runtime.jsxs>) => { capture(args[0], args[1]); return runtime.jsxs(...args); } };
});
vi.mock("react/jsx-dev-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...args: Parameters<typeof runtime.jsxDEV>) => { capture(args[0], args[1]); return runtime.jsxDEV(...args); } };
});
import ChildPortrait from "./ChildPortrait";

beforeEach(() => { vi.clearAllMocks(); state.lang = "en"; state.observations = []; state.loading = false; state.more = false; state.error = false; state.confirmed = true; state.buttons = []; });

describe("Growth record coverage and restored doors", () => {
  it.each(["en", "he"] as const)("renders truthful loading, partial and complete states in %s", lang => {
    state.lang = lang;
    state.loading = true; let html = renderToStaticMarkup(<ChildPortrait />);
    expect(html).toContain('data-history-state="loading"'); expect(html).toContain(PORTRAIT_COPY[lang].loading);
    state.loading = false; state.more = true; html = renderToStaticMarkup(<ChildPortrait />);
    expect(html).toContain('data-history-state="partial"'); expect(html).toContain(PORTRAIT_COPY[lang].more);
    const older = state.buttons.find(button => React.Children.toArray(button.children).includes(PORTRAIT_COPY[lang].more));
    older?.onClick?.(); expect(state.loadMore).toHaveBeenCalledOnce();
    state.more = false; html = renderToStaticMarkup(<ChildPortrait />); expect(html).toContain('data-history-state="complete"');
    state.error = true; html = renderToStaticMarkup(<ChildPortrait />); expect(html).toContain('data-history-state="error"');
  });
  it("puts the core record lenses before the optional watch controls", () => {
    const html = renderToStaticMarkup(<ChildPortrait />);
    expect(html.indexOf('class="portrait-toolbar"')).toBeGreaterThan(-1);
    expect(html.indexOf('class="portrait-toolbar"')).toBeLessThan(html.indexOf('data-testid="watch-row"'));
    expect(html).toContain('data-primary-move="explore-child-record"');
  });
  it("renders a neutral moment with a neutral glyph and a visible unfiled door", () => {
    state.observations = [{ id: "behaviorLogs:a", childId: "child-a", at: new Date().toISOString(), domains: [], kind: "moment", origin: "behaviorLogs", source: "parent_typed", value: { type: "moment", behaviorType: "Moment" }, ageAtObservationMonths: null, pretermCorrected: false }];
    const html = renderToStaticMarkup(<ChildPortrait />);
    expect(html).toContain(PORTRAIT_COPY.en.unfiled); expect(html).toContain("portrait-unfiled"); expect(html).not.toContain(">undefined<");
  });
  it("gives reports, patterns and plans working visible navigation handlers", () => {
    renderToStaticMarkup(<ChildPortrait />);
    for (const [label, route] of [[PORTRAIT_COPY.en.reports, "reports"], [PORTRAIT_COPY.en.behavior, "behaviors"], [PORTRAIT_COPY.en.plans, "plans"]]) {
      const button = state.buttons.find(button => React.Children.toArray(button.children).includes(label));
      expect(button).toBeDefined(); button?.onClick?.(); expect(state.setActiveTab).toHaveBeenLastCalledWith(route);
    }
  });
});
