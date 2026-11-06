import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { buildHealthPayload, checkoutConfigured, checkoutMode } from "./healthz.js";
import { verifyCheckoutLink } from "./checkoutConfiguration.js";

vi.mock("./checkoutConfiguration.js", () => ({ verifyCheckoutLink: vi.fn() }));

beforeEach(() => {
  vi.mocked(verifyCheckoutLink).mockReset();
  vi.mocked(verifyCheckoutLink).mockResolvedValue("unverified");
  for (const name of ["BILLING_WEB_PURCHASE_LINK", "BILLING_URL_PLUS_MONTHLY", "BILLING_URL_PLUS_ANNUAL"]) {
    vi.stubEnv(name, undefined);
  }
});
afterEach(() => vi.unstubAllEnvs());

describe("buildHealthPayload (OPS-A1)", () => {
  it("returns liveness and release identity even without verified checkout", async () => {
    vi.stubEnv("GITHUB_SHA", "abc123sha");
    const payload = await buildHealthPayload(new Date("2026-06-22T00:00:00Z"));
    expect(payload).toMatchObject({ status: "ok", version: "abc123sha", checkout: false, checkoutMode: "none" });
    expect(payload.ts).toBe("2026-06-22T00:00:00.000Z");
    expect(typeof payload.env).toBe("string");
  });

  it("exposes only sanitized mode and build identity, never links, keys or child data", async () => {
    vi.stubEnv("BILLING_WEB_PURCHASE_LINK", "https://pay.rev.cat/opaque-token");
    vi.mocked(verifyCheckoutLink).mockResolvedValue("sandbox");
    const payload = await buildHealthPayload();
    expect(Object.keys(payload).sort()).toEqual(["checkout", "checkoutMode", "env", "status", "ts", "version"]);
    expect(payload).toMatchObject({ checkout: true, checkoutMode: "sandbox" });
    expect(JSON.stringify(payload)).not.toMatch(/opaque-token|api_key|rcb_/);
  });

  it("reports configured destinations separately from verified payment availability", () => {
    expect(checkoutConfigured({})).toBe(false);
    expect(checkoutConfigured({ BILLING_WEB_PURCHASE_LINK: "  " })).toBe(false);
    expect(checkoutConfigured({ BILLING_WEB_PURCHASE_LINK: "https://pay.rev.cat/opaque-token" })).toBe(true);
    expect(checkoutConfigured({ BILLING_URL_PLUS_ANNUAL: "https://buy.example/plus" })).toBe(true);
    expect(checkoutConfigured({ BILLING_URL_FAMILY_ANNUAL: "https://buy.example/family" })).toBe(false);
  });
});

describe("checkout mode reflects the provider, not URL spelling", () => {
  it.each(["live", "sandbox", "unverified", "none"] as const)("preserves provider result %s for an opaque token", async (mode) => {
    vi.mocked(verifyCheckoutLink).mockResolvedValue(mode);
    expect(await checkoutMode({ BILLING_WEB_PURCHASE_LINK: "https://pay.rev.cat/opaque-token" })).toBe(mode);
  });

  it("checks only the Web Purchase Link when it overrides per-plan fallbacks", async () => {
    vi.mocked(verifyCheckoutLink).mockResolvedValue("sandbox");
    expect(await checkoutMode({
      BILLING_WEB_PURCHASE_LINK: " https://pay.rev.cat/opaque-token ",
      BILLING_URL_PLUS_ANNUAL: "https://buy.stripe.com/other",
    })).toBe("sandbox");
    expect(verifyCheckoutLink).toHaveBeenCalledTimes(1);
    expect(vi.mocked(verifyCheckoutLink).mock.calls[0][0]).toBe("https://pay.rev.cat/opaque-token");
  });

  it.each(["sandbox", "unverified", "none"] as const)("cannot report live if a sold fallback is %s", async (mode) => {
    vi.mocked(verifyCheckoutLink).mockResolvedValueOnce("live").mockResolvedValueOnce(mode);
    expect(await checkoutMode({
      BILLING_URL_PLUS_MONTHLY: "https://buy.stripe.com/monthly",
      BILLING_URL_PLUS_ANNUAL: "https://buy.stripe.com/annual",
    })).toBe(mode);
  });

  it("does not call the provider when no checkout is configured", async () => {
    expect(await checkoutMode({})).toBe("none");
    expect(verifyCheckoutLink).not.toHaveBeenCalled();
  });
});
