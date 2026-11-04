/**
 * COST-2: per-request context for token-usage attribution.
 *
 * AsyncLocalStorage carries the request id and authenticated uid through the
 * async call chain so the AI providers (which never see the Express `req`) can
 * stamp every `ai.usage` log line with who/which-request spent the tokens —
 * without threading a callback through dozens of model call sites.
 */
import { AsyncLocalStorage } from "async_hooks";
import type { RequestHandler } from "express";

export type RequestContext = { requestId: string; uid: string | null; familyId: string | null };

/** An account or family id. Names, spaces and Hebrew do not pass. */
export function costId(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(value) ? value : null;
}

/** Stamp the family once a paid route has resolved it. Ignored when it is not an id. */
export function bindFamilyId(familyId: unknown): void {
  const ctx = storage.getStore();
  const id = costId(familyId);
  if (ctx && id) ctx.familyId = id;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** The active request context, if any (undefined outside a request, e.g. startup). */
export const currentRequestContext = (): RequestContext | undefined => storage.getStore();

/**
 * Runs all downstream handlers inside a fresh per-request context. Place AFTER
 * `requestObservability` (which sets `arborRequestId`) so the id is available.
 */
export const requestContextMiddleware: RequestHandler = (req, res, next) => {
  const ctx: RequestContext = {
    requestId: (req as any).arborRequestId || "unknown",
    uid: (req as any).user?.uid || null,
    familyId: null,
  };
  storage.run(ctx, () => next());
};

/** Copies the resolved identity into the active context. Place AFTER the auth middleware. */
export const bindUidToContext: RequestHandler = (req, res, next) => {
  const ctx = storage.getStore();
  if (ctx) ctx.uid = (req as any).user?.uid || null;
  next();
};
