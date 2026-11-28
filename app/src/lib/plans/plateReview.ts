/**
 * lib/plans/plateReview — B-BOOK-27: the owner's full-size review of a shared
 * plan plate, without React (components/plans/PlanPlatePainter renders it).
 *
 * The read route (GET /api/plans/plates) serves a painted plate to families
 * only once its stored record says a person viewed it full size and saw no
 * child or person and no words. The owner records that here: view the painted
 * master (the painter-only image route), tick only what they saw, save
 * (POST /api/admin/plan-plates/review). A plate saved with a box unticked is
 * recorded as such and stays hidden from families. A refusal is reported as
 * it is; nothing is assumed saved.
 */
import { authHeaders } from "../api";
import { PlanApiError, reviewPlanPlate, type PlanPlateReview } from "./planApi";
import type { PlanStringKey } from "./planStrings";
import type { PatternId } from "../library/types";

export interface PlateReviewInput {
  pattern: PatternId;
  plate: string;
  childFree: boolean;
  textFree: boolean;
}

export type PlateReviewOutcome =
  | { ok: true; review: PlanPlateReview; servable: boolean }
  | { ok: false; note: PlanStringKey };

/** Save one review; the server's answer decides what the control shows next. */
export async function submitPlateReview(input: PlateReviewInput, api: { review: typeof reviewPlanPlate } = { review: reviewPlanPlate }): Promise<PlateReviewOutcome> {
  try {
    const out = await api.review({ pattern: input.pattern, plate: input.plate, childFree: input.childFree === true, textFree: input.textFree === true });
    const state: PlanPlateReview["state"] = out.servable ? "reviewed" : !out.childFree ? "child-painted" : !out.textFree ? "has-text" : "unreviewed";
    return { ok: true, review: { state, reviewedBy: out.reviewedBy }, servable: out.servable };
  } catch (err) {
    if (err instanceof PlanApiError && err.status === 403) return { ok: false, note: "plates.review.forbidden" };
    if (err instanceof PlanApiError && err.status === 404) return { ok: false, note: "plates.review.unpainted" };
    return { ok: false, note: "plates.review.error" };
  }
}

/** The line a painted plate shows for its review state. */
export function reviewLabel(review: PlanPlateReview | undefined): { key: PlanStringKey; vars: Record<string, string> } {
  const vars = { by: review?.reviewedBy ?? "", at: (review?.reviewedAt ?? "").slice(0, 16).replace("T", " ") };
  switch (review?.state) {
    case "reviewed": return { key: "plates.review.reviewed", vars };
    case "child-painted": return { key: "plates.review.childPainted", vars };
    case "has-text": return { key: "plates.review.hasText", vars };
    default: return { key: "plates.review.unreviewed", vars };
  }
}

/** The painter-only image route of a painted master (reviewed or not). */
export function adminPlateImageUrl(pattern: PatternId, plate: string): string {
  return `/api/admin/plan-plates/${encodeURIComponent(pattern)}/${encodeURIComponent(plate)}/image`;
}

/** The painted master as a blob: URL for the reviewer (the route keeps the app's auth); null when unreadable. */
export async function loadAdminPlateImage(pattern: PatternId, plate: string): Promise<string | null> {
  try {
    const headers = await authHeaders();
    delete headers["Content-Type"];
    const res = await fetch(adminPlateImageUrl(pattern, plate), { headers });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!/^image\/(?:webp|png)$/i.test(blob.type) || blob.size === 0) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}
