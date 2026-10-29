/**
 * The /api rate limits.
 *
 * B-INF-16: one Sharing visit makes about nine /api reads (the app's boot reads
 * plus the roster), so the old single limit of 30 a minute per IP 429'd every call
 * on the fourth load in a minute, and families behind one address (a carrier NAT,
 * a school) shared those 30. The limits are now shaped by what they protect:
 *
 *  - apiRateLimit(), before auth, keyed on the IP:
 *      · a ceiling, not a budget: reads (GET/HEAD/OPTIONS) 600 a minute, writes
 *        120 a minute, so several families on one address never meet it;
 *      · the strict routes keep the old 30 a minute per IP, each group its own:
 *        paid model calls, invitations and sends that reach another person or an
 *        inbox, and exports (the child-data export and the book export manifest).
 *  - apiAccountRateLimit(), after auth, keyed on the verified uid (the IP when
 *    there is no account): 300 requests a minute per family member.
 *  - K2: the book-asset routes (the owner-checked file proxy, the sheet's PUT
 *    and commit, the narration routes) leave both for a per-ACCOUNT limit, mounted
 *    after auth inside their routers and keyed on the verified uid: reads 600 a
 *    minute (a book's first open fetches every private file at once), writes
 *    120 a minute (a sheet build uploads ~20 files). Env:
 *    BOOK_ASSET_READS_PER_MIN, BOOK_ASSET_WRITES_PER_MIN. /live/usage has its own
 *    per-account limit too (liveUsageRateLimit).
 *
 * All limits are in-memory per instance.
 */
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request, RequestHandler } from "express";

/** The book-asset routes, as seen under the /api mount. */
export const BOOK_ASSET_ROUTE = /^\/children\/[^/]+\/(?:book-assets\/[^/]+\/(?:file|commit)|book-narration|plan-narration)\/?$/;
export const isBookAssetRoute = (path: string): boolean => BOOK_ASSET_ROUTE.test(path);
/** Routes with a per-account limit of their own, outside the shared budgets. */
const ownAccountLimit = (req: Request) => isBookAssetRoute(req.path) || /^\/live\/usage\/?$/.test(req.path);

/** B-INF-16 budgets, requests a minute. */
export const API_READS_PER_IP_PER_MIN = 600;
export const API_WRITES_PER_IP_PER_MIN = 120;
export const API_PER_ACCOUNT_PER_MIN = 300;
export const STRICT_PER_IP_PER_MIN = 30;

/** The routes where abuse costs money or reaches someone: each group keeps 30 a minute per IP. */
export type StrictRouteGroup = "model" | "invite" | "export";
export const STRICT_ROUTES: Record<StrictRouteGroup, { methods: readonly string[]; path: RegExp }> = {
  // Every route that calls a paid model or mints a paid token (docs/architecture/ai-caller-inventory.md).
  model: { methods: ["POST"], path: /^\/(?:chat|council|voice|extract-log|vision|generate-[a-z-]+|conversation\/proposals|describe-child|analyze-behavior|digest|todays-focus|explain|tts|hero-pose|plans\/phrase|score-utterance|live\/(?:token|turn))\/?$/ },
  // Invitations and sends that reach another person or an inbox, and the one anonymous write.
  invite: { methods: ["POST"], path: /^\/(?:shares|co-parent\/invitations|digest\/email-send|waitlist)\/?$/ },
  // The child-data export and the book export manifest (the 3b critic's export-manifest route).
  export: { methods: ["GET", "HEAD"], path: /^\/(?:privacy\/export\/[^/]+|children\/[^/]+\/book-assets\/export-manifest)\/?$/ },
};
export function strictRouteGroup(method: string, path: string): StrictRouteGroup | null {
  for (const [group, route] of Object.entries(STRICT_ROUTES) as [StrictRouteGroup, (typeof STRICT_ROUTES)[StrictRouteGroup]][]) {
    if (route.methods.includes(method.toUpperCase()) && route.path.test(path)) return group;
  }
  return null;
}
const isRead = (req: Request) => ["GET", "HEAD", "OPTIONS"].includes(req.method);
const tooMany = (details: string, code: string) => ({ error: "Rate limit exceeded", code, details });

/** Before auth, keyed on the IP: the read and write ceilings and the strict route groups. */
export function apiRateLimit(): RequestHandler[] {
  const perIp = (limit: number, skip: (req: Request) => boolean, code: string, details: string) => rateLimit({
    windowMs: 60_000, limit, standardHeaders: true, legacyHeaders: false, skip, message: tooMany(details, code),
  });
  const wait = "Please wait a minute and try again.";
  return [
    perIp(API_READS_PER_IP_PER_MIN, (req) => ownAccountLimit(req) || !isRead(req), "api_ip_reads", `Too many Arbor requests from this IP. ${wait}`),
    perIp(API_WRITES_PER_IP_PER_MIN, (req) => ownAccountLimit(req) || isRead(req), "api_ip_writes", `Too many Arbor requests from this IP. ${wait}`),
    ...(Object.keys(STRICT_ROUTES) as StrictRouteGroup[]).map((group) =>
      perIp(STRICT_PER_IP_PER_MIN, (req) => strictRouteGroup(req.method, req.path) !== group, `api_${group}_rate`, `Too many ${group} requests from this IP. ${wait}`)),
  ];
}

/** After auth: one budget per family member (the verified uid), the IP when signed out. */
export function apiAccountRateLimit(limit = API_PER_ACCOUNT_PER_MIN): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit,
    keyGenerator: (req) => {
      const uid = (req as { user?: { uid?: string } }).user?.uid;
      return uid ? `uid:${uid}` : `ip:${ipKeyGenerator(req.ip ?? "")}`;
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: ownAccountLimit,
    message: tooMany("Too many Arbor requests from this account. Please wait a minute and try again.", "api_account_rate"),
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

/** Accounting must not consume the IP budget used by voice safety screens.
 * Mounted after authentication; still bounded per account to protect writes. */
export function liveUsageRateLimit(limit = 12): RequestHandler {
  return rateLimit({ windowMs: 60_000, limit, keyGenerator: uidKey,
    standardHeaders: true, legacyHeaders: false,
    message: { error: "Too many usage reports", code: "live_usage_rate" } });
}
