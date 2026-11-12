/**
 * B-AIOPS-01: stamp the authenticated family's id onto the request context
 * before a paid call, so the cost record can name the family and nothing else.
 * Best-effort: a lookup failure still serves the request, with no family id.
 * The lookup only READS (findFamilyForUser): a label must never provision. With
 * ensureFamilyForUser, a new parent's first paid call racing onboarding could
 * create a second family for the same uid. A uid without a family yet is
 * served unlabelled and looked up again on its next paid call (no cached miss).
 */
import type { RequestHandler } from "express";
import { bindFamilyId, costId } from "./requestContext.js";

type FamilyLookup = { findFamilyForUser?: (uid: string) => Promise<{ familyId: string } | null> };

const cache = new Map<string, string>();
const CACHE_MAX = 5000;

/** Paid routes whose calls must carry a family id. Paths are router-relative (`/chat`, not `/api/chat`). */
export function isPaidCostPath(path: string): boolean {
  return /^\/(?:voice|extract-log|vision|generate-plan|generate-bedtime-story|conversation\/proposals|describe-child|generate-adventure|generate-hero-journey|analyze-behavior|generate-handoff|digest|generate-avatar|generate-scene|generate-comic|live\/token|live\/turn|todays-focus|explain|chat|council|tts)(?:\/|$)/.test(path)
    || /\/(?:book-narration|plan-narration)(?:\/|$)/.test(path);
}

export function bindFamilyForCost(memoryStore: FamilyLookup): RequestHandler {
  return (req, res, next) => {
    if (!isPaidCostPath(req.path)) { next(); return; }
    const uid = (req as { user?: { uid?: string } }).user?.uid;
    if (!uid || uid === "local-sandbox" || !costId(uid)) { next(); return; }
    const hit = cache.get(uid);
    if (hit) { bindFamilyId(hit); next(); return; }
    if (typeof memoryStore.findFamilyForUser !== "function") { next(); return; }
    // Called as a METHOD: the Firestore store reads `this.families`. A detached
    // call threw synchronously, outside the promise, and every paid route for a
    // signed-in parent answered 500 (4-11 Nov 2026: Ask, read-aloud, stories).
    // A synchronous throw is a failed lookup too: best-effort, never the request.
    let lookup: Promise<{ familyId: string } | null>;
    try {
      lookup = Promise.resolve(memoryStore.findFamilyForUser(uid));
    } catch {
      next();
      return;
    }
    lookup.then(
      (found) => {
        const id = found ? costId(found.familyId) : null;
        if (id) {
          if (cache.size >= CACHE_MAX) cache.clear();
          cache.set(uid, id);
          bindFamilyId(id);
        }
        next();
      },
      () => next(),
    );
  };
}
