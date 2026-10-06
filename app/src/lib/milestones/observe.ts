/**
 * B-LOOP-04 — THE milestone write seam. One pure builder decides the stored
 * document for a parent's answer ("Seen it" · "Not yet" · "Not sure"); the
 * context's `setMilestoneObservation` writes what it returns, and every
 * surface that answers a milestone (the Milestones tab, Today's Notice card,
 * the journal shelf header, the capture proposal of B-LOOP-06) goes through
 * that one call — so the same answer produces a byte-identical document
 * wherever it was given (pinned in observe.test.ts).
 *
 * FIREWALL: the document records what the parent SAW and when they say they
 * saw it. It never stores an age comparison, a verdict or a "late" flag;
 * "not yet" and "not sure" clear the seen date and are never counted as a
 * fact about the child (lib/observations folds only `checked`).
 */
import type { Milestone } from "../../types";

export type ObserveStatus = "yes" | "not_sure" | "not_yet";
export type ObservedWhen = NonNullable<Milestone["observedWhen"]>;
export type ObserveSource = NonNullable<Milestone["observationSource"]>;

/** The three answers, in display order ("Seen it" leads). */
export const OBSERVE_STATUSES: readonly ObserveStatus[] = ["yes", "not_yet", "not_sure"];

/** The three "When?" answers, in display order (NoticeCard). */
export const OBSERVED_WHEN: readonly ObservedWhen[] = ["today", "this_week", "earlier"];

export interface ObserveOptions {
  /** The clock (ISO string or Date); defaults to now. */
  now?: Date | string;
  /** "When?" — only meaningful on "yes"; defaults to "today". */
  when?: ObservedWhen;
  /** Who wrote it; defaults to the parent. */
  source?: ObserveSource;
  /** B-LOOP-06: the behaviour-log id whose words proposed the answer. */
  provenance?: string;
}

const iso = (now: Date | string | undefined): string => {
  if (typeof now === "string") return now;
  return (now ?? new Date()).toISOString();
};

/** The seen-fields one answer owns; a new answer replaces all of them. */
const SEEN_FIELDS = ["observedAt", "observedWhen", "observationSource", "observationProvenance"] as const;

/**
 * The stored document for an answer. Pure: the same milestone, answer and
 * options give the same document. Keys are only ever omitted, never written
 * as `undefined` (Firestore refuses undefined values).
 */
export function observeMilestoneDoc(m: Milestone, status: ObserveStatus, opts: ObserveOptions = {}): Milestone {
  const rest: Milestone = { ...m };
  for (const k of SEEN_FIELDS) delete rest[k];
  const at = iso(opts.now);
  const base: Milestone = {
    ...rest,
    checked: status === "yes",
    observationStatus: status,
    observationUpdatedAt: at,
  };
  if (status !== "yes") return base;
  return {
    ...base,
    observedAt: at,
    observedWhen: opts.when ?? "today",
    observationSource: opts.source ?? "parent_typed",
    ...(opts.provenance ? { observationProvenance: opts.provenance } : {}),
  };
}

/** Local YYYY-MM-DD of an instant (the parent's day, not UTC's). */
export function localDay(at: Date | string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  if (!Number.isFinite(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** True when the parent answered this milestone (any answer) on `now`'s local day. */
export function answeredToday(m: Pick<Milestone, "observationUpdatedAt">, now: Date = new Date()): boolean {
  if (!m.observationUpdatedAt) return false;
  return localDay(m.observationUpdatedAt) === localDay(now);
}
