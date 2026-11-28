/**
 * lib/plans/planApi — B-BOOK-77: the client side of the Everyday Plans
 * routes (server/plans.ts). The visibility table is read once per session
 * and never decided on the device; composition and phrasing go through the
 * server (the gate, the menu validation, the one model call); the resulting
 * document is persisted by the device through the child-collection hook (both the
 * cloud and the sandbox), like every other per-child row.
 */
import { authHeaders } from "../api";
import type { ComposeRequest } from "./composer";
import type { OwnStep, OwnStepOrigin } from "../library/plans/composePlanBook";
import type { PlanBookDoc } from "../library/plans/planBookDoc";
import type { BookLang, PatternId } from "../library/types";

export interface PlanVisibility {
  reviewed: Record<PatternId, Record<BookLang, boolean>>;
  composable: Record<PatternId, Record<BookLang, boolean>>;
  /** B-BOOK-75 plates: the server says this viewer may paint the shared plates (admin / comped). Absent or false for every family. */
  admin?: boolean;
}

export type PlanPlateState = "painted" | "failed" | "unpainted";
/** B-BOOK-27: a painted plate's full-size review (server/planPlates.plateReviewOf). */
export type PlanPlateReviewState = "unreviewed" | "reviewed" | "child-painted" | "has-text";
export interface PlanPlateReview {
  state: PlanPlateReviewState;
  reviewedBy?: string;
  reviewedAt?: string;
}
export interface PlanPlateStatus {
  storage: boolean;
  patterns: Record<PatternId, Record<string, PlanPlateState>>;
  /** Painted plates only; absent from an older server = every plate unreviewed. */
  reviews?: Partial<Record<PatternId, Record<string, PlanPlateReview>>>;
  costPerImageUsd: number;
  maxImagesPerRun: number;
  maxUsdPerRun: number;
}
export interface PlanPlateRun {
  run: { planned: number; painted: number; failed: number; skipped: number; left: number; stopped: "deadline" | "breaker" | "client" | null; estimatedUsd: number; spentUsd: number };
  results: { pattern: PatternId; plate: string; state: PlanPlateState | "skipped"; reason?: string }[];
}

export class PlanApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly body: unknown = null) {
    super(message);
  }
}

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = await authHeaders({ "content-type": "application/json", ...((init.headers as Record<string, string>) ?? {}) });
  const res = await fetch(url, { ...init, headers });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new PlanApiError(res.status, (body as { code?: string } | null)?.code ?? "plan_request_failed", (body as { error?: string } | null)?.error ?? res.statusText, body);
  return body as T;
}

/** The viewer's table: which patterns are reviewed, which they may compose. */
export const fetchPlanVisibility = (): Promise<PlanVisibility> => call<PlanVisibility>("/api/plans/visibility");

/** B-GA-11: the parent's own words phrased into the book's register (one
 *  server-side model call, screened); NOT approved — the parent approves the
 *  exact line in the composer. */
export const phraseOwnStep = (input: { pattern: PatternId; slot: 1 | 2 | 3; lang: BookLang; text: string; origin?: OwnStepOrigin }): Promise<{ step: Omit<OwnStep, "approvedAt"> }> =>
  call("/api/plans/phrase", { method: "POST", body: JSON.stringify(input) });

/** "This is {name}'s plan": the server validates and stamps the approval; the
 *  device persists the returned document. */
export const composePlan = (childId: string, body: ComposeRequest): Promise<{ doc: PlanBookDoc; why: string }> =>
  call(`/api/children/${encodeURIComponent(childId)}/plan-books`, { method: "POST", body: JSON.stringify(body) });

/** B-BOOK-75 plates (admin / comped only; 403 for a family): the per-plate state. */
export const fetchPlanPlateStatus = (): Promise<PlanPlateStatus> => call<PlanPlateStatus>("/api/admin/plan-plates");

/** B-BOOK-27: record that the owner viewed one painted plate full size (both
 *  flags as seen). The read route serves the plate only when both are true. */
export const reviewPlanPlate = (input: { pattern: PatternId; plate: string; childFree: boolean; textFree: boolean }): Promise<{ pattern: PatternId; plate: string; childFree: boolean; textFree: boolean; reviewedBy: string; servable: boolean }> =>
  call("/api/admin/plan-plates/review", { method: "POST", body: JSON.stringify(input) });

/** Paint one pattern's plates (or one plate) in shared storage; painted plates are skipped unless `repaint`. */
export const paintPlanPlates = (input: { pattern?: PatternId; plate?: string; repaint?: boolean }): Promise<PlanPlateRun> =>
  call("/api/admin/plan-plates", { method: "POST", body: JSON.stringify(input) });
