import { goToRoute } from "../hooks/useHashQuery";
import { hashQuery, resolveRouteId } from "./routes";

/** A notice is one child's existing milestone, never a new record type. */
export interface NoticeTarget { childId: string; milestoneId: string }

const usableId = (value: string | null): value is string => !!value && value.length <= 200 && !/[\u0000-\u001f]/.test(value);

/** The child in a link is a scope guard; a link never changes the active child. */
export function readNoticeTarget(query: URLSearchParams, childId: string): NoticeTarget | null {
  const owner = query.get("child");
  const milestoneId = query.get("notice");
  return owner === childId && usableId(owner) && usableId(milestoneId) ? { childId: owner, milestoneId } : null;
}

function parentReturn(hash: string): string | null {
  if (hash.length > 1600 || !hash.startsWith("#/") || !resolveRouteId(hash)) return null;
  if (hashQuery(hash).has("notice")) return null;
  return hash;
}

/** A normal history entry keeps Back useful from Now, an area, or a Journal shelf. */
export function openNoticeDetail(childId: string, milestoneId: string, options?: { editEvidence?: boolean }): void {
  if (!usableId(childId) || !usableId(milestoneId)) return;
  const origin = typeof window === "undefined" ? null : parentReturn(window.location.hash);
  goToRoute("development", { notice: milestoneId, child: childId, return: origin, evidence: options?.editEvidence ? "edit" : undefined });
}

/** Closing a direct or reloaded link restores only a known in-app origin. */
export function closeNoticeDetail(query: URLSearchParams): void {
  if (typeof window === "undefined") return;
  const target = parentReturn(query.get("return") ?? "") ?? "#/development";
  const oldURL = window.location.href;
  window.history.replaceState(window.history.state, "", target);
  window.dispatchEvent(new HashChangeEvent("hashchange", { oldURL, newURL: window.location.href }));
}

/** Existing Observation identities; an optional keepsake is still a separate record. */
export function noticeMilestoneId(origin: string, recordId: string): string | null {
  if (origin !== "milestones" && origin !== "keepsakes") return null;
  const prefix = `${origin}:`;
  const id = recordId.startsWith(prefix) ? recordId.slice(prefix.length) : "";
  return usableId(id) ? id : null;
}

export function openNoticeMoment(childId: string, observationId: string): void {
  if (!usableId(childId) || !usableId(observationId)) return;
  goToRoute("timeline", { child: childId, observation: observationId });
}
