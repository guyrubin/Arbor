/**
 * Family plan v1: the review draft on the client. The server's reading of a
 * message (server/familyPlanExtract.ts) or a date typed by hand becomes a
 * draft row the parent checks; each row carries the duplicate check against
 * the plan (lib/familyPlan/match.ts) and nothing is added until they keep it.
 */
import type { FamilyPlanKind } from "./model";
import type { MatchResult } from "./match";

export type DraftKind = FamilyPlanKind | "note";

/** One item as the extract route returns it (mirror of server FamilyPlanDraftItem). */
export interface FamilyPlanExtractItem {
  id: string;
  line: number;
  sourceLine: string;
  quote: string;
  kind: DraftKind;
  title: string;
  date: string;
  time: string;
}

export interface FamilyPlanExtractResult {
  items: FamilyPlanExtractItem[];
  lineCount: number;
  today: string;
}

/** A row in the review: the parent's current choice for one found item. */
export interface ReviewRow extends FamilyPlanExtractItem {
  /** Ticked = joins the plan when the parent adds. */
  keep: boolean;
  match: MatchResult;
}
