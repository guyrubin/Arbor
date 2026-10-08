import express from "express";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, type Transaction, type DocumentReference } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import { buildGrant, canAcceptCoParent, type ShareGrant, type ShareStore } from "../sharing/shares.js";
import type { CoParentWorkspace, CoParentActivity, CoParentActivitySelection } from "../sharing/coParentTypes.js";
import { buildMomentLog } from "../content/behaviorTaxonomy.js";
import { PRACTICES } from "../content/practices.js";
import { comparisonMonthsOf, type AgedChild } from "../lib/age/forChild.js";
import { bandForAgeMonths, milestoneAgeWindow } from "../lib/milestoneData.js";
import type { ActionLoopEntry } from "../actionLoop/model.js";

type Identity = { uid: string; email: string; emailVerified: boolean };
export const coParentAuthorized = (grant: ShareGrant, actor: Identity) =>
  actor.emailVerified && canAcceptCoParent(grant, actor.uid, actor.email) && grant.recipientUid === actor.uid;

export interface CoParentSource {
  childExists(ownerUid: string, childId: string): Promise<boolean>;
  activities(ownerUid: string, childId: string, language: "en" | "he"): Promise<CoParentActivitySelection | null>;
  chooseActivity(ownerUid: string, childId: string, practiceId: string, requestId: string, language: "en" | "he"): Promise<void>;
  completeOwnedActivity(ownerUid: string, childId: string, activityId: string): Promise<void>;
  load(grant: ShareGrant, actorUid: string): Promise<CoParentWorkspace | null>;
  /** Must recheck live grant in the SAME transaction as the ledger write. */
  addMoment(grant: ShareGrant, actor: Identity, text: string, requestId: string): Promise<void>;
  completeActivity(grant: ShareGrant, actor: Identity, activityId: string): Promise<void>;
}

const text = (value: unknown, max = 1200): string => typeof value === "string" ? value.trim().slice(0, max) : "";
const validId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_.-]{1,160}$/.test(value);

/** Same authored catalogue and corrected-age window as Today; no model output. */
export function coParentPractices(child: AgedChild) {
  const months = comparisonMonthsOf(child);
  if (months === null || !Number.isFinite(months) || months < 0 || months >= 156) return [];
  const window = milestoneAgeWindow(months);
  return PRACTICES.filter((practice) => {
    const band = bandForAgeMonths(practice.ageMonths).months;
    return band >= window.earlierBandMonths && band <= window.currentBandMonths;
  });
}

function activityView(id: string, row: Record<string, unknown> | undefined): CoParentActivity | null {
  if (!row || row.sharedWithCoParent !== true || row.status === "superseded") return null;
  return { id, text: text(row.recommendation), do: text(row.practiceDo), say: text(row.practiceSay),
    practiceId: text(row.practiceId, 160), selectedByUid: text(row.selectedByUid, 160), acceptedAt: text(row.acceptedAt, 40),
    completedAt: row.status === "completed" ? text(row.completedAt || row.outcomeAt || row.acceptedAt, 40) : null };
}

