import { useArbor } from "../context/ArborContext";
import { usePracticeData } from "./usePracticeData";
import { track } from "../lib/analytics";
import type { PracticeEvent } from "../types";

/* Shared practice-event logger for the Arcade's own games (Beat Keeper, Pattern
 * Power, Hero Pose). Same upsert shape the existing tabs use, in one place so
 * each new game just calls log(kind, domain, { correct, score, meta }). */

export function useArcadeLogger() {
  const { childProfile } = useArbor();
  const data = usePracticeData(childProfile.id);

  const log = (
    kind: PracticeEvent["kind"],
    domain: PracticeEvent["domain"],
    opts: { correct?: boolean; score?: number; meta?: string } = {},
  ) => {
    const event: PracticeEvent = {
      id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      domain,
      correct: opts.correct,
      score: opts.score,
      meta: opts.meta,
      timestamp: new Date().toISOString(),
    };
    void data.events.upsert(event);
    track("practice_event", { kind, domain, correct: opts.correct });
  };

  return { childProfile, first: childProfile.name.split(" ")[0], log };
}
