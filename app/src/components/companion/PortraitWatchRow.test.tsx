import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Parity 9 Oct — the watch focus is read again. The Development Check still
 * promises "It becomes this week's focus on Development"; this row is the
 * reader that went dark with the Growth hub.
 */
const MILESTONE = { id: "ms-say-two", domain: "language", title: "Puts two words together", desc: "Says things like more milk", checked: false, ageMonths: 24 };
const state = vi.hoisted(() => ({
  chosen: null as null | Record<string, unknown>,
  childId: "child-a", lang: "en" as "en" | "he", keepState: false, cursor: 0, hooks: [] as unknown[],
  savedWatch: null as null | { milestoneId: string; screenItemId: string; chosenAt: string },
  writeWatchFocus: vi.fn(),
  recheck: [] as { id: string; answeredAt: string; recheckDueAt?: string }[],
  setMilestoneObservation: vi.fn(), setActiveTab: vi.fn(), clearWatchFocus: vi.fn(), celebrate: vi.fn(), closeDay: vi.fn(),
  buttons: [] as { children?: React.ReactNode; onClick?: () => void; "data-testid"?: string }[],
}));
// A tiny stateful SSR harness exercises the actual clear/undo callbacks across renders.
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => {
    if (!state.keepState) return actual.useState(initial);
    const index = state.cursor++;
    if (!(index in state.hooks)) state.hooks[index] = typeof initial === "function" ? initial() : initial;
    return [state.hooks[index], (next: unknown) => { state.hooks[index] = typeof next === "function" ? next(state.hooks[index]) : next; }];
  } };
});
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  childProfile: { id: state.childId, name: "Noa Levi", age: 2 }, milestones: [MILESTONE], behaviorLogs: [], playLogs: [],
  setMilestoneObservation: state.setMilestoneObservation, setActiveTab: state.setActiveTab,
}) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: (_id: string, name: string) => ({ items: name === "screenings" ? state.recheck : [], loaded: true }) }));
vi.mock("../../lib/screeningWatch", () => ({ resolveWatchFocus: () => state.chosen, clearWatchFocus: (id: string) => { state.clearWatchFocus(id); state.chosen = null; state.savedWatch = null; },
  readWatchFocus: () => state.savedWatch,
  writeWatchFocus: (id: string, focus: typeof state.savedWatch) => { state.writeWatchFocus(id, focus); state.savedWatch = focus; state.chosen = { ...MILESTONE }; } }));
vi.mock("../../lib/milestoneData", async (original) => ({ ...(await original<typeof import("../../lib/milestoneData")>()), milestoneText: (m: { title?: string; desc?: string }, field: string) => (field === "title" ? m.title : m.desc) ?? "" }));
vi.mock("../../lib/tomorrowReason", () => ({ closeDay: (...args: unknown[]) => state.closeDay(...args), deriveReturnSignals: () => ({}) }));
vi.mock("../../lib/familyRitualsCadence", () => ({ readRitualRecord: () => null }));
vi.mock("../../lib/celebrate", () => ({ celebrate: (...args: unknown[]) => state.celebrate(...args) }));
vi.mock("../ui/ContentActionBar", () => ({ ContentWhyLine: () => null }));
const capture = vi.hoisted(() => (type: unknown, props: unknown) => {
  if (type === "button" && props && typeof props === "object") state.buttons.push(props as typeof state.buttons[number]);
});
vi.mock("react/jsx-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return { ...runtime, jsx: (...a: Parameters<typeof runtime.jsx>) => { capture(a[0], a[1]); return runtime.jsx(...a); }, jsxs: (...a: Parameters<typeof runtime.jsxs>) => { capture(a[0], a[1]); return runtime.jsxs(...a); } };
});
vi.mock("react/jsx-dev-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...a: Parameters<typeof runtime.jsxDEV>) => { capture(a[0], a[1]); return runtime.jsxDEV(...a); } };
});
import PortraitWatchRow from "./PortraitWatchRow";

