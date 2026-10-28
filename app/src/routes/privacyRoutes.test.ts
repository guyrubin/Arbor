/**
 * B-GA-09 / B-BOOK-20 — the server half of the child's export and erase,
 * driven through the REAL router with synthetic stores.
 *
 *  - Export (Art. 15/20) carries every server-held category about the child:
 *    the memory ledger, share grants, and (new) the consent records and the
 *    parent's consult requests about this child.
 *  - Erase (Art. 17) removes the same categories, scoped to this owner and
 *    this child, and the receipt counts each one, Storage per prefix.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
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
import { ARBOR_PROFESSIONALS, type Professional } from "../services/professionals.js";

const servers: Server[] = [];
afterAll(async () => {
  await Promise.all(servers.map((s) => new Promise<void>((res) => s.close(() => res()))));
});

const OWNER = "synthetic-owner";
const CHILD = "synthetic-child";
const SIBLING = "synthetic-sibling";

function fixture() {
  const events = new Map<string, unknown[]>([[CHILD, [{ eventId: "e1", childId: CHILD }]], [SIBLING, [{ eventId: "e2", childId: SIBLING }]]]);
  const shares = [
    { id: "s1", ownerUid: OWNER, childId: CHILD },
    { id: "s2", ownerUid: OWNER, childId: SIBLING },
  ];
  const memoryStore = {
    listEvents: async (childId?: string) => events.get(childId ?? "") ?? [],
    appendEvent: async () => undefined,
    eraseChild: async (childId: string) => { const n = events.get(childId)?.length ?? 0; events.delete(childId); return n; },
  };
  const shareStore = {
    listByOwner: async (owner: string, childId?: string) => shares.filter((s) => s.ownerUid === owner && (!childId || s.childId === childId)),
    eraseByChild: async (owner: string, childId: string) => {
      const before = shares.length;
      for (let i = shares.length - 1; i >= 0; i--) if (shares[i].ownerUid === owner && shares[i].childId === childId) shares.splice(i, 1);
      return before - shares.length;
    },
  };
  const consentStore = new LocalConsentStore();
  const grant = (id: string, childId: string): ConsentGrant => ({ id, childId, purpose: "voice_processing", granted: true, policyVersion: "v1", actorUid: OWNER, grantedAt: "2026-10-01T00:00:00.000Z", expiresAt: null, revokedAt: null });
  const consultStore = new LocalConsultStore();
  return { events, shares, memoryStore, shareStore, consentStore, grant, consultStore };
}

async function serve(f: ReturnType<typeof fixture> & { memoryStore: Record<string, unknown> }): Promise<string> {
  const config = createTestConfig({});
  const entitlementStore = createEntitlementStore(config);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as { user?: { uid: string } }).user = { uid: req.header("x-test-user") || OWNER }; next(); });
  app.use("/api", createApiRouter({
    config,
    modelProvider: { generateJson: async () => ({}) } as unknown as ModelProvider,
    memoryStore: f.memoryStore as never,
    shareStore: f.shareStore as never,
    consentStore: f.consentStore,
    framework: loadFramework(),
    entitlementStore,
    referralStore: createReferralStore(config, entitlementStore),
    counters: createCounterStore(config),
    consultStore: f.consultStore,
    adminMetrics: createAdminMetricsStore(config),
    waitlistStore: createWaitlistStore(config),
  }));
  const server = await new Promise<Server>((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe("B-GA-09 · server export and erase cover every server-held category about the child", () => {
  it("export carries the ledger, shares, consents and consult requests of THIS child only", async () => {
    const f = fixture();
    await f.consentStore.set(f.grant("c1", CHILD));
    await f.consentStore.set(f.grant("c2", SIBLING));
    await f.consultStore.create(buildConsultRequest({ ownerUid: OWNER, ownerEmail: null, childId: CHILD, professionalId: "p", professionalName: "Synthetic SLP", note: "synthetic note" }));
    await f.consultStore.create(buildConsultRequest({ ownerUid: OWNER, ownerEmail: null, childId: SIBLING, professionalId: "p", professionalName: "Synthetic SLP" }));
    await f.consultStore.create(buildConsultRequest({ ownerUid: "someone-else", ownerEmail: null, childId: CHILD, professionalId: "p", professionalName: "Synthetic SLP" }));
    const base = await serve(f);
    const res = await fetch(`${base}/api/privacy/export/${CHILD}`);
    expect(res.status).toBe(200);
    const body = await res.json() as { serverData: Record<string, Array<Record<string, unknown>>> };
    expect(Object.keys(body.serverData).sort()).toEqual(["consents", "consultRequests", "memoryEvents", "shares"]);
    expect(body.serverData.memoryEvents.map((e) => e.eventId)).toEqual(["e1"]);
    expect(body.serverData.shares.map((s) => s.id)).toEqual(["s1"]);
    expect(body.serverData.consents.map((c) => c.id)).toEqual(["c1"]);
    expect(body.serverData.consultRequests).toHaveLength(1);
    expect(body.serverData.consultRequests[0]).toMatchObject({ ownerUid: OWNER, childId: CHILD, note: "synthetic note" });
  });

  it("erase removes each category for this owner and child, counts each, and leaves the sibling", async () => {
    const f = fixture();
    await f.consentStore.set(f.grant("c1", CHILD));
    await f.consentStore.set(f.grant("c2", SIBLING));
    await f.consultStore.create(buildConsultRequest({ ownerUid: OWNER, ownerEmail: null, childId: CHILD, professionalId: "p", professionalName: "Synthetic SLP" }));
    await f.consultStore.create(buildConsultRequest({ ownerUid: OWNER, ownerEmail: null, childId: SIBLING, professionalId: "p", professionalName: "Synthetic SLP" }));
    // A co-parent's request about the same child goes too (critic r1).
    await f.consultStore.create(buildConsultRequest({ ownerUid: "synthetic-co-parent", ownerEmail: null, childId: CHILD, professionalId: "p", professionalName: "Synthetic SLP" }));
    const base = await serve(f);
    const res = await fetch(`${base}/api/privacy/erase`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ childId: CHILD }) });
    expect(res.status).toBe(200);
    const body = await res.json() as { erased: Record<string, number>; storage: Record<string, number>; storageNote?: string };
    expect(body.erased).toEqual({ memoryEvents: 1, shares: 1, consents: 1, consultRequests: 2, storageFiles: 0 });
    // No bucket in the test config: each registered prefix is still named.
    expect(body.storage).toEqual({ photos: 0, books: 0 });
    expect(body.storageNote).toMatch(/no storage bucket/);
    expect(await f.consentStore.list(CHILD)).toEqual([]);
    expect(await f.consultStore.listByChild(OWNER, CHILD)).toEqual([]);
    expect(await f.consultStore.listByChild("synthetic-co-parent", CHILD)).toEqual([]);
    expect(f.events.has(CHILD)).toBe(false);
    // The sibling's records stay.
    expect(await f.consentStore.list(SIBLING)).toHaveLength(1);
    expect(await f.consultStore.listByChild(OWNER, SIBLING)).toHaveLength(1);
    expect(f.events.get(SIBLING)).toHaveLength(1);
    expect(f.shares.map((s) => s.id)).toEqual(["s2"]);
  });

  it("a second erase is idempotent: every count is zero", async () => {
    const f = fixture();
    const base = await serve(f);
    const post = () => fetch(`${base}/api/privacy/erase`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ childId: CHILD }) });
    await post();
    const again = await (await post()).json() as { erased: Record<string, number> };
    expect(again.erased).toEqual({ memoryEvents: 0, shares: 0, consents: 0, consultRequests: 0, storageFiles: 0 });
  });
});

/* B-GA-09 follow-up — a consult request names a child and carries a parent's
   note about them: only the family that owns the child may open one, through
   the same requireChildOwnership check the other child routes use. The live
   directory is empty (no unverified provider is ever shown), so the test adds
   one synthetic professional for its own run. */
