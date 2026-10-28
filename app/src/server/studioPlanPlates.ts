/**
 * server/studioPlanPlates — B-KID-150: the in-product studio path. The admin
 * plan-plate painter (server/planPlates.ts, POST /api/admin/plan-plates) paints
 * SHARED pattern plates through the image provider; each paint is studio
 * production, not family-serving usage. This adapter wraps the painter's
 * injected `generate` so every call runs as the production of its plate
 * (`plan-plate:<patternId>~<plateId>` in the studio cost ledger) and never
 * reaches the family meter. The plate is found from its prompt (planPlatePrompt
 * is pure and one prompt per plate), so the painter itself is unchanged.
 */
import { createHash } from "node:crypto";
import { PLAN_PLATE_BRIEFS } from "../lib/library/plans/planPlates.js";
import type { PatternId } from "../lib/library/types.js";
import { planPlatePrompt } from "./planPlates.js";
import { runAsStudioProduction, type StudioAsset } from "./studioCostLedger.js";

let byPrompt: Map<string, string> | null = null;

/** The plate a paint prompt belongs to (`<patternId>/<plateId>`), else an
 *  `unmatched/<hash>` ref so the spend still lands in the studio ledger. */
export function planPlateStudioAsset(prompt: string): StudioAsset {
  if (!byPrompt) {
    byPrompt = new Map();
    for (const [pattern, specs] of Object.entries(PLAN_PLATE_BRIEFS)) {
      for (const plate of Object.keys(specs ?? {})) {
        const p = planPlatePrompt(pattern as PatternId, plate);
        if (p) byPrompt.set(p, `${pattern}/${plate}`);
      }
    }
  }
  return { kind: "plan-plate", ref: byPrompt.get(prompt) ?? `unmatched/${createHash("sha256").update(prompt).digest("hex").slice(0, 16)}` };
}

/** The painter's `generate`, run as the production of the plate it paints. */
export function asStudioPlanPlateGenerate<O extends { prompt: string }, R>(generate: (options: O) => Promise<R>): (options: O) => Promise<R> {
  return (options) => runAsStudioProduction(planPlateStudioAsset(options.prompt), "image", () => generate(options));
}
