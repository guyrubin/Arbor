/**
 * B-GROWTH-06 step (2) — the read-only collection census that must exist
 * before Guy is asked (G12) to delete the legacy `devScoreSnapshots` grades.
 * Pure helpers are tested offline (injected counter); the source is scanned
 * so a write or delete call can never creep into a script whose whole
 * contract is "zero writes".
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CHILD_SUBCOLLECTIONS } from "../lib/childData";
import * as census from "../../scripts/collection-census.mjs";

const SCRIPT = fs.readFileSync(path.resolve(__dirname, "..", "..", "scripts", "collection-census.mjs"), "utf8");
const code = SCRIPT.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("collection census — one row per registered child subcollection", () => {
  it("reads exactly CHILD_SUBCOLLECTIONS from the registry source", () => {
    expect(census.readChildSubcollections()).toEqual(CHILD_SUBCOLLECTIONS);
    expect(census.readChildSubcollections()).toContain("devScoreSnapshots");
  });

  it("prints an integer per name, and an ERROR row (never a silent 0) when a count fails", async () => {
    const rows = await census.runCensus(["devScoreSnapshots", "bandSnapshots", "broken"], async (n: string) => {
      if (n === "broken") throw new Error("permission-denied");
      return n === "devScoreSnapshots" ? 42 : 7;
    });
    expect(rows.map((r: { count: number | null }) => r.count)).toEqual([42, 7, null]);
    const table = census.formatCensus(rows);
    expect(table).toMatch(/devScoreSnapshots\s+42/);
    expect(table).toMatch(/broken\s+ERROR permission-denied/);
  });
});

describe("collection census — zero writes, zero document reads, no delete", () => {
  it("the only Firestore call is a collection-group count aggregation", () => {
    expect(code).toContain("db.collectionGroup(name).count().get()");
    for (const banned of [".delete(", ".set(", ".update(", ".add(", "batch(", "bulkWriter", "recursiveDelete", "runTransaction", ".listDocuments(", ".doc("]) {
      expect(code, `census must not call ${banned}`).not.toContain(banned);
    }
    // exactly one .get() — the count aggregation's — so no document is ever fetched
    expect(code.match(/\.get\(/g)?.length).toBe(1);
    expect(code).not.toMatch(/--(delete|purge|confirm)/);
  });

  it("NEGATIVE CONTROL — a purge-shaped line would trip the scan", () => {
    const purge = "await db.recursiveDelete(db.collectionGroup(name));";
    expect(purge).toContain("recursiveDelete");
  });
});
