/**
 * B-GA-09 rounds 5–6 — a production retry of the child's erase passes the
 * owner check, and account deletion finishes a child whose erase stopped half
 * way. The child doc is the ownership anchor (FamilyService.ownsChild reads its
 * familyId), and the erase used to delete it FIRST: when shares, consents,
 * consults or Storage then failed, or the response was lost, every retry got a
 * 403 and the server data stayed. And account deletion only looked under
 * users/{uid}/children, which the device half of the erase had already
 * removed, so it left the half-erased child's record, ledger and book files.
 *
 * Driven through the REAL router, the REAL FirestoreMemoryStore /
 * FamilyService and the REAL account-deletion executors on a path-keyed fake
 * of the Admin SDK, with a Storage bucket whose delete can fail. Synthetic ids.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

const docs = vi.hoisted(() => new Map<string, Record<string, unknown>>());
const objects = vi.hoisted(() => new Set<string>());
const storageFailures = vi.hoisted(() => ({ left: 0 }));
const authDeleted = vi.hoisted(() => [] as string[]);

vi.mock("firebase-admin/app", () => ({ getApps: () => [{}], initializeApp: vi.fn(), applicationDefault: vi.fn() }));
vi.mock("firebase-admin/firestore", () => {
  type Filter = { field: string; op: string; value: unknown };
  const parentOf = (path: string) => path.split("/").slice(0, -1).join("/");
  const ref = (path: string): any => ({
    path,
    id: path.split("/").at(-1),
    get parent() { return col(parentOf(path)); },
    get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }),
    set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => { docs.set(path, opts?.merge ? { ...(docs.get(path) ?? {}), ...data } : { ...data }); },
    update: async (data: Record<string, unknown>) => { docs.set(path, { ...(docs.get(path) ?? {}), ...data }); },
    delete: async () => { docs.delete(path); },
    collection: (name: string) => col(`${path}/${name}`),
  });
  const matches = (p: string, f: Filter) => {
    const v = f.field === "__id__" ? p.split("/").at(-1) : docs.get(p)?.[f.field];
    if (f.op === "==") return v === f.value;
    if (f.op === "array-contains") return Array.isArray(v) && v.includes(f.value);
    if (f.op === ">=") return String(v) >= String(f.value);
    if (f.op === "<") return String(v) < String(f.value);
    throw new Error(`fake: op ${f.op}`);
  };
  const query = (pick: (p: string) => boolean, filters: Filter[] = [], lim = Infinity): any => ({
    where: (field: string, op: string, value: unknown) => query(pick, [...filters, { field, op, value }], lim),
    limit: (n: number) => query(pick, filters, n),
    orderBy: () => query(pick, filters, lim),
    get: async () => {
      const hits = [...docs.keys()].filter((p) => pick(p) && filters.every((f) => matches(p, f))).sort().slice(0, lim);
      return { empty: hits.length === 0, size: hits.length, docs: hits.map((p) => ({ ref: ref(p), id: p.split("/").at(-1), data: () => docs.get(p) })) };
    },
  });
  const col = (path: string): any => ({
    ...query((p) => parentOf(p) === path),
    path,
    id: path.split("/").at(-1),
    get parent() { return path.includes("/") ? ref(parentOf(path)) : null; },
    doc: (id: string) => ref(`${path}/${id}`),
  });
  const db = {
    collection: (name: string) => col(name),
    collectionGroup: (name: string) => query((p) => parentOf(p).split("/").at(-1) === name),
    doc: (path: string) => ref(path),
    runTransaction: async <T>(fn: (t: any) => Promise<T>): Promise<T> =>
      fn({ get: (r: any) => r.get(), set: (r: any, data: Record<string, unknown>, opts?: { merge?: boolean }) => { void r.set(data, opts); } }),
    batch: () => {
      const doomed: string[] = [];
      return { delete: (r: { path: string }) => { doomed.push(r.path); }, commit: async () => { for (const p of doomed) docs.delete(p); } };
    },
    recursiveDelete: async (r: { path: string }) => { for (const p of [...docs.keys()]) if (p === r.path || p.startsWith(`${r.path}/`)) docs.delete(p); },
  };
  return { getFirestore: () => db, FieldPath: { documentId: () => "__id__" }, FieldValue: { arrayRemove: (v: unknown) => ({ __arrayRemove: v }) } };
});
vi.mock("firebase-admin/auth", () => ({ getAuth: () => ({ revokeRefreshTokens: async () => undefined, deleteUser: async (uid: string) => { authDeleted.push(uid); } }) }));
vi.mock("firebase-admin/storage", () => {
  const file = (name: string) => ({ name, delete: async () => { objects.delete(name); } });
  const bucket = {
    file,
    getFiles: async ({ prefix }: { prefix: string }) => [[...objects].filter((n) => n.startsWith(prefix)).map(file)],
    deleteFiles: async ({ prefix }: { prefix: string }) => {
      if (storageFailures.left > 0) { storageFailures.left -= 1; throw new Error("synthetic transient Storage failure"); }
      for (const n of [...objects]) if (n.startsWith(prefix)) objects.delete(n);
    },
  };
  return { getStorage: () => ({ bucket: () => bucket }) };
});

import { createApiRouter } from "./api.js";
import { createTestConfig } from "../testConfig.js";
import { loadFramework } from "../services/framework.js";
import { LocalConsentStore, type ConsentGrant } from "../sharing/consent.js";
import { createCounterStore } from "../server/quotaStore.js";
import { createEntitlementStore } from "../server/entitlements.js";
import { createReferralStore } from "../server/referral.js";
import { LocalConsultStore, buildConsultRequest } from "../server/consultRequests.js";
import { createAdminMetricsStore } from "../server/adminMetrics.js";
import { createWaitlistStore } from "../server/waitlist.js";
import type { ModelProvider } from "../ai/modelRouter.js";
import { FirestoreMemoryStore } from "../memory/firestoreMemoryStore.js";

const OWNER = "synthetic-owner";
const MEMBER = "synthetic-family-member";
const STRANGER = "synthetic-stranger";
const CHILD = "kid-a";
const FAMILY = "fam-1";

const servers: Server[] = [];
afterAll(async () => {
  await Promise.all(servers.map((s) => new Promise<void>((res) => s.close(() => res()))));
});

let shares: Array<{ id: string; ownerUid: string; childId: string }> = [];
let consentStore = new LocalConsentStore();
let consultStore = new LocalConsultStore();

beforeEach(async () => {
  docs.clear();
  objects.clear();
  storageFailures.left = 0;
  authDeleted.length = 0;
  docs.set(`children/${CHILD}`, { childId: CHILD, familyId: FAMILY });
  docs.set(`children/${CHILD}/memoryEvents/e1`, { childId: CHILD });
  docs.set(`children/${CHILD}/memoryEvents/e2`, { childId: CHILD });
  docs.set(`families/${FAMILY}/childRefs/${CHILD}`, { childId: CHILD, familyId: FAMILY });
  docs.set(`families/${FAMILY}/members/${OWNER}`, { userId: OWNER });
  docs.set(`families/${FAMILY}/members/${MEMBER}`, { userId: MEMBER });
  docs.set(`users/${OWNER}/children/${CHILD}`, { id: CHILD, name: "Synthetic Child" });
  objects.add(`users/${OWNER}/children/${CHILD}/photos/p1.jpg`);
  objects.add(`children/${CHILD}/books/synthetic-book/manifest.json`);
  shares = [{ id: "s1", ownerUid: OWNER, childId: CHILD }];
  consentStore = new LocalConsentStore();
  consultStore = new LocalConsultStore();
  const grant: ConsentGrant = { id: "c1", childId: CHILD, purpose: "voice_processing", granted: true, policyVersion: "v1", actorUid: OWNER, grantedAt: "2026-10-01T00:00:00.000Z", expiresAt: null, revokedAt: null };
  await consentStore.set(grant);
});

async function serve(storeFor: (config: ReturnType<typeof createTestConfig>) => any = (config) => new FirestoreMemoryStore(config)): Promise<string> {
  const config = createTestConfig({ storageBucket: "synthetic-bucket", memoryAdapter: "firestore" });
  const entitlementStore = createEntitlementStore(createTestConfig({}));
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as { user?: { uid: string } }).user = { uid: req.header("x-test-user") || OWNER }; next(); });
  app.use("/api", createApiRouter({
    config,
    modelProvider: { generateJson: async () => ({}) } as unknown as ModelProvider,
    memoryStore: storeFor(config),
    shareStore: {
      listByOwner: async (owner: string, childId?: string) => shares.filter((s) => s.ownerUid === owner && (!childId || s.childId === childId)),
      eraseByChild: async (owner: string, childId: string) => {
        const before = shares.length;
        shares = shares.filter((s) => !(s.ownerUid === owner && s.childId === childId));
        return before - shares.length;
      },
    } as never,
    consentStore,
    framework: loadFramework(),
    entitlementStore,
    referralStore: createReferralStore(createTestConfig({}), entitlementStore),
    counters: createCounterStore(createTestConfig({})),
    consultStore,
    adminMetrics: createAdminMetricsStore(createTestConfig({})),
    waitlistStore: createWaitlistStore(createTestConfig({})),
    pushTokenStore: { upsert: async () => undefined, remove: async () => undefined, getToken: async () => null },
    digestOptInStore: { get: async () => null, put: async () => undefined, remove: async () => undefined, markSent: async () => undefined },
  }));
  const server = await new Promise<Server>((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const erase = (base: string, user = OWNER) =>
  fetch(`${base}/api/privacy/erase`, { method: "POST", headers: { "Content-Type": "application/json", "x-test-user": user }, body: JSON.stringify({ childId: CHILD }) });
/** Server-held docs about the child (the users/ tree is the device half's, erased by wipeClientChildData). */
const left = () => [...docs.keys()].filter((p) => p.includes(CHILD) && !p.startsWith("erasedChildren/") && !p.startsWith("users/"));
const deleteAccount = (base: string, user = OWNER, extra: Record<string, unknown> = {}) =>
  fetch(`${base}/api/account/delete`, { method: "POST", headers: { "Content-Type": "application/json", "x-test-user": user }, body: JSON.stringify({ confirm: "DELETE", ...extra }) });
