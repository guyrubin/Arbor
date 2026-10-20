import { describe, it, expect } from "vitest";
import { buildHealthPayload, checkoutConfigured, checkoutMode } from "./healthz.js";

describe("buildHealthPayload (OPS-A1)", () => {
  it("returns ok status + an ISO timestamp from the injected clock", () => {
    const p = buildHealthPayload(new Date("2026-06-22T00:00:00Z"));
    expect(p.status).toBe("ok");
    expect(p.ts).toBe("2026-06-22T00:00:00.000Z");
    expect(typeof p.version).toBe("string");
    expect(typeof p.env).toBe("string");
  });

  it("prefers GITHUB_SHA for the version identity", () => {
    const prev = process.env.GITHUB_SHA;
    process.env.GITHUB_SHA = "abc123sha";
    try {
      expect(buildHealthPayload().version).toBe("abc123sha");
    } finally {
      if (prev === undefined) delete process.env.GITHUB_SHA;
      else process.env.GITHUB_SHA = prev;
    }
  });

  it("carries no child-data or secret fields", () => {
    const keys = Object.keys(buildHealthPayload());
    expect(keys.sort()).toEqual(["checkout", "checkoutMode", "env", "status", "ts", "version"]);
  });

  it("reports whether checkout is configured as a boolean, never the link", () => {
    const link = "https://pay.rev.cat/tokenvalue";
    expect(checkoutConfigured({})).toBe(false);
    expect(checkoutConfigured({ BILLING_WEB_PURCHASE_LINK: "  " })).toBe(false);
    expect(checkoutConfigured({ BILLING_WEB_PURCHASE_LINK: link })).toBe(true);
    expect(checkoutConfigured({ BILLING_URL_PLUS_ANNUAL: "https://buy.example/plus" })).toBe(true);
    const prev = process.env.BILLING_WEB_PURCHASE_LINK;
    process.env.BILLING_WEB_PURCHASE_LINK = link;
    try {
      const payload = buildHealthPayload();
      expect(payload.checkout).toBe(true);
      expect(payload.checkoutMode).toBe("live");
      expect(JSON.stringify(payload)).not.toContain("tokenvalue");
    } finally {
      if (prev === undefined) delete process.env.BILLING_WEB_PURCHASE_LINK;
      else process.env.BILLING_WEB_PURCHASE_LINK = prev;
    }
  });

  it("tells a live checkout from a test one, so a prod that declines real cards shows", () => {
    expect(checkoutMode({})).toBe("none");
    expect(checkoutMode({ BILLING_WEB_PURCHASE_LINK: "https://pay.rev.cat/tokenvalue" })).toBe("live");
    expect(checkoutMode({ BILLING_WEB_PURCHASE_LINK: "https://pay.rev.cat/sandbox/tokenvalue" })).toBe("sandbox");
    expect(checkoutMode({ BILLING_WEB_PURCHASE_LINK: " https://pay.rev.cat/sandbox/tokenvalue/ " })).toBe("sandbox");
    expect(checkoutMode({ BILLING_URL_PLUS_ANNUAL: "https://buy.stripe.com/test_abc" })).toBe("sandbox");
    expect(checkoutMode({ BILLING_URL_PLUS_ANNUAL: "https://buy.stripe.com/abc" })).toBe("live");
    // The Web Purchase Link is the one checkout uses, so it alone decides.
    expect(checkoutMode({ BILLING_WEB_PURCHASE_LINK: "https://pay.rev.cat/tokenvalue", BILLING_URL_PLUS_ANNUAL: "https://buy.stripe.com/test_abc" })).toBe("live");
    expect(checkoutMode({ BILLING_WEB_PURCHASE_LINK: "not a url" })).toBe("none");
  });
});
