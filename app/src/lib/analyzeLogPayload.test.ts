/**
 * B-AI-13 — the client builder for /analyze-behavior sends no notes text
 * (G-14): only timestamp, behaviorType, trigger, context and resolved leave
 * the device. Real `api.analyzeBehavior`, stubbed fetch.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";
import { ANALYZE_LOG_FIELDS, countAnalyzeLogs, toAnalyzeLogInput } from "./analyzeLogPayload";
import type { BehaviorLog, ChildProfile } from "../types";

afterEach(() => vi.unstubAllGlobals());

const log: BehaviorLog = {
  id: "l1",
  timestamp: "2026-10-01T08:00:00.000Z",
  behaviorType: "Tantrum",
  intensity: 4,
  durationMinutes: 10,
  trigger: "transitions",
  response: "RESP-SENTINEL we left the park",
  notes: "NOTE-SENTINEL she said she hates me",
  context: "Public",
  resolved: true,
  resolutionNotes: "RES-SENTINEL",
  photoAttachment: "data:image/png;base64,PHOTO-SENTINEL",
  sourceExcerpt: "EXCERPT-SENTINEL",
};

describe("B-AI-13 · the analyze request body carries no notes text", () => {
  it("api.analyzeBehavior posts only the allowlisted fields", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ frequencyCount: {}, triggerBreakdown: [], expertInsights: [], actionPlanSuggestion: "" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    await api.analyzeBehavior({ logs: [log], childProfile: { id: "c1", name: "Noa" } as ChildProfile });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = String(fetchMock.mock.calls[0][1]?.body ?? "");
    expect(body.length).toBeGreaterThan(20);
    for (const sentinel of ["NOTE-SENTINEL", "RESP-SENTINEL", "RES-SENTINEL", "PHOTO-SENTINEL", "EXCERPT-SENTINEL"]) {
      expect(body).not.toContain(sentinel);
    }
    const sent = JSON.parse(body);
    expect(sent.logs).toEqual([{ timestamp: log.timestamp, behaviorType: "Tantrum", trigger: "transitions", context: "Public", resolved: true }]);
    expect(Object.keys(sent.logs[0]).every((k) => (ANALYZE_LOG_FIELDS as readonly string[]).includes(k))).toBe(true);
  });

  it("NEGATIVE CONTROL: the pre-change body ({ ...payload }) carried the note", () => {
    const pre = JSON.stringify({ logs: [log] });
    expect(pre).toContain("NOTE-SENTINEL");
    expect(JSON.stringify({ logs: [toAnalyzeLogInput(log)] })).not.toContain("NOTE-SENTINEL");
  });

  it("counts are whole numbers per type and per trigger, no total", () => {
    const out = countAnalyzeLogs([
      { behaviorType: "Tantrum", trigger: "bedtime" },
      { behaviorType: "Tantrum", trigger: "transitions" },
      { behaviorType: "Hitting", trigger: "transitions" },
      { behaviorType: " ", trigger: "" },
    ]);
    expect(out.frequencyCount).toEqual({ Tantrum: 2, Hitting: 1 });
    expect(out.triggerBreakdown).toEqual([{ trigger: "transitions", count: 2 }, { trigger: "bedtime", count: 1 }]);
    expect(out).not.toHaveProperty("total");
  });
});
