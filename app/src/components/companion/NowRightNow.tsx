import React, { useMemo } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { availableHardMomentCards } from "../../content/selectCards";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { goToRoute } from "../../hooks/useHashQuery";
import { localized } from "../../lib/routines";
import { routineDayKey, routineIdOfPlan, routineTemplatesForAge } from "../../lib/routineTemplates";
import type { ActionPlan } from "../../types";
import { HeroAvatar } from "../ui/HeroAvatar";
import Icon from "../ui/Icon";
import { RIGHT_NOW_COPY } from "./nowV41Copy";
import { clockOf, dayPart, hardWindowNow, routineForPart, selectRightNow, type DayPart } from "./rightNowModel";
import { todaysRhythm } from "./togetherRhythm";
import "./nowV41.css";

/* ════════════════════════════════════════════════════════════════════════════
   v4.1 Right now — ONE line under the question row that follows the day.

   Morning: the started morning routine's next step. Midday: the upcoming
   visit. Before dinner: the window the parent's own hard moments keep falling
   in (rhythm evidence floor and a strict majority, rightNowModel.ts), else the
   routine of that part. Evening: tonight's three questions. The record decides
   every state; with nothing for this part of the day the line is not drawn.
   A state that is already Now's lead is not repeated here (NowView passes it
   as absent). The time badge is the part of the day, never a judgement.
   ════════════════════════════════════════════════════════════════════════════ */

const PART_ICON: Readonly<Record<DayPart, string>> = { morning: "wb_sunny", midday: "light_mode", afternoon: "schedule", evening: "dark_mode" };

export interface NowRightNowProps {
  now: Date;
  lang: "en" | "he";
  /** The upcoming visit's door when it is not already the lead. */
  visit: { head: string; sub: string; cta: string; onOpen: () => void } | null;
  /** Opens tonight's questions when they are ready and not already the lead. */
  onTonight: (() => void) | null;
}

export default function NowRightNow({ now, lang, visit, onTonight }: NowRightNowProps) {
  const { childProfile, actionPlans = [], behaviorLogs = [], openHardMomentNow } = useArbor();
  const { uiLang } = useLanguage();
  const copy = RIGHT_NOW_COPY[lang];
  const part = dayPart(now.getHours());
  const minuteKey = Math.floor(now.getTime() / 60_000);
  const months = ageMonthsFromProfile(childProfile, now);
  const templates = useMemo(() => routineTemplatesForAge(months), [months]);
  const day = routineDayKey(now);
  const routine = useMemo(() => {
    // Only a stored plan is part of the rhythm (Together's rule): the newest
    // plan started from each routine, by its plan id.
    const planFor = (routineId: string): ActionPlan | null => actionPlans.find((plan) => routineIdOfPlan(plan) === routineId) ?? null;
    return routineForPart(todaysRhythm(templates, planFor, day, lang), part);
  }, [templates, actionPlans, day, lang, part]);
  // Read once a minute (useNowClock's tick), not per render.
  const hard = useMemo(() => hardWindowNow(behaviorLogs, now), [behaviorLogs, minuteKey]);
  const hardDoor = useMemo(
    () => availableHardMomentCards({ now, ageMonths: months, locale: uiLang === "he" ? "he" : "en" }).length > 0,
    // The gate is per day and language.
    [months, uiLang, day],
  );
  const state = selectRightNow({ part, hard, hardDoor, routine, visit: !!visit, tonight: !!onTonight });
  if (!state) return null;

  let head = "";
  let sub = "";
  let cta = "";
  let ctaIcon = "arrow_forward";
  let onAct: () => void = () => {};
  if (state.kind === "hard") {
    head = copy.hardHead[part];
    sub = copy.hardSub(state.window.inWindow, state.window.recent, clockOf(state.window.fromMinute), clockOf(state.window.toMinute));
    cta = copy.hardCta;
    ctaIcon = "volunteer_activism";
    onAct = () => openHardMomentNow();
  } else if (state.kind === "routine") {
    const card = state.card;
    head = copy.routineHead(card.nextStep ?? "");
    sub = copy.routineSub(localized(card.routine.title, lang), card.done.length, card.total);
    cta = card.done.length > 0 ? copy.routineContinue : copy.routineStart;
    ctaIcon = "play_arrow";
    onAct = () => goToRoute("practice", { f: "routines", routine: card.routine.id });
  } else if (state.kind === "visit" && visit) {
    head = visit.head;
    sub = visit.sub;
    cta = visit.cta;
    ctaIcon = "description";
    onAct = visit.onOpen;
  } else if (state.kind === "tonight" && onTonight) {
    head = copy.tonightHead;
    sub = copy.tonightSub;
    cta = copy.tonightCta;
    onAct = onTonight;
  } else {
    return null;
  }

  const clock = clockOf(now.getHours() * 60 + now.getMinutes());
  return <section className="now-right-now arbor-fade" data-module="now-right-now" data-state={state.kind} data-part={part} aria-label={copy.region}>
    <span className="now-right-now-face" aria-hidden="true">
      <HeroAvatar size={52} animate={false} ring={false} badge={false} decorative />
      <span className="now-right-now-badge" data-part={part}><Icon name={PART_ICON[part]} size={16} fill={1} /></span>
    </span>
    <div className="now-right-now-text">
      <p className="now-right-now-label" data-testid="now-right-now-label">{copy.label(clock)}</p>
      <p className="now-right-now-head" dir="auto">{head}</p>
      <p className="now-right-now-sub" dir="auto">{sub}</p>
    </div>
    <button type="button" className="now-right-now-cta arbor-press" data-testid="now-right-now-cta" onClick={onAct}>
      <Icon name={ctaIcon} size={19} className={ctaIcon === "arrow_forward" ? "rtl:-scale-x-100" : undefined} />{cta}
    </button>
  </section>;
}