describe("B-GA-09 · a consult request can only be opened for a child the caller's family owns", () => {
  const PRO: Professional = { id: "synthetic-pro", name: "Synthetic SLP", role: "Speech therapist", creds: "", langs: "en", city: "", mode: "video", ages: "", approach: "", handles: "", price: "", rating: 0, verified: false, tone: "" };
  beforeAll(() => { ARBOR_PROFESSIONALS.push(PRO); });
  afterAll(() => { ARBOR_PROFESSIONALS.splice(ARBOR_PROFESSIONALS.indexOf(PRO), 1); });
  const FAMILY: Record<string, string[]> = { [CHILD]: [OWNER, "synthetic-family-member"] };
  const owned = () => {
    const f = fixture();
    return { ...f, memoryStore: { ...f.memoryStore, ownsChild: async (uid: string, childId: string) => (FAMILY[childId] ?? []).includes(uid) } };
  };
  const open = (base: string, user: string, body: Record<string, unknown>) =>
    fetch(`${base}/api/consult-requests`, { method: "POST", headers: { "Content-Type": "application/json", "x-test-user": user }, body: JSON.stringify(body) });
  const ask = { professionalId: PRO.id, note: "synthetic note" };

  it("the owner and a member of the owning family may; a stranger gets 403 and nothing is stored", async () => {
    const f = owned();
    const base = await serve(f);
    expect((await open(base, OWNER, { ...ask, childId: CHILD })).status).toBe(200);
    expect((await open(base, "synthetic-family-member", { ...ask, childId: CHILD })).status).toBe(200);
    const stranger = await open(base, "synthetic-stranger", { ...ask, childId: CHILD });
    expect(stranger.status).toBe(403);
    expect(await stranger.json()).toEqual({ error: "Not authorized for this child." });
    expect(await f.consultStore.listByOwner("synthetic-stranger")).toEqual([]);
    expect(await f.consultStore.listByChild(OWNER, CHILD)).toHaveLength(1);
  });

  it("a co-parent through a share grant (not a family member) is refused: grants scope activities and moments, not consult requests", async () => {
    const base = await serve(owned());
    expect((await open(base, "synthetic-grant-co-parent", { ...ask, childId: CHILD })).status).toBe(403);
  });

  it("a request about no child is not a child route: it still opens", async () => {
    const base = await serve(owned());
    expect((await open(base, "synthetic-stranger", ask)).status).toBe(200);
  });

  it("the route carries the owner check (the middleware the other child routes use)", async () => {
    const { readFileSync } = await import("node:fs");
    const api = readFileSync(new URL("./api.ts", import.meta.url), "utf8");
    expect(api).toMatch(/router\.post\("\/consult-requests", requireOwnership, async/);
  });
});
