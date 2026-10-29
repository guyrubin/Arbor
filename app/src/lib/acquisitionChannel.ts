/**
 * BD-37 — the acquisition channel a household's first-touch `source` belongs
 * to. Pure: no Firebase, no React. The cohort reader groups the household
 * line and the metric contract by it (server/cohortMetrics.ts; the script
 * restates it and the guard pins the two on one table).
 *
 * The raw `source` is lib/attribution.ts's first touch: `utm_source`, else the
 * referring host, else "referral" (a parent's ?ref= invite), else "direct".
 * The canonical `utm_source` values live in public/marketing/utm-scheme.md.
 *
 * Kept apart, never merged (ROS BD-37): content, search and direct; each
 * partner kind (practitioner, centre, presenter, sponsor); the Kids Studio
 * channel (`studio`, retained where used); founding invitations; a parent's
 * invite; the app stores. Anything else is `other`, never guessed into a
 * partner channel. A channel is about the PARENT who arrived; a child's views
 * in Kid Mode are play, not paid parent demand, and never move a household.
 */

export const ACQUISITION_CHANNELS = [
  "practitioner",
  "centre",
  "presenter",
  "sponsor",
  "studio",
  "founding",
  "referral",
  "content",
  "search",
  "store",
  "direct",
  "other",
] as const;
export type AcquisitionChannel = (typeof ACQUISITION_CHANNELS)[number];

/** utm_source values that ARE their channel (the partner kinds, studio, founding, a parent's invite). */
const SELF_NAMED = new Set<AcquisitionChannel>(["practitioner", "centre", "presenter", "sponsor", "studio", "founding", "referral", "direct"]);
/** Canonical content sources (utm-scheme.md) and the referring hosts they arrive from. */
const CONTENT_SOURCES = new Set(["instagram", "tiktok", "youtube", "facebook", "whatsapp", "telegram", "creator", "pr", "newsletter", "landing", "qr"]);
const CONTENT_HOST = /(^|\.)(instagram\.com|facebook\.com|fb\.com|tiktok\.com|youtube\.com|youtu\.be|whatsapp\.com|wa\.me|t\.me|telegram\.org|linkedin\.com|lnkd\.in|t\.co|x\.com|twitter\.com|reddit\.com|pinterest\.com)$/;
const SEARCH_HOST = /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com|yahoo\.com|ecosia\.org|yandex\.[a-z.]+|baidu\.com|search\.brave\.com)$/;
const STORE_SOURCES = new Set(["appstore", "playstore", "apps.apple.com", "play.google.com"]);

/** The channel of one raw first-touch source. Case and surrounding space are ignored. */
export function channelOfSource(source: string | null | undefined): AcquisitionChannel {
  const s = String(source ?? "").trim().toLowerCase();
  if (!s) return "other";
  if (SELF_NAMED.has(s as AcquisitionChannel)) return s as AcquisitionChannel;
  if (CONTENT_SOURCES.has(s) || CONTENT_HOST.test(s)) return "content";
  if (STORE_SOURCES.has(s)) return "store";
  if (SEARCH_HOST.test(s)) return "search";
  return "other";
}
