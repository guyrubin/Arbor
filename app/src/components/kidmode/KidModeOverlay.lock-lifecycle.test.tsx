/** Execute the actual overlay and its lock callbacks with separate deterministic
 * layout/passive queues. This is lifecycle ordering evidence, not a DOM renderer
 * or browser paint/focus claim. The real shield and Tab trap are not mocked. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
import type { ShieldableElement } from "./kidModeShield";
import type { TrapFocusable } from "./kidModeFocusTrap";

type Effect = () => void | (() => void);
type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void; layoutEffect?: Effect };
const h = vi.hoisted(() => ({
  open: true, cursor: 0, slots: [] as Slot[],
  layout: [] as (() => void)[], passive: [] as (() => void)[],
  close: vi.fn(), audio: vi.fn(), hydrate: vi.fn(), writeState: vi.fn(),
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const register = (phase: "layout" | "passive", effect: Effect, deps: readonly unknown[]) => {
    const index = h.cursor++, old = h.slots[index];
    if (old?.deps && deps.length === old.deps.length && deps.every((value, i) => Object.is(value, old.deps![i]))) return;
    const slot: Slot = h.slots[index] = { deps, cleanup: old?.cleanup, ...(phase === "layout" ? { layoutEffect: effect } : {}) };
    h[phase].push(() => { slot.cleanup?.(); slot.cleanup = effect() || undefined; });
  };
  return { ...actual,
    useState(initial: unknown) {
      const index = h.cursor++, slot = h.slots[index] ??= { value: typeof initial === "function" ? (initial as () => unknown)() : initial };
      return [slot.value, (next: unknown) => { slot.value = typeof next === "function" ? (next as (value: unknown) => unknown)(slot.value) : next; }];
    },
    useRef(initial: unknown) { return (h.slots[h.cursor++] ??= { value: { current: initial } }).value; },
    useLayoutEffect: (effect: Effect, deps: readonly unknown[]) => register("layout", effect, deps),
    useEffect: (effect: Effect, deps: readonly unknown[]) => register("passive", effect, deps),
  };
});
vi.mock("motion/react", () => ({ motion: { div: "div" }, AnimatePresence: "fragment" }));
vi.mock("lucide-react", () => ({ ChevronLeft: () => null }));
vi.mock("./KidModeContext", () => ({ useKidMode: () => ({ isKidModeOpen: h.open, closeKidMode: h.close }) }));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: "synthetic-child" } }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string) => key, uiLang: "en" }) }));
vi.mock("../../lib/kidModeGate", () => ({ readKidModeState: () => ({ open: h.open, view: "home" }), writeKidModeState: h.writeState }));
vi.mock("./kidSurfaceTitle", () => ({ useKidSurfaceTitle: () => null }));
vi.mock("./KidDashboard", () => ({ default: () => null, KID_GAME_TITLE_KEY: {} }));
vi.mock("./HoldExitButton", () => ({ HoldExitButton: () => null }));
vi.mock("./KidErrorBoundary", () => ({ KidErrorBoundary: () => null }));
vi.mock("./KidStageFallback", () => ({ KidStageFallback: () => null }));
vi.mock("../ui/ArborMascot", () => ({ ArborMascot: () => null }));
vi.mock("./kidReadAloud", () => ({ KidSoundToggle: () => null }));
vi.mock("./audio/kidAudio", () => ({ closeKidAudio: vi.fn(), kidAudioVisibility: vi.fn(), kidHush: vi.fn(), setKidAudioChild: h.audio }));
vi.mock("../../lib/heroRenderStore", () => ({ hydrateHeroRenders: h.hydrate }));
vi.mock("./kidChrome", () => ({ setKidHome: vi.fn(), useKidStage: () => null }));
vi.mock("./KidStage", () => ({ KidStage: () => null }));
vi.mock("./kidStageArt", () => ({ kidStageFor: () => "synthetic-stage" }));
vi.mock("./kidWorlds", () => ({ SNEAK_FREEZE_WORLD: { worldId: "sneak-freeze" }, flaggedWorldNameKey: () => null, sneakFreezeFlagOn: () => false }));

import KidModeOverlay from "./KidModeOverlay";

class NodeAttributes implements ShieldableElement {
  attributes: Map<string, string>;
  constructor(attributes: Record<string, string> = {}) { this.attributes = new Map(Object.entries(attributes)); }
  hasAttribute(name: string) { return this.attributes.has(name); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
}
type Listener = (event: KeyboardEvent) => void;
type Props = { children?: unknown; role?: string; ref?: { current: unknown } };
const findDialog = (node: unknown): ReactElement<Props> | undefined => {
  if (Array.isArray(node)) return node.map(findDialog).find(Boolean);
  if (!isValidElement<Props>(node)) return undefined;
  return node.props.role === "dialog" ? node : findDialog(node.props.children);
};
const listeners = new Map<string, Set<Listener>>();
const documentStub = {
  activeElement: {} as unknown, visibilityState: "visible",
  addEventListener: vi.fn((name: string, listener: Listener, _capture?: boolean) => {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name)!.add(listener);
  }),
  removeEventListener: vi.fn((name: string, listener: Listener, _capture?: boolean) => { listeners.get(name)?.delete(listener); }),
};
class Observer {
  static instances: Observer[] = [];
  connected = false;
  target: unknown;
  options: unknown;
  constructor(readonly callback: () => void) { Observer.instances.push(this); }
  observe(target: unknown, options: unknown) { this.connected = true; this.target = target; this.options = options; }
  disconnect() { this.connected = false; }
  // A disconnected real MutationObserver cannot deliver queued records.
  deliver() { if (this.connected) this.callback(); }
}
let shell: NodeAttributes, inherited: NodeAttributes, backdrop: NodeAttributes;
let parent: { children: NodeAttributes[] };
let controls: TrapFocusable[];
let overlay: NodeAttributes & { parentElement: typeof parent | null; contains(node: unknown): boolean; querySelectorAll(): TrapFocusable[] };
const attributes = (node: NodeAttributes) => Object.fromEntries(node.attributes);
const key = (name: string, shiftKey = false) => {
  const event = { key: name, shiftKey, preventDefault: vi.fn(), stopPropagation: vi.fn() };
  for (const listener of listeners.get("keydown") ?? []) listener(event as unknown as KeyboardEvent);
  return event;
};
const flush = (phase: "layout" | "passive") => { for (const work of h[phase].splice(0)) work(); };
const render = (open: boolean) => {
  h.open = open; h.cursor = 0;
  const tree = KidModeOverlay(), dialog = findDialog(tree);
  if (open) {
    if (!dialog?.props.ref) throw new Error("ACTUAL_OVERLAY_REF_MISSING");
    dialog.props.ref.current = overlay;
  }
  return tree;
};
const unmount = () => { for (const slot of h.slots) { slot.cleanup?.(); slot.cleanup = undefined; } };
const expectShield = () => {
  expect(attributes(shell)).toEqual({ inert: "", "aria-hidden": "true" });
  expect(backdrop.hasAttribute("inert")).toBe(false); expect(overlay.hasAttribute("inert")).toBe(false);
  expect(attributes(inherited)).toEqual({ inert: "already-owned", "aria-hidden": "false" });
};
const expectRestored = () => {
  expect(attributes(shell)).toEqual({ "aria-hidden": "false" });
  expect(attributes(inherited)).toEqual({ inert: "already-owned", "aria-hidden": "false" });
  expect(listeners.get("keydown")?.size ?? 0).toBe(0);
  expect(Observer.instances.every(observer => !observer.connected)).toBe(true);
};

beforeEach(() => {
  vi.clearAllMocks(); h.open = true; h.cursor = 0; h.slots = []; h.layout = []; h.passive = [];
  listeners.clear(); Observer.instances = []; documentStub.activeElement = {};
  shell = new NodeAttributes({ "aria-hidden": "false" });
  inherited = new NodeAttributes({ inert: "already-owned", "aria-hidden": "false" });
  backdrop = new NodeAttributes({ "data-kid-mode-layer": "true" });
  controls = Array.from({ length: 3 }, () => { const control: TrapFocusable = { focus: vi.fn(() => { documentStub.activeElement = control; }) }; return control; });
  parent = { children: [] };
  overlay = Object.assign(new NodeAttributes({ "data-kid-mode-layer": "true" }), {
    parentElement: parent, contains: (node: unknown) => controls.includes(node as TrapFocusable), querySelectorAll: () => controls,
  });
  parent.children = [shell, inherited, backdrop, overlay];
  vi.stubGlobal("document", documentStub); vi.stubGlobal("MutationObserver", Observer);
  vi.stubGlobal("window", { requestAnimationFrame: vi.fn(() => 1), cancelAnimationFrame: vi.fn() });
});
afterEach(() => { unmount(); vi.unstubAllGlobals(); });

describe("KidModeOverlay pre-paint lock lifecycle", () => {
  it("keeps a wholly closed lifetime free of shields and keyboard interception", () => {
    expect(findDialog(render(false))).toBeUndefined(); flush("layout"); flush("passive");
    expectRestored(); expect(Observer.instances).toHaveLength(0);
    expect(key("Escape").preventDefault).not.toHaveBeenCalled(); expect(key("Tab").preventDefault).not.toHaveBeenCalled();
    unmount(); expectRestored();
  });
  it("retains the established eventual shield and exact cleanup after both effect phases", () => {
    render(true); flush("layout"); flush("passive"); expectShield();
    const late = new NodeAttributes(); parent.children.push(late); Observer.instances[0].deliver();
    expect(attributes(late)).toEqual({ inert: "", "aria-hidden": "true" });
    key("Tab"); expect(documentStub.activeElement).toBe(controls[0]);
    unmount(); expectRestored(); expect(attributes(late)).toEqual({});
  });
  it("shields a persisted-open mount and captures Escape/Tab before any passive effect", () => {
    render(true);
    expect(shell.hasAttribute("inert")).toBe(false);
    flush("layout"); // React completes this phase before the first browser paint.
    expectShield(); expect(h.passive.length).toBeGreaterThan(0);
    expect(h.audio).not.toHaveBeenCalled(); expect(h.hydrate).not.toHaveBeenCalled(); expect(h.writeState).not.toHaveBeenCalled();
    const escape = key("Escape"); expect(escape.preventDefault).toHaveBeenCalledOnce(); expect(escape.stopPropagation).toHaveBeenCalledOnce();
    const tab = key("Tab"); expect(tab.preventDefault).toHaveBeenCalledOnce(); expect(documentStub.activeElement).toBe(controls[0]);
    expect(h.close).not.toHaveBeenCalled();
    expect(documentStub.addEventListener.mock.calls.filter(([name]) => name === "keydown").map(([, , capture]) => capture)).toEqual([true, true]);
  });
  it("leaves a closed mount untouched and seals closed-to-open in the layout phase", () => {
    expect(findDialog(render(false))).toBeUndefined(); flush("layout"); flush("passive"); expectRestored();
    expect(Observer.instances).toHaveLength(0);
    render(true); flush("layout"); expectShield(); expect(listeners.get("keydown")?.size).toBe(2);
    flush("passive"); expectShield();
  });
  it("keeps late siblings shielded and restores both removed and still-mounted siblings exactly", () => {
    render(true); flush("layout");
    const observer = Observer.instances[0]; expect(observer.target).toBe(parent); expect(observer.options).toEqual({ childList: true });
    const late = new NodeAttributes(), custom = new NodeAttributes({ "aria-hidden": "custom-existing" });
    parent.children.push(late, custom); observer.deliver();
    expectShield(); expect(attributes(late)).toEqual({ inert: "", "aria-hidden": "true" });
    parent.children = parent.children.filter(node => node !== custom); observer.deliver();
    expect(attributes(custom)).toEqual({ "aria-hidden": "custom-existing" });
    unmount(); expectRestored(); expect(attributes(late)).toEqual({});
    observer.deliver(); expectRestored(); expect(attributes(late)).toEqual({});
  });
  it("restores on close before passive cleanup and supports rapid close/reopen without duplicate locks", () => {
    render(true); flush("layout"); flush("passive");
    render(false); flush("layout"); expectRestored();
    expect(key("Escape").preventDefault).not.toHaveBeenCalled(); expect(key("Tab").preventDefault).not.toHaveBeenCalled();
    flush("passive"); render(true); flush("layout"); expectShield();
    expect(listeners.get("keydown")?.size).toBe(2); expect(Observer.instances.filter(observer => observer.connected)).toHaveLength(1);
    unmount(); expectRestored();
  });
  it("does not replace a live observer or listeners on an unchanged open render", () => {
    render(true); flush("layout"); flush("passive");
    render(true); flush("layout"); expectShield();
    expect(Observer.instances).toHaveLength(1); expect(documentStub.addEventListener.mock.calls.filter(([name]) => name === "keydown")).toHaveLength(2);
  });
  it("restores on unmount before passive work and survives layout-effect setup/cleanup replay", () => {
    render(true); flush("layout");
    for (const slot of h.slots) if (slot.layoutEffect) { slot.cleanup?.(); slot.cleanup = undefined; }
    expectRestored();
    for (const slot of h.slots) if (slot.layoutEffect) slot.cleanup = slot.layoutEffect() || undefined;
    expectShield(); expect(listeners.get("keydown")?.size).toBe(2);
    expect(Observer.instances.filter(observer => observer.connected)).toHaveLength(1);
    unmount(); expectRestored();
  });
  it("wraps focus and recaptures outside portals in layout while preserving normal keys and mid-list Tab", () => {
    render(true); flush("layout");
    documentStub.activeElement = controls[2]; expect(key("Tab").preventDefault).toHaveBeenCalledOnce(); expect(documentStub.activeElement).toBe(controls[0]);
    expect(key("Tab", true).preventDefault).toHaveBeenCalledOnce(); expect(documentStub.activeElement).toBe(controls[2]);
    documentStub.activeElement = {}; key("Tab"); expect(documentStub.activeElement).toBe(controls[0]);
    documentStub.activeElement = controls[1]; expect(key("Tab").preventDefault).not.toHaveBeenCalled();
    expect(key("Enter").preventDefault).not.toHaveBeenCalled();
    controls = []; expect(key("Tab").preventDefault).toHaveBeenCalledOnce(); expect(h.close).not.toHaveBeenCalled();
  });
});
