import { describe, expect, it, vi } from "vitest";
import { buildUsageEvent, normalizeUsage, recordUsage, startCallTimer } from "./usage.js";
import { latencyBucketOf, percentileFromBuckets } from "../server/usageRollup.js";
import { logger } from "../server/logger.js";

describe("normalizeUsage", () => {
  it("reads the Gemini / Vertex usageMetadata shape", () => {
    expect(
      normalizeUsage({ promptTokenCount: 1200, candidatesTokenCount: 300, totalTokenCount: 1500 })
    ).toEqual({ promptTokens: 1200, outputTokens: 300, totalTokens: 1500 });
  });

  it("derives total when Gemini omits totalTokenCount", () => {
    expect(normalizeUsage({ promptTokenCount: 100, candidatesTokenCount: 40 })).toEqual({
      promptTokens: 100,
      outputTokens: 40,
      totalTokens: 140,
    });
  });

  it("reads the Anthropic (Claude on Vertex) usage shape", () => {
    expect(normalizeUsage({ input_tokens: 800, output_tokens: 250 })).toEqual({
      promptTokens: 800,
      outputTokens: 250,
      totalTokens: 1050,
    });
  });

  it("returns null when usage is missing or unrecognized", () => {
    expect(normalizeUsage(null)).toBeNull();
    expect(normalizeUsage(undefined)).toBeNull();
    expect(normalizeUsage({})).toBeNull();
    expect(normalizeUsage({ somethingElse: 1 })).toBeNull();
  });
});

// EVAL-7: latency lands in the usage event — the single data source every
// cadence budget (voice firstChunkMs < 2000, Today's Focus p50 < 3s) reads.
describe("usage events carry latency (EVAL-7)", () => {
  const meta = { route: "analysis_structured", provider: "vertex_gemini", model: "gemini-2.5-flash" } as const;

  it("every event with timing carries totalMs (and firstChunkMs for streams)", () => {
    const event = buildUsageEvent(meta, { promptTokens: 10, outputTokens: 5, totalTokens: 15 }, { totalMs: 812, firstChunkMs: 143 });
    expect(event).toMatchObject({
      route: "analysis_structured",
      provider: "vertex_gemini",
      model: "gemini-2.5-flash",
      totalMs: 812,
      firstChunkMs: 143,
    });
  });

  it("non-stream timing omits firstChunkMs but keeps totalMs", () => {
    const event = buildUsageEvent(meta, { promptTokens: 1, outputTokens: 1, totalTokens: 2 }, { totalMs: 250 });
    expect(event).toMatchObject({ totalMs: 250 });
    expect(event).not.toHaveProperty("firstChunkMs");
  });

  it("emits an event on timing alone (latency telemetry survives missing token metadata)", () => {
    const event = buildUsageEvent(meta, null, { totalMs: 90 });
    expect(event).toMatchObject({ totalMs: 90, promptTokens: 0, outputTokens: 0, totalTokens: 0 });
  });

  it("stays silent when there is neither usage nor timing (pre-EVAL-7 behavior)", () => {
    expect(buildUsageEvent(meta, null)).toBeNull();
  });

  it("recordUsage logs the ai.usage line with the latency fields", () => {
    const spy = vi.spyOn(logger, "info").mockImplementation(() => {});
    try {
      recordUsage(meta, { promptTokenCount: 5, candidatesTokenCount: 5, totalTokenCount: 10 }, { totalMs: 432, firstChunkMs: 88 });
      expect(spy).toHaveBeenCalledWith(
        "ai.usage",
        expect.objectContaining({ route: "analysis_structured", totalMs: 432, firstChunkMs: 88 }),
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("startCallTimer marks the first chunk once and reports monotone totals", async () => {
    const timer = startCallTimer();
    await new Promise((r) => setTimeout(r, 5));
    timer.markFirstChunk();
    const firstMark = timer.finish().firstChunkMs;
    timer.markFirstChunk(); // idempotent — a second mark must not move it
    const timing = timer.finish();
    expect(timing.firstChunkMs).toBe(firstMark);
    expect(timing.totalMs).toBeGreaterThanOrEqual(timing.firstChunkMs!);
  });
});

// EVAL-6/EVAL-8: every usage event carries the prompt version and the RESOLVED
// model id, so telemetry (and the eval results rows that read it) can always
// attribute a regression to a prompt change vs a model change.
describe("usage events carry promptVersion + resolvedModel (EVAL-6/EVAL-8)", () => {
  it("stamps the prompt version and echoes model as resolvedModel by default", () => {
    const event = buildUsageEvent(
      { route: "coach_high_stakes", provider: "vertex_claude", model: "claude-sonnet-5", promptVersion: "1.0.0" },
      { promptTokens: 1, outputTokens: 1, totalTokens: 2 },
    );
    expect(event).toMatchObject({ promptVersion: "1.0.0", resolvedModel: "claude-sonnet-5" });
  });

  it("an explicit resolvedModel (alias-mapped) wins over the raw model field", () => {
    const event = buildUsageEvent(
      {
        route: "coach_high_stakes",
        provider: "vertex_claude",
        model: "claude-3-5-sonnet@anthropic",
        resolvedModel: "claude-3-5-sonnet-v2@20241022",
      },
      { promptTokens: 1, outputTokens: 1, totalTokens: 2 },
    );
    expect(event).toMatchObject({
      model: "claude-3-5-sonnet@anthropic",
      resolvedModel: "claude-3-5-sonnet-v2@20241022",
    });
  });

  it('a call site with no registered prompt reads "unversioned" — never a missing field', () => {
    const event = buildUsageEvent(
      { route: "analysis_structured", provider: "vertex_gemini", model: "gemini-2.5-flash" },
      { promptTokens: 1, outputTokens: 1, totalTokens: 2 },
    );
    expect(event).toMatchObject({ promptVersion: "unversioned", resolvedModel: "gemini-2.5-flash" });
  });
});

// EVAL-7: p50/p95 per route are derived from the rollup's histogram buckets.
describe("usageRollup latency buckets → p50/p95", () => {
  it("buckets a duration at its upper bound", () => {
    expect(latencyBucketOf(120)).toBe("le250");
    expect(latencyBucketOf(250)).toBe("le250");
    expect(latencyBucketOf(2400)).toBe("le3000");
    expect(latencyBucketOf(99_999)).toBe("gt30000");
  });

  it("computes p50/p95 from bucket counts", () => {
    // 90 fast calls (<=1s), 8 mid (<=3s), 2 slow (<=15s).
    const buckets = { le1000: 90, le3000: 8, le15000: 2 };
    expect(percentileFromBuckets(buckets, 50)).toBe(1000);
    expect(percentileFromBuckets(buckets, 95)).toBe(3000);
    expect(percentileFromBuckets(buckets, 100)).toBe(15000);
  });

  it("returns null on an empty histogram", () => {
    expect(percentileFromBuckets({}, 50)).toBeNull();
  });
});
