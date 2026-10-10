import type { BehaviorLog } from "../types";
import { buildTimeline, type TimelineSignal } from "./signalTimeline";
import { momentLogId } from "./journalFilters";

/** Journal is the editable record, so every persisted parent-log identity
 * remains reachable, even if the story folded similar words in one minute.
 * Reuse the canonical row builder and the already-loaded logs; no extra read.
 * Child activity/word-day folds stay exactly as the shared timeline supplies. */
export function journalRecordSignals(timeline: readonly TimelineSignal[], logs: readonly BehaviorLog[]): TimelineSignal[] {
  return [...timeline.filter((signal) => momentLogId(signal) === null), ...buildTimeline({ behaviorLogs: [...logs] })]
    .sort((a, b) => {
      if (a.at && b.at) return a.at < b.at ? 1 : a.at > b.at ? -1 : 0;
      if (a.at) return -1;
      if (b.at) return 1;
      return 0;
    });
}
