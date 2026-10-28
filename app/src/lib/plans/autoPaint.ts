/**
 * lib/plans/autoPaint — S1 (surfacing) 4(b): when an OWNER opens a pattern
 * whose shared plates are not all painted, the composer starts the existing
 * owner route (POST /api/admin/plan-plates, one pattern = its 8 plates, well
 * under the route's own caps) in the background and reports
 * "Painting the pictures… {done} of {total}" until the first new plate lands.
 * Zero buttons on the normal path; a family never reaches this module (the
 * composer calls it only when the server's visibility table says `admin`).
 *
 * Pure of React: the caller injects the two route calls and the clock, so the
 * controller is tested with mocks. One run per pattern per session (a remount
 * never starts a second run while one may still be painting).
 */
import { planPlateTable } from "../library/plans/planPlates";
import type { PlanPlateRun, PlanPlateStatus } from "./planApi";
import type { PatternId } from "../library/types";

export interface AutoPaintState {
  /** The progress line is shown while true. */
  painting: boolean;
  done: number;
  total: number;
}

export interface AutoPaintDeps {
  fetchStatus: () => Promise<PlanPlateStatus>;
  paint: (input: { pattern: PatternId }) => Promise<PlanPlateRun>;
  sleep?: (ms: number) => Promise<void>;
  /** How often the status is re-read while the run is in flight. */
  pollMs?: number;
}

export const AUTO_PAINT_POLL_MS = 3000;

const started = new Set<PatternId>();

/** Test seam. */
export function resetAutoPaint(): void {
  started.clear();
}

const paintedCount = (status: PlanPlateStatus, pattern: PatternId): number =>
  Object.values(status.patterns?.[pattern] ?? {}).filter((s) => s === "painted").length;

/**
 * Start the background paint for `pattern` if any of its plates is unpainted.
 * `onChange` receives every state the line should show; the returned function
 * stops the reporting (the server run itself continues to its own end).
 */
export function startAutoPaint(pattern: PatternId, onChange: (state: AutoPaintState) => void, deps: AutoPaintDeps): () => void {
  let live = true;
  const total = Object.keys(planPlateTable(pattern)).length;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  void (async () => {
    if (!total || started.has(pattern)) return;
    let status: PlanPlateStatus;
    try {
      status = await deps.fetchStatus();
    } catch {
      return;
    }
    if (!live || !status.storage) return;
    const initial = paintedCount(status, pattern);
    if (initial >= total || started.has(pattern)) return;
    started.add(pattern);
    onChange({ painting: true, done: initial, total });
    let finished = false;
    const run = deps.paint({ pattern }).catch(() => undefined).finally(() => { finished = true; });
    while (live && !finished) {
      await sleep(deps.pollMs ?? AUTO_PAINT_POLL_MS);
      if (!live || finished) break;
      try {
        const done = paintedCount(await deps.fetchStatus(), pattern);
        if (!live) return;
        // the first new plate landed: the line goes; the run finishes on its own
        if (done > initial) return onChange({ painting: false, done, total });
        onChange({ painting: true, done, total });
      } catch {
        /* a failed poll keeps the last line */
      }
    }
    await run;
    if (!live) return;
    try {
      onChange({ painting: false, done: paintedCount(await deps.fetchStatus(), pattern), total });
    } catch {
      onChange({ painting: false, done: initial, total });
    }
  })();
  return () => { live = false; };
}
