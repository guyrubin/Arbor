/**
 * OWN-1 / F-05 (E6) — server child-ownership provisioning, end-to-end against
 * the REAL route handlers + the REAL FamilyService (backed by an in-memory
 * Firestore mock that implements exactly the surface FamilyService uses:
 * collectionGroup("members").where("userId")… — the query the
 * firestore.indexes.json members.userId COLLECTION_GROUP fieldOverride serves).
 *
 * Pins:
 *  1. A fresh authenticated uid 403s on GET /api/memory/:childId until
 *     POST /api/onboarding/family-child provisions the ownership docs — then
 *     the same read is 200 (through requireChildOwnership, never around it).
 *  2. Client-supplied familyId/userId on the onboarding route are IGNORED
 *     entirely (the IDOR: a caller could graft a child into an arbitrary
 *     family). Identity comes from req.user only.
 *  3. The 'default-family' backfill: a child doc stamped with the legacy
 *     'default-family' id is re-parented by onboarding (ensureChild merge
 *     OVERWRITES familyId) and its existing ledger events survive.
 *  4. Memory appends (/memory/:childId/propose) derive familyId from the uid,
 *     never from the request body.
 *  5. PATCH /memory/:memoryId resolves memoryId→childId from the ledger and
 *     enforces ownership (owner 200, non-owner 403, unknown 404).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import { createApiRouter } from "./api.js";
import { createTestConfig } from "../testConfig.js";
import type { ArborConfig } from "../config/env.js";
import { loadFramework } from "../services/framework.js";
import { FamilyService } from "../families/familyService.js";
import type { MemoryLedgerEvent, MemoryStore } from "../memory/types.js";
import { LocalShareStore } from "../sharing/shares.js";
import { LocalConsentStore } from "../sharing/consent.js";
import { createCounterStore } from "../server/quotaStore.js";
import { createEntitlementStore } from "../server/entitlements.js";
import { createReferralStore } from "../server/referral.js";
import { createConsultStore } from "../server/consultRequests.js";
import { createAdminMetricsStore } from "../server/adminMetrics.js";
import { createWaitlistStore } from "../server/waitlist.js";
import type { ModelProvider } from "../ai/modelRouter.js";

// ── In-memory Firestore mock (exactly the FamilyService surface) ─────────────

class MockDoc {
  constructor(private readonly db: MockDb, readonly pathSegs: string[]) {}
  get id() { return this.pathSegs[this.pathSegs.length - 1]; }
  get path() { return this.pathSegs.join("/"); }
  /** DocumentReference.parent is a CollectionReference (whose .parent is the owning doc). */
  get parent() { return new MockCollection(this.db, this.pathSegs.slice(0, -1)); }
  collection(name: string) { return new MockCollection(this.db, [...this.pathSegs, name]); }
  async get() {
    const data = this.db.docs.get(this.path);
    return { exists: data !== undefined, data: () => data };
  }
  set(data: Record<string, unknown>, opts?: { merge?: boolean }) {
    const prev = this.db.docs.get(this.path);
    this.db.docs.set(this.path, opts?.merge && prev ? { ...prev, ...data } : { ...data });
  }
}

class MockCollection {
  constructor(private readonly db: MockDb, readonly pathSegs: string[]) {}
  get id() { return this.pathSegs[this.pathSegs.length - 1]; }
  get parent() { return this.pathSegs.length > 1 ? new MockDoc(this.db, this.pathSegs.slice(0, -1)) : null; }
  doc(id: string) { return new MockDoc(this.db, [...this.pathSegs, id]); }
}

class MockDb {
  readonly docs = new Map<string, Record<string, unknown>>();
  collection(name: string) { return new MockCollection(this, [name]); }
  collectionGroup(name: string) {
    const db = this;
    const makeQuery = (field?: string, value?: unknown, max?: number) => ({
      where: (f: string, _op: string, v: unknown) => makeQuery(f, v, max),
      limit: (n: number) => makeQuery(field, value, n),
      async get() {
        let matches = [...db.docs.entries()].filter(([p]) => {
          const segs = p.split("/");
          return segs.length >= 2 && segs[segs.length - 2] === name;
        });
        if (field !== undefined) matches = matches.filter(([, d]) => d[field] === value);
        if (max !== undefined) matches = matches.slice(0, max);
        return { docs: matches.map(([p]) => ({ ref: new MockDoc(db, p.split("/")) })) };
      },
    });
    return makeQuery();
  }
  async runTransaction<T>(fn: (t: unknown) => Promise<T>): Promise<T> {
    return fn({ set: (ref: MockDoc, data: Record<string, unknown>, opts?: { merge?: boolean }) => ref.set(data, opts) });
  }
}

