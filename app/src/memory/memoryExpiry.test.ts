import { describe, it, expect } from "vitest";
import { retentionToMs, isMemoryExpired } from "./memoryService.js";

const DAY = 86_400_000;

describe("memory time-boxing (SAFE-3 / G10)", () => {
  it("parses retention strings to TTLs", () => {
    expect(retentionToMs("30 days")).toBe(30 * DAY);
    expect(retentionToMs("2 weeks")).toBe(14 * DAY);
    expect(retentionToMs("6 months")).toBe(180 * DAY);
    expect(retentionToMs("1 year")).toBe(365 * DAY);
    expect(retentionToMs("session")).toBe(DAY);
    expect(retentionToMs("permanent")).toBe(Infinity);
    expect(retentionToMs(undefined)).toBe(Infinity);
    expect(retentionToMs("until the parent revokes")).toBe(Infinity); // unparseable → conservative
  });

  it("expires approved memory past its retention", () => {
    const old = new Date(Date.now() - 40 * DAY).toISOString();
    const recent = new Date(Date.now() - 5 * DAY).toISOString();
    expect(isMemoryExpired({ retention: "30 days", createdAt: old })).toBe(true);
    expect(isMemoryExpired({ retention: "30 days", createdAt: recent })).toBe(false);
    expect(isMemoryExpired({ retention: "permanent", createdAt: old })).toBe(false);
  });
});
