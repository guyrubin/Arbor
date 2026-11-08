import { afterEach, describe, expect, it, vi } from "vitest";
import { api, __resetImageAllowance, noteImageAllowance, sceneImagesOff, setAuthTokenProvider } from "./api";

afterEach(() => { vi.unstubAllGlobals(); setAuthTokenProvider(async () => null); __resetImageAllowance(); });

describe("entitlement request cancellation", () => {
  it("does not dispatch an old-account request when its token resolves after abort", async () => {
    let token: (value: string) => void = () => undefined;
    setAuthTokenProvider(() => new Promise<string>((resolve) => { token = resolve; }));
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    const result = api.entitlement(controller.signal).catch((error: unknown) => error);
    controller.abort();
    token("synthetic-old-account-token");
    expect(await result).toBeInstanceOf(Error);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("passes the abort signal and ignores a late response's image allowance", async () => {
    setAuthTokenProvider(async () => "synthetic-account-token");
    let respond: (value: Response) => void = () => undefined;
    const fetch = vi.fn(() => new Promise<Response>((resolve) => { respond = resolve; }));
    vi.stubGlobal("fetch", fetch);
    noteImageAllowance({ perDay: 0, perMonth: 0 });
    const controller = new AbortController();
    const pending = api.entitlement(controller.signal);
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(fetch).toHaveBeenCalledWith("/api/entitlement", expect.objectContaining({ signal: controller.signal }));
    controller.abort();
    respond(new Response(JSON.stringify({ plan: "plus", imageAllowance: { perDay: 10, perMonth: 100 } }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await pending;
    expect(sceneImagesOff()).toBe(true);
  });
});
