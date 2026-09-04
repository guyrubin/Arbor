import { beforeEach, describe, expect, it, vi } from "vitest";

// Exercise the actual hook callbacks and effect cleanup with a controlled hook
// scheduler; this is not a claim of mounted React/browser evidence.
const runtime = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, jobs: [] as (() => void)[], register: vi.fn() }));
vi.mock("../lib/dialogStack", () => ({ registerDialog: runtime.register }));
vi.mock("react", () => {
  const effect = (setup: () => (() => void) | undefined, deps: unknown[]) => {
    const index = runtime.cursor++;
    const old = runtime.slots[index];
    if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
      runtime.jobs.push(() => { old?.cleanup?.(); runtime.slots[index] = { deps, cleanup: setup() }; });
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
const render = (open: boolean, onClose: () => void) => {
  runtime.cursor = 0;
  const dialog = useDialog({ open, onClose });
  dialog.ref.current = {} as HTMLDivElement;
  while (runtime.jobs.length) runtime.jobs.shift()!();
  return dialog;
};
beforeEach(() => { runtime.slots = []; runtime.jobs = []; runtime.cursor = 0; runtime.register.mockReset(); });

describe("useDialog production callback wiring", () => {
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

  it("pre-fix raw backdrop callbacks bubble through both portal ancestors (negative control)", () => {
    const inner = vi.fn(), parent = vi.fn();
    inner(); parent();
    expect(inner).toHaveBeenCalledOnce(); expect(parent).toHaveBeenCalledOnce();
  });
});
