/**
 * MOB-17 — the ONE public origin of the product.
 *
 * Every outward-facing URL (share cards, referral links, the native shell's
 * API base, universal/app links) derives from this constant. It used to be
 * spelled three different ways (`arborprd-westeu.web.app` in lib/share.ts and
 * lib/runtime.ts, the brand domain in MOBILE.md and the store metadata), so a
 * parent-mediated share landed on the hosting origin in Safari instead of the
 * brand domain the installed app claims. Pinned by lib/share.test.ts and
 * lib/nativeShellConfig.test.ts. Pure module: no runtime imports, safe in
 * tests and in the pure URL builders.
 */
export const PUBLIC_ORIGIN = "https://arborparentingapp.com";
export const PUBLIC_HOST = "arborparentingapp.com";

/** True when `url` points at the public origin (exact host, https only). */
export function isPublicOriginUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.host === PUBLIC_HOST;
  } catch {
    return false;
  }
}

export type AppRoute = {
  /** In-app hash route (`#/today`), or "" when the link carried no route (root / market home). */
  hash: string;
  /** The link's query string (`?ref=abc&utm_source=share`) — first-touch attribution input. */
  search: string;
};

/** Two-letter market prefixes the marketing site serves (`/il`, `/nl`) — not routes. */
const MARKET_PREFIX = /^\/[a-z]{2}(?=\/|$)/;

/**
 * Map an opened universal / app link to what the shell must do with it:
 *   https://arborparentingapp.com/il/?ref=abc#/today → { hash: "#/today", search: "?ref=abc" }
 *   https://arborparentingapp.com/journal            → { hash: "#/journal", search: "" }
 *   https://arborparentingapp.com/?utm_source=share  → { hash: "", search: "?utm_source=share" }
 * Returns null for any URL that is not on the public origin (a foreign link
 * must never steer the app), so the caller can ignore it.
 */
export function appUrlToRoute(url: string): AppRoute | null {
  if (!isPublicOriginUrl(url)) return null;
  const u = new URL(url);
  if (u.hash && u.hash !== "#" && u.hash !== "#/") return { hash: u.hash, search: u.search };
  const path = u.pathname.replace(MARKET_PREFIX, "").replace(/\/+$/, "");
  const segment = path.replace(/^\/+/, "");
  if (!segment || !/^[a-z0-9-]+$/i.test(segment)) return { hash: "", search: u.search };
  return { hash: `#/${segment}`, search: u.search };
}