export class FirestoreCoParentSource implements CoParentSource {
  private readonly db;
  constructor(config: ArborConfig) {
    if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    this.db = getFirestore(config.firestoreDatabaseId);
  }
  private child(g: Pick<ShareGrant, "ownerUid" | "childId">) {
    return this.db.doc(`users/${g.ownerUid}/children/${g.childId}`);
  }
  async childExists(ownerUid: string, childId: string) { return (await this.child({ ownerUid, childId }).get()).exists; }
  async activities(ownerUid: string, childId: string, language: "en" | "he"): Promise<CoParentActivitySelection | null> {
    const ref = this.child({ ownerUid, childId });
    const child = await ref.get();
    if (!child.exists) return null;
    const data = child.data()!;
    const id = data.coParentActivityId;
    const action = validId(id) ? await ref.collection("actionLoops").doc(id).get() : null;
    return { activity: action ? activityView(action.id, action.data()) : null,
      choices: coParentPractices(data as AgedChild).map((p) => ({ id: p.id, do: p.do[language], say: p.say[language], minutes: p.minutes })) };
  }
  async chooseActivity(ownerUid: string, childId: string, practiceId: string, requestId: string, language: "en" | "he") {
    await this.db.runTransaction(async (tx) => {
      const ref = this.child({ ownerUid, childId });
      const child = await tx.get(ref);
      if (!child.exists) throw new Error("access_ended");
      const practice = coParentPractices(child.data() as AgedChild).find((p) => p.id === practiceId);
      if (!practice) throw new Error("invalid_activity");
      const activityRef = ref.collection("actionLoops").doc(`co-parent-practice-${requestId}`);
      const previous = await tx.get(activityRef);
      if (previous.exists) {
        if (previous.data()?.selectedByUid !== ownerUid || previous.data()?.practiceId !== practiceId) throw new Error("invalid_activity");
        return; // A retry never reopens a completed row or rolls back a newer choice.
      }
      const row: ActionLoopEntry = { id: activityRef.id, recommendation: `${practice.do[language]}\n${practice.say[language]}`,
        source: "practice", capacity: practice.minutes <= 5 ? "tiny" : practice.minutes <= 10 ? "standard" : "roomy", status: "accepted", acceptedAt: new Date().toISOString(),
        practiceId, shelf: practice.shelf, ...(practice.milestoneId ? { milestoneId: practice.milestoneId } : {}),
        sharedWithCoParent: true, selectedByUid: ownerUid, practiceDo: practice.do[language], practiceSay: practice.say[language] };
      tx.create(activityRef, row);
      tx.update(ref, { coParentActivityId: activityRef.id });
    });
  }
  private async completeSelected(tx: Transaction, ref: DocumentReference, child: Record<string, unknown>, id: string, actorUid: string) {
    if (child.coParentActivityId !== id) throw new Error("activity_changed");
    const activityRef = ref.collection("actionLoops").doc(id);
    const action = await tx.get(activityRef);
    if (!activityView(id, action.data())) throw new Error("activity_changed");
    if (action.data()?.status === "completed") return;
    // Completion describes the ADULT'S action. No child rating or fabricated outcome.
    tx.update(activityRef, { status: "completed", completedAt: new Date().toISOString(), completedByUid: actorUid, completedVia: "co_parent" });
  }
  async completeOwnedActivity(ownerUid: string, childId: string, activityId: string) {
    await this.db.runTransaction(async (tx) => {
      const ref = this.child({ ownerUid, childId });
      const child = await tx.get(ref);
      if (!child.exists) throw new Error("access_ended");
      await this.completeSelected(tx, ref, child.data()!, activityId, ownerUid);
    });
  }
  async load(grant: ShareGrant, actorUid: string): Promise<CoParentWorkspace | null> {
    const ref = this.child(grant);
    const child = await ref.get();
    if (!child.exists) return null;
    const id = child.data()?.coParentActivityId;
    const [action, logs] = await Promise.all([
      validId(id) ? ref.collection("actionLoops").doc(id).get() : Promise.resolve(null),
      ref.collection("behaviorLogs").orderBy("timestamp", "desc").limit(20).get(),
    ]);
    return {
      childId: grant.childId, childName: text(child.data()?.name, 120), ownerEmail: grant.ownerEmail,
      activity: action ? activityView(action.id, action.data()) : null,
      moments: logs.docs.map((d) => ({ id: d.id, text: [text(d.data().trigger), text(d.data().response)].filter(Boolean).join("\n"), at: text(d.data().timestamp, 40), addedByYou: d.data().authorUid === actorUid })).filter((m) => m.text),
    };
  }
  private async mutate(grant: ShareGrant, actor: Identity, op: "moment" | "activity", value: string, id: string) {
    await this.db.runTransaction(async (tx) => {
      const grantDoc = await tx.get(this.db.doc(`shares/${grant.id}`));
      const current = grantDoc.data() as ShareGrant | undefined;
      if (!current || !coParentAuthorized(current, actor)) throw new Error("access_ended");
      const child = this.child(current);
      const childDoc = await tx.get(child);
      if (!childDoc.exists) throw new Error("access_ended");
      if (op === "moment") {
        const ref = child.collection("behaviorLogs").doc(`co-parent-${id}`);
        const existing = await tx.get(ref);
        if (existing.exists) {
          if (existing.data()?.authorUid !== actor.uid) throw new Error("access_ended");
          return; // a retried save cannot duplicate or replace a previous note
        }
        const row = buildMomentLog(value, "Home");
        if (!row) throw new Error("invalid_note");
        tx.create(ref, { ...row, id: ref.id, authorUid: actor.uid, captureSource: "co_parent", shareGrantId: current.id });
      } else {
        await this.completeSelected(tx, child, childDoc.data()!, id, actor.uid);
      }
    });
  }
  async addMoment(g: ShareGrant, actor: Identity, note: string, id: string) { await this.mutate(g, actor, "moment", note, id); }
  async completeActivity(g: ShareGrant, actor: Identity, id: string) { await this.mutate(g, actor, "activity", "", id); }
}

