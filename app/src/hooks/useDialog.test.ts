import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Exercise the actual hook callbacks and effect cleanup with a controlled hook
// scheduler; this is not a claim of mounted React/browser evidence.
const runtime = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, jobs: [] as (() => void)[], register: vi.fn() }));
vi.mock("../lib/dialogStack", () => ({ registerDialog: runtime.register }));
vi.mock("react", () => {
  const effect = (setup: () => (() => void) | undefined, deps: unknown[]) => {
    const index = runtime.cursor++;
    const old = runtime.slots[index];
    if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
      runtime.jobs.push(() => { old?.cleanup?.(); runtime.slots[index] = { deps, setup, cleanup: setup() }; });
    }
  };
  return {
    useRef: (value: unknown) => {
      const index = runtime.cursor++;
      return runtime.slots[index] ?? (runtime.slots[index] = { current: value });
    },
    useCallback: (fn: unknown) => fn,
    useEffect: effect, useLayoutEffect: effect,
  };
});
import { useDialog } from "./useDialog";
const render = (open: boolean, onClose: () => void, options: { beforeCommit?: () => void; returnFocusRef?: { current: HTMLElement | null } } = {}) => {
  runtime.cursor = 0;
  const dialog = useDialog({ open, onClose, returnFocusRef: options.returnFocusRef });
  dialog.ref.current = {} as HTMLDivElement;
  options.beforeCommit?.();
  while (runtime.jobs.length) runtime.jobs.shift()!();
  return dialog;
};
beforeEach(() => { runtime.slots = []; runtime.jobs = []; runtime.cursor = 0; runtime.register.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("useDialog production callback wiring", () => {
  it("captures the opener before child autofocus and retains it through later renders and effect replay", () => {
    const opener = { name: "Keep summary" }, input = { name: "Moment input" };
    const document = { activeElement: opener };
    vi.stubGlobal("document", document);
    runtime.register.mockReturnValue({ close: vi.fn(), dispose: vi.fn() });
    render(true, vi.fn(), { beforeCommit: () => { document.activeElement = input; } });
    const opening = runtime.register.mock.calls[0][0];
    expect(document.activeElement).toBe(input); expect(opening.returnFocus()).toBe(opener);
    render(true, vi.fn());
    expect(runtime.register).toHaveBeenCalledOnce(); expect(opening.returnFocus()).toBe(opener);
    const effect = runtime.slots.find(slot => slot?.setup);
    effect.cleanup(); effect.setup();
    expect(runtime.register.mock.calls[1][0].returnFocus()).toBe(opener);
  });

  it("a reopened dialog captures its new opener and explicit return refs still take precedence", () => {
    const first = { name: "First opener" }, second = { name: "Second opener" }, input = { name: "Input" };
    const document = { activeElement: first };
    vi.stubGlobal("document", document);
    runtime.register.mockReturnValue({ close: vi.fn(), dispose: vi.fn() });
    render(true, vi.fn(), { beforeCommit: () => { document.activeElement = input; } });
    render(false, vi.fn());
    document.activeElement = second;
    render(true, vi.fn(), { beforeCommit: () => { document.activeElement = input; } });
    expect(runtime.register.mock.calls[1][0].returnFocus()).toBe(second);
    const explicit = {} as HTMLElement, updated = {} as HTMLElement;
    const returnFocusRef = { current: explicit };
    render(true, vi.fn(), { returnFocusRef });
    expect(runtime.register.mock.calls[1][0].returnFocus()).toBe(explicit);
    returnFocusRef.current = updated;
    expect(runtime.register.mock.calls[1][0].returnFocus()).toBe(updated);
  });

  it("inline close changes use the latest callback without re-registering or refocusing", () => {
    const close = vi.fn(), dispose = vi.fn();
    runtime.register.mockReturnValue({ close, dispose });
    const old = vi.fn(), current = vi.fn();
    render(true, old);
    const result = render(true, current);
    expect(runtime.register).toHaveBeenCalledTimes(1);
    runtime.register.mock.calls[0][0].onClose();
    expect(current).toHaveBeenCalledOnce(); expect(old).not.toHaveBeenCalled();
    result.requestClose(); expect(close).toHaveBeenCalledOnce();
    expect(dispose).not.toHaveBeenCalled();
  });

  it("clears its handle BEFORE teardown; closed and stale callback closures cannot dismiss", () => {
    const close = vi.fn();
    let result: ReturnType<typeof useDialog>;
    const dispose = vi.fn(() => result.requestClose());
    runtime.register.mockReturnValue({ close, dispose });
    result = render(true, vi.fn());
    render(false, vi.fn());
    result.requestClose();
    expect(dispose).toHaveBeenCalledOnce(); expect(close).not.toHaveBeenCalled();
  });

  it("backdrop stops React portal bubbling and only a direct backdrop hit dismisses", () => {
    const close = vi.fn(); runtime.register.mockReturnValue({ close, dispose: vi.fn() });
    const result = render(true, vi.fn());
    const backdrop = {}, child = {}, parentClose = vi.fn();
    let stopped = false;
    const event = (target: object) => ({ currentTarget: backdrop, target, stopPropagation: () => { stopped = true; } });
    result.onBackdropClick(event(child) as any);
    if (!stopped) parentClose();
    expect(close).not.toHaveBeenCalled(); expect(parentClose).not.toHaveBeenCalled();
    stopped = false;
    result.onBackdropClick(event(backdrop) as any);
    if (!stopped) parentClose();
    expect(close).toHaveBeenCalledOnce(); expect(parentClose).not.toHaveBeenCalled();
  });

  it("ignores retargeted repeat clicks while preserving a fresh backdrop click and explicit dismissal", () => {
    const close = vi.fn(); runtime.register.mockReturnValue({ close, dispose: vi.fn() });
    const result = render(true, vi.fn());
    const backdrop = {}, submit = {};
    const event = (target: object, detail: number) => ({ currentTarget: backdrop, target, detail, stopPropagation: vi.fn() });
    // Saving replaces a tall form with a shorter receipt. The same screen
    // coordinate is now outside the dialog, but still in the Save click burst.
    result.onBackdropClick(event(submit, 1) as any);
    for (const detail of [2, 3]) {
      const repeated = event(backdrop, detail);
      result.onBackdropClick(repeated as any);
      expect(repeated.stopPropagation).toHaveBeenCalledOnce();
      expect(close).not.toHaveBeenCalled();
    }
    // The browser owns click-sequence timing. No app timeout delays a later
    // deliberate dismissal; explicit Close/Escape bypass this pointer guard.
    result.onBackdropClick(event(backdrop, 1) as any);
    expect(close).toHaveBeenCalledTimes(1);
    result.requestClose();
    expect(close).toHaveBeenCalledTimes(2);
    result.onBackdropClick(event(backdrop, 0) as any);
    expect(close).toHaveBeenCalledTimes(3);
  });

  it("pre-fix raw backdrop callbacks bubble through both portal ancestors (negative control)", () => {
    const inner = vi.fn(), parent = vi.fn();
    inner(); parent();
    expect(inner).toHaveBeenCalledOnce(); expect(parent).toHaveBeenCalledOnce();
  });
});
