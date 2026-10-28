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
import { LocalConsultStore } from "../server/consultRequests.js";
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
  const grant: ConsentGrant = { id: "c1", childId: CHILD, purpose: "voice_processing", granted: true, policyVersion: "v1", actorUid: OWNER, grantedAt: "2026-10-01T00:00:00.000Z", expiresAt: null, revokedAt: null };
  await consentStore.set(grant);
});

async function serve(): Promise<string> {
  const config = createTestConfig({ storageBucket: "synthetic-bucket", memoryAdapter: "firestore" });
  const entitlementStore = createEntitlementStore(createTestConfig({}));
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as { user?: { uid: string } }).user = { uid: req.header("x-test-user") || OWNER }; next(); });
  app.use("/api", createApiRouter({
    config,
    modelProvider: { generateJson: async () => ({}) } as unknown as ModelProvider,
    memoryStore: new FirestoreMemoryStore(config),
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
    consultStore: new LocalConsultStore(),
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
const deleteAccount = (base: string, user = OWNER) =>
  fetch(`${base}/api/account/delete`, { method: "POST", headers: { "Content-Type": "application/json", "x-test-user": user }, body: JSON.stringify({ confirm: "DELETE" }) });
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

    const res = await deleteAccount(base);
    expect(res.status).toBe(200);
    const receipt = await res.json() as { complete: boolean; classes: Array<{ class: string; note?: string; failed: number }> };
    expect(receipt.classes.filter((c) => c.failed > 0)).toEqual([]);
    expect(receipt.complete).toBe(true);
    expect(receipt.classes.find((c) => c.class === "childData")?.note).toMatch(/1 left by an unfinished erase/);
    expect([...docs.keys()].filter((p) => p.includes(CHILD))).toEqual([]); // the record, ledger, pointer and erase record
    expect(await consentStore.list(CHILD)).toEqual([]);
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
