/* i18nElevation/childsignals — masterplan 1.4/1.8: labels for child-activity
 * timeline signals (kind "practice") + the "Over the months" spine layer.
 *
 * Covers: the third provenance class ("child" — the chip shows the child's
 * first name, with a neutral fallback here), warm aggregated event titles per
 * child-activity type ("Completed 3 adventure scenes"), and the months-spine
 * strings (cumulative "by {month}" totals only).
 *
 * CLINICAL FIREWALL: every string names a COUNT or a plain activity fact —
 * never a percentage, verdict, trend delta, rate, or any month-vs-month
 * comparison. Cumulative (monotonic) totals only.
 * Hebrew = transcreation in a calm Israeli-parent register (outcome language,
 * no AI/tech framing); flagged for arbor-localization native review.
 *
 * NOTE: not yet registered in i18nElevation/index.ts (owned elsewhere this
 * wave). Until registration, surfaces resolve these keys via
 * childsignalsText()/withChildSignals() below — same keys, same {var}
 * interpolation as t(), so the eventual index.ts registration is a pure
 * no-op for callers that migrate to t(). */

import { isolate } from "../bidi";

export const en: Record<string, string> = {
  // ── Kind + filter labels for the "practice" signal kind.
  "elev.childsignals.kind": "Practice",
  "elev.childsignals.filter": "Practice",

  // ── Provenance chip fallback when the child has no name yet.
  "elev.childsignals.prov.fallback": "Child",

  // ── Warm aggregated event titles — one per activity type, count-aware.
  "elev.childsignals.title.practice.one": "Completed a practice game",
  "elev.childsignals.title.practice.many": "Completed {count} practice games",
  "elev.childsignals.title.speech.one": "Completed a speech practice round",
  "elev.childsignals.title.speech.many": "Completed {count} speech practice rounds",
  "elev.childsignals.title.mimic.one": "Completed a mimic-mirror round",
  "elev.childsignals.title.mimic.many": "Completed {count} mimic-mirror rounds",
  "elev.childsignals.title.adventure.one": "Completed an adventure scene",
  "elev.childsignals.title.adventure.many": "Completed {count} adventure scenes",
  "elev.childsignals.title.mission.one": "Completed a daily mission",
  "elev.childsignals.title.mission.many": "Completed {count} daily missions",
  "elev.childsignals.title.hero.one": "Finished a hero journey",
  "elev.childsignals.title.hero.many": "Finished {count} hero journeys",

  // ── "Over the months" spine — milestone crossings + cumulative totals only.
  "elev.childsignals.months.title": "Over the months",
  "elev.childsignals.months.by": "By {month}: {count} moments in the story",
  "elev.childsignals.months.showEarlier": "Show earlier months ({n})",
  "elev.childsignals.months.hideEarlier": "Show recent months only",
};

export const he: Record<string, string> = {
  "elev.childsignals.kind": "תרגול",
  "elev.childsignals.filter": "תרגול",

  "elev.childsignals.prov.fallback": "הילד",

  "elev.childsignals.title.practice.one": "הושלם משחק תרגול",
  "elev.childsignals.title.practice.many": "הושלמו {count} משחקי תרגול",
  "elev.childsignals.title.speech.one": "הושלם סבב תרגול דיבור",
  "elev.childsignals.title.speech.many": "הושלמו {count} סבבי תרגול דיבור",
  "elev.childsignals.title.mimic.one": "הושלם סבב במראת החיקוי",
  "elev.childsignals.title.mimic.many": "הושלמו {count} סבבים במראת החיקוי",
  "elev.childsignals.title.adventure.one": "הושלמה סצנת הרפתקה",
  "elev.childsignals.title.adventure.many": "הושלמו {count} סצנות הרפתקה",
  "elev.childsignals.title.mission.one": "הושלמה משימה יומית",
  "elev.childsignals.title.mission.many": "הושלמו {count} משימות יומיות",
  "elev.childsignals.title.hero.one": "הושלם מסע גיבורים",
  "elev.childsignals.title.hero.many": "הושלמו {count} מסעות גיבורים",

  "elev.childsignals.months.title": "לאורך החודשים",
  "elev.childsignals.months.by": "עד {month}: {count} רגעים בסיפור",
  "elev.childsignals.months.showEarlier": "להציג חודשים מוקדמים ({n})",
  "elev.childsignals.months.hideEarlier": "להציג רק את החודשים האחרונים",
};

/** Structural mirror of the app's t() — kept local so this module depends
 *  only on the lib/bidi leaf (never lib/i18n itself — that would be a cycle;
 *  same convention as i18nElevation/agefilter.ts). */
type Translate = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Direct accessor used until this module is registered in i18nElevation/
 * index.ts (that file is owned by another workstream this wave). Same
 * "{var}" interpolation contract as lib/i18n translate(); missing key →
 * the key itself (the app-wide convention), missing var → left as-is.
 */
export function childsignalsText(
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

/**
 * Wrap the app's t() so `elev.childsignals.*` keys resolve from this module
 * while every other key keeps flowing through lib/i18n. Lets the shared
 * signalTitle/signalDetail render path label the new "practice" kind without
 * touching i18nElevation/index.ts; once the module is registered, both paths
 * yield identical strings.
 */
export function withChildSignals(t: Translate, heMode: boolean): Translate {
  return (key, vars) =>
    key.startsWith("elev.childsignals.") ? childsignalsText(key, heMode, vars) : t(key, vars);
}
