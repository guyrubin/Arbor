import { describe, expect, it } from "vitest";
import { recordSince } from "./milestonesModel";

describe("recordSince — the first day the loaded record holds", () => {
  const NOW = Date.parse("2026-11-16T12:00:00.000Z");
  it("is the earliest dated entry, ignoring undated and future ones", () => {
    expect(recordSince([{ at: "2026-10-14T10:00:00.000Z" }, { at: "2026-10-08T09:00:00.000Z" }, { at: "bad" }, { at: "2026-12-01T00:00:00.000Z" }], NOW))
      .toBe(Date.parse("2026-10-08T09:00:00.000Z"));
  });
  it("negative control: an empty record has no since", () => {
    expect(recordSince([], NOW)).toBeNull();
    expect(recordSince([{ at: "2027-01-01T00:00:00.000Z" }], NOW)).toBeNull();
  });
});
