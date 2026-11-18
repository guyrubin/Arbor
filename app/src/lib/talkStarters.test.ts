import { describe, expect, it } from "vitest";
import type { BehaviorLog } from "../types";
import { recentRecordStarters, starterKind } from "./talkStarters";

const log = (over: Partial<BehaviorLog>): BehaviorLog => ({ id: "x", timestamp: "2026-11-10T08:00:00.000Z", behaviorType: "Moment", durationMinutes: 0, trigger: "", ...over });

describe("talk starters from the parent's own records (synthetic)", () => {
  it("takes the two most recent records, newest first, in the parent's own words", () => {
    const out = recentRecordStarters([
      log({ id: "a", timestamp: "2026-11-12T08:00:00.000Z", trigger: "Built a tower" }),
      log({ id: "b", timestamp: "2026-11-15T19:00:00.000Z", trigger: "Sang his bath song", kept: "said" }),
      log({ id: "c", timestamp: "2026-11-14T07:00:00.000Z", trigger: "Tablet turned off", behaviorType: "Sleep Meltdown", intensity: 3, response: "Named it" }),
    ]);
    expect(out.map((s) => s.id)).toEqual(["b", "c"]);
    expect(out.map((s) => s.words)).toEqual(["Sang his bath song", "Tablet turned off"]);
  });
  it("kinds follow the existing rules: incident type = hard, a kept mark = kept, else a note", () => {
    expect(starterKind({ behaviorType: "Sleep Meltdown" })).toBe("hard");
    expect(starterKind({ behaviorType: "Moment", kept: "first" })).toBe("kept");
    expect(starterKind({ behaviorType: "Moment" })).toBe("note");
  });
  it("negative controls: never an Arbor draft as the parent's words, never an empty record", () => {
    const out = recentRecordStarters([
      log({ id: "d", timestamp: "2026-11-16T08:00:00.000Z", trigger: "Drafted by Arbor", contentSource: "ai_draft" }),
      log({ id: "e", timestamp: "2026-11-16T09:00:00.000Z", trigger: "  " }),
      log({ id: "f", timestamp: "2026-11-01T09:00:00.000Z", trigger: "Puzzle done" }),
    ]);
    expect(out.map((s) => s.id)).toEqual(["f"]);
  });
  it("no records → no starters (the fixed scenarios stay)", () => {
    expect(recentRecordStarters([])).toEqual([]);
  });
});
