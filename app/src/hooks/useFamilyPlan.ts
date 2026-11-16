/**
 * Family plan v1 — the client side of the plan.
 *
 * `useFamilyPlanDates(childId)` is the cheap read the Now screen uses for its
 * one line (the week's dates, their states, the counts, the queued in-app
 * reminders and the open requests); it rides the same child collection the
 * Family plan screen reads, so both share one listener's cache.
 *
 * `useFamilyPlan(childId)` adds the adults in the family (the owner and the
 * co-parents who joined on a share grant, from the existing sharing model)
 * and every parent action. Each action writes the row through the child
 * collection (Firestore when signed in, this device in the sandbox), returns
 * one receipt with Undo (B-STATUS-01: one receipt and Undo for parent
 * actions), and fires a counts-only analytics event (no names, no text).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChildCollection, type ChildCollection } from "./useChildCollection";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { track } from "../lib/analytics";
import {
  FAMILY_PLAN_COLLECTION, addPrep, applyChange, askAdult, cancelDate, createDate, dropPendingChange, editDate, holdChange, markDone, takeIt, togglePrep,
  type FamilyPlanAdult, type FamilyPlanDate, type FamilyPlanKind, type NewDateInput,
} from "../lib/familyPlan/model";
import { datesInWindow, lanes, openRequests, planCounts, planWindow, reminders, type PlanCounts, type PlanReminder, type PlanWindow, type Lane } from "../lib/familyPlan/week";
import { matchDraft } from "../lib/familyPlan/match";
import type { ShareGrant } from "../types";

/** Firestore refuses `undefined`; rows are plain JSON. */
const plain = <T,>(row: T): T => JSON.parse(JSON.stringify(row)) as T;

