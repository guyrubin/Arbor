import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { childScopedKey, clearChildLocalState } from "./childLocalState";
import { MOMENT_RETRY_CAP, MOMENT_RETRY_TTL_MS, forgetMomentAttempt, readMomentAttempt, rememberMomentAttempt } from "./momentRetryStore";

const memory = () => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
    get length() { return map.size; },
    key: (i: number) => [...map.keys()][i] ?? null,
    clear: () => map.clear(),
  };
};

const T0 = Date.parse("2026-11-12T20:00:00Z");
const first = { id: "log-first", timestamp: "2026-11-12T20:00:00.000Z" };

describe("B-DATA-14 · a moment retried after a reload keeps its first id", () => {
  it("the first attempt survives a reload (a fresh read of the device store) until the ack", () => {
    const storage = memory();
    rememberMomentAttempt("child-a", "child-a:moment:tonight:2026-11-12:p1", first, { storage, nowMs: T0 });
    // A reload: nothing in memory, the same device store.
    expect(readMomentAttempt("child-a", "child-a:moment:tonight:2026-11-12:p1", { storage, nowMs: T0 + 60_000 })).toEqual(first);
    // The retry acknowledged: the next capture at this place is a new moment.
    forgetMomentAttempt("child-a", "child-a:moment:tonight:2026-11-12:p1", { storage, nowMs: T0 + 61_000 });
    expect(readMomentAttempt("child-a", "child-a:moment:tonight:2026-11-12:p1", { storage, nowMs: T0 + 62_000 })).toBeUndefined();
    expect(storage.map.size).toBe(0);
  });

  it("a second attempt at the same place keeps the first one's id and age", () => {
    const storage = memory();
    rememberMomentAttempt("child-a", "k", first, { storage, nowMs: T0 });
    rememberMomentAttempt("child-a", "k", first, { storage, nowMs: T0 + MOMENT_RETRY_TTL_MS - 10 });
    expect(readMomentAttempt("child-a", "k", { storage, nowMs: T0 + MOMENT_RETRY_TTL_MS + 1 })).toBeUndefined();
  });

  it("is per child, expires, caps its list, and tolerates a broken or missing store", () => {
    const storage = memory();
    rememberMomentAttempt("child-a", "k", first, { storage, nowMs: T0 });
    expect(readMomentAttempt("child-b", "k", { storage, nowMs: T0 })).toBeUndefined();
    expect(readMomentAttempt("child-a", "k", { storage, nowMs: T0 + MOMENT_RETRY_TTL_MS + 1 })).toBeUndefined();
    for (let i = 0; i < MOMENT_RETRY_CAP + 5; i++) rememberMomentAttempt("child-a", `k${i}`, { id: `id${i}`, timestamp: first.timestamp }, { storage, nowMs: T0 + i });
    const kept = JSON.parse(storage.map.get(childScopedKey("momentRetry", "child-a")) ?? "{}");
    expect(Object.keys(kept)).toHaveLength(MOMENT_RETRY_CAP);
    expect(kept.k0).toBeUndefined();
    storage.map.set(childScopedKey("momentRetry", "child-a"), "not json");
    expect(readMomentAttempt("child-a", "k44", { storage, nowMs: T0 })).toBeUndefined();
    expect(readMomentAttempt("child-a", "k", { storage: null, nowMs: T0 })).toBeUndefined();
    expect(() => rememberMomentAttempt("", "k", first, { storage, nowMs: T0 })).not.toThrow();
  });

  it("erasing the child sweeps the pending ids with the rest of its device state", () => {
    const local = memory();
    rememberMomentAttempt("child-a", "k", first, { storage: local, nowMs: T0 });
    expect(clearChildLocalState("child-a", { local: local as unknown as Storage, session: null })).toBe(1);
    expect(local.map.size).toBe(0);
  });

  it("addMoment reads, remembers and forgets the attempt only for a caller's stable retry key (never the moment's text)", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "..", "context", "ArborContext.tsx"), "utf8");
    const seam = src.slice(src.indexOf("const addMoment = async ("), src.indexOf("const saveMoment = addMoment;"));
    expect(seam).toContain("const persistRetry = requireAcknowledgement && !!retryKey;");
    expect(seam).toContain("captureScope.momentRetries.get(attemptKey) ?? (persistRetry ? readMomentAttempt(captureScope.childId, attemptKey) : undefined)");
    expect(seam).toContain("if (persistRetry) rememberMomentAttempt(captureScope.childId, attemptKey, { id: logItem.id, timestamp: logItem.timestamp });");
    // Forgotten on the ack itself, before the scope check that may return early.
    expect(seam.indexOf("if (persistRetry) forgetMomentAttempt(captureScope.childId, attemptKey);")).toBeGreaterThan(seam.indexOf("await logsCol.upsert(logItem"));
    expect(seam.indexOf("if (persistRetry) forgetMomentAttempt(")).toBeLessThan(seam.indexOf("if (captureScopeRef.current !== captureScope || isCurrent?.() === false) return null;\n      if (requireAcknowledgement) captureScope.momentRetries.delete"));
  });
});
