import React, { useState } from "react";
import type { Composition } from "../../../design/useComposition";
import Icon from "../../ui/Icon";
import { planString, type PlanStringKey } from "../../../lib/plans/planStrings";
import { nightRecorded, nightsCount, tonightStepForParent, type ActivePlan } from "../../../lib/plans/planWeek";
import { planBookFromDoc } from "../../../lib/library/plans/planBookDoc";
import type { NowV10Copy } from "./nowV10Copy";

/**
 * Now v10.1 › stop 2 "Waiting for you": the screen's second question as a
 * sequence of compact objects, each with its own anatomy and a "when" mark on
 * a dotted line — Now (did you notice), Tonight (the Challenge plan book, or
 * the door to one), Later (Arbor's notebook, a count and a link). The same
 * steps on desktop (the rail) and phone (stacked); a step with nothing in it
 * is not drawn.
 */
export interface WaitingStep {
  key: "now" | "tonight" | "later";
  when: string;
  sub?: string | null;
  /** The blue mark: this step is the one to do now. */
  current?: boolean;
  /** Grows with the rail's height on desktop (the board's g1/g2 weights). */
  grow?: 1 | 2;
  body: React.ReactNode;
}

export default function NowWaiting({ composition, steps }: { composition: Composition; steps: WaitingStep[] }) {
  return <div className={composition === "desk" ? "nw-seq" : "nw-seq m"}>
    {steps.map((step) => <div key={step.key} className={["nw-step", step.current && "nw-now", step.grow === 1 && "g1", step.grow === 2 && "g2"].filter(Boolean).join(" ")} data-step={step.key}>
      <span className="nw-when"><b>{step.when}</b>{step.sub && <><i className="d" aria-hidden="true" /><span>{step.sub}</span></>}</span>
      {step.body}
    </div>)}
  </div>;
}

type S = (key: PlanStringKey, vars?: Record<string, string | number>) => string;

/**
 * The Challenge plan object (B-BOOK-78, drawn as O-NowObjects' plan book):
 * the book's cover with its title, the night it is, tonight's step as the
 * grown-ups do it, the plan's three steps (its own parent lines), "Open book", and — in the evening, as production asks it —
 * "Did the plan happen tonight?" answered in one tap. The answer is a COUNT
 * on the parent's shelf (recordNight), never a rate or a verdict; it writes a
 * journal moment only on the explicit "Keep tonight in the journal".
 */
export function NowChallengePlan({ plan, lang, childName, now, evening, onNight, onUndoNight, onJournal, onOpen, copy }: {
  plan: ActivePlan;
  copy: NowV10Copy;
  lang: "en" | "he";
  childName: string;
  now: Date;
  evening: boolean;
  onNight: (happened: boolean) => void | Promise<void>;
  onUndoNight: () => void | Promise<void>;
  onJournal: () => void | Promise<void>;
  onOpen: () => void;
}) {
  const s: S = (key, vars) => planString(key, lang, vars);
  const recorded = nightRecorded(plan.doc, now);
  const [journaled, setJournaled] = useState(false);
  const [notTonight, setNotTonight] = useState(false);
  const total = plan.doc.durationDays;
  const night = Math.min(plan.day, total);
  const step = tonightStepForParent(plan.doc, lang);
  const title = plan.def.title[lang];
  const book = planBookFromDoc(plan.doc);
  return <section className="nw-plan" data-module="now-plan" aria-label={s("today.kicker", { name: childName })} dir={lang === "he" ? "rtl" : "ltr"}>
    <div className="top">
      <span className="nw-book" role="img" aria-label={title}><b dir="auto">{title}</b></span>
      <span className="nw-plan-text">
        <b className="t">{copy.readPlanBook}</b>
        <span className="s" dir="auto">{copy.planBookLine(title, childName, night, total)}</span>
        {step && <span className="s" dir="auto" data-plan-tonight="">{s("card.tonight", { step })}</span>}
        <span className="s small" data-plan-nights="">{s("section.nights", { count: nightsCount(plan.doc) })}</span>
        {book && <ol className="nw-plan-steps" data-plan-steps="">
          {book.parent.planSteps.map((line, i) => <li key={i} dir="auto"><span className="num">{i + 1}.</span><span>{line[lang]}</span></li>)}
        </ol>}
        <button type="button" className="btn primary sm" data-plan-open="" onClick={onOpen}><Icon name="menu_book" size={18} />{s("card.open")}</button>
      </span>
    </div>
    {evening && !recorded && !notTonight && <div className="ck" role="group" aria-labelledby={`plan-night-${plan.doc.id}`}>
      <span id={`plan-night-${plan.doc.id}`}>{s("today.night.q")}</span>
      <div className="nw-yn">
        <button type="button" data-plan-night-yes="" onClick={() => void onNight(true)}>{s("today.night.yes")}</button>
        <button type="button" data-plan-night-no="" onClick={() => { setNotTonight(true); void onNight(false); }}>{s("today.night.no")}</button>
      </div>
    </div>}
    {evening && recorded && <div className="ck" data-plan-night-done="">
      <span role="status">{s("today.night.done")}</span>
      <div className="nw-plan-after">
        <button type="button" className="ds-link" data-plan-night-undo="" onClick={() => void onUndoNight()}>{s("today.night.undo")}</button>
        {journaled ? <span role="status" className="small">{s("today.night.journaled")}</span>
          : <button type="button" className="btn ghost sm" data-plan-night-journal="" onClick={() => { setJournaled(true); void onJournal(); }}><Icon name="edit_note" size={18} />{s("today.night.journal")}</button>}
      </div>
    </div>}
  </section>;
}

/** Later · Arbor's notebook: how many notes wait, and the way to About, where they are approved. Never inline approval. */
export function NowNotebookBadge({ waiting, remembered = 0, label, notebook, copy, onOpen }: { waiting: number; /** Notes already approved: a count beside a check, never a progress share. */ remembered?: number; label: string; notebook: string; copy: NowV10Copy; onOpen: () => void }) {
  const marks = Math.min(waiting, 6);
  return <button type="button" className="nw-badge" aria-label={`${notebook}: ${label}`} data-testid="now-notebook-badge" onClick={onOpen}>
    <span className="fig"><b>{waiting}</b><span>{copy.notesWaiting(waiting)}<small>{notebook}</small>{remembered > 0 && <span className="nw-remembered" data-testid="now-notebook-remembered"><i className="tok plan sm" aria-hidden="true" />{copy.remembered(remembered)}</span>}</span></span>
    <span className="mini" aria-hidden="true">{Array.from({ length: marks }, (_, i) => <i key={i} className="tok ai sm" />)}</span>
    <Icon name="chevron_right" size={18} className="rtl:-scale-x-100" />
  </button>;
}
