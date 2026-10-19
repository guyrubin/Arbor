import { afterEach, describe, expect, it, vi } from "vitest";
import { capturePurchaseIntent, clearPurchaseIntent, parsePurchaseIntent, readPurchaseIntent } from "./purchaseIntent";

afterEach(() => { clearPurchaseIntent(); vi.unstubAllGlobals(); });
describe("marketing purchase intent", () => {
  it.each(["monthly", "annual"])("retains an explicit %s choice through setup without buying", cadence => {
    const storage = new Map<string, string>();
    vi.stubGlobal("sessionStorage", { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
    const replaceState = vi.fn();
    vi.stubGlobal("window", { location: { search: `?plan=plus&cadence=${cadence}&utm_source=site`, href: `https://arborparentingapp.com/?plan=plus&cadence=${cadence}&utm_source=site#/overview` }, history: { replaceState } });
    capturePurchaseIntent();
    expect(readPurchaseIntent()).toEqual({ plan: "plus", cadence });
    expect(readPurchaseIntent()).toEqual({ plan: "plus", cadence });
    expect(replaceState).toHaveBeenCalledWith({}, "", "/?utm_source=site#/overview");
    clearPurchaseIntent(); expect(readPurchaseIntent()).toBeNull();
  });
  it.each(["", "?plan=family&cadence=monthly", "?plan=plus", "?plan=plus&cadence=weekly"])("ignores incomplete or unsupported selection %s", search => {
    expect(parsePurchaseIntent(search)).toBeNull();
  });
  it("ignores expired persisted selections", () => {
    vi.stubGlobal("sessionStorage", { getItem: () => JSON.stringify({ plan: "plus", cadence: "monthly", at: Date.now() - 86400001 }), removeItem: vi.fn() });
    expect(readPurchaseIntent()).toBeNull();
  });
});
