/**
 * usePrideMoment — wires the tested R3 pride-moment detector (growth/prideMoment.ts)
 * into the live app. Thin glue: reads the count of milestones the parent has
 * noticed and the idempotency state (`arbor.pride.{id}`); surfaces at most ONE
 * celebration to show.
 *
 * B-GROWTH-06: no DevScore and no `arbor.devscore.{id}` snapshot any more — the
 * per-domain SCORE crossings were a celebrated percentage grade of the child.
 * Only the parent-noticed count can cross a threshold now.
 *
 * AADC: positive-only — a regression never fires (enforced in the detector). A
 * fresh family celebrates nothing: the first non-zero count is recorded silently
 * as the baseline. Dismissing persists the crossing so it never re-fires. No
 * score number / no surname / no real face reaches the UI.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useArbor } from "../context/ArborContext";
import {
  detectPrideCrossings,
  pickCelebration,
  mergeCrossings,
  type PrideState,
  type PrideCrossing,
} from "../growth/prideMoment";

const prideKey = (childId: string) => `arbor.pride.${childId}`;

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

  const [dismissed, setDismissed] = useState(false);

  // The baseline: the first non-zero noticed count is recorded silently, so a
  // family arriving with history is never shown a burst of old crossings.
  useEffect(() => {
    if (!childId || checkedCount <= 0) return;
    const state = loadPrideState(childId);
    if ((state.lastMilestoneCount ?? 0) > 0) return;
    try {
      localStorage.setItem(prideKey(childId), JSON.stringify({ ...state, lastMilestoneCount: checkedCount }));
    } catch {
      /* storage unavailable — no baseline, so nothing celebrates (fail quiet) */
    }
  }, [childId, checkedCount]);

  const crossing = useMemo(() => {
    if (!childId) return null;
    const state = loadPrideState(childId);
    const crossings = detectPrideCrossings({ checkedCount, state, firstName });
    return pickCelebration(crossings);
  }, [childId, checkedCount, firstName]);

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
