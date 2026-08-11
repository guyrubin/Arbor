/* Masterplan 3.6 — free-vs-Plus clarity strings (PaywallModal split + PlanBadge).
 * Mom-test finding: "what's free vs paid?" was unanswerable in-app. These keys
 * state the split plainly, in outcome language — no price literals here (prices
 * stay in lib/pricing.ts, pinned to the server by pricing.test.ts).
 *
 * Bullet contents mirror src/server/entitlements.ts PLAN_LIMITS (free/plus/family)
 * and are pinned by PlanBadge.test.ts so copy can't drift from real gating.
 *
 * Hebrew = calm Israeli-parent transcreation (plural address, outcome language,
 * no AI/tech framing); flagged for arbor-localization native review.
 *
 * NOTE: not yet registered in ./index.ts (that file is owned elsewhere this
 * wave). PaywallModal and PlanBadge import this module directly, so the strings
 * work today; the one-line index registration only additionally exposes them
 * through t(). */

export const en: Record<string, string> = {
  // ── PlanBadge chip (label + accessible meaning) ────────────────────────────
  "elev.plan.badge.plus": "Plus",
  "elev.plan.badge.family": "Family",
  "elev.plan.badge.plusAria": "Included with Arbor Plus",
  "elev.plan.badge.familyAria": "Included with Arbor Family",

  // ── PaywallModal split: what's free, what each paid plan adds ──────────────
  "elev.plan.freeTitle": "Always free",
  "elev.plan.free.1": "Journal, milestones, and daily plays",
  "elev.plan.free.2": "Coach messages every day, up to the daily limit",
  "elev.plan.free.3": "One child profile",
  "elev.plan.plusTitle": "Arbor Plus adds",
  "elev.plan.plus.1": "Coaching without the daily limit",
  "elev.plan.plus.2": "Professional reports and school handoffs",
  "elev.plan.plus.3": "Advanced growth plans",
  "elev.plan.plus.4": "Up to six children",
  "elev.plan.familyTitle": "Arbor Family adds",
  "elev.plan.family.1": "Everything in Plus, plus a seat for a co-parent",
};

export const he: Record<string, string> = {
  // ── PlanBadge chip (he) ────────────────────────────────────────────────────
  "elev.plan.badge.plus": "פלוס",
  "elev.plan.badge.family": "משפחה",
  "elev.plan.badge.plusAria": "כלול בארבור פלוס",
  "elev.plan.badge.familyAria": "כלול בארבור משפחה",

  // ── PaywallModal split (he) ────────────────────────────────────────────────
  "elev.plan.freeTitle": "תמיד בחינם",
  "elev.plan.free.1": "יומן, אבני דרך ומשחקים יומיים",
  "elev.plan.free.2": "הודעות מאמן בכל יום, עד המכסה היומית",
  "elev.plan.free.3": "פרופיל ילד אחד",
  "elev.plan.plusTitle": "ארבור פלוס מוסיף",
  "elev.plan.plus.1": "אימון בלי המכסה היומית",
  "elev.plan.plus.2": "דוחות מקצועיים והעברות לגן ולבית הספר",
  "elev.plan.plus.3": "תוכניות צמיחה מתקדמות",
  "elev.plan.plus.4": "עד שישה ילדים",
  "elev.plan.familyTitle": "ארבור משפחה מוסיף",
  "elev.plan.family.1": "כל מה שבפלוס, בתוספת מושב להורה שותף",
};
