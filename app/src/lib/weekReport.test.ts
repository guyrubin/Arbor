import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DOMAIN_IDS, type DomainId } from "./domains/registry";
import type { Observation } from "./observations";
import {
  WEEK_STEPS_MAX,
  WEEK_WORDS_MAX,
  WEEK_WORD_MAX_CHARS,
  kidWorldOf,
  topHelpedStep,
  weekReportLines,
  weekStepLines,
  type WeekStepLine,
} from "./weekReport";

/**
 * v3 F-NOW-3 — lib/weekReport: the LINES of the Weekly report (the tiles'
 * sub-lines, What helped, the child's words, By area) for one bounded report
 * week. Counts only: the parent's records, the outcomes the parent marked, the
 * child's Kid Mode sessions. Invented examples only.
 */
const START = new Date(2026, 9, 10).getTime();
const END = new Date(2026, 9, 14, 15).getTime();
const on = (day: number, hour: number) => new Date(2026, 9, 10 + day, hour).toISOString();
let seq = 0;
function obs(over: Partial<Observation> & { at: string }): Observation {
  seq += 1;
  return {
    id: `behaviorLogs:invented-${seq}`, childId: "child-invented", domains: [] as DomainId[], kind: "moment",
    value: { type: "moment", behaviorType: "Moment" }, source: "parent_typed", origin: "behaviorLogs",
    ageAtObservationMonths: 40, pretermCorrected: false, ...over,
  } as unknown as Observation;
}
const moment = (at: string, context?: string, domains: DomainId[] = []) =>
  obs({ at, domains, value: { type: "moment", behaviorType: "Moment", ...(context ? { context } : {}) } });
const word = (at: string, phrase: string, domains: DomainId[] = ["talking"]) =>
  obs({ at, domains, source: "unverified", origin: "langObs", value: { type: "word", language: "en", phrase } });
const milestone = (at: string, id: string, domains: DomainId[]) =>
  obs({ at, domains, kind: "milestone", origin: "milestones", value: { type: "milestone", milestoneId: id, title: `Invented ${id}` } });
const practice = (at: string, activity: string, origin = "practiceEvents") =>
  obs({ at, kind: "practice", origin: origin as Observation["origin"], source: "kid_practice", value: { type: "practice", activity } });
const step = (recommendation: string, outcome: "helped" | "somewhat" | "not_today", outcomeAt: string, status: "completed" | "accepted" = "completed") =>
  ({ recommendation, outcome, outcomeAt, status });

describe("weekStepLines — What helped's rows", () => {
  it("groups the week's rated steps by their text, newest first; helped days once each, oldest first", () => {
    const lines = weekStepLines([
      step("Name the feeling first", "helped", on(0, 20)),
      step("Name  the feeling first ", "helped", on(0, 21)),
      step("Name the feeling first", "helped", on(2, 8)),
      step("Count to five together", "not_today", on(1, 9)),
      step("Count to five together", "somewhat", on(3, 9)),
    ], START, END);
    expect(lines.map((l) => [l.step, l.helped, l.notThisTime])).toEqual([
      ["Count to five together", 0, 2],
      ["Name the feeling first", 3, 0],
    ]);
    expect(lines[1].helpedDays).toEqual([new Date(2026, 9, 10).getTime(), new Date(2026, 9, 12).getTime()]);
  });

  it("only completed steps with an outcome inside [start, end] count, and at most three rows", () => {
    const lines = weekStepLines([
      step("Before the week", "helped", new Date(START - 1).toISOString()),
      step("After now", "helped", new Date(END + 1).toISOString()),
      step("Still open", "helped", on(1, 9), "accepted"),
      step("   ", "helped", on(1, 10)),
      step("One", "helped", on(0, 9)),
      step("Two", "helped", on(1, 9)),
      step("Three", "helped", on(2, 9)),
      step("Four", "helped", on(3, 9)),
    ], START, END);
    expect(WEEK_STEPS_MAX).toBe(3);
    expect(lines.map((l) => l.step)).toEqual(["Four", "Three", "Two"]);
  });

  it("topHelpedStep: the step that helped most (ties: the newest); none when nothing helped", () => {
    const line = (stepText: string, helped: number, latest: number): WeekStepLine => ({ step: stepText, helped, notThisTime: 0, helpedDays: [], latest });
    expect(topHelpedStep([line("A", 1, 5), line("B", 2, 1), line("C", 2, 3)])?.step).toBe("C");
    expect(topHelpedStep([line("A", 0, 5)])).toBeNull();
    expect(topHelpedStep([])).toBeNull();
  });
});

describe("kidWorldOf — the Kid Mode world a record belongs to", () => {
  it("maps practice events, Mimic and adventures; missions, unknown kinds and parent records read none", () => {
    expect(kidWorldOf(practice(on(0, 9), "memory"))).toBe("memory");
    expect(kidWorldOf(practice(on(0, 9), "calm"))).toBe("feelings");
    expect(kidWorldOf(practice(on(0, 9), "phonics"))).toBe("reading");
    expect(kidWorldOf(practice(on(0, 9), "mimic", "mimicSessions"))).toBe("mimic");
    expect(kidWorldOf(practice(on(0, 9), "story", "adventureResults"))).toBe("adventures");
    expect(kidWorldOf(practice(on(0, 9), "mission:invented", "missionRecords"))).toBeNull();
    expect(kidWorldOf(practice(on(0, 9), "invented-kind"))).toBeNull();
    expect(kidWorldOf(moment(on(0, 9)))).toBeNull();
  });
});

