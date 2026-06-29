import { describe, expect, it } from "vitest";
import { MemoryCounterStore } from "./quotaStore.js";

describe("usage counter store (COST-1)", () => {
  it("increments per key within a window", async () => {
    const store = new MemoryCounterStore();
    await store.increment("ai_hourly", "user-a", 60_000);
    const second = await store.increment("ai_hourly", "user-a", 60_000);
    const other = await store.increment("ai_hourly", "user-b", 60_000);
    expect(second.count).toBe(2);
    expect(other.count).toBe(1);
  });

  it("keeps separate counters per name (hourly quota vs coach meter)", async () => {
    const store = new MemoryCounterStore();
    await store.increment("ai_hourly", "user-a", 60_000);
    const coach = await store.increment("coach_daily", "user-a", 60_000);
    expect(coach.count).toBe(1);
  });

  it("peek reads without incrementing", async () => {
    const store = new MemoryCounterStore();
    await store.increment("coach_daily", "user-a", 60_000);
    const peeked = await store.peek("coach_daily", "user-a", 60_000);
    expect(peeked.count).toBe(1);
    const peekedEmpty = await store.peek("coach_daily", "nobody", 60_000);
    expect(peekedEmpty.count).toBe(0);
  });
});
