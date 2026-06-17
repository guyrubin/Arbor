/**
 * First-touch attribution for the growth loop (P0-2 / P0-4).
 *
 * Captures where a visitor came from — referral code, UTM params, source host —
 * and which market, then persists it FIRST-TOUCH: the acquiring visit wins, so a
 * later organic re-open never overwrites the channel that brought the user in.
 * The captured attribution is exposed as global props on every analytics event
 * (see lib/analytics.ts `setGlobalProps`), so activation/retention is sliceable
 * by source and market.
 *
 * No third-party scripts; all client-side, mirroring the privacy stance of
 * lib/analytics.ts. The pure functions here are unit-tested in attribution.test.ts.
 */

export type Market = "il" | "nl" | "be" | "ie" | "uk" | "intl";

export type Attribution = {
  referralCode?: string;
  source: string; // utm_source | referrer host | "referral" | "direct"
  market: Market;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  landingAt: string; // ISO of first touch
};

const LS_ATTRIBUTION = "arbor.attribution";

const MARKET_PATHS: Record<string, Market> = { il: "il", nl: "nl", be: "be", ie: "ie", uk: "uk" };

/** Market from the URL path prefix (/il, /nl, …), falling back to UI language, then "intl". */
export function detectMarket(pathname: string, lang: string | undefined): Market {
  const seg = pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  if (seg && MARKET_PATHS[seg]) return MARKET_PATHS[seg];
  const l = (lang || "").toLowerCase();
  if (l.startsWith("he")) return "il";
  if (l.startsWith("nl")) return "nl";
  return "intl";
}

function hostFromReferrer(referrer: string | undefined, currentHost: string | undefined): string | undefined {
  if (!referrer) return undefined;
  try {
    const h = new URL(referrer).hostname.replace(/^www\./, "");
    if (!h || h === currentHost) return undefined; // ignore same-site navigation
    return h;
  } catch {
    return undefined;
  }
}

/** Pure parse of a fresh visit's attribution from URL + referrer. */
export function parseAttribution(
  search: string,
  pathname: string,
  lang: string | undefined,
  referrer: string | undefined,
  currentHost: string | undefined,
  nowIso: string,
): Attribution {
  const p = new URLSearchParams(search || "");
  const ref = p.get("ref") || p.get("referral") || undefined;
  const utmSource = p.get("utm_source") || undefined;
  // source priority: explicit utm_source > inferred referrer host > "referral" (had a ?ref) > "direct"
  const source = utmSource || hostFromReferrer(referrer, currentHost) || (ref ? "referral" : "direct");
  return {
    referralCode: ref,
    source,
    market: detectMarket(pathname, lang),
    utmSource,
    utmMedium: p.get("utm_medium") || undefined,
    utmCampaign: p.get("utm_campaign") || undefined,
    utmContent: p.get("utm_content") || undefined,
    utmTerm: p.get("utm_term") || undefined,
    landingAt: nowIso,
  };
}

/** Flatten attribution into analytics props (drops undefined, prefixes utm_). */
export function attributionProps(a: Attribution | null): Record<string, unknown> {
  if (!a) return {};
  const out: Record<string, unknown> = { market: a.market, source: a.source };
  if (a.referralCode) out.referral_code = a.referralCode;
  if (a.utmSource) out.utm_source = a.utmSource;
  if (a.utmMedium) out.utm_medium = a.utmMedium;
  if (a.utmCampaign) out.utm_campaign = a.utmCampaign;
  if (a.utmContent) out.utm_content = a.utmContent;
  if (a.utmTerm) out.utm_term = a.utmTerm;
  return out;
}

/** Read the persisted first-touch attribution (browser only). */
export function loadAttribution(): Attribution | null {
  try {
    const raw = localStorage.getItem(LS_ATTRIBUTION);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}

/**
 * Capture + persist attribution first-touch. If a prior visit is already stored,
 * it wins and is returned unchanged; otherwise the current URL/referrer is parsed,
 * stored, and returned. Browser-only; safe to call once at startup.
 */
export function captureAttribution(): Attribution {
  const existing = loadAttribution();
  if (existing) return existing;
  const attr = parseAttribution(
    location.search,
    location.pathname,
    document.documentElement.lang,
    document.referrer,
    location.hostname,
    new Date().toISOString(),
  );
  try {
    localStorage.setItem(LS_ATTRIBUTION, JSON.stringify(attr));
  } catch {
    /* ignore */
  }
  return attr;
}
