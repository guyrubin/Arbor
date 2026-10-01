import { describe, expect, it } from "vitest";
import { activeActionFor, isTodayActionId, latestAction, nextTodayActionId, planAcceptedAction, sortActionLoop, todayActionId, type ActionLoopEntry } from "./model";

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

// B-AI-05 — the ledger keeps history: an accept never overwrites a row.
describe("B-AI-05 — accept keeps history", () => {
  const todayId = "today.child-1.2026-10-01";
  const at = new Date("2026-10-01T18:00:00Z");

  it("a second accept the same day never overwrites a completed row (2 docs)", () => {
    const rated: ActionLoopEntry = {
      id: todayId, recommendation: "Two-minute warning", source: "digest", capacity: "standard",
      status: "completed", acceptedAt: "2026-10-01T08:00:00Z", outcome: "helped", outcomeAt: "2026-10-01T12:00:00Z",
    };
    const { entry, superseded } = planAcceptedAction([rated], { recommendation: " Read together ", source: "learn-read", capacity: "tiny" }, todayId, at);
    expect(entry.id).toBe(`${todayId}.2`);
    expect(entry.id).not.toBe(rated.id);
    expect(entry.recommendation).toBe("Read together");
    expect(superseded).toEqual([]);
    const ledger = [rated, entry];
    expect(ledger).toHaveLength(2);
    expect(ledger.find((e) => e.id === todayId)?.outcome).toBe("helped");
  });

  it("keeps at most one accepted row per child: the newer accept supersedes an unrated one", () => {
    const yesterday: ActionLoopEntry = { ...entry("today.child-1.2026-09-30", "2026-09-30T19:00:00Z") };
    const morning: ActionLoopEntry = { ...entry(todayId, "2026-10-01T07:00:00Z") };
    const { entry: next, superseded } = planAcceptedAction([yesterday, morning], { recommendation: "Coach step", source: "coach", capacity: "standard" }, todayId, at);
    expect(next.id).toBe(`${todayId}.2`);
    expect(superseded.map((s) => [s.id, s.status])).toEqual([[yesterday.id, "superseded"], [todayId, "superseded"]]);
    const ledger = [...superseded, next];
    expect(ledger.filter((e) => e.status === "accepted")).toHaveLength(1);
  });

  it("a rated row is never superseded", () => {
    const rated: ActionLoopEntry = { ...entry(todayId, "2026-10-01T07:00:00Z"), status: "completed", outcome: "not_today" };
    expect(planAcceptedAction([rated], { recommendation: "x", source: "plan", capacity: "tiny" }, todayId, at).superseded).toEqual([]);
  });

  it("the next id skips taken suffixes", () => {
    const items = [entry(todayId, "2026-10-01T07:00:00Z"), entry(`${todayId}.2`, "2026-10-01T08:00:00Z")];
    expect(nextTodayActionId(items, todayId)).toBe(`${todayId}.3`);
    expect(nextTodayActionId([], todayId)).toBe(todayId);
  });

  it("today's active step is the newest non-superseded row of today's day key", () => {
    const rated: ActionLoopEntry = { ...entry(todayId, "2026-10-01T07:00:00Z"), status: "completed", outcome: "helped" };
    const newer = entry(`${todayId}.2`, "2026-10-01T09:00:00Z");
    const old: ActionLoopEntry = { ...entry("today.child-1.2026-09-30", "2026-09-30T09:00:00Z") };
    expect(activeActionFor([rated, newer, old], todayId)?.id).toBe(`${todayId}.2`);
    expect(activeActionFor([rated, { ...newer, status: "superseded" }], todayId)?.id).toBe(todayId);
    expect(isTodayActionId(`${todayId}.2`, todayId)).toBe(true);
    expect(isTodayActionId("today.child-1.2026-10-011", todayId)).toBe(false);
  });

  it("the hard-moment offer books as hard-moment, never today-guidance", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const src = readFileSync(fileURLToPath(new URL("../components/overview/HardMomentTodayOffer.tsx", import.meta.url)), "utf8");
    expect(src).toContain('"standard", "hard-moment")');
    expect(src).not.toContain('"today-guidance"');
  });
});
