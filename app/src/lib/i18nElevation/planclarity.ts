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
  "elev.plan.free.3": "One child profile, with free co-parent sharing",
  "elev.plan.plusTitle": "Arbor Plus adds",
  "elev.plan.plus.1": "Coaching without the daily limit",
  // B-CAREPRO-08: every packet and PDF is free (built client-side, no gate);
  // the ONE Plus gate in Care is /api/generate-handoff (professionalReports),
  // the AI-drafted School Brief. The bullet sells what the gate guards.
  "elev.plan.plus.2": "AI-drafted school notes",
  "elev.plan.plus.3": "Advanced growth plans",
  "elev.plan.plus.4": "Up to six children",
  "elev.plan.familyTitle": "Existing Arbor Family subscriptions",
  // Existing Family subscribers retain Plus features; sharing is never sold
  // as a paid differentiator now that same-child co-parent access is free.
  "elev.plan.family.1": "Includes all Plus features. Co-parent sharing is free on every plan, revocable any time",

  // ── Paywall body for the professionalReports gate (B-CAREPRO-08) ──────────
  "elev.plan.pw.bodySchoolNotes": "AI-drafted school notes are part of Arbor Plus. Upgrade and Arbor drafts the note for your child's teacher.",
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
  "elev.plan.free.3": "פרופיל ילד אחד, עם שיתוף חינמי להורה נוסף",
  "elev.plan.plusTitle": "ארבור פלוס מוסיף",
  "elev.plan.plus.1": "אימון בלי המכסה היומית",
  "elev.plan.plus.2": "מסמכים לגן ולבית הספר שארבור מנסח בשבילכם",
  "elev.plan.plus.3": "תוכניות צמיחה מתקדמות",
  "elev.plan.plus.4": "עד שישה ילדים",
  "elev.plan.familyTitle": "מנויי ארבור משפחה קיימים",
  "elev.plan.family.1": "כולל את כל יכולות פלוס. שיתוף עם הורה נוסף זמין ללא תשלום בכל מסלול, וניתן לבטל בכל רגע",

  // ── Paywall body (he) ──────────────────────────────────────────────────────
  "elev.plan.pw.bodySchoolNotes": "מסמכים לגן ולבית הספר שארבור מנסח הם חלק מארבור פלוס. שדרגו וארבור ינסח את המסמך לצוות החינוכי.",
};
