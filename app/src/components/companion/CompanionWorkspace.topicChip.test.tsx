import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * FEAT-01 — the Ask Arbor bar on every screen. The bar carries the active
 * family question as one quiet caption line, "On: <question>" (FEAT-05 owns the chip that opens
 * the question sheet; the bar consumes it and never adds a second door), and
 * the conversation header gathers its options in one menu whose items reach
 * controls that already exist.
 */
type Captured = { type: unknown; props: Record<string, any> };
const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he", chatInput: "", activeTab: "overview",
  topic: null as null | { id: string; title: string },
  nodes: [] as Captured[], effects: [] as Array<() => void | (() => void)>,
  // Forces the options menu's own open flag (its only useState(false)).
  forceOpen: false, setOpen: vi.fn(),
  setActiveTab: vi.fn(), setChatInput: vi.fn(), newConversation: vi.fn(), openCaptureSheet: vi.fn(), openHardMomentNow: vi.fn(),
}));
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return {
    ...react,
    lazy: () => () => null,
    useEffect: (effect: () => void | (() => void)) => { state.effects.push(effect); },
    useState: (initial: any) => (state.forceOpen && initial === false ? [true, state.setOpen] : react.useState(initial)),
  };
});
vi.mock("../../lib/kpiEvents", () => ({ trackCompanionPanelOpen: vi.fn() }));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  activeTab: state.activeTab, chatInput: state.chatInput, activeFamilyTopic: state.topic,
  childProfile: { id: "child-a", name: "Noa", age: 4 },
  setActiveTab: state.setActiveTab, setChatInput: state.setChatInput, newConversation: state.newConversation,
  openCaptureSheet: state.openCaptureSheet, openHardMomentNow: state.openHardMomentNow,
}) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string) => translate(state.lang, key) }) };
});
vi.mock("react/jsx-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  const capture = (type: unknown, props: unknown) => { if (props) state.nodes.push({ type, props: props as Record<string, any> }); };
  return {
    ...runtime,
    jsx: (...args: Parameters<typeof runtime.jsx>) => { capture(args[0], args[1]); return runtime.jsx(...args); },
    jsxs: (...args: Parameters<typeof runtime.jsxs>) => { capture(args[0], args[1]); return runtime.jsxs(...args); },
  };
});
vi.mock("react/jsx-dev-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...args: Parameters<typeof runtime.jsxDEV>) => {
    if (args[1]) state.nodes.push({ type: args[0], props: args[1] as Record<string, any> });
    return runtime.jsxDEV(...args);
  } };
});
import CompanionWorkspace from "./CompanionWorkspace";
import CompanionPanelMenu, { companionPanelItems } from "./CompanionPanelMenu";
import { translate } from "../../lib/i18n";
import { COMPANION_CONVERSATION_EVENT, CONVERSATION_VOICE_REQUEST_TTL_MS, consumeConversationPanelRequest, consumeConversationVoiceRequest, requestCompanionConversation } from "../../lib/companionConversation";

