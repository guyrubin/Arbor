/**
 * Family plan v1 — the co-parent's side, through the server.
 *
 * The family plan lives in the owner's child tree (users/{owner}/children/
 * {child}/familyPlanDates), which Firestore rules keep owner-only. A
 * co-parent who joined the family on a live `family_workspace` share grant
 * (server/coParent.ts) reaches it here, and only here:
 *   GET  /co-parent/:grantId/family-plan                  the plan's dates (a projection)
 *   POST /co-parent/:grantId/family-plan/:dateId/answer   yes / no to a request addressed to them
 *   POST /co-parent/:grantId/family-plan/:dateId/done     done, for a date they have
 * Every write rechecks the live grant INSIDE the same transaction as the row
 * write (a revoked grant ends at once), answers only a request addressed to
 * the signed-in adult, and only for the version it was asked for (a changed
 * date answers 409 `date_changed` and the adult sees the new version).
 */
import express from "express";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import type { ShareGrant, ShareStore } from "../sharing/shares.js";
import { coParentAuthorized } from "./coParent.js";
import { FAMILY_PLAN_COLLECTION, addDays, dayKey, type FamilyPlanAdult, type FamilyPlanDate } from "../lib/familyPlan/model.js";
import { coParentAnswer, coParentDateView, coParentDone, type CoParentFamilyPlan, type CoParentPlanDate, type CoParentPlanError } from "../lib/familyPlan/coParentView.js";

type Identity = { uid: string; email: string; emailVerified: boolean };

export interface FamilyPlanCoParentSource {
  list(grant: ShareGrant, actorUid: string, fromDay: string): Promise<CoParentFamilyPlan | null>;
  /** Runs `change` on one row inside a transaction that rechecks the live grant. */
  mutate(
    grant: ShareGrant,
    actor: Identity,
    dateId: string,
    change: (item: FamilyPlanDate | null, adult: FamilyPlanAdult) => { ok: true; item: FamilyPlanDate; changed: boolean } | { ok: false; error: CoParentPlanError },
  ): Promise<CoParentPlanDate>;
}

const validId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_.-]{1,160}$/.test(value);
const text = (value: unknown, max = 160): string => (typeof value === "string" ? value.trim().slice(0, max) : "");

export class PlanError extends Error {
  constructor(public code: CoParentPlanError | "access_ended") { super(code); }
}

const adultOf = (grant: ShareGrant, actor: Identity): FamilyPlanAdult => ({ uid: actor.uid, role: "co_parent", email: actor.email.toLowerCase(), grantId: grant.id });

export class FirestoreFamilyPlanCoParentSource implements FamilyPlanCoParentSource {
  private readonly db;
  constructor(config: ArborConfig) {
    if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    this.db = getFirestore(config.firestoreDatabaseId);
  }
  private child(g: Pick<ShareGrant, "ownerUid" | "childId">) {
    return this.db.doc(`users/${g.ownerUid}/children/${g.childId}`);
  }
  async list(grant: ShareGrant, actorUid: string, fromDay: string): Promise<CoParentFamilyPlan | null> {
    const ref = this.child(grant);
    const [child, rows] = await Promise.all([
      ref.get(),
      ref.collection(FAMILY_PLAN_COLLECTION).where("date", ">=", fromDay).orderBy("date").limit(60).get(),
    ]);
    if (!child.exists) return null;
    return {
      childName: text(child.data()?.name, 120),
      ownerEmail: grant.ownerEmail,
      dates: rows.docs.map((d) => d.data() as FamilyPlanDate).filter((d) => d.status !== "cancelled").map((d) => coParentDateView(d, actorUid)),
    };
  }
  async mutate(grant: ShareGrant, actor: Identity, dateId: string, change: Parameters<FamilyPlanCoParentSource["mutate"]>[3]): Promise<CoParentPlanDate> {
    return this.db.runTransaction(async (tx) => {
      const grantDoc = await tx.get(this.db.doc(`shares/${grant.id}`));
      const current = grantDoc.data() as ShareGrant | undefined;
      if (!current || !coParentAuthorized(current, actor)) throw new PlanError("access_ended");
      const ref = this.child(current).collection(FAMILY_PLAN_COLLECTION).doc(dateId);
      const row = await tx.get(ref);
      const result = change(row.exists ? (row.data() as FamilyPlanDate) : null, adultOf(current, actor));
      if ("error" in result) throw new PlanError(result.error);
      if (result.changed) tx.set(ref, JSON.parse(JSON.stringify(result.item)));
      return coParentDateView(result.item, actor.uid);
    });
  }
}