/** A co-parent's consult request about the child (the route has erased these since round 2). */
const coParentConsult = (childId = CHILD) =>
  consultStore.create(buildConsultRequest({ ownerUid: "synthetic-co-parent", ownerEmail: null, childId, professionalId: "p", professionalName: "Synthetic SLP" }));
/** The consent step fails once (the erase stops there: Storage, the ledger and the anchor are untouched). */
function failConsentsOnce() {
  const real = consentStore.eraseByChild.bind(consentStore);
  let failed = false;
  consentStore.eraseByChild = async (childId: string) => {
    if (!failed) { failed = true; throw new Error("synthetic consent store failure"); }
    return real(childId);
  };
}

describe("B-GA-09 · a retried erase still passes the owner check", () => {
  it("Storage fails once: the anchor survives the failure, the retry passes the owner check and finishes", async () => {
    const base = await serve();
    storageFailures.left = 1;
    const first = await erase(base);
    expect(first.status).toBe(500);
    // the owner check's anchor is still there, with the ledger it guards,
    // and the erase record was written first (round 6: account deletion finds it)
    expect(docs.get(`children/${CHILD}`)).toMatchObject({ familyId: FAMILY });
    expect(docs.get(`erasedChildren/${CHILD}`)).toMatchObject({ childId: CHILD, familyId: FAMILY });
    expect(objects.size).toBe(2);

    const retry = await erase(base);
    expect(retry.status).toBe(200);
    const body = await retry.json() as { erased: Record<string, number>; storage: Record<string, number> };
    expect(body.erased).toMatchObject({ memoryEvents: 2, storageFiles: 2 });
    expect(body.storage).toEqual({ photos: 1, books: 1 });
    expect(left()).toEqual([]);
    expect(objects.size).toBe(0);
  });

  it("a lost response: the anchor is gone, and the same family's retry still passes (the erase tombstone); a stranger's does not", async () => {
    const base = await serve();
    expect((await erase(base)).status).toBe(200);
    expect(docs.has(`children/${CHILD}`)).toBe(false);
    expect((await erase(base, STRANGER)).status).toBe(403);
    const again = await erase(base);
    expect(again.status).toBe(200);
    expect((await again.json() as { erased: Record<string, number> }).erased).toEqual({ memoryEvents: 0, shares: 0, consents: 0, consultRequests: 0, storageFiles: 0 });
    expect((await erase(base, MEMBER)).status).toBe(200);
  });

  it("the tombstone holds ids and dates only, and expires", async () => {
    const base = await serve();
    await erase(base);
    const tomb = docs.get(`erasedChildren/${CHILD}`)!;
    expect(Object.keys(tomb).sort()).toEqual(["childId", "erasedAt", "expireAt", "familyId"]);
    expect(tomb).toMatchObject({ childId: CHILD, familyId: FAMILY });
    const days = ((tomb.expireAt as Date).getTime() - Date.parse(tomb.erasedAt as string)) / 86_400_000;
    expect(days).toBe(30);
    docs.set(`erasedChildren/${CHILD}`, { ...tomb, expireAt: new Date(Date.now() - 1000) });
    expect((await erase(base)).status).toBe(403);
  });

  it("while a child doc exists, only its own family passes; an old tombstone never lets another family in", async () => {
    const base = await serve();
    docs.set(`erasedChildren/${CHILD}`, { childId: CHILD, familyId: "fam-old", erasedAt: new Date().toISOString(), expireAt: new Date(Date.now() + 86_400_000) });
    docs.set(`families/fam-old/members/${STRANGER}`, { userId: STRANGER });
    expect((await erase(base, STRANGER)).status).toBe(403);
    expect(docs.has(`children/${CHILD}`)).toBe(true);
  });
});

