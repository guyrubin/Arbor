import { describe, it, expect, vi } from "vitest";
import { MemoryCounterStore } from "./quotaStore.js";

/** Re-import the middleware with a fresh module registry so the env-derived
 *  limit constants are re-read per test. */
async function loadImageQuota(limit: string) {
  process.env.IMAGE_GEN_DAILY_LIMIT = limit;
  vi.resetModules();
  return (await import("./imageQuota.js")).createImageQuota;
}

/** Minimal Express res double that captures status + whether a body was sent. */
function makeRes() {
  const res: any = {
    statusCode: 0,
    body: undefined as any,
    headers: {} as Record<string, string>,
    setHeader(k: string, v: string) {
      this.headers[k] = v;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("image quota (S2)", () => {
  it("allows up to the per-user daily limit, then blocks with 429", async () => {
    const createImageQuota = await loadImageQuota("3");
    const counters = new MemoryCounterStore();
    const mw = createImageQuota(counters);

    const call = async (uid: string) => {
      const res = makeRes();
      let passed = false;
      await mw({ user: { uid } } as any, res as any, () => {
        passed = true;
      });
      return { res, passed };
    };

    // First 3 pass.
    for (let i = 0; i < 3; i++) {
      const r = await call("u1");
      expect(r.passed).toBe(true);
    }
    // 4th is blocked.
    const blocked = await call("u1");
    expect(blocked.passed).toBe(false);
    expect(blocked.res.statusCode).toBe(429);
    expect(blocked.res.headers["X-Image-Quota-Remaining"]).toBe("0");
  });

  it("caps each user independently", async () => {
    const createImageQuota = await loadImageQuota("1");
    const counters = new MemoryCounterStore();
    const mw = createImageQuota(counters);

    const call = async (uid: string) => {
      const res = makeRes();
      let passed = false;
      await mw({ user: { uid } } as any, res as any, () => {
        passed = true;
      });
      return { res, passed };
    };

    expect((await call("a")).passed).toBe(true);
    expect((await call("a")).passed).toBe(false); // a is capped
    expect((await call("b")).passed).toBe(true); // b is independent
  });
});
