/**
 * W0.5 + W0.6 — syncStore unit tests.
 *
 * Invariants:
 *   1. reportSyncError registers (name, childId) and notifies subscribers.
 *   2. Duplicate reports for the same (name, childId) are no-ops (no churn).
 *   3. clearSyncError removes the entry and notifies; clearing an absent
 *      entry notifies nobody.
 *   4. Snapshot is reference-stable between emits (useSyncExternalStore safe).
 *   5. retrySync bumps version and notifies (the listener re-mount signal).
 *   6. Unsubscribed listeners stop firing; a throwing listener never breaks
 *      the store or its sibling listeners.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  __resetSyncStoreForTests,
  clearSyncError,
  getSyncSnapshot,
  reportSyncError,
  retrySync,
  subscribeSyncStatus,
} from "./syncStore";

beforeEach(() => {
  __resetSyncStoreForTests();
});

describe("syncStore: error register / clear", () => {
  it("registers an error entry and notifies subscribers", () => {
    const listener = vi.fn();
    subscribeSyncStatus(listener);

    reportSyncError("milestones", "child-1");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getSyncSnapshot().errors).toEqual([{ name: "milestones", childId: "child-1" }]);
  });

  it("dedupes repeated errors from the same (name, childId) — no notify churn", () => {
    const listener = vi.fn();
    subscribeSyncStatus(listener);

    reportSyncError("milestones", "child-1");
    reportSyncError("milestones", "child-1");
    reportSyncError("milestones", "child-1");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getSyncSnapshot().errors.length).toBe(1);
  });

  it("tracks distinct collections and children separately", () => {
    reportSyncError("milestones", "child-1");
    reportSyncError("behaviorLogs", "child-1");
    reportSyncError("milestones", "child-2");

    expect(getSyncSnapshot().errors.length).toBe(3);
  });

  it("clearSyncError removes the entry and notifies", () => {
    reportSyncError("milestones", "child-1");
    const listener = vi.fn();
    subscribeSyncStatus(listener);

    clearSyncError("milestones", "child-1");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getSyncSnapshot().errors).toEqual([]);
  });

  it("clearing an absent entry does NOT notify (idempotent happy path)", () => {
    const listener = vi.fn();
    subscribeSyncStatus(listener);

    clearSyncError("milestones", "child-1");

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("syncStore: snapshot semantics (useSyncExternalStore contract)", () => {
  it("snapshot reference is stable between emits", () => {
    reportSyncError("plans", "child-9");
    const a = getSyncSnapshot();
    const b = getSyncSnapshot();
    expect(a).toBe(b);
  });

  it("snapshot reference changes after an emit", () => {
    const before = getSyncSnapshot();
    reportSyncError("plans", "child-9");
    expect(getSyncSnapshot()).not.toBe(before);
  });
});

describe("syncStore: retry (version bump → listener re-mount signal)", () => {
  it("retrySync bumps version and notifies subscribers", () => {
    const listener = vi.fn();
    subscribeSyncStatus(listener);
    const v0 = getSyncSnapshot().version;

    retrySync();

    expect(getSyncSnapshot().version).toBe(v0 + 1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("retrySync leaves error entries in place (the re-mounted listener clears them)", () => {
    reportSyncError("milestones", "child-1");
    retrySync();
    expect(getSyncSnapshot().errors.length).toBe(1);
  });
});

describe("syncStore: subscription lifecycle", () => {
  it("unsubscribe stops notifications", () => {
    const listener = vi.fn();
    const unsub = subscribeSyncStatus(listener);
    unsub();

    reportSyncError("milestones", "child-1");

    expect(listener).not.toHaveBeenCalled();
  });

  it("a throwing listener never breaks the store or sibling listeners", () => {
    const bad = vi.fn(() => {
      throw new Error("listener exploded");
    });
    const good = vi.fn();
    subscribeSyncStatus(bad);
    subscribeSyncStatus(good);

    expect(() => reportSyncError("milestones", "child-1")).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
    expect(getSyncSnapshot().errors.length).toBe(1);
  });
});
