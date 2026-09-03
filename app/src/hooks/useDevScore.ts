import { useMemo } from "react";
import { useArbor } from "../context/ArborContext";
import { computeDevScore, type DevScore, type DevScoreSnapshot } from "../growth/devScore";
import { ageMonthsFromProfile } from "../lib/childAge";
import { ageWindowMilestones, comparisonAgeMonths } from "../lib/milestoneData";

/**
 * The ONE development-picture computation.
 *
 * Six surfaces independently ran the identical
 * `computeDevScore(milestones.map(m => ({domain: m.domain, checked: m.checked})))`
 * — Today, the Development hub, the Copilot, DevScoreCard, ScholarHubCard,
 * AcademyForYou and the pride-moment detector each re-deriving the same picture
 * from the same context data. Three of those render a "development picture"
 * screen, so the same child could be described by three separately-computed
 * results. This hook is the single derivation; a surface is a rendering of it.
 *
 * GP-08: the picture is computed over the child's AGE WINDOW (current corrected
 * CDC band + one earlier — lib/milestoneData.milestoneAgeWindow), never the
 * whole 0–6y catalogue. "x of y age-appropriate milestones noticed" is now true:
 * a 6-month-old's parent sees "0 of 14", not "0 of 133".
 *
 * `prior` is optional: only the snapshot-keeping surface (DevScoreCard) needs
 * the previous snapshot to compute deltas. Everything else reads focusDomain /
 * confidence / byDomain from the same pure result.
 *
 * CLINICAL FIREWALL: this returns counts and a descriptive focus domain — the
 * caller must never render it as a 0–100 verdict, ring, or deficit pointer.
 */
export function useDevScore(prior?: DevScoreSnapshot | null): DevScore {
  const { milestones, childProfile } = useArbor();
  const comparisonMonths = useMemo(() => {
    const chronoMonths = ageMonthsFromProfile(childProfile) ?? Math.round((childProfile.age || 0) * 12);
    return comparisonAgeMonths(chronoMonths, childProfile.preterm?.gestationalWeeks);
  }, [childProfile]);
  return useMemo(
    () =>
      computeDevScore(
        ageWindowMilestones(milestones, comparisonMonths).map((m) => ({ domain: m.domain, checked: m.checked })),
        prior,
      ),
    [milestones, comparisonMonths, prior],
  );
}
