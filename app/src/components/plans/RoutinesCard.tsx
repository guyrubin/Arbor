import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { useAuth } from "../../context/AuthContext";
import { PendingLine, Receipt } from "../ui/Receipt";
import { sameLocalHistoryRows } from "../../lib/historyWindow";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { cardCls } from "../ui/kit";
import { QUEUED_ACK_MS, savedOnPhoneKey } from "../../lib/firestoreWrite";
import { useOnline } from "../../hooks/useSyncStatus";

type Step = { text: string; done: boolean };
/** B-DATA-14 r2: a tick made offline, held in the routine's own document. */
type OfflineTick = { text: string; done: boolean; at: string };
export type Routine = { id: string; name: string; steps: Step[]; offlineTicks?: Record<string, OfflineTick> };

/** queued (B-DATA-14): kept on this phone, not yet acknowledged by the server.
 *  lost: offline ticks whose step was changed or removed on another device. */
type Attempt = { id: number; from: Routine; target: Routine; complete: boolean; lost: number; status: "pending" | "queued" | "acknowledged" | "saved" | "failed" };

/**
 * B-DATA-14 r2: this phone's offline ticks laid over the routine as the server
 * holds it, matched by the step's words (its own slot first, then anywhere in
 * the list). A tick whose step is gone (changed or removed on another device)
 * is counted as lost, never forced onto a different step. Pure.
 */
export function foldOfflineTicks(r: Routine): { routine: Routine; lost: number } {
  const steps = (Array.isArray(r.steps) ? r.steps : []).map((step) => ({ ...step }));
  let lost = 0;
  for (const [slot, tick] of Object.entries(r.offlineTicks ?? {})) {
    const at = steps[Number(slot)]?.text === tick.text ? Number(slot) : steps.findIndex((step) => step.text === tick.text);
    if (at < 0) { lost++; continue; }
    steps[at].done = tick.done;
  }
  const { offlineTicks: _held, ...rest } = r;
  return { routine: { ...rest, steps }, lost };
}
const heldTicks = (r: Routine) => Object.keys(r.offlineTicks ?? {}).length;
type Row = { source: Routine; attempt?: Attempt };
type Scope = { key: string; rows: Map<string, Row> };
const sameRoutine = (a: Routine, b: Routine) => sameLocalHistoryRows([a], JSON.stringify([b]));

