/**
 * Family plan v1: what a co-parent sees of the family plan, and the pure
 * rules for what they may change. Shared by the server (which builds the view
 * from the owner's rows on a live share grant) and the co-parent's client.
 *
 * A co-parent reads the plan's dates (name, day, time, the message line, who
 * has it) and, for a request addressed to them, the asker's note. They may
 * answer a request addressed to them (yes / not this one) for the version it
 * was asked for, and mark done a date they have. Nothing else.
 */
import { answerRequest, markDone, stateOf, type FamilyPlanAdult, type FamilyPlanDate, type FamilyPlanState } from "./model";

export interface CoParentPlanDate {
  id: string;
  kind: FamilyPlanDate["kind"];
  title: string;
  date: string;
  time?: string;
  sourceLine?: string;
  version: number;
  status: FamilyPlanDate["status"];
  state: FamilyPlanState;
  holderIsYou: boolean;
  /** The sign-in email of the adult who has it, when it is not you. */
  holderEmail?: string | null;
  /** A request: full detail only when it is addressed to you. */
  request?: {
    forYou: boolean;
    status: "asked" | "accepted" | "declined" | "closed";
    askedAt: string;
    forVersion: number;
    note?: string;
  };
  prep: { text: string; done: boolean }[];
  /** Earlier days/times, oldest first (the change the adult is asked again for). */
  previous: { date: string; time?: string }[];
}

export interface CoParentFamilyPlan {
  childName: string;
  ownerEmail: string | null;
  dates: CoParentPlanDate[];
}

export function coParentDateView(item: FamilyPlanDate, actorUid: string): CoParentPlanDate {
  const req = item.request ?? null;
  const forYou = req?.toUid === actorUid;
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    date: item.date,
    ...(item.time ? { time: item.time } : {}),
    ...(item.sourceLine ? { sourceLine: item.sourceLine } : {}),
    version: item.version,
    status: item.status,
    state: stateOf(item),
    holderIsYou: item.holder?.uid === actorUid,
    ...(item.holder && item.holder.uid !== actorUid ? { holderEmail: item.holder.email ?? null } : {}),
    ...(req
      ? { request: { forYou, status: req.status, askedAt: req.askedAt, forVersion: req.forVersion, ...(forYou && req.note ? { note: req.note } : {}) } }
      : {}),
    prep: (item.prep ?? []).map((p) => ({ text: p.text, done: p.done })),
    previous: (item.previous ?? []).map((p) => ({ date: p.date, ...(p.time ? { time: p.time } : {}) })),
  };
}

export type CoParentPlanError = "not_found" | "not_asked" | "not_for_you" | "date_changed" | "not_yours";

/** The co-parent answers a request addressed to them. */
export function coParentAnswer(item: FamilyPlanDate | null, actor: FamilyPlanAdult, answer: "yes" | "no", version: number, nowIso: string):
  { ok: true; item: FamilyPlanDate; changed: boolean } | { ok: false; error: CoParentPlanError } {
  if (!item || item.status !== "open") return { ok: false, error: "not_found" };
  return answerRequest(item, actor, answer, version, nowIso);
}

/** The co-parent marks done a date they have. */
export function coParentDone(item: FamilyPlanDate | null, actorUid: string, nowIso: string):
  { ok: true; item: FamilyPlanDate; changed: boolean } | { ok: false; error: CoParentPlanError } {
  if (!item || item.status === "cancelled") return { ok: false, error: "not_found" };
  if (item.holder?.uid !== actorUid) return { ok: false, error: "not_yours" };
  if (item.status === "done") return { ok: true, item, changed: false };
  return { ok: true, item: markDone(item, actorUid, nowIso), changed: true };
}
