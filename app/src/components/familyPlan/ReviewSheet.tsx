import React, { useEffect, useMemo, useState } from "react";
import { api, ApiError, EscalationRequiredError, PaywallError } from "../../lib/api";
import { track } from "../../lib/analytics";
import { dayKey, isDay, isTime, type FamilyPlanKind, FAMILY_PLAN_KINDS } from "../../lib/familyPlan/model";
import { matchDraft } from "../../lib/familyPlan/match";
import type { FamilyPlanExtractItem, ReviewRow } from "../../lib/familyPlan/draft";
import type { FamilyPlanApi } from "../../hooks/useFamilyPlan";
import { Token, PencilChip } from "../../design/primitives";
import { Icon } from "../ui/Icon";
import { UrgentSupport } from "../safety/UrgentSupport";
import { FpDialog } from "./FpDialog";
import type { FamilyPlanCopy } from "./familyPlanCopy";
import { adultLabel, dayNum, whenLabel, type Lang } from "./format";

type Phase = { at: "paste" } | { at: "reading" } | { at: "review"; lineCount: number } | { at: "error"; message: string; crisis?: boolean };

/** The line with the quoted words marked: the parent's words in ink, never the model's. */
export function ThreadLine({ n, line, quote }: { n?: number; line: string; quote: string }) {
  const i = quote && quote !== line ? line.indexOf(quote) : -1;
  return (
    <div className="fp-thread">
      {n != null ? <span className="nx-n" aria-hidden="true">{n}</span> : <Icon name="description" size={18} />}
      <q dir="auto">
        {i >= 0 ? <>{line.slice(0, i)}<mark>{quote}</mark>{line.slice(i + quote.length)}</> : line}
      </q>
    </div>
  );
}

function DateFields({ row, onChange, c, withKind = true }: { row: { title: string; kind: string; date: string; time: string }; onChange: (patch: Partial<{ title: string; kind: FamilyPlanKind; date: string; time: string }>) => void; c: FamilyPlanCopy; withKind?: boolean }) {
  const id = React.useId();
  return (
    <div className="fp-col" style={{ gap: 10 }}>
      <label className="fp-field" htmlFor={`${id}-t`}>
        {c.fieldName}
        <input id={`${id}-t`} dir="auto" value={row.title} maxLength={120} onChange={(e) => onChange({ title: e.target.value })} />
      </label>
      {withKind && (
        <label className="fp-field" htmlFor={`${id}-k`}>
          {c.fieldKind}
          <select id={`${id}-k`} value={row.kind === "note" ? "event" : row.kind} onChange={(e) => onChange({ kind: e.target.value as FamilyPlanKind })}>
            {FAMILY_PLAN_KINDS.map((k) => <option key={k} value={k}>{c.kinds[k]}</option>)}
          </select>
        </label>
      )}
      <div className="fp-fields">
        <label className="fp-field" htmlFor={`${id}-d`}>
          {c.fieldDay}
          <input id={`${id}-d`} type="date" value={row.date} onChange={(e) => onChange({ date: e.target.value })} />
        </label>
        <label className="fp-field" htmlFor={`${id}-h`}>
          {c.fieldTime}
          <input id={`${id}-h`} type="time" value={row.time} aria-describedby={`${id}-hh`} onChange={(e) => onChange({ time: e.target.value })} />
        </label>
      </div>
      <span id={`${id}-hh`} className="small">{c.fieldTimeHint}</span>
    </div>
  );
}

const keepable = (r: ReviewRow) => r.kind !== "note" && isDay(r.date) && (!r.time || isTime(r.time)) && r.title.trim().length > 0;