export function createFamilyPlanCoParentRouter(deps: { config: ArborConfig; shareStore: ShareStore; source?: FamilyPlanCoParentSource | null }) {
  const router = express.Router();
  const source = deps.source !== undefined ? deps.source : deps.config.memoryAdapter === "firestore" ? new FirestoreFamilyPlanCoParentSource(deps.config) : null;
  const identity = (req: express.Request): Identity => {
    const user = (req as express.Request & { user?: { uid?: string; email?: string; emailVerified?: boolean } }).user;
    return { uid: user?.uid ?? "", email: user?.email ?? "", emailVerified: user?.emailVerified === true };
  };
  router.use("/co-parent/:grantId/family-plan", async (req, res, next) => {
    const actor = identity(req);
    res.setHeader("Cache-Control", "no-store");
    if (!actor.uid || actor.uid === "local-sandbox") { res.status(401).json({ error: "sign_in_required" }); return; }
    if (!validId(req.params.grantId)) { res.status(403).json({ error: "access_ended" }); return; }
    try {
      const grant = await deps.shareStore.get(req.params.grantId);
      if (!grant || !coParentAuthorized(grant, actor)) { res.status(403).json({ error: "access_ended" }); return; }
      res.locals.familyPlanGrant = grant;
      next();
    } catch { res.status(503).json({ error: "sharing_unavailable" }); }
  });
  const fail = (res: express.Response, err: unknown) => {
    const code = err instanceof PlanError ? err.code : "save_failed";
    const status = code === "access_ended" ? 403 : code === "not_found" ? 404 : code === "date_changed" ? 409 : code === "not_asked" || code === "not_for_you" || code === "not_yours" ? 409 : 503;
    res.status(status).json({ error: code });
  };
  router.get("/co-parent/:grantId/family-plan", async (req, res) => {
    try {
      if (!source) { res.status(503).json({ error: "unavailable" }); return; }
      // From two days back, the same window the owner's ribbon starts at.
      const plan = await source.list(res.locals.familyPlanGrant as ShareGrant, identity(req).uid, addDays(dayKey(new Date()), -2));
      if (!plan) { res.status(404).json({ error: "child_unavailable" }); return; }
      res.json(plan);
    } catch { res.status(503).json({ error: "sharing_unavailable" }); }
  });
  router.post("/co-parent/:grantId/family-plan/:dateId/answer", async (req, res) => {
    const answer = req.body?.answer;
    const version = req.body?.version;
    if (!validId(req.params.dateId) || (answer !== "yes" && answer !== "no") || !Number.isInteger(version) || version < 1) { res.status(400).json({ error: "invalid_answer" }); return; }
    try {
      if (!source) throw new Error("unavailable");
      const now = new Date().toISOString();
      const view = await source.mutate(res.locals.familyPlanGrant as ShareGrant, identity(req), req.params.dateId, (item, adult) => coParentAnswer(item, adult, answer, version, now));
      res.json(view);
    } catch (err) { fail(res, err); }
  });
  router.post("/co-parent/:grantId/family-plan/:dateId/done", async (req, res) => {
    if (!validId(req.params.dateId)) { res.status(400).json({ error: "invalid_answer" }); return; }
    try {
      if (!source) throw new Error("unavailable");
      const now = new Date().toISOString();
      const view = await source.mutate(res.locals.familyPlanGrant as ShareGrant, identity(req), req.params.dateId, (item, adult) => coParentDone(item, adult.uid, now));
      res.json(view);
    } catch (err) { fail(res, err); }
  });
  return router;
}
