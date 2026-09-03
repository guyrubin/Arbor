import { useMemo } from "react";
import { useArbor } from "../context/ArborContext";
import { deriveMonitoring, monitoringAgeYears, type MonitoringResult } from "../lib/monitoring";

/**
 * The ONE "worth keeping an eye on" derivation.
 *
 * Three surfaces each called `deriveMonitoring({ageYears, milestones,
 * behaviorLogs}, firstName)` over the same context data — the Screening/
 * Development Check, the ArborNoticed card and the notification bell — and two
 * of them separately re-implemented the months-precise age conversion.
 *
 * That divergence was a real defect, not just duplication: ArborNoticedCard and
 * useNotifications fed a months-precise age (a 9-month-old → 0.75) while
 * Screening passed the coarse `childProfile.age` (→ 0), so the SAME child could
 * get a different watch answer depending on which surface asked. Centralising
 * the input here makes every surface answer the question identically.
 *
 * GP-04: the age is the CORRECTED (preterm-adjusted) months — the same
 * comparison age the Milestones map and the Development Check use — via
 * `monitoringAgeYears` in lib/monitoring.ts (pure, unit-tested). A 15-month-old
 * born at 28 weeks is never flagged against the 12-month band on the same page
 * that promises corrected-age comparison.
 *
 * CLINICAL FIREWALL: returns watch/on-track signals for a parent-facing
 * "worth a conversation" nudge — never a diagnosis, score, or verdict.
 */
export function useMonitoring(): MonitoringResult {
  const { childProfile, milestones, behaviorLogs } = useArbor();

  const firstName = (childProfile.name || "your child").split(" ")[0];

  const ageYears = monitoringAgeYears(childProfile);

  return useMemo(
    () => deriveMonitoring({ ageYears, milestones, behaviorLogs }, firstName),
    // Re-derive when the child's data changes; not time-sensitive within a session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ageYears, milestones.length, behaviorLogs.length, firstName],
  );
}
