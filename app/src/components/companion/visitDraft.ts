import { useMemo } from "react";
import { useArbor } from "../../context/ArborContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { getLastExportedAt } from "../../consult/exportHistory";
import { consultAnchor, reportsLeadCounts } from "../../lib/recordCounts";
import { consultAudienceForProfession, type Appointment, type AppointmentFollowUp } from "../../lib/careTrack";
import type { LangObservation } from "../../growth/vocabAgg";
import type { BehaviorLog } from "../../types";

/* v4.1 (12 Nov) — "A quiet two minutes: the visit summary is drafted."

   The Care page assembles the visit page from the record the moment it
   opens (AskSpecialist's packet and its word-for-word preview), and nothing
   leaves until the parent sends it, so "drafted" is true. The number is the
   same one Care's step-2 head shows: moments kept since the NAMED anchor
   (the last past visit with this profession, else the last share with that
   audience, else the start of the record), counted by the one count reader.
   No profession, or nothing kept since the anchor: null, and Now keeps its
   plain visit line (a summary "built from 0 moments" would be hollow). */

export type VisitDraftAnchor = "visit" | "share" | "start";
export interface VisitDraft { moments: number; anchor: VisitDraftAnchor }

export function visitDraftCount(input: {
  visit: Pick<Appointment, "profession"> | null | undefined;
  appointments: readonly Appointment[];
  followUps: readonly AppointmentFollowUp[];
  lastSharedIso: (audience: string) => string | null;
  logs: readonly BehaviorLog[];
  milestones: readonly { checked?: boolean; observationUpdatedAt?: string }[];
  langObs?: readonly { timestamp?: string | null; language?: string | null; phrase?: string | null }[];
  nowMs: number;
}): VisitDraft | null {
  const profession = input.visit?.profession;
  if (!profession) return null;
  const audience = consultAudienceForProfession(profession);
  const anchor = consultAnchor({
    audience,
    appointments: input.appointments,
    followUps: input.followUps,
    lastSharedIso: input.lastSharedIso(audience),
    logs: input.logs,
    milestones: input.milestones,
    nowMs: input.nowMs,
  });
  if (anchor.kind === "none") return null;
  // Exactly Care's arithmetic: "since you started" counts the first entry too.
  const countFromIso = anchor.kind === "start" ? new Date(new Date(anchor.iso).getTime() - 1).toISOString() : anchor.iso;
  const { moments } = reportsLeadCounts({
    logs: input.logs,
    milestones: input.milestones,
    langObs: input.langObs,
    sinceIso: countFromIso,
    nowMs: input.nowMs,
    wholeRecord: anchor.kind === "start",
  });
  return moments >= 1 ? { moments, anchor: anchor.kind } : null;
}

/** The drafted visit summary for Now's upcoming visit, or null. */
export function useVisitDraft(visit: Appointment | null | undefined, now: Date): VisitDraft | null {
  const { childProfile, behaviorLogs, milestones } = useArbor();
  const childId = childProfile.id;
  const appts = useChildCollection<Appointment>(childId, "appointments");
  const followUps = useChildCollection<AppointmentFollowUp>(childId, "apptFollowUps");
  const langObs = useChildCollection<LangObservation>(childId, "langObs", { orderByField: "timestamp", orderDir: "desc", max: 200 });
  const nowMs = now.getTime();
  return useMemo(() => visitDraftCount({
    visit,
    appointments: appts.items,
    followUps: followUps.items,
    lastSharedIso: (audience) => getLastExportedAt(childId, audience),
    logs: behaviorLogs ?? [],
    milestones: milestones ?? [],
    langObs: langObs.items,
    nowMs,
  }), [visit, appts.items, followUps.items, childId, behaviorLogs, milestones, langObs.items, nowMs]);
}
