import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NOW_COPY } from "./nowViewCopy";

type Captured = { type: unknown; props: Record<string, any> };
const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he", chatInput: "", activeTab: "overview",
  nodes: [] as Captured[], effects: [] as Array<() => void | (() => void)>, openCaptureSheet: vi.fn(), openHardMomentNow: vi.fn(),
}));
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return { ...react, useEffect: (effect: () => void | (() => void)) => { state.effects.push(effect); } };
});
vi.mock("../../lib/kpiEvents", () => ({ trackCompanionPanelOpen: vi.fn() }));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  ...state, childProfile: { id: "child-a", name: "Noa", age: 4 }, activeFamilyTopic: null,
  setActiveTab: vi.fn(), setChatInput: vi.fn(),
}) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string) => translate(state.lang, key) }) };
});
vi.mock("react/jsx-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  const capture = (type: unknown, props: unknown) => {
    if (typeof type === "string" && props) state.nodes.push({ type, props: props as Record<string, any> });
  };
  return {
    ...runtime,
    jsx: (...args: Parameters<typeof runtime.jsx>) => { capture(args[0], args[1]); return runtime.jsx(...args); },
    jsxs: (...args: Parameters<typeof runtime.jsxs>) => { capture(args[0], args[1]); return runtime.jsxs(...args); },
  };
});
vi.mock("react/jsx-dev-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...args: Parameters<typeof runtime.jsxDEV>) => {
    if (typeof args[0] === "string" && args[1]) state.nodes.push({ type: args[0], props: args[1] as Record<string, any> });
    return runtime.jsxDEV(...args);
  } };
});
import CompanionWorkspace from "./CompanionWorkspace";
import { trackCompanionPanelOpen } from "../../lib/kpiEvents";

const render = (kidLocked = false) => renderToStaticMarkup(<CompanionWorkspace kidLocked={kidLocked}><main>Page content</main></CompanionWorkspace>);
const button = (label: string) => state.nodes.find(n => n.type === "button" && React.Children.toArray(n.props.children).includes(label))!.props;

beforeEach(() => { vi.clearAllMocks(); state.nodes = []; state.effects = []; state.lang = "en"; state.chatInput = ""; state.activeTab = "overview"; });

afterEach(() => { vi.unstubAllGlobals(); });