/** Test twin of FirestoreMemoryStore: the REAL FamilyService over the mock db,
 *  with an in-memory ledger (appendEvent runs the same ensureChild write). */
class TestOwnershipMemoryStore implements MemoryStore {
  readonly db = new MockDb();
  readonly families = new FamilyService(this.db as unknown as FirebaseFirestore.Firestore);
  private events: MemoryLedgerEvent[] = [];

  async listEvents(childId?: string) {
    return childId ? this.events.filter((e) => e.childId === childId) : [...this.events];
  }
  async appendEvent(event: MemoryLedgerEvent) {
    await this.families.ensureChild(event.familyId, event.childId);
    this.events.push(event);
  }
  ensureFamilyForUser(uid: string) {
    return this.families.ensureFamilyForUser(uid);
  }
  async ensureFamilyChild(input: { familyId: string; childId: string; userId: string; childProfile?: Record<string, unknown> }) {
    await this.families.ensureFamilyMembership(input.familyId, input.userId);
    await this.families.ensureChild(input.familyId, input.childId, input.childProfile);
  }
  ownsChild(uid: string, childId: string) {
    return this.families.ownsChild(uid, childId);
  }
  async eraseChild(childId: string) {
    const before = this.events.length;
    this.events = this.events.filter((e) => e.childId !== childId);
    this.db.docs.delete(`children/${childId}`);
    return before - this.events.length;
  }
  childDoc(childId: string) {
    return this.db.docs.get(`children/${childId}`);
  }
  lastEvent() {
    return this.events[this.events.length - 1];
  }
}

// ── Harness (liveTurn.test.ts pattern) ───────────────────────────────────────

const stubModelProvider = {
  async *streamText() { yield ""; },
  generateJson: async () => ({}),
  async *generateJsonStream() { yield "{}"; },
} as unknown as ModelProvider;

const framework = loadFramework();

function buildApp(config: ArborConfig, memoryStore: MemoryStore, uid: string) {
  const entitlementStore = createEntitlementStore(config);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).user = { uid }; next(); });
  app.use(
    "/api",
    createApiRouter({
      config,
      modelProvider: stubModelProvider,
      memoryStore,
      shareStore: new LocalShareStore(),
      consentStore: new LocalConsentStore(),
      framework,
      entitlementStore,
      referralStore: createReferralStore(config, entitlementStore),
      counters: createCounterStore(config),
      consultStore: createConsultStore(config),
      adminMetrics: createAdminMetricsStore(config),
      waitlistStore: createWaitlistStore(config),
    }),
  );
  return app;
}

async function listen(app: express.Express): Promise<{ server: Server; baseUrl: string }> {
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  return { server, baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

const store = new TestOwnershipMemoryStore();
const servers: Server[] = [];
let owner = ""; // authenticated as uid "parent-1"
let attacker = ""; // authenticated as uid "attacker-1" — SAME store
let ownerFamilyId = "";

beforeAll(async () => {
  const config = createTestConfig();
  const a = await listen(buildApp(config, store, "parent-1"));
  const b = await listen(buildApp(config, store, "attacker-1"));
  servers.push(a.server, b.server);
  owner = a.baseUrl;
  attacker = b.baseUrl;
});

afterAll(async () => {
  await Promise.all(
    servers.map((s) => new Promise<void>((resolve, reject) => s.close((e) => (e ? reject(e) : resolve())))),
  );
});

const getJson = async (base: string, path: string) => {
  const res = await fetch(`${base}${path}`);
  return { status: res.status, body: (await res.json()) as Record<string, any> };
};
const postJson = async (base: string, path: string, body: unknown, method = "POST") => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, any> };
};

describe("OWN-1 — onboarding provisions the docs requireChildOwnership authorizes against", () => {
  it("a fresh authenticated uid 403s on the memory review read BEFORE provisioning (fail closed)", async () => {
    const { status } = await getJson(owner, "/api/memory/kid-1");
    expect(status).toBe(403);
  });

  it("POST /api/onboarding/family-child bootstraps family+membership+child from the uid, then the read is 200", async () => {
    const onboard = await postJson(owner, "/api/onboarding/family-child", {
      childId: "kid-1",
      childProfile: { name: "Kid One", age: 4 },
    });
    expect(onboard.status).toBe(200);
    expect(onboard.body.adapter).toBe("firestore");
    expect(onboard.body.userId).toBe("parent-1");
    ownerFamilyId = onboard.body.familyId;
    expect(ownerFamilyId).toBeTruthy();
    expect(ownerFamilyId).not.toBe("default-family");

    const read = await getJson(owner, "/api/memory/kid-1");
    expect(read.status).toBe(200);
    expect(Array.isArray(read.body.items)).toBe(true);
  });

  it("is idempotent: re-running onboarding resolves the SAME uid-derived family", async () => {
    const again = await postJson(owner, "/api/onboarding/family-child", { childId: "kid-1" });
    expect(again.status).toBe(200);
    expect(again.body.familyId).toBe(ownerFamilyId);
  });

  it("400s without a childId", async () => {
    const { status } = await postJson(owner, "/api/onboarding/family-child", { childProfile: { name: "X" } });
    expect(status).toBe(400);
  });
});

