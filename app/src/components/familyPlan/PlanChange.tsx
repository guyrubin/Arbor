import React, { useRef, useState } from "react";
import { PencilChip, Snap, SnapDots, Token } from "../../design/primitives";
import { Icon } from "../ui/Icon";
import { stateOf, type FamilyPlanDate } from "../../lib/familyPlan/model";
import type { FamilyPlanApi } from "../../hooks/useFamilyPlan";
import type { FamilyPlanCopy } from "./familyPlanCopy";
import { adultLabel, clockLabel, dayNum, whenLabel, type Lang } from "./format";

/** The first open date carrying a change held from a newer message, if any. */
export const heldChangeOf = (plan: FamilyPlanApi): FamilyPlanDate | null =>
  plan.dates.find((d) => d.status === "open" && d.pendingChange) ?? null;

/** Who a change asks again: the adult who has it, else the adult with an open request (never the reader). */
function reaskedAdult(item: FamilyPlanDate, meUid: string) {
  if (item.holder && item.holder.uid !== meUid) return item.holder;
  if (item.request?.status === "asked") return { uid: item.request.toUid, email: item.request.toEmail };
  return null;
}

/**
 * "One change to review" (N-Plan-M §2 / N-Plan-D What changed): a newer
 * version of the message moved a date. Old time struck through, the new one
 * large, the line it came from; nothing moves until the parent applies it.
 */
export function HeldChangeCard({ item, plan, lang, c, onAsk, desk = false }: { item: FamilyPlanDate; plan: FamilyPlanApi; lang: Lang; c: FamilyPlanCopy; onAsk: (id: string) => void; desk?: boolean }) {
  const p = item.pendingChange!;
  const sameDay = p.date === item.date;
  const who = reaskedAdult(item, plan.me.uid);
  const whoName = who ? adultLabel(who, plan.me.uid, c) : "";
  const reask = who ? c.notePrefill(item.title, whenLabel({ date: p.date, time: p.time }, lang)) : "";
  return (
    <div className="draft" style={{ gap: 8, borderRadius: 18, padding: 16 }} data-testid="family-plan-held-change">
      {/* N-Plan-D: short chip and the quoted line; N-Plan-M: the version and time in the chip, no quote. */}
      <PencilChip>{desk ? c.changeDraftOne : c.changeDraftFrom((item.version ?? 1) + 1, clockLabel(p.receivedAt, lang))}</PencilChip>
      <span className="nx-chg" aria-label={`${whenLabel(item, lang)} → ${whenLabel({ date: p.date, time: p.time }, lang)}`}>
        <s>{sameDay && item.time ? item.time : whenLabel(item, lang)}</s>
        <Icon name="arrow_forward" size={22} className="rtl:-scale-x-100" />
        <b>{sameDay && p.time ? p.time : whenLabel({ date: p.date, time: p.time }, lang)}</b>
      </span>
      <b dir="auto" style={{ fontSize: 14, fontWeight: 600 }}>{item.title}, {whenLabel({ date: p.date }, lang)}</b>
      {desk && p.sourceLine && <q dir="auto" className="ds-said" style={{ fontSize: 15 }}>{p.sourceLine}</q>}
      <span className="small" style={{ color: "var(--ink-soft)" }}>{c.changeStill(whenLabel(item, lang))} {who ? c.reviewIfApply(whoName) : c.reviewIfApplyNobody}</span>
      {plan.error && <p role="alert" className="fp-err">{c.saveError}</p>}
      <div className="fp-actions">
        <button type="button" className="btn primary sm grow" disabled={plan.busy} onClick={() => void plan.applyHeld(item.id, reask)}>{who ? c.reviewApplyAskAgain : c.reviewApply}</button>
        <button type="button" className="btn ghost sm" style={{ background: "var(--card)" }} disabled={plan.busy} onClick={async () => { if (await plan.applyHeld(item.id, "")) onAsk(item.id); }}>{c.askSomeoneElse}</button>
        <button type="button" className="btn ghost sm" style={{ background: "var(--card)" }} disabled={plan.busy} onClick={() => void plan.keepBoth(item.id)}>{c.reviewKeepBoth}</button>
      </div>
    </div>
  );
}

/**
 * "From the kindergarten's message" (N-Plan-M §3): the latest message's dated
 * items as a snap row, each with the line it came from, then what it asked to
 * prepare (kept as notes). Every card opens its date.
 */
export function FoundSnap({ plan, lang, c, onOpen }: { plan: FamilyPlanApi; lang: Lang; c: FamilyPlanCopy; onOpen: (id: string) => void }) {
  const fromMessages = plan.all.filter((d) => d.origin === "message" && d.messageId && d.status !== "cancelled");
  const latestId = [...fromMessages].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.messageId;
  const items = fromMessages.filter((d) => d.messageId === latestId).sort((a, b) => (a.sourceLineNo ?? 99) - (b.sourceLineNo ?? 99));
  const notes = items.flatMap((d) => (d.prep ?? []).map((p) => ({ id: `${d.id}:${p.id}`, dateId: d.id, text: p.text, date: d })));
  const [on, setOn] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const total = items.length + notes.length;
  if (!total) return <p className="small">{c.noMessage}</p>;
  const onScroll = () => {
    const el = ref.current?.firstElementChild as HTMLElement | null;
    if (!el) return;
    const card = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 286;
    setOn(Math.min(total - 1, Math.max(0, Math.round(Math.abs(el.scrollLeft) / (card + 12)))));
  };
  return (
    <div ref={ref} onScrollCapture={onScroll}>
      <Snap label={c.fromTheMessage}>
        {items.map((d) => (
          <button key={d.id} type="button" className="nx-fc" onClick={() => onOpen(d.id)} style={{ textAlign: "start", cursor: "pointer", font: "inherit", color: "inherit" }}>
            <span className="line between"><Token kind="date" state={stateOf(d) === "has" ? "solid" : "none"} size="xl" label={c.tokenLabel(d.title, whenLabel(d, lang))}>{dayNum(d.date)}</Token><span className="nx-tag">{c.kindTags[d.kind]}</span></span>
            <b dir="auto" style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 19, lineHeight: 1.2 }}>{d.title}</b>
            <span style={{ fontSize: 14, lineHeight: 1.3, color: "var(--ink-soft)" }}>{d.kind === "deadline" ? c.dueOn(whenLabel(d, lang)) : d.kind === "join" ? `${whenLabel(d, lang)} · ${c.kinds.join.toLowerCase()}` : whenLabel(d, lang)}</span>
            {d.sourceLineNo ? <span style={{ marginTop: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--sapphire-deep)" }}><span className="nx-n" aria-hidden="true">{d.sourceLineNo}</span>{c.lineOf(d.sourceLineNo)}</span> : null}
          </button>
        ))}
        {notes.map((n) => (
          <button key={n.id} type="button" className="nx-fc nod" onClick={() => onOpen(n.dateId)} style={{ textAlign: "start", cursor: "pointer", font: "inherit", color: "inherit" }}>
            <span className="line between"><span className="gi" aria-hidden="true"><Icon name="description" size={18} /></span><span className="nx-tag">{c.kindTags.note}</span></span>
            <b dir="auto" style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 19, lineHeight: 1.2 }}>{n.text}</b>
            <span style={{ fontSize: 14, lineHeight: 1.3, color: "var(--ink-soft)" }}>{c.prepWith(n.date.title)}</span>
          </button>
        ))}
      </Snap>
      <SnapDots count={total} on={on} caption={c.foundOf(on + 1, total)} />
    </div>
  );
}