describe("the compact, single global Ask and capture entry", () => {
  it.each(["en", "he"] as const)("keeps all three explicit capture modes and a concise Ask label (%s)", lang => {
    state.lang = lang;
    const copy = NOW_COPY[lang];
    const html = render();
    expect(html).toContain(copy.talk);
    expect(html).not.toContain("What would you like to share?");
    expect(html).not.toContain("<small>");
    expect(html).toContain('class="companion-capture-menu"');
    expect(html).not.toMatch(/<details[^>]*\bopen(?:=|>)/);
    expect(html).toContain(copy.quickSave);
    for (const label of [copy.write, copy.dictate, copy.photo]) button(label).onClick();
    expect(state.openCaptureSheet.mock.calls.map(([args]) => args.mode)).toEqual(["text", "voice", "photo"]);
  });

  it("closes the choices and restores the visible summary before opening a capture sheet", () => {
    render();
    const menu = state.nodes.find(n => n.type === "details")!.props;
    const summary = state.nodes.find(n => n.type === "summary")!.props;
    const focus = vi.fn();
    menu.ref.current = { open: true };
    summary.ref.current = { focus };
    button(NOW_COPY.en.photo).onClick();
    expect(menu.ref.current.open).toBe(false);
    expect(focus).toHaveBeenCalledOnce();
    expect(focus.mock.invocationCallOrder[0]).toBeLessThan(state.openCaptureSheet.mock.invocationCallOrder[0]);
  });

  it("Escape closes only the capture choices and returns focus to the summary", () => {
    render();
    const menu = state.nodes.find(n => n.type === "details")!.props;
    const summary = state.nodes.find(n => n.type === "summary")!.props;
    const focus = vi.fn(), stopPropagation = vi.fn();
    menu.ref.current = { open: true };
    summary.ref.current = { focus };
    menu.onKeyDown({ key: "Escape", stopPropagation });
    expect(menu.ref.current.open).toBe(false);
    expect(focus).toHaveBeenCalledOnce();
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(state.openCaptureSheet).not.toHaveBeenCalled();
  });

  it("retains a draft invitation and hides every parent launcher control in Kid Mode", () => {
    state.chatInput = "A question in progress";
    expect(render()).toContain("Continue your draft");
    state.nodes = [];
    expect(render(true)).not.toContain('data-testid="companion-launcher"');
    expect(state.nodes.some(n => n.type === "summary")).toBe(false);
  });

  it("keeps the rail outside main, so page controls cannot scroll behind it", () => {
    render();
    const workspace = state.nodes.find(n => String(n.props.className).startsWith("companion-workspace"))!;
    const children = React.Children.toArray(workspace.props.children) as React.ReactElement<any>[];
    expect(children.some(child => child.type === "main")).toBe(true);
    const rail = children.find(child => child.props["data-testid"] === "companion-launcher-rail");
    expect(rail).toBeDefined();
    expect(rail!.props.children.props["data-testid"]).toBe("companion-launcher");
    expect(render(true)).not.toContain('data-testid="companion-launcher-rail"');
  });

  it("Ask closes Keep choices and opens the existing conversation callback", () => {
    render();
    const menu = state.nodes.find(n => n.type === "details")!.props;
    menu.ref.current = { open: true };
    const ask = state.nodes.find(n => n.props.className === "companion-launch-main")!.props;
    ask.onClick();
    expect(menu.ref.current.open).toBe(false);
    expect(trackCompanionPanelOpen).toHaveBeenCalledExactlyOnceWith("launcher");
    ask.onClick();
    expect(trackCompanionPanelOpen).toHaveBeenCalledOnce();
    expect(state.openCaptureSheet).not.toHaveBeenCalled();
  });

  it.each(["en", "he"] as const)("keeps the hard-moment callback on secondary pages (%s)", lang => {
    state.lang = lang;
    state.activeTab = "milestones";
    render();
    const hardMoment = state.nodes.find(n => n.props["data-testid"] === "launcher-hard-moment");
    expect(hardMoment).toBeDefined();
    hardMoment!.props.onClick();
    expect(state.openHardMomentNow).toHaveBeenCalledOnce();
    expect(state.openCaptureSheet).not.toHaveBeenCalled();
  });

  it("remeasures actual launcher and nav boxes after wrapping, safe-area and viewport changes", () => {
    render();
    const workspace = state.nodes.find(n => String(n.props.className).startsWith("companion-workspace"))!.props;
    const launcher = state.nodes.find(n => n.props["data-testid"] === "companion-launcher")!.props;
    let launcherHeight = 54, navigationHeight = 65;
    const setProperty = vi.fn();
    const navElement = { getBoundingClientRect: () => ({ height: navigationHeight }) };
    const launchElement = { getBoundingClientRect: () => ({ height: launcherHeight }) };
    const querySelector = vi.fn(() => navElement);
    workspace.ref.current = { style: { setProperty }, closest: vi.fn(() => ({ querySelector })) };
    launcher.ref.current = launchElement;
    const addEventListener = vi.fn(), removeEventListener = vi.fn(), observe = vi.fn(), disconnect = vi.fn();
    let resized: () => void = () => {};
    vi.stubGlobal("window", { addEventListener, removeEventListener });
    vi.stubGlobal("document", { addEventListener, removeEventListener });
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { resized = callback; }
      observe = observe;
      disconnect = disconnect;
    });
    const effect = state.effects.find(effect => String(effect).includes("--companion-launcher-height"));
    expect(effect).toBeDefined();
    const cleanup = effect!();
    expect(querySelector).toHaveBeenCalledWith(":scope > nav");
    expect(observe.mock.calls.map(([element]) => element)).toEqual([launchElement, navElement]);
    expect(setProperty).toHaveBeenCalledWith("--companion-launcher-height", "54px");
    expect(setProperty).toHaveBeenCalledWith("--companion-navigation-height", "65px");
    launcherHeight = 92;
    navigationHeight = 99; // Actual box includes a 34px safe-area inset.
    resized();
    expect(setProperty).toHaveBeenCalledWith("--companion-launcher-height", "92px");
    expect(setProperty).toHaveBeenCalledWith("--companion-navigation-height", "99px");
    launcherHeight = 54;
    navigationHeight = 0; // Nav is display:none at the desktop breakpoint.
    addEventListener.mock.calls.find(([event]) => event === "resize")![1]();
    expect(setProperty).toHaveBeenCalledWith("--companion-launcher-height", "54px");
    expect(setProperty).toHaveBeenCalledWith("--companion-navigation-height", "0px");
    if (typeof cleanup === "function") cleanup();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(removeEventListener.mock.calls.map(([event]) => event)).toEqual(["resize", "pointerdown"]);
  });
});

const css = readFileSync(new URL("./companionWorkspace.css", import.meta.url), "utf8");
const shell = readFileSync(new URL("../layout/Shell.tsx", import.meta.url), "utf8");
const rule = (source: string, selector: string) => source.slice(source.indexOf(selector + " {")).split("}")[0];
const separateScrollport = (source: string) =>
  /grid-template-rows: minmax\(0,1fr\) auto/.test(rule(source, ".companion-workspace")) &&
  /overflow-y: auto/.test(rule(source, ".companion-workspace > main")) &&
  /grid-row: 1/.test(rule(source, ".companion-workspace > main")) &&
  /grid-row: 2/.test(rule(source, ".companion-launcher-rail")) &&
  /position: relative/.test(rule(source, ".companion-launcher")) &&
  !/position: (fixed|absolute)/.test(rule(source, ".companion-launcher"));

