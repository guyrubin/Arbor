import type { BehaviorLog, Milestone } from "../types";
import type { KeepsakeDoc } from "./firstsKeepsake";
import type { NoticeTarget } from "./noticeNavigation";
import { keptDay } from "./kept/keptThings";
import { parentWritten } from "./kept/parentWritten";
import { NOTICE_HANDOFF_COPY } from "../components/companion/noticeHandoffCopy";
import type { ReviewedPortraitSource } from "../components/companion/portraitEvidence";
import type { ConsultPacket } from "../consult/packet";

export type NoticeSource = ReviewedPortraitSource & { kind: "answer" | "kept" | "moment"; label: string };
export interface NoticeSourceProjection {
  state: "ready" | "unanswered" | "unavailable";
  title: string;
  sources: NoticeSource[];
}
export interface NoticeSourceRecords {
  target: NoticeTarget;
  activeChildId: string;
  /** Hydrated catalogue title is context; only a saved document proves an answer. */
  milestone: Milestone | null;
  savedMilestone: Milestone | null;
  keepsake: KeepsakeDoc | null;
  linkedMoment: BehaviorLog | null;
}

/** Pure projection of exact original records. It never mines nearby history. */
export function resolveNoticeSources(input: NoticeSourceRecords, he: boolean): NoticeSourceProjection {
  const c = NOTICE_HANDOFF_COPY[he ? "he" : "en"];
  const { target, milestone, savedMilestone: saved, keepsake, linkedMoment } = input;
  const unavailable: NoticeSourceProjection = { state: "unavailable", title: "", sources: [] };
  if (target.childId !== input.activeChildId || !milestone || !saved || milestone.id !== target.milestoneId || saved.id !== target.milestoneId) return unavailable;
  const title = typeof milestone.title === "string" ? milestone.title.trim() : "";
  if (!title) return unavailable;
  const status = saved.observationStatus ?? (saved.checked === true ? "yes" : null);
  if (!status) return { state: "unanswered", title, sources: [] };
  if (status !== "yes" && status !== "not_yet" && status !== "not_sure") return unavailable;
  // An imported AI draft must not acquire parent authorship by being displayed.
  const source = saved.observationSource;
  if (source !== undefined && source !== "parent_typed" && source !== "ai_proposed_parent_confirmed") return unavailable;
  // Bibliographic source and observationSource are checked separately; the
  // shared negative-authorship guard still excludes drafts and imported quotes.
  if (!parentWritten({ ...saved, source: undefined, observationSource: undefined })) return unavailable;
  const provenance = typeof saved.observationProvenance === "string" ? saved.observationProvenance : "";
  if (source === "ai_proposed_parent_confirmed" && !provenance) return unavailable;
  if (provenance && (source !== "ai_proposed_parent_confirmed" || !linkedMoment || linkedMoment.id !== provenance
    || linkedMoment.milestoneId && linkedMoment.milestoneId !== target.milestoneId || !parentWritten(linkedMoment))) return unavailable;
  const observedDay = status === "yes" && saved.observedAt ? keptDay(saved.observedAt) : null;
  const answerDay = saved.observationUpdatedAt ? keptDay(saved.observationUpdatedAt) : null;
  const when = observedDay ? `${saved.observedWhen === "this_week" ? c.duringWeek : saved.observedWhen === "earlier" ? c.beforeDay : c.onDay}: ${observedDay}` : "";
  const sourceLabel = source === "parent_typed" ? c.parent : source === "ai_proposed_parent_confirmed" ? c.confirmed : c.legacy;
  const sources: NoticeSource[] = [{
    childId: target.childId, id: `milestones:${saved.id}`, kind: "answer", label: c.answer,
    at: answerDay ?? observedDay ?? c.dateMissing, source: sourceLabel,
    text: [title, c[status], when, answerDay ? `${c.answerRecorded}: ${answerDay}` : ""].filter(Boolean).join(" · "),
  }];
  // The keepsake is the current same-id document, not a Tonight quote or an
  // imported duplicate that happens to mention the same milestone.
  if (keepsake && keepsake.id === target.milestoneId && keepsake.milestoneId === target.milestoneId && keepsake.kind === undefined
    && parentWritten(keepsake) && typeof keepsake.note === "string" && keepsake.note.trim() && keptDay(keepsake.noticedOn)) {
    sources.push({ childId: target.childId, id: `keepsakes:${keepsake.id}`, kind: "kept", label: c.kept, at: keepsake.noticedOn,
      source: c.parentWords, text: keepsake.note.trim() });
  }
  if (provenance && linkedMoment) {
    const at = keptDay(linkedMoment.timestamp);
    if (!at) return unavailable;
    const parts = [[c.trigger, linkedMoment.trigger], [c.response, linkedMoment.response], [c.notes, linkedMoment.notes], [c.resolution, linkedMoment.resolutionNotes]]
      .filter((pair): pair is [string, string] => typeof pair[1] === "string" && !!pair[1].trim())
      .map(([label, text]) => `${label}: ${text.trim()}`);
    if (!parts.length) return unavailable;
    sources.push({ childId: target.childId, id: `behaviorLogs:${linkedMoment.id}`, kind: "moment", label: c.moment,
      at: linkedMoment.timestamp, source: c.linkedWords, text: parts.join(" · ") });
  }
  return { state: "ready", title, sources };
}

/** The existing Care serializer remains the only egress. No unrelated child
 * record, catalogue age comparison, count or score enters this small packet. */
export function noticeCarePacket(sources: readonly NoticeSource[], childLabel: string, at: string, he: boolean, demo = false): ConsultPacket {
  const c = NOTICE_HANDOFF_COPY[he ? "he" : "en"];
  return { childLabel, generatedAt: at, ...(demo ? { demo: true as const } : {}), sections: [
    { id: "development", title: c.development, items: sources.filter(s => s.kind === "answer").map(s => ({ id: s.id, text: `${s.text} · ${c.source}: ${s.source} · ${c.date}: ${s.at}` })) },
    { id: "moments", title: c.moments, items: sources.filter(s => s.kind !== "answer").map(s => ({ id: s.id, text: `${s.text} · ${c.source}: ${s.source} · ${c.date}: ${s.at}` })) },
  ].filter(section => section.items.length) };
}
