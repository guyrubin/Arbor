import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { COMPANION_PLACES, backTargetFor, placeForTab } from "../../lib/companionPlaces";
import { translate } from "../../lib/i18n";
import { PARENT_RECORD_COPY } from "../companion/parentRecordCopy";

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he", activeTab: "timeline", setActiveTab: vi.fn(),
  buttons: [] as { children?: React.ReactNode; onClick?: () => void; "data-testid"?: string; "aria-current"?: string; "data-more-destination"?: string }[],
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  childProfile: { id: "child-a", name: "Noa", age: 5 }, activeTab: state.activeTab, setActiveTab: state.setActiveTab,
  milestones: [], actionPlans: [], pendingReviewCount: 2, behaviorLogs: [], playLogs: [], openCaptureSheet: vi.fn(),
  memoryReviewItems: [{ memoryId: "kept", fact: "Enjoys building towers", status: "approved" }],
  pendingMemoryItems: [{ memoryId: "pending-1", fact: "Asks for the blue cup", status: "pending" }, { memoryId: "pending-2", fact: "Enjoys drawing together", status: "pending" }],
}) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("../../hooks/useTimeline", () => ({ useTimeline: () => [
  { id: "moment-1", kind: "moment", at: "2026-10-01T10:00:00Z", refTitle: "Built a tower", tone: "mint" },
  { id: "milestone-1", kind: "milestone", at: "2026-09-01T10:00:00Z", refTitle: "Shares a story", tone: "lav" },
] }));
vi.mock("../../lib/pulse", () => ({ usePulses: () => ({ profile: { key: "WRONG_MEMORY_COUNT" } }) }));
vi.mock("../../lib/native", () => ({ selectionHaptic: vi.fn() }));
vi.mock("./Sidebar", () => ({ badgeText: () => "" }));
vi.mock("./SafetyRing", () => ({ default: () => null }));
vi.mock("./KidModeButton", () => ({ default: () => null }));
vi.mock("../search/SearchModal", () => ({ requestOpenSearch: vi.fn() }));
vi.mock("../ui/Sheet", () => ({ Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
const capture = vi.hoisted(() => (type: unknown, props: unknown) => {
  if (type === "button" && props && typeof props === "object") state.buttons.push(props as typeof state.buttons[number]);
});
vi.mock("react/jsx-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return { ...runtime, jsx: (...a: Parameters<typeof runtime.jsx>) => { capture(a[0], a[1]); return runtime.jsx(...a); }, jsxs: (...a: Parameters<typeof runtime.jsxs>) => { capture(a[0], a[1]); return runtime.jsxs(...a); } };
});
vi.mock("react/jsx-dev-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...a: Parameters<typeof runtime.jsxDEV>) => { capture(a[0], a[1]); return runtime.jsxDEV(...a); } };
});
import MobileNav from "./MobileNav";
import StoryTimelineTab from "../tabs/StoryTimelineTab";

beforeEach(() => { vi.clearAllMocks(); state.lang = "en"; state.activeTab = "timeline"; state.buttons = []; });
const buttonWithText = (text: string) => state.buttons.find(button => renderToStaticMarkup(<>{button.children}</>).includes(text));

describe("record hierarchy keeps useful controls without repeating navigation or notes", () => {
  // v3 F-SHELL-3 (IA-03, critic ruling 14) re-pin — was "More distinguishes the
  // actual Profile and Memory destinations": the sheet's records and support
  // groups, and the Profile / Memory sub-lines that told two records apart, are
  // gone. The records section now holds the index of the three places under
  // their v3 pill names, and the destination set is that index, not the old
  // overflow hubs. #/memory is reached from My child and from About.
  it.each(["en", "he"] as const)("More indexes the three places under their v3 pill names in %s", lang => {
    state.lang = lang;
    const copy = PARENT_RECORD_COPY[lang];
    const html = renderToStaticMarkup(<MobileNav />);
    expect(html).not.toContain(copy.profileDetail);
    expect(html).not.toContain(copy.memoryDetail);
    expect(html).not.toContain("WRONG_MEMORY_COUNT");
    expect(html).not.toContain('aria-labelledby="more-support-heading"');
    expect(html).not.toContain(copy.toolsAndSupport);
    const records = html.match(/<section aria-labelledby="more-records-heading"[^>]*>[\s\S]*?<\/section>/)?.[0] ?? "";
    expect(records).toContain(copy.records);
    for (const place of COMPANION_PLACES) expect(records).toContain(`>${lang === "he" ? place.he : place.en}</h4>`);
    // No old hub name is an entry ("Stories" survives only as Together's pill).
    for (const hub of ["journal", "behaviors", "learn", "care"]) expect(records).not.toContain(`>${translate(lang, "nav.cat." + hub)}<`);
    expect(records).not.toContain(`>${copy.profile}<`);
    // The exact index, in place order, so a missing or newly added row cannot
    // slip through a hand-maintained list of examples.
    // v4 re-pin: Together reads Routines · Play · Stories (Play is f=games).
    const expectedDestinations = ["weekly", "development", "timeline", "profile", "practice?f=routines", "practice?f=games", "practice?f=stories"];
    const destinationButtons = state.buttons.filter(button => button["data-more-destination"]);
    expect(destinationButtons.map(button => button["data-more-destination"])).toEqual(expectedDestinations);
    for (const destination of expectedDestinations) {
      const button = destinationButtons.find(button => button["data-more-destination"] === destination)!;
      expect(button.onClick).toBeTypeOf("function");
      state.setActiveTab.mockClear();
      button.onClick?.();
      // A Together row opens #/practice with its filter through the hash query
      // (goToRoute, a no-op without a window); every other row opens its route.
      if (destination.includes("?")) expect(state.setActiveTab).not.toHaveBeenCalled();
      else expect(state.setActiveTab).toHaveBeenLastCalledWith(destination);
    }
    // The three primary places are still rendered and navigate unchanged.
    for (const tab of ["overview", "development", "practice"] as const) {
      const place = placeForTab(tab);
      buttonWithText(lang === "he" ? place.he : place.en)!.onClick?.();
      expect(state.setActiveTab).toHaveBeenLastCalledWith(tab);
    }
  });

  it.each(["en", "he"] as const)("Story keeps export, full records, filters and review access in %s", lang => {
    state.lang = lang;
    const html = renderToStaticMarkup(<StoryTimelineTab />);
    expect((html.match(/<h1[ >]/g) ?? []).length).toBe(1);
    for (const id of ["timeline-story-disclosure", "timeline-months-disclosure"]) {
      expect(html).toContain(`data-testid="${id}"`);
      expect(html).not.toMatch(new RegExp(`<details[^>]*open[^>]*data-testid="${id}"`));
    }
    expect(html).toContain("Enjoys building towers");
    expect(html).toContain("Built a tower");
    expect(html).toContain("Shares a story");
    expect(html).toContain('data-testid="timeline-filter-chips"');
    expect(html).not.toContain("Asks for the blue cup");
    expect(state.buttons.find(button => button["data-testid"] === "timeline-save-story")?.onClick).toBeTypeOf("function");
    state.buttons.find(button => button["data-testid"] === "timeline-memory-review")!.onClick?.();
    expect(state.setActiveTab).toHaveBeenLastCalledWith("memory");
  });

  // v3 F-SHELL-3 (IA-03) re-pin — was keyed on the profileDetail / memoryDetail
  // sub-lines, which are gone: the index has one About row, current on #/profile
  // only. #/memory is not an index row (the dock lights My child there).
  it.each(["en", "he"] as const)("More marks only the actual record destination as current in %s", lang => {
    state.lang = lang;
    for (const tab of ["profile", "memory", "timeline", "development", "weekly"] as const) {
      state.activeTab = tab;
      state.buttons = [];
      renderToStaticMarkup(<MobileNav />);
      const current = state.buttons.filter(button => button["data-more-destination"] && button["aria-current"] === "page").map(button => button["data-more-destination"]);
      expect(current, tab).toEqual(tab === "memory" ? [] : [tab]);
    }
  });

  it("secondary screens keep one Back control and all sibling destinations without the old overlap", () => {
    const shell = readFileSync(new URL("./Shell.tsx", import.meta.url), "utf8");
    expect(shell.match(/data-testid="secondary-place-back"/g)).toHaveLength(1);
    // v3 IA-01 re-pin (was `setActiveTab(placeForTab(activeTab).tab)`): Back returns
    // to the route's HOME, its place or its door, and a home's own route has none.
    // v4 re-pin: a pill of the place's own row (Weekly report, Moments, About) is a reading, not a level.
    expect(shell).toContain("const back = isCompanionHome(activeTab) || isPlaceReading(activeTab) ? null : backTargetFor(activeTab);");
    expect(shell).toContain("{back && <button data-testid=\"secondary-place-back\" onClick={() => setActiveTab(back.tab)}");
    expect(shell).toContain("pillRowFor(section, activeTab).map");
    expect(shell).not.toContain('t("nav.sub." + hubSubKey');
    const nav = shell.slice(shell.indexOf('data-testid="secondary-sibling-nav"'), shell.indexOf("{/* Secondary pages"));
    expect(nav).not.toContain("marginBlockStart:");
    expect(nav).toContain("top: 0");
    for (const [file, key] of [["../tabs/WeeklyTab.tsx", "elev.wk.back"], ["../sections/DayWindowsPanel.tsx", "dw.back"], ["../sections/SmartRemindersPanel.tsx", "elev.sr.back"]]) {
      expect(readFileSync(new URL(file, import.meta.url), "utf8")).not.toContain(`t("${key}")`);
    }
    for (const tab of ["weekly", "day-windows", "smart-reminders"] as const) {
      expect(placeForTab(tab).tab).toBe("overview");
      expect(backTargetFor(tab)?.tab).toBe("overview");
    }
  });
});
