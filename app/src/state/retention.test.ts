import { describe, expect, it } from "vitest";
import { retentionDays, isRetentionExpired } from "./retention.js";

describe("retentionDays (K-04)", () => {
  it("parses durations and keep-forever phrases", () => {
    expect(retentionDays("keep for 30 days")).toBe(30);
    expect(retentionDays("2 weeks")).toBe(14);
    expect(retentionDays("3 months")).toBe(90);
    expect(retentionDays("until the parent removes it")).toBeNull();
    expect(retentionDays("just this session")).toBe(1);
  });
  it("defaults conservatively when unclear", () => {
    expect(retentionDays("some vague note")).toBe(90);
  });
});

describe("isRetentionExpired (K-04)", () => {
  const now = new Date("2026-06-02T00:00:00Z");
  it("expires items past their window", () => {
    expect(isRetentionExpired("30 days", "2026-01-01T00:00:00Z", now)).toBe(true);
    expect(isRetentionExpired("30 days", "2026-05-20T00:00:00Z", now)).toBe(false);
  });
  it("never expires keep-until-removed items", () => {
    expect(isRetentionExpired("until removed", "2000-01-01T00:00:00Z", now)).toBe(false);
  });
});
