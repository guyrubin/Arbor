import { describe, it, expect, vi } from "vitest";
import { runInstrumented, failureReason } from "./useAsyncAction";

describe("failureReason", () => {
  it("uses the Error message", () => {
    expect(failureReason(new Error("quota exceeded"))).toBe("quota exceeded");
  });

  it("passes through plain strings", () => {
    expect(failureReason("boom")).toBe("boom");
  });

  it("falls back to 'unknown' for empty / non-error values", () => {
    expect(failureReason(undefined)).toBe("unknown");
    expect(failureReason(new Error(""))).toBe("unknown");
    expect(failureReason({})).toBe("unknown");
  });

  it("truncates very long messages so analytics stays bounded", () => {
    const reason = failureReason(new Error("x".repeat(500)));
    expect(reason.length).toBe(120);
  });
});

describe("runInstrumented", () => {
  it("emits started then succeeded around a successful action and returns its value", async () => {
    const track = vi.fn();
    const result = await runInstrumented("avatar", async () => 42, track);

    expect(result).toBe(42);
    expect(track.mock.calls.map((c) => c[0])).toEqual([
      "avatar_started",
      "avatar_succeeded",
    ]);
  });

  it("forwards startProps onto start and success events", async () => {
    const track = vi.fn();
    await runInstrumented("comic", async () => "ok", track, { adventure: "rescue" });

    expect(track).toHaveBeenCalledWith("comic_started", { adventure: "rescue" });
    expect(track).toHaveBeenCalledWith("comic_succeeded", { adventure: "rescue" });
  });

  it("emits started then failed (with a reason) and re-throws on error", async () => {
    const track = vi.fn();
    const boom = new Error("model down");

    await expect(
      runInstrumented("plan", async () => { throw boom; }, track, { topic: "sleep" }),
    ).rejects.toBe(boom);

    expect(track).toHaveBeenCalledWith("plan_started", { topic: "sleep" });
    expect(track).toHaveBeenCalledWith("plan_failed", { topic: "sleep", reason: "model down" });
    expect(track).not.toHaveBeenCalledWith("plan_succeeded", expect.anything());
  });

  it("never lets a throwing track mask the real result", async () => {
    const track = vi.fn(() => { throw new Error("analytics offline"); });
    const result = await runInstrumented("scene", async () => "art", track);
    expect(result).toBe("art");
  });

  it("never lets a throwing track mask the real error", async () => {
    const track = vi.fn(() => { throw new Error("analytics offline"); });
    const original = new Error("generation failed");
    await expect(
      runInstrumented("scene", async () => { throw original; }, track),
    ).rejects.toBe(original);
  });
});
