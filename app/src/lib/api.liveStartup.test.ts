import { afterEach, describe, expect, it, vi } from "vitest";
import { api, setAuthTokenProvider } from "./api";

afterEach(() => { setAuthTokenProvider(async () => null); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("Live startup token request", () => {
  it("bounds a stalled request and aborts its fetch", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url, opts) => { signal = opts.signal; return new Promise(() => {}); }));
    const pending = api.liveToken();
    const rejected = expect(pending).rejects.toThrow("live-token-timeout");
    await vi.advanceTimersByTimeAsync(10_000); await rejected;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels while authentication is pending and never sends the late request", async () => {
    let release!: (token: string) => void;
    setAuthTokenProvider(() => new Promise((resolve) => { release = resolve; }));
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const owner = new AbortController();
    const pending = api.liveToken({}, { signal: owner.signal });
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    owner.abort(); await rejected;
    release("synthetic-token"); await Promise.resolve(); await Promise.resolve();
    expect(fetch).not.toHaveBeenCalled();
  });
});
