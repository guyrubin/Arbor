/**
 * B-BOOK-75 follow-up — the parent shell's plan-sheet ensurer: starts the
 * child's shared plan sheet once per (child, hero, pose set) per page load,
 * only for a hero drawn from a description with an inline data URL, never
 * with no poses; a new pose set (another plan approved) starts again.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const started = vi.hoisted(() => [] as { childId: string; avatarHash: string; poses: readonly string[] }[]);
vi.mock("../kidmode/hero/buildBookSheet", () => ({
  startBrowserPlanSheet: vi.fn(async (childId: string, avatarHash: string, poses: readonly string[]) => { started.push({ childId, avatarHash, poses }); return { status: "complete", drawn: [...poses], skipped: [], calls: poses.length }; }),
}));

import { ensurePlanSheet, resetEnsuredPlanSheetsForTest } from "./PlanSheetEnsurer";
import { heroAvatarHash } from "../../lib/heroSheetContract";

const HERO = "data:image/png;base64,SEVSTw==";
const child = { id: "kid1", photoUrl: HERO, avatar: { source: "descriptor" } };

describe("ensurePlanSheet", () => {
  beforeEach(() => { started.length = 0; resetEnsuredPlanSheetsForTest(); });

  it("starts the plan sheet for the hero's hash and the named poses, once per pose set; a new pose set starts again", async () => {
    expect(await ensurePlanSheet(child, ["sit-calm", "hold-box"])).toMatchObject({ status: "complete" });
    expect(ensurePlanSheet(child, ["hold-box", "sit-calm"])).toBeNull(); // same set, any order
    expect(started).toEqual([{ childId: "kid1", avatarHash: heroAvatarHash(HERO), poses: ["sit-calm", "hold-box"] }]);
    expect(await ensurePlanSheet(child, ["sit-calm", "hold-box", "stand-tall"])).toMatchObject({ status: "complete" });
    expect(started).toHaveLength(2);
  });

  it("nothing without poses, without a child, for a photo-styled hero or a remote hero URL", () => {
    expect(ensurePlanSheet(child, [])).toBeNull();
    expect(ensurePlanSheet(null, ["sit-calm"])).toBeNull();
    expect(ensurePlanSheet({ ...child, avatar: { source: "photo" } }, ["sit-calm"])).toBeNull();
    expect(ensurePlanSheet({ ...child, photoUrl: "https://example.test/hero.png" }, ["sit-calm"])).toBeNull();
    expect(started).toEqual([]);
  });
});
