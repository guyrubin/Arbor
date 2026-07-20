import { useMemo } from "react";
import { useArbor } from "../context/ArborContext";
import { computeDevScore, type DevScore, type DevScoreSnapshot } from "../growth/devScore";

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
 * `prior` is optional: only the snapshot-keeping surface (DevScoreCard) needs
 * the previous snapshot to compute deltas. Everything else reads focusDomain /
 * confidence / byDomain from the same pure result.
 *
 * CLINICAL FIREWALL: this returns counts and a descriptive focus domain — the
 * caller must never render it as a 0–100 verdict, ring, or deficit pointer.
 */
export function useDevScore(prior?: DevScoreSnapshot | null): DevScore {
  const { milestones } = useArbor();
  return useMemo(
    () => computeDevScore(milestones.map((m) => ({ domain: m.domain, checked: m.checked })), prior),
    [milestones, prior],
  );
}
