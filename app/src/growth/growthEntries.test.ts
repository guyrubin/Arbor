import { describe, it, expect } from "vitest";
import {
  isValidEntry,
  sortEntriesAsc,
  latestEntry,
  heightTrajectory,
  weightTrajectory,
  type GrowthEntry,
} from "./growthEntries";

const entry = (overrides: Partial<GrowthEntry> = {}): GrowthEntry => ({
  id: "e1",
  childId: "child-1",
  date: "2026-01-15",
  ...overrides,
});

describe("isValidEntry", () => {
  it("accepts an entry with only heightCm", () => {
    expect(isValidEntry({ heightCm: 75 })).toBe(true);
  });

  it("accepts an entry with only weightKg", () => {
    expect(isValidEntry({ weightKg: 10.5 })).toBe(true);
  });

  it("accepts an entry with only headCircumferenceCm", () => {
    expect(isValidEntry({ headCircumferenceCm: 45 })).toBe(true);
  });

  it("accepts an entry with all three measurements", () => {
    expect(isValidEntry({ heightCm: 90, weightKg: 12, headCircumferenceCm: 48 })).toBe(true);
  });

  it("rejects an entry with no measurements", () => {
    expect(isValidEntry({})).toBe(false);
  });

  it("rejects an entry where all values are undefined", () => {
    expect(isValidEntry({ heightCm: undefined, weightKg: undefined })).toBe(false);
  });

  it("rejects zero height (not a valid measurement)", () => {
    expect(isValidEntry({ heightCm: 0 })).toBe(false);
  });

  it("rejects negative weight", () => {
    expect(isValidEntry({ weightKg: -1 })).toBe(false);
  });
});

describe("sortEntriesAsc", () => {
  it("sorts entries from oldest to most recent", () => {
    const entries = [
      entry({ id: "c", date: "2026-06-01" }),
      entry({ id: "a", date: "2025-12-01" }),
      entry({ id: "b", date: "2026-03-01" }),
    ];
    const sorted = sortEntriesAsc(entries);
    expect(sorted.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the original array", () => {
    const entries = [entry({ date: "2026-06-01" }), entry({ date: "2025-01-01" })];
    const original = [...entries];
    sortEntriesAsc(entries);
    expect(entries[0].date).toBe(original[0].date);
  });

  it("returns an empty array unchanged", () => {
    expect(sortEntriesAsc([])).toEqual([]);
  });

  it("returns a single-element array unchanged", () => {
    const e = entry({ date: "2026-01-01", heightCm: 80 });
    expect(sortEntriesAsc([e])).toEqual([e]);
  });
});

describe("latestEntry", () => {
  it("returns null for an empty list", () => {
    expect(latestEntry([])).toBeNull();
  });

  it("returns the sole entry when only one exists", () => {
    const e = entry({ date: "2026-01-01" });
    expect(latestEntry([e])).toBe(e);
  });

  it("returns the entry with the latest date", () => {
    const entries = [
      entry({ id: "old", date: "2025-06-01" }),
      entry({ id: "new", date: "2026-06-01" }),
      entry({ id: "mid", date: "2026-01-15" }),
    ];
    expect(latestEntry(entries)?.id).toBe("new");
  });

  it("does not mutate the input array", () => {
    const entries = [entry({ date: "2026-06-01" }), entry({ date: "2025-01-01" })];
    const first = entries[0];
    latestEntry(entries);
    expect(entries[0]).toBe(first);
  });
});

describe("heightTrajectory", () => {
  it("returns only entries that have a heightCm, sorted ascending", () => {
    const entries = [
      entry({ id: "b", date: "2026-03-01", heightCm: 85 }),
      entry({ id: "a", date: "2025-12-01", heightCm: 80 }),
      entry({ id: "no-height", date: "2026-01-01", weightKg: 11 }),
    ];
    const traj = heightTrajectory(entries);
    expect(traj).toHaveLength(2);
    expect(traj[0]).toEqual({ date: "2025-12-01", value: 80 });
    expect(traj[1]).toEqual({ date: "2026-03-01", value: 85 });
  });

  it("returns empty when no entries have height", () => {
    expect(heightTrajectory([entry({ weightKg: 10 })])).toEqual([]);
  });
});

describe("weightTrajectory", () => {
  it("returns only entries that have a weightKg, sorted ascending", () => {
    const entries = [
      entry({ id: "b", date: "2026-06-01", weightKg: 13 }),
      entry({ id: "a", date: "2026-01-01", weightKg: 12 }),
    ];
    const traj = weightTrajectory(entries);
    expect(traj).toHaveLength(2);
    expect(traj[0]).toEqual({ date: "2026-01-01", value: 12 });
    expect(traj[1]).toEqual({ date: "2026-06-01", value: 13 });
  });

  it("returns empty when no entries have weight", () => {
    expect(weightTrajectory([entry({ heightCm: 90 })])).toEqual([]);
  });
});

describe("append-only ordering contract", () => {
  it("sortEntriesAsc preserves the append-only record: older dates always come first", () => {
    // Simulates a real append: entries added newest-first as the store upserts them.
    const stored = [
      entry({ id: "e3", date: "2026-06-01", heightCm: 90 }),
      entry({ id: "e2", date: "2026-03-01", heightCm: 87 }),
      entry({ id: "e1", date: "2025-12-01", heightCm: 82 }),
    ];
    const sorted = sortEntriesAsc(stored);
    expect(sorted.map((e) => e.date)).toEqual([
      "2025-12-01",
      "2026-03-01",
      "2026-06-01",
    ]);
  });
});
