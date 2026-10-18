import { useEffect, useRef, useState } from "react";
import { useArbor } from "../context/ArborContext";
import { useAuth } from "../context/AuthContext";
import { useChildCollection } from "./useChildCollection";
import { keepsakeDoc, keepsakeMapFromDocs, localDayKey, upsertKeepsake, type KeepsakeDoc } from "../lib/firstsKeepsake";
import { parentWritten } from "../lib/kept/parentWritten";
import type { ObserveStatus, ObservedWhen } from "../lib/milestones/observe";
import type { Milestone } from "../types";

/** One state/write contract for the same observation on Now, a shelf and its detail. */
export interface NoticeActionProps {
  scopeKey: string;
  selected: ObserveStatus | null;
  observedWhen: ObservedWhen | null;
  observedAt: string | null;
  savedWords: string | null;
  savedAt: string | null;
  inlineEvidenceAllowed?: boolean;
  confirmed: boolean;
  onAnswer: (status: ObserveStatus) => Promise<void>;
  onWhen: (when: ObservedWhen) => Promise<void>;
  onKeepQuote: (text: string) => Promise<void>;
  onUndo?: () => Promise<{ selected: ObserveStatus | null; observedWhen: ObservedWhen | null }>;
  onOpen?: () => void;
  onDetails?: () => void;
}

type NoticeLifetime = {
  key: string;
  active: boolean;
  /** The first answer's immutable snapshot survives retries and date refinement. */
  before: Map<string, Milestone>;
  pending: Map<string, { key: string; promise: Promise<unknown> }>;
  retries: Map<string, { key: string; at: string }>;
  quoteRetries: Map<string, KeepsakeDoc>;
};

/** Remove only the parent's answer. Catalogue content and separate evidence survive. */
export function withoutNoticeAnswer(milestone: Milestone): Milestone {
  const next = { ...milestone, checked: false };
  delete next.observationStatus;
  delete next.observationUpdatedAt;
  delete next.observedAt;
  delete next.observedWhen;
  delete next.observationSource;
  delete next.observationProvenance;
  return next;
}

const ACKNOWLEDGED = { requireAcknowledgement: true } as const;

/** The inline words belong to this exact parent-written milestone record. */
function parentNoticeKeepsake(doc: KeepsakeDoc | undefined, milestoneId: string) {
  if (!doc || doc.id !== milestoneId || doc.milestoneId !== milestoneId || doc.kind !== undefined || !parentWritten(doc)) return undefined;
  return keepsakeMapFromDocs([doc])[milestoneId];
}

/**
 * Existing milestone + keepsake records, with a per-surface edit lifetime.
 * A queued Firestore write never resolves one of these callbacks as saved.
 * Its retry replaces the same document; Undo never deletes a separate note.
 */
