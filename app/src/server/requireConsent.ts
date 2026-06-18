import type { Request, Response, NextFunction } from "express";
import type { ConsentPurpose, ConsentStore } from "../sharing/consent.js";

const actorUid = (req: Request): string => (req as { user?: { uid?: string } }).user?.uid || "local-sandbox";

/**
 * COPPA gate: a request that processes a child's face or voice is rejected (451
 * "Unavailable For Legal Reasons") unless an active, in-scope parental consent
 * grant exists for the `childId` (from body or params).
 *
 * `appliesWhen` lets the caller gate only when the sensitive input is actually
 * present — e.g. only when /generate-avatar carries a `photo` (the describe path
 * has no face and stays ungated). No-ops for the unauthenticated "local-sandbox"
 * uid so dev/sandbox keep working. Fails CLOSED (451) on a missing childId or a
 * lookup error. Apply AFTER the auth middleware.
 */
export function requireConsent(
  consentStore: ConsentStore,
  purpose: ConsentPurpose,
  appliesWhen: (req: Request) => boolean = () => true,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!appliesWhen(req)) return next();
    const uid = actorUid(req);
    if (uid === "local-sandbox") return next();
    const childId = String(req.body?.childId || req.params?.childId || "").trim();
    if (childId) {
      try {
        if (await consentStore.isActive(childId, purpose)) return next();
      } catch {
        /* fall through to 451 — fail closed */
      }
    }
    return res.status(451).json({ error: "Parental consent required.", purpose, consentRequired: true });
  };
}
