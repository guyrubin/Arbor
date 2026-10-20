import { describe, it, expect } from "vitest";
import { buildHealthPayload, checkoutConfigured } from "./healthz.js";

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
    expect(keys.sort()).toEqual(["checkout", "env", "status", "ts", "version"]);
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
      expect(JSON.stringify(payload)).not.toContain("tokenvalue");
    } finally {
      if (prev === undefined) delete process.env.BILLING_WEB_PURCHASE_LINK;
      else process.env.BILLING_WEB_PURCHASE_LINK = prev;
    }
  });
});
