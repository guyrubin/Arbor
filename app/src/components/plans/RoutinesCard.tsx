import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { useAuth } from "../../context/AuthContext";
import { PendingLine, Receipt } from "../ui/Receipt";
import { sameLocalHistoryRows } from "../../lib/historyWindow";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { cardCls } from "../ui/kit";

type Step = { text: string; done: boolean };
type Routine = { id: string; name: string; steps: Step[] };

type Attempt = { id: number; from: Routine; target: Routine; complete: boolean; status: "pending" | "acknowledged" | "saved" | "failed" };
type Row = { source: Routine; attempt?: Attempt };
type Scope = { key: string; rows: Map<string, Row> };
const sameRoutine = (a: Routine, b: Routine) => sameLocalHistoryRows([a], JSON.stringify([b]));

/** Reusable co-regulation routines (e.g. morning, bedtime) as resettable checklists. */
export default function RoutinesCard() {
  const { user } = useAuth();
  const { childProfile } = useArbor();
  const { t } = useLanguage();
  const col = useChildCollection<Routine>(childProfile.id, "routines", { trackConfirmation: true });
  const routines = useMemo(() => [...col.items].sort((a, b) => (a.id < b.id ? -1 : 1)), [col.items]);
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
      : (attempt.status === "pending" || attempt.status === "failed") && sameRoutine(r, attempt.from));
    if (expected) row.source = r;
    else scope.rows.set(r.id, { source: r });
  }
  const current = (r: Routine, row: Row) => inScope() && scope.rows.get(r.id) === row;
  const actionable = (r: Routine, row: Row) => current(r, row) && col.isCurrent();
  const retire = (r: Routine) => { const row: Row = { source: r }; scope.rows.set(r.id, row); refresh(n => n + 1); return row; };
  const writeChecklist = async (r: Routine, row: Row, target: Routine) => {
    if (!actionable(r, row)) return;
    // Retire old DOM callbacks synchronously, before upsert or React rerenders.
    // A pending remote snapshot is not a current confirmed read: no duplicate
    // write or stale retry can be issued from it.
    const next = retire(r);
    const attempt: Attempt = { id: ++sequence.current, from: r, target, complete: target.steps.length > 0 && target.steps.every(s => s.done), status: "pending" };
    next.attempt = attempt;
    try {
      await col.upsert(target, { awaitServer: true });
      if (!current(r, next) || next.attempt !== attempt) return;
      attempt.status = "acknowledged";
    } catch {
      if (!current(r, next) || next.attempt !== attempt) return;
      attempt.status = "failed";
    }
    refresh(n => n + 1);
  };

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
    void col.upsert({ ...r, steps: [...r.steps, { text: t, done: false }] });
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
          const unavailable = !col.confirmed || pending;
          const done = r.steps.filter((s) => s.done).length;
          return (
            <div key={r.id} data-testid={`routine-row-${r.id}`} className="rounded-xl p-3 space-y-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
              <div className="flex items-center justify-between">
                <strong className="text-sm" style={{ color: "var(--arbor-ink)" }}>{r.name}</strong>
                <div className="flex items-center gap-2">
                  <span className="text-[10px]" style={{ color: "var(--arbor-muted)" }} dir="auto">{t("elev.closeloop.routines.stepsDone", { done, total: r.steps.length })}</span>
                  <button type="button" className="touch-target rounded-lg" data-testid={`routine-reset-${r.id}`} disabled={unavailable} onClick={() => writeChecklist(r, row, { ...r, steps: r.steps.map(s => ({ ...s, done: false })) })} aria-label={t("aria.resetRoutine")} style={{ color: "var(--arbor-muted)" }}><Icon name="restart_alt" size={16} /></button>
                  <button type="button" className="touch-target rounded-lg" data-testid={`routine-delete-${r.id}`} disabled={unavailable} onClick={() => { if (!actionable(r, row)) return; retire(r); void col.remove(r.id); }} aria-label={t("aria.deleteRoutine")} style={{ color: "var(--arbor-muted)" }}><Icon name="delete" size={16} /></button>
                </div>
              </div>
              <div className="space-y-1">
                {r.steps.map((s, i) => (
                  <button key={i} type="button" data-testid={`routine-step-${r.id}-${i}`} aria-pressed={s.done} disabled={unavailable} onClick={() => writeChecklist(r, row, { ...r, steps: r.steps.map((step, index) => index === i ? { ...step, done: !step.done } : step) })} className="min-h-11 w-full flex items-center gap-2 text-start text-[12px]">
                    <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0" style={s.done ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.40)" } : { border: "1px solid var(--arbor-rule-strong)", color: "transparent" }}>
                      <Icon name="check" size={12} />
                    </span>
                    <span style={{ color: s.done ? "var(--arbor-muted)" : "var(--arbor-ink)", textDecoration: s.done ? "line-through" : "none" }}>{s.text}</span>
                  </button>
                ))}
              </div>
              <PendingLine key={attempt ? `${scopeKey}:${r.id}:${attempt.id}` : `${scopeKey}:${r.id}`} active={pending} testId={`routine-pending-${r.id}`}>{t("elev.closeloop.routines.pending")}</PendingLine>
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
