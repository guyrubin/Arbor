import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createCoParentRouter, coParentAuthorized, coParentPractices, FirestoreCoParentSource, type CoParentSource } from "./coParent.js";
import { buildGrant, LocalShareStore, type ShareGrant } from "../sharing/shares.js";
import { createTestConfig } from "../testConfig.js";
import { resolveSharedPacket } from "./sharedPacket.js";
import { PRACTICES } from "../content/practices.js";

const firestore = vi.hoisted(() => ({ rows: new Map<string, Record<string, unknown>>(), writes: [] as string[] }));
vi.mock("firebase-admin/app", () => ({ getApps: () => [{}], initializeApp: vi.fn(), applicationDefault: vi.fn() }));
vi.mock("firebase-admin/firestore", () => {
  const snapshot = (path: string) => ({ id: path.split("/").at(-1), exists: firestore.rows.has(path), data: () => firestore.rows.get(path) });
  const collection = (path: string, field = "timestamp", max = 20): any => ({ doc: (id: string) => ref(`${path}/${id}`), orderBy: (key: string) => collection(path, key, max), limit: (count: number) => collection(path, field, count), get: async () => ({ docs: [...firestore.rows.keys()].filter((key) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes("/")).map(snapshot).sort((a, b) => String(b.data()?.[field]).localeCompare(String(a.data()?.[field]))).slice(0, max) }) });
  const ref = (path: string): any => ({ path, id: path.split("/").at(-1), get: async () => snapshot(path), collection: (name: string) => collection(`${path}/${name}`) });
  return { getFirestore: () => ({ doc: ref, runTransaction: async (fn: any) => fn({
    get: async (r: { path: string }) => ({ exists: firestore.rows.has(r.path), data: () => firestore.rows.get(r.path) }),
    create: (r: { path: string }, row: Record<string, unknown>) => { firestore.writes.push(r.path); firestore.rows.set(r.path, row); },
    update: (r: { path: string }, patch: Record<string, unknown>) => { firestore.writes.push(r.path); firestore.rows.set(r.path, { ...firestore.rows.get(r.path), ...patch }); },
  }) }) };
});