export function createCoParentRouter(deps: { config: ArborConfig; shareStore: ShareStore; requireOwnership: express.RequestHandler; source?: CoParentSource }) {
  const router = express.Router();
  const source = deps.source ?? (deps.config.memoryAdapter === "firestore" ? new FirestoreCoParentSource(deps.config) : null);
  const identity = (req: express.Request): Identity => {
    const user = (req as express.Request & { user?: { uid?: string; email?: string; emailVerified?: boolean } }).user;
    return { uid: user?.uid ?? "", email: user?.email ?? "", emailVerified: user?.emailVerified === true };
  };
  router.use("/co-parent", (req, res, next) => {
    const actor = identity(req);
    if (!actor.uid || actor.uid === "local-sandbox") { res.status(401).json({ error: "sign_in_required" }); return; }
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  const activityError = (res: express.Response, err: unknown) => {
    const code = err instanceof Error ? err.message : "save_failed";
    res.status(code === "access_ended" ? 403 : code === "invalid_activity" ? 400 : code === "activity_changed" ? 409 : 503)
      .json({ error: ["access_ended", "invalid_activity", "activity_changed"].includes(code) ? code : "save_failed" });
  };
  router.get("/co-parent/children/:childId/activity", deps.requireOwnership, async (req, res) => {
    if (!validId(req.params.childId)) { res.status(400).json({ error: "invalid_activity" }); return; }
    try {
      const result = source && await source.activities(identity(req).uid, req.params.childId, req.query.language === "he" ? "he" : "en");
      if (!result) { res.status(403).json({ error: "access_ended" }); return; }
      res.json(result);
    } catch (err) { activityError(res, err); }
  });
  router.post("/co-parent/children/:childId/activity", deps.requireOwnership, async (req, res) => {
    const { practiceId, requestId, language } = req.body ?? {};
    if (!validId(req.params.childId) || !validId(practiceId) || !validId(requestId) || !["en", "he"].includes(language)) { res.status(400).json({ error: "invalid_activity" }); return; }
    try {
      if (!source) throw new Error("unavailable");
      await source.chooseActivity(identity(req).uid, req.params.childId, practiceId, requestId, language);
      res.json({ saved: true });
    } catch (err) { activityError(res, err); }
  });
  router.post("/co-parent/children/:childId/activity/complete", deps.requireOwnership, async (req, res) => {
    if (!validId(req.params.childId) || !validId(req.body?.activityId)) { res.status(400).json({ error: "invalid_activity" }); return; }
    try {
      if (!source) throw new Error("unavailable");
      await source.completeOwnedActivity(identity(req).uid, req.params.childId, req.body.activityId);
      res.json({ saved: true });
    } catch (err) { activityError(res, err); }
  });
  router.post("/co-parent/invitations", deps.requireOwnership, async (req, res) => {
    const actor = identity(req);
    const { childId } = req.body ?? {};
    const recipientEmail = text(req.body?.recipientEmail, 254).toLowerCase();
    if (!validId(childId) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail) || recipientEmail === actor.email.toLowerCase()) {
      res.status(400).json({ error: "invalid_invitation" }); return;
    }
    try {
      if (!source || !await source.childExists(actor.uid, childId)) { res.status(403).json({ error: "child_unavailable" }); return; }
      const existing = (await deps.shareStore.listByOwner(actor.uid, childId)).find((g) => g.accessMode === "family_workspace" && g.recipientEmail === recipientEmail);
      const grant = existing ?? await deps.shareStore.create(buildGrant({ ownerUid: actor.uid, ownerEmail: actor.email, childId, childName: text(req.body?.childName, 120), recipientEmail, role: "co_parent", scopes: ["story_timeline"], duration: "until_revoked", accessMode: "family_workspace" }));
      res.json(grant);
    } catch { res.status(503).json({ error: "sharing_unavailable" }); }
  });
  router.get("/co-parent/invitations", async (req, res) => {
    const actor = identity(req);
    if (!actor.emailVerified) { res.status(403).json({ error: "verify_email" }); return; }
    try {
      const grants = (await deps.shareStore.listByRecipient(actor.email)).filter((g) => canAcceptCoParent(g, actor.uid, actor.email));
      res.json({ shares: grants });
    } catch { res.status(503).json({ error: "sharing_unavailable" }); }
  });
  router.post("/co-parent/:grantId/accept", async (req, res) => {
    const actor = identity(req);
    if (!actor.emailVerified) { res.status(403).json({ error: "verify_email" }); return; }
    if (!validId(req.params.grantId)) { res.status(403).json({ error: "access_ended" }); return; }
    try {
      const grant = await deps.shareStore.acceptCoParent(req.params.grantId, actor.uid, actor.email);
      if (!grant) { res.status(403).json({ error: "access_ended" }); return; }
      res.json(grant);
    } catch { res.status(503).json({ error: "sharing_unavailable" }); }
  });
  router.use("/co-parent/:grantId/workspace", async (req, res, next) => {
    if (!validId(req.params.grantId)) { res.status(403).json({ error: "access_ended" }); return; }
    try {
      const grant = await deps.shareStore.get(req.params.grantId);
      if (!grant || !coParentAuthorized(grant, identity(req))) { res.status(403).json({ error: "access_ended" }); return; }
      res.locals.coParentGrant = grant;
      next();
    } catch { res.status(503).json({ error: "sharing_unavailable" }); }
  });
  router.get("/co-parent/:grantId/workspace", async (req, res) => {
    try {
      const workspace = source && await source.load(res.locals.coParentGrant as ShareGrant, identity(req).uid);
      if (!workspace) { res.status(404).json({ error: "child_unavailable" }); return; }
      res.json(workspace);
    } catch { res.status(503).json({ error: "sharing_unavailable" }); }
  });
  router.post("/co-parent/:grantId/workspace/moments", async (req, res) => {
    const note = req.body?.text;
    if (typeof note !== "string" || !note.trim() || note.length > 1200 || !validId(req.body?.requestId)) { res.status(400).json({ error: "invalid_note" }); return; }
    try {
      if (!source) throw new Error("unavailable");
      await source.addMoment(res.locals.coParentGrant as ShareGrant, identity(req), note.trim(), req.body.requestId);
      res.json({ saved: true });
    } catch (err) { res.status(err instanceof Error && err.message === "access_ended" ? 403 : 503).json({ error: err instanceof Error && err.message === "access_ended" ? "access_ended" : "save_failed" }); }
  });
  router.post("/co-parent/:grantId/workspace/complete", async (req, res) => {
    if (!validId(req.body?.activityId)) { res.status(400).json({ error: "invalid_activity" }); return; }
    try {
      if (!source) throw new Error("unavailable");
      await source.completeActivity(res.locals.coParentGrant as ShareGrant, identity(req), req.body.activityId);
      res.json({ saved: true });
    } catch (err) { activityError(res, err); }
  });
  return router;
}
