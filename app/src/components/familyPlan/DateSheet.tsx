import React, { useEffect, useState } from "react";
import { stateOf, type FamilyPlanDate, type FamilyPlanHistory } from "../../lib/familyPlan/model";
import type { FamilyPlanApi } from "../../hooks/useFamilyPlan";
import { Token } from "../../design/primitives";
import { Icon } from "../ui/Icon";
import { FpDialog } from "./FpDialog";
import { DateFields, ThreadLine } from "./ReviewSheet";
import type { FamilyPlanCopy } from "./familyPlanCopy";
import { adultInitial, adultLabel, dayNum, momentLabel, weekdayShort, whenLabel, type Lang } from "./format";

/** Asked → Accepted → Done for one date (the adult's actions, never the child). */
export function YesSteps({ item, c, lang, meUid }: { item: FamilyPlanDate; c: FamilyPlanCopy; lang: Lang; meUid: string }) {
  const s = stateOf(item);
  const asked = !!item.request || s === "has";
  const accepted = s === "has";
  const done = item.status === "done";
  const holder = item.holder ? adultLabel(item.holder, meUid, c) : "";
  return (
    <div className={`nx-yes ${done ? "s2" : accepted ? "" : "s0"}`} role="list" aria-label={`${c.asked}, ${c.accepted}, ${c.done}`}>
      <div className="stp" role="listitem">
        <span className={`nd ${asked ? "on" : "off"}`} aria-hidden="true"><Icon name="upload" size={22} /></span>
        <b>{c.asked}</b>
        <span>{item.request ? momentLabel(item.request.askedAt, lang) : asked ? "" : c.askedNone}</span>
      </div>
      <div className="stp" role="listitem">
        <span className={`nd ${accepted ? "on" : "off"}`} aria-hidden="true"><Icon name="check" size={22} /></span>
        <b>{c.accepted}</b>
        <span dir="auto">{accepted ? `${holder} · ${c.versionLabel(item.version)}` : c.noAnswer}</span>
      </div>
      <div className="stp" role="listitem">
        <span className={`nd ${done ? "on" : "off"}`} aria-hidden="true"><Icon name="flag" size={22} /></span>
        <b>{c.done}</b>
        <span>{done && item.doneAt ? momentLabel(item.doneAt, lang) : c.doneNone}</span>
      </div>
    </div>
  );
}

function historyLine(h: FamilyPlanHistory, item: FamilyPlanDate, c: FamilyPlanCopy, lang: Lang, meUid: string, plan: FamilyPlanApi): string {
  const who = (uid?: string) => {
    if (!uid) return "";
    const adult = plan.roster.adults.find((a) => a.uid === uid) ?? (item.holder?.uid === uid ? item.holder : null) ?? (item.request?.toUid === uid ? { uid, email: item.request.toEmail } : null);
    return adult ? adultLabel(adult, meUid, c, true) : c.coParent;
  };
  const old = h.date ? whenLabel({ date: h.date, time: h.time }, lang) : "";
  switch (h.kind) {
    case "added": return c.history.added(who(h.by));
    case "asked": return c.history.asked(who(h.by), who(h.who));
    case "took": return c.history.took(who(h.by));
    case "accepted": return c.history.accepted(who(h.by), c.versionLabel(h.version ?? item.version));
    case "declined": return c.history.declined(who(h.by));
    case "changed": return c.history.changed(old);
    case "reminder_stopped": return c.history.reminder_stopped(old);
    case "request_closed": return c.history.request_closed;
    case "prep_added": return c.history.prep_added(who(h.by));
    case "done": return c.history.done(who(h.by));
    case "cancelled": return c.history.cancelled(who(h.by));
    case "edited": return c.history.edited(who(h.by));
  }
}

