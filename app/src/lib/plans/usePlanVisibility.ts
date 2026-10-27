/**
 * lib/plans/usePlanVisibility — B-KID-167: the server's visibility table,
 * read once per session (never decided on the device). Null until it
 * arrives or when the server cannot be reached: no door renders then.
 */
import { useEffect, useState } from "react";
import { fetchPlanVisibility, type PlanVisibility } from "./planApi";

let cached: PlanVisibility | null = null;
let inflight: Promise<PlanVisibility | null> | null = null;

export function readPlanVisibility(): Promise<PlanVisibility | null> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetchPlanVisibility()
      .then((v) => { cached = v; return v; })
      .catch(() => null)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** Test seam. */
export function resetPlanVisibility(): void {
  cached = null;
  inflight = null;
}

export function usePlanVisibility(): PlanVisibility | null {
  const [v, setV] = useState<PlanVisibility | null>(cached);
  useEffect(() => {
    let live = true;
    void readPlanVisibility().then((next) => live && setV(next));
    return () => { live = false; };
  }, []);
  return v;
}
