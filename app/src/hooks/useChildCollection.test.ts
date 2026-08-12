/**
 * W0.5 — useChildCollection error surfacing.
 *
 * The vitest environment is node (no jsdom / no React renderer in the repo's
 * test stack — see scripts/vitest.config.mjs), so per the masterplan build
 * card this file combines:
 *   (a) a behavioral test of the exact error-callback SEQUENCE the hook runs,
 *       executed against the real syncStore (the banner's data source), and
 *   (b) source-level assertions pinning the hook's wiring: the interface
 *       exports `error: boolean`, the onSnapshot error callback still applies
 *       the localStorage fallback (setItems(readLocal()) + setLoaded(true) —
 *       byte-compatible degrade) AND now sets error/reports to the store, and
 *       the success path clears both.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  __resetSyncStoreForTests,
  getSyncSnapshot,
  reportSyncError,
} from "../lib/syncStore";

const src = readFileSync(
  fileURLToPath(new URL("./useChildCollection.ts", import.meta.url)),
  "utf8",
);

beforeEach(() => {
  __resetSyncStoreForTests();
});

// ── (a) Behavioral: the error-callback sequence feeds the global banner ──────

describe("W0.5: error callback sequence (against the real store)", () => {
  it("an onSnapshot error registers (name, childId) so the banner can show", () => {
    // This is the exact call the hook's error callback makes.
    reportSyncError("milestones", "child-1");
    const snap = getSyncSnapshot();
    expect(snap.errors).toEqual([{ name: "milestones", childId: "child-1" }]);
  });

  it("Firestore's repeated error callbacks don't churn the store", () => {
    reportSyncError("milestones", "child-1");
    const after = getSyncSnapshot();
    reportSyncError("milestones", "child-1");
    expect(getSyncSnapshot()).toBe(after); // same reference → no re-render
  });
});

// ── (b) Source-level: the hook's wiring is pinned ─────────────────────────────

describe("W0.5: ChildCollection interface exports error", () => {
  it("interface has `error: boolean`", () => {
    const iface = src.match(/export interface ChildCollection<[\s\S]*?\n\}/)?.[0] ?? "";
    expect(iface).toContain("error: boolean;");
  });

  it("the hook returns `error` alongside items/loaded", () => {
    expect(src).toMatch(/return \{ items, loaded, error, remote, upsert, remove, replaceAll \};/);
  });
});

describe("W0.5: onSnapshot error callback — additive, fallback intact", () => {
  // The error callback is the second function argument to onSnapshot; grab the
  // block between the success callback's end and the closing of onSnapshot.
  const errorCallback = src.slice(src.indexOf("Permission/network error"), src.indexOf("return () => {"));

  it("STILL applies the localStorage fallback (byte-compatible degrade)", () => {
    expect(errorCallback).toContain("setItems(readLocal());");
    expect(errorCallback).toContain("setLoaded(true);");
  });

  it("sets error=true and registers with the sync store while items keep the fallback", () => {
    // Order pinned: fallback items FIRST, then the error flag — cached/local
    // data renders, the error is a banner, never a wall.
    const idxItems = errorCallback.indexOf("setItems(readLocal());");
    const idxError = errorCallback.indexOf("setError(true);");
    expect(idxItems).toBeGreaterThanOrEqual(0);
    expect(idxError).toBeGreaterThan(idxItems);
    expect(errorCallback).toContain("reportSyncError(name, childId);");
  });
});

describe("W0.5: success path clears the error (and nothing else changed)", () => {
  it("successful snapshot sets error=false and clears the store entry", () => {
    const successCallback = src.slice(src.indexOf("(snap) => {"), src.indexOf("Permission/network error"));
    expect(successCallback).toContain("setError(false);");
    expect(successCallback).toContain("clearSyncError(name, childId);");
    // Happy-path lines are byte-identical to pre-W0.5:
    expect(successCallback).toContain(
      "setItems(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id })) as T[]);",
    );
    expect(successCallback).toContain("setLoaded(true);");
  });

  it("listener cleanup retires the store entry (no stale banner after unmount)", () => {
    const cleanup = src.slice(src.indexOf("return () => {"), src.indexOf("setItems(readLocal(opts?.sandboxSeed));"));
    expect(cleanup).toContain("unsub();");
    expect(cleanup).toContain("clearSyncError(name, childId);");
  });

  it("retry seam: the subscribe effect re-runs on store version bumps", () => {
    expect(src).toContain("useSyncExternalStore(");
    expect(src).toMatch(/\}, \[remote, uid, childId, name, syncVersion\]\);/);
  });
});
