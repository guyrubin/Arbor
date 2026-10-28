import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ActionLoopEntry } from "../../actionLoop/model";
import { STUDIO_WORLDS } from "../practice/studioWorlds";
import { nextChosenAction, shelvesForQuestion, STORY_DOORS, WORLD_ART } from "./companionChoices";

const row = (id: string, date: string, extra: Partial<ActionLoopEntry> & { topicId?: string } = {}): ActionLoopEntry => ({
  id, acceptedAt: date, recommendation: `Try ${id}`, source: "coach", capacity: "tiny", status: "accepted", ...extra,
});

describe("Now's parent-chosen step", () => {
  it("keeps an open choice across midnight rather than manufacturing today's task", () => {
    const chosen = row("last-week", "2026-10-01T10:00:00Z");
    expect(nextChosenAction([chosen])).toEqual(chosen);
  });
  it("never revives a completed or replaced step", () => {
    expect(nextChosenAction([row("done", "2026-10-08", { status: "completed" }), row("replaced", "2026-10-09", { status: "superseded" })])).toBeNull();
  });
  it("never re-asks a row that already carries an outcome even if its status is stale", () => {
    expect(nextChosenAction([row("already-rated", "2026-10-09", { outcome: "helped" })])).toBeNull();
  });
  it("gives the selected question's step precedence over a newer unrelated choice", () => {
    const linked = row("linked", "2026-10-01", { topicId: "question-a" });
    const unrelated = row("other", "2026-10-07", { topicId: "question-b" });
    expect(nextChosenAction([unrelated, linked], "question-a")).toEqual(linked);
    expect(nextChosenAction([linked, unrelated])).toEqual(unrelated);
  });
  // v3 question continuity (audit #3): the review's P0 "drawing question inherits morning plan".
  it("with a question set and nothing linked, returns null rather than a previous question's step", () => {
    const mornings = row("mornings-step", "2026-10-07", { topicId: "question-mornings" });
    const unlinked = row("old-coach-step", "2026-10-08");
    expect(nextChosenAction([mornings, unlinked], "question-drawing")).toBeNull();
    expect(nextChosenAction([mornings, unlinked])).toEqual(unlinked);
  });
  it("ignores blank recommendations and never mutates the ledger's ordering", () => {
    const rows = [row("old", "2026-10-01"), row("new", "2026-10-07"), row("blank", "2026-10-08", { recommendation: "  " })];
    expect(nextChosenAction(rows)?.id).toBe("new");
    expect(rows.map((item) => item.id)).toEqual(["old", "new", "blank"]);
  });
});

describe("the active question's shelves (audit #3)", () => {
  it("maps a question's guide areas to parent shelves in both languages, splitting body by what the guide pictures", () => {
    expect(shelvesForQuestion("Mornings end in a fight")).toEqual(["hands", "family"]);
    expect(shelvesForQuestion("הבקרים נגמרים בריב")).toEqual(["hands", "family"]);
    expect(shelvesForQuestion("Bedtime takes forever")).toEqual(["sleep", "family"]);
    expect(shelvesForQuestion("He will not eat dinner")).toEqual(["food", "family"]);
  });
  it("is empty when the question names no guide, so the loop keeps its own order", () => {
    expect(shelvesForQuestion("Why does he hum?")).toEqual([]);
    expect(shelvesForQuestion(null)).toEqual([]);
  });
});

describe("Together preview assets", () => {
  it("has a real preview asset for every existing age-filtered world", () => {
    for (const world of STUDIO_WORLDS) expect(existsSync(resolve("public/visuals/cards", `game-${WORLD_ART[world.id]}.png`)), world.id).toBe(true);
  });
  it("keeps all story formats reachable and every card image present", () => {
    expect(STORY_DOORS.map((door) => door.tab)).toEqual(["stories", "bedtime-stories", "comics", "family"]);
    for (const door of STORY_DOORS) expect(existsSync(resolve("public", door.art.slice(1))), door.id).toBe(true);
  });
});
