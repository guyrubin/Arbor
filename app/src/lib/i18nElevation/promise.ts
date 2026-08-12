/* i18nElevation/promise — masterplan 1.6 "first-run promise" + 1.5 spine
 * variants (mockup translation doc Row-2 #2, de-jargoned).
 *
 * One screenful at the end of onboarding (the final card of the Ready step):
 * the one-sentence promise, the three rhythms (daily / weekly / over months),
 * and the data-lock line. NO "AI-powered" language anywhere — the promise is
 * stated as what Arbor DOES for the parent, never how.
 *
 * CLINICAL FIREWALL: plain activity facts and commitments only — no scores,
 * verdicts, or diagnostic framing.
 * Hebrew = transcreation in a calm Israeli-parent register; the lock line
 * ships VERBATIM from the mockup ("המידע שלכם מאובטח — לא משתפים מידע אישי").
 * Flagged for arbor-localization native review.
 *
 * NOTE: deliberately NOT registered in i18nElevation/index.ts (that file is
 * owned by another workstream this wave — same standing arrangement as
 * agefilter.ts). Until registration, surfaces call promiseText() below —
 * same keys, same {var} interpolation as t(), so an eventual index.ts
 * registration is a pure no-op for callers that migrate to t(). */

export const en: Record<string, string> = {
  // ── Card header (quiet eyebrow above the promise sentence).
  "elev.promise.eyebrow": "What happens next",

  // ── The one-sentence promise (de-jargoned; the whole pitch in one line).
  "elev.promise.headline":
    "Arbor follows {name}'s journey and gives you one clear thing to do each day",

  // ── The three rhythms: label + one plain sentence each.
  "elev.promise.daily.label": "Every day",
  "elev.promise.daily": "One clear thing to try with {name}",
  "elev.promise.weekly.label": "Every week",
  "elev.promise.weekly": "A summary of your week together",
  "elev.promise.months.label": "Over the months",
  "elev.promise.months": "The story of {name}, as it unfolds",

  // ── Data-lock line (Row-2 #2 green lock; EN mirrors the verbatim HE line).
  "elev.promise.lock": "Your information is secure — personal details are never shared",
};

export const he: Record<string, string> = {
  "elev.promise.eyebrow": "מה קורה מעכשיו",

  "elev.promise.headline":
    "Arbor מלווה את המסע של {name} ונותן לכם דבר אחד ברור לעשות בכל יום",

  "elev.promise.daily.label": "כל יום",
  "elev.promise.daily": "דבר אחד ברור לנסות עם {name}",
  "elev.promise.weekly.label": "כל שבוע",
  "elev.promise.weekly": "סיכום של השבוע שלכם יחד",
  "elev.promise.months.label": "לאורך החודשים",
  "elev.promise.months": "הסיפור של {name}, כפי שהוא נכתב",

  // Verbatim from the mockup — do not "improve".
  "elev.promise.lock": "המידע שלכם מאובטח — לא משתפים מידע אישי",
};

/**
 * Direct accessor used until this module is registered in i18nElevation/
 * index.ts (owned by another workstream — same contract as agefilterText).
 * Same "{var}" interpolation as lib/i18n translate(); missing key → the key
 * itself (the app-wide convention), missing var → left as-is.
 */
export function promiseText(
  key: string,
  heMode: boolean,
  vars?: Record<string, string | number>,
): string {
  const dict = heMode ? he : en;
  const raw = dict[key] ?? en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}
