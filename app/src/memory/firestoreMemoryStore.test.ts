/**
 * B-DATA-15 — the REAL FirestoreMemoryStore over an in-memory Firestore
 * (firebase-admin is mocked at its module boundary; no network, synthetic
 * ids only).
 *
 *  - appendEvent refuses an event stamped with a family that does not own the
 *    child (defense in depth behind requireChildOwnership): nothing is written
 *    to the child's ledger and the child doc is untouched. Before the fix the
 *    event was appended whenever ensureChild declined to re-parent.
 *  - The owner, the owner's second family doc (one parent, two first-login
 *    families) and a pre-OWN-1 'default-family' fact's own transitions still
 *    append.
 *  - issueChildId mints a random id whose child doc is already parented to the
 *    caller's family; a stranger's later append under that id is refused.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Data = Record<string, unknown>;
class Doc {
  constructor(readonly db: Db, readonly segs: string[]) {}
  get id() { return this.segs[this.segs.length - 1]; }
  get path() { return this.segs.join("/"); }
  collection(name: string) { return new Col(this.db, [...this.segs, name]); }
  async get() { const data = this.db.docs.get(this.path); return { exists: data !== undefined, id: this.id, data: () => data }; }
  async set(data: Data, opts?: { merge?: boolean }) { this.db.write(this.path, data, opts); }
}
class Col {
  constructor(readonly db: Db, readonly segs: string[]) {}
  doc(id: string) { return new Doc(this.db, [...this.segs, id]); }
  async get() {
    const prefix = `${this.segs.join("/")}/`;
    const docs = [...this.db.docs.keys()].filter(p => p.startsWith(prefix) && !p.slice(prefix.length).includes("/"));
    return { docs: docs.map(p => ({ id: p.slice(prefix.length), ref: new Doc(this.db, p.split("/")) })) };
  }
}
class Db {
  readonly docs = new Map<string, Data>();
  readonly writes: string[] = [];
  write(path: string, data: Data, opts?: { merge?: boolean }) {
    this.writes.push(path);
    const prev = this.docs.get(path);
    this.docs.set(path, opts?.merge && prev ? { ...prev, ...data } : { ...data });
  }
  collection(name: string) { return new Col(this, [name]); }
  collectionGroup(name: string) {
    const db = this;
    const query = (field?: string, value?: unknown) => ({
      where: (f: string, _op: string, v: unknown) => query(f, v),
      limit: () => query(field, value),
      async get() {
        const hits = [...db.docs.entries()].filter(([p, d]) => { const s = p.split("/"); return s.length >= 2 && s[s.length - 2] === name && (field === undefined || d[field] === value); });
        return { docs: hits.map(([p]) => ({ ref: new Doc(db, p.split("/")) })) };
      },
    });
    return query();
  }
  async runTransaction<T>(fn: (tx: unknown) => Promise<T>) {
    return fn({ get: (ref: Doc) => ref.get(), set: (ref: Doc, data: Data, opts?: { merge?: boolean }) => this.write(ref.path, data, opts) });
  }
}

const shared = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("firebase-admin/app", () => ({ getApps: () => [{}], initializeApp: () => ({}), applicationDefault: () => ({}) }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: () => shared.db }));

import { FirestoreMemoryStore } from "./firestoreMemoryStore";
import type { ArborConfig } from "../config/env";
import type { MemoryLedgerEvent } from "./types";

const event = (familyId: string, childId: string, eventId = "evt-1"): MemoryLedgerEvent => ({
  eventId, memoryId: `mem-${eventId}`, familyId, childId, eventType: "proposed", status: "pending",
  fact: "Likes the blue cup", source: "conversation", retention: "3 months", createdAt: "2026-10-28T09:00:00.000Z", actor: "system",
});
let db: Db;
let store: FirestoreMemoryStore;
beforeEach(async () => {
  db = new Db(); shared.db = db;
  store = new FirestoreMemoryStore({ firebaseProjectId: "synthetic", firestoreDatabaseId: "(default)" } as ArborConfig);
  // The owner's family owns kid-1.
  await store.ensureFamilyChild({ familyId: "fam-owner", childId: "kid-1", userId: "parent-1" });
  await store.ensureFamilyChild({ familyId: "fam-stranger", childId: "kid-stranger", userId: "stranger-1" });
});

describe("B-DATA-15 — appendEvent refuses a family that does not own the child", () => {
  it("a stranger's family: rejected, no ledger write, the child doc byte-identical", async () => {
    const before = JSON.stringify(db.docs.get("children/kid-1"));
    await expect(store.appendEvent(event("fam-stranger", "kid-1"))).rejects.toThrow(/not authorized/);
    expect([...db.docs.keys()].some(p => p.startsWith("children/kid-1/memoryEvents/"))).toBe(false);
    expect(JSON.stringify(db.docs.get("children/kid-1"))).toBe(before);
  });

  it("the owning family appends", async () => {
    await store.appendEvent(event("fam-owner", "kid-1"));
    expect(db.docs.get("children/kid-1/memoryEvents/evt-1")).toMatchObject({ familyId: "fam-owner" });
  });

  it("the owner's second family doc (a member of the owning family) still appends", async () => {
    await store.ensureFamilyChild({ familyId: "fam-owner-2", childId: "kid-owner-2", userId: "parent-1" });
    await store.appendEvent(event("fam-owner-2", "kid-1", "evt-2"));
    expect(db.docs.has("children/kid-1/memoryEvents/evt-2")).toBe(true);
    expect(db.docs.get("children/kid-1")?.familyId).toBe("fam-owner");
  });

  it("a pre-OWN-1 fact's own 'default-family' transition still appends to its re-parented child", async () => {
    await store.appendEvent(event("default-family", "kid-1", "evt-3"));
    expect(db.docs.has("children/kid-1/memoryEvents/evt-3")).toBe(true);
    expect(db.docs.get("children/kid-1")?.familyId).toBe("fam-owner");
  });
});

describe("B-DATA-15 — child ids are issued by the server", () => {
  it("issues a random id whose child doc is already the caller's family's; ids never repeat", async () => {
    const a = await store.issueChildId({ familyId: "fam-owner", userId: "parent-1" });
    const b = await store.issueChildId({ familyId: "fam-owner", userId: "parent-1" });
    expect(a).toMatch(/^child-[0-9a-f-]{36}$/);
    expect(b).not.toBe(a);
    expect(db.docs.get(`children/${a}`)).toMatchObject({ childId: a, familyId: "fam-owner" });
    expect(await store.ownsChild("parent-1", a)).toBe(true);
    expect(await store.ownsChild("stranger-1", a)).toBe(false);
  });

  it("a stranger can neither claim nor write to an issued id", async () => {
    const id = await store.issueChildId({ familyId: "fam-owner", userId: "parent-1" });
    await store.ensureFamilyChild({ familyId: "fam-stranger", childId: id, userId: "stranger-1" });
    expect(db.docs.get(`children/${id}`)?.familyId).toBe("fam-owner");
    await expect(store.appendEvent(event("fam-stranger", id, "evt-4"))).rejects.toThrow(/not authorized/);
  });
});
