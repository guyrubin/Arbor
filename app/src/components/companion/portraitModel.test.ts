import { describe, expect, it } from "vitest";
import { buildPortraitChapters, buildPortraitEnvironments, buildPortraitThreads, portraitDiscussionPrompt } from "./portraitModel";
import type { Observation } from "../../lib/observations";
import { DOMAIN_IDS } from "../../lib/domains/registry";

const now = new Date(2026, 9, 8, 12);
function observation(id: string, at: string, extra: Partial<Observation> = {}): Observation {
  return { id, at, childId: "one", domains: ["playing"], kind: "moment", origin: "behaviorLogs", source: "parent_typed", value: { type: "moment", behaviorType: "Moment" }, ageAtObservationMonths: 60, pretermCorrected: false, ...extra };
}

describe("portrait evidence projection", () => {
  it("keeps child isolation and calendar boundaries without including future or invalid dates", () => {
    const records = [observation("a", new Date(2026, 7, 1).toISOString()), observation("b", new Date(2026, 8, 1).toISOString()), observation("c", now.toISOString()), observation("other", now.toISOString(), { childId: "two" }), observation("future", new Date(2026, 9, 9).toISOString()), observation("bad", "unknown")];
    expect(buildPortraitChapters(records, "one", now).map(c => c.observations.map(o => o.id))).toEqual([["a"], ["b"], ["c"]]);
  });
  it("year chapters cover exactly 12 months in three non-overlapping blocks", () => {
    const chapters = buildPortraitChapters([], "one", now, 12);
    expect(chapters[0].from).toEqual(new Date(2025, 10, 1));
    expect(chapters[0].until).toEqual(chapters[1].from);
    expect(chapters[1].until).toEqual(chapters[2].from);
    expect(chapters[2].until.getTime()).toBe(now.getTime() + 1);
  });
  it("preserves all eight domains and lets one actual record touch two domains", () => {
    const item = observation("one", now.toISOString(), { domains: ["playing", "talking"] });
    const threads = buildPortraitThreads(buildPortraitChapters([item], "one", now));
    expect(threads.map(t => t.domain)).toEqual(DOMAIN_IDS);
    expect(threads.find(t => t.domain === "playing")?.cells[2]).toEqual([item]);
    expect(threads.find(t => t.domain === "talking")?.cells[2]).toEqual([item]);
    expect(threads.find(t => t.domain === "moving")?.cells).toEqual([[], [], []]);
  });
  it("full record includes older years without borrowing another child's history", () => {
    const oldest = observation("old", new Date(2022, 0, 12).toISOString());
    const other = observation("other", new Date(2020, 0, 12).toISOString(), { childId: "two" });
    const chapters = buildPortraitChapters([oldest, other, observation("new", now.toISOString())], "one", now, 0);
    expect(chapters.flatMap(chapter => chapter.observations).map(o => o.id)).toEqual(["old", "new"]);
    expect(chapters[0].from).toEqual(new Date(2021, 10, 1));
  });
  it("does not guess an environment from a quote or a practice title", () => {
    const records = [observation("a", now.toISOString(), { value: { type: "moment", behaviorType: "Moment", context: "Home" } }), observation("b", now.toISOString(), { value: { type: "goal_note", goalId: "x", text: "Played at school" } })];
    expect(buildPortraitEnvironments(records).map(g => [g.context, g.observations.map(o => o.id)])).toEqual([["Home", ["a"]], ["unspecified", ["b"]]]);
  });
  it("creates a discussion seed from selected domains only", () => {
    const prompt = portraitDiscussionPrompt(["playing", "playing"], () => "Playing with others", false);
    expect(prompt.match(/Playing with others/g)).toHaveLength(1);
    expect(prompt).toContain("without drawing conclusions");
  });
});
