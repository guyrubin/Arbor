/**
 * B-BOOK-75 (plates painted in-product) — the resolution order of a plan
 * plate's `file`: the committed static path when the build-time manifest
 * lists the plate, else the shared-storage route (read with the app's auth);
 * never a DEV placeholder here (plateSources adds that in DEV only, and the
 * production chain is the one source).
 */
import { describe, expect, it } from "vitest";
import { plateSources } from "../bookPlates";
import { COMMITTED_PLAN_PLATES } from "./planPlateManifest";
import { getPlanPlate, isApiPlanPlateUrl, PLAN_PLATE_API_ROOT, PLAN_PLATE_ROOT, planPlateCommitted, planPlateFile, planPlateTable } from "./planPlates";
import { PATTERN_IDS } from "./planVisibility";

describe("plan plate resolution", () => {
  it("a committed plate resolves to its static path, every other to the GET route", () => {
    const committed = new Set(["plan-poo-sit/PP1"]);
    expect(planPlateCommitted("plan-poo-sit", "PP1", committed)).toBe(true);
    expect(planPlateFile("plan-poo-sit", "PP1", committed)).toBe(`${PLAN_PLATE_ROOT}/plan-poo-sit/PP1.webp`);
    expect(planPlateCommitted("plan-poo-sit", "PP2", committed)).toBe(false);
    expect(planPlateFile("plan-poo-sit", "PP2", committed)).toBe(`${PLAN_PLATE_API_ROOT}/plan-poo-sit/PP2`);
    expect(isApiPlanPlateUrl(planPlateFile("plan-poo-sit", "PP2", committed))).toBe(true);
    expect(isApiPlanPlateUrl(planPlateFile("plan-poo-sit", "PP1", committed))).toBe(false);
    expect(isApiPlanPlateUrl("/visuals/books/x/y.webp")).toBe(false);
  });

  it("the registry follows the build manifest for every plate of every pattern", () => {
    const committed = new Set(COMMITTED_PLAN_PLATES);
    for (const p of PATTERN_IDS) for (const id of Object.keys(planPlateTable(p))) {
      const plate = getPlanPlate(p, id)!;
      expect(plate.file).toBe(planPlateFile(p, id));
      expect(plate.file).toBe(committed.has(`${p}/${id}`) ? `/visuals/plans/${p}/${id}.webp` : `/api/plans/plates/${p}/${id}`);
      // production: the one source, never a placeholder; DEV adds the placeholder after it
      expect(plateSources(plate, { dev: false })).toEqual([plate.file]);
      expect(plateSources(plate, { dev: true })).toEqual([plate.file, `/_dev/plates/${p}/${id}.webp`]);
    }
  });
});
