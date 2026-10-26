/**
 * server/plans — B-BOOK-75 / B-KID-167: the server side of Everyday Plans.
 *
 *   GET  /api/plans/visibility
 *        → { reviewed, composable } per pattern and language for THIS viewer:
 *          `reviewed` is the licensed reviewer's record (config.plansReviewed,
 *          default nothing); `composable` adds the sandbox and the owner
 *          allow-list. The client's pattern door reads this and never decides
 *          on its own (lib/library/plans/planVisibility).
 *   POST /api/children/:childId/plan-books
 *        body { pattern, lang, stepMenuIds[3], minutes, time, boxItemIds[], durationDays }
 *        → validates the composition against the pattern's sourced menu,
 *          refuses an UNSIGNED pattern for anyone outside the sandbox and the
 *          owner list (403 plan_unsigned — the visibility gate, GA DoD 3),
 *          stamps the parent's approval (uid, now) and writes
 *          users/{uid}/children/{cid}/books/{bookId} (the PlanBookDoc the
 *          child's shelf reads). The sandbox (no Firebase) gets the doc back
 *          to keep on the device (`persisted: false`).
 *
 * Refusals: another family 403 (requireOwnership), unknown pattern 404, a
 * composition the menu does not allow 400 (the problems listed), unsigned 403.
 * Never a model call: the words are the pattern's authored lines.
 */
import express, { type RequestHandler, type Response } from "express";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import { validatePlanComposition, type PlanComposition } from "../lib/library/plans/composePlanBook.js";
import { getPattern } from "../lib/library/plans/planBooks.js";
import { planBookId, type PlanBookDoc } from "../lib/library/plans/planBookDoc.js";
import { canComposePlan, isPatternId, planVisibilityFor, readReviewFlags, type PlanOwners, type PlanReviewFlags, type PlanViewer } from "../lib/library/plans/planVisibility.js";
import type { BookLang } from "../lib/library/types.js";
import { logger, requestIdOf } from "./logger.js";

/** users/{uid}/children/{cid}/books/{bookId}. */
export interface PlanBookDocStore {
  write(uid: string, childId: string, doc: PlanBookDoc): Promise<void>;
}

export class FirestorePlanBookDocStore implements PlanBookDocStore {
  private readonly db: Firestore;
  constructor(config: Pick<ArborConfig, "firebaseProjectId" | "firestoreDatabaseId">) {
    if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    this.db = getFirestore(config.firestoreDatabaseId);
  }
  async write(uid: string, childId: string, doc: PlanBookDoc): Promise<void> {
    await this.db.doc(`users/${uid}/children/${childId}/books/${doc.id}`).set(doc);
  }
}

/** Tests and the sandbox: in memory. */
export class MemoryPlanBookDocStore implements PlanBookDocStore {
  readonly docs = new Map<string, PlanBookDoc>();
  async write(uid: string, childId: string, doc: PlanBookDoc): Promise<void> {
    this.docs.set(`${uid}:${childId}:${doc.id}`, doc);
  }
}

export interface PlansRouterDeps {
  config: Pick<ArborConfig, "plansReviewed" | "plansOwnerUids" | "plansOwnerEmails" | "memoryAdapter" | "arborEnv">;
  requireOwnership: RequestHandler;
  store: PlanBookDocStore;
  now?: () => string;
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;

const refuse = (res: Response, status: number, code: string, message: string, extra: Record<string, unknown> = {}) => res.status(status).json({ error: message, code, ...extra });

/** Who is asking: the verified uid and email, or the local sandbox (no
 *  Firebase, no token) — never a client-supplied claim. */
export function viewerOf(req: express.Request, config: PlansRouterDeps["config"]): PlanViewer {
  const user = (req as { user?: { uid?: string; email?: string | null } }).user;
  const sandbox = !user?.uid && config.memoryAdapter === "local" && config.arborEnv !== "prod";
  return { uid: user?.uid ?? null, email: user?.email ?? null, sandbox };
}

export function createPlansRouter(deps: PlansRouterDeps): express.Router {
  const router = express.Router();
  const flags: PlanReviewFlags = readReviewFlags(deps.config.plansReviewed);
  const owners: PlanOwners = { uids: deps.config.plansOwnerUids, emails: deps.config.plansOwnerEmails };
  const now = deps.now ?? (() => new Date().toISOString());

  router.get("/plans/visibility", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(planVisibilityFor(flags, viewerOf(req, deps.config), owners));
  });

  router.post("/children/:childId/plan-books", express.json({ limit: "16kb" }), deps.requireOwnership, async (req, res) => {
    const childId = String(req.params.childId ?? "");
    if (!ID.test(childId)) return refuse(res, 400, "plan_bad_child", "Bad child id");
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (!isPatternId(b.pattern)) return refuse(res, 404, "plan_unknown_pattern", "Unknown pattern");
    const def = getPattern(b.pattern);
    if (!def) return refuse(res, 404, "plan_unknown_pattern", "This pattern is not authored yet");
    const lang: BookLang = b.lang === "he" ? "he" : "en";
    const viewer = viewerOf(req, deps.config);
    const verdict = canComposePlan({ patternId: def.id, lang, flags, viewer, owners });
    if (!verdict.ok) return refuse(res, 403, "plan_unsigned", "This plan has not been reviewed for your language yet", { pattern: def.id, lang });
    const uid = viewer.uid ?? "local-sandbox";
    const composition: PlanComposition = {
      bookId: planBookId(def.id, childId),
      stepMenuIds: Array.isArray(b.stepMenuIds) && b.stepMenuIds.length === 3 ? (b.stepMenuIds.map(String) as [string, string, string]) : ["", "", ""],
      minutes: typeof b.minutes === "number" ? b.minutes : Number.NaN,
      time: typeof b.time === "string" ? b.time : "",
      boxItemIds: Array.isArray(b.boxItemIds) ? b.boxItemIds.map(String).slice(0, 8) : [],
      durationDays: typeof b.durationDays === "number" ? b.durationDays : Number.NaN,
      approvedAt: now(),
      approvedBy: uid,
    };
    const problems = validatePlanComposition(def, composition);
    if (problems.length) return refuse(res, 400, "plan_bad_composition", "The plan does not fit this pattern's menu", { problems });
    const t = composition.approvedAt;
    const doc: PlanBookDoc = { ...composition, id: composition.bookId, kind: "plan", pattern: def.id, lang, createdAt: t, updatedAt: t, status: "active" };
    const persisted = !viewer.sandbox;
    try {
      if (persisted) await deps.store.write(uid, childId, doc);
    } catch (error) {
      logger.error("Plan book write error", error instanceof Error ? error : new Error(String(error)), { requestId: requestIdOf(req) });
      return refuse(res, 503, "plan_store_unavailable", "The plan could not be saved");
    }
    res.status(201).json({ doc, persisted, why: verdict.why });
  });

  return router;
}

export const createPlanBookDocStore = (config: ArborConfig): PlanBookDocStore =>
  config.memoryAdapter === "firestore" ? new FirestorePlanBookDocStore(config) : new MemoryPlanBookDocStore();
