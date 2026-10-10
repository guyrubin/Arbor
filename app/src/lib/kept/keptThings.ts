import type { BehaviorLog, Milestone } from "../../types";
import type { LangObservation } from "../../growth/vocabAgg";
import type { KeepsakeDoc } from "../firstsKeepsake";
import { toObservations, type ObservationChild, type ObservationSources } from "../observations";
import { MOMENT_BEHAVIOR_TYPE, isIncidentType } from "../../content/behaviorTaxonomy";

export type KeptKind = "said" | "first" | "by_herself" | "week";
export type KeptThing = {
  id: string;
  kind: KeptKind;
  at: string;
  text: string;
  language?: string;
  area?: string;
  attribution: "parent";
};

export type KeptSources = Pick<ObservationSources, "behaviorLogs" | "milestones" | "langObs"> & {
  keepsakes?: readonly KeepsakeDoc[];
};

/** Existing parent-write schemas have no source field. Fail closed if a row
 * does carry different provenance, including future AI/practice imports. */
function parentWritten(row: object): boolean {
  if (!row || typeof row !== "object") return false;
  const value = row as Record<string, unknown>;
  return !value.conversationProposalId
    && value.captureSource !== "co_parent"
    && (value.source === undefined || value.source === "parent_typed" || value.source === "parent_voice")
    && (value.observationSource === undefined || value.observationSource === "parent_typed" || value.observationSource === "parent_voice");
}

/** Date-only parent entries retain their chosen day; instants use UTC. Reject
 * invalid calendar days rather than rolling February 30 into another month. */
export function keptDay(at: string): string | null {
  if (typeof at !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(at)) return null;
  const writtenDay = at.slice(0, 10);
  const calendarDay = new Date(`${writtenDay}T12:00:00Z`);
  if (!Number.isFinite(calendarDay.getTime()) || calendarDay.toISOString().slice(0, 10) !== writtenDay) return null;
  const ms = Date.parse(at);
  if (!Number.isFinite(ms)) return null;
  const day = new Date(ms).toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(at) && day !== at ? null : day;
}

/** Read-only, count-free view of explicitly parent-kept words and firsts.
 * Never mines an incident, a practice event, or AI text for a quote. Quotes
 * remain outside the observation record, preserving B-LOOP-10's firewall. */
export function keptThings(sources: KeptSources, child: ObservationChild): KeptThing[] {
  const words = (sources.langObs ?? []).filter(parentWritten);
  const moments = (sources.behaviorLogs ?? []).filter(parentWritten);
  const notes = (sources.keepsakes ?? []).filter(parentWritten);
  const notesByMilestone = new Map(notes.filter(row => !row.kind && row.milestoneId && typeof row.note === "string" && row.note.trim() && keptDay(row.noticedOn)).map(row => [row.milestoneId, row]));
  // Older seen milestones may predate observation timestamps; the parent's
  // saved note has its own honest date and supplies it without a migration.
  const milestones = (sources.milestones ?? []).filter(parentWritten).map(row => ({ ...row,
    observedAt: notesByMilestone.get(row.id)?.noticedOn ?? row.observedAt,
  }));
  const observations = toObservations({ milestones, langObs: words, behaviorLogs: moments }, child);
  const milestoneById = new Map<string, Milestone>(milestones.map(row => [row.id, row]));
  const momentById = new Map<string, BehaviorLog>(moments.map(row => [row.id, row]));
  const wordById = new Map<string, LangObservation>(words.map(row => [row.id, row]));
  const result: KeptThing[] = [];
  const add = (item: KeptThing) => { if (typeof item.text === "string" && item.text.trim() && keptDay(item.at)) result.push(item); };

  for (const observation of observations) {
    if (observation.source !== "parent_typed" && observation.source !== "parent_voice") continue;
    const common = { id: observation.id, at: observation.at, area: observation.domains[0], attribution: "parent" as const };
    if (observation.origin === "langObs" && observation.value.type === "word") {
      const word = wordById.get(observation.id.slice("langObs:".length));
      if (word) add({ ...common, kind: "said", text: word.phrase, language: word.language });
    } else if (observation.origin === "milestones" && observation.value.type === "milestone") {
      const milestone = milestoneById.get(observation.value.milestoneId);
      const note = notesByMilestone.get(observation.value.milestoneId);
      if (milestone?.checked && (!milestone.observationStatus || milestone.observationStatus === "yes")) {
        add({ ...common, kind: "first", at: note?.noticedOn ?? common.at, text: note?.note ?? milestone.title });
      }
    } else if (observation.origin === "behaviorLogs" && observation.value.type === "moment") {
      const moment = momentById.get(observation.id.slice("behaviorLogs:".length));
      // Explicit plain-moment allowlist also rejects unknown future incident types.
      if (!moment || isIncidentType(moment.behaviorType) || moment.behaviorType !== MOMENT_BEHAVIOR_TYPE) continue;
      if (moment.kept === "said" || moment.kept === "first" || moment.kept === "by_herself") {
        add({ ...common, kind: moment.kept, text: moment.trigger });
      }
    }
  }
  for (const note of notes) {
    if (note.kind === "quote" && !note.milestoneId && typeof note.id === "string" && typeof note.note === "string") {
      const language = (note as KeepsakeDoc & { language?: string }).language;
      add({ id: `keepsakes:${note.id}`, kind: "said", at: note.noticedOn, text: note.note, ...(typeof language === "string" ? { language } : {}), attribution: "parent" });
    }
  }
  return result.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id));
}

export function keptByMonth(items: readonly KeptThing[]): { monthKey: string; items: KeptThing[] }[] {
  const groups = new Map<string, KeptThing[]>();
  for (const item of items) {
    const month = keptDay(item.at)?.slice(0, 7);
    if (!month) continue;
    groups.set(month, [...(groups.get(month) ?? []), item]);
  }
  return [...groups].sort(([a], [b]) => b.localeCompare(a)).map(([monthKey, rows]) => ({
    monthKey, items: rows.slice().sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id)),
  }));
}
