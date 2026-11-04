import { afterEach, describe, expect, it, vi } from "vitest";
import { clearVerifySent, markVerifySent, subscribeVerifySent, verifySentPending } from "./signupNotice";

describe("B-RESID-05 · the sign-up confirmation-link notice", () => {
  const store = new Map<string, string>();
  afterEach(() => { clearVerifySent(); vi.unstubAllGlobals(); store.clear(); });
  const stubSession = () => vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k),
  });

  it("a mark reaches a flow that is already listening, and clearing tells it once", () => {
    stubSession();
    const heard = vi.fn();
    const stop = subscribeVerifySent(heard);
    expect(verifySentPending()).toBe(false);
    markVerifySent();
    expect(heard).toHaveBeenCalledOnce();
    expect(verifySentPending()).toBe(true);
    expect([...store.keys()]).toEqual(["arbor.auth.verifySent"]);
    clearVerifySent();
    clearVerifySent();
    expect(heard).toHaveBeenCalledTimes(2);
    expect(verifySentPending()).toBe(false);
    expect(store.size).toBe(0);
    stop();
    markVerifySent();
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it("survives a reload in the same tab, and works with storage blocked", () => {
    stubSession();
    store.set("arbor.auth.verifySent", "1");
    expect(verifySentPending()).toBe(true);
    clearVerifySent();
    vi.stubGlobal("sessionStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } });
    markVerifySent();
    expect(verifySentPending()).toBe(true);
    clearVerifySent();
    expect(verifySentPending()).toBe(false);
  });
});
