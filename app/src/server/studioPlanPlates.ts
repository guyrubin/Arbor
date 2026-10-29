/**
 * server/studioPlanPlates — B-KID-150: the in-product studio path. The admin
 * plan-plate painter (server/planPlates.ts, POST /api/admin/plan-plates) paints
 * SHARED pattern plates through the image provider; each paint is studio
 * production, not family-serving usage. `withStudioPlanPlates` wraps the app's
 * model provider once (server/createApp.ts) so an image call whose prompt IS a
 * plan plate's paint prompt runs as the production of that plate
 * (`plan-plate:<patternId>~<plateId>` in the studio cost ledger) and never
 * reaches the family meter. Every other call passes through untouched. The
 * plate is found from its prompt (planPlatePrompt is pure, one prompt per
 * plate), so the painter and its route wiring stay as the Plans track wrote them.
 */
import { PLAN_PLATE_BRIEFS } from "../lib/library/plans/planPlates.js";
import type { PatternId } from "../lib/library/types.js";
import type { GeneratedImage, GenerateImageOptions } from "../ai/modelRouter.js";
import { planPlatePrompt } from "./planPlates.js";
import { runAsStudioProduction, type StudioAsset } from "./studioCostLedger.js";

let byPrompt: Map<string, string> | null = null;

/** The plate a paint prompt belongs to, else null (not a plan-plate paint). */
export function planPlateStudioAsset(prompt: string): StudioAsset | null {
  if (!byPrompt) {
    byPrompt = new Map();
    for (const [pattern, specs] of Object.entries(PLAN_PLATE_BRIEFS)) {
      for (const plate of Object.keys(specs ?? {})) {
        const p = planPlatePrompt(pattern as PatternId, plate);
        if (p) byPrompt.set(p, `${pattern}/${plate}`);
      }
    }
  }
  const ref = byPrompt.get(prompt);
  return ref ? { kind: "plan-plate", ref } : null;
}

/** The provider with plan-plate paints run as studio production (all else unchanged). */
export function withStudioPlanPlates<P extends { generateImage(options: GenerateImageOptions): Promise<GeneratedImage> }>(provider: P): P {
  const generateImage = (options: GenerateImageOptions): Promise<GeneratedImage> => {
    const asset = typeof options?.prompt === "string" ? planPlateStudioAsset(options.prompt) : null;
    return asset ? runAsStudioProduction(asset, "image", () => provider.generateImage(options)) : provider.generateImage(options);
  };
  return new Proxy(provider, {
    get(target, key) {
      if (key === "generateImage") return generateImage;
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