describe("B-GA-09 round 6 · account deletion finishes a child whose erase stopped half way", () => {
  it("the erase failed and the device half removed the profile: deleting the account still erases the child's record, ledger, consents, books and its erase record", async () => {
    docs.delete(`families/${FAMILY}/members/${MEMBER}`); // a one-parent family
    const base = await serve();
    failConsentsOnce();
    expect((await erase(base)).status).toBe(500);
    // eraseEverything's device half runs anyway: the child's profile leaves users/{uid}/children
    docs.delete(`users/${OWNER}/children/${CHILD}`);
    expect(left().length).toBeGreaterThan(0);
    expect(await consentStore.list(CHILD)).toHaveLength(1);
    expect([...objects]).toContain(`children/${CHILD}/books/synthetic-book/manifest.json`);
    await coParentConsult(); // round 7: account deletion runs the route's per-child erase, consults included

    const res = await deleteAccount(base);
    expect(res.status).toBe(200);
    const receipt = await res.json() as { complete: boolean; classes: Array<{ class: string; note?: string; failed: number }> };
    expect(receipt.classes.filter((c) => c.failed > 0)).toEqual([]);
    expect(receipt.complete).toBe(true);
    expect(receipt.classes.find((c) => c.class === "childData")?.note).toMatch(/1 left by an unfinished erase/);
    expect([...docs.keys()].filter((p) => p.includes(CHILD))).toEqual([]); // the record, ledger, pointer and erase record
    expect(await consentStore.list(CHILD)).toEqual([]);
    expect(await consultStore.listByChild("synthetic-co-parent", CHILD)).toEqual([]);
    expect([...objects]).toEqual([]);
    expect(authDeleted).toEqual([OWNER]);
  });

  it("a co-parent's account deletion finishes the erase the family started, and leaves the family's other children", async () => {
    // kid-b: the other parent's child, never erased. kid-c: an erase the other parent started, stopped half way.
    docs.set("children/kid-b", { childId: "kid-b", familyId: FAMILY });
    docs.set("children/kid-b/memoryEvents/e1", { childId: "kid-b" });
    docs.set(`families/${FAMILY}/childRefs/kid-b`, { childId: "kid-b", familyId: FAMILY });
    docs.set(`users/${MEMBER}/children/kid-b`, { id: "kid-b" });
    docs.set("children/kid-c", { childId: "kid-c", familyId: FAMILY });
    docs.set("children/kid-c/memoryEvents/e1", { childId: "kid-c" });
    docs.set(`families/${FAMILY}/childRefs/kid-c`, { childId: "kid-c", familyId: FAMILY });
    docs.set("erasedChildren/kid-c", { childId: "kid-c", familyId: FAMILY, erasedAt: new Date().toISOString(), expireAt: new Date(Date.now() + 86_400_000) });
    const base = await serve();
    const res = await deleteAccount(base);
    expect(res.status).toBe(200);
    expect((await res.json() as { complete: boolean }).complete).toBe(true);
    // the owner's own child and the started erase are finished
    expect([...docs.keys()].filter((p) => p.includes(CHILD) || p.includes("kid-c"))).toEqual([]);
    // the family keeps its other member and that member's child
    expect(docs.has(`families/${FAMILY}/members/${MEMBER}`)).toBe(true);
    expect(docs.has("children/kid-b")).toBe(true);
    expect(docs.has("children/kid-b/memoryEvents/e1")).toBe(true);
    expect(docs.has(`families/${FAMILY}/childRefs/kid-b`)).toBe(true);
  });

  it("the erase record's 30-day TTL ships with the deploy (firestore.indexes.json), not as a manual step", () => {
    const indexes = JSON.parse(readFileSync(new URL("../../../firestore.indexes.json", import.meta.url), "utf8")) as { fieldOverrides: Array<Record<string, unknown>> };
    expect(indexes.fieldOverrides).toContainEqual({ collectionGroup: "erasedChildren", fieldPath: "expireAt", ttl: true, indexes: [] });
  });
});

