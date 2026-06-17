import { describe, expect, it } from "vitest";
import { evaluateCosmetics, COSMETICS, type CosmeticStats } from "./cosmetics";

const stats = (over: Partial<CosmeticStats> = {}): CosmeticStats => ({
  totalSessions: 0,
  streakDays: 0,
  domainsTouched: 0,
  ...over,
});

describe("evaluateCosmetics", () => {
  it("unlocks nothing at zero except sets a reachable next reward", () => {
    const s = evaluateCosmetics(stats());
    expect(s.unlocked).toHaveLength(0);
    expect(s.activeFrame).toBeNull();
    expect(s.next?.cosmetic.id).toBe("sprout-frame"); // remaining 1, the nearest
    expect(s.next?.remaining).toBe(1);
  });

  it("unlocks thresholds that are met and reports the nearest next", () => {
    const s = evaluateCosmetics(stats({ totalSessions: 12, streakDays: 3, domainsTouched: 3 }));
    const ids = s.unlocked.map((c) => c.id);
    expect(ids).toContain("sprout-frame");    // 12 ≥ 1
    expect(ids).toContain("bloom-frame");     // 12 ≥ 10
    expect(ids).toContain("steady-title");    // streak 3
    expect(ids).toContain("explorer-badge");  // domains 3
    expect(ids).not.toContain("star-frame");  // needs 25
    // Active frame is the most-committed earned frame (Bloom > Sprout).
    expect(s.activeFrame?.id).toBe("bloom-frame");
  });

  it("picks the closest locked reward as next (by remaining)", () => {
    // totalSessions 24 → star-frame needs 1 more; streak 0 → devoted needs 7.
    const s = evaluateCosmetics(stats({ totalSessions: 24, domainsTouched: 5, streakDays: 0 }));
    expect(s.next?.cosmetic.id).toBe("star-frame");
    expect(s.next?.remaining).toBe(1);
    expect(s.next?.progress).toBeCloseTo(24 / 25, 5);
  });

  it("returns next=null and the top frame when everything is earned", () => {
    const max = Math.max(...COSMETICS.map((c) => c.threshold));
    const s = evaluateCosmetics(stats({ totalSessions: max, streakDays: max, domainsTouched: max }));
    expect(s.locked).toHaveLength(0);
    expect(s.next).toBeNull();
    expect(s.activeFrame?.id).toBe("tree-frame"); // last/most-committed frame
  });
});
