/**
 * AIR-9: budget-aware retry + abort primitives. withModelRetry must never
 * burn a parent's remaining wait on blind backoff once the deadline budget is
 * nearly spent, and raceWithAbort/abortableIterate are the seams that keep a
 * hung upstream from outliving a route budget.
 */
import { describe, expect, it, vi } from "vitest";
import { abortableIterate, isAbortError, newAbortError, raceWithAbort, withModelRetry } from "./modelRetry.js";

const transientError = () => Object.assign(new Error("model overloaded, try again"), { status: 503 });

describe("withModelRetry budget awareness (AIR-9)", () => {
  it("retries transient failures when plenty of budget remains", async () => {
    let calls = 0;
    const result = await withModelRetry(async () => {
      calls += 1;
      if (calls === 1) throw transientError();
      return "ok";
    }, 3, { deadlineAt: Date.now() + 60_000, totalMs: 60_000 });
    expect(result).toBe("ok");
    expect(calls).toBe(2);
  });

  it("skips retry backoff entirely once less than 40% of the budget remains", async () => {
    let calls = 0;
    // 10s total budget with only 2s remaining (20% < 40%) → no second attempt.
    await expect(
      withModelRetry(async () => {
        calls += 1;
        throw transientError();
      }, 3, { deadlineAt: Date.now() + 2_000, totalMs: 10_000 }),
    ).rejects.toThrow(/overloaded/);
    expect(calls).toBe(1);
  });

  it("never retries an abort", async () => {
    let calls = 0;
    await expect(
      withModelRetry(async () => {
        calls += 1;
        throw newAbortError();
      }),
    ).rejects.toSatisfy((e: any) => isAbortError(e));
    expect(calls).toBe(1);
  });

  it("throws immediately when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = vi.fn();
    await expect(withModelRetry(fn, 3, { signal: controller.signal })).rejects.toSatisfy((e: any) => isAbortError(e));
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("raceWithAbort / abortableIterate (AIR-9)", () => {
  it("rejects a never-resolving promise when the signal aborts", async () => {
    const controller = new AbortController();
    const never = new Promise(() => {});
    const raced = raceWithAbort(never, controller.signal);
    controller.abort();
    await expect(raced).rejects.toSatisfy((e: any) => isAbortError(e));
  });

  it("passes values through untouched when no abort happens", async () => {
    const controller = new AbortController();
    expect(await raceWithAbort(Promise.resolve(42), controller.signal)).toBe(42);
  });

  it("ends a hung stream on abort instead of pulling forever", async () => {
    const controller = new AbortController();
    async function* hung() {
      yield "first";
      await new Promise(() => {}); // never yields again
    }
    const seen: string[] = [];
    const consume = (async () => {
      for await (const chunk of abortableIterate(hung(), controller.signal)) seen.push(chunk);
    })();
    await new Promise((r) => setTimeout(r, 10));
    controller.abort();
    await expect(consume).rejects.toSatisfy((e: any) => isAbortError(e));
    expect(seen).toEqual(["first"]);
  });
});