const byTestId = (id: string) => state.buttons.find((b) => b["data-testid"] === id);
const portraitCss = readFileSync(new URL("./childPortrait.css", import.meta.url), "utf8");
// Source floor only: the exact-font browser capture measures the actual hit box.
const undoRule = /\.portrait-watch-undo\s*>\s*button\s*\{([^}]+)\}/;
const undoHasTouchFloor = (css: string) => {
  const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "").match(undoRule)?.[1] ?? "";
  return ["min-inline-size", "min-block-size"].every(property =>
    new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*var\\(--touch-min\\)\\s*(?:;|$)`).test(declarations));
};
beforeEach(() => { vi.clearAllMocks(); state.buttons = []; state.chosen = { ...MILESTONE }; state.recheck = []; state.childId = "child-a"; state.lang = "en"; state.keepState = false; state.hooks = []; state.cursor = 0; state.savedWatch = { milestoneId: MILESTONE.id, screenItemId: "screen-item", chosenAt: "2026-10-01T00:00:00Z" }; });

describe("the parent's watch choice shows, and can be answered in place", () => {
  it("renders the chosen milestone with Seen it / Not sure / Not yet", () => {
    const html = renderToStaticMarkup(<PortraitWatchRow />);
    expect(html).toContain("Puts two words together");
    for (const status of ["yes", "not_sure", "not_yet"]) expect(byTestId(`portrait-observe-${status}`), status).toBeDefined();
  });
  it("automatic focus is a closed native disclosure, while the parent’s choice opens", () => {
    expect(renderToStaticMarkup(<PortraitWatchRow />)).toMatch(/<details[^>]*open=""/);
    state.chosen = null;
    const html = renderToStaticMarkup(<PortraitWatchRow />);
    expect(html).toContain('data-testid="portrait-watch-details"');
    expect(html).not.toMatch(/<details[^>]*open=/);
    expect(html).toContain("Something to watch for");
    for (const status of ["yes", "not_sure", "not_yet"]) expect(html).toContain(`data-testid="portrait-observe-${status}"`);
  });
  it("Not yet preserves the same observation seam without celebration", () => {
    renderToStaticMarkup(<PortraitWatchRow />);
    byTestId("portrait-observe-not_yet")!.onClick?.();
    expect(state.setMilestoneObservation).toHaveBeenCalledWith("ms-say-two", "not_yet");
    expect(state.celebrate).not.toHaveBeenCalled();
  });
  it("Seen it writes through the milestone seam and celebrates once", () => {
    renderToStaticMarkup(<PortraitWatchRow />);
    byTestId("portrait-observe-yes")!.onClick?.();
    expect(state.setMilestoneObservation).toHaveBeenCalledWith("ms-say-two", "yes");
    expect(state.celebrate).toHaveBeenCalledWith({ kind: "milestone" });
  });
  it("Not sure writes the observation without a celebration", () => {
    renderToStaticMarkup(<PortraitWatchRow />);
    byTestId("portrait-observe-not_sure")!.onClick?.();
    expect(state.setMilestoneObservation).toHaveBeenCalledWith("ms-say-two", "not_sure");
    expect(state.celebrate).not.toHaveBeenCalled();
  });
  it("a choice the parent made can be unmade", () => {
    renderToStaticMarkup(<PortraitWatchRow />);
    byTestId("portrait-unwatch")!.onClick?.();
    expect(state.clearWatchFocus).toHaveBeenCalledWith("child-a");
  });
  it.each(["en", "he"] as const)("clear can be undone without carrying another child’s choice in %s", lang => {
    state.keepState = true; state.lang = lang;
    const saved = { ...state.savedWatch! };
    const render = () => { state.cursor = 0; state.buttons = []; return renderToStaticMarkup(<PortraitWatchRow />); };
    render(); byTestId("portrait-unwatch")!.onClick?.();
    const cleared = render();
    expect(cleared).toContain('data-testid="portrait-watch-undo"');
    // Both translated short labels must use the scoped 44×44 control rule.
    expect(cleared).toMatch(/<div class="portrait-watch-undo" role="status"><span>[^<]*<\/span><button[^>]*data-testid="portrait-watch-undo"/);
    expect(undoHasTouchFloor(portraitCss)).toBe(true);
    expect(cleared.replace(/<[^>]*>/g, " ")).not.toMatch(/focus|מיקוד/i);
    state.childId = "child-b";
    expect(render()).not.toContain('data-testid="portrait-watch-undo"');
    state.childId = "child-a"; render();
    byTestId("portrait-watch-undo")!.onClick?.();
    expect(state.writeWatchFocus).toHaveBeenCalledWith("child-a", saved);
    expect(render()).not.toContain('data-testid="portrait-watch-undo"');
    expect(render()).toMatch(/<details[^>]*open=""/);
    expect(render().replace(/<[^>]*>/g, " ")).not.toMatch(/focus|מיקוד/i);
  });
  it("the saved re-check date is plain text in neutral ink (no chip, no colour)", () => {
    state.recheck = [{ id: "s1", answeredAt: "2026-09-01T00:00:00Z", recheckDueAt: "2026-12-01T00:00:00Z" }];
    const html = renderToStaticMarkup(<PortraitWatchRow />);
    expect(html).toContain('data-testid="portrait-recheck-date"');
    expect(html).not.toMatch(/portrait-recheck-date[^>]*style=/);
  });
  it("tonight's return reason is written once per child (TJB-28; an effect, pinned at source)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./PortraitWatchRow.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/useEffect\(\(\) => \{\s*closeDay\(childProfile\.id, Date\.now\(\), returnSignals\);[\s\S]{0,200}?\}, \[childProfile\.id\]\);/);
  });
  it("CLINICAL FIREWALL: no %, score, level or verdict word on the row", () => {
    const html = renderToStaticMarkup(<PortraitWatchRow />);
    expect(html).not.toMatch(/\d+\s*%|\b(Low|Medium|High|Urgent|behind|delayed|at risk)\b/i);
  });
  it("NEGATIVE CONTROL: missing or sub-44 Undo floors cannot pass the source guard", () => {
    expect(undoHasTouchFloor(portraitCss.replace(undoRule, ""))).toBe(false);
    for (const property of ["min-inline-size", "min-block-size"]) {
      const narrowed = portraitCss.replace(undoRule, rule => rule.replace(`${property}: var(--touch-min)`, `${property}: 43px`));
      expect(undoHasTouchFloor(narrowed), property).toBe(false);
    }
  });
});
