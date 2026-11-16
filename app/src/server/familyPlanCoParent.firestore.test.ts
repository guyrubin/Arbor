/**
 * Family plan v1 — the Firestore source behind the co-parent routes, against
 * an in-memory firebase-admin fake: the live grant is re-read inside the same
 * transaction as the row write, the row path is the OWNER's child tree, and a
 * refused change writes nothing. Synthetic only.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createTestConfig } from "../testConfig.js";
import { buildGrant, type ShareGrant } from "../sharing/shares.js";
import { askAdult, createDate } from "../lib/familyPlan/model.js";
import { coParentAnswer } from "../lib/familyPlan/coParentView.js";

const db = vi.hoisted(() => ({ rows: new Map<string, Record<string, unknown>>(), writes: [] as string[] }));
vi.mock("firebase-admin/app", () => ({ getApps: () => [{}], initializeApp: vi.fn(), applicationDefault: vi.fn() }));
vi.mock("firebase-admin/firestore", () => {
  const snap = (path: string) => ({ id: path.split("/").at(-1), exists: db.rows.has(path), data: () => db.rows.get(path) });
  const query = (path: string, from = ""): any => ({
    where: (_f: string, _op: string, v: string) => query(path, v),
    orderBy: () => query(path, from),
    limit: () => query(path, from),
    get: async () => ({ docs: [...db.rows.keys()].filter((k) => k.startsWith(`${path}/`) && !k.slice(path.length + 1).includes("/")).map(snap).filter((s) => String(s.data()?.date ?? "") >= from) }),
  });
  const ref = (path: string): any => ({ path, id: path.split("/").at(-1), get: async () => snap(path), collection: (name: string) => ({ ...query(`${path}/${name}`), doc: (id: string) => ref(`${path}/${name}/${id}`) }) });
  return { getFirestore: () => ({ doc: ref, runTransaction: async (fn: any) => fn({
    get: async (r: { path: string }) => snap(r.path),
    set: (r: { path: string }, row: Record<string, unknown>) => { db.writes.push(r.path); db.rows.set(r.path, row); },
  }) }) };
});
const { FirestoreFamilyPlanCoParentSource, PlanError } = await import("./familyPlanCoParent.js");

const owner = { uid: "owner-1", email: "parent.one@example.test" };
const co = { uid: "co-1", email: "parent.two@example.test", emailVerified: true };
const NOW = "2026-11-16T08:00:00.000Z";
let grant: ShareGrant;

beforeEach(() => {
  db.rows.clear(); db.writes.length = 0;
  grant = { ...buildGrant({ ownerUid: owner.uid, ownerEmail: owner.email, childId: "child-1", childName: null, recipientEmail: co.email, role: "co_parent", scopes: ["story_timeline"], duration: "until_revoked", accessMode: "family_workspace" }), recipientUid: co.uid, acceptedAt: NOW };
  db.rows.set(`shares/${grant.id}`, grant as unknown as Record<string, unknown>);
  db.rows.set(`users/${owner.uid}/children/child-1`, { name: "Synthetic child" });
  const visit = askAdult(createDate({ id: "visit", kind: "join", title: "Group visit", date: "2099-11-19", time: "10:00", origin: "manual" }, owner.uid, NOW), owner.uid, { uid: co.uid, role: "co_parent", email: co.email, grantId: grant.id }, "", NOW);
  db.rows.set(`users/${owner.uid}/children/child-1/familyPlanDates/visit`, visit as unknown as Record<string, unknown>);
});

describe("FirestoreFamilyPlanCoParentSource", () => {
  it("lists the owner's child's dates from a day on, as the co-parent's projection", async () => {
    const source = new FirestoreFamilyPlanCoParentSource(createTestConfig());
    const plan = await source.list(grant, co.uid, "2026-11-14");
    expect(plan?.childName).toBe("Synthetic child");
    expect(plan?.dates.map((d) => [d.id, d.state, d.request?.forYou])).toEqual([["visit", "asked", true]]);
  });

  it("answers inside the transaction on the owner's row", async () => {
    const source = new FirestoreFamilyPlanCoParentSource(createTestConfig());
    const view = await source.mutate(grant, co, "visit", (item, adult) => coParentAnswer(item, adult, "yes", 1, NOW));
    expect(view.holderIsYou).toBe(true);
    expect(db.writes).toEqual([`users/${owner.uid}/children/child-1/familyPlanDates/visit`]);
  });

  it("a revoked grant (re-read in the transaction) writes nothing", async () => {
    db.rows.set(`shares/${grant.id}`, { ...grant, revokedAt: NOW } as unknown as Record<string, unknown>);
    const source = new FirestoreFamilyPlanCoParentSource(createTestConfig());
    await expect(source.mutate(grant, co, "visit", (item, adult) => coParentAnswer(item, adult, "yes", 1, NOW))).rejects.toBeInstanceOf(PlanError);
    expect(db.writes).toEqual([]);
  });

  it("a refused change (wrong version) writes nothing", async () => {
    const source = new FirestoreFamilyPlanCoParentSource(createTestConfig());
    await expect(source.mutate(grant, co, "visit", (item, adult) => coParentAnswer(item, adult, "yes", 3, NOW))).rejects.toMatchObject({ code: "date_changed" });
    expect(db.writes).toEqual([]);
  });
});
