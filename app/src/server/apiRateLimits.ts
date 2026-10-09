/**
 * The /api rate limits.
 *
 *  - apiRateLimit(): the global per-IP limit (30 a minute) on every /api route
 *    EXCEPT the book-asset routes. It runs before auth, so it can only key on
 *    the IP; families behind one address (a school, a carrier NAT) share it.
 *  - K2: the book-asset routes (the owner-checked file proxy, the sheet's PUT
 *    and commit, the narration route) leave it for a per-ACCOUNT limit, mounted
 *    after auth inside their routers and keyed on the verified uid: reads 600 a
 *    minute (a book's first open fetches every private file at once), writes
 *    120 a minute (a sheet build uploads ~20 files). Env:
 *    BOOK_ASSET_READS_PER_MIN, BOOK_ASSET_WRITES_PER_MIN. In-memory per
 *    instance, like the global limit.
 */
import rateLimit from "express-rate-limit";
import type { Request, RequestHandler } from "express";

/** The book-asset routes, as seen under the /api mount. */
export const BOOK_ASSET_ROUTE = /^\/children\/[^/]+\/(?:book-assets\/[^/]+\/(?:file|commit)|book-narration)\/?$/;
export const isBookAssetRoute = (path: string): boolean => BOOK_ASSET_ROUTE.test(path);

export const API_PER_IP_PER_MIN = 30;

export function apiRateLimit(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: API_PER_IP_PER_MIN,
    standardHeaders: true,
    legacyHeaders: false,
    // K2: the book-asset routes have their own per-account limit (bookAssetLimiter)
    skip: (req) => isBookAssetRoute(req.path),
    message: {
      error: "Rate limit exceeded",
      details: "Too many Arbor requests from this IP. Please wait a minute and try again."
    }
  });
}

const envNum = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return process.env[name] !== undefined && Number.isFinite(v) && v > 0 ? v : fallback;
};
export const bookAssetRates = () => ({
  reads: envNum("BOOK_ASSET_READS_PER_MIN", 600),
  writes: envNum("BOOK_ASSET_WRITES_PER_MIN", 120),
});

const uidKey = (req: Request): string => (req as { user?: { uid?: string } }).user?.uid || "local-sandbox";

/** The per-account limit of the book-asset routes (after auth: keyed on the uid). */
export function bookAssetLimiter(kind: "read" | "write", limit?: number): RequestHandler {
  const rates = bookAssetRates();
  return rateLimit({
    windowMs: 60_000,
    limit: limit ?? (kind === "read" ? rates.reads : rates.writes),
    keyGenerator: uidKey,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many book requests. Please wait a minute.", code: "book_assets_rate" },
  });
}
