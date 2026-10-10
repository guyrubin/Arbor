import { afterEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ setup: null as null | (() => void | (() => void)), tick: vi.fn() }));
vi.mock("react", () => ({ useState: () => [0, h.tick], useEffect: (setup: () => void) => { h.setup = setup; } }));
import { useNowClock } from "./useNowClock";
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("Now's shared render clock", () => {
  it("updates on minute tick, focus and visibility and removes every listener on unmount", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 12, 17, 59));
    const events = new Map<string, () => void>();
    const add = vi.fn((name: string, fn: () => void) => { events.set(name, fn); });
    const remove = vi.fn();
    vi.stubGlobal("window", { setInterval, clearInterval, addEventListener: add, removeEventListener: remove });
    vi.stubGlobal("document", { addEventListener: add, removeEventListener: remove });
    expect(useNowClock().getHours()).toBe(17);
    const cleanup = h.setup?.();
    vi.advanceTimersByTime(60_000);
    expect(useNowClock().getHours()).toBe(18);
    events.get("focus")?.(); events.get("visibilitychange")?.();
    expect(h.tick).toHaveBeenCalledTimes(3);
    if (typeof cleanup === "function") cleanup(); expect(remove.mock.calls.map(call => call[0])).toEqual(["focus", "visibilitychange"]);
    const calls = h.tick.mock.calls.length; vi.advanceTimersByTime(60_000); expect(h.tick).toHaveBeenCalledTimes(calls);
  });
});
