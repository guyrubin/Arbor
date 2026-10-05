/* W2-CAREPRO r2 — counts from the record (pure; law 1: numerators only).
 * Shared by #/reports (B-CAREPRO-NEW-2e lead line) and Consult's step-2 head. */
import type { BehaviorLog, Milestone } from "../types";
import { appointmentStartMs, consultAudienceForProfession, type Appointment, type AppointmentFollowUp, type AppointmentProfession } from "./careTrack";

const WEEK_MS = 7 * 86_400_000;

/** B-CAREPRO-NEW-2e — the lead line's counts, numerators only: moments logged
 *  and milestones the parent marked since the last save (else this week). No
 *  denominator, no delta, no direction word. */
export function reportsLeadCounts(input: {
  logs: readonly Pick<BehaviorLog, "timestamp">[];
  milestones: readonly Pick<Milestone, "checked" | "observationUpdatedAt">[];
  sinceIso: string | null;
  nowMs: number;
}): { moments: number; milestones: number; sinceMs: number } {
  const since = input.sinceIso ? new Date(input.sinceIso).getTime() : NaN;
  const sinceMs = Number.isFinite(since) ? since : input.nowMs - WEEK_MS;
  const after = (iso?: string) => {
    const t = iso ? new Date(iso).getTime() : NaN;
    return Number.isFinite(t) && t > sinceMs && t <= input.nowMs;
  };
  return {
    moments: input.logs.filter((l) => after(l.timestamp)).length,
    milestones: input.milestones.filter((m) => m.checked && after(m.observationUpdatedAt)).length,
    sinceMs,
  };
}


/** W2-CAREPRO c2 r1 — the parent's OWN words on a log, wherever capture
 *  stores them. The one capture sheet (addMoment → buildMomentLog) writes a
 *  moment's words to `trigger` and never sets `notes`; only the Behaviors full
 *  form writes `notes`. Three readers (Reports' kept quote, Appointments'
 *  worth-bringing well, Consult's since-moment) filtered on `notes` alone and
 *  never rendered for a real moment. Never `response`, never AI text. */
export function parentWords(log: { behaviorType?: string; trigger?: string; notes?: string }): string {
  const notes = (log.notes ?? "").trim();
  if (notes) return notes;
  return log.behaviorType === "Moment" ? (log.trigger ?? "").trim() : "";
}

/** W2-CAREPRO c2 r1 — when the record starts: the earliest log or noticed
 *  milestone, else null (an empty record). Shared by #/reports' first-visit
 *  lead and Consult's "since you started" anchor. */
export function recordStartIso(
  logs: readonly Pick<BehaviorLog, "timestamp">[],
  milestones: readonly { checked?: boolean; observationUpdatedAt?: string }[],
): string | null {
  const times = [
    ...logs.map((l) => l.timestamp),
    ...milestones.filter((m) => m.checked && m.observationUpdatedAt).map((m) => m.observationUpdatedAt as string),
  ].map((x) => new Date(x).getTime()).filter((x) => Number.isFinite(x));
  return times.length ? new Date(Math.min(...times)).toISOString() : null;
}

/** W2-CAREPRO c2 r1 (consult product P1 G1) — what "What changed" is
 *  measured from, NAMED, never a bare synthetic date. Order: the last visit
 *  with this audience's profession (careTrack), with the parent's after-visit
 *  note → the last share with this audience → since the record started. */
export type ConsultAnchor =
  | { kind: "visit"; iso: string; profession: AppointmentProfession; note: string | null }
  | { kind: "share"; iso: string }
  | { kind: "start"; iso: string }
  | { kind: "none" };
export function consultAnchor(input: {
  audience: string;
  appointments: readonly Appointment[];
  followUps: readonly AppointmentFollowUp[];
  lastSharedIso: string | null;
  logs: readonly Pick<BehaviorLog, "timestamp">[];
  milestones: readonly { checked?: boolean; observationUpdatedAt?: string }[];
  nowMs: number;
}): ConsultAnchor {
  const visits = input.appointments
    .filter((a) => a.profession && consultAudienceForProfession(a.profession) === input.audience)
    .map((a) => ({ a, start: appointmentStartMs(a) }))
    .filter((v): v is { a: Appointment; start: number } => v.start != null && v.start <= input.nowMs)
    .sort((x, y) => y.start - x.start);
  const last = visits[0];
  if (last) {
    const notes = input.followUps.filter((f) => f.apptId === last.a.id && f.note.trim()).sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1));
    return { kind: "visit", iso: new Date(last.start).toISOString(), profession: last.a.profession as AppointmentProfession, note: notes[0]?.note.trim() ?? null };
  }
  if (input.lastSharedIso) return { kind: "share", iso: input.lastSharedIso };
  const start = recordStartIso(input.logs, input.milestones);
  return start ? { kind: "start", iso: start } : { kind: "none" };
}
