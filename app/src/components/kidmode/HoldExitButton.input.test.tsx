/** Executes the actual hold button callbacks with deterministic hook slots.
 * This proves input ownership, timing and cleanup, not browser focus or paint. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ButtonHTMLAttributes } from "react";

type Effect = () => void | (() => void);
type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
const h = vi.hoisted(() => ({ cursor: 0, slots: [] as Slot[], layout: [] as (() => void)[], effects: [] as (() => void)[], exit: vi.fn() }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const equal = (a: readonly unknown[] | undefined, b: readonly unknown[]) => !!a && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const register = (phase: "layout" | "effects", effect: Effect, deps: readonly unknown[]) => {
    const index = h.cursor++, old = h.slots[index];
    if (equal(old?.deps, deps)) return;
    const slot: Slot = h.slots[index] = { deps, cleanup: old?.cleanup };
    h[phase].push(() => { slot.cleanup?.(); slot.cleanup = effect() || undefined; });
  };
  return { ...actual,
    useState(initial: unknown) {
      const index = h.cursor++, slot = h.slots[index] ??= { value: typeof initial === "function" ? (initial as () => unknown)() : initial };
      return [slot.value, (next: unknown) => { slot.value = typeof next === "function" ? (next as (value: unknown) => unknown)(slot.value) : next; }];
    },
    useRef(initial: unknown) { return (h.slots[h.cursor++] ??= { value: { current: initial } }).value; },
    useCallback(callback: unknown, deps: readonly unknown[]) {
      const index = h.cursor++, old = h.slots[index];
      if (equal(old?.deps, deps)) return old!.value;
      h.slots[index] = { value: callback, deps }; return callback;
    },
    useEffect: (effect: Effect, deps: readonly unknown[]) => register("effects", effect, deps),
    useLayoutEffect: (effect: Effect, deps: readonly unknown[]) => register("layout", effect, deps),
  };
});
vi.mock("lucide-react", () => ({ X: () => null }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock("./ParentChallenge", () => ({ ParentChallenge: () => null }));

import { HoldExitButton } from "./HoldExitButton";
import { ParentChallenge } from "./ParentChallenge";
import { HOLD_MS } from "./parentGate";

type TreeProps = { children?: unknown; ref?: { current: unknown } };
function elements(node: unknown): ReactElement<TreeProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<TreeProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
const trigger = { isConnected: true, focus: vi.fn() };
const render = () => {
  h.cursor = 0; const tree = HoldExitButton({ onExit: h.exit });
  const nodes = elements(tree), triggerRef = nodes.find(node => node.type === "button")?.props.ref;
  if (!triggerRef) throw new Error("ACTUAL_HOLD_BUTTON_REF_MISSING");
  triggerRef.current = trigger;
  for (const effect of h.layout.splice(0)) effect();
  for (const effect of h.effects.splice(0)) effect();
  return nodes;
};
const button = () => render().find(node => node.type === "button")!.props as ButtonHTMLAttributes<HTMLButtonElement>;
const challenge = () => render().find(node => node.type === ParentChallenge)?.props as { onSuccess: () => void; onDismiss: () => void } | undefined;
const unmount = () => { for (const slot of h.slots) { slot.cleanup?.(); slot.cleanup = undefined; } };
const keyboard = (key: string, repeat = false) => ({ key, repeat, preventDefault: vi.fn() });
const pointer = (id = 1, overrides: { button?: number; isPrimary?: boolean } = {}) => ({
  pointerId: id, button: 0, isPrimary: true, currentTarget: { setPointerCapture: vi.fn() }, ...overrides,
});
const keyDown = (key: string, repeat = false) => { const event = keyboard(key, repeat); button().onKeyDown!(event as unknown as React.KeyboardEvent<HTMLButtonElement>); return event; };
const keyUp = (key: string) => { const event = keyboard(key); button().onKeyUp!(event as unknown as React.KeyboardEvent<HTMLButtonElement>); return event; };
type PointerAction = "onPointerDown" | "onPointerUp" | "onPointerCancel" | "onLostPointerCapture";
const pointerEvent = (action: PointerAction, event = pointer()) => { button()[action]!(event as unknown as React.PointerEvent<HTMLButtonElement>); return event; };
const windowListeners = new Map<string, Set<() => void>>(), documentListeners = new Map<string, Set<() => void>>();
const surface = (listeners: Map<string, Set<() => void>>) => ({
  addEventListener: (name: string, listener: () => void) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name)!.add(listener); },
  removeEventListener: (name: string, listener: () => void) => listeners.get(name)?.delete(listener),
});
const fire = (listeners: Map<string, Set<() => void>>, name: string) => { for (const listener of listeners.get(name) ?? []) listener(); };
const documentStub = { ...surface(documentListeners), hidden: false };

beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(100_000);
  h.cursor = 0; h.slots = []; h.layout = []; h.effects = []; windowListeners.clear(); documentListeners.clear(); documentStub.hidden = false; trigger.isConnected = true;
  // Deliberately never runs a frame: completion must remain wall-clock based.
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 7)); vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("window", surface(windowListeners)); vi.stubGlobal("document", documentStub);
});

describe("challenge dismissal restores the trigger safely", () => {
  it("restores focus once after dismissal commits, never while the challenge is open", () => {
    keyDown("Enter"); vi.advanceTimersByTime(HOLD_MS); const opened = challenge()!;
    expect(trigger.focus).not.toHaveBeenCalled(); opened.onDismiss();
    expect(trigger.focus).not.toHaveBeenCalled(); // The modal still exists until React commits.
    expect(challenge()).toBeUndefined(); expect(trigger.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    render(); expect(trigger.focus).toHaveBeenCalledOnce(); expect(h.exit).not.toHaveBeenCalled();
  });
  it("does not restore after success, and ignores old dismissal callbacks", () => {
    keyDown(" "); vi.advanceTimersByTime(HOLD_MS); const opened = challenge()!;
    opened.onSuccess(); opened.onDismiss();
    expect(challenge()).toBeUndefined(); expect(trigger.focus).not.toHaveBeenCalled(); expect(h.exit).toHaveBeenCalledOnce();
  });
  it("a stale callback cannot dismiss or exit a later challenge", () => {
    keyDown(" "); vi.advanceTimersByTime(HOLD_MS); const old = challenge()!;
    old.onDismiss(); render(); trigger.focus.mockClear();
    keyDown(" "); vi.advanceTimersByTime(HOLD_MS); expect(challenge()).toBeDefined();
    old.onDismiss(); old.onSuccess(); expect(challenge()).toBeDefined();
    expect(trigger.focus).not.toHaveBeenCalled(); expect(h.exit).not.toHaveBeenCalled();
  });
  it("does not focus a detached trigger", () => {
    keyDown(" "); vi.advanceTimersByTime(HOLD_MS); challenge()!.onDismiss(); trigger.isConnected = false;
    expect(challenge()).toBeUndefined(); expect(trigger.focus).not.toHaveBeenCalled();
  });
  it("unmount retires the challenge and any pending focus restoration", () => {
    keyDown("Enter"); vi.advanceTimersByTime(HOLD_MS); const opened = challenge()!;
    opened.onDismiss(); unmount(); opened.onDismiss(); opened.onSuccess();
    vi.runAllTimers(); expect(trigger.focus).not.toHaveBeenCalled(); expect(h.exit).not.toHaveBeenCalled();
  });
});
afterEach(() => { unmount(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("keyboard hold preserves the parent challenge", () => {
  it.each([" ", "Enter"])("%j opens only the challenge after the full hold, without animation frames", key => {
    expect(button().type).toBe("button"); expect(button().onClick).toBeUndefined();
    expect(keyDown(key).preventDefault).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(HOLD_MS - 1); expect(challenge()).toBeUndefined();
    vi.advanceTimersByTime(1); expect(challenge()).toBeDefined(); expect(h.exit).not.toHaveBeenCalled();
    expect(keyUp(key).preventDefault).toHaveBeenCalledOnce(); expect(h.exit).not.toHaveBeenCalled();
    challenge()!.onSuccess(); expect(h.exit).toHaveBeenCalledOnce(); expect(challenge()).toBeUndefined();
  });
  it("does not restart the timer on key repeat or a duplicate keydown", () => {
    keyDown(" "); vi.advanceTimersByTime(HOLD_MS / 2);
    keyDown(" ", true); keyDown(" "); expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(HOLD_MS / 2); expect(challenge()).toBeDefined(); expect(h.exit).not.toHaveBeenCalled();
  });
  it("ignores an initial repeat and leaves unrelated keys to normal navigation", () => {
    keyDown("Enter", true); expect(vi.getTimerCount()).toBe(0);
    expect(keyDown("Tab").preventDefault).not.toHaveBeenCalled();
    expect(keyUp("a").preventDefault).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels an early release and requires a new full hold after challenge dismissal", () => {
    keyDown("Enter"); vi.advanceTimersByTime(HOLD_MS - 1); keyUp("Enter");
    vi.advanceTimersByTime(HOLD_MS); expect(challenge()).toBeUndefined();
    keyDown("Enter"); vi.advanceTimersByTime(HOLD_MS); challenge()!.onDismiss();
    expect(challenge()).toBeUndefined(); keyUp("Enter"); vi.advanceTimersByTime(HOLD_MS);
    expect(challenge()).toBeUndefined(); expect(h.exit).not.toHaveBeenCalled();
  });
});

describe("one continuous input owns the hold", () => {
  it("keeps a pointer hold intact when keyboard input or a second pointer arrives", () => {
    const down = pointerEvent("onPointerDown"); expect(down.currentTarget.setPointerCapture).toHaveBeenCalledExactlyOnceWith(1);
    vi.advanceTimersByTime(HOLD_MS / 2); keyDown("Enter"); keyUp("Enter");
    pointerEvent("onPointerDown", pointer(2)); pointerEvent("onPointerUp", pointer(2));
    pointerEvent("onPointerCancel", pointer(2)); expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(HOLD_MS / 2); expect(challenge()).toBeDefined(); expect(h.exit).not.toHaveBeenCalled();
  });
  it("keeps a keyboard hold intact across unrelated keyup and pointer events", () => {
    keyDown(" "); vi.advanceTimersByTime(HOLD_MS / 2); keyDown("Enter"); keyUp("Enter");
    pointerEvent("onPointerDown"); pointerEvent("onPointerUp"); pointerEvent("onPointerCancel");
    vi.advanceTimersByTime(HOLD_MS / 2); expect(challenge()).toBeDefined(); expect(h.exit).not.toHaveBeenCalled();
  });
  it.each(["onPointerCancel", "onLostPointerCapture"] as const)("%s cancels even when the wall clock passed the threshold before the timer ran", action => {
    pointerEvent("onPointerDown"); vi.setSystemTime(100_000 + HOLD_MS + 1); pointerEvent(action);
    vi.advanceTimersByTime(HOLD_MS); expect(challenge()).toBeUndefined(); expect(h.exit).not.toHaveBeenCalled();
  });
  it("preserves completed pointer release when the timer has not run", () => {
    pointerEvent("onPointerDown"); vi.setSystemTime(100_000 + HOLD_MS); pointerEvent("onPointerUp");
    expect(challenge()).toBeDefined(); expect(h.exit).not.toHaveBeenCalled();
  });
  it("ignores secondary mouse buttons and non-primary pointers", () => {
    pointerEvent("onPointerDown", pointer(1, { button: 2 }));
    pointerEvent("onPointerDown", pointer(2, { isPrimary: false }));
    vi.advanceTimersByTime(HOLD_MS); expect(challenge()).toBeUndefined(); expect(vi.getTimerCount()).toBe(0);
  });
});

describe("abandoned hold cleanup", () => {
  it.each(["button blur", "window blur", "hidden document"])("%s cancels a hold without opening the challenge", cause => {
    keyDown("Enter"); vi.advanceTimersByTime(HOLD_MS / 2);
    if (cause === "button blur") button().onBlur!({} as React.FocusEvent<HTMLButtonElement>);
    if (cause === "window blur") fire(windowListeners, "blur");
    if (cause === "hidden document") { documentStub.hidden = true; fire(documentListeners, "visibilitychange"); }
    vi.advanceTimersByTime(HOLD_MS); expect(challenge()).toBeUndefined(); expect(h.exit).not.toHaveBeenCalled();
    expect(cancelAnimationFrame).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it("unmount removes all listeners and pending hold/animation work", () => {
    keyDown(" "); expect(vi.getTimerCount()).toBe(1); unmount();
    expect(vi.getTimerCount()).toBe(0); expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(windowListeners.get("blur")?.size).toBe(0); expect(documentListeners.get("visibilitychange")?.size).toBe(0);
    vi.advanceTimersByTime(HOLD_MS); expect(h.exit).not.toHaveBeenCalled();
  });
  it("unmount also clears a quick-release hint timer", () => {
    keyDown(" "); keyUp(" "); expect(vi.getTimerCount()).toBe(1); unmount(); expect(vi.getTimerCount()).toBe(0);
  });
});
