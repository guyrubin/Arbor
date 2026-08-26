/* i18nElevation/agefilter — W0.7 age-filtered library strings: the per-surface
 * "Show all ages" toggle, the hidden-for-other-ages count, the small age chip
 * on out-of-band items, and the honest empty state when a whole catalog is
 * written for older children (e.g. Story Quests, all ages 4–8, for a baby).
 *
 * CLINICAL FIREWALL: every string states a fact about the CONTENT ("written
 * for ages 4–8"), never a verdict about the child ("too young", "behind").
 * Hebrew = transcreation in a calm Israeli-parent register; flagged for
 * arbor-localization native review.
 *
 * NOTE: not yet registered in i18nElevation/index.ts (owned elsewhere this
 * wave). Until registration, surfaces call agefilterText() below — same keys,
 * same {var} interpolation as t(), so the eventual index.ts registration is a
 * pure no-op for callers that migrate to t(). */

import { isolate } from "../bidi";

export const en: Record<string, string> = {
  // ── The per-surface toggle (role="switch"); off = child's-age view.
  "elev.agefilter.showAll": "Show all ages",

  // ── Quiet count next to the toggle when the default view hides items.
  "elev.agefilter.hiddenCount": "{n} more for other ages",

  // ── Small chip on an out-of-band item (a catalog fact, not a claim).
  "elev.agefilter.chip": "Ages {min}–{max}",
  "elev.agefilter.chipPlus": "Ages {min}+",

  // ── Honest empty state when everything on a surface is for other ages.
  "elev.agefilter.empty": "These are written for ages {min}–{max} — {name} will grow into them.",
};

export const he: Record<string, string> = {
  "elev.agefilter.showAll": "הצגת כל הגילים",

  "elev.agefilter.hiddenCount": "עוד {n} לגילים אחרים",

  "elev.agefilter.chip": "גילאי {min}–{max}",
  "elev.agefilter.chipPlus": "גילאי {min}+",

  "elev.agefilter.empty": "התכנים האלה נכתבו לגילאי {min}–{max} — {name} עוד יגדל אליהם.",
};

/**
 * Direct accessor used until this module is registered in i18nElevation/
 * index.ts (that file is owned by another workstream this wave). Same
 * "{var}" interpolation contract as lib/i18n translate(); missing key →
 * the key itself (the app-wide convention), missing var → left as-is.
 */
export function agefilterText(
  key: string,
  heMode: boolean,
  vars?: Record<string, string | number>,
): string {
  const dict = heMode ? he : en;
  const raw = dict[key] ?? en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? isolate(String(vars[name])) : match,
  );
}