const TOPIC = { id: "topic-a", title: "How could mornings feel easier?" };
const renderWorkspace = (kidLocked = false) => renderToStaticMarkup(<CompanionWorkspace kidLocked={kidLocked}><main>Page content</main></CompanionWorkspace>);
const renderMenu = (overrides: any = {}) => renderToStaticMarkup(<CompanionPanelMenu uiLang={state.lang} panelVisible wide={false} expanded={false} onSelect={vi.fn()} {...overrides} />);
const node = (match: (n: Captured) => boolean) => state.nodes.find(match);
const caption = () => node(n => n.props.className === "companion-launch-topic");
const ask = () => node(n => n.type === "button" && n.props.className === "companion-launch-main")!.props;
const trigger = () => node(n => n.type === "button" && n.props["data-testid"] === "companion-panel-menu")!.props;
const menu = () => node(n => n.type === "div" && n.props.role === "menu")!.props;
const wrap = () => node(n => n.type === "div" && n.props.className === "companion-panel-menu-wrap")!.props;
const menuItems = () => state.nodes.filter(n => n.type === "button" && n.props.role === "menuitem");
const textOf = (html: string) => html.replace(/<[^>]+>/g, "");
const shipped = new Set(readFileSync(new URL("../../../public/fonts/material-symbols-rounded-subset.icons.txt", import.meta.url), "utf8")
  .split("\n").map(line => line.trim()).filter(line => line && !line.startsWith("#")));

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(state, { lang: "en", chatInput: "", activeTab: "overview", topic: null, nodes: [], effects: [], forceOpen: false });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("FEAT-01 — the Ask bar carries the active question as one quiet line", () => {
  it.each(["en", "he"] as const)("renders the caption as a span inside Ask reading 'On: <question>', text only (%s)", lang => {
    state.lang = lang; state.topic = TOPIC;
    const html = renderWorkspace();
    const line = caption();
    expect(line?.type).toBe("span");
    expect(line!.props.id).toBe("companion-launch-topic");
    expect(line!.props.onClick).toBeUndefined();
    expect(ask()["aria-describedby"]).toBe("companion-launch-topic");
    // F-TALK-1 re-pin: the bar's name is its visible label, "Ask Arbor - text, photo or voice".
    expect(ask()["aria-label"]).toBe(translate(lang, "companion.launcher.label"));
    expect(node(n => n.props.className === "companion-launch-copy")!.props.children[0]).toBe(translate(lang, "companion.launcher.label"));
    const words = node(n => n.props.className === "companion-launch-topic-text")!;
    expect(words.type).toBe("bdi");
    expect(words.props.dir).toBe("auto");
    expect(words.props.children).toBe(TOPIC.title);
    // The visible line is the translated "On: {title}" with the words in their
    // own bdi: no glyph, no screen-reader-only prefix, never a count, dot or badge.
    const template = translate(lang, "companion.launcher.topic");
    expect(template).toContain("{title}");
    expect(template.split("{title}")[0].trim().length).toBeGreaterThan(0);
    expect(line!.props.children[0]).toBe(template.split("{title}")[0]);
    const markup = html.match(/<span id="companion-launch-topic"[\s\S]*?<\/bdi><\/span>/)?.[0] ?? "";
    expect(textOf(markup)).toBe(template.replace("{title}", TOPIC.title));
    expect(markup).not.toMatch(/sr-only|class="msr/);
    expect(textOf(markup)).not.toMatch(/\d/);
    expect(html).not.toContain("<small");
    // B-ASKJB-39: the hard-moment door stays off the overview, question or not.
    expect(html).not.toContain('data-testid="launcher-hard-moment"');
  });

  it("is absent without a question, for a blank question, beside a draft and in Kid Mode", () => {
    renderWorkspace();
    expect(caption()).toBeUndefined();
    expect(ask()["aria-describedby"]).toBeUndefined();

    state.topic = { id: "topic-b", title: "   " }; state.nodes = [];
    renderWorkspace();
    expect(caption()).toBeUndefined();

    state.topic = TOPIC; state.chatInput = "A question in progress"; state.nodes = [];
    let html = renderWorkspace();
    expect(html).toContain(translate("en", "companion.input.continue-your-draft"));
    expect(caption()).toBeUndefined();
    expect(html).not.toContain(TOPIC.title);

    state.chatInput = ""; state.nodes = [];
    html = renderWorkspace(true);
    expect(html).not.toContain('data-testid="companion-launcher"');
    expect(html).not.toContain(TOPIC.title);
    expect(caption()).toBeUndefined();
  });

  it("consumes FEAT-05's chip and never duplicates it: one chip, in the conversation header only", () => {
    state.topic = TOPIC;
    expect(renderWorkspace()).not.toContain('data-testid="conversation-topic-chip"');
    state.activeTab = "coach"; state.nodes = [];
    const html = renderWorkspace();
    expect(html.split('data-testid="conversation-topic-chip"').length - 1).toBe(1);
    const source = readFileSync(new URL("./CompanionWorkspace.tsx", import.meta.url), "utf8");
    expect(source.split("openFamilyTopicSheet(").length - 1).toBe(1);
  });
});

describe("FEAT-01 — the conversation header's options menu", () => {
  it.each(["en", "he"] as const)("is one closed menu button before Close; Expand lives inside it (%s)", lang => {
    state.lang = lang; state.activeTab = "coach"; state.topic = TOPIC;
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    const html = renderWorkspace();
    const button = trigger();
    expect(button["aria-haspopup"]).toBe("menu");
    expect(button["aria-expanded"]).toBe(false);
    expect(button["aria-controls"]).toBeUndefined();
    expect(button["aria-label"]).toBe(translate(lang, "companion.panel.menu"));
    expect(button.className).toBe("companion-chrome-button");
    expect(html).not.toContain('role="menu"');
    // F-TALK-1 re-pin: a conversation route opens the panel docked beside the
    // place (never expanded over it), so the menu offers Expand.
    expect(node(n => n.type === CompanionPanelMenu)!.props).toMatchObject({ wide: true, expanded: false, panelVisible: true });
    for (const key of ["companion.input.expand-conversation", "companion.input.show-beside-the-page"]) {
      expect(state.nodes.some(n => n.type === "button" && n.props["aria-label"] === translate(lang, key)), key).toBe(false);
    }
    const close = html.indexOf(translate(lang, "companion.input.close-conversation-and-return-to-the-page"));
    expect(close).toBeGreaterThan(-1);
    expect(html.indexOf('data-testid="companion-panel-menu"')).toBeLessThan(close);
  });

  it("each choice reaches a control that already exists, and none sends a message", () => {
    state.activeTab = "coach";
    renderWorkspace();
    const { onSelect } = node(n => n.type === CompanionPanelMenu)!.props;
    const door = new EventTarget();
    const heard = vi.fn();
    door.addEventListener(COMPANION_CONVERSATION_EVENT, heard);
    vi.stubGlobal("window", door);

    onSelect("new");
    expect(state.newConversation).toHaveBeenCalledOnce();
    expect(heard).not.toHaveBeenCalled();

    onSelect("tone");
    onSelect("history");
    expect(heard.mock.calls.map(([event]) => (event as CustomEvent).detail)).toEqual([
      { panel: "tone", source: "panel-menu" },
      { panel: "history", source: "panel-menu" },
    ]);

    onSelect("remembers");
    expect(state.setActiveTab).toHaveBeenCalledExactlyOnceWith("memory");

    onSelect("widen");
    expect(state.newConversation).toHaveBeenCalledOnce();
    expect(state.setActiveTab).toHaveBeenCalledOnce();
    expect(heard).toHaveBeenCalledTimes(2);
    expect(state.setChatInput).not.toHaveBeenCalled();
    expect(state.openCaptureSheet).not.toHaveBeenCalled();
  });

  it("lists four items, and a fifth (expand / show beside) only where the panel can dock", () => {
    expect(companionPanelItems({ wide: false, expanded: false }).map(item => item.id)).toEqual(["new", "history", "tone", "remembers"]);
    expect(companionPanelItems({ wide: false, expanded: true })).toHaveLength(4);
    const docked = companionPanelItems({ wide: true, expanded: false });
    expect(docked.map(item => item.id)).toEqual(["new", "history", "tone", "remembers", "widen"]);
    expect(docked[4]).toMatchObject({ icon: "fullscreen", labelKey: "companion.input.expand-conversation" });
    expect(companionPanelItems({ wide: true, expanded: true })[4]).toMatchObject({ icon: "expand_less", labelKey: "companion.input.show-beside-the-page" });
  });

  it("draws every glyph from the shipped icon subset", () => {
    const icons = [...companionPanelItems({ wide: true, expanded: false }), ...companionPanelItems({ wide: true, expanded: true })].map(item => item.icon);
    for (const name of [...icons, "more_horiz"]) expect(shipped.has(name), name).toBe(true);
  });

  it.each(["en", "he"] as const)("labels the menu, every item and the caption in %s (Hebrew without Latin)", lang => {
    const items = [...companionPanelItems({ wide: true, expanded: false }), ...companionPanelItems({ wide: true, expanded: true })];
    // F-TALK-1: the items' second lines are held to the same rules.
    const subs = items.flatMap(item => item.subKey ? [item.subKey] : []);
    expect(subs).toEqual(expect.arrayContaining(["companion.panel.new.sub", "companion.panel.history.sub", "companion.panel.remembers.sub"]));
    const keys = [...new Set(["companion.panel.menu", "companion.launcher.topic", ...items.map(item => item.labelKey), ...subs])];
    for (const key of keys) {
      // A placeholder ({title}) is the only Latin a Hebrew value may carry.
      const label = translate(lang, key).replace(/\{\w+\}/g, "");
      expect(label.trim().length, key).toBeGreaterThan(0);
      expect(label, key).not.toBe(key);
      expect(label, key).not.toMatch(/\d/);
      if (lang === "he") expect(label, key).not.toMatch(/[A-Za-z]/);
    }
  });

  it.each([[false, 4], [true, 5]] as const)("open beside wide=%s it is role=menu with %i menuitems, text only", (wide, count) => {
    state.forceOpen = true;
    const html = renderMenu({ wide });
    expect(html.match(/role="menu"/g)).toHaveLength(1);
    expect(html.match(/role="menuitem"/g)).toHaveLength(count);
    expect(trigger()["aria-expanded"]).toBe(true);
    expect(trigger()["aria-controls"]).toBe(menu().id);
    expect(menu()["aria-label"]).toBe(translate("en", "companion.panel.menu"));
    const items = menuItems();
    expect(items).toHaveLength(count);
    for (const item of items) {
      expect(item.props.tabIndex).toBe(-1);
      expect(item.props.className).toBe("companion-panel-menu-item");
    }
    // Glyph names and words only: never a count, a dot or a badge.
    expect(textOf(html.slice(html.indexOf(">", html.indexOf('role="menu"')) + 1))).not.toMatch(/\d/);
  });

  it("Escape closes only the menu and returns focus to its button", () => {
    state.forceOpen = true;
    const onSelect = vi.fn();
    renderMenu({ onSelect });
    vi.stubGlobal("document", { activeElement: null });
    const focus = vi.fn();
    trigger().ref.current = { focus };
    const preventDefault = vi.fn(), stopPropagation = vi.fn();
    menu().onKeyDown({ key: "Escape", preventDefault, stopPropagation });
    // Handled here, so the panel's own Escape (a dialog below 1280 px) stays put.
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(state.setOpen).toHaveBeenCalledExactlyOnceWith(false);
    expect(focus).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("Arrow keys, Home and End move focus through the items and wrap; Tab only closes", () => {
    state.forceOpen = true;
    renderMenu();
    const items = [0, 1, 2, 3].map(() => ({ focus: vi.fn() }));
    const doc = { activeElement: items[0] as unknown };
    vi.stubGlobal("document", doc);
    const focus = vi.fn();
    trigger().ref.current = { focus };
    const list = menu();
    list.ref.current = { querySelectorAll: () => items };
    const press = (key: string) => { const preventDefault = vi.fn(); list.onKeyDown({ key, preventDefault, stopPropagation: vi.fn() }); return preventDefault; };
    expect(press("ArrowDown")).toHaveBeenCalledOnce();
    expect(items[1].focus).toHaveBeenCalledOnce();
    press("ArrowUp");
    expect(items[3].focus).toHaveBeenCalledOnce();
    doc.activeElement = items[3];
    press("ArrowDown");
    expect(items[0].focus).toHaveBeenCalledOnce();
    press("Home");
    expect(items[0].focus).toHaveBeenCalledTimes(2);
    press("End");
    expect(items[3].focus).toHaveBeenCalledTimes(2);
    expect(state.setOpen).not.toHaveBeenCalled();
    expect(press("Tab")).not.toHaveBeenCalled();
    expect(state.setOpen).toHaveBeenCalledExactlyOnceWith(false);
    expect(focus).not.toHaveBeenCalled();
  });

  it("the button toggles the menu, and Arrow Down or Up opens it", () => {
    state.forceOpen = true;
    renderMenu();
    const button = trigger();
    button.onClick();
    const toggle = state.setOpen.mock.calls[0][0];
    expect(typeof toggle).toBe("function");
    expect(toggle(true)).toBe(false);
    expect(toggle(false)).toBe(true);
    state.setOpen.mockClear();
    for (const key of ["ArrowDown", "ArrowUp"]) {
      const preventDefault = vi.fn();
      button.onKeyDown({ key, preventDefault });
      expect(preventDefault, key).toHaveBeenCalledOnce();
    }
    expect(state.setOpen.mock.calls).toEqual([[true], [true]]);
    const enter = vi.fn();
    button.onKeyDown({ key: "Enter", preventDefault: enter });
    expect(enter).not.toHaveBeenCalled();
    expect(state.setOpen).toHaveBeenCalledTimes(2);
  });

  it("choosing an item closes the menu and returns focus to its button before acting", () => {
    state.forceOpen = true;
    const onSelect = vi.fn();
    renderMenu({ wide: true, onSelect });
    const focus = vi.fn();
    trigger().ref.current = { focus };
    const items = menuItems();
    expect(items.map(item => item.props["data-testid"])).toEqual(["new", "history", "tone", "remembers", "widen"].map(id => `companion-panel-menu-${id}`));
    items.forEach(item => item.props.onClick());
    expect(onSelect.mock.calls.map(([action]) => action)).toEqual(["new", "history", "tone", "remembers", "widen"]);
    expect(state.setOpen.mock.calls).toEqual(Array(5).fill([false]));
    expect(focus).toHaveBeenCalledTimes(5);
    expect(focus.mock.invocationCallOrder[0]).toBeLessThan(onSelect.mock.invocationCallOrder[0]);
  });

  it("opening focuses the first item; a press outside closes it, taking focus back only from inside", () => {
    class FakeNode {}
    vi.stubGlobal("Node", FakeNode);
    state.forceOpen = true;
    renderMenu();
    const items = [0, 1, 2, 3].map(() => Object.assign(new FakeNode(), { focus: vi.fn() }));
    const listeners = new Map<string, (event: unknown) => void>();
    const doc = {
      activeElement: null as unknown,
      addEventListener: vi.fn((type: string, listener: (event: unknown) => void) => { listeners.set(type, listener); }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal("document", doc);
    const focus = vi.fn();
    trigger().ref.current = { focus };
    menu().ref.current = { querySelectorAll: () => items };
    wrap().ref.current = { contains: (target: unknown) => items.includes(target as never) };
    const opened = state.effects.find(effect => String(effect).includes("pointerdown"));
    expect(opened).toBeDefined();
    const cleanup = opened!();
    expect(items[0].focus).toHaveBeenCalledOnce();
    const outside = listeners.get("pointerdown")!;
    outside({ target: items[2] });
    expect(state.setOpen).not.toHaveBeenCalled();
    outside({ target: new FakeNode() });
    expect(state.setOpen).toHaveBeenCalledExactlyOnceWith(false);
    expect(focus).not.toHaveBeenCalled();
    doc.activeElement = items[1];
    outside({ target: new FakeNode() });
    expect(focus).toHaveBeenCalledOnce();
    if (typeof cleanup === "function") cleanup();
    expect(doc.removeEventListener).toHaveBeenCalledWith("pointerdown", outside);
  });

  it("a hidden panel never keeps the menu open behind it, and focus leaving the menu closes it", () => {
    class FakeNode {}
    vi.stubGlobal("Node", FakeNode);
    state.forceOpen = true;
    renderMenu({ panelVisible: false });
    const hide = state.effects.find(effect => String(effect).includes("panelVisible"));
    expect(hide).toBeDefined();
    hide!();
    expect(state.setOpen).toHaveBeenCalledExactlyOnceWith(false);
    state.setOpen.mockClear();
    const inside = new FakeNode();
    const currentTarget = { contains: (target: unknown) => target === inside };
    wrap().onBlur({ relatedTarget: inside, currentTarget });
    expect(state.setOpen).not.toHaveBeenCalled();
    wrap().onBlur({ relatedTarget: new FakeNode(), currentTarget });
    expect(state.setOpen).toHaveBeenCalledExactlyOnceWith(false);
  });
});

describe("FEAT-01 — the conversation answers the menu through its one door", () => {
  const coach = readFileSync(new URL("../tabs/CoachTab.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  // F-TALK-1 re-pin: history is hidden until asked; the claim opens the list,
  // and a separate effect (the list mounts on the next render) brings it into
  // view and focuses its current row.
  it("tone opens the ONE ToneSheet and history opens the in-panel list and focuses it; neither sends", () => {
    const start = coach.indexOf("const onAsk = (event: Event) => {");
    expect(start).toBeGreaterThan(-1);
    const listener = coach.slice(start, coach.indexOf("window.addEventListener(COMPANION_CONVERSATION_EVENT, onAsk);"));
    // The tap only bumps a counter; the request itself is claimed below.
    expect(listener).toContain("if (detail?.panel) setPanelAsk((n) => n + 1);");
    const at = coach.indexOf("const panel = consumeConversationPanelRequest();");
    expect(at).toBeGreaterThan(-1);
    const claim = coach.slice(at, coach.indexOf("}, [visible, panelAsk]);"));
    expect(claim.length).toBeGreaterThan(0);
    // Claimed only while the conversation shows, so a hidden panel never opens a sheet.
    expect(coach.slice(at - 80, at)).toContain("if (!visible) return;");
    expect(claim).toContain('if (panel === "tone") setToneOpen(true);');
    expect(claim).toContain('if (panel === "history") { setHistoryOpen(true); setHistoryAsk((n) => n + 1); }');
    const reveal = coach.slice(coach.indexOf("if (!historyAsk || !historyRef.current) return;"), coach.indexOf("}, [historyAsk]);"));
    expect(reveal.length).toBeGreaterThan(0);
    expect(reveal).toContain("scrollIntoView(");
    expect(reveal).toContain('[data-history-chip][aria-current]');
    expect(reveal).toContain("focus({ preventScroll: true })");
    for (const part of [listener, claim, reveal]) expect(part).not.toMatch(/sendMessage|handleSend|setChatInput/);
    expect(coach.match(/<ToneSheet /g)).toHaveLength(1);
    expect(coach).toContain('{historyOpen && (\n      <section data-module="coach-history"\n        ref={historyRef}');
    expect(coach).toContain("const [historyOpen, setHistoryOpen] = useState(false);");
  });

  it("holds a menu request until the conversation claims it: once, the latest, and only while fresh", () => {
    vi.stubGlobal("window", new EventTarget());
    consumeConversationPanelRequest();
    expect(consumeConversationPanelRequest()).toBeNull();

    // Chosen while the conversation was still loading: claimed when it mounts.
    requestCompanionConversation({ panel: "tone", source: "panel-menu" }, 1_000);
    expect(consumeConversationPanelRequest(1_000 + CONVERSATION_VOICE_REQUEST_TTL_MS)).toBe("tone");
    expect(consumeConversationPanelRequest(1_000)).toBeNull();

    requestCompanionConversation({ panel: "tone", source: "panel-menu" }, 2_000);
    requestCompanionConversation({ panel: "history", source: "panel-menu" }, 2_500);
    expect(consumeConversationPanelRequest(3_000)).toBe("history");
    expect(consumeConversationPanelRequest(3_000)).toBeNull();

    // A stale request is dropped and cleared, never answered late.
    requestCompanionConversation({ panel: "history", source: "panel-menu" }, 4_000);
    expect(consumeConversationPanelRequest(4_001 + CONVERSATION_VOICE_REQUEST_TTL_MS)).toBeNull();
    expect(consumeConversationPanelRequest(4_000)).toBeNull();

    // A menu request never asks for the microphone, and a plain open holds no menu request.
    expect(consumeConversationVoiceRequest(5_000)).toBe(false);
    requestCompanionConversation({ source: "launcher" }, 6_000);
    expect(consumeConversationPanelRequest(6_000)).toBeNull();
  });
});

describe("FEAT-01 styles", () => {
  const css = readFileSync(new URL("./companionWorkspace.css", import.meta.url), "utf8");
  const start = css.indexOf("/* FEAT-01");
  const block = css.slice(start);
  it("keeps every menu item and the menu button at the 44 px floor", () => {
    expect(start).toBeGreaterThan(-1);
    expect(/\.companion-panel-menu-item \{([^}]*)\}/.exec(css)?.[1]).toMatch(/min-block-size: 44px/);
    const chrome = /\.companion-chrome-button \{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(chrome).toMatch(/min-inline-size: 44px/);
    expect(chrome).toMatch(/min-block-size: 44px/);
  });
  it("uses logical properties and theme tokens only, so Hebrew mirrors", () => {
    expect(block).toMatch(/\.companion-panel-menu \{[^}]*inset-inline-end: 0/);
    expect(block).not.toMatch(/(?:^|[\s;{])(?:left|right|top|bottom|(?:margin|padding|border)-(?:left|right|top|bottom))\s*:/);
    expect(block).not.toMatch(/text-align:\s*(?:left|right)/);
    expect(block).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