describe("OWN-1 — client-supplied familyId/userId are IGNORED (IDOR closed)", () => {
  it("a caller cannot graft a child into an arbitrary family or enrol another uid", async () => {
    const res = await postJson(owner, "/api/onboarding/family-child", {
      childId: "kid-2",
      familyId: "attacker-family",
      userId: "attacker-1",
      childProfile: { name: "Kid Two" },
    });
    expect(res.status).toBe(200);
    // The server derived the family from req.user, not the body.
    expect(res.body.familyId).toBe(ownerFamilyId);
    expect(res.body.userId).toBe("parent-1");
    // Nothing was written under the attacker-chosen ids.
    expect(store.db.docs.has("families/attacker-family/members/attacker-1")).toBe(false);
    expect(store.db.docs.has("families/attacker-family/members/parent-1")).toBe(false);
    // The child belongs to the owner's family; the attacker still 403s.
    expect((await getJson(owner, "/api/memory/kid-2")).status).toBe(200);
    expect((await getJson(attacker, "/api/memory/kid-2")).status).toBe(403);
  });
});

describe("OWN-1 — 'default-family' backfill (existing accounts)", () => {
  it("onboarding re-parents a child stamped 'default-family' and its ledger events survive", async () => {
    // A pre-fix account: the memory append path stamped 'default-family'.
    await store.appendEvent({
      eventId: "evt-legacy-1",
      memoryId: "mem-legacy-1",
      familyId: "default-family",
      childId: "kid-3",
      eventType: "proposed",
      status: "pending",
      fact: "Sleeps better after a bath",
      source: "conversation",
      retention: "3 months",
      createdAt: new Date().toISOString(),
      actor: "system",
    });
    expect(store.childDoc("kid-3")?.familyId).toBe("default-family");
    // Unowned → the review read fails closed.
    expect((await getJson(owner, "/api/memory/kid-3")).status).toBe(403);

    // The client-side backfill call (idempotent onboarding) re-parents it.
    const res = await postJson(owner, "/api/onboarding/family-child", { childId: "kid-3" });
    expect(res.status).toBe(200);
    expect(store.childDoc("kid-3")?.familyId).toBe(ownerFamilyId);

    // ownsChild flipped true; the ledger folds by childId, so events survive.
    const read = await getJson(owner, "/api/memory/kid-3");
    expect(read.status).toBe(200);
    expect(read.body.items.map((i: any) => i.memoryId)).toContain("mem-legacy-1");
  });
});

describe("OWN-1 — memory appends derive familyId from the uid, never the body", () => {
  it("POST /memory/:childId/propose stamps the uid-derived familyId over a client-supplied one", async () => {
    const res = await postJson(owner, "/api/memory/kid-1/propose", {
      fact: "Loves the red truck",
      familyId: "attacker-family",
    });
    expect(res.status).toBe(200);
    expect(store.lastEvent().familyId).toBe(ownerFamilyId);
    expect(store.lastEvent().familyId).not.toBe("attacker-family");
  });
});

describe("OWN-1 — PATCH /memory/:memoryId enforces ownership via the ledger", () => {
  it("a non-owner 403s, the owner transitions, an unknown memoryId 404s", async () => {
    const items = (await getJson(owner, "/api/memory/kid-1")).body.items as { memoryId: string }[];
    expect(items.length).toBeGreaterThan(0);
    const memoryId = items[0].memoryId;

    const denied = await postJson(attacker, `/api/memory/${memoryId}`, { status: "approved" }, "PATCH");
    expect(denied.status).toBe(403);

    const approved = await postJson(owner, `/api/memory/${memoryId}`, { status: "approved" }, "PATCH");
    expect(approved.status).toBe(200);
    expect(approved.body.item?.status).toBe("approved");

    const missing = await postJson(owner, "/api/memory/no-such-memory", { status: "approved" }, "PATCH");
    expect(missing.status).toBe(404);
  });
});