/** "Add a school message": paste → Arbor's draft → the parent keeps, edits or drops each item. */
export function ReviewSheet({ open, onClose, plan, childName, lang, c, onSafety }: { open: boolean; onClose: () => void; plan: FamilyPlanApi; childName?: string; lang: Lang; c: FamilyPlanCopy; onSafety: () => void }) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>({ at: "paste" });
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [prepFor, setPrepFor] = useState<Record<string, string>>({});
  const [resolved, setResolved] = useState<Record<string, "applied" | "both">>({});

  useEffect(() => {
    if (!open) { setText(""); setPhase({ at: "paste" }); setRows([]); setEditing(null); setPrepFor({}); setResolved({}); }
  }, [open]);

  const read = async () => {
    if (!text.trim()) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) { setPhase({ at: "error", message: c.reviewOffline }); return; }
    setPhase({ at: "reading" });
    try {
      const result = await api.extractFamilyPlan({ text, language: lang, today: dayKey(new Date()), ...(childName ? { childName } : {}) });
      const next = result.items.map((it: FamilyPlanExtractItem): ReviewRow => {
        const match = it.kind === "note" || !isDay(it.date) ? ({ kind: "new" } as const) : matchDraft({ title: it.title, date: it.date, time: it.time || undefined }, plan.all);
        return { ...it, match, keep: it.kind !== "note" && isDay(it.date) && match.kind === "new" };
      });
      setRows(next);
      setPhase({ at: "review", lineCount: result.lineCount });
      track("family_plan_message_read", { found: next.length, dated: next.filter((r) => isDay(r.date)).length, duplicates: next.filter((r) => r.match.kind === "duplicate").length, changes: next.filter((r) => r.match.kind === "change").length });
    } catch (e) {
      if (e instanceof EscalationRequiredError) { setPhase({ at: "error", message: c.reviewCrisis, crisis: true }); return; }
      const message = e instanceof PaywallError ? c.reviewQuota
        : e instanceof ApiError && e.status === 429 ? c.reviewQuota
        : e instanceof ApiError && e.status === 422 ? c.reviewBlocked
        : c.reviewError;
      setPhase({ at: "error", message });
    }
  };

  const patch = (id: string, p: Partial<ReviewRow>) => setRows((rs) => rs.map((r) => {
    if (r.id !== id) return r;
    const next = { ...r, ...p };
    if (p.date !== undefined || p.time !== undefined || p.title !== undefined || p.kind !== undefined) {
      next.match = next.kind === "note" || !isDay(next.date) ? { kind: "new" } : matchDraft({ title: next.title, date: next.date, time: next.time || undefined }, plan.all);
      if (p.date !== undefined && isDay(p.date) && r.kind === "note") next.kind = "event";
      if (next.match.kind === "duplicate") next.keep = false;
    }
    return next;
  }));

  const dated = rows.filter((r) => r.kind !== "note");
  const notes = rows.filter((r) => r.kind === "note");
  const toAdd = rows.filter((r) => r.keep && keepable(r) && (r.match.kind === "new" || resolved[r.id] === "both"));
  const prepTargets = toAdd;
  const dupCount = rows.filter((r) => r.match.kind === "duplicate").length;

  const add = async () => {
    const keep = toAdd.map((r) => ({
      kind: r.kind as FamilyPlanKind,
      title: r.title,
      date: r.date,
      time: r.time || undefined,
      sourceLine: r.sourceLine,
      prep: notes.filter((n) => prepFor[n.id] === r.id).map((n) => n.title),
    }));
    const res = await plan.addDates(keep, "message");
    if (res.added || !keep.length) onClose();
  };

  const applyChange = async (r: ReviewRow) => {
    if (r.match.kind !== "change") return;
    const existing = r.match.existing;
    const who = existing.holder && existing.holder.uid !== plan.me.uid ? existing.holder : existing.request?.status === "asked" ? { uid: existing.request.toUid, email: existing.request.toEmail } : null;
    const note = c.notePrefill(r.title, whenLabel({ date: r.date, time: r.time || undefined }, lang));
    const ok = await plan.change(existing.id, { date: r.date, time: r.time || undefined, sourceLine: r.sourceLine }, who ? note : "");
    if (ok) setResolved((m) => ({ ...m, [r.id]: "applied" }));
  };

  return (
    <FpDialog open={open} onClose={onClose} title={c.reviewTitle} wide>
      {(phase.at === "paste" || phase.at === "reading" || phase.at === "error") && (
        <>
          <label className="fp-field" htmlFor="fp-message">
            {c.reviewPaste}
            <textarea id="fp-message" dir="auto" rows={8} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} disabled={phase.at === "reading"} aria-describedby="fp-message-hint" />
          </label>
          <span id="fp-message-hint" className="small">{c.reviewPasteHint}</span>
          {phase.at === "error" && phase.crisis && <UrgentSupport testId="family-plan-urgent-support" className="fp-col" requestLang={lang} lead={c.reviewCrisis} onSafety={() => { onClose(); onSafety(); }} />}
          {phase.at === "error" && !phase.crisis && <p role="alert" className="fp-err">{phase.message}</p>}
          <div className="fp-actions">
            <button type="button" className="btn primary" disabled={!text.trim() || phase.at === "reading"} onClick={() => void read()}>
              {phase.at === "reading" ? c.reviewReading : c.reviewRead}
            </button>
            <button type="button" className="btn ghost" onClick={onClose}>{c.reviewNotNow}</button>
          </div>
          {phase.at === "reading" && <p role="status" className="small">{c.reviewReading}</p>}
        </>
      )}

      {phase.at === "review" && (
        <>
          <p className="h3" role="status">{rows.length ? c.reviewFound(dated.length, notes.length) : c.reviewNothing}</p>
          {rows.length > 0 && <span className="small">{c.reviewTickHint}</span>}
          {rows.map((r) => {
            const isDup = r.match.kind === "duplicate";
            const isChange = r.match.kind === "change" && !resolved[r.id];
            const applied = resolved[r.id] === "applied";
            return (
              <article key={r.id} className={`fp-row ${r.kind === "note" ? "nx-found nod" : "draft"}${isDup ? " dup" : ""}`} style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14 }} aria-label={r.title}>
                <div className="line between" style={{ gap: 8, flexWrap: "wrap" }}>
                  <PencilChip>{isChange ? c.reviewChange : c.reviewDraft}</PencilChip>
                  <span className="nx-tag">{c.kinds[r.kind]}</span>
                </div>
                <div className="line" style={{ gap: 12, alignItems: "center" }}>
                  {isDay(r.date)
                    ? <Token kind="date" state="ai" size="lg" label={`${r.title}, ${whenLabel({ date: r.date, time: r.time || undefined }, lang)}`}>{dayNum(r.date)}</Token>
                    : <span className="gi" aria-hidden="true"><Icon name="description" size={18} /></span>}
                  <div className="fp-col grow" style={{ gap: 2, minWidth: 0 }}>
                    <b dir="auto" style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 19, lineHeight: 1.2 }}>{r.title}</b>
                    <span className="small">{isDay(r.date) ? whenLabel({ date: r.date, time: r.time || undefined }, lang) : c.reviewNoDate}</span>
                  </div>
                </div>
                {isChange && r.match.kind === "change" && (
                  <div className="fp-col" style={{ gap: 6 }}>
                    <span className="nx-chg" aria-label={`${whenLabel(r.match.existing, lang)} → ${whenLabel({ date: r.date, time: r.time || undefined }, lang)}`}>
                      <s>{r.match.existing.time && r.match.existing.date === r.date ? r.match.existing.time : whenLabel(r.match.existing, lang)}</s>
                      <Icon name="arrow_forward" size={22} className="rtl:-scale-x-100" />
                      <b>{r.time && r.match.existing.date === r.date ? r.time : whenLabel({ date: r.date, time: r.time || undefined }, lang)}</b>
                    </span>
                    <span className="small">
                      {(() => {
                        const ex = r.match.existing;
                        const who = ex.holder && ex.holder.uid !== plan.me.uid ? ex.holder : ex.request?.status === "asked" ? { uid: ex.request.toUid, email: ex.request.toEmail } : null;
                        return who ? c.reviewIfApply(adultLabel(who, plan.me.uid, c)) : c.reviewIfApplyNobody;
                      })()}
                    </span>
                  </div>
                )}
                <ThreadLine n={r.line} line={r.sourceLine} quote={r.quote} />
                {isDup && <p className="small" role="note">{c.reviewDuplicate}</p>}
                {applied && <p className="small" role="status">{c.receipt.changed(1)}</p>}
                {editing === r.id && (
                  <DateFields row={r} c={c} onChange={(p) => patch(r.id, p)} />
                )}
                {isChange && r.match.kind === "change" && (
                  <div className="fp-actions">
                    <button type="button" className="btn primary sm grow" disabled={plan.busy || !keepable(r)} onClick={() => void applyChange(r)}>
                      {(() => {
                        const ex = r.match.existing;
                        const who = ex.holder && ex.holder.uid !== plan.me.uid ? ex.holder : ex.request?.status === "asked" ? { uid: ex.request.toUid, email: ex.request.toEmail } : null;
                        return who ? c.reviewApplyAsk(adultLabel(who, plan.me.uid, c)) : c.reviewApply;
                      })()}
                    </button>
                    <button type="button" className="btn ghost sm" onClick={() => { setResolved((m) => ({ ...m, [r.id]: "both" })); patch(r.id, { keep: true }); }}>{c.reviewKeepBoth}</button>
                  </div>
                )}
                {!isChange && !applied && !isDup && r.kind !== "note" && (
                  <div className="line between" style={{ gap: 8 }}>
                    <label className="fp-check">
                      <input type="checkbox" checked={r.keep} disabled={!keepable(r)} onChange={(e) => patch(r.id, { keep: e.target.checked })} />
                      {c.reviewAddToPlan}
                    </label>
                    <button type="button" className="btn ghost sm" aria-expanded={editing === r.id} onClick={() => setEditing(editing === r.id ? null : r.id)}>{editing === r.id ? c.reviewDone : c.reviewEdit}</button>
                  </div>
                )}
                {r.kind === "note" && (
                  <div className="fp-col" style={{ gap: 8 }}>
                    {prepTargets.length > 0 && (
                      <label className="fp-field">
                        {c.reviewKeepAsPrep}
                        <select value={prepFor[r.id] ?? ""} onChange={(e) => setPrepFor((m) => ({ ...m, [r.id]: e.target.value }))}>
                          <option value="">{c.reviewNotNow}</option>
                          {prepTargets.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                      </label>
                    )}
                    <button type="button" className="btn ghost sm" style={{ alignSelf: "flex-start" }} aria-expanded={editing === r.id} onClick={() => { setEditing(editing === r.id ? null : r.id); }}>{c.reviewAddADate}</button>
                  </div>
                )}
              </article>
            );
          })}
          {rows.length > 0 && (
            <div className="nx-found nod" style={{ gridTemplateColumns: "auto minmax(0,1fr)" }}>
              <Icon name="task_alt" size={20} />
              <span><b>{c.reviewChecked}</b>{dupCount ? c.duplicatesSkipped(dupCount) : c.reviewCheckedNone} {c.reviewKeepsLines}</span>
            </div>
          )}
          {plan.error && <p role="alert" className="fp-err">{c.saveError}</p>}
          <div className="fp-actions">
            <button type="button" className="btn primary grow" disabled={!toAdd.length || plan.busy} onClick={() => void add()}>{c.reviewAddN(toAdd.length)}</button>
            <button type="button" className="btn ghost" onClick={onClose}>{c.reviewNotNow}</button>
          </div>
        </>
      )}
    </FpDialog>
  );
}

