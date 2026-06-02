import { describe, expect, it } from "vitest";
import { detectPatterns } from "./patterns.js";
import type { BehaviorLog } from "../types.js";

const log = (over: Partial<BehaviorLog>): BehaviorLog => ({
  id: Math.random().toString(36).slice(2),
  timestamp: "2026-05-20T08:00:00Z",
  behaviorType: "Transition Refusal",
  intensity: 3,
  durationMinutes: 10,
  trigger: "leaving for school",
  response: "named the feeling",
  ...over
});

describe("detectPatterns (K-09)", () => {
  it("returns nothing without enough data", () => {
    expect(detectPatterns([log({}), log({})])).toEqual([]);
  });

  it("flags the most frequent behavior type", () => {
    const logs = [log({}), log({}), log({}), log({ behaviorType: "Sensory Overload" })];
    const frequent = detectPatterns(logs).find((p) => p.kind === "frequent");
    expect(frequent?.title).toContain("Transition Refusal");
  });

  it("flags rising intensity over time", () => {
    const logs = [
      log({ timestamp: "2026-05-01T08:00:00Z", intensity: 2 }),
      log({ timestamp: "2026-05-02T08:00:00Z", intensity: 2 }),
      log({ timestamp: "2026-05-10T08:00:00Z", intensity: 4 }),
      log({ timestamp: "2026-05-11T08:00:00Z", intensity: 5 })
    ];
    expect(detectPatterns(logs).some((p) => p.kind === "rising")).toBe(true);
  });

  it("flags a recurring trigger keyword", () => {
    const logs = [
      log({ trigger: "leaving for school in the morning" }),
      log({ trigger: "school dropoff was hard" }),
      log({ trigger: "going to school again" })
    ];
    const recurring = detectPatterns(logs).find((p) => p.kind === "recurring_trigger");
    expect(recurring?.title.toLowerCase()).toContain("school");
  });
});