/** One date, prepared and closed: who has it, what to prepare, the message line, the history. */
export function DateSheet({ item, onClose, plan, lang, c, onAsk, onCalendar }: { item: FamilyPlanDate | null; onClose: () => void; plan: FamilyPlanApi; lang: Lang; c: FamilyPlanCopy; onAsk: (id: string) => void; onCalendar: (items: FamilyPlanDate[]) => void }) {
  const [prepText, setPrepText] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: "", kind: "event", date: "", time: "" });
  useEffect(() => {
    setPrepText("");
    setEditing(false);
    if (item) setDraft({ title: item.title, kind: item.kind, date: item.date, time: item.time ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);
  if (!item) return <FpDialog open={false} onClose={onClose} title="">{null}</FpDialog>;
  const s = stateOf(item);
  const holder = item.holder ? adultLabel(item.holder, plan.me.uid, c) : "";
  const open = item.status === "open";
  return (
    <FpDialog open={!!item} onClose={onClose} title={item.title}>
      <div className="line" style={{ gap: 14, alignItems: "center" }}>
        <div className={`fp-big ${s === "has" ? "has" : s === "none" ? "none" : ""}`} aria-hidden="true">
          <small>{weekdayShort(item.date, lang)}</small>
          <b>{dayNum(item.date)}</b>
          {item.time && <span>{item.time}</span>}
        </div>
        <div className="stack" style={{ gap: 6, minWidth: 0 }}>
          <span className="small">{c.kinds[item.kind]} · {whenLabel(item, lang)}</span>
          {s === "has" ? (
            <span className="fp-chip"><span className="av sm" aria-hidden="true">{adultInitial(holder)}</span><bdi>{c.hasIt(holder)}</bdi></span>
          ) : s === "asked" && item.request ? (
            <span className="small">{c.askedAt(adultLabel({ uid: item.request.toUid, email: item.request.toEmail }, plan.me.uid, c), momentLabel(item.request.askedAt, lang))} {c.noAnswer}</span>
          ) : (
            <span className="small" style={{ color: "var(--k-hard)", fontWeight: 600 }}>{c.stateNone}</span>
          )}
          {s === "has" && <span className="small">{c.confirmedFor(whenLabel(item, lang))}</span>}
        </div>
      </div>
      <YesSteps item={item} c={c} lang={lang} meUid={plan.me.uid} />

      {editing ? (
        <div className="stack" style={{ gap: 10 }}>
          <DateFields row={draft} c={c} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} />
          <div className="fp-actions">
            <button type="button" className="btn primary sm" disabled={plan.busy} onClick={async () => {
              const ok = await plan.edit(item.id, { title: draft.title, kind: draft.kind as FamilyPlanDate["kind"], date: draft.date, time: draft.time }, c.notePrefill(draft.title, whenLabel({ date: draft.date, time: draft.time || undefined }, lang)));
              if (ok) setEditing(false);
            }}>{c.save}</button>
            <button type="button" className="btn ghost sm" onClick={() => setEditing(false)}>{c.cancel}</button>
          </div>
        </div>
      ) : null}

      <section className="stack" style={{ gap: 8 }} aria-labelledby="fp-prep-h">
        <h3 className="h3" id="fp-prep-h">{c.prepTitle}</h3>
        {(item.prep ?? []).length ? (
          <div className="fp-prep">
            {(item.prep ?? []).map((p) => (
              <label key={p.id}>
                <span dir="auto">{p.text}</span>
                <input type="checkbox" checked={p.done} onChange={() => void plan.tickPrep(item.id, p.id)} />
              </label>
            ))}
          </div>
        ) : <p className="small">{c.prepNone}</p>}
        {open && (
          <form className="line" style={{ gap: 8 }} onSubmit={async (e) => { e.preventDefault(); if (prepText.trim() && await plan.prep(item.id, prepText)) setPrepText(""); }}>
            <label className="fp-field grow" htmlFor="fp-prep-new">
              <span className="fp-visually-hidden">{c.prepTitle}</span>
              <input id="fp-prep-new" dir="auto" value={prepText} maxLength={120} placeholder={c.prepPlaceholder} onChange={(e) => setPrepText(e.target.value)} />
            </label>
            <button type="submit" className="btn ghost sm" style={{ alignSelf: "flex-end", minHeight: 48 }} disabled={!prepText.trim() || plan.busy}>{c.prepAdd}</button>
          </form>
        )}
      </section>

      {item.sourceLine && (
        <section className="stack" style={{ gap: 8 }} aria-labelledby="fp-src-h">
          <h3 className="h3" id="fp-src-h">{c.fromTheMessage}</h3>
          <ThreadLine line={item.sourceLine} quote={item.sourceLine} />
        </section>
      )}

      <section className="stack" style={{ gap: 8 }} aria-labelledby="fp-hist-h">
        <h3 className="h3" id="fp-hist-h">{c.historyTitle}</h3>
        <ol className="fp-hist">
          {item.history.map((h, i) => (
            <li key={`${h.at}-${i}`}>
              <Token kind="date" state={h.kind === "accepted" || h.kind === "took" || h.kind === "done" ? "solid" : h.kind === "changed" ? "ai" : "open"} size="sm" label="">{dayNum(h.date ?? item.date)}</Token>
              <span><b dir="auto">{historyLine(h, item, c, lang, plan.me.uid, plan)}</b>{momentLabel(h.at, lang)}{h.version ? ` · ${c.versionLabel(h.version)}` : ""}</span>
            </li>
          ))}
        </ol>
        <span className="small">{c.historyKeeps}</span>
      </section>

      {plan.error && <p role="alert" className="fp-err">{c.saveError}</p>}
      <div className="fp-actions">
        {open && s !== "has" && <button type="button" className="btn primary sm grow" onClick={() => onAsk(item.id)}>{c.whoTakes}</button>}
        {open && s === "has" && <button type="button" className="btn primary sm grow" disabled={plan.busy} onClick={() => void plan.done(item.id)}>{c.markDone}</button>}
        {open && s === "has" && <button type="button" className="btn ghost sm" onClick={() => onAsk(item.id)}>{c.askSomeone}</button>}
        {open && !editing && <button type="button" className="btn ghost sm" onClick={() => setEditing(true)}>{c.editDate}</button>}
        <button type="button" className="btn ghost sm" onClick={() => onCalendar([item])}><Icon name="download" size={16} />{c.addToCalendar}</button>
        {open && <button type="button" className="btn ghost sm" disabled={plan.busy} onClick={async () => { if (await plan.cancel(item.id)) onClose(); }}>{c.cancelDate}</button>}
      </div>
    </FpDialog>
  );
}
