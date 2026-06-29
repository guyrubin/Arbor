import React from "react";
import { useArbor } from "../../context/ArborContext";
import { usePracticeData } from "../../practice/usePracticeData";
import { track } from "../../lib/analytics";
import type { PracticeEvent } from "../../types";
import EarlyReadingTrack from "./EarlyReadingTrack";

/* Spell Forge world — the early-reading track (letter tracing + phonics), given
   its own Hero Arcade entry. Supplies the language-domain event logger that
   EarlyReadingTrack expects (same shape SpeechCoachTab used when it hosted it). */

export default function SpellForgeWorld() {
  const { childProfile } = useArbor();
  const data = usePracticeData(childProfile.id);
  const first = childProfile.name.split(" ")[0];

  const onLog = (kind: PracticeEvent["kind"], correct?: boolean, meta?: string, score?: number) => {
    const event: PracticeEvent = {
      id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      domain: "language",
      correct,
      score,
      meta,
      timestamp: new Date().toISOString(),
    };
    void data.events.upsert(event);
    track("practice_event", { kind, domain: "language", correct });
  };

  return <EarlyReadingTrack age={childProfile.age} first={first} onLog={onLog} />;
}
