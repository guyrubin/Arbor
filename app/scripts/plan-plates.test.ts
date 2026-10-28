/**
 * B-BOOK-76 follow-up — the plate painter's pure parts: one deterministic
 * prompt per plate (child-free, text-free, one key light, hero slot empty,
 * the game-tile look), a plan over every brief with public paths under
 * /visuals/plans, idempotent skipping by existing file, strict QC, argument
 * parsing, and a clear IAM message naming the role. No model call here.
 */
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { PLAN_PLATE_BRIEFS, planPlateTable } from "../src/lib/library/plans/planPlates";
import { iamMessage, parseArgs, platePrompt, plateJobs, promptHash, qcPassed } from "./plan-plates.mts";

describe("the plan plate painter", () => {
  it("plans one job per brief, with the committed public path the plate table names", () => {
    const jobs = plateJobs();
    const briefs = Object.values(PLAN_PLATE_BRIEFS).reduce((n, specs) => n + Object.keys(specs).length, 0);
    expect(jobs).toHaveLength(briefs);
    for (const j of jobs) {
      const plate = planPlateTable(j.patternId)[j.plateId];
      expect(plate, `${j.patternId}/${j.plateId}`).toBeDefined();
      expect(j.webp.endsWith(plate.file.replace(/^\//, "").replace("visuals/plans/", "visuals/plans/")), j.webp).toBe(true);
      expect(j.json.endsWith(`${j.plateId}.json`)).toBe(true);
      expect(j.hash).toBe(promptHash(j.prompt));
    }
    expect(plateJobs(["plan-poo-sit"]).every((j) => j.patternId === "plan-poo-sit")).toBe(true);
    expect(plateJobs(["plan-poo-sit"]).length).toBe(Object.keys(PLAN_PLATE_BRIEFS["plan-poo-sit"]!).length);
  });

  it("every prompt is child-free, text-free, one key light, hero slot empty, game-tile look; deterministic", () => {
    for (const j of plateJobs()) {
      expect(j.prompt).toContain("NO PEOPLE and NO CHILD");
      expect(j.prompt).toContain("no text anywhere");
      expect(j.prompt).toContain("ONE key light");
      expect(j.prompt).toContain("stays EMPTY");
      expect(j.prompt).toContain("game-tile look");
      expect(j.prompt).toContain(j.spec.brief);
      expect(j.prompt).not.toMatch(/\{name\}/);
      expect(platePrompt(j.patternId, j.plateId, j.spec)).toBe(j.prompt);
    }
  });

  it("no plate is committed yet (the workflow paints them; the repo carries no placeholder as a real plate)", () => {
    for (const j of plateJobs()) expect(existsSync(j.webp), j.webp).toBe(false);
  });

  it("parses --pattern (repeatable), --dry-run and --force; refuses an unknown pattern or flag", () => {
    expect(parseArgs(["--pattern", "plan-poo-sit", "--pattern=plan-dropoff", "--dry-run"])).toEqual({ patterns: ["plan-poo-sit", "plan-dropoff"], dryRun: true, force: false });
    expect(parseArgs(["--force"])).toEqual({ patterns: [], dryRun: false, force: true });
    expect(() => parseArgs(["--pattern", "plan-nope"])).toThrow(/Unknown pattern/);
    expect(() => parseArgs(["--wat"])).toThrow(/Unknown argument/);
  });

  it("QC passes only when all three answers are true; an IAM refusal names roles/aiplatform.user and the project", () => {
    expect(qcPassed({ childFree: true, textFree: true, heroSlotEmpty: true, notes: "" })).toBe(true);
    expect(qcPassed({ childFree: false, textFree: true, heroSlotEmpty: true, notes: "a figure" })).toBe(false);
    expect(qcPassed({ childFree: true, textFree: false, heroSlotEmpty: true, notes: "" })).toBe(false);
    const msg = iamMessage(Object.assign(new Error("7 PERMISSION_DENIED: Permission 'aiplatform.endpoints.predict' denied on resource"), { code: 7 }), "arbor-proj");
    expect(msg).toContain("roles/aiplatform.user");
    expect(msg).toContain("arbor-proj");
    expect(iamMessage(new Error("503 Service Unavailable"), "arbor-proj")).toBeNull();
    expect(iamMessage(new Error("Image generation returned no image content."), "arbor-proj")).toBeNull();
  });
});
