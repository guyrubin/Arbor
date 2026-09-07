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

  // ── Builder E2 · RUN-08 — the Story density's stat grid. One count per
  //    phrase (weekMomentCount), age-windowed milestone totals, and a teach
  //    line instead of "0 · 3/7 · 0/133" on a day-0 screen.
  "elev.childsignals.stat.moments": "Moments this week",
  "elev.childsignals.stat.planSteps": "Plan steps done",
  "elev.childsignals.stat.wins": "{count} closed this week",
  "elev.childsignals.stat.milestones": "Milestones noticed",
  "elev.childsignals.stat.zero": "Nothing in the story yet — capture one moment and it starts here.",

  // ── Builder E2 · TJB-23 — the Story density (#/timeline), whole. This screen
  //    ran on English literals: the page header, the story card and its
  //    provenance note, "Arbor noticed", the next-step sentences derived in
  //    signalTimeline, the memory queue (with "1 new facts"), the filters'
  //    empty state and the intensity aria-label. Law 7: both locales.
  "elev.childsignals.story.eyebrow": "My child",
  "elev.childsignals.story.title": "{name}'s story",
  "elev.childsignals.story.sub": "Every moment, milestone and plan in one place. Each entry feeds the next step Arbor suggests.",
  "elev.childsignals.story.weeklyCta": "This week's read",
  "elev.childsignals.story.cardTitle": "The story of {name}",
  "elev.childsignals.story.save": "Save the story",
  "elev.childsignals.story.builtFrom.one": "Built from 1 approved memory — only what you chose to keep.",
  "elev.childsignals.story.builtFrom.many": "Built from {count} approved memories — only what you chose to keep.",
  "elev.childsignals.story.noticed": "Arbor noticed",
  "elev.childsignals.story.intensityAria": "Intensity {n} of 5",
  "elev.childsignals.story.memory.title.one": "1 new fact to review",
  "elev.childsignals.story.memory.title.many": "{count} new facts to review",
  "elev.childsignals.story.memory.all": "Review all ({count})",
  "elev.childsignals.story.empty.head": "{name}'s story starts here",
  "elev.childsignals.story.empty.body": "Capture a moment, note a milestone, or start a plan — everything you keep flows into one timeline.",
  "elev.childsignals.story.empty.cta": "Capture the first moment",

  // ── The next-best-step sentences (lib/signalTimeline deriveNextStep). Counts
  //    of what the PARENT noticed, and a route — never a read on the child.
  "elev.childsignals.next.first": "{name}'s story starts with a single moment. Capture what happened today and Arbor takes it from there.",
  "elev.childsignals.next.firstCta": "Capture a moment",
  "elev.childsignals.next.pattern": "You logged {count} moments for {name} this week — most often “{type}”.",
  "elev.childsignals.next.patternWhere": "You logged {count} moments for {name} this week — most often “{type}”, usually at {where}.",
  "elev.childsignals.next.patternCta": "Ask Arbor about this",
  "elev.childsignals.next.patternPrompt": "This week {name} had several “{type}” moments{where}. What may be happening and what is one thing to try this week?",
  "elev.childsignals.next.milestones": "You have noticed {count} of {total} milestones for {name}. Keep noticing — small wins compound.",
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

  // ── Builder E2 · RUN-08
  "elev.childsignals.stat.moments": "רגעים השבוע",
  "elev.childsignals.stat.planSteps": "צעדים שהושלמו",
  "elev.childsignals.stat.wins": "{count} נסגרו השבוע",
  "elev.childsignals.stat.milestones": "אבני דרך שנצפו",
  "elev.childsignals.stat.zero": "עוד אין מה לספר — תיעוד של רגע אחד מתחיל את הסיפור.",

  // ── Builder E2 · TJB-23
  "elev.childsignals.story.eyebrow": "הילד/ה שלי",
  "elev.childsignals.story.title": "הסיפור של {name}",
  "elev.childsignals.story.sub": "כל רגע, אבן דרך ותוכנית במקום אחד. כל רשומה מזינה את הצעד הבא שארבור מציע.",
  "elev.childsignals.story.weeklyCta": "הקריאה של השבוע",
  "elev.childsignals.story.cardTitle": "הסיפור של {name}",
  "elev.childsignals.story.save": "לשמור את הסיפור",
  "elev.childsignals.story.builtFrom.one": "נבנה מתוך זיכרון אחד שאישרתם — רק מה שבחרתם לשמור.",
  "elev.childsignals.story.builtFrom.many": "נבנה מתוך {count} זיכרונות שאישרתם — רק מה שבחרתם לשמור.",
  "elev.childsignals.story.noticed": "ארבור שם לב",
  "elev.childsignals.story.intensityAria": "עוצמה {n} מתוך 5",
  "elev.childsignals.story.memory.title.one": "עובדה חדשה אחת לבדיקה",
  "elev.childsignals.story.memory.title.many": "{count} עובדות חדשות לבדיקה",
  "elev.childsignals.story.memory.all": "לבדוק הכל ({count})",
  "elev.childsignals.story.empty.head": "כאן מתחיל הסיפור של {name}",
  "elev.childsignals.story.empty.body": "תעדו רגע, סמנו אבן דרך או התחילו תוכנית — כל מה שתשמרו זורם לציר זמן אחד.",
  "elev.childsignals.story.empty.cta": "לתעד את הרגע הראשון",

  "elev.childsignals.next.first": "הסיפור של {name} מתחיל ברגע אחד. תעדו מה קרה היום וארבור ימשיך מכאן.",
  "elev.childsignals.next.firstCta": "לתעד רגע",
  "elev.childsignals.next.pattern": "תיעדתם {count} רגעים של {name} השבוע — לרוב “{type}”.",
  "elev.childsignals.next.patternWhere": "תיעדתם {count} רגעים של {name} השבוע — לרוב “{type}”, בדרך כלל ב{where}.",
  "elev.childsignals.next.patternCta": "לשאול את ארבור על זה",
  "elev.childsignals.next.patternPrompt": "השבוע היו ל{name} כמה רגעים של “{type}”{where}. מה אולי קורה ומה דבר אחד שכדאי לנסות השבוע?",
  "elev.childsignals.next.milestones": "שמתם לב ל-{count} מתוך {total} אבני דרך של {name}. המשיכו לשים לב — צעדים קטנים מצטברים.",
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
