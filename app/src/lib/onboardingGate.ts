import type { ChildProfile } from "../types";

/**
 * P0.4 — explicit onboarding completion gate (pure, dependency-free so it is unit
 * testable in the node test env).
 *
 * The legacy gate was "show onboarding iff the account has zero children", so the
 * profile created at Step 2 of the flow immediately satisfied it and an interrupted
 * setup dropped the parent into a half-configured app. These helpers add an explicit
 * `onboardingComplete` flag instead.
 *
 * STRICT EQUALITY IS LOAD-BEARING: the entire existing production population has
 * child docs with NO `onboardingComplete` field. We must treat ABSENT as complete,
 * so we check `=== false` (only the explicitly in-flight ones), never the falsy
 * `!onboardingComplete` (which would force every existing user back into onboarding
 * and let them create duplicate children).
 */
export function findIncompleteOnboardingChild(profiles: ChildProfile[]): ChildProfile | null {
  return profiles.find((p) => p.onboardingComplete === false) ?? null;
}

/**
 * Onboarding is needed when a signed-in (firestore-backed), loaded account has no
 * children yet, OR has a child whose onboarding is explicitly unfinished (so the
 * flow resumes instead of stranding a half-configured profile). Legacy records
 * (no flag) never trigger this.
 */
export function computeNeedsOnboarding(useFirestore: boolean, loading: boolean, profiles: ChildProfile[]): boolean {
  return useFirestore && !loading && (profiles.length === 0 || findIncompleteOnboardingChild(profiles) !== null);
}