/* Round 7 (critic r6 P1): account deletion finds children through the
   account's families; it must never erase a child that now belongs to
   another family, and never through the shared placeholder family. */
describe("B-GA-09 round 7 · account deletion never erases another family's child", () => {
  const otherFamilysChild = () => {
    docs.set("children/kid-x", { childId: "kid-x", familyId: "fam-2" });
    docs.set("children/kid-x/memoryEvents/e1", { childId: "kid-x" });
    docs.set("families/fam-2/members/other-parent", { userId: "other-parent" });
    docs.set("families/fam-2/childRefs/kid-x", { childId: "kid-x", familyId: "fam-2" });
    objects.add("children/kid-x/books/synthetic-book/manifest.json");
  };

  it("a last-member family's stale pointer to a child now owned by another family (legacy re-parenting): the child stays (critic r6 probe)", async () => {
    docs.delete(`families/${FAMILY}/members/${MEMBER}`); // OWNER is the last member of FAMILY
    otherFamilysChild();
    docs.set(`families/${FAMILY}/childRefs/kid-x`, { childId: "kid-x", familyId: FAMILY }); // ensureChild left it behind
    const base = await serve();
    const res = await deleteAccount(base);
    expect(res.status).toBe(200);
    expect(docs.has("children/kid-x")).toBe(true);
    expect(docs.has("children/kid-x/memoryEvents/e1")).toBe(true);
    expect([...objects]).toContain("children/kid-x/books/synthetic-book/manifest.json");
    expect(docs.has("families/fam-2/childRefs/kid-x")).toBe(true);
  });

  it("the stale pointer and a stale erase record are removed, content-free, and the receipt counts them", async () => {
    otherFamilysChild();
    docs.set(`families/${FAMILY}/childRefs/kid-x`, { childId: "kid-x", familyId: FAMILY });
    docs.set("erasedChildren/kid-x", { childId: "kid-x", familyId: FAMILY, erasedAt: new Date().toISOString(), expireAt: new Date(Date.now() + 86_400_000) });
    docs.delete(`families/${FAMILY}/members/${MEMBER}`);
    const base = await serve();
    const receipt = await (await deleteAccount(base)).json() as { complete: boolean; classes: Array<{ class: string; note?: string }> };
    expect(receipt.complete).toBe(true);
    expect(receipt.classes.find((c) => c.class === "childData")?.note).toMatch(/2 stale reference\(s\) to another family's child removed/);
    expect(docs.has(`families/${FAMILY}/childRefs/kid-x`)).toBe(false);
    expect(docs.has("erasedChildren/kid-x")).toBe(false);
    expect(docs.has("children/kid-x")).toBe(true);
  });

  it("the shared placeholder family is never swept: its pointers and erase records belong to unrelated accounts", async () => {
    docs.set(`families/default-family/members/${OWNER}`, { userId: OWNER }); // a legacy shared membership, now alone
    docs.set("children/kid-legacy", { childId: "kid-legacy", familyId: "default-family" });
    docs.set("children/kid-legacy/memoryEvents/e1", { childId: "kid-legacy" });
    docs.set("families/default-family/childRefs/kid-legacy", { childId: "kid-legacy", familyId: "default-family" });
    docs.set("erasedChildren/kid-legacy-2", { childId: "kid-legacy-2", familyId: "default-family", erasedAt: new Date().toISOString(), expireAt: new Date(Date.now() + 86_400_000) });
    docs.set("children/kid-legacy-2", { childId: "kid-legacy-2", familyId: "default-family" });
    const base = await serve();
    expect((await deleteAccount(base)).status).toBe(200);
    expect(docs.has("children/kid-legacy")).toBe(true);
    expect(docs.has("children/kid-legacy/memoryEvents/e1")).toBe(true);
    expect(docs.has("children/kid-legacy-2")).toBe(true);
  });

  it("a placeholder-family erase record never lets a stranger re-run the erase route", async () => {
    docs.set("erasedChildren/kid-gone", { childId: "kid-gone", familyId: "default-family", erasedAt: new Date().toISOString(), expireAt: new Date(Date.now() + 86_400_000) });
    docs.set(`families/default-family/members/${STRANGER}`, { userId: STRANGER });
    const base = await serve();
    const res = await fetch(`${base}/api/privacy/erase`, { method: "POST", headers: { "Content-Type": "application/json", "x-test-user": STRANGER }, body: JSON.stringify({ childId: "kid-gone" }) });
    expect(res.status).toBe(403);
  });

  it("a second /account/delete does not 500 (critic r6 probe)", async () => {
    const base = await serve();
    const a = await deleteAccount(base);
    const b = await deleteAccount(base);
    expect([a.status, b.status]).toEqual([200, 200]);
  });
});

/* Round 7 (critic r6 P2 a): with a co-member still in the family it is never
   "last member", and an erase that never reached the server left no record:
   the device's pending ids carry it into account deletion. */
describe("B-GA-09 round 7 · account deletion finishes the erases this device still holds", () => {
  it("an erase that never reached the server (no record, a co-member left): the pending id sent with /account/delete is erased through the same per-child path", async () => {
    // the device half ran; the server never saw the erase
    docs.delete(`users/${OWNER}/children/${CHILD}`);
    await coParentConsult();
    const base = await serve();
    const res = await deleteAccount(base, OWNER, { pendingChildIds: [CHILD] });
    expect(res.status).toBe(200);
    expect((await res.json() as { complete: boolean }).complete).toBe(true);
    expect(left()).toEqual([]);
    expect(await consentStore.list(CHILD)).toEqual([]);
    expect(await consultStore.listByChild("synthetic-co-parent", CHILD)).toEqual([]);
    expect([...objects]).toEqual([]);
    expect(docs.has(`erasedChildren/${CHILD}`)).toBe(false); // the record the erase wrote first went with it
  });

  it("without the pending id the same child is left behind (the gap the device ids close)", async () => {
    docs.delete(`users/${OWNER}/children/${CHILD}`);
    const base = await serve();
    expect((await deleteAccount(base)).status).toBe(200);
    expect(docs.has(`children/${CHILD}`)).toBe(true);
  });

  it("a pending id this account may not erase (another family's child, junk) is ignored", async () => {
    docs.set("children/kid-x", { childId: "kid-x", familyId: "fam-2" });
    docs.set("children/kid-x/memoryEvents/e1", { childId: "kid-x" });
    docs.set("families/fam-2/members/other-parent", { userId: "other-parent" });
    const base = await serve();
    const res = await deleteAccount(base, OWNER, { pendingChildIds: ["kid-x", "../etc", 42, "x".repeat(300)] });
    expect(res.status).toBe(200);
    expect(docs.has("children/kid-x")).toBe(true);
    expect(docs.has("children/kid-x/memoryEvents/e1")).toBe(true);
  });
});

/* Round 8 (B-GA-09 "erase prevents late hydration and resurrection"): a
   request that passed the owner check before the erase appends to the ledger
   afterwards; appendEvent → admitsLedgerAppend → ensureChild used to re-create
   children/{id} for its family. The erase record now refuses it. */
describe("B-GA-09 round 8 · an erased child is never brought back by a late write", () => {
  const event = (childId: string, familyId = FAMILY) => ({
    eventId: `ev-${childId}-${Math.random().toString(36).slice(2)}`, memoryId: `m-${childId}`, familyId, childId,
    eventType: "proposed", status: "pending", fact: "Synthetic fact", source: "rhythm", retention: "90d",
    createdAt: new Date().toISOString(), actor: "parent", prompt: "synthetic", frameRouting: null,
  }) as never;
  const config = () => createTestConfig({ storageBucket: "synthetic-bucket", memoryAdapter: "firestore" });
  const gone = () => [...docs.keys()].filter((p) => p.includes(CHILD) && !p.startsWith("erasedChildren/") && !p.startsWith("users/"));

  it("after the erase, a late append (its owner check passed before the erase) is refused and the child stays gone", async () => {
    const base = await serve();
    expect((await erase(base)).status).toBe(200);
    expect(gone()).toEqual([]);
    const store = new FirestoreMemoryStore(config());
    await expect(store.appendEvent(event(CHILD))).rejects.toThrow(/erased/);
    // the same through the legacy-family path, which admitsLedgerAppend lets through
    await expect(store.appendEvent(event(CHILD, "default-family"))).rejects.toThrow(/erased/);
    expect(gone()).toEqual([]);
  });

  it("the memory route answers 410 and writes nothing, for a request that passed the owner check before the erase", async () => {
    // the owner check already passed (the request began before the erase): ownsChild says yes
    const base = await serve((c) => Object.assign(new FirestoreMemoryStore(c), { ownsChild: async () => true }));
    expect((await erase(base)).status).toBe(200);
    const res = await fetch(`${base}/api/memory/${CHILD}/propose`, { method: "POST", headers: { "Content-Type": "application/json", "x-test-user": OWNER }, body: JSON.stringify({ fact: "Likes the swing in the morning", source: "rhythm" }) });
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ error: "This child's data was erased." });
    expect(gone()).toEqual([]);
  });

  it("an onboarding upsert of the erased id does not re-create it either", async () => {
    const base = await serve();
    await erase(base);
    const store = new FirestoreMemoryStore(config());
    await store.ensureFamilyChild({ familyId: FAMILY, childId: CHILD, userId: OWNER, childProfile: { name: "Synthetic Child" } });
    expect(gone()).toEqual([]);
  });

  it("during a half-finished erase (record written, child doc still there) a late append is refused too", async () => {
    const base = await serve();
    failConsentsOnce();
    expect((await erase(base)).status).toBe(500);
    const before = docs.get(`children/${CHILD}`);
    const store = new FirestoreMemoryStore(config());
    await expect(store.appendEvent(event(CHILD))).rejects.toThrow(/erased/);
    expect(docs.get(`children/${CHILD}`)).toEqual(before);
    expect([...docs.keys()].filter((p) => p.startsWith(`children/${CHILD}/memoryEvents/`))).toHaveLength(2); // only the two it had
  });

  it("a legitimate new child with a fresh id is unaffected, and an expired record no longer blocks", async () => {
    const base = await serve();
    await erase(base);
    const store = new FirestoreMemoryStore(config());
    await store.appendEvent(event("kid-new"));
    expect(docs.get("children/kid-new")).toMatchObject({ childId: "kid-new", familyId: FAMILY });
    expect([...docs.keys()].some((p) => p.startsWith("children/kid-new/memoryEvents/"))).toBe(true);
    const record = docs.get(`erasedChildren/${CHILD}`)!;
    docs.set(`erasedChildren/${CHILD}`, { ...record, expireAt: new Date(Date.now() - 1000) });
    await store.appendEvent(event(CHILD));
    expect(docs.has(`children/${CHILD}`)).toBe(true);
  });
});
