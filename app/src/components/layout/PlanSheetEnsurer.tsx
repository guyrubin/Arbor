/**
 * PlanSheetEnsurer — B-BOOK-75 follow-up: the parent shell starts (or resumes)
 * the child's shared PLAN sheet (bookAssets/plan-poses) for the poses the
 * child's approved Everyday plans need — the way KidModeButton ensures the
 * hero sheet. It renders nothing. It reacts to the `books` rows, so a plan the
 * parent has just approved starts its poses at once, and a reload resumes.
 * Only a hero drawn from a description (the server refuses the rest; the
 * game's idle must exist first — a refusal there ends the build and the next
 * pose-set change or page load tries again). Once per (child, hero, pose set)
 * per page load. Parent side only: no Kid Mode module imports the builder.
 */
import { useEffect } from "react";
import { useArborOptional } from "../../context/ArborContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { heroAvatarHash } from "../../lib/heroSheetContract";
import { resolveHeroUrl } from "../../lib/heroIdentity";
import type { PlanBookDoc } from "../../lib/library/plans/planBookDoc";
import { planSheetPoses } from "../../lib/plans/planSheet";
import { startBrowserPlanSheet, type BookBuildResult } from "../kidmode/hero/buildBookSheet";

const ensured = new Set<string>();

export function ensurePlanSheet(
  child: { id: string; photoUrl?: string | null; comicAvatarUrl?: string; avatar?: { source?: string } | null } | null | undefined,
  poses: readonly string[],
): Promise<BookBuildResult> | null {
  if (!child?.id || !poses.length || child.avatar?.source !== "descriptor") return null;
  const heroUrl = resolveHeroUrl({ ...child, photoUrl: child.photoUrl ?? undefined });
  if (!heroUrl || !/^data:image\//.test(heroUrl)) return null;
  const avatarHash = heroAvatarHash(heroUrl);
  const key = `${child.id}:${avatarHash}:${[...poses].sort().join(",")}`;
  if (ensured.has(key)) return null;
  ensured.add(key);
  return startBrowserPlanSheet(child.id, avatarHash, poses);
}

/** Test seam. */
export function resetEnsuredPlanSheetsForTest(): void { ensured.clear(); }

export default function PlanSheetEnsurer() {
  const child = useArborOptional()?.childProfile;
  const rows = useChildCollection<PlanBookDoc>(child?.id ?? "", "books");
  const poseKey = planSheetPoses(rows.loaded ? rows.items : []).join(",");
  useEffect(() => {
    if (child && poseKey) void ensurePlanSheet(child, poseKey.split(","));
  }, [child?.id, child?.photoUrl, poseKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
