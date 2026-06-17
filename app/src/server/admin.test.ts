import { afterEach, describe, expect, it } from "vitest";
import { estimateCostEur, isAdmin } from "./admin.js";

const ENV_KEYS = ["ARBOR_ADMIN_UIDS", "ARBOR_ADMIN_EMAILS"];
afterEach(() => { for (const k of ENV_KEYS) delete process.env[k]; });

describe("admin gating (ADM-1)", () => {
  it("denies by default — no admins unless configured", () => {
    expect(isAdmin({ uid: "u1", email: "x@y.com" })).toBe(false);
  });

  it("grants by uid or email, case-insensitive", () => {
    process.env.ARBOR_ADMIN_UIDS = "founder-uid";
    process.env.ARBOR_ADMIN_EMAILS = "guy@example.com";
    expect(isAdmin({ uid: "founder-uid", email: null })).toBe(true);
    expect(isAdmin({ uid: "x", email: "Guy@Example.com" })).toBe(true);
    expect(isAdmin({ uid: "x", email: "other@example.com" })).toBe(false);
  });
});

describe("token cost estimate (ADM-1)", () => {
  it("prices Claude far above Gemini Flash and sums providers", () => {
    const eur = estimateCostEur({
      vertex_claude: { promptTokens: 1_000_000, outputTokens: 1_000_000 }, // 2.8 + 14 = 16.8
      vertex_gemini: { promptTokens: 1_000_000, outputTokens: 1_000_000 }, // 0.07 + 0.30 = 0.37
    });
    expect(eur).toBeCloseTo(17.17, 2);
  });

  it("ignores unknown providers and empty input", () => {
    expect(estimateCostEur(undefined)).toBe(0);
    expect(estimateCostEur({ mystery: { promptTokens: 5_000_000 } })).toBe(0);
  });
});
