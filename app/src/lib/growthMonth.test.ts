import { describe, expect, it } from "vitest";
import { monthReviewSeenKey } from "./growthMonth";
import { isChildScopedKey } from "./childLocalState";

describe("retired month-review key compatibility", () => {
  it("retains the exact old key shape for child-local cleanup, without a writer", () => {
    const key = monthReviewSeenKey("child-a", "2026-10");
    expect(key).toBe("arbor.growth.month.seen.2026-10.child-a");
    expect(isChildScopedKey(key, "child-a")).toBe(true);
    expect(isChildScopedKey(key, "child-b")).toBe(false);
  });
  it("continues to distinguish months and child ids", () => {
    expect(monthReviewSeenKey("child-a", "2026-10")).not.toBe(monthReviewSeenKey("child-a", "2026-09"));
    expect(monthReviewSeenKey("child-a", "2026-10")).not.toBe(monthReviewSeenKey("child-b", "2026-10"));
  });
});