const newId = (prefix: string) => `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

/** Re-render once a minute so "queued" turns into "due" and the window rolls at midnight. */
function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

export interface FamilyPlanWeek {
  loaded: boolean;
  /** Every stored row (any status, any day). */
  all: FamilyPlanDate[];
  window: PlanWindow;
  /** The dates in the plan window, soonest first (cancelled left out). */
  dates: FamilyPlanDate[];
  counts: PlanCounts;
  reminders: PlanReminder[];
  openRequests: FamilyPlanDate[];
}

/** The week's dates and states for one child (cheap: one cached child-collection listener). */
export function useFamilyPlanDates(childId: string): FamilyPlanWeek & { collection: ChildCollection<FamilyPlanDate>; now: Date } {
  const collection = useChildCollection<FamilyPlanDate>(childId, FAMILY_PLAN_COLLECTION, { trackConfirmation: true });
  const now = useMinuteClock();
  const minute = Math.floor(now.getTime() / 60_000);
  const derived = useMemo(() => {
    const w = planWindow(now);
    const dates = datesInWindow(collection.items, w);
    return { window: w, dates, counts: planCounts(dates), reminders: reminders(dates, now), openRequests: openRequests(dates) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection.items, minute]);
  return { loaded: collection.loaded, all: collection.items, ...derived, collection, now };
}

export type FamilyPlanAdults = { state: "loading" | "ready" | "failed" | "signed-out"; adults: FamilyPlanAdult[]; invited: ShareGrant[] };

/** The owner, then the co-parents who joined this child's family on a share grant. */
export function useFamilyAdults(childId: string): FamilyPlanAdults & { me: FamilyPlanAdult } {
  const { user } = useAuth();
  const uid = user?.uid ?? "local-sandbox";
  const me = useMemo<FamilyPlanAdult>(() => ({ uid, role: "owner", email: user?.email ?? null }), [uid, user?.email]);
  const signedIn = !!user && uid !== "local-sandbox";
  const [roster, setRoster] = useState<{ state: FamilyPlanAdults["state"]; grants: ShareGrant[] }>({ state: signedIn ? "loading" : "signed-out", grants: [] });
  useEffect(() => {
    if (!signedIn) { setRoster({ state: "signed-out", grants: [] }); return; }
    let live = true;
    setRoster({ state: "loading", grants: [] });
    api.listShares(childId)
      .then((r) => { if (live) setRoster({ state: "ready", grants: r.shares || [] }); })
      .catch(() => { if (live) setRoster({ state: "failed", grants: [] }); });
    return () => { live = false; };
  }, [childId, signedIn]);
  const family = roster.grants.filter((g) => g.accessMode === "family_workspace" && g.role === "co_parent" && !g.revokedAt);
  const joined: FamilyPlanAdult[] = family
    .filter((g) => g.acceptedAt && g.recipientUid)
    .map((g) => ({ uid: g.recipientUid!, role: "co_parent", email: g.recipientEmail, grantId: g.id }));
  return { state: roster.state, adults: [me, ...joined], invited: family.filter((g) => !g.acceptedAt), me };
}

/** One receipt for the last parent action, with Undo. */
export interface FamilyPlanReceipt {
  id: number;
  /** What happened, as a copy key the screen renders. */
  kind: "added" | "took" | "asked" | "changed" | "held" | "done" | "cancelled" | "prep" | "edited" | "undone" | "kept_note";
  count: number;
  undo?: () => Promise<void>;
}

export interface ReviewKeep {
  kind: FamilyPlanKind;
  title: string;
  date: string;
  time?: string;
  sourceLine?: string;
  sourceLineNo?: number;
  prep?: string[];
}

export function useFamilyPlan(childId: string) {
  const week = useFamilyPlanDates(childId);
  const roster = useFamilyAdults(childId);
  const { collection } = week;
  const { me } = roster;
  const [receipt, setReceipt] = useState<FamilyPlanReceipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const seq = useRef(0);
  const allRef = useRef(week.all);
  allRef.current = week.all;

  /** Write rows; on success the receipt's Undo restores exactly the rows before. */
  const commit = useCallback(async (kind: FamilyPlanReceipt["kind"], next: FamilyPlanDate[], count = next.length) => {
    const before = new Map(allRef.current.map((d) => [d.id, d] as const));
    setBusy(true);
    setError(false);
    try {
      for (const row of next) await collection.upsert(plain(row));
      const created = next.filter((r) => !before.has(r.id)).map((r) => r.id);
      const restored = next.map((r) => before.get(r.id)).filter((r): r is FamilyPlanDate => !!r);
      const id = ++seq.current;
      setReceipt({
        id,
        kind,
        count,
        undo: async () => {
          setBusy(true);
          try {
            for (const rid of created) await collection.remove(rid);
            for (const row of restored) await collection.upsert(plain(row));
            track("family_plan_undo", { action: kind, count });
            setReceipt({ id: ++seq.current, kind: "undone", count });
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        },
      });
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      setBusy(false);
    }
  }, [collection]);

  const find = (id: string) => allRef.current.find((d) => d.id === id) ?? null;

  /** Keep the reviewed rows. Duplicates of what is already in the plan are skipped (counted). */
  const addDates = useCallback(async (rows: ReviewKeep[], origin: "message" | "manual") => {
    const now = new Date().toISOString();
    const messageId = origin === "message" ? newId("msg") : undefined;
    const fresh: FamilyPlanDate[] = [];
    let duplicates = 0;
    for (const r of rows) {
      if (matchDraft(r, [...allRef.current, ...fresh]).kind === "duplicate") { duplicates += 1; continue; }
      const input: NewDateInput = { id: newId("fp"), kind: r.kind, title: r.title, date: r.date, time: r.time || undefined, sourceLine: r.sourceLine, sourceLineNo: r.sourceLineNo, messageId, origin, prep: r.prep };
      fresh.push(createDate(input, me.uid, now));
    }
    track("family_plan_dates_added", { count: fresh.length, duplicates_skipped: duplicates, source: origin });
    if (!fresh.length) return { added: 0, duplicates };
    const ok = await commit("added", fresh);
    return { added: ok ? fresh.length : 0, duplicates };
  }, [commit, me.uid]);

  const take = useCallback(async (id: string) => {
    const item = find(id);
    if (!item) return false;
    track("family_plan_took", { had_request: item.request?.status === "asked" });
    return commit("took", [takeIt(item, me, new Date().toISOString())], 1);
  }, [commit, me]);

  const ask = useCallback(async (id: string, to: FamilyPlanAdult, note: string) => {
    const item = find(id);
    if (!item) return false;
    track("family_plan_asked", { to_role: to.role });
    return commit("asked", [askAdult(item, me.uid, to, note, new Date().toISOString())], 1);
  }, [commit, me.uid]);

  const change = useCallback(async (id: string, to: { date: string; time?: string; sourceLine?: string }, reaskNote: string) => {
    const item = find(id);
    if (!item) return false;
    const next = applyChange(item, to, me.uid, new Date().toISOString(), reaskNote);
    track("family_plan_change_applied", { asked_again: next.request?.status === "asked", time_changed: (item.time ?? "") !== (to.time ?? ""), day_changed: item.date !== to.date });
    return commit("changed", [next], 1);
  }, [commit, me.uid]);

  /** A newer message moved a date and the parent has not decided yet: hold it ("One change to review"). */
  const hold = useCallback(async (id: string, to: { date: string; time?: string; sourceLine?: string }) => {
    const item = find(id);
    if (!item) return false;
    track("family_plan_change_held", {});
    return commit("held", [holdChange(item, to, new Date().toISOString())], 1);
  }, [commit]);

  /** Apply the held change: the old version is kept, the old reminder stops, the adult is asked again. */
  const applyHeld = useCallback(async (id: string, reaskNote: string) => {
    const item = find(id);
    if (!item?.pendingChange) return false;
    const { date, time, sourceLine } = item.pendingChange;
    const next = applyChange(item, { date, time, sourceLine }, me.uid, new Date().toISOString(), reaskNote);
    track("family_plan_change_applied", { asked_again: next.request?.status === "asked", time_changed: (item.time ?? "") !== (time ?? ""), day_changed: item.date !== date });
    return commit("changed", [next], 1);
  }, [commit, me.uid]);

  /** Keep both dates: the held change becomes a date of its own, the original stays as it is. */
  const keepBoth = useCallback(async (id: string) => {
    const item = find(id);
    if (!item?.pendingChange) return false;
    const now = new Date().toISOString();
    const p = item.pendingChange;
    const twin = createDate({ id: newId("fp"), kind: item.kind, title: item.title, date: p.date, time: p.time, sourceLine: p.sourceLine, messageId: item.messageId, origin: item.origin }, me.uid, now);
    track("family_plan_dates_added", { count: 1, duplicates_skipped: 0, source: "kept_both" });
    return commit("added", [dropPendingChange(item, now), twin], 1);
  }, [commit, me.uid]);

  const edit = useCallback(async (id: string, patch: { title?: string; kind?: FamilyPlanKind; date?: string; time?: string }, reaskNote: string) => {
    const item = find(id);
    if (!item) return false;
    try {
      return commit("edited", [editDate(item, patch, me.uid, new Date().toISOString(), reaskNote)], 1);
    } catch {
      setError(true);
      return false;
    }
  }, [commit, me.uid]);

  const done = useCallback(async (id: string) => {
    const item = find(id);
    if (!item) return false;
    track("family_plan_done", { by_role: "owner" });
    return commit("done", [markDone(item, me.uid, new Date().toISOString())], 1);
  }, [commit, me.uid]);

  const cancel = useCallback(async (id: string) => {
    const item = find(id);
    if (!item) return false;
    track("family_plan_cancelled", {});
    return commit("cancelled", [cancelDate(item, me.uid, new Date().toISOString())], 1);
  }, [commit, me.uid]);

  const prep = useCallback(async (id: string, text: string) => {
    const item = find(id);
    if (!item) return false;
    return commit("prep", [addPrep(item, text, newId("prep"), me.uid, new Date().toISOString())], 1);
  }, [commit, me.uid]);

  /** Ticking a prep line saves quietly (no receipt: it is a checklist tick). */
  const tickPrep = useCallback(async (id: string, prepId: string) => {
    const item = find(id);
    if (!item) return;
    try { await collection.upsert(plain(togglePrep(item, prepId, new Date().toISOString()))); } catch { setError(true); }
  }, [collection]);

  const laneList: Lane[] = useMemo(() => lanes(week.dates, roster.adults), [week.dates, roster.adults]);

  return {
    ...week,
    roster,
    me,
    lanes: laneList,
    receipt,
    dismissReceipt: () => setReceipt(null),
    busy,
    error,
    clearError: () => setError(false),
    addDates,
    take,
    ask,
    change,
    hold,
    applyHeld,
    keepBoth,
    edit,
    done,
    cancel,
    prep,
    tickPrep,
  };
}

export type FamilyPlanApi = ReturnType<typeof useFamilyPlan>;
