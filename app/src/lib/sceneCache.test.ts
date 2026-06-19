import { describe, it, expect, beforeEach } from "vitest";
import { getScene, setScene, dedupeScene, _resetSceneCache } from "./sceneCache";

describe("sceneCache", () => {
  beforeEach(() => _resetSceneCache());

  it("stores and retrieves a scene", () => {
    setScene("a", "data:url-a");
    expect(getScene("a")).toBe("data:url-a");
    expect(getScene("missing")).toBeUndefined();
  });

  it("works mem-only and never throws when localStorage is unavailable", () => {
    // The test env is node (no localStorage). Set/get must still work and must
    // NOT trim the cache as a side effect of storage being absent.
    expect(() => {
      for (let i = 0; i < 10; i++) setScene(`m${i}`, `v${i}`);
    }).not.toThrow();
    expect(getScene("m0")).toBe("v0"); // all 10 retained (cap is 12), no storage-driven trim
    expect(getScene("m9")).toBe("v9");
  });

  it("evicts least-recently-used beyond the cap", () => {
    for (let i = 0; i < 13; i++) setScene(`k${i}`, `v${i}`);
    // 13 inserts, cap 12 → the first (k0) is evicted.
    expect(getScene("k0")).toBeUndefined();
    expect(getScene("k12")).toBe("v12");
  });

  it("get() bumps recency so a touched entry survives eviction", () => {
    for (let i = 0; i < 12; i++) setScene(`k${i}`, `v${i}`); // fills to cap
    getScene("k0"); // bump k0 to most-recent
    setScene("k12", "v12"); // forces one eviction
    expect(getScene("k0")).toBe("v0"); // survived
    expect(getScene("k1")).toBeUndefined(); // k1 was now oldest → evicted
  });

  it("dedupeScene generates once, then serves from cache", async () => {
    let calls = 0;
    const gen = () => { calls++; return Promise.resolve("data:gen"); };
    const a = await dedupeScene("s", gen);
    const b = await dedupeScene("s", gen);
    expect(a).toBe("data:gen");
    expect(b).toBe("data:gen");
    expect(calls).toBe(1);
  });

  it("dedupeScene collapses concurrent in-flight requests", async () => {
    let calls = 0;
    const gen = () => { calls++; return new Promise<string>((r) => setTimeout(() => r("data:x"), 5)); };
    const [a, b] = await Promise.all([dedupeScene("c", gen), dedupeScene("c", gen)]);
    expect(a).toBe("data:x");
    expect(b).toBe("data:x");
    expect(calls).toBe(1);
  });
});
