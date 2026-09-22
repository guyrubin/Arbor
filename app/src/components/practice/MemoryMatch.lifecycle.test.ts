import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryPairLifecycle } from "./MemoryMatch";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Memory Match pending-pair lifecycle", () => {
  it("cannot let an old pair mutate a freshly reset or switched theme", () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });
    const lifecycle = createMemoryPairLifecycle();
    const resolved: string[] = [];

    lifecycle.schedule(720, () => resolved.push("old deck"));
    lifecycle.invalidate();
    vi.runAllTimers();
    expect(resolved).toEqual([]);

    lifecycle.schedule(320, () => resolved.push("new deck"));
    vi.advanceTimersByTime(320);
    expect(resolved).toEqual(["new deck"]);
  });
});
