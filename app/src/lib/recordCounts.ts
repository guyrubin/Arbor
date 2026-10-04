/* W2-CAREPRO r2 — counts from the record (pure; law 1: numerators only).
 * Shared by #/reports (B-CAREPRO-NEW-2e lead line) and Consult's step-2 head. */
import type { BehaviorLog, Milestone } from "../types";

const WEEK_MS = 7 * 86_400_000;

/** B-CAREPRO-NEW-2e — the lead line's counts, numerators only: moments logged
 *  and milestones the parent marked since the last save (else this week). No
 *  denominator, no delta, no direction word. */
export function reportsLeadCounts(input: {
  logs: readonly Pick<BehaviorLog, "timestamp">[];
  milestones: readonly Pick<Milestone, "checked" | "observationUpdatedAt">[];
  sinceIso: string | null;
  nowMs: number;
}): { moments: number; milestones: number; sinceMs: number } {
  const since = input.sinceIso ? new Date(input.sinceIso).getTime() : NaN;
  const sinceMs = Number.isFinite(since) ? since : input.nowMs - WEEK_MS;
  const after = (iso?: string) => {
    const t = iso ? new Date(iso).getTime() : NaN;
    return Number.isFinite(t) && t > sinceMs && t <= input.nowMs;
  };
  return {
    moments: input.logs.filter((l) => after(l.timestamp)).length,
    milestones: input.milestones.filter((m) => m.checked && after(m.observationUpdatedAt)).length,
    sinceMs,
  };
}

