/**
 * usePrideMoment — wires the tested R3 pride-moment detector (growth/prideMoment.ts)
 * into the live app. Thin glue: reads the current DevScore from milestones, the prior
 * per-domain snapshot DevScoreCard already persists (`arbor.devscore.{id}`), and the
 * idempotency state (`arbor.pride.{id}`); surfaces at most ONE celebration to show.
 *
 * AADC: positive-only — a regression never fires (enforced in the detector). A fresh
 * user (no prior snapshot) celebrates nothing. Dismissing persists the crossing so it
 * never re-fires. No score number / no surname / no real face reaches the UI.
 */
import { useCallback, useMemo, useState } from "react";
import { useArbor } from "../context/ArborContext";
import { computeDevScore } from "../growth/devScore";
import {
  detectPrideCrossings,
  pickCelebration,
  mergeCrossings,
  type PrideState,
  type PrideCrossing,
} from "../growth/prideMoment";

const prideKey = (childId: string) => `arbor.pride.${childId}`;
const devscoreKey = (childId: string) => `arbor.devscore.${childId}`;

function loadPrideState(childId: string): PrideState {
  try {
    const raw = localStorage.getItem(prideKey(childId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.crossedThresholds)) {
        return {
          crossedThresholds: parsed.crossedThresholds,
          lastMilestoneCount: typeof parsed.lastMilestoneCount === "number" ? parsed.lastMilestoneCount : 0,
        };
      }
    }
  } catch {
    /* corrupt state — fall through to the empty default */
  }
  return { crossedThresholds: [], lastMilestoneCount: 0 };
}

/** The prior per-domain scores from the last persisted weekly snapshot, or null on
 *  first-ever (which the detector treats as "establish baseline, celebrate nothing"). */
function loadPriorByDomain(childId: string): Record<string, number> | null {
  try {
    const raw = localStorage.getItem(devscoreKey(childId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const snap = Array.isArray(parsed) ? parsed[parsed.length - 1] : parsed;
    const byDomain = snap?.byDomain;
    return byDomain && typeof byDomain === "object" ? (byDomain as Record<string, number>) : null;
  } catch {
    return null;
  }
}

export interface PrideMomentResult {
  crossing: PrideCrossing | null;
  firstName?: string;
  dismiss: () => void;
}

export function usePrideMoment(): PrideMomentResult {
  const { childProfile, milestones } = useArbor();
  const childId = childProfile?.id;
  const firstName = (childProfile?.name || "").split(" ")[0] || undefined;

  const checkedCount = useMemo(() => milestones.filter((m) => m.checked).length, [milestones]);
  const current = useMemo(
    () => computeDevScore(milestones.map((m) => ({ domain: m.domain, checked: m.checked }))),
    [milestones]
  );

  const [dismissed, setDismissed] = useState(false);

  const crossing = useMemo(() => {
    if (!childId) return null;
    const state = loadPrideState(childId);
    const priorByDomain = loadPriorByDomain(childId);
    const crossings = detectPrideCrossings({ current, priorByDomain, checkedCount, state, firstName });
    return pickCelebration(crossings);
  }, [childId, current, checkedCount, firstName]);

  const dismiss = useCallback(() => {
    if (childId && crossing) {
      try {
        const next = mergeCrossings(loadPrideState(childId), [crossing], checkedCount);
        localStorage.setItem(prideKey(childId), JSON.stringify(next));
      } catch {
        /* storage unavailable — worst case the celebration re-shows once */
      }
    }
    setDismissed(true);
  }, [childId, crossing, checkedCount]);

  return { crossing: dismissed ? null : crossing, firstName, dismiss };
}