const owner = { uid: "owner", email: "owner@example.test", emailVerified: true };
const recipient = { uid: "recipient", email: "parent@example.test", emailVerified: true };
const store = new LocalShareStore();
let writes: { ownerUid: string; childId: string; text?: string; uid: string; activityId?: string }[] = [];
const source: CoParentSource = {
  childExists: async (uid, childId) => uid === "owner" && childId === "child-one",
  activities: async (uid, childId) => uid === "owner" && childId === "child-one" ? { activity: null, choices: [] } : null,
  chooseActivity: async (uid, childId, practiceId) => {
    if (uid !== "owner" || childId !== "child-one") throw new Error("access_ended");
    writes.push({ ownerUid: uid, childId, uid, activityId: practiceId });
  },
  completeOwnedActivity: async (uid, childId, activityId) => {
    if (uid !== "owner" || childId !== "child-one") throw new Error("access_ended");
    writes.push({ ownerUid: uid, childId, uid, activityId });
  },
  load: async (g) => ({ childId: g.childId, childName: "Invented child", ownerEmail: g.ownerEmail, activity: { id: "today.child-one.2026-10-08", text: "Take turns building a tower", acceptedAt: new Date().toISOString(), completedAt: null }, moments: [] }),
  addMoment: async (g, actor, text) => {
    if (!coParentAuthorized((await store.get(g.id))!, actor)) throw new Error("access_ended");
    writes.push({ ownerUid: g.ownerUid, childId: g.childId, uid: actor.uid, text });
  },
  completeActivity: async (g, actor, activityId) => {
    if (!coParentAuthorized((await store.get(g.id))!, actor)) throw new Error("access_ended");
    writes.push({ ownerUid: g.ownerUid, childId: g.childId, uid: actor.uid, activityId });
  },
};
let server: Server;
let base = "";
beforeAll(async () => {
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => {
    if (req.header("x-uid")) (req as any).user = { uid: req.header("x-uid"), email: req.header("x-email"), emailVerified: req.header("x-verified") === "true" };
    next();
  });
  app.use("/api", createCoParentRouter({ config: createTestConfig(), shareStore: store, source, requireOwnership: (req, res, next) => { if ((req as any).user?.uid !== "owner") { res.status(403).end(); return; } next(); } }));
  await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/co-parent`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve())); });
const call = (path: string, actor = recipient, body?: unknown) => fetch(`${base}/${path}`, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", "x-uid": actor.uid, "x-email": actor.email, "x-verified": String(actor.emailVerified) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const invite = () => call("invitations", owner, { childId: "child-one", childName: "Invented child", recipientEmail: " PARENT@example.test " });

describe("free co-parent joins the existing child", () => {
  let grant: ShareGrant;
  it("only the real owner chooses an activity; reading and previewing create no row", async () => {
    writes = [];
    expect((await call("children/child-one/activity?language=he", owner)).status).toBe(200);
    expect(writes).toEqual([]);
    const body = { practiceId: "pr-cdc-36m-1", requestId: "chosen-1", language: "he", ownerUid: "attacker" };
    expect((await call("children/child-one/activity", recipient, body)).status).toBe(403);
    expect((await call("children/not-owned/activity", owner, body)).status).toBe(403);
    expect((await call("children/child-one/activity", owner, body)).status).toBe(200);
    expect(writes).toEqual([{ ownerUid: "owner", childId: "child-one", uid: "owner", activityId: "pr-cdc-36m-1" }]);
    expect((await call("children/child-one/activity/complete", recipient, { activityId: "chosen-1" })).status).toBe(403);
  });
  it("creates a free explicit invitation, scoped to the owner's real child", async () => {
    const response = await invite(); expect(response.status).toBe(200);
    grant = await response.json() as ShareGrant;
    expect(grant).toMatchObject({ ownerUid: "owner", childId: "child-one", recipientEmail: "parent@example.test", accessMode: "family_workspace", role: "co_parent" });
    expect(grant.recipientUid).toBeUndefined();
    expect((await (await invite()).json() as ShareGrant).id).toBe(grant.id);
    expect((await call("invitations", recipient, { childId: "child-one", recipientEmail: "third@example.test" })).status).toBe(403);
    expect((await call("invitations", owner, { childId: "not-owned", recipientEmail: "third@example.test" })).status).toBe(403);
    expect((await call("invitations", owner, { childId: "child-one", recipientEmail: owner.email })).status).toBe(400);
  });
  it("the link is not bearer authorization; verified invited identity + acceptance are required", async () => {
    expect((await call(`${grant.id}/workspace`)).status).toBe(403);
    expect((await call(`${grant.id}/accept`, { ...recipient, emailVerified: false }, {})).status).toBe(403);
    expect((await call(`${grant.id}/accept`, { ...recipient, email: "attacker@example.test" }, {})).status).toBe(403);
    expect((await fetch(`${base}/${grant.id}/workspace`)).status).toBe(401);
    expect((await call(`${grant.id}/accept`, recipient, { uid: "attacker", childId: "other-child" })).status).toBe(200);
    expect((await store.get(grant.id))?.recipientUid).toBe(recipient.uid);
    expect((await call(`${grant.id}/accept`, { ...recipient, uid: "email-reassigned-user" }, {})).status).toBe(403);
    const response = await call(`${grant.id}/workspace`);
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ childId: "child-one" });
  });
  it("writes the invited parent's note and completion to the ORIGINAL child, ignoring injected ownership", async () => {
    writes = [];
    expect((await call(`${grant.id}/workspace/moments`, recipient, { text: "We built a tower together", requestId: "retry-safe-123", ownerUid: "attacker", childId: "other-child" })).status).toBe(200);
    expect((await call(`${grant.id}/workspace/complete`, recipient, { activityId: "today.child-one.2026-10-08", ownerUid: "attacker" })).status).toBe(200);
    expect(writes).toEqual([
      { ownerUid: "owner", childId: "child-one", uid: "recipient", text: "We built a tower together" },
      { ownerUid: "owner", childId: "child-one", uid: "recipient", activityId: "today.child-one.2026-10-08" },
    ]);
    expect((await call(`${grant.id}/workspace/moments`, recipient, { text: " ", requestId: "n1" })).status).toBe(400);
    expect((await call(`${grant.id}/workspace/complete`, recipient, { activityId: "../../other-child" })).status).toBe(400);
  });
  it("revocation immediately blocks reads, new notes, and activity completion", async () => {
    await store.revoke(grant.id, owner.uid); const before = writes.length;
    expect((await call(`${grant.id}/workspace`)).status).toBe(403);
    expect((await call(`${grant.id}/workspace/moments`, recipient, { text: "Denied", requestId: "n2" })).status).toBe(403);
    expect((await call(`${grant.id}/workspace/complete`, recipient, { activityId: "a1" })).status).toBe(403);
    expect(writes).toHaveLength(before);
  });
  it("legacy read-only co-parent grants and expired invitations never gain write access", async () => {
    const legacy = await store.create(buildGrant({ ownerUid: "owner", ownerEmail: owner.email, childId: "child-one", role: "co_parent", recipientEmail: recipient.email }));
    expect((await call(`${legacy.id}/accept`, recipient, {})).status).toBe(403);
    const expired = await store.create({ ...legacy, id: "expired-invite", accessMode: "family_workspace", expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect((await call(`${expired.id}/accept`, recipient, {})).status).toBe(403);
  });
});

describe("production Firestore write boundary", () => {
  const source = new FirestoreCoParentSource(createTestConfig());
  const accepted = (): ShareGrant => ({ ...buildGrant({ ownerUid: "owner", ownerEmail: owner.email, childId: "child-one", role: "co_parent", recipientEmail: recipient.email, accessMode: "family_workspace" }), recipientUid: recipient.uid, acceptedAt: new Date().toISOString() });
  const seed = (grant: ShareGrant) => {
    firestore.rows.clear(); firestore.writes.length = 0;
    firestore.rows.set(`shares/${grant.id}`, grant as unknown as Record<string, unknown>);
    firestore.rows.set("users/owner/children/child-one", { name: "Invented child", age: 3, ageMonths: 36, ageMonthsAsOf: new Date().toISOString().slice(0, 10), coParentActivityId: "action-one" });
    firestore.rows.set("users/owner/children/child-one/actionLoops/action-one", { recommendation: "Take turns", status: "accepted", source: "practice", sharedWithCoParent: true, selectedByUid: owner.uid });
  };
  it("shares the exact explicit authored choice before completion in the same child tree, never arbitrary newer history", async () => {
    const grant = accepted(); seed(grant);
    const old = firestore.rows.get("users/owner/children/child-one/actionLoops/action-one");
    const options = await source.activities(owner.uid, "child-one", "he");
    expect(options!.choices.length).toBeGreaterThan(0);
    expect(firestore.writes).toEqual([]);
    const choice = options!.choices[0];
    await source.chooseActivity(owner.uid, "child-one", choice.id, "choice-1", "he");
    const id = "co-parent-practice-choice-1";
    expect(firestore.rows.get("users/owner/children/child-one")?.coParentActivityId).toBe(id);
    expect(firestore.rows.get(`users/owner/children/child-one/actionLoops/${id}`)).toMatchObject({ id, status: "accepted", source: "practice", selectedByUid: owner.uid, practiceId: choice.id, practiceDo: choice.do, practiceSay: choice.say, sharedWithCoParent: true });
    expect(firestore.rows.get("users/owner/children/child-one/actionLoops/action-one")).toEqual(old);
    firestore.rows.set("users/owner/children/child-one/actionLoops/unrelated-newest", { recommendation: "Must not surface", acceptedAt: "2099-01-01", status: "completed" });
    expect((await source.load(grant, recipient.uid))?.activity).toMatchObject({ id, do: choice.do, say: choice.say, completedAt: null, selectedByUid: owner.uid });
    await expect(source.completeActivity(grant, recipient, "action-one")).rejects.toThrow("activity_changed");
    await expect(source.completeActivity(grant, recipient, "unrelated-newest")).rejects.toThrow("activity_changed");
    await source.completeActivity(grant, recipient, id);
    expect((await source.activities(owner.uid, "child-one", "he"))?.activity?.completedAt).toBeTruthy();
    expect((await source.load(grant, recipient.uid))?.activity?.completedAt).toBeTruthy();
  });
  it("retries never reopen a completed activity or move the shared pointer back from a later choice", async () => {
    const grant = accepted(); seed(grant);
    const choices = (await source.activities(owner.uid, "child-one", "en"))!.choices;
    await source.chooseActivity(owner.uid, "child-one", choices[0].id, "first", "en");
    await source.completeOwnedActivity(owner.uid, "child-one", "co-parent-practice-first");
    const first = { ...firestore.rows.get("users/owner/children/child-one/actionLoops/co-parent-practice-first") };
    await source.chooseActivity(owner.uid, "child-one", choices[1].id, "second", "en");
    const before = firestore.writes.length;
    await source.chooseActivity(owner.uid, "child-one", choices[0].id, "first", "en");
    expect(firestore.writes).toHaveLength(before);
    expect(firestore.rows.get("users/owner/children/child-one")?.coParentActivityId).toBe("co-parent-practice-second");
    expect(firestore.rows.get("users/owner/children/child-one/actionLoops/co-parent-practice-first")).toEqual(first);
    expect(first.completedByUid).toBe(owner.uid);
    expect(first.outcome).toBeUndefined();
  });
  it("validates the real child's age and authored ID server-side, and never creates an erased or another owner's child", async () => {
    const grant = accepted(); seed(grant);
    await expect(source.chooseActivity(owner.uid, "child-one", "invented-ai-action", "one", "en")).rejects.toThrow("invalid_activity");
    const future = PRACTICES.find((p) => p.ageMonths === 60)!;
    await expect(source.chooseActivity(owner.uid, "child-one", future.id, "two", "en")).rejects.toThrow("invalid_activity");
    await expect(source.chooseActivity("other-owner", "child-one", future.id, "three", "en")).rejects.toThrow("access_ended");
    expect(coParentPractices({ age: "" } as any)).toEqual([]);
    const known = coParentPractices({ age: 3, ageMonths: 36, ageMonthsAsOf: new Date().toISOString().slice(0, 10) });
    expect(known.every((p) => [30, 36].includes(p.ageMonths))).toBe(true);
    firestore.rows.delete("users/owner/children/child-one");
    await expect(source.chooseActivity(owner.uid, "child-one", known[0].id, "four", "en")).rejects.toThrow("access_ended");
    expect(firestore.writes).toEqual([]);
  });
  it("an existing history without a shared pointer never becomes a shared chosen activity", async () => {
    const grant = accepted(); seed(grant);
    firestore.rows.set("users/owner/children/child-one", { name: "Invented child", age: 3 });
    expect((await source.load(grant, recipient.uid))?.activity).toBeNull();
    await expect(source.completeActivity(grant, recipient, "action-one")).rejects.toThrow("activity_changed");
  });
  it("a collaborative invitation cannot bypass UID acceptance through the legacy email-only packet route", async () => {
    const grant = accepted(); await store.create(grant);
    const load = vi.fn();
    const result = await resolveSharedPacket({ grantId: grant.id, recipientEmail: recipient.email, shareStore: store, source: { load } });
    expect(result.status).toBe(403);
    expect(load).not.toHaveBeenCalled();
  });
  it("adds notes to behaviorLogs with author provenance, retries do not duplicate, completion adds no child rating", async () => {
    const grant = accepted(); seed(grant);
    await source.addMoment(grant, recipient, "Waited for my turn", "save-1");
    await source.addMoment(grant, recipient, "Retry cannot change the original", "save-1");
    expect(firestore.writes).toEqual(["users/owner/children/child-one/behaviorLogs/co-parent-save-1"]);
    expect(firestore.rows.get(firestore.writes[0])).toMatchObject({ authorUid: recipient.uid, captureSource: "co_parent", trigger: "Waited for my turn" });
    await source.completeActivity(grant, recipient, "action-one");
    const action = firestore.rows.get("users/owner/children/child-one/actionLoops/action-one")!;
    expect(action).toMatchObject({ recommendation: "Take turns", status: "completed", completedByUid: recipient.uid, completedVia: "co_parent" });
    expect(action.outcome).toBeUndefined();
  });
  it("rechecks revocation inside the write transaction even if route authorization already passed", async () => {
    const grant = accepted(); seed(grant);
    firestore.rows.set(`shares/${grant.id}`, { ...grant, revokedAt: new Date().toISOString() });
    await expect(source.addMoment(grant, recipient, "Denied", "n1")).rejects.toThrow("access_ended");
    await expect(source.completeActivity(grant, recipient, "action-one")).rejects.toThrow("access_ended");
    expect(firestore.writes).toEqual([]);
  });
  it("does not recreate an erased child or overwrite a replaced activity", async () => {
    const grant = accepted(); seed(grant);
    firestore.rows.set("users/owner/children/child-one/actionLoops/action-one", { status: "superseded" });
    await expect(source.completeActivity(grant, recipient, "action-one")).rejects.toThrow("activity_changed");
    firestore.rows.delete("users/owner/children/child-one");
    await expect(source.addMoment(grant, recipient, "Denied", "n1")).rejects.toThrow("access_ended");
    expect(firestore.writes).toEqual([]);
  });
});