/** "Add a date": typed by hand, no Arbor reading; the same duplicate check. */
export function AddDateSheet({ open, onClose, plan, lang, c }: { open: boolean; onClose: () => void; plan: FamilyPlanApi; lang: Lang; c: FamilyPlanCopy }) {
  const blank = useMemo(() => ({ title: "", kind: "event" as FamilyPlanKind, date: dayKey(new Date()), time: "" }), [open]);
  const [row, setRow] = useState(blank);
  useEffect(() => setRow(blank), [blank]);
  const valid = row.title.trim() && isDay(row.date) && (!row.time || isTime(row.time));
  const match = valid ? matchDraft({ title: row.title, date: row.date, time: row.time || undefined }, plan.all) : { kind: "new" as const };
  const save = async () => {
    if (!valid || match.kind === "duplicate") return;
    const res = await plan.addDates([{ kind: row.kind, title: row.title, date: row.date, time: row.time || undefined }], "manual");
    if (res.added) onClose();
  };
  return (
    <FpDialog open={open} onClose={onClose} title={c.manualTitle}>
      <DateFields row={row} c={c} onChange={(p) => setRow((r) => ({ ...r, ...p }))} />
      {match.kind === "duplicate" && <p className="small" role="note">{c.reviewDuplicate}</p>}
      {match.kind === "change" && <p className="small" role="note">{whenLabel(match.existing, lang)} · {match.existing.title}</p>}
      {plan.error && <p role="alert" className="fp-err">{c.saveError}</p>}
      <div className="fp-actions">
        <button type="button" className="btn primary grow" disabled={!valid || match.kind === "duplicate" || plan.busy} onClick={() => void save()}>{c.save}</button>
        <button type="button" className="btn ghost" onClick={onClose}>{c.cancel}</button>
      </div>
    </FpDialog>
  );
}

export { DateFields };
