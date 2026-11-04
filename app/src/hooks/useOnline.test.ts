/**
 * B-DATA-14 — the kept-on-this-phone receipt follows the connection LIVE:
 * useOnline subscribes to the window online/offline events, so when a phone
 * reconnects React re-renders and the line switches from "…when you're back
 * online" to "Still sending…" without waiting for some other re-render.
 * React's useSyncExternalStore is captured at its boundary (no DOM here).
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ subscribe: null as null | ((cb: () => void) => () => void), getSnapshot: null as null | (() => boolean), getServerSnapshot: null as null | (() => boolean) }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useSyncExternalStore: (subscribe: (cb: () => void) => () => void, getSnapshot: () => boolean, getServerSnapshot?: () => boolean) => {
    store.subscribe = subscribe; store.getSnapshot = getSnapshot; store.getServerSnapshot = getServerSnapshot ?? null;
    return getSnapshot();
  },
}));

import { useOnline } from "./useSyncStatus";
import { savedOnPhoneKey } from "../lib/firestoreWrite";

afterEach(() => { vi.unstubAllGlobals(); });

describe("B-DATA-14 — useOnline", () => {
  it("re-renders on the online/offline events and reads navigator.onLine each time", () => {
    const nav = { onLine: false };
    const win = new EventTarget();
    vi.stubGlobal("navigator", nav); vi.stubGlobal("window", win);
    expect(useOnline()).toBe(false);
    expect(savedOnPhoneKey(store.getSnapshot!())).toBe("elev.sync.savedOnPhone");
    const rerender = vi.fn();
    const unsubscribe = store.subscribe!(rerender);
    nav.onLine = true; win.dispatchEvent(new Event("online"));
    expect(rerender).toHaveBeenCalledTimes(1);
    expect(savedOnPhoneKey(store.getSnapshot!())).toBe("elev.sync.savedOnPhoneSending");
    nav.onLine = false; win.dispatchEvent(new Event("offline"));
    expect(rerender).toHaveBeenCalledTimes(2);
    unsubscribe(); win.dispatchEvent(new Event("online"));
    expect(rerender).toHaveBeenCalledTimes(2);
  });

  it("no server-only default: the first render reads the real connection too", () => {
    vi.stubGlobal("navigator", { onLine: false });
    useOnline();
    expect(store.getServerSnapshot?.()).toBe(false);
  });
});

describe("B-DATA-14 — the receipts read the live connection", () => {
  it("Now and the record receipt pick the line from useOnline(), never a stale render-time read", () => {
    for (const file of ["../components/companion/NowView.tsx", "../components/overview/FromRecordCard.tsx", "../components/overview/TodaySayBackLine.tsx", "../components/plans/RoutineRunBoard.tsx", "../components/plans/RoutinesCard.tsx"]) {
      const src = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(src, file).toContain("const online = useOnline();");
      expect(src, file).toContain("savedOnPhoneKey(online)");
      expect(src, file).not.toContain("savedOnPhoneKey()");
    }
  });
});
