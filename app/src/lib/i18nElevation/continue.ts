/* i18nElevation/continue — masterplan 2.5: continuation strings for the
 * recommendation loops (Daily Play "next step" + Learn "continues what you
 * saved" why-line variant). Maytal Row-1 frame 5 ("ממשיך מכאן").
 *
 * HARD RULE (verification panel): continuation framing is ALWAYS an echo of
 * the parent's own report — "you said it helped" — never an AI efficacy
 * claim, never a grade. The EN string MUST contain "You said" and the HE
 * string MUST contain "אמרת" (test-pinned in continue.test.ts); no string in
 * this module may assert that an activity worked, improved anything, or
 * moved a score.
 *
 * Hebrew = calm Israeli-parent transcreation (outcome language, no AI/tech
 * framing); flagged for arbor-localization native review.
 *
 * NOTE: not yet registered in i18nElevation/index.ts (that file is owned by
 * another workstream this wave — same convention as childsignals.ts). Until
 * registration, surfaces resolve these keys via continueText()/
 * withContinuation() below — same keys, same {var} interpolation as t(), so
 * the eventual index.ts registration is a pure no-op for callers. */

import { isolate } from "../bidi";

export const en: Record<string, string> = {
  // ── Daily Play continuation line (mockup frame 5 "ממשיך מכאן").
  // Echo of the parent's own report on the LAST recommendation; the pick's
  // title renders directly below as the next step. Attribution mandatory.
  "elev.continue.play.helped": "You said this helped — the next step:",

  // ── Learn why-line variant: appended when saved reads' topics contributed
  // to the ranking. States the bookmark signal only — never an outcome.
  "elev.continue.learn.why": "Continues reads you saved.",
};

export const he: Record<string, string> = {
  "elev.continue.play.helped": "אמרת שזה עזר — הצעד הבא:",

  "elev.continue.learn.why": "ממשיך קריאות ששמרתם.",
};

/** Structural mirror of the app's t() — kept local so this module depends
 *  only on the lib/bidi leaf (never lib/i18n itself — that would be a cycle;
 *  same convention as i18nElevation/childsignals.ts). */
type Translate = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Direct accessor used until this module is registered in i18nElevation/
 * index.ts. Same "{var}" interpolation contract as lib/i18n translate();
 * missing key → the key itself (the app-wide convention), missing var →
 * left as-is.
 */
export function continueText(
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
 * Wrap the app's t() so `elev.continue.*` keys resolve from this module while
 * every other key keeps flowing through lib/i18n. Once the module registers
 * in index.ts, both paths yield identical strings.
 */
export function withContinuation(t: Translate, heMode: boolean): Translate {
  return (key, vars) =>
    key.startsWith("elev.continue.") ? continueText(key, heMode, vars) : t(key, vars);
}
