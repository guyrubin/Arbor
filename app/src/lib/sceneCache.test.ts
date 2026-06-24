import { describe, it, expect, beforeEach } from "vitest";
import { getScene, setScene, resolveScene, dedupeScene, _resetSceneCache } from "./sceneCache";

describe("sceneCache (S3)", () => {
  beforeEach(() => _resetSceneCache());

  // ── basic get/set ─────────────────────────────────────────────────────────

  it("stores and retrieves a panel by key", () => {
    expect(getScene("k1")).toBeUndefined();
    setScene("k1", "data:image/png;base64,AAA");
    expect(getScene("k1")).toBe("data:image/png;base64,AAA");
  });

  it("stores and retrieves a scene (caps variant)", () => {
    setScene("a", "data:url-a");
    expect(getScene("a")).toBe("data:url-a");
    expect(getScene("missing")).toBeUndefined();
  });

  // ── memory-only guarantee ─────────────────────────────────────────────────

  it("works mem-only and never throws when localStorage is unavailable", () => {
    // The test env is node (no localStorage). Set/get must still work and must
    // NOT trim the cache as a side effect of storage being absent.
    expect(() => {
      for (let i = 0; i < 10; i++) setScene(`m${i}`, `v${i}`);
    }).not.toThrow();
    expect(getScene("m0")).toBe("v0"); // all 10 retained (cap is 24), no storage-driven trim
    expect(getScene("m9")).toBe("v9");
  });

  // ── LRU eviction ──────────────────────────────────────────────────────────

  it("evicts least-recently-used beyond the cap (24 entries)", () => {
    for (let i = 0; i < 25; i++) setScene(`k${i}`, `v${i}`);
    // 25 inserts, cap 24 → the first (k0) is evicted.
    expect(getScene("k0")).toBeUndefined();
    expect(getScene("k24")).toBe("v24");
  });

  it("get() bumps recency so a touched entry survives eviction", () => {
    for (let i = 0; i < 24; i++) setScene(`k${i}`, `v${i}`); // fills to cap
    getScene("k0"); // bump k0 to most-recent
    setScene("k24", "v24"); // forces one eviction
    expect(getScene("k0")).toBe("v0"); // survived (bumped)
    expect(getScene("k1")).toBeUndefined(); // k1 was now oldest → evicted
  });

  // ── resolveScene (HEAD name) ───────────────────────────────────────────────

  it("resolveScene generates once, then serves from cache (no re-pay)", async () => {
    let calls = 0;
    const gen = () => {
      calls++;
      return Promise.resolve("data:url-1");
    };
    const a = await resolveScene("key", gen);
    const b = await resolveScene("key", gen);
    expect(a).toBe("data:url-1");
    expect(b).toBe("data:url-1");
    expect(calls).toBe(1); // second call hit the cache
  });

  it("resolveScene dedupes concurrent identical requests into one generation", async () => {
    let calls = 0;
    let release!: (v: string) => void;
    const pending = new Promise<string>((r) => (release = r));
    const gen = () => {
      calls++;
      return pending;
    };
    const p1 = resolveScene("dup", gen);
    const p2 = resolveScene("dup", gen);
    release("data:shared");
    expect(await p1).toBe("data:shared");
    expect(await p2).toBe("data:shared");
    expect(calls).toBe(1); // only one generation despite two concurrent callers
  });

  // ── dedupeScene (caps alias — same implementation, different name) ─────────

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

  // ── resolveScene and dedupeScene are the same function ────────────────────

  it("resolveScene and dedupeScene share the same cache (alias, not separate)", async () => {
    let calls = 0;
    const gen = () => { calls++; return Promise.resolve("data:alias"); };
    await resolveScene("shared-key", gen);
    // dedupeScene on the same key must hit the cache set by resolveScene.
    const result = await dedupeScene("shared-key", gen);
    expect(result).toBe("data:alias");
    expect(calls).toBe(1);
  });
});
