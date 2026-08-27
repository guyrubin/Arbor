/* i18nElevation/states — masterplan 4.3 (one state triad): strings for the
 * shared empty/loading states — the SectionSkeleton slow-path row and the
 * teach-empty copy on Journal / Comics / Plans + the Hero Journey start
 * feedback that previously shipped as a hardcoded "Loading…"/"טוען…" literal.
 *
 * COPY REGISTER (the 2025 teach-empty conventions, also documented on the
 * EmptyState component):
 *  - the empty state TEACHES: say what the filled state will hold and how the
 *    first item gets there — never just "nothing here";
 *  - exactly ONE clear next action per empty state;
 *  - encouraging, calm, forward-looking ("the story starts with one moment"),
 *    NEVER celebrating the zero itself (no confetti-toned "0 so far!");
 *  - counts and plain activity facts only — no %, verdicts, trend deltas
 *    (clinical firewall applies to empty copy too).
 * Hebrew = transcreation in the calm Israeli-parent register (plural address,
 * outcome language, no AI/tech framing); flagged for arbor-localization
 * native review.
 *
 * NOTE: not yet registered in i18nElevation/index.ts (owned elsewhere this
 * round). Until registration, surfaces resolve these keys via statesText()/
 * withStates() below — same keys, same {var} interpolation as t(), so the
 * eventual index.ts registration is a pure no-op for callers that migrate
 * to t(). */

import { isolate } from "../bidi";

export const en: Record<string, string> = {
  // ── SectionSkeleton slow path (~10s): compact inline row + retry.
  "elev.states.slow": "Still loading — this is taking longer than usual",
  "elev.states.retry": "Try again",

  // ── Hero Journey: in-card feedback while a chosen story is being prepared
  //    (replaces the hardcoded "Loading…" literal — an i18n violation).
  "elev.states.hero.opening": "Opening the story…",

  // ── Journal teach-empty: ghost of a filled day-group + one capture CTA.
  "elev.states.journal.head": "The story starts with one moment",
  "elev.states.journal.body":
    "Capture something small — a word, a laugh, a photo. Each saved moment becomes a day in {name}'s journal, and the days connect into the weekly story.",
  "elev.states.journal.cta": "Log the first moment",

  // ── Comics teach-empty: ghost bookshelf + one create CTA.
  "elev.states.comics.head": "Every adventure becomes a book",
  "elev.states.comics.body":
    "Pick an adventure and Arbor draws it into a whole comic book starring {name} — saved books line up on this shelf to read again and again.",
  "elev.states.comics.cta": "Make the first comic",

  // ── Plans teach-empty CTA (headline/body stay on the existing plan.empty.*
  //    keys in lib/i18n.ts — this only adds the missing single action).
  "elev.states.plans.cta": "Start the first plan",
};

export const he: Record<string, string> = {
  "elev.states.slow": "עדיין טוען — זה לוקח יותר זמן מהרגיל",
  "elev.states.retry": "לנסות שוב",

  "elev.states.hero.opening": "פותחים את הסיפור…",

  "elev.states.journal.head": "הסיפור מתחיל ברגע אחד",
  "elev.states.journal.body":
    "תעדו משהו קטן — מילה, צחוק, תמונה. כל רגע שנשמר הופך ליום ביומן של {name}, והימים מתחברים לסיפור השבועי.",
  "elev.states.journal.cta": "לתעד את הרגע הראשון",

  "elev.states.comics.head": "כל הרפתקה הופכת לספר",
  "elev.states.comics.body":
    "בחרו הרפתקה וארבור מצייר אותה לספר קומיקס שלם בכיכוב {name} — ספרים שנשמרים מסתדרים על המדף הזה לקריאה שוב ושוב.",
  "elev.states.comics.cta": "ליצור את הקומיקס הראשון",

  "elev.states.plans.cta": "להתחיל את התוכנית הראשונה",
};

/** Structural mirror of the app's t() — kept local so this module depends
 *  only on the lib/bidi leaf (never lib/i18n itself — that would be a cycle;
 *  same convention as i18nElevation/childsignals.ts). */
type Translate = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Direct accessor used until this module is registered in i18nElevation/
 * index.ts (that file is owned by another workstream this round). Same
 * "{var}" interpolation contract as lib/i18n translate(); missing key →
 * the key itself (the app-wide convention), missing var → left as-is.
 */
export function statesText(
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
 * Wrap the app's t() so `elev.states.*` keys resolve from this module while
 * every other key keeps flowing through lib/i18n. Once the module is
 * registered in index.ts, both paths yield identical strings.
 */
export function withStates(t: Translate, heMode: boolean): Translate {
  return (key, vars) =>
    key.startsWith("elev.states.") ? statesText(key, heMode, vars) : t(key, vars);
}
