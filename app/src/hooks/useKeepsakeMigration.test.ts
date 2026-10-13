import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { firstsKeepsakeKey, upsertKeepsake, writeKeepsakes, type KeepsakeDoc, type KeepsakeMap } from "../lib/firstsKeepsake";
import {
  claimKeepsakeMigration, newKeepsakeMigrationGate, releaseKeepsakeMigration, runKeepsakeMigration,
} from "./useKeepsakeMigration";

/**
 * v3 F-CHILD-1 — the Milestones pill runs the one-time keepsake migration that
 * the old Milestones page ran: a legacy device-local key is written into the
 * subcollection ONCE per child, never against a switched child's stale
 * collection, never before the load, and a failure retries.
 */

const memStore = () => {
  const map = new Map<string, string>();
  const s = {
    get length() { return map.size; },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
  } as Storage;
  return { s, map };
};

const A = "kid-a";
const B = "kid-b";
const DAY = "2026-09-20";
const keep = (milestoneId: string, note: string): KeepsakeMap =>
  upsertKeepsake({}, { milestoneId, note, noticedOn: DAY }, "2026-09-20T08:00:00Z");

const recorder = () => {
  const written: KeepsakeDoc[] = [];
  return { written, upsert: async (d: KeepsakeDoc) => { written.push(d); } };
};

describe("v3 F-CHILD-1 — the keepsake migration runs once per child", () => {
  it("a legacy key is upserted once for its child, then never again in this mount", async () => {
    const { s, map } = memStore();
    writeKeepsakes(A, keep("ms-1", "a first step"), s);
    const gate = newKeepsakeMigrationGate(A);
    const { written, upsert } = recorder();

    // Before the collection loaded: nothing runs.
    expect(runKeepsakeMigration(gate, A, false, {}, upsert, s)).toBeNull();
    // Loaded: the one move.
    expect(await runKeepsakeMigration(gate, A, true, {}, upsert, s)).toBe(1);
    expect(written.map((d) => d.id)).toEqual(["ms-1"]);
    expect(map.has(firstsKeepsakeKey(A))).toBe(false);

    // Every later commit (the written doc arriving, a re-render) is a no-op,
    // even if a stale copy of the key reappeared.
    writeKeepsakes(A, keep("ms-1", "a first step"), s);
    expect(runKeepsakeMigration(gate, A, true, {}, upsert, s)).toBeNull();
    expect(runKeepsakeMigration(gate, A, true, {}, upsert, s)).toBeNull();
    expect(written).toHaveLength(1);
  });

  it("the first commit after a child switch never runs, then the new child's key moves once", async () => {
    const { s } = memStore();
    writeKeepsakes(A, keep("ms-1", "for a"), s);
    writeKeepsakes(B, keep("ms-2", "for b"), s);
    const gate = newKeepsakeMigrationGate(A);
    const { written, upsert } = recorder();
    await runKeepsakeMigration(gate, A, true, {}, upsert, s);

    // B's first commit still holds A's documents: no run, whatever `loaded` says.
    expect(runKeepsakeMigration(gate, B, true, keep("ms-1", "for a"), upsert, s)).toBeNull();
    expect(await runKeepsakeMigration(gate, B, true, {}, upsert, s)).toBe(1);
    expect(runKeepsakeMigration(gate, B, true, {}, upsert, s)).toBeNull();
    expect(written.map((d) => d.note)).toEqual(["for a", "for b"]);
  });

  it("a failed write keeps the key and releases the claim, so the next load retries", async () => {
    const { s, map } = memStore();
    writeKeepsakes(A, keep("ms-1", "kept"), s);
    const gate = newKeepsakeMigrationGate(A);
    const offline = async () => { throw new Error("offline"); };

    expect(await runKeepsakeMigration(gate, A, true, {}, offline, s)).toBe(0);
    expect(map.has(firstsKeepsakeKey(A))).toBe(true);
    expect(gate.migratedFor).toBeNull();

    const { written, upsert } = recorder();
    expect(await runKeepsakeMigration(gate, A, true, {}, upsert, s)).toBe(1);
    expect(written).toHaveLength(1);
    expect(map.has(firstsKeepsakeKey(A))).toBe(false);
  });

  it("a late failure for a child the page left never clears the new child's claim", () => {
    const gate = newKeepsakeMigrationGate(A);
    expect(claimKeepsakeMigration(gate, A, true)).toBe(true);
    expect(claimKeepsakeMigration(gate, B, true)).toBe(false); // switch commit
    expect(claimKeepsakeMigration(gate, B, true)).toBe(true);
    releaseKeepsakeMigration(gate, A);
    expect(gate.migratedFor).toBe(B);
    expect(claimKeepsakeMigration(gate, B, true)).toBe(false);
  });

  it("the Milestones pill's areas card wires the hook to its keepsake collection", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(path.join(here, "..", "components", "companion", "MilestoneAreas.tsx"), "utf8").replace(/\r\n/g, "\n");
    expect(source).toContain('import { useKeepsakeMigration } from "../../hooks/useKeepsakeMigration";');
    expect(source).toContain("useKeepsakeMigration(childProfile.id, keepsakeCol, keepsakes);");
    // Negative control: the shape the defect had (a collection with no migration).
    const defect = source.replace("useKeepsakeMigration(childProfile.id, keepsakeCol, keepsakes);", "");
    expect(defect).not.toContain("useKeepsakeMigration(childProfile.id");
  });
});
