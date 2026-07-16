import { useMemo } from "react";
import { useArbor } from "../context/ArborContext";
import { ageMonthsFromProfile } from "../lib/childAge";
import { deriveMonitoring, type MonitoringResult } from "../lib/monitoring";

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
 * CLINICAL FIREWALL: returns watch/on-track signals for a parent-facing
 * "worth a conversation" nudge — never a diagnosis, score, or verdict.
 */
export function useMonitoring(): MonitoringResult {
  const { childProfile, milestones, behaviorLogs } = useArbor();

  const firstName = (childProfile.name || "your child").split(" ")[0];

  // Months-precise when the profile carries a birthDate/ageMonths, else the
  // legacy coarse year. monitoring.ts still takes fractional years.
  const ageMonthsPrecise = ageMonthsFromProfile(childProfile);
  const ageYears = ageMonthsPrecise !== null ? ageMonthsPrecise / 12 : (childProfile.age ?? 0);

  return useMemo(
    () => deriveMonitoring({ ageYears, milestones, behaviorLogs }, firstName),
    // Re-derive when the child's data changes; not time-sensitive within a session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ageYears, milestones.length, behaviorLogs.length, firstName],
  );
}
