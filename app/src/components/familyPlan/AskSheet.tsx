import React, { useEffect, useState } from "react";
import type { FamilyPlanAdult, FamilyPlanDate } from "../../lib/familyPlan/model";
import { stateOf } from "../../lib/familyPlan/model";
import type { FamilyPlanApi } from "../../hooks/useFamilyPlan";
import { Token } from "../../design/primitives";
import { Icon } from "../ui/Icon";
import { FpDialog } from "./FpDialog";
import type { FamilyPlanCopy } from "./familyPlanCopy";
import { adultInitial, adultLabel, dayNum, weekdayShort, whenLabel, type Lang } from "./format";

/**
 * "Who takes this?" — take it yourself, or ask one adult in the family. Only
 * co-parents who joined can be asked (an invited adult who has not joined
 * cannot answer yet, so their card is shown and disabled). Sent is not
 * accepted: the date shows "asked, no answer yet" until they say yes.
 */
export function AskSheet({ item, onClose, plan, lang, c, onInvite }: { item: FamilyPlanDate | null; onClose: () => void; plan: FamilyPlanApi; lang: Lang; c: FamilyPlanCopy; onInvite: () => void }) {
  const { roster, me } = plan;
  const others = roster.adults.filter((a) => a.uid !== me.uid);
  const [pick, setPick] = useState<FamilyPlanAdult | null>(null);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!item) return;
    const first = others.find((a) => a.uid !== item.holder?.uid) ?? null;
    setPick(first ?? me);
    setNote(c.notePrefill(item.title, whenLabel(item, lang)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);
  if (!item) return <FpDialog open={false} onClose={onClose} title={c.askTitle}>{null}</FpDialog>;
  const label = pick ? adultLabel(pick, me.uid, c) : "";
  const isMe = pick?.uid === me.uid;
  const submit = async () => {
    if (!pick) return;
    const ok = isMe ? await plan.take(item.id) : await plan.ask(item.id, pick, note);
    if (ok) onClose();
  };
  const state = stateOf(item);
  return (
    <FpDialog open={!!item} onClose={onClose} title={c.askTitle}>
      <div className="line" style={{ gap: 14, alignItems: "center", padding: 14, borderRadius: 18, background: "var(--card)", boxShadow: "inset 0 0 0 1px var(--rule)" }}>
        <div className={`fp-big ${state === "has" ? "has" : state === "none" ? "none" : ""}`} aria-hidden="true">
          <small>{weekdayShort(item.date, lang)}</small>
          <b>{dayNum(item.date)}</b>
          {item.time && <span>{item.time}</span>}
        </div>
        <div className="stack" style={{ gap: 4, minWidth: 0 }}>
          <b dir="auto" style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 19, lineHeight: 1.2 }}>{item.title}</b>
          <span className="small">{c.kinds[item.kind]} · {whenLabel(item, lang)}</span>
        </div>
      </div>
      <span className="kicker">{c.askOne}</span>
      <div className="fp-who" role="group" aria-label={c.askOne}>
        <button type="button" aria-pressed={isMe} onClick={() => setPick(me)}>
          <span className="av lg" aria-hidden="true">{adultInitial(c.you)}</span>
          <b>{c.you}</b>
          <small>{c.takeItYourself}</small>
        </button>
        {others.map((a) => {
          const name = adultLabel(a, me.uid, c);
          return (
            <button key={a.uid} type="button" aria-pressed={pick?.uid === a.uid} onClick={() => setPick(a)}>
              <span className="av lg b" aria-hidden="true">{adultInitial(name)}</span>
              <b dir="auto">{name}</b>
              <small>{c.coParent}</small>
            </button>
          );
        })}
        {roster.invited.map((g) => (
          <button key={g.id} type="button" disabled aria-disabled="true">
            <span className="av lg c" aria-hidden="true">{adultInitial(g.recipientEmail)}</span>
            <b dir="auto">{g.recipientEmail.split("@")[0]}</b>
            <small>{c.invitedNotJoined}</small>
          </button>
        ))}
      </div>
      {others.length === 0 && (
        <button type="button" className="ds-link" onClick={onInvite}>
          <Icon name="person_add" size={16} />{c.inviteCoParent}
        </button>
      )}
      {!isMe && pick && (
        <>
          <div className="fp-flow" aria-hidden="true">
            <span><Token kind="date" state="none" size="sm" label="">{dayNum(item.date)}</Token>{c.askFlowNow}</span>
            <span><Token kind="date" state="open" size="sm" label="">{dayNum(item.date)}</Token>{c.askFlowAsked}</span>
            <span><Token kind="date" size="sm" label="">{dayNum(item.date)}</Token>{c.askFlowYes}</span>
          </div>
          <label className="fp-field" htmlFor="fp-ask-note">
            {c.noteTo(label)}
            <textarea id="fp-ask-note" dir="auto" rows={3} maxLength={400} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </>
      )}
      {plan.error && <p role="alert" className="fp-err">{c.saveError}</p>}
      <button type="button" className="btn primary block" style={{ minHeight: 52 }} disabled={!pick || plan.busy} onClick={() => void submit()}>
        {isMe ? c.takeButton : c.askButton(label)}
      </button>
      {!isMe && <p className="small">{c.askHint}</p>}
    </FpDialog>
  );
}
