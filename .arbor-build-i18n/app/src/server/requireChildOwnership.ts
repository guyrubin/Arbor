import type { Request, Response, NextFunction } from "express";
import type { MemoryStore } from "../memory/types.js";

const actorUid = (req: Request): string => (req as { user?: { uid?: string } }).user?.uid || "local-sandbox";

/**
 * Per-child AUTHORIZATION middleware (closes the IDOR on child-scoped endpoints).
 * Ensures the authenticated actor belongs to the family that owns the `childId`
 * taken from the route (`params.childId`) or body (`body.childId`).
 *
 * Fails CLOSED: a non-owner or any lookup error → 403. No-ops in single-tenant /
 * local mode (a store without `ownsChild`, or the unauthenticated "local-sandbox"
 * uid) so the local memory adapter and dev keep working. Apply AFTER the auth
 * middleware that stamps `req.user.uid`.
 */
export function requireChildOwnership(memoryStore: Pick<MemoryStore, "ownsChild">) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!memoryStore.ownsChild) return next(); // single-tenant store: nothing to enforce
    const uid = actorUid(req);
    if (uid === "local-sandbox") return next(); // unauthenticated local/dev
    const childId = String(req.params.childId || req.body?.childId || "").trim();
    if (!childId) return next(); // no child in the request to authorize
    try {
      if (await memoryStore.ownsChild(uid, childId)) return next();
      return res.status(403).json({ error: "Not authorized for this child." });
    } catch {
      return res.status(403).json({ error: "Not authorized for this child." });
    }
  };
}
