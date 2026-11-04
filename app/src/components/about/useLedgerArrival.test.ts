import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* B-CAREPRO-38 r2 (critic P1) — arriving on #/memory opened the ledger and
   scrolled to it on EVERY render: the effect was keyed on useHashQuery()'s
   URLSearchParams, a new object each render, so the toggle could not close
   and an area sheet opening and closing threw the page back to the ledger.
   The hook now opens and scrolls ONCE per arrival; then the toggle owns it.
   A minimal hook runtime: state persists across renders, an effect runs only
   when its deps change (React's rule), effects run after the render. */

const rt = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, pending: [] as Array<() => void> }));
vi.mock("react", () => ({
  useState: (init: unknown) => {
    const i = rt.cursor++;
    if (!(i in rt.slots)) rt.slots[i] = { v: typeof init === "function" ? (init as () => unknown)() : init };
    const slot = rt.slots[i];
    return [slot.v, (next: unknown) => { slot.v = typeof next === "function" ? (next as (v: unknown) => unknown)(slot.v) : next; }];
  },
  useRef: (init: unknown) => {
    const i = rt.cursor++;
    if (!(i in rt.slots)) rt.slots[i] = { current: init };
    return rt.slots[i];
  },
  useEffect: (fn: () => void | (() => void), deps: unknown[]) => {
    const i = rt.cursor++;
    const old = rt.slots[i];
    if (old && deps.length === old.deps.length && deps.every((d, k) => Object.is(d, old.deps[k]))) return;
    const slot = { deps, cleanup: undefined as void | (() => void) };
    rt.slots[i] = slot;
    rt.pending.push(() => { old?.cleanup?.(); slot.cleanup = fn(); });
  },
}));

import { useLedgerArrival } from "./useLedgerArrival";

const scroll = vi.fn();
const render = (asked: boolean, section: string | null) => {
  rt.cursor = 0;
  const out = useLedgerArrival(asked, section, scroll);
  rt.pending.splice(0).forEach((run) => run());
  return out;
};

beforeEach(() => { rt.slots = []; rt.pending = []; scroll.mockReset(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("B-CAREPRO-38 · the ledger opens once per arrival, then the toggle owns it", () => {
  it("arriving on #/memory: open, and ONE scroll to the ledger after the page settles", () => {
    expect(render(true, null)[0]).toBe(true);
    vi.advanceTimersByTime(300);
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it("a re-render (an area sheet opening and closing) never scrolls back, and the toggle closes", () => {
    render(true, null);
    vi.advanceTimersByTime(300);
    for (let i = 0; i < 4; i += 1) { render(true, null); vi.advanceTimersByTime(300); }
    expect(scroll).toHaveBeenCalledTimes(1);
    const [, toggle] = render(true, null);
    toggle();
    expect(render(true, null)[0]).toBe(false);
    render(true, null);
    vi.advanceTimersByTime(300);
    expect(render(true, null)[0]).toBe(false);
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it("?section=coach opens the ledger and leaves the scroll to the coach's panel", () => {
    expect(render(true, "coach")[0]).toBe(true);
    vi.advanceTimersByTime(300);
    expect(scroll).not.toHaveBeenCalled();
  });

  it("on #/profile it starts closed; leaving and arriving again is a new arrival", () => {
    expect(render(false, null)[0]).toBe(false);
    render(true, null);
    vi.advanceTimersByTime(300);
    expect(render(true, null)[0]).toBe(true);
    const [, toggle] = render(true, null);
    toggle();
    render(false, null);
    render(true, null); // the arrival's effect opens it after this render
    expect(render(true, null)[0]).toBe(true);
    vi.advanceTimersByTime(300);
    expect(scroll).toHaveBeenCalledTimes(2);
  });

  it("NEGATIVE CONTROL: keyed on a fresh object each render (the r1 bug), the same runtime re-opens and re-scrolls", () => {
    // what the old effect did: deps = [asked, new URLSearchParams()] → runs every render
    let open = true, scrolls = 0;
    const effect = (deps: unknown[]) => {
      const i = rt.cursor++;
      const old = rt.slots[i];
      if (old && deps.every((d, k) => Object.is(d, old.deps[k]))) return;
      rt.slots[i] = { deps };
      open = true; scrolls += 1;
    };
    for (let n = 0; n < 3; n += 1) { rt.cursor = 0; effect([true, new URLSearchParams()]); open = false; }
    expect(scrolls).toBe(3);
    expect(open).toBe(false);
  });
});
