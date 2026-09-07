/**
 * OBJ-PROFILE-04 (item 24) — the memory ledger read stops asking.
 *
 * `GET /api/memory/<child>` was re-fired with no back-off and no ceiling: one
 * lane logged 65 console errors in a single session, and every failure — HTTP
 * 429 included — surfaced as "Something interrupted the connection", which
 * sends a parent to check their wifi over a queue on our side. (Four lanes did
 * share one limiter, so the 429 itself is partly a test artefact; the missing
 * ceiling and the misattributed copy are not.)
 *
 * The policy is exercised through the exported pure helper with an injected
 * `sleep`, so the delays are asserted exactly and no wall-clock time passes.
 * Negative control: the shipped single-shot read, reproduced inline.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { pollMemoryReview, MEMORY_RETRY_DELAYS_MS } from "./ArborContext";
import { translate } from "../lib/i18n";

/** Records what would have been waited instead of waiting. */
function recorder() {
  const waited: number[] = [];
  return { waited, sleep: async (ms: number) => { waited.push(ms); } };
}

describe("1 · back-off, and a ceiling", () => {
  it("429 on every attempt → three reads, spaced 2 s / 4 s / 8 s, then quiet", async () => {
    const { waited, sleep } = recorder();
    const attempt = vi.fn(async () => ({ status: 429 }));
    const out = await pollMemoryReview({ attempt, sleep });

    expect(attempt).toHaveBeenCalledTimes(3);
    expect(out.tries).toBe(3);
    expect(out.failure).toBe("rate_limited");
    // Two waits between three reads; the delays are the declared ones and each
    // is at least double the last.
    expect(waited).toEqual([2000, 4000]);
    expect(out.waited).toEqual([2000, 4000]);
    expect(MEMORY_RETRY_DELAYS_MS).toEqual([2000, 4000, 8000]);
    for (let i = 1; i < MEMORY_RETRY_DELAYS_MS.length; i += 1) {
      expect(MEMORY_RETRY_DELAYS_MS[i]).toBeGreaterThanOrEqual(MEMORY_RETRY_DELAYS_MS[i - 1] * 2);
    }
    // The whole sequence fits inside a minute several times over — three
    // requests, ~6 s of waiting, then it stops asking.
    expect(waited.reduce((a, b) => a + b, 0)).toBeLessThan(60_000);
  });

  it("a 429 is classified apart from a 500 and from a thrown fetch", async () => {
    const { sleep } = recorder();
    expect((await pollMemoryReview({ attempt: async () => ({ status: 429 }), sleep })).failure).toBe("rate_limited");
    expect((await pollMemoryReview({ attempt: async () => ({ status: 500 }), sleep })).failure).toBe("error");
    expect((await pollMemoryReview({ attempt: async () => { throw new Error("offline"); }, sleep })).failure).toBe("error");
  });

  it("the first success ends it — no retry, no wait, items returned", async () => {
    const { waited, sleep } = recorder();
    const attempt = vi.fn(async () => ({ status: 200, items: [{ id: "m1" }] }));
    const out = await pollMemoryReview({ attempt, sleep });
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(waited).toEqual([]);
    expect(out.failure).toBeNull();
    expect(out.items).toEqual([{ id: "m1" }]);
  });

  it("a 429 that clears on the second read succeeds after one wait", async () => {
    const { waited, sleep } = recorder();
    let n = 0;
    const out = await pollMemoryReview({ attempt: async () => { n += 1; return n === 1 ? { status: 429 } : { status: 200, items: [] }; }, sleep });
    expect(n).toBe(2);
    expect(waited).toEqual([2000]);
    expect(out.failure).toBeNull();
  });

  it("an unmounted consumer stops the loop mid-flight", async () => {
    const { sleep } = recorder();
    const attempt = vi.fn(async () => ({ status: 429 }));
    const out = await pollMemoryReview({ attempt, sleep, alive: () => false });
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(out.tries).toBe(1);
  });

  it("negative control: the shipped read fires once per call with no policy at all", async () => {
    // ArborContext as shipped at 7208d0db: one fetch, one console.warn, one
    // boolean. Nothing bounded how often a caller could re-enter it, and every
    // status collapsed into the same "error".
    let calls = 0;
    const warn: string[] = [];
    const shipped = async () => {
      try {
        calls += 1;
        const res = { ok: false, status: 429 };
        if (!res.ok) throw new Error("Memory review fetch failed");
      } catch {
        warn.push("Could not load memory review items");
      }
    };
    for (let i = 0; i < 65; i += 1) await shipped();
    expect(calls).toBe(65);
    expect(warn).toHaveLength(65);
    // The fixed policy caps a single read at three attempts and one warning.
    const { sleep } = recorder();
    expect((await pollMemoryReview({ attempt: async () => ({ status: 429 }), sleep })).tries).toBe(3);
  });
});

describe("2 · the copy tells the truth about whose problem it is", () => {
  it("the rate-limit line exists in EN and HE and blames no connection", () => {
    for (const lang of ["en", "he"] as const) {
      const copy = translate(lang, "elev.memory.catchingUp");
      expect(copy).not.toBe("elev.memory.catchingUp");
    }
    expect(translate("en", "elev.memory.catchingUp")).not.toMatch(/connection|network|offline/i);
  });

  it("ArborContext classifies the failure and exposes the kind, warning once", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "ArborContext.tsx"), "utf8");
    expect(src).toContain("memoryReviewErrorKind");
    expect(src).toContain("await pollMemoryReview({");
    // One warning per give-up, not one per attempt.
    expect((src.match(/Could not load memory review items/g) ?? [])).toHaveLength(1);
    expect(src).not.toContain('console.warn("Could not load memory review items", err)');
  });
});
