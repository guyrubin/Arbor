import React, { useMemo } from "react";
import { useArbor } from "../../../context/ArborContext";
import { Fig, LivingForm, MoreLink, Tile } from "../../../design/primitives";
import Icon from "../../ui/Icon";
import { planDoneSteps, todaysPlanStep } from "../../../lib/plans";
import { routineIdOfPlan } from "../../../lib/routineTemplates";
import { dayKey } from "../../../practice/signals";
import type { ActionPlan } from "../../../types";
import type { NowV10Copy } from "./nowV10Copy";

/**
 * Now v10.1 › stop 4 "Coming up": the action plan (its trail of steps and the
 * next one, a link to Plans), then the dated things and the reminders, each
 * one line and a link to its home (Care › Visits, Family plan, Gentle
 * reminders). Every line here is a door; nothing is decided on Now.
 */

/** One Coming up line: a date tile or a glyph, the thing, its one sub-line, and where it goes. */
export function NowRow({ date, icon, title, sub, action, onOpen, testId, className, badge }: {
  /** A date tile: the weekday and the day number (a dashed tile when nobody has it yet). */
  date?: { weekday: string; day: number; none?: boolean } | null;
  icon?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  /** The trailing link's words ("Prepare"); a chevron alone when absent. */
  action?: string;
  onOpen: () => void;
  testId?: string;
  className?: string;
  badge?: React.ReactNode;
}) {
  return <button type="button" className={["nw-row", className].filter(Boolean).join(" ")} data-testid={testId} onClick={onOpen}>
    {date ? <span className={date.none ? "nw-date none" : "nw-date"} aria-hidden="true">{date.weekday}<i>{date.day}</i></span>
      : <span className="nw-ico" aria-hidden="true"><Icon name={icon ?? "event"} size={24} /></span>}
    <span className="nw-row-text"><span className="t" dir="auto">{title}{badge}</span>{sub && <span className="s" dir="auto">{sub}</span>}</span>
    <span className="nw-lnk">{action}<Icon name="chevron_right" size={18} className="rtl:-scale-x-100" /></span>
  </button>;
}

/** The plan Now shows: the newest action plan (not a ready-made routine) that still has a step to do. */
export function currentActionPlan(plans: readonly ActionPlan[], loop: Parameters<typeof todaysPlanStep>[1], today: string) {
  for (const plan of plans) {
    if (routineIdOfPlan(plan)) continue;
    const step = todaysPlanStep(plan, loop, today);
    if (step) return { plan, step };
  }
  return null;
}

/** The action plan, compact (Objects-Graphic › Plan trail): steps as tokens, the next one ringed. */
export function NowActionPlan({ composition, copy, plansLabel, nextLine, onOpen, titleId }: {
  composition: "desk" | "phone";
  copy: NowV10Copy;
  plansLabel: string;
  nextLine: (step: string) => string;
  onOpen: () => void;
  titleId: string;
}) {
  const { actionPlans = [], actionLoop = [] } = useArbor();
  const today = dayKey(new Date());
  const current = useMemo(() => currentActionPlan(actionPlans, actionLoop, today), [actionPlans, actionLoop, today]);
  if (!current) return null;
  const { plan, step } = current;
  const flat = (plan.phases ?? []).flatMap((phase, phaseIdx) => (phase.steps ?? []).map((s, stepIdx) => ({ phaseIdx, stepIdx, done: s.completed || s.status === "done" })));
  const done = planDoneSteps(plan);
  const desk = composition === "desk";
  return <Tile icon="check" kind="plan" title={<span dir="auto">{plan.title}</span>} titleId={titleId} className={desk ? "x4 nw-actionplan" : "nw-actionplan"}
    link={<MoreLink onClick={onOpen}>{plansLabel}</MoreLink>}>
    <div className="line" style={{ gap: desk ? 14 : 12 }}>
      <LivingForm src="/visuals/guides/drop-off-480.webp" width={desk ? 116 : 60} height={desk ? 84 : 43} crop={desk ? { w: 265.1, h: 149.1, x: -140.9, y: -38.7 } : { w: 137.1, h: 77.1, x: -72.9, y: -20 }} />
      {done > 0 && <Fig size="md" n={done} unit={copy.stepsDone(done)} />}
    </div>
    <span className="line nw-trail" role="img" aria-label={copy.planTrailAria(done, flat.length)}>
      {flat.map((s) => {
        const here = s.phaseIdx === step.phaseIdx && s.stepIdx === step.stepIdx;
        return <i key={`${s.phaseIdx}.${s.stepIdx}`} className={here ? "tok plan here md" : s.done ? "tok plan md" : "tok plan open md"} />;
      })}
    </span>
    <p className="line1" dir="auto">{nextLine(step.text)}</p>
  </Tile>;
}