export function useNoticeActions() {
  const { childProfile, milestones, milestonesLoaded, milestonesConfirmed, setMilestoneObservation, restoreMilestone } = useArbor();
  const { user } = useAuth();
  const keepsakes = useChildCollection<KeepsakeDoc>(childProfile.id, "keepsakes", { trackConfirmation: true });
  const scopeKey = `${user?.uid ?? "signed-out"}:${childProfile.id}`;
  const lifetimeRef = useRef<NoticeLifetime | null>(null);
  if (!lifetimeRef.current || lifetimeRef.current.key !== scopeKey) {
    if (lifetimeRef.current) lifetimeRef.current.active = false;
    lifetimeRef.current = { key: scopeKey, active: true, before: new Map(), pending: new Map(), retries: new Map(), quoteRetries: new Map() };
  }
  const lifetime = lifetimeRef.current;
  const [, refresh] = useState(0);
  const current = useRef({ milestones, milestonesLoaded, keepsakes, setMilestoneObservation, restoreMilestone, uid: user?.uid });
  current.current = { milestones, milestonesLoaded, keepsakes, setMilestoneObservation, restoreMilestone, uid: user?.uid };
  useEffect(() => {
    lifetime.active = true;
    return () => { lifetime.active = false; };
  }, [lifetime]);

  const requireCurrent = (milestoneId: string): Milestone => {
    if (lifetimeRef.current !== lifetime || !lifetime.active || !current.current.uid) {
      throw new Error("This observation is no longer current");
    }
    const milestone = current.current.milestones.find(item => item.id === milestoneId);
    if (!current.current.milestonesLoaded || !milestone) throw new Error("The observation is no longer available");
    return milestone;
  };

  const rememberBefore = (milestone: Milestone) => {
    if (!lifetime.before.has(milestone.id)) lifetime.before.set(milestone.id, structuredClone(milestone));
  };

  const run = <T,>(milestoneId: string, key: string, write: (at: string) => Promise<T>): Promise<T> => {
    try { requireCurrent(milestoneId); } catch (error) { return Promise.reject(error); }
    const pending = lifetime.pending.get(milestoneId);
    if (pending) return pending.key === key ? pending.promise as Promise<T> : Promise.reject(new Error("An observation change is still being saved"));
    const retry = lifetime.retries.get(milestoneId);
    const at = retry?.key === key ? retry.at : new Date().toISOString();
    lifetime.retries.set(milestoneId, { key, at });
    const promise = (async () => {
      const result = await write(at);
      requireCurrent(milestoneId);
      lifetime.retries.delete(milestoneId);
      return result;
    })();
    lifetime.pending.set(milestoneId, { key, promise });
    // Also refresh on failure: the original snapshot stays available for retry/Undo.
    const finish = () => {
      if (lifetime.pending.get(milestoneId)?.promise === promise) lifetime.pending.delete(milestoneId);
      if (lifetimeRef.current === lifetime && lifetime.active) refresh(value => value + 1);
    };
    void promise.then(finish, finish);
    return promise;
  };

  const clearAnswer = (milestone: Milestone) => run(milestone.id, "clear", async () => {
    const existing = requireCurrent(milestone.id);
    rememberBefore(existing);
    await current.current.restoreMilestone(withoutNoticeAnswer(existing), ACKNOWLEDGED);
  });

  const forMilestone = (milestone: Milestone): NoticeActionProps => {
    // A host may hold the offered catalogue row while its answer changes. Its
    // identity is stable; every saved value must come from the live child row.
    const live = milestones.find(item => item.id === milestone.id);
    const exactDocument = keepsakes.items.find(item => item.id === milestone.id);
    const parentKept = parentNoticeKeepsake(exactDocument, milestone.id);
    const kept = keepsakes.confirmed && !keepsakes.error ? parentKept : undefined;
    return {
      scopeKey,
      selected: live?.observationStatus ?? (live?.checked ? "yes" : null),
      observedWhen: live?.observedWhen ?? null,
      observedAt: live?.observedAt ?? null,
      savedWords: kept?.note ?? null,
      savedAt: kept?.updatedAt ?? kept?.createdAt ?? null,
      inlineEvidenceAllowed: !exactDocument || !!parentKept,
      confirmed: milestonesConfirmed && !!live,
      onAnswer: (status) => run(milestone.id, `answer:${status}`, async (at) => {
        const existing = requireCurrent(milestone.id);
        rememberBefore(existing);
        // Reaffirming a recorded Seen it is an acknowledgement of that record,
        // not a second claim that the same event happened today.
        if (status === "yes" && existing.checked) {
          await current.current.restoreMilestone(existing, ACKNOWLEDGED);
          return;
        }
        await current.current.setMilestoneObservation(milestone.id, status, { now: at, source: "parent_typed" }, ACKNOWLEDGED);
      }),
      onWhen: (when) => run(milestone.id, `when:${when}`, async () => {
        const existing = requireCurrent(milestone.id);
        if (!existing.checked || existing.observationStatus && existing.observationStatus !== "yes") {
          throw new Error("Choose Seen it before setting when");
        }
        const anchor = existing.observedAt ?? existing.observationUpdatedAt;
        if (!anchor || !Number.isFinite(Date.parse(anchor))) throw new Error("The observation's recorded date is unavailable");
        rememberBefore(existing);
        await current.current.setMilestoneObservation(milestone.id, "yes", {
          when, now: anchor, source: existing.observationSource, provenance: existing.observationProvenance,
        }, ACKNOWLEDGED);
      }),
      onKeepQuote: (text) => run(milestone.id, `quote:${text.trim()}`, async (at) => {
        if (!text.trim()) throw new Error("Add words before keeping the moment");
        const collection = current.current.keepsakes;
        const previousAttempt = lifetime.quoteRetries.get(milestone.id);
        if (collection.error || !collection.loaded || !collection.confirmed && !previousAttempt) throw new Error("The existing moment needs to finish syncing");
        // A failed acknowledgement may leave our own same-ID write pending in
        // Firestore. Retry its known metadata instead of overwriting an unseen
        // record or requiring that pending write to finish before it can retry.
        const source = collection.confirmed ? collection.items : previousAttempt ? [previousAttempt] : [];
        const exact = source.find(item => item.id === milestone.id);
        const existing = parentNoticeKeepsake(exact, milestone.id);
        if (exact && !existing) throw new Error("Edit the attached evidence in the observation details");
        const map = existing ? { [milestone.id]: existing } : {};
        const observation = requireCurrent(milestone.id);
        if (!existing && (observation.observedWhen !== "today" || !observation.observedAt || !Number.isFinite(Date.parse(observation.observedAt)))) {
          throw new Error("Choose the moment's date in the observation details");
        }
        const next = upsertKeepsake(map, {
          milestoneId: milestone.id,
          note: text,
          noticedOn: existing?.noticedOn ?? localDayKey(new Date(observation.observedAt!)),
          ...(existing?.photoUrl ? { photoUrl: existing.photoUrl } : {}),
        }, at)[milestone.id];
        const doc = keepsakeDoc(next);
        lifetime.quoteRetries.set(milestone.id, doc);
        await collection.upsert(doc, ACKNOWLEDGED);
        requireCurrent(milestone.id);
        lifetime.quoteRetries.delete(milestone.id);
      }),
      ...(lifetime.before.has(milestone.id) ? {
        onUndo: () => run(milestone.id, "undo", async () => {
          const previous = lifetime.before.get(milestone.id);
          if (!previous) throw new Error("There is no answer to undo");
          await current.current.restoreMilestone(structuredClone(previous), ACKNOWLEDGED);
          requireCurrent(milestone.id);
          lifetime.before.delete(milestone.id);
          return {
            selected: previous.observationStatus ?? (previous.checked ? "yes" : null),
            observedWhen: previous.observedWhen ?? null,
          };
        }),
      } : {}),
    };
  };

  const isCurrent = () => lifetimeRef.current === lifetime && lifetime.active && !!current.current.uid;
  return { scopeKey, keepsakes, forMilestone, clearAnswer, isCurrent, loaded: milestonesLoaded, confirmed: milestonesConfirmed };
}
