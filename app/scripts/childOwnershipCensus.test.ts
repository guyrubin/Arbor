/**
 * B-DATA-15 — the zero-write child ownership census (Guy runs it against
 * production; builders never do). Synthetic paths and ids only.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { census, loadOwnership, readOnly, renderCensus } from "./child-ownership-census.mjs";

const fixture = {
  profiles: [
    { uid: "u1", childId: "c-owned" },
    { uid: "u2", childId: "c-unprovisioned" },
    { uid: "u3", childId: "c-legacy" },
    { uid: "u4", childId: "c-other-family" },
    { uid: "u5", childId: "c-shared" }, { uid: "u6", childId: "c-shared" },
  ],
  children: [
    { childId: "c-owned", familyId: "f1", issued: true },
    { childId: "c-legacy", familyId: "default-family", issued: false },
    { childId: "c-other-family", familyId: "f9", issued: false },
    { childId: "c-shared", familyId: "f5", issued: false },
    { childId: "c-issued-unused", familyId: "f1", issued: true },
    { childId: "c-orphan", familyId: "f7", issued: false },
  ],
  members: [{ familyId: "f1", uid: "u1" }, { familyId: "f5", uid: "u5" }, { familyId: "f9", uid: "someone-else" }],
};

describe("B-DATA-15 — child ownership census (counts only)", () => {
  it("counts every disagreement between a parent's profile and its ownership doc", () => {
    expect(census(fixture)).toEqual({
      profiles: 6, childDocs: 6, owned: 2, unprovisioned: 1, legacyOwner: 1, lockedOut: 2, sharedIds: 1,
      issuedUnused: 1, orphanChildDocs: 1, mismatches: 6,
    });
  });

  it("a clean store reads mismatches 0", () => {
    const clean = { profiles: [{ uid: "u1", childId: "c1" }], children: [{ childId: "c1", familyId: "f1", issued: true }], members: [{ familyId: "f1", uid: "u1" }] };
    expect(census(clean).mismatches).toBe(0);
    expect(renderCensus(census(clean))).toContain("mismatches 0");
  });

  it("the report prints counts only — never an id", () => {
    const text = renderCensus(census(fixture));
    for (const id of ["c-owned", "c-shared", "u1", "f1", "c-orphan"]) expect(text).not.toContain(id);
  });

  it("loads paths and two ownership fields through a handle that has no write method", async () => {
    const calls: string[] = [];
    const doc = (p: string, fields: Record<string, unknown> = {}) => ({ id: p.split("/").pop(), ref: { path: p }, get: (f: string) => fields[f] });
    const snap = (docs: unknown[]) => ({ docs });
    const q = (name: string, docs: unknown[]) => ({ select: (...f: string[]) => { calls.push(`${name}.select(${f.join(",")})`); return q(name, docs); }, get: async () => { calls.push(`${name}.get`); return snap(docs); } });
    const db = {
      collectionGroup: (name: string) => name === "children"
        ? q("group:children", [doc("users/u1/children/c1"), doc("children/c1"), doc("users/u1/children/c1/extra/x")])
        : q("group:members", [doc("families/f1/members/u1"), doc("families/f1/other/u1")]),
      collection: (name: string) => q(`col:${name}`, [doc("children/c1", { familyId: "f1", issuedAt: "2026-10-28" })]),
      set: () => { throw Error("write"); }, batch: () => { throw Error("write"); }, runTransaction: () => { throw Error("write"); },
    };
    expect(Object.keys(readOnly(db))).toEqual(["collection", "collectionGroup"]);
    expect(Object.keys(readOnly(db).collection("children"))).toEqual(["select", "get"]);
    const loaded = await loadOwnership(db);
    expect(loaded).toEqual({ profiles: [{ uid: "u1", childId: "c1" }], children: [{ childId: "c1", familyId: "f1", issued: true }], members: [{ familyId: "f1", uid: "u1" }] });
    expect(calls).toContain("group:children.select()");
    expect(calls).toContain("col:children.select(familyId,issuedAt)");
  });

  it("source holds no write call (zero-write by construction)", () => {
    const src = readFileSync(new URL("./child-ownership-census.mjs", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    // Firestore is reached only through `db.collection` / `db.collectionGroup`
    // inside readOnly(); no write API is named anywhere in the script.
    const dbMembers = [...src.matchAll(/\bdb\.(\w+)/g)].map(m => m[1]);
    expect(new Set(dbMembers)).toEqual(new Set(["collection", "collectionGroup"]));
    expect(src).not.toMatch(/batch\(|runTransaction|bulkWriter|recursiveDelete|\.commit\(|\.update\(|\.delete\(|\.create\(|\.doc\(/);
  });
});
