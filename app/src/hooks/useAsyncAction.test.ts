import { describe, it, expect, vi } from "vitest";
import { runInstrumented, failureReason, FAILURE_REASONS } from "./useAsyncAction";
import { ApiError, PaywallError } from "../lib/api";

describe("failureReason (B-MEAS-05: an enum, never provider text)", () => {
  it("a 429 'prepayment credits' error is provider_credit", () => {
    expect(failureReason(new ApiError("Your prepayment credits are depleted. Please go to AI Studio to manage your billing.", 429))).toBe("provider_credit");
  });

  it.each([
    [new ApiError("Too many requests", 429), "rate_limited"],
    [new ApiError("RESOURCE_EXHAUSTED: quota exceeded for model", 429), "quota_exhausted"],
    [new PaywallError("Free coach limit reached"), "quota_exhausted"],
    [new ApiError("Gateway timeout", 504), "timeout"],
    [new Error("The request timed out"), "timeout"],
    [new TypeError("Failed to fetch"), "offline"],
    [Object.assign(new Error("The operation was aborted."), { name: "AbortError" }), "aborted"],
    [new ApiError("Internal error", 500), "server_error"],
    [new ApiError("Bad request: child name Noa missing", 400), "other"],
  ] as const)("%s → %s", (err, expected) => {
    expect(failureReason(err)).toBe(expected);
  });

  it("anything unknown is 'other' — empty, strings, objects, long prose", () => {
    expect(failureReason(undefined)).toBe("other");
    expect(failureReason(new Error(""))).toBe("other");
    expect(failureReason({})).toBe("other");
    expect(failureReason("boom")).toBe("other");
    expect(failureReason(new Error("Noa said something private ".repeat(20)))).toBe("other");
  });

  it("every value it can return is in FAILURE_REASONS", () => {
    for (const err of [undefined, "x", new Error("x"), new ApiError("x", 503), new ApiError("x", 429)]) {
      expect(FAILURE_REASONS).toContain(failureReason(err));
    }
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
    expect(track).toHaveBeenCalledWith("plan_failed", { topic: "sleep", reason: "other" });
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
