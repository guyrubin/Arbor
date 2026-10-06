/**
 * B-AI-04 — kept insights become read.
 *
 * "Keep this" on a #/behaviors suggestion wrote an `insights` row of kind
 * `kept-insight` that NOTHING read (TJB-04 writer, 0 readers). It is now a
 * buildTimeline ingest source (kind "kept", provenance "You kept", the line
 * verbatim), registered for SC-4, and read by the server CompanionContext
 * (≤5 newest — server/companionContext.test.ts).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildTimeline, signalDetail, signalTitle, SIGNAL_PROVENANCE, TIMELINE_SOURCE_IDS } from "./signalTimeline";
import type { InsightRecord } from "../types";
import { en as keptEn, he as keptHe } from "./i18nElevation/keptinsight";

const t = (key: string) => `[${key}]`;
const kept = (id: string, text: string, createdAt = "2026-10-01T09:00:00.000Z"): InsightRecord => ({
  id, kind: "kept-insight", dateKey: createdAt.slice(0, 10), createdAt, text, sourceId: "behavior-analysis-2026-10-01",
});

describe("B-AI-04 — a kept line is a thread row", () => {
  it("keeping a suggestion produces one dated row the same day, text verbatim", () => {
    const line = "Name the feeling before the transition, then offer two choices.";
    const rows = buildTimeline({ keptInsights: [kept("kept-1", line)] });
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("kept");
    expect(rows[0].at?.slice(0, 10)).toBe("2026-10-01");
    expect(signalDetail(rows[0], t)).toBe(line);
  });

  it("provenance reads You kept / שמרתם — the parent's act, no claim about the child", () => {
    const [row] = buildTimeline({ keptInsights: [kept("kept-1", "x")] });
    expect(SIGNAL_PROVENANCE[row.kind]).toBe("manual");
    expect(signalTitle(row, t)).toBe("[elev.kept.thread.title]");
    expect(keptEn["elev.kept.thread.title"]).toBe("You kept");
    expect(keptHe["elev.kept.thread.title"]).toBe("שמרתם");
    expect(Object.keys(keptHe).sort()).toEqual(Object.keys(keptEn).sort());
  });

  it("analysis rows and empty lines in the same subcollection are not rows", () => {
    const analysis: InsightRecord = { id: "behavior-analysis-2026-10-01", kind: "behavior-analysis", dateKey: "2026-10-01", createdAt: "2026-10-01T08:00:00.000Z" };
    expect(buildTimeline({ keptInsights: [analysis, kept("k2", "   ")] })).toHaveLength(0);
  });

  it("one tone for every kept row (never a verdict colour)", () => {
    const rows = buildTimeline({ keptInsights: [kept("a", "one"), kept("b", "two", "2026-09-30T09:00:00.000Z")] });
    expect(new Set(rows.map((r) => r.tone)).size).toBe(1);
  });
});

describe("B-AI-04 — SC-4: the source is registered and wired", () => {
  it("keptInsights is a real ingest source a contract can declare", () => {
    expect(TIMELINE_SOURCE_IDS).toContain("keptInsights");
    expect(TIMELINE_SOURCE_IDS).not.toContain("insights");
  });

  it("the timeline hook feeds ArborContext's kept-insight rows to the builder", () => {
    const hook = readFileSync(path.join(__dirname, "..", "hooks", "useTimeline.ts"), "utf8");
    expect(hook).toMatch(/keptInsights,\s+childProfile,\s+\} = useArbor\(\);/);
    // B-ASKJB-34: the hook reads through lib/timelineFold.readTimeline (which calls buildTimeline).
    const start = hook.indexOf("readTimeline({");
    expect(start).toBeGreaterThan(-1);
    const call = hook.slice(start, hook.indexOf("}),", start));
    expect(call).toMatch(/\bkeptInsights,/);
  });
});
