/**
 * The plan-plate manifest guard: src/lib/library/plans/planPlateManifest.ts is
 * exactly what scripts/plan-plate-manifest.mjs renders from
 * public/visuals/plans — a committed plate never ships unlisted (it would be
 * fetched from shared storage instead of the static file) and a listed plate
 * never goes missing (a static 404 on every family's device).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MANIFEST_FILE, renderManifest, scanCommittedPlanPlates } from "./plan-plate-manifest.mjs";
import { COMMITTED_PLAN_PLATES } from "../src/lib/library/plans/planPlateManifest";
import { PLAN_PLATE_BRIEFS } from "../src/lib/library/plans/planPlates";

describe("plan-plate manifest", () => {
  it("matches the committed folder byte for byte", () => {
    expect(readFileSync(MANIFEST_FILE, "utf8")).toBe(renderManifest(scanCommittedPlanPlates()));
  });

  it("lists only plates the registry briefs, as <pattern>/<plate>", () => {
    for (const id of COMMITTED_PLAN_PLATES) {
      const [pattern, plate, extra] = id.split("/");
      expect(extra, id).toBeUndefined();
      expect(PLAN_PLATE_BRIEFS[pattern as keyof typeof PLAN_PLATE_BRIEFS]?.[plate], id).toBeDefined();
    }
  });

  it("renders the list", () => {
    const a = renderManifest(["plan-poo-sit/PP2", "plan-poo-sit/PP1"]);
    expect(a).toContain('"plan-poo-sit/PP2"');
    expect(renderManifest([])).toContain("readonly string[] = [];");
  });
});
