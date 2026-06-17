import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { useAsyncAction, type UseAsyncAction } from "./useAsyncAction";
import { PaywallError } from "../lib/api";

/**
 * These tests exercise the *React* behavior of useAsyncAction (the stale-closure
 * fix and the paywall passthrough) without pulling in a DOM renderer. We host
 * the hook in a minimal single-component renderer that re-implements just the
 * three React hooks the hook uses (useState/useRef/useCallback) with correct
 * cross-render identity semantics, so a captured `run` from render 1 can be
 * driven after the component has re-rendered with new props.
 */

type Cell = { value: unknown };

function makeHost<Args extends unknown[], T>(
  build: () => { fn: (...args: Args) => Promise<T>; options: Parameters<typeof useAsyncAction<Args, T>>[2] },
  name = "test_action",
) {
  const cells: Cell[] = [];
  let cursor = 0;
  let scheduled = false;
  let latest!: UseAsyncAction<Args, T>;

  const useState = (init: unknown) => {
    const i = cursor++;
    if (cells[i] === undefined) cells[i] = { value: typeof init === "function" ? (init as () => unknown)() : init };
    const cell = cells[i];
    const set = (next: unknown) => {
      const v = typeof next === "function" ? (next as (p: unknown) => unknown)(cell.value) : next;
      if (!Object.is(v, cell.value)) {
        cell.value = v;
        scheduleRender();
      }
    };
    return [cell.value, set] as const;
  };
  const useRef = (init: unknown) => {
    const i = cursor++;
    if (cells[i] === undefined) cells[i] = { value: { current: init } };
    return cells[i].value as { current: unknown };
  };
  const useCallback = (cb: unknown, deps: unknown[]) => {
    const i = cursor++;
    const prev = cells[i]?.value as { cb: unknown; deps: unknown[] } | undefined;
    if (!prev || prev.deps.length !== deps.length || prev.deps.some((d, k) => !Object.is(d, deps[k]))) {
      cells[i] = { value: { cb, deps } };
    }
    return (cells[i].value as { cb: unknown }).cb;
  };

  // Swap in our hosted hook implementations for the duration of a render.
  const realState = React.useState;
  const realRef = React.useRef;
  const realCb = React.useCallback;

  function render() {
    cursor = 0;
    (React as unknown as Record<string, unknown>).useState = useState;
    (React as unknown as Record<string, unknown>).useRef = useRef;
    (React as unknown as Record<string, unknown>).useCallback = useCallback;
    try {
      const { fn, options } = build();
      latest = useAsyncAction<Args, T>(name, fn, options);
    } finally {
      (React as unknown as Record<string, unknown>).useState = realState;
      (React as unknown as Record<string, unknown>).useRef = realRef;
      (React as unknown as Record<string, unknown>).useCallback = realCb;
    }
  }
  function scheduleRender() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; render(); });
  }

  render();
  return {
    /** The hook result from the most recent render. */
    get current() { return latest; },
    /** Force a re-render (e.g. after changing the props `build` returns). */
    rerender: render,
  };
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

afterEach(() => vi.restoreAllMocks());

describe("useAsyncAction — stable run reads the latest fn (no stale closure)", () => {
  it("a prop change between two run() calls is reflected in the second call", async () => {
    let prop = "child-A";
    const seen: string[] = [];
    const track = vi.fn();

    const host = makeHost(() => ({
      // `fn` closes over `prop` (like AdventuresTab closing over childProfile).
      fn: async () => { seen.push(prop); return prop; },
      options: { fallbackError: "fail", track },
    }));

    // Capture the run from the FIRST render — this is the exact instance a tab
    // keeps when Shell renders <ActiveTabComponent /> with no per-child key.
    const runFromFirstRender = host.current.run;

    await runFromFirstRender();
    expect(seen).toEqual(["child-A"]);

    // The active child changes; the component re-renders with a new `fn`.
    prop = "child-B";
    host.rerender();
    expect(host.current.run).toBe(runFromFirstRender); // identity is preserved

    // Driving the ORIGINAL run must now use the NEW closure, not child-A.
    await runFromFirstRender();
    expect(seen).toEqual(["child-A", "child-B"]);
  });

  it("reads the latest options (track) through the ref", async () => {
    const trackA = vi.fn();
    const trackB = vi.fn();
    let track = trackA;

    const host = makeHost(() => ({
      fn: async () => "ok",
      options: { fallbackError: "fail", track },
    }));
    const run = host.current.run;

    track = trackB;
    host.rerender();
    await run();

    expect(trackA).not.toHaveBeenCalled();
    expect(trackB).toHaveBeenCalledWith("test_action_started", {});
  });
});

describe("useAsyncAction — paywall passthrough", () => {
  it("routes a PaywallError to onPaywall and leaves inline error clear", async () => {
    const onPaywall = vi.fn();
    const err = new PaywallError("Upgrade to Plus", { plan: "plus", feature: "heroComic" });
    const host = makeHost(() => ({
      fn: async () => { throw err; },
      options: { fallbackError: "fallback", onPaywall, track: vi.fn() },
    }));

    const res = await host.current.run();
    await flush();

    expect(res).toBeUndefined();
    expect(onPaywall).toHaveBeenCalledWith(err);
    expect(host.current.error).toBeNull(); // NOT a raw server string
  });

  it("falls back to the inline error when no onPaywall is wired", async () => {
    const err = new PaywallError("Upgrade to Plus", { plan: "plus" });
    const host = makeHost(() => ({
      fn: async () => { throw err; },
      options: { fallbackError: "fallback", track: vi.fn() },
    }));

    await host.current.run();
    await flush();

    expect(host.current.error).toBe("Upgrade to Plus");
  });

  it("sets the friendly fallbackError for a non-paywall error", async () => {
    const onPaywall = vi.fn();
    const host = makeHost(() => ({
      fn: async () => { throw new Error(""); },
      options: { fallbackError: "Couldn't create that — try again.", onPaywall, track: vi.fn() },
    }));

    await host.current.run();
    await flush();

    expect(onPaywall).not.toHaveBeenCalled();
    expect(host.current.error).toBe("Couldn't create that — try again.");
  });
});
