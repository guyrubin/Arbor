/**
 * B-BOOK-75 (plates painted in-product) — the device side of a shared-storage
 * plate: read ONCE with the app's bearer token, shown as a blob: URL; a 404
 * (unpainted) yields null so the renderer keeps today's behaviour (the route
 * stays in the chain, the <img> errors, the page advances). Static plates
 * never go through the loader.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { setAuthTokenProvider } from "../api";
import { loadPlanPlateUrl, resetPlanPlateSources } from "./planPlateSource";

describe("loadPlanPlateUrl", () => {
  afterEach(() => { resetPlanPlateSources(); vi.unstubAllGlobals(); setAuthTokenProvider(async () => null); });

  it("fetches with the bearer token, no JSON content type, and caches the blob URL per plate", async () => {
    setAuthTokenProvider(async () => "tok-1");
    const fetchMock = vi.fn(async () => new Response(new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const create = vi.fn(() => "blob:plate-1");
    vi.stubGlobal("URL", Object.assign(Object.create(URL), { createObjectURL: create }));
    expect(await loadPlanPlateUrl("/api/plans/plates/plan-poo-sit/PP1")).toBe("blob:plate-1");
    expect(await loadPlanPlateUrl("/api/plans/plates/plan-poo-sit/PP1")).toBe("blob:plate-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const headers = (fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }])[1].headers;
    expect(headers.Authorization).toBe("Bearer tok-1");
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("an unpainted plate (404) is null and is asked again next time; a network error is null", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await loadPlanPlateUrl("/api/plans/plates/plan-poo-sit/PP2")).toBeNull();
    expect(await loadPlanPlateUrl("/api/plans/plates/plan-poo-sit/PP2")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await loadPlanPlateUrl("/api/plans/plates/plan-poo-sit/PP3")).toBeNull();
  });
});
