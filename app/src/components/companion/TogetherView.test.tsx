import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { StudioWorld } from "../practice/studioWorlds";
const state = vi.hoisted(() => ({
  childProfile: { id: "child-a", name: "Noa", age: 4, interests: [], activeGoals: [] },
  previewWorld: null as StudioWorld | null, lang: "en" as "en" | "he", loaded: true, failed: false, hasPlay: true,
  saveMoment: vi.fn(async () => true), setActiveTab: vi.fn(), requestKidMode: vi.fn(), buttons: [] as Record<string, any>[],
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return { ...real, useState: (initial: any) => real.useState(state.previewWorld && initial && typeof initial === "object" && "value" in initial ? { ...initial, value: { kind: "world", world: state.previewWorld } } : initial) };
});
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ ...state, activeFamilyTopic: null }) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: () => ({ items: [], loaded: state.loaded, error: state.failed }) }));
vi.mock("../../practice/usePracticeData", () => ({ usePracticeData: () => {
  const collection = { items: [], loaded: state.loaded, error: state.failed };
  return { speech: collection, mimic: collection, adventures: collection, events: collection, missions: collection };
} }));
vi.mock("../../lib/kidExitRecap", () => ({ SINCE_LAST_PLAY_FALLBACK_MS: 7 * 86400000, kidActivityLedgers: () => [], doorSinceSentence: () => state.hasPlay ? { before: "Noa played twice.", after: "" } : null }));
vi.mock("../../lib/kidModeGate", () => ({ lastKidSessionStartedAt: () => null }));
vi.mock("../kidmode/useKidModeEntry", () => ({ useKidModeEntry: () => ({ request: state.requestKidMode, step: null }) }));
vi.mock("../kidmode/parentGate", () => ({ readParentPin: () => null, shouldNudgeForPin: () => false, markPinNudgeShown: vi.fn() }));
vi.mock("../../lib/kpiEvents", () => ({ trackCompanionPlaceOpen: vi.fn(), trackPracticeStudioOpen: vi.fn(), trackPracticeTogetherDid: vi.fn() }));
vi.mock("../ui/Modal", () => ({ Modal: () => null }));
const capture = vi.hoisted(() => (type: unknown, props: unknown) => { if (type === "button") state.buttons.push(props as Record<string, any>); });
vi.mock("react/jsx-runtime", async (original) => {
  const real = await original<typeof import("react/jsx-runtime")>();
  return { ...real,
    jsx: (...args: Parameters<typeof real.jsx>) => { capture(args[0], args[1]); return real.jsx(...args); },
    jsxs: (...args: Parameters<typeof real.jsxs>) => { capture(args[0], args[1]); return real.jsxs(...args); },
  };
});
vi.mock("react/jsx-dev-runtime", async (original) => {
  const real = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...real, jsxDEV: (...args: Parameters<typeof real.jsxDEV>) => { capture(args[0], args[1]); return real.jsxDEV(...args); } };
});
import TogetherView from "./TogetherView";
import { readTogetherView, writeTogetherView } from "./togetherNavigation";
import { translate } from "../../lib/i18n";
import { STUDIO_WORLDS } from "../practice/studioWorlds";
beforeEach(() => {
  vi.clearAllMocks(); state.childProfile = { id: "child-a", name: "Noa", age: 4, interests: [], activeGoals: [] };
  state.previewWorld = null; state.lang = "en"; state.loaded = true; state.failed = false; state.hasPlay = true; state.buttons = [];
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
});
const render = () => renderToStaticMarkup(<TogetherView />);
function history(html: string) { return html.match(/<details[^>]*data-testid="together-play-history"[\s\S]*?<\/details>/)![0]; }
function section(html: string, name: string) { return html.match(new RegExp(`<section[^>]*data-module="${name}"[^>]*>`))![0]; }
describe("Together's compact discovery", () => {
  it.each(["en", "he"] as const)("shows the activity itself before any catalogue or handover in %s", (lang) => {
    state.lang = lang; const html = render();
    expect(html).toContain(`dir="${lang === "he" ? "rtl" : "ltr"}"`);
    expect(html).toContain(translate(lang, "companion.offscreen.build.title"));
    expect(html.indexOf("together-suggestion")).toBeLessThan(html.indexOf('data-testid="together-handover"'));
    expect(html.match(/data-primary-move=/g)).toHaveLength(1); expect(html.match(/data-module=/g)).toHaveLength(4);
    expect(html.split(translate(lang, "companion.offscreen.build.title"))).toHaveLength(2);
    expect(html).not.toContain(translate(lang, "companion.together-view.together-room-for-curiosity-and-connection"));
  });
  it("keeps the same closed recap summary before, during and after independent reads", () => {
    state.loaded = false; const pending = render();
    expect(history(pending)).toContain('aria-busy="true"'); expect(history(pending)).not.toContain('data-testid="together-since-keep"');
    state.loaded = true; const ready = render(); state.hasPlay = false; const empty = render(); state.failed = true; const failed = render();
    const summary = (html: string) => history(html).split('<div class="companion-since"')[0];
    expect(summary(pending)).toBe(summary(ready)); expect(summary(empty)).toBe(summary(ready)); expect(summary(failed)).toBe(summary(ready));
    expect(history(ready)).not.toMatch(/<details[^>]*\sopen(?:\s|=|>)/);
    expect(history(empty)).toContain(translate("en", "companion.portrait.noRecord"));
    expect(history(failed)).toContain(translate("en", "elev.sync.error").replaceAll("'", "&#x27;")); expect(history(failed)).not.toContain(translate("en", "companion.portrait.noRecord"));
  });
  it("opening the page never writes a record; keeping the recap is explicit", async () => {
    render(); expect(state.saveMoment).not.toHaveBeenCalled(); expect(state.requestKidMode).not.toHaveBeenCalled();
    await state.buttons.find((b) => b["data-testid"] === "together-since-keep")!.onClick();
    expect(state.saveMoment).toHaveBeenCalledWith("Noa played twice.", { callerShowsFailure: true });
    state.buttons.find((b) => b["data-testid"] === "together-handover")!.onClick(); expect(state.requestKidMode).toHaveBeenCalledOnce();
  });
  it("keeps the selected filter and original story destination after a route remount", () => {
    render(); state.buttons.find((b) => b.className === "companion-filter" && React.Children.toArray(b.children).includes("Stories"))!.onClick();
    state.buttons = []; const selected = render();
    expect(section(selected, "together-stories")).not.toContain("hidden"); expect(section(selected, "together-games")).toContain("hidden"); expect(section(selected, "together-offscreen")).toContain("hidden");
    state.buttons.find((b) => b["data-together-return"] === "story-comics")!.onClick();
    expect(state.setActiveTab).toHaveBeenCalledWith("comics"); expect(readTogetherView("child-a", true)).toEqual({ category: "stories", returnDoor: "story-comics" });
    expect(section(render(), "together-stories")).not.toContain("hidden");
    state.childProfile.id = "child-b"; expect(section(render(), "together-games")).not.toContain("hidden");
  });
  it.each([["en", "word-world", "language"], ["he", "speech", "speech"]] as const)("returns to the chosen %s %s card after its parent tool", (lang, id, tab) => {
    state.lang = lang; state.childProfile.age = 6; state.previewWorld = STUDIO_WORLDS.find((world) => world.id === id)!;
    writeTogetherView("child-a", { category: "games" }); const html = render();
    expect(html).toContain(`data-together-return="world-${id}"`);
    const open = state.buttons.find((button) => button.className === "companion-primary" && React.Children.toArray(button.children).includes(translate(lang, "companion.together-view.open")));
    expect(open).toBeDefined(); open!.onClick();
    expect(state.setActiveTab).toHaveBeenCalledWith(tab); expect(readTogetherView("child-a", true)).toEqual({ category: "games", returnDoor: `world-${id}` });
  });
  it("keeps age gates after restoring an obsolete games choice", () => {
    writeTogetherView("child-a", { category: "games" }); state.childProfile.age = 2; const html = render();
    expect(html).not.toContain('data-testid="together-handover"'); expect(html).not.toContain('data-module="together-games"'); expect(html).not.toContain('data-testid="together-play-history"');
    expect(html).toContain(translate("en", "elev.ages.together.copy-faces.title")); expect(section(html, "together-stories")).not.toContain("hidden");
  });
  it("uses real content-width queries, stable recap space and no clipped activity copy", () => {
    const css = readFileSync(new URL("./togetherDiscovery.css", import.meta.url), "utf8");
    expect(css).toContain("container-name: together"); expect(css).toContain("@container together (max-width: 540px)");
    expect(css).toMatch(/@container together[\s\S]*\.companion-story-grid \{ grid-template-columns: minmax\(0, 1fr\)/);
    expect(css).toMatch(/\.together-play-history \.companion-since[^}]*min-block-size: 9rem/);
    expect(css).not.toMatch(/line-clamp|text-overflow|overflow:\s*hidden/);
    expect(css.match(/font-family:/g)).toHaveLength(1);
    expect(css).toMatch(/\.companion-together \.companion-say \{ font-family: var\(--font-sans\); font-size: var\(--t-base\); font-style: normal; line-height: 1\.6;/);
  });
});
