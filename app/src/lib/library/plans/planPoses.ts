/**
 * lib/library/plans/planPoses — B-BOOK-75 (kid-everyday-plans-standard §0):
 * the ONE shared plan-pose list. Every PLAN book of every pattern draws its
 * hero poses from these twelve, so a child who has one plan pays no new
 * poses for the next (the child's plan sheet is drawn once, for all patterns).
 * A pattern uses at most six of them. Pure.
 */
import type { Pose } from "../types";

export const PLAN_POSES = [
  "sit-calm",
  "stand-tall",
  "point-up",
  "hug-knees",
  "hold-tummy",
  "wave",
  "lie-down",
  "sit-at-table",
  "open-mouth-wide",
  "hold-hand",
  "hold-box",
  "hands-up",
] as const;

export type PlanPose = (typeof PLAN_POSES)[number];

/** At most this many of the shared poses per pattern (standard §0). */
export const PLAN_POSES_PER_PATTERN_MAX = 6;

const SET: ReadonlySet<string> = new Set(PLAN_POSES);

export const isPlanPose = (pose: Pose): pose is PlanPose => SET.has(pose);

/** The bookAssets doc id of a child's shared plan hero sheet: one sheet, every
 *  pattern (`users/{uid}/children/{cid}/bookAssets/plan-poses`). */
export const PLAN_SHEET_BOOK_ID = "plan-poses";
