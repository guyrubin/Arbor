import { hardMomentCards, type HardMomentCard } from "./hardMomentCards";
import type { ContentLocale } from "./governance";
import { hardMomentPublication, parseHardMomentAgeBand, type HardMomentContext, type PilotRelease } from "./pilotRelease";

/** Public browsing is generic: no profile, child name, record or account ID. */
export const PUBLIC_GUIDE_AGES = ["2-5", "6-9", "10-12"] as const;
export type PublicGuideAge = typeof PUBLIC_GUIDE_AGES[number];
export type PublicGuideQuery = { locale: ContentLocale; age: PublicGuideAge | null; id: string | null };

export function isPublicGuidePath(pathname: string): boolean {
  return pathname === "/guides" || pathname.startsWith("/guides/");
}

export function readPublicGuideQuery(pathname: string, search: string, browserLanguage = "en"): PublicGuideQuery {
  const params = new URLSearchParams(search);
  const language = params.get("lang") || browserLanguage;
  const locale = /^(he|iw)(-|$)/i.test(language) ? "he" : "en";
  const rawAge = params.get("age");
  const age = PUBLIC_GUIDE_AGES.find((value) => value === rawAge) ?? null;
  const rawId = pathname.replace(/^\/guides\/?/, "").replace(/\/$/, "");
  // Never render URL text as guide copy, or accept additional path segments.
  const id = rawId ? (/^[a-z-]+$/.test(rawId) ? rawId : "unavailable") : null;
  return { locale, age, id };
}

/** With no age filter this is an explicitly labelled, general age-band guide.
 * The same release policy still gates every card, including its copy digest,
 * individual review status, locale, withdrawal and pilot expiry. */
export function publicGuideContext(card: HardMomentCard, query: Pick<PublicGuideQuery, "locale" | "age">,
  now = new Date(), release?: PilotRelease): HardMomentContext {
  const band = parseHardMomentAgeBand(query.age ?? card.ageBands[0] ?? "");
  return { locale: query.locale, ageMonths: band?.startMonths, now, release };
}

export function publicGuideCards(query: Pick<PublicGuideQuery, "locale" | "age">, now = new Date(), release?: PilotRelease): HardMomentCard[] {
  // The original 25, not the later toddler/school catalogue expansion.
  return hardMomentCards.filter((card) => hardMomentPublication(card, publicGuideContext(card, query, now, release)) !== null);
}

/** A fresh URL is deliberately built from a tiny allow-list. Existing URL
 * query strings, attribution, names, child IDs and record IDs never carry over. */
export function publicGuidePath({ id, locale, age }: PublicGuideQuery): string {
  const safeId = id && hardMomentCards.some((card) => card.id === id) ? id : null;
  const params = new URLSearchParams({ lang: locale === "he" ? "he" : "en" });
  if (age && PUBLIC_GUIDE_AGES.includes(age)) params.set("age", age);
  return `/guides${safeId ? `/${safeId}` : ""}?${params.toString()}`;
}

export function publicGuideShareUrl(cardId: string, locale: ContentLocale, origin: string): string | null {
  if (!hardMomentCards.some((card) => card.id === cardId)) return null;
  const url = new URL(origin);
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return new URL(publicGuidePath({ id: cardId, locale, age: null }), url.origin).toString();
}
