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
