import type { BehaviorLog } from "../types";
import { isIncidentType } from "../content/behaviorTaxonomy";

/**
 * V77 (N-Talk-D/M, empty state): the parent's own most recent records, as
 * starters for a conversation. Deterministic and local: the logs the client
 * already holds, no model call. Each starter carries the parent's own words,
 * its kind (the one kind palette: a hard moment, a moment you kept, or a note
 * you wrote) and its day. A record whose words came from an Arbor draft is
 * never offered as the parent's words.
 */
export type TalkStarterKind = "hard" | "kept" | "note";

export interface TalkStarter {
  id: string;
  kind: TalkStarterKind;
  /** The parent's own words for the record. */
  words: string;
  /** ISO time of the record. */
  at: string;
}

export const TALK_STARTER_LIMIT = 2;

export function starterKind(log: Pick<BehaviorLog, "behaviorType" | "kept">): TalkStarterKind {
  if (isIncidentType(log.behaviorType)) return "hard";
  return log.kept ? "kept" : "note";
}

export function recentRecordStarters(logs: readonly BehaviorLog[], limit = TALK_STARTER_LIMIT): TalkStarter[] {
  return [...logs]
    .filter((log) => log.contentSource !== "ai_draft" && Boolean((log.trigger || log.notes || "").trim()) && Boolean(log.timestamp))
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0))
    .slice(0, limit)
    .map((log) => ({ id: log.id, kind: starterKind(log), words: (log.trigger || log.notes || "").trim(), at: log.timestamp }));
}
