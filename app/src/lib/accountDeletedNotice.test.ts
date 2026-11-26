import { afterEach, describe, expect, it, vi } from "vitest";
import { accountDeletedPending, clearAccountDeleted, markAccountDeleted, subscribeAccountDeleted } from "./accountDeletedNotice";

describe("B-STATUS-01 · the deleted-account notice", () => {
  const store = new Map<string, string>();
  afterEach(() => { clearAccountDeleted(); vi.unstubAllGlobals(); store.clear(); });
  const stubSession = () => vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k),
  });

  it("a mark reaches a screen that is already listening, and clearing tells it once", () => {
    stubSession();
    const heard = vi.fn();
    const stop = subscribeAccountDeleted(heard);
    expect(accountDeletedPending()).toBe(false);
    markAccountDeleted();
    expect(heard).toHaveBeenCalledOnce();
    expect(accountDeletedPending()).toBe(true);
    expect([...store.keys()]).toEqual(["arbor.auth.accountDeleted"]);
    clearAccountDeleted();
    clearAccountDeleted();
    expect(heard).toHaveBeenCalledTimes(2);
    expect(accountDeletedPending()).toBe(false);
    expect(store.size).toBe(0);
    stop();
    markAccountDeleted();
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it("survives a reload in the same tab, and works with storage blocked", () => {
    stubSession();
    store.set("arbor.auth.accountDeleted", "1");
    expect(accountDeletedPending()).toBe(true);
    clearAccountDeleted();
    vi.stubGlobal("sessionStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } });
    markAccountDeleted();
    expect(accountDeletedPending()).toBe(true);
    clearAccountDeleted();
    expect(accountDeletedPending()).toBe(false);
  });
});
