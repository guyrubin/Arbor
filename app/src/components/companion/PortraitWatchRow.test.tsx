import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Parity 9 Oct — the watch focus is read again. The Development Check still
 * promises "It becomes this week's focus on Development"; this row is the
 * reader that went dark with the Growth hub.
 */
const MILESTONE = { id: "ms-say-two", domain: "language", title: "Puts two words together", desc: "Says things like more milk", checked: false, ageMonths: 24 };
const state = vi.hoisted(() => ({
  chosen: null as null | Record<string, unknown>,
  recheck: [] as { id: string; answeredAt: string; recheckDueAt?: string }[],
  setMilestoneObservation: vi.fn(), setActiveTab: vi.fn(), clearWatchFocus: vi.fn(), celebrate: vi.fn(), closeDay: vi.fn(),
  buttons: [] as { children?: React.ReactNode; onClick?: () => void; "data-testid"?: string }[],
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  childProfile: { id: "child-a", name: "Noa Levi", age: 2 }, milestones: [MILESTONE], behaviorLogs: [], playLogs: [],
  setMilestoneObservation: state.setMilestoneObservation, setActiveTab: state.setActiveTab,
}) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: "en", t: (key: string, vars?: Record<string, string | number>) => translate("en", key, vars) }) };
});
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: (_id: string, name: string) => ({ items: name === "screenings" ? state.recheck : [], loaded: true }) }));
vi.mock("../../lib/screeningWatch", () => ({ resolveWatchFocus: () => state.chosen, clearWatchFocus: (id: string) => state.clearWatchFocus(id) }));
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
beforeEach(() => { vi.clearAllMocks(); state.buttons = []; state.chosen = { ...MILESTONE }; state.recheck = []; });

describe("the parent's watch choice shows, and can be answered in place", () => {
  it("renders the chosen milestone with Seen it / Not sure / Not yet", () => {
    const html = renderToStaticMarkup(<PortraitWatchRow />);
    expect(html).toContain("Puts two words together");
    for (const status of ["yes", "not_sure", "not_yet"]) expect(byTestId(`portrait-observe-${status}`), status).toBeDefined();
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
});
