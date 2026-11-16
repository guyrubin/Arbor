/**
 * Family plan v1 — the co-parent's routes on a live family_workspace grant.
 * A fake source holds the owner's rows and rechecks the live grant on every
 * write, as the Firestore source does inside its transaction. Synthetic only.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createFamilyPlanCoParentRouter, PlanError, type FamilyPlanCoParentSource } from "./familyPlanCoParent.js";
import { coParentAuthorized } from "./coParent.js";
import { buildGrant, LocalShareStore, type ShareGrant } from "../sharing/shares.js";
import { createTestConfig } from "../testConfig.js";
import { askAdult, createDate, takeIt, applyChange, type FamilyPlanDate } from "../lib/familyPlan/model.js";
import { coParentDateView } from "../lib/familyPlan/coParentView.js";

const owner = { uid: "owner-1", email: "parent.one@example.test", emailVerified: true };
const co = { uid: "co-1", email: "parent.two@example.test", emailVerified: true };
const stranger = { uid: "x-1", email: "someone@example.test", emailVerified: true };
const store = new LocalShareStore();
let grant: ShareGrant;
const rows = new Map<string, FamilyPlanDate>();
const NOW = "2026-11-16T08:00:00.000Z";

const source: FamilyPlanCoParentSource = {
  list: async (g, actorUid) => ({ childName: "Synthetic child", ownerEmail: g.ownerEmail, dates: [...rows.values()].filter((d) => d.status !== "cancelled").map((d) => coParentDateView(d, actorUid)) }),
  mutate: async (g, actor, id, change) => {
    const live = await store.get(g.id);
    if (!live || !coParentAuthorized(live, actor)) throw new PlanError("access_ended");
    const result = change(rows.get(id) ?? null, { uid: actor.uid, role: "co_parent", email: actor.email, grantId: g.id });
    if ("error" in result) throw new PlanError(result.error);
    if (result.changed) rows.set(id, result.item);
    return coParentDateView(result.item, actor.uid);
  },
};

let server: Server;
let base = "";
const call = async (who: typeof co | null, path: string, body?: unknown) => {
  const res = await fetch(`${base}/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...(who ? { "x-uid": who.uid, "x-email": who.email, "x-verified": String(who.emailVerified) } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) as any };
};

beforeAll(async () => {
  grant = await store.create(buildGrant({ ownerUid: owner.uid, ownerEmail: owner.email, childId: "child-1", childName: "Synthetic child", recipientEmail: co.email, role: "co_parent", scopes: ["story_timeline"], duration: "until_revoked", accessMode: "family_workspace" }));
  await store.acceptCoParent(grant.id, co.uid, co.email);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (req.header("x-uid")) (req as any).user = { uid: req.header("x-uid"), email: req.header("x-email"), emailVerified: req.header("x-verified") === "true" };
    next();
  });
  app.use("/api", createFamilyPlanCoParentRouter({ config: createTestConfig(), shareStore: store, source }));
  await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/co-parent`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });

const coAdult = () => ({ uid: co.uid, role: "co_parent" as const, email: co.email, grantId: grant.id });
beforeEach(() => {
  rows.clear();
  const visit = createDate({ id: "visit", kind: "join", title: "Group visit", date: "2026-11-19", time: "10:00", origin: "message", sourceLine: "We ask one parent to join" }, owner.uid, NOW);
  rows.set("visit", askAdult(visit, owner.uid, coAdult(), "Can you take the visit?", NOW));
  rows.set("form", takeIt(createDate({ id: "form", kind: "deadline", title: "Return the form", date: "2026-11-18", origin: "manual" }, owner.uid, NOW), { uid: owner.uid, role: "owner", email: owner.email }, NOW));
});

describe("the co-parent's family plan routes", () => {
  it("signed out → 401; another account → 403; the co-parent reads a projection", async () => {
    expect((await call(null, `${grant.id}/family-plan`)).status).toBe(401);
    expect((await call(stranger, `${grant.id}/family-plan`)).status).toBe(403);
    expect((await call(owner, `${grant.id}/family-plan`)).status).toBe(403);
    const { status, body } = await call(co, `${grant.id}/family-plan`);
    expect(status).toBe(200);
    const visit = body.dates.find((d: any) => d.id === "visit");
    expect(visit).toMatchObject({ state: "asked", request: { forYou: true, status: "asked", note: "Can you take the visit?", forVersion: 1 } });
    const form = body.dates.find((d: any) => d.id === "form");
    // Another adult's row: who has it, but no request note and no history.
    expect(form).toMatchObject({ state: "has", holderIsYou: false, holderEmail: owner.email });
    expect(JSON.stringify(body)).not.toContain("history");
  });

  it("yes to the version asked: the co-parent has it; a retried yes is the same answer", async () => {
    const first = await call(co, `${grant.id}/family-plan/visit/answer`, { answer: "yes", version: 1 });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ state: "has", holderIsYou: true, request: { status: "accepted" } });
    expect(rows.get("visit")?.holder?.uid).toBe(co.uid);
    const again = await call(co, `${grant.id}/family-plan/visit/answer`, { answer: "yes", version: 1 });
    expect(again.status).toBe(200);
    expect(rows.get("visit")?.history.filter((h) => h.kind === "accepted")).toHaveLength(1);
  });

  it("a changed date refuses the old version's answer (409 date_changed)", async () => {
    rows.set("visit", applyChange(rows.get("visit")!, { date: "2026-11-19", time: "11:30" }, owner.uid, NOW, "Still ok at 11:30?"));
    const stale = await call(co, `${grant.id}/family-plan/visit/answer`, { answer: "yes", version: 1 });
    expect(stale).toMatchObject({ status: 409, body: { error: "date_changed" } });
    const fresh = await call(co, `${grant.id}/family-plan/visit/answer`, { answer: "yes", version: 2 });
    expect(fresh.status).toBe(200);
    expect(rows.get("visit")?.time).toBe("11:30");
  });

  it("a request not addressed to you cannot be answered; done only for a date you have", async () => {
    expect((await call(co, `${grant.id}/family-plan/form/answer`, { answer: "yes", version: 1 })).status).toBe(409);
    expect((await call(co, `${grant.id}/family-plan/form/done`, {})).body.error).toBe("not_yours");
    await call(co, `${grant.id}/family-plan/visit/answer`, { answer: "yes", version: 1 });
    const done = await call(co, `${grant.id}/family-plan/visit/done`, {});
    expect(done).toMatchObject({ status: 200, body: { status: "done" } });
  });

  it("bad input → 400; an unknown date → 404", async () => {
    expect((await call(co, `${grant.id}/family-plan/visit/answer`, { answer: "maybe", version: 1 })).status).toBe(400);
    expect((await call(co, `${grant.id}/family-plan/visit/answer`, { answer: "yes" })).status).toBe(400);
    expect((await call(co, `${grant.id}/family-plan/nope/answer`, { answer: "yes", version: 1 })).status).toBe(404);
  });

  it("a revoked grant ends access at once, for reads and writes", async () => {
    const g2 = await store.create(buildGrant({ ownerUid: owner.uid, ownerEmail: owner.email, childId: "child-1", childName: null, recipientEmail: "third@example.test", role: "co_parent", scopes: ["story_timeline"], duration: "until_revoked", accessMode: "family_workspace" }));
    const third = { uid: "third-1", email: "third@example.test", emailVerified: true };
    await store.acceptCoParent(g2.id, third.uid, third.email);
    expect((await call(third, `${g2.id}/family-plan`)).status).toBe(200);
    await store.revoke(g2.id, owner.uid);
    expect((await call(third, `${g2.id}/family-plan`)).status).toBe(403);
    expect((await call(third, `${g2.id}/family-plan/visit/answer`, { answer: "yes", version: 1 })).status).toBe(403);
  });

  it("without a store the routes say unavailable (local mode), never a false success", async () => {
    const app = express(); app.use(express.json());
    app.use((req, _res, next) => { (req as any).user = { uid: co.uid, email: co.email, emailVerified: true }; next(); });
    app.use("/api", createFamilyPlanCoParentRouter({ config: createTestConfig(), shareStore: store, source: null }));
    const s = await new Promise<Server>((resolve) => { const x = app.listen(0, "127.0.0.1", () => resolve(x)); });
    const url = `http://127.0.0.1:${(s.address() as AddressInfo).port}/api/co-parent/${grant.id}/family-plan`;
    expect((await fetch(url)).status).toBe(503);
    expect((await fetch(`${url}/visit/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer: "yes", version: 1 }) })).status).toBe(503);
    await new Promise<void>((resolve) => s.close(() => resolve()));
  });
});
