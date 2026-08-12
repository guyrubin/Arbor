import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import { PASTEL } from "../../lib/tokens";
import type { PaidPlan } from "../../lib/pricing";
import * as planclarity from "../../lib/i18nElevation/planclarity";

/**
 * Masterplan 3.6 — free-vs-Plus clarity: a tiny chip ("Plus" / "Family") shown
 * next to gated features, so a parent knows what's paid BEFORE tapping into a
 * 402. Parent register (calm PASTEL tones from the kit, no glass), aria-label
 * carries the full meaning ("Included with Arbor Plus") for screen readers.
 *
 * The plan can be given directly (`plan="plus"`) or resolved from a server
 * feature key (`feature="professionalReports"`) via {@link featurePlan}.
 */

/**
 * Client mirror of the ACTUAL gating in src/server/entitlements.ts PLAN_LIMITS —
 * nothing invented. Keys are exactly what the server names in 402 payloads
 * (`upgrade.feature` from requirePlusFeature / the coach meter) plus the two
 * limit-shaped gates the client already enforces (maxChildren in AddChildModal,
 * coParentSeats = the Family differentiator). Pinned to the server config by
 * PlanBadge.test.ts so this map can never drift from real entitlements.
 */
export const FEATURE_PLANS = {
  coach_unlimited: "plus", // src/server/aiQuota.ts 402 (daily coach meter)
  professionalReports: "plus", // requirePlusFeature("/api/generate-handoff")
  advancedPlans: "plus", // requirePlusFeature("/api/generate-plan")
  maxChildren: "plus", // AddChildModal limit gate (free = 1 child)
  coParentSeats: "family", // the only Family-over-Plus gate
} as const satisfies Record<string, PaidPlan>;

export type GatedFeatureKey = keyof typeof FEATURE_PLANS;

/** Which paid plan unlocks `featureKey` — null when the key isn't a known gate
 *  (unknown keys render NO badge rather than a wrong one). */
export function featurePlan(featureKey: string): PaidPlan | null {
  return (FEATURE_PLANS as Record<string, PaidPlan>)[featureKey] ?? null;
}

// Quiet, distinct tones: Plus = lavender (premium, not the primary green that
// means "yours already"), Family = coral (the kit's attention accent).
const BADGE_TONE: Record<PaidPlan, keyof typeof PASTEL> = { plus: "lav", family: "coral" };

/** Pure label lookups (node-testable without a React tree). */
export const badgeLabel = (plan: PaidPlan, lang: "en" | "he"): string =>
  (lang === "he" ? planclarity.he : planclarity.en)[`elev.plan.badge.${plan}`] ?? "";
export const badgeAria = (plan: PaidPlan, lang: "en" | "he"): string =>
  (lang === "he" ? planclarity.he : planclarity.en)[`elev.plan.badge.${plan}Aria`] ?? "";

export function PlanBadge({ plan, feature }: { plan?: PaidPlan; feature?: string }) {
  const { uiLang } = useLanguage();
  const resolved: PaidPlan | null = plan ?? (feature ? featurePlan(feature) : null);
  if (!resolved) return null;
  const label = badgeLabel(resolved, uiLang);
  const aria = badgeAria(resolved, uiLang);
  const p = PASTEL[BADGE_TONE[resolved]];
  return (
    <span
      aria-label={aria}
      title={aria}
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[var(--t-xs)] font-bold flex-shrink-0"
      style={{ background: p.soft, color: p.ink }}
    >
      {label}
    </span>
  );
}
