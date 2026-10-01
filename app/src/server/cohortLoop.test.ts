/**
 * B-MEAS-02 — the pilot's primary metric gets an event and a funnel.
 *
 *  · `loop` chain pinned (accepted → outcome → continued), same in the server
 *    reader and the lead's script;
 *  · per family per ISO week: completed + eligible + share; null share ("not
 *    answerable yet") on 0 eligible — never 0%;
 *  · server and script compute the same numbers on one fixture;
 *  · the client emits `loop_continued {source}` only, from the focus hook.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildCohortReport, FUNNEL_CHAINS, isoWeekOf, scanForbiddenKeys, summariseLoop, type CohortEventDoc, type CohortMetricsStore } from "./cohortMetrics.js";
import * as reportScript from "../../scripts/cohort-report.mjs";

const calls = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("../lib/analytics", () => ({ track: (e: string, p: Record<string, unknown>) => calls.push([e, p]) }));
import { KpiEvent, LOOP_SOURCES, trackLoopContinued, UNKNOWN_ID } from "../lib/kpiEvents";

const ev = (uid: string, event: string, at: string): CohortEventDoc => ({ uid, event, at, props: { source: "organic", market: "il" } });

// ISO week 2026-W40 = Mon 28 Sep .. Sun 4 Oct; W41 starts Mon 5 Oct.
const FIXTURE: CohortEventDoc[] = [
  ev("fam-a", "today_action_accepted", "2026-09-28T08:00:00Z"),
  ev("fam-a", "today_action_outcome", "2026-09-29T08:00:00Z"),
  ev("fam-a", "loop_continued", "2026-09-30T08:00:00Z"),
  ev("fam-b", "session_open", "2026-09-30T08:00:00Z"),
  ev("fam-b", "today_action_accepted", "2026-10-01T08:00:00Z"),
  ev("fam-c", "session_open", "2026-10-06T08:00:00Z"),
  ev("fam-a", "loop_continued", "2026-10-06T09:00:00Z"),
  ev("fam-a", "loop_continued", "2026-10-07T09:00:00Z"),
];

describe("B-MEAS-02 — the loop chain", () => {
  it("is pinned, and the script's copy equals the server's", () => {
    expect([...FUNNEL_CHAINS.loop]).toEqual(["today_action_accepted", "today_action_outcome", "loop_continued"]);
    expect(reportScript.FUNNEL_CHAINS.loop).toEqual([...FUNNEL_CHAINS.loop]);
  });

  it("ISO weeks are Monday-based and year-correct", () => {
    expect(isoWeekOf("2026-09-28T00:00:00Z")).toBe("2026-W40");
    expect(isoWeekOf("2026-10-04T23:59:00Z")).toBe("2026-W40");
    expect(isoWeekOf("2026-10-05T00:00:00Z")).toBe("2026-W41");
    expect(isoWeekOf("2021-01-03T12:00:00Z")).toBe("2020-W53");
    expect(isoWeekOf(null)).toBeNull();
    expect(reportScript.isoWeekOf("2021-01-03T12:00:00Z")).toBe("2020-W53");
  });
});

describe("B-MEAS-02 — per family per ISO week", () => {
  it("counts each family once per week, against the week's active families", () => {
    const s = summariseLoop(FIXTURE);
    expect(s.weeks).toEqual([
      { week: "2026-W40", completed: 1, eligible: 2, share: 0.5 },
      { week: "2026-W41", completed: 1, eligible: 2, share: 0.5 },
    ]);
    expect([s.completed, s.eligible, s.share]).toEqual([2, 4, 0.5]);
  });

  it("0 eligible → share null, printed 'not answerable yet' (never 0%)", () => {
    expect(summariseLoop([])).toEqual({ weeks: [], completed: 0, eligible: 0, share: null });
    const printed = reportScript.print(
      { generatedAt: "x", since: "s", asOfDay: "d", groupBy: "source", scanned: { rollups: 0, events: 0, mode: "m" }, funnels: { loop: [] }, loop: summariseLoop([]), eventCensus: [] },
      { sections: new Set(["funnel"]) },
    );
    expect(printed).toContain("not answerable yet");
    expect(printed).not.toMatch(/\b0%/);
  });

  it("server and script agree on one fixture, and `--funnel loop` prints count + denominator", () => {
    expect(reportScript.summariseLoop(FIXTURE)).toEqual(summariseLoop(FIXTURE));
    const printed = reportScript.print(
      { generatedAt: "x", since: "s", asOfDay: "d", groupBy: "source", scanned: { rollups: 0, events: 8, mode: "m" }, funnels: { loop: [] }, loop: summariseLoop(FIXTURE), eventCensus: [] },
      { sections: new Set(["funnel"]) },
    );
    expect(printed).toContain("2026-W40  completed    1 of    2 eligible  ·  50%");
    expect(printed).toContain("all weeks: completed 2 of 4 family-weeks");
  });

  it("the server report carries `loop` only when asked, with no forbidden key and no uid", async () => {
    const store: CohortMetricsStore = { mode: "firestore", listRetentionRollups: async () => [], listEvents: async () => FIXTURE };
    const asked = await buildCohortReport(store, { since: "2026-09-01", funnels: ["loop"], now: new Date("2026-10-08T00:00:00Z") });
    expect(asked.loop?.completed).toBe(2);
    expect(scanForbiddenKeys(asked)).toEqual([]);
    expect(JSON.stringify(asked)).not.toContain("fam-a");
    const notAsked = await buildCohortReport(store, { since: "2026-09-01", funnels: ["billing"], now: new Date("2026-10-08T00:00:00Z") });
    expect(notAsked.loop).toBeUndefined();
  });
});

describe("B-MEAS-02 — the client event", () => {
  it("loop_continued carries {source} only; off-list sources degrade", () => {
    calls.length = 0;
    trackLoopContinued("today-focus");
    trackLoopContinued("Noa tried the bath");
    expect(calls).toEqual([
      [KpiEvent.LoopContinued, { source: "today-focus" }],
      [KpiEvent.LoopContinued, { source: UNKNOWN_ID }],
    ]);
    expect([...LOOP_SOURCES]).toEqual(["today-focus", "coach"]);
  });

  it("the focus hook emits it exactly when the response's inputsUsed carries a parent-reported outcome", () => {
    const hook = readFileSync(path.join(__dirname, "..", "hooks", "useTodaysFocus.ts"), "utf8");
    expect(hook).toContain('if (inputsUsed?.lastActionOutcome) trackLoopContinued("today-focus");');
    expect((hook.match(/trackLoopContinued\(/g) ?? []).length).toBe(1);
  });
});
