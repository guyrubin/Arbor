/**
 * lib/plans/useAutoPaint — the React side of lib/plans/autoPaint: the
 * composer mounts it with `enabled` = the server's `admin` flag. Disabled, it
 * never calls a route and never reports.
 */
import { useEffect, useState } from "react";
import { startAutoPaint, type AutoPaintState } from "./autoPaint";
import { fetchPlanPlateStatus, paintPlanPlates } from "./planApi";
import type { PatternId } from "../library/types";

const IDLE: AutoPaintState = { painting: false, done: 0, total: 0 };

export function useAutoPaint(pattern: PatternId, enabled: boolean, initial: AutoPaintState = IDLE): AutoPaintState {
  const [state, setState] = useState<AutoPaintState>(initial);
  useEffect(() => {
    if (!enabled) return;
    return startAutoPaint(pattern, setState, { fetchStatus: fetchPlanPlateStatus, paint: paintPlanPlates });
  }, [pattern, enabled]);
  return state;
}
