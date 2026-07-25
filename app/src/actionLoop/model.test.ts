import { describe, expect, it } from "vitest";
import { latestAction, sortActionLoop, todayActionId, type ActionLoopEntry } from "./model";

const entry = (id: string, acceptedAt: string): ActionLoopEntry => ({ id, acceptedAt, recommendation: id, source: "today-guidance", capacity: "standard", status: "accepted" });

describe("action loop model", () => {
  it("uses one stable action id per child and day", () => {
    expect(todayActionId("child-1", new Date("2026-07-22T18:00:00Z"))).toBe("today.child-1.2026-07-22");
  });
  it("selects the newest action without mutating input", () => {
    const items = [entry("old", "2026-07-20T10:00:00Z"), entry("new", "2026-07-22T10:00:00Z")];
    expect(latestAction(items)?.id).toBe("new");
    expect(sortActionLoop(items).map((item) => item.id)).toEqual(["new", "old"]);
    expect(items[0].id).toBe("old");
  });

  // AIX-S6: digest provenance is a first-class source — an entry accepted from
  // the weekly digest's AI tryThisWeek text sorts and resolves like any other.
  it("accepts digest-provenance entries", () => {
    const digestEntry: ActionLoopEntry = { ...entry("digest-step", "2026-07-23T10:00:00Z"), source: "digest" };
    const items = [entry("guidance-step", "2026-07-22T10:00:00Z"), digestEntry];
    expect(latestAction(items)?.source).toBe("digest");
    expect(sortActionLoop(items)[0].id).toBe("digest-step");
  });
});
