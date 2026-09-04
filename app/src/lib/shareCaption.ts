/* shareCaption — ENG-16: the mislabelled play share, fixed honestly.
 *
 * THE MISLABEL
 * ────────────
 * components/overview/DailyPlayCard.tsx mounts <ShareButton artifact="growth_card"
 * surface="daily_play"> with no captionKey. ShareButton's fallback maps the
 * artifact union to a caption key, so `growth_card` resolved to
 * `share.caption.growth` — "{name}'s progress this month". A parent who
 * finished ONE ten-minute activity therefore shared a card captioned as a
 * MONTH OF PROGRESS about their child.
 *
 * That is not a copy nit. It is the clinical firewall failing at the one
 * surface that leaves the app: a single play was relabelled as a progress
 * claim, in public, in the parent's name. The card art was right; the sentence
 * under it was a claim nobody made.
 *
 * THE FIX
 * ───────
 * The caption key is resolved from (artifact, surface), not from the artifact
 * alone, and the growth_card fallback is REMOVED for play surfaces — they
 * resolve to `elev.share.caption.play` ("{name} played {title} today"), which
 * says exactly what happened and claims nothing else. Pure and tested here so
 * the rule cannot drift into a component; ShareButton simply calls it.
 *
 * This also fixes the mislabel WITHOUT editing DailyPlayCard: any surface that
 * shares a growth_card off a single activity gets the honest caption, today
 * and for every future mount.
 */

/** Share surfaces that represent ONE activity, not a period of progress. */
export const PLAY_SURFACES = ["daily_play", "daily-play", "play", "adventure"] as const;

/** The honest caption for a single completed activity (i18nElevation/firsts). */
export const PLAY_CAPTION_KEY = "elev.share.caption.play";

/** ShareButton's artifact union, restated locally to keep this module pure. */
export type CaptionArtifact = "avatar" | "story" | "answer_card" | "growth_card";

/** The artifact → key fallback, unchanged for every non-play surface. */
function artifactCaptionKey(artifact: CaptionArtifact): string {
  const key = artifact === "answer_card" ? "answer" : artifact === "growth_card" ? "growth" : artifact;
  return `share.caption.${key}`;
}

/** True when this surface shares a single activity rather than a period. */
export function isPlaySurface(surface: string | undefined): boolean {
  const s = (surface ?? "").trim().toLowerCase();
  return (PLAY_SURFACES as readonly string[]).includes(s);
}

/**
 * Resolve the caption key for a share.
 *  1. An explicit key from the call site always wins.
 *  2. A growth_card on a play surface gets the play caption — never the
 *     month-of-progress one.
 *  3. Everything else keeps the existing artifact fallback.
 */
export function resolveCaptionKey(args: {
  artifact: CaptionArtifact;
  surface?: string;
  captionKey?: string;
}): string {
  if (args.captionKey) return args.captionKey;
  if (args.artifact === "growth_card" && isPlaySurface(args.surface)) return PLAY_CAPTION_KEY;
  return artifactCaptionKey(args.artifact);
}
