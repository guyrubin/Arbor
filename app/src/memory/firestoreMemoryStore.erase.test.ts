/**
 * B-GA-09 — the child's erase also removes the family's pointer to the child
 * (families/{familyId}/childRefs/{childId}: the child and family ids), so
 * nothing registered for the child remains on the server after /privacy/erase.
 * A path-keyed fake of the Admin SDK, synthetic ids only.
 */
import { describe, expect, it, vi } from "vitest";

const docs = vi.hoisted(() => new Map<string, Record<string, unknown>>());
vi.mock("firebase-admin/app", () => ({ getApps: () => [{}], initializeApp: vi.fn(), applicationDefault: vi.fn() }));
vi.mock("firebase-admin/firestore", () => {
  const ref = (path: string): Record<string, unknown> => ({
    path,
    id: path.split("/").at(-1),
    get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }),
    delete: async () => { docs.delete(path); },
    collection: (name: string) => col(`${path}/${name}`),
  });
  const col = (path: string) => ({
    doc: (id: string) => ref(`${path}/${id}`),
    get: async () => ({
      docs: [...docs.keys()]
        .filter((p) => p.startsWith(`${path}/`) && !p.slice(path.length + 1).includes("/"))
        .map((p) => ({ ref: ref(p), id: p.split("/").at(-1), data: () => docs.get(p) })),
    }),
  });
  const db = {
    collection: (name: string) => col(name),
    batch: () => {
      const doomed: string[] = [];
      return { delete: (r: { path: string }) => { doomed.push(r.path); }, commit: async () => { for (const p of doomed) docs.delete(p); } };
    },
  };
  return { getFirestore: () => db };
});

import { FirestoreMemoryStore } from "./firestoreMemoryStore";
import type { ArborConfig } from "../config/env";

describe("B-GA-09 · FirestoreMemoryStore.eraseChild", () => {
  it("removes the ledger, the child doc and the family's pointer; the sibling stays", async () => {
    docs.clear();
    docs.set("children/kid-a", { childId: "kid-a", familyId: "fam-1" });
    docs.set("children/kid-a/memoryEvents/e1", { childId: "kid-a" });
    docs.set("children/kid-a/memoryEvents/e2", { childId: "kid-a" });
    docs.set("families/fam-1/childRefs/kid-a", { childId: "kid-a", familyId: "fam-1" });
    docs.set("children/kid-b", { childId: "kid-b", familyId: "fam-1" });
    docs.set("families/fam-1/childRefs/kid-b", { childId: "kid-b", familyId: "fam-1" });
    const store = new FirestoreMemoryStore({ firebaseProjectId: "synthetic", firestoreDatabaseId: "(default)" } as ArborConfig);
    expect(await store.eraseChild("kid-a")).toBe(2);
    expect([...docs.keys()].filter((p) => p.includes("kid-a"))).toEqual([]);
    expect(docs.has("children/kid-b")).toBe(true);
    expect(docs.has("families/fam-1/childRefs/kid-b")).toBe(true);
  });

  it("a child doc without a family (legacy) still erases cleanly", async () => {
    docs.clear();
    docs.set("children/kid-c", { childId: "kid-c" });
    docs.set("children/kid-c/memoryEvents/e1", { childId: "kid-c" });
    const store = new FirestoreMemoryStore({ firebaseProjectId: "synthetic", firestoreDatabaseId: "(default)" } as ArborConfig);
    expect(await store.eraseChild("kid-c")).toBe(1);
    expect(docs.size).toBe(0);
  });
});
