/**
 * lib/library/plans/planVisibility — B-KID-167 (GA DoD 3, the visibility
 * gate): a PLAN book is clinical content a family can see. Until the licensed
 * reviewer (B-GA-01) signs a pattern in a language (B-GA-37), that pattern is
 * composable ONLY in the sandbox (the demo family) and for the owner
 * allow-list, behind a server-checked flag. The signature is a record the
 * server holds (`plans.reviewed[patternId][lang]`, default false); nothing in
 * the client can grant it, and this module never fakes it. Pure; shared by
 * the server route (server/plans.ts) and the client door.
 */
import type { BookLang, PatternId } from "../types";

/** The reviewer's record per pattern and language (false = unsigned). */
export type PlanReviewFlags = Partial<Record<PatternId, Partial<Record<BookLang, boolean>>>>;

export interface PlanViewer {
  uid: string | null;
  email: string | null;
  /** The local sandbox (no Firebase, the demo family): always composable. */
  sandbox: boolean;
}

export interface PlanOwners {
  uids: readonly string[];
  emails: readonly string[];
}

export const PATTERN_IDS: readonly PatternId[] = ["plan-poo-sit", "plan-toilet-start", "plan-sleep-alone", "plan-stay-in-bed", "plan-dropoff", "plan-big-feelings", "plan-screen-end", "plan-new-food"];
export const PLAN_LANGS: readonly BookLang[] = ["en", "he"];

export const isPatternId = (v: unknown): v is PatternId => typeof v === "string" && (PATTERN_IDS as readonly string[]).includes(v);

/** Has the reviewer signed this pattern in this language? */
export function patternSigned(flags: PlanReviewFlags, patternId: PatternId, lang: BookLang): boolean {
  return flags[patternId]?.[lang] === true;
}

/** Parse the server's flag record from untrusted JSON (env or store): only a
 *  literal `true` under a known pattern and language counts. */
export function readReviewFlags(raw: unknown): PlanReviewFlags {
  const out: PlanReviewFlags = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [p, langs] of Object.entries(raw as Record<string, unknown>)) {
    if (!isPatternId(p) || !langs || typeof langs !== "object") continue;
    for (const l of PLAN_LANGS) if ((langs as Record<string, unknown>)[l] === true) (out[p] ??= {})[l] = true;
  }
  return out;
}

export function isOwner(viewer: PlanViewer, owners: PlanOwners): boolean {
  const uid = viewer.uid?.trim();
  const email = viewer.email?.trim().toLowerCase();
  return (!!uid && owners.uids.includes(uid)) || (!!email && owners.emails.map((e) => e.toLowerCase()).includes(email));
}

export type ComposeVerdict = { ok: true; why: "signed" | "sandbox" | "owner" } | { ok: false; reason: "unsigned" };

/** May this viewer compose this pattern in this language? */
export function canComposePlan(input: { patternId: PatternId; lang: BookLang; flags: PlanReviewFlags; viewer: PlanViewer; owners: PlanOwners }): ComposeVerdict {
  if (patternSigned(input.flags, input.patternId, input.lang)) return { ok: true, why: "signed" };
  if (input.viewer.sandbox) return { ok: true, why: "sandbox" };
  if (isOwner(input.viewer, input.owners)) return { ok: true, why: "owner" };
  return { ok: false, reason: "unsigned" };
}

/** The whole table for one viewer (what GET /api/plans/visibility returns). */
export function planVisibilityFor(flags: PlanReviewFlags, viewer: PlanViewer, owners: PlanOwners): { reviewed: Record<PatternId, Record<BookLang, boolean>>; composable: Record<PatternId, Record<BookLang, boolean>> } {
  const reviewed = {} as Record<PatternId, Record<BookLang, boolean>>;
  const composable = {} as Record<PatternId, Record<BookLang, boolean>>;
  for (const p of PATTERN_IDS) {
    reviewed[p] = { en: patternSigned(flags, p, "en"), he: patternSigned(flags, p, "he") };
    composable[p] = { en: canComposePlan({ patternId: p, lang: "en", flags, viewer, owners }).ok, he: canComposePlan({ patternId: p, lang: "he", flags, viewer, owners }).ok };
  }
  return { reviewed, composable };
}