describe("weekReportLines — the report week's lines", () => {
  const OBSERVATIONS = [
    moment(on(0, 9), "Home", ["feelings"]),
    moment(on(1, 9), "home", ["feelings", "family"]),
    moment(on(1, 10), "School"),
    moment(on(2, 10), "Transit"),
    moment(on(2, 11), "Transit"),
    moment(on(2, 12), "Transit"),
    moment(on(3, 9), "Garden"),
    milestone(on(1, 12), "m-invented-a", ["moving"]),
    milestone(on(2, 12), "m-invented-b", ["moving"]),
    milestone(on(3, 12), "m-invented-c", ["hands"]),
    word(on(0, 18), "ball"),
    word(on(1, 18), "Ball"),
    word(on(2, 18), "up"),
    word(on(3, 18), "more juice"),
    word(on(3, 19), "x".repeat(80)),
    practice(on(0, 17), "memory"),
    practice(on(1, 17), "calm"),
    practice(on(2, 17), "emotion-id"),
    practice(on(3, 17), "mission:invented", "missionRecords"),
    moment(new Date(START - 1).toISOString(), "Home", ["body"]),
    moment(new Date(END + 1).toISOString(), "Home", ["body"]),
  ];
  const lines = weekReportLines({ observations: OBSERVATIONS, actionLoop: [step("Name the feeling first", "helped", on(1, 20))], startMs: START, endMs: END });

  it("places: the parent's moments by stored place, most first, at most two; an unknown place counts for none", () => {
    expect(lines.places).toEqual([{ place: "transit", n: 3 }, { place: "home", n: 2 }]);
  });

  it("milestone areas: most first, at most two", () => {
    expect(lines.milestoneAreas).toEqual([{ domain: "moving", n: 2 }, { domain: "hands", n: 1 }]);
  });

  it("kid world: the world played most this week (missions have no world of their own)", () => {
    expect(lines.kidWorld).toEqual({ worldId: "feelings", n: 2 });
  });

  it("words: the child's words, newest first, each once (case-blind), at most three, a long one clipped", () => {
    expect(WEEK_WORDS_MAX).toBe(3);
    expect(lines.words).toHaveLength(3);
    expect(lines.words[0]).toHaveLength(WEEK_WORD_MAX_CHARS);
    expect(lines.words[0].endsWith("…")).toBe(true);
    expect(lines.words.slice(1)).toEqual(["more juice", "up"]);
    const dup = weekReportLines({ observations: [word(on(0, 18), "ball"), word(on(1, 18), "Ball")], actionLoop: [], startMs: START, endMs: END });
    expect(dup.words).toEqual(["Ball"]);
  });

  it("areas: every registry area, in registry order, each a count of moments, milestones and words; outside the week counts for none", () => {
    expect(lines.areas.map((a) => a.domain)).toEqual([...DOMAIN_IDS]);
    const n = Object.fromEntries(lines.areas.map((a) => [a.domain, a.n]));
    expect(n).toEqual(Object.fromEntries(DOMAIN_IDS.map((d) => [d, ({ feelings: 2, family: 1, moving: 2, hands: 1, talking: 5 } as Record<string, number>)[d] ?? 0])));
    const moving = lines.areas.find((a) => a.domain === "moving");
    expect(moving?.milestones.map((m) => m.id)).toEqual(["m-invented-b", "m-invented-a"]);
    expect(moving?.latest).toBeNull();
    expect(lines.areas.find((a) => a.domain === "feelings")?.latest).toEqual({ kind: "moment", behaviorType: "Moment" });
    expect(lines.areas.find((a) => a.domain === "talking")?.latest?.kind).toBe("word");
    expect(lines.areas.find((a) => a.domain === "body")).toEqual({ domain: "body", n: 0, milestones: [], latest: null });
  });

  it("the steps are What helped's rows for the same bounds", () => {
    expect(lines.steps.map((l) => [l.step, l.helped])).toEqual([["Name the feeling first", 1]]);
  });

  it("an empty week is every area empty and nothing else", () => {
    const empty = weekReportLines({ observations: [], actionLoop: [], startMs: START, endMs: END });
    expect(empty).toEqual({
      places: [], steps: [], milestoneAreas: [], kidWorld: null, words: [],
      areas: DOMAIN_IDS.map((domain) => ({ domain, n: 0, milestones: [], latest: null })),
    });
  });
});

describe("lib/weekReport source — clinical firewall", () => {
  const code = readFileSync(new URL("./weekReport.ts", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("counts only: no score, no share, no trend, no intensity", () => {
    expect(code).not.toMatch(/score|percent|ratio|trend|intensity|average|\/\s*total/i);
    expect(code).not.toMatch(/\*\s*100\b/);
  });
});