describe("launcher non-overlap layout contract (rendered acceptance remains required)", () => {
  it("uses independent content and intrinsic launcher rows without sidebar-offset guesses", () => {
    expect(separateScrollport(css)).toBe(true);
    expect(rule(css, ".companion-launcher-rail")).not.toMatch(/(?:block-size|height):/);
    expect(css).not.toContain("--companion-launcher-offset");
    expect(css).not.toMatch(/inset-inline-start:\s*(264|296)px/);
    expect(css).toContain("var(--companion-navigation-height, calc(65px + env(safe-area-inset-bottom)))");
    expect(css).toMatch(/@media \(min-width: 1024px\) \{ \.companion-workspace \{ padding-block-end: 0;/);
    expect(css).toContain("scroll-padding-block-end: calc(var(--companion-launcher-height) + 24px)");
    expect(css).toMatch(/\.companion-capture-options button \{[^}]*min-block-size: 48px/);
  });

  it("rejects the shipped fixed overlay plus bottom-padding workaround and missing scroll boundary", () => {
    const original = `.companion-workspace { display: grid; grid-template-columns: minmax(0,1fr); }
.companion-workspace > main { padding-block-end: calc(var(--companion-launcher-height) + var(--companion-launcher-offset) + 24px); }
.companion-launcher { position: fixed; inset-block-end: var(--companion-launcher-offset); }`;
    expect(separateScrollport(original)).toBe(false);
    expect(separateScrollport(css.replace("position: relative; z-index: 29", "position: fixed; z-index: 29"))).toBe(false);
    expect(separateScrollport(css.replace("grid-row: 2", "grid-row: 1"))).toBe(false);
    expect(separateScrollport(css.replace("overflow-y: auto", "overflow-y: visible"))).toBe(false);
    expect(separateScrollport(css.replace("grid-template-rows: minmax(0,1fr) auto", "grid-template-rows: auto"))).toBe(false);
  });

  it("keeps the sidebar within the dynamic-height parent track with its own scrolling", () => {
    const sidebar = readFileSync(new URL("../layout/Sidebar.tsx", import.meta.url), "utf8");
    const sidebarIsBounded = (source: string) => {
      const classes = /<aside[\s\S]*?className="([^"]+)"/.exec(source)?.[1] ?? "";
      return /\bh-full\b/.test(classes) && /\bmin-h-0\b/.test(classes) &&
        /\boverflow-y-auto\b/.test(classes) && !/\bh-screen\b/.test(classes);
    };
    expect(sidebarIsBounded(sidebar)).toBe(true);
    // The shipped 100vh sidebar can exceed the shell's 100dvh grid row.
    expect(sidebarIsBounded(sidebar.replace("h-full min-h-0", "h-screen"))).toBe(false);
    expect(sidebarIsBounded(sidebar.replace("h-full min-h-0", "h-full min-h-0 lg:h-screen"))).toBe(false);
    expect(sidebarIsBounded(sidebar.replace("min-h-0", ""))).toBe(false);
    expect(sidebarIsBounded(sidebar.replace("overflow-y-auto", "overflow-y-visible"))).toBe(false);
  });

  it("bounds the Shell at phone and desktop widths and keeps dock/modal geometry intact", () => {
    const shellIsBounded = (source: string) =>
      /className="arbor-app h-dvh [^"]*overflow-hidden/.test(source) &&
      /className="page-shell [^"]*grid-rows-\[minmax\(0,1fr\)\] h-full min-h-0/.test(source) &&
      /className="flex flex-col min-h-0 min-w-0 h-full overflow-hidden"/.test(source);
    expect(shellIsBounded(shell)).toBe(true);
    expect(shellIsBounded(shell.replace("arbor-app h-dvh", "arbor-app min-h-screen"))).toBe(false);
    expect(shellIsBounded(shell.replace("min-w-0 h-full", "min-w-0 lg:h-screen"))).toBe(false);
    expect(css).toContain(".companion-workspace.is-open:not(.is-expanded) { grid-template-columns: minmax(0,1fr) minmax(440px,46%);");
    expect(css).toContain(".companion-conversation { grid-row: 1; grid-column: 2; position: relative;");
    expect(css).toContain(".companion-workspace.is-expanded .companion-conversation { position: fixed;");
    expect(rule(css, ".companion-workspace")).not.toMatch(/(?:z-index|transform|isolation|contain):/);
  });
});
