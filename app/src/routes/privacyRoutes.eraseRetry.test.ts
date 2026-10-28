/**
 * B-GA-09 round 5 (critic r4 P1-1) — a production retry of the child's erase
 * passes the owner check. The child doc is the ownership anchor
 * (FamilyService.ownsChild reads its familyId), and the erase used to delete
 * it FIRST: when shares, consents, consults or Storage then failed, or the
 * response was lost, every retry got a 403 and the server data stayed.
 *
 * Driven through the REAL router and the REAL FirestoreMemoryStore /
 * FamilyService on a path-keyed fake of the Admin SDK, with a Storage bucket
 * whose delete fails once. Synthetic ids only.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

const docs = vi.hoisted(() => new Map<string, Record<string, unknown>>());
const objects = vi.hoisted(() => new Set<string>());
const storageFailures = vi.hoisted(() => ({ left: 0 }));

vi.mock("firebase-admin/app", () => ({ getApps: () => [{}], initializeApp: vi.fn(), applicationDefault: vi.fn() }));
vi.mock("firebase-admin/firestore", () => {
  const ref = (path: string): Record<string, unknown> => ({
    path,
    id: path.split("/").at(-1),
    get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }),
    set: async (data: Record<string, unknown>) => { docs.set(path, { ...data }); },
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
  docs.set(`children/${CHILD}`, { childId: CHILD, familyId: FAMILY });
  docs.set(`children/${CHILD}/memoryEvents/e1`, { childId: CHILD });
  docs.set(`children/${CHILD}/memoryEvents/e2`, { childId: CHILD });
  docs.set(`families/${FAMILY}/childRefs/${CHILD}`, { childId: CHILD, familyId: FAMILY });
  docs.set(`families/${FAMILY}/members/${OWNER}`, { userId: OWNER });
  docs.set(`families/${FAMILY}/members/${MEMBER}`, { userId: MEMBER });
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
  }));
  const server = await new Promise<Server>((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const erase = (base: string, user = OWNER) =>
  fetch(`${base}/api/privacy/erase`, { method: "POST", headers: { "Content-Type": "application/json", "x-test-user": user }, body: JSON.stringify({ childId: CHILD }) });
const left = () => [...docs.keys()].filter((p) => p.includes(CHILD) && !p.startsWith("erasedChildren/"));

describe("B-GA-09 · a retried erase still passes the owner check", () => {
  it("Storage fails once: the anchor survives the failure, the retry passes the owner check and finishes", async () => {
    const base = await serve();
    storageFailures.left = 1;
    const first = await erase(base);
    expect(first.status).toBe(500);
    // the owner check's anchor is still there, with the ledger it guards
    expect(docs.get(`children/${CHILD}`)).toMatchObject({ familyId: FAMILY });
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