/** Reusable co-regulation routines (e.g. morning, bedtime) as resettable checklists. */
export default function RoutinesCard() {
  const { user } = useAuth();
  const { childProfile } = useArbor();
  const { t } = useLanguage();
  const col = useChildCollection<Routine>(childProfile.id, "routines", { trackConfirmation: true });
  // B-DATA-14: offline the server cannot confirm a read, so a step ticks from
  // this phone's copy and says so. Only the tick is written (a merge write of
  // the routine's offlineTicks field), never the whole cached routine, so what
  // another device changed meanwhile survives; on reconnect the ticks are
  // folded into the server's copy. Online the confirmed-read rule is unchanged.
  const online = useOnline();
  const offlineRead = col.remote && !online && col.loaded && !col.error;
  // A routine deleted on another device while this phone held a tick comes
  // back as a stub (no steps): it is never listed, and is removed on reconnect.
  const routines = useMemo(() => col.items.filter((r) => Array.isArray(r.steps)).sort((a, b) => (a.id < b.id ? -1 : 1)), [col.items]);
  const [newName, setNewName] = useState("");
  const [stepText, setStepText] = useState<Record<string, string>>({});

  // Feedback belongs to an action in this visit, never to loaded completion
  // data. Child/account A → B → A and row removal each start a new lifetime.
  const scopeKey = JSON.stringify([childProfile.id, user?.uid ?? null, col.remote]);
  const activeScope = useRef<Scope>({ key: scopeKey, rows: new Map() });
  if (activeScope.current.key !== scopeKey) activeScope.current = { key: scopeKey, rows: new Map() };
  const scope = activeScope.current;
  const [, refresh] = useState(0);
  const sequence = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const inScope = () => mounted.current && activeScope.current === scope;
  for (const id of scope.rows.keys()) if (!routines.some(r => r.id === id)) scope.rows.delete(id);
  for (const r of routines) {
    const row = scope.rows.get(r.id);
    if (!row) { scope.rows.set(r.id, { source: r }); continue; }
    if (row.attempt?.status === "saved" && !col.isCurrent()) {
      scope.rows.set(r.id, { source: r });
      continue;
    }
    if (sameRoutine(row.source, r)) continue;
    const attempt = row.attempt;
    // Own optimistic echo / acknowledgement / rejected-write rollback may
    // arrive in either order. An unrelated source edit retires the attempt.
    const expected = attempt && (sameRoutine(r, attempt.target)
      ? attempt.status !== "failed" || !col.confirmed
      : (attempt.status === "pending" || attempt.status === "queued" || attempt.status === "failed") && sameRoutine(r, attempt.from));
    if (expected) row.source = r;
    else scope.rows.set(r.id, { source: r });
  }
  const current = (r: Routine, row: Row) => inScope() && scope.rows.get(r.id) === row;
  const actionable = (r: Routine, row: Row) => current(r, row) && col.isCurrent();
  const retire = (r: Routine) => { const row: Row = { source: r }; scope.rows.set(r.id, row); refresh(n => n + 1); return row; };
  const writeChecklist = async (r: Routine, row: Row, target: Routine, lost = 0) => {
    if (!actionable(r, row)) return;
    // Retire old DOM callbacks synchronously, before upsert or React rerenders.
    // A pending remote snapshot is not a current confirmed read: no duplicate
    // write or stale retry can be issued from it.
    const next = retire(r);
    const attempt: Attempt = { id: ++sequence.current, from: r, target, complete: target.steps.length > 0 && target.steps.every(s => s.done), lost, status: "pending" };
    next.attempt = attempt;
    const mine = () => current(r, next) && next.attempt === attempt;
    // B-DATA-14 r2: bounded. A phone that reads online but cannot reach the
    // server keeps the write in its local cache: after the queue window the
    // row says so ("Saved on this phone. Still sending…") instead of an
    // endless "Saving…"; the acknowledgement or a rejection moves it on.
    const slow = setTimeout(() => { if (mine() && attempt.status === "pending") { attempt.status = "queued"; refresh(n => n + 1); } }, QUEUED_ACK_MS);
    try {
      await col.upsert(target, { awaitServer: true });
      if (!mine()) return;
      attempt.status = "acknowledged";
    } catch {
      if (!current(r, next) || next.attempt !== attempt) return;
      attempt.status = "failed";
    } finally {
      clearTimeout(slow);
    }
    refresh(n => n + 1);
  };

  /** B-DATA-14 r2: a tick made offline writes only itself (see above). */
  const tickOffline = (r: Routine, row: Row, i: number) => {
    if (!current(r, row) || !offlineRead) return;
    const step = foldOfflineTicks(r).routine.steps[i];
    if (!step) return;
    retire(r);
    const ticks = { ...(r.offlineTicks ?? {}), [String(i)]: { text: step.text, done: !step.done, at: new Date().toISOString() } };
    void col.upsert({ id: r.id, offlineTicks: ticks } as Routine, { merge: true }).catch(() => { /* the sync banner reports a rejected write */ });
  };

  // B-DATA-14 r2: back online on a confirmed server read, each routine's held
  // ticks are folded into the server's copy and written once (the field goes).
  const folding = useRef(new Set<string>());
  useEffect(() => {
    if (!online || !col.remote || !col.confirmed || !col.isCurrent()) return;
    for (const item of col.items) {
      if (!heldTicks(item) || folding.current.has(item.id)) continue;
      folding.current.add(item.id);
      const done = () => { folding.current.delete(item.id); };
      if (!Array.isArray(item.steps)) { void col.remove(item.id).catch(() => {}).finally(done); continue; }
      const row = scope.rows.get(item.id);
      if (!row) { done(); continue; }
      const { routine, lost } = foldOfflineTicks(item);
      void writeChecklist(item, row, routine, lost).finally(done);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, col.remote, col.confirmed, col.items]);

  const addRoutine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inScope() || !newName.trim()) return;
    void col.upsert({ id: `routine-${Date.now()}`, name: newName.trim(), steps: [] });
    setNewName("");
  };

  const addStep = (r: Routine, row: Row) => {
    if (!actionable(r, row)) return;
    const t = (stepText[r.id] || "").trim();
    if (!t) return;
    retire(r);
    const base = foldOfflineTicks(r).routine;
    void col.upsert({ ...base, steps: [...base.steps, { text: t, done: false }] });
    setStepText((s) => ({ ...s, [r.id]: "" }));
  };

  return (
    <div data-testid="routines-card" className={`${cardCls} p-6 space-y-4`}>
      <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--arbor-green-ink)" }}>
        <Icon name="checklist" size={14} /> {t("elev.closeloop.routines.title")}
      </span>

      {routines.length === 0 && <p className="text-xs" style={{ color: "var(--arbor-muted)" }} dir="auto">{t("elev.closeloop.routines.empty")}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {routines.map((r) => {
          const row = scope.rows.get(r.id)!;
          const attempt = row.attempt;
          const confirmedTarget = attempt && col.confirmed && col.isCurrent() && sameRoutine(r, attempt.target);
          if (attempt?.status === "acknowledged" && confirmedTarget) attempt.status = "saved";
          const pending = !!attempt && (attempt.status === "pending" || (attempt.status === "acknowledged" && !confirmedTarget));
          // Offline only a step ticks (from this phone's copy); reset, delete
          // and new steps wait for a confirmed read, as they always have.
          const unavailable = !col.confirmed || pending;
          const stepUnavailable = (!col.confirmed && !offlineRead) || pending;
          const held = heldTicks(r) > 0;
          const shown = held ? foldOfflineTicks(r).routine : r;
          const done = shown.steps.filter((s) => s.done).length;
          return (
            <div key={r.id} data-testid={`routine-row-${r.id}`} className="rounded-xl p-3 space-y-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
              <div className="flex items-center justify-between">
                <strong className="text-sm" style={{ color: "var(--arbor-ink)" }}>{r.name}</strong>
                <div className="flex items-center gap-2">
                  <span className="text-[10px]" style={{ color: "var(--arbor-muted)" }} dir="auto">{t("elev.closeloop.routines.stepsDone", { done, total: shown.steps.length })}</span>
                  <button type="button" className="touch-target rounded-lg" data-testid={`routine-reset-${r.id}`} disabled={unavailable} onClick={() => writeChecklist(r, row, { ...shown, steps: shown.steps.map(s => ({ ...s, done: false })) })} aria-label={t("aria.resetRoutine")} style={{ color: "var(--arbor-muted)" }}><Icon name="restart_alt" size={16} /></button>
                  <button type="button" className="touch-target rounded-lg" data-testid={`routine-delete-${r.id}`} disabled={unavailable} onClick={() => { if (!actionable(r, row)) return; retire(r); void col.remove(r.id); }} aria-label={t("aria.deleteRoutine")} style={{ color: "var(--arbor-muted)" }}><Icon name="delete" size={16} /></button>
                </div>
              </div>
              <div className="space-y-1">
                {shown.steps.map((s, i) => (
                  <button key={i} type="button" data-testid={`routine-step-${r.id}-${i}`} aria-pressed={s.done} disabled={stepUnavailable} onClick={() => offlineRead ? tickOffline(r, row, i) : writeChecklist(r, row, { ...shown, steps: shown.steps.map((step, index) => index === i ? { ...step, done: !step.done } : step) })} className="min-h-11 w-full flex items-center gap-2 text-start text-[12px]">
                    <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0" style={s.done ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.40)" } : { border: "1px solid var(--arbor-rule-strong)", color: "transparent" }}>
                      <Icon name="check" size={12} />
                    </span>
                    <span style={{ color: s.done ? "var(--arbor-muted)" : "var(--arbor-ink)", textDecoration: s.done ? "line-through" : "none" }}>{s.text}</span>
                  </button>
                ))}
              </div>
              <PendingLine key={attempt ? `${scopeKey}:${r.id}:${attempt.id}` : `${scopeKey}:${r.id}`} active={pending} testId={`routine-pending-${r.id}`}>{t("elev.closeloop.routines.pending")}</PendingLine>
              {(attempt?.status === "queued" || held) && (
                <Receipt testId={`routine-queued-${r.id}`} size="sm">{t(savedOnPhoneKey(online))}</Receipt>
              )}
              {!!attempt?.lost && attempt.status !== "pending" && attempt.status !== "queued" && (
                <p role="alert" data-testid={`routine-conflict-${r.id}`} className="t-sm" style={{ color: "var(--arbor-ink-soft)" }}>{t("elev.closeloop.routines.failed")}</p>
              )}
              {attempt?.status === "saved" && attempt.complete && confirmedTarget && (
                <Receipt testId={`routine-receipt-${r.id}`} size="sm">{t(col.remote ? "elev.closeloop.routines.saved" : "elev.closeloop.routines.savedLocal")}</Receipt>
              )}
              {attempt?.status === "failed" && (
                <div data-testid={`routine-failed-${r.id}`} className="flex flex-wrap items-center gap-2">
                  <p role="alert" className="t-sm" style={{ color: "var(--arbor-ink-soft)" }}>{t(col.remote ? "elev.closeloop.routines.failed" : "elev.closeloop.routines.failedLocal")}</p>
                  <button type="button" data-testid={`routine-retry-${r.id}`} disabled={!col.confirmed}
                    onClick={() => { if (row.attempt === attempt) void writeChecklist(r, row, attempt.target); }}
                    className="min-h-11 rounded-lg px-3 t-sm font-semibold" style={{ color: "var(--arbor-clay)" }}>{t("elev.closeloop.routines.retry")}</button>
                </div>
              )}
              <div className="flex gap-1.5">
                <input
                  data-testid={`routine-step-input-${r.id}`}
                  value={stepText[r.id] || ""}
                  onChange={(e) => setStepText((s) => ({ ...s, [r.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStep(r, row))}
                  placeholder={t("elev.closeloop.routines.addStep")}
                  className="min-h-11 flex-1 rounded-lg px-2 py-1 text-[12px] focus:outline-none bg-white"
                  style={{ border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
                />
                <button type="button" className="touch-target rounded-lg" data-testid={`routine-add-step-${r.id}`} disabled={unavailable} onClick={() => addStep(r, row)} aria-label={t("aria.addStep")} style={{ color: "var(--arbor-green-ink)" }}><Icon name="add" size={16} /></button>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={addRoutine} className="flex gap-2">
        <input data-testid="routine-name-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("elev.closeloop.routines.newName")} className="min-h-11 flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
        <button type="submit" className="touch-target text-white font-extrabold px-3 rounded-xl" data-testid="routine-add" aria-label={t("elev.closeloop.routines.newName")} style={{ background: "var(--arbor-clay)" }}><Icon name="add" size={16} /></button>
      </form>
    </div>
  );
}
