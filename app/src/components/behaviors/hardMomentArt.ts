import type { HardMomentCategory } from "../../content/hardMomentCards";
import { routineFace } from "../together/routineArt";

/**
 * The Living Forms face of a hard-moment guide (N-Hard, "Closest to what you
 * have been noting"): the same guide visuals and crops the routines use,
 * picked by the guide's category. Decorative identity only, never evidence.
 */
const FACE_BY_CATEGORY: Readonly<Record<HardMomentCategory, string>> = {
  "big-feelings": "calm",
  limits: "goodbye",
  relationships: "goodbye",
  separation: "goodbye",
  routines: "bedtime",
  transitions: "goodbye",
};

/** The guide's face at `size` px wide (the board draws it at 64). */
export function hardMomentFace(category: HardMomentCategory, size: number) {
  return routineFace(FACE_BY_CATEGORY[category] ?? "calm", size);
}
