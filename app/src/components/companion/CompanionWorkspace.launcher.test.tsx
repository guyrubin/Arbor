import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NOW_COPY } from "./nowViewCopy";

type Captured = { type: unknown; props: Record<string, any> };
const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he", chatInput: "", activeTab: "overview",
  nodes: [] as Captured[], openCaptureSheet: vi.fn(), openHardMomentNow: vi.fn(),
}));
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
import CompanionWorkspace, { revealLauncherObscuredControl } from "./CompanionWorkspace";

const render = (kidLocked = false) => renderToStaticMarkup(<CompanionWorkspace kidLocked={kidLocked}><main>Page content</main></CompanionWorkspace>);
const button = (label: string) => state.nodes.find(n => n.type === "button" && React.Children.toArray(n.props.children).includes(label))!.props;

beforeEach(() => { vi.clearAllMocks(); state.nodes = []; state.lang = "en"; state.chatInput = ""; state.activeTab = "overview"; });

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

  it("reserves the measured, responsive launcher height instead of a guessed fixed spacer", () => {
    const source = readFileSync(new URL("./CompanionWorkspace.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("./companionWorkspace.css", import.meta.url), "utf8");
    expect(source).toContain('workspace.style.setProperty("--companion-launcher-height", `${launcher.getBoundingClientRect().height}px`)');
    expect(source).toContain("new ResizeObserver(measure)");
    expect(css).toMatch(/padding-block-end: calc\(var\(--companion-launcher-height\) \+ var\(--companion-launcher-offset\) \+ 24px\)/);
    expect(css).toContain("env(safe-area-inset-bottom)");
    expect(css).toMatch(/\.companion-capture-options button \{[^}]*min-block-size: 48px/);
  });

  it("scrolls keyboard-focused page controls clear of the launcher only when they overlap it", () => {
    const scrollIntoView = vi.fn();
    const launcher = { getBoundingClientRect: () => ({ top: 680, bottom: 736, left: 16, right: 359 }) } as HTMLElement;
    const control = (top: number, bottom: number, left = 32, right = 300) => ({
      getBoundingClientRect: () => ({ top, bottom, left, right }), scrollIntoView,
    }) as unknown as HTMLElement;
    revealLauncherObscuredControl(control(690, 734), launcher);
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: "center", inline: "nearest", behavior: "auto" });
    scrollIntoView.mockClear();
    for (const visible of [control(500, 544), control(690, 734, 400, 600), control(800, 844)]) {
      revealLauncherObscuredControl(visible, launcher);
    }
    expect(scrollIntoView).not.toHaveBeenCalled();
    const source = readFileSync(new URL("./CompanionWorkspace.tsx", import.meta.url), "utf8");
    expect(source).toContain('main?.addEventListener("focusin", revealFocus)');
    expect(source).toContain('main?.removeEventListener("focusin", revealFocus)');
  });
});
