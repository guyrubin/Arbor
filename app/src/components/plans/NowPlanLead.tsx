/**
 * NowPlanLead — B-BOOK-78: the plan is the parent's week in Today. The lead
 * card's body when an active plan runs: the three steps as the parent will do
 * them (the plan's own parent lines), and, in the evening, the night
 * question — "Did the plan happen tonight?" — answered in one tap. The
 * answer is a COUNT on the parent's shelf (lib/plans/planWeek recordNight),
 * never a rate, a streak or a verdict; it writes a journal moment ONLY when
 * the parent taps "Keep tonight in the journal" (explicit confirmation).
 * Parent register; nothing here reaches a child surface.
 */
import React, { useState } from "react";
import { Icon } from "../ui/Icon";
import { planString } from "../../lib/plans/planStrings";
import { nightRecorded, nightsCount, type ActivePlan } from "../../lib/plans/planWeek";
import { planBookFromDoc } from "../../lib/library/plans/planBookDoc";

const BTN = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 t-sm font-semibold focus:outline-none focus-visible:ring-2";

export interface NowPlanLeadProps {
  plan: ActivePlan;
  lang: "en" | "he";
  childName: string;
  now: Date;
  evening: boolean;
  onNight: (happened: boolean) => void | Promise<void>;
  onUndoNight: () => void | Promise<void>;
  /** The explicit journal confirmation (writes one moment). */
  onJournal: () => void | Promise<void>;
  onOpen: () => void;
}

export default function NowPlanLead({ plan, lang, childName, now, evening, onNight, onUndoNight, onJournal, onOpen }: NowPlanLeadProps) {
  const s = (key: Parameters<typeof planString>[0], vars?: Record<string, string | number>) => planString(key, lang, vars);
  const book = planBookFromDoc(plan.doc);
  const recorded = nightRecorded(plan.doc, now);
  const [journaled, setJournaled] = useState(false);
  const [notTonight, setNotTonight] = useState(false);
  return (
    <section className="now-lead arbor-depth-primary" data-module="now-plan" aria-label={s("today.kicker", { name: childName })}>
      <p className="now-plan-kicker">{s("today.kicker", { name: childName })}</p>
      <h2 className="now-plan-title" dir="auto">{plan.def.title[lang]}</h2>
      {book && (
        <ol className="now-lead-body mt-2 flex flex-col gap-2" style={{ listStyle: "none", margin: 0, padding: 0 }} data-plan-steps="">
          {book.parent.planSteps.map((line, i) => (
            <li key={i} className="flex gap-2" dir="auto"><span className="arbor-num font-semibold" style={{ color: "var(--arbor-muted)" }}>{i + 1}.</span><span>{line[lang]}</span></li>
          ))}
        </ol>
      )}
      <p className="arbor-num mt-2 t-sm" style={{ color: "var(--arbor-muted)" }}>{s("today.meta", { day: plan.day, days: plan.doc.durationDays })} · {s("section.nights", { count: nightsCount(plan.doc) })}</p>
      {evening && !recorded && !notTonight && (
        <div className="now-lead-actions now-followup mt-3" role="group" aria-label={s("today.night.q")}>
          <p className="now-followup-q"><Icon name="nightlight" size={18} />{s("today.night.q")}</p>
          <button type="button" className="companion-primary" data-plan-night-yes="" onClick={() => void onNight(true)}><Icon name="check" size={19} />{s("today.night.yes")}</button>
          <button type="button" className="companion-secondary" data-plan-night-no="" onClick={() => { setNotTonight(true); void onNight(false); }}>{s("today.night.no")}</button>
        </div>
      )}
      {evening && recorded && (
        <div className="mt-3 flex flex-wrap items-center gap-2" data-plan-night-done="">
          <p role="status" className="now-inline-status">{s("today.night.done")}</p>
          <button type="button" className="companion-text-button" data-plan-night-undo="" onClick={() => void onUndoNight()}>{s("today.night.undo")}</button>
          {journaled ? <p role="status" className="now-inline-status">{s("today.night.journaled")}</p>
            : <button type="button" className={BTN} style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }} data-plan-night-journal="" onClick={() => { setJournaled(true); void onJournal(); }}><Icon name="edit_note" size={18} />{s("today.night.journal")}</button>}
        </div>
      )}
      <button type="button" className="companion-text-button mt-2" data-plan-open="" onClick={onOpen}>{s("today.open")}<Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" /></button>
    </section>
  );
}
