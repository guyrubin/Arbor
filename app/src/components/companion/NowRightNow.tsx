import React, { useEffect, useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { availableHardMomentCards } from "../../content/selectCards";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { goToRoute } from "../../hooks/useHashQuery";
import { localized } from "../../lib/routines";
import { routineDayKey, routineIdOfPlan, routineTemplatesForAge } from "../../lib/routineTemplates";
import type { ActionPlan, Milestone } from "../../types";
import type { Practice } from "../../content/practices";
import { milestoneText } from "../../lib/milestoneData";
import { resolveHebrewSlash } from "../../lib/hebrewSlashGender";
import { dayKey } from "../../lib/programs/enrolment";
import { practiceText } from "../loop/PracticeCard";
import { answerTonight, readTonightProgress, tonightQueue, writeTonightProgress, type TonightProgress, type TonightQuestion } from "./rightNowTonight";
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
   routine of that part. Evening: tonight's questions, answered right here,
   one tap each (rightNowTonight.ts). The record decides
   every state; with nothing for this part of the day the line is not drawn.
   A state that is already Now's lead is not repeated here (NowView passes it
   as absent). The time badge is the part of the day, never a judgement.
   ════════════════════════════════════════════════════════════════════════════ */

const PART_ICON: Readonly<Record<DayPart, string>> = { morning: "wb_sunny", midday: "light_mode", afternoon: "schedule", evening: "dark_mode" };

export interface NowRightNowProps {
  now: Date;
  lang: "en" | "he";
  /** The upcoming visit's door when it is not already the lead. */
  visit: { head: string; sub: string; cta: string; onOpen: () => void; drafted?: boolean } | null;
  /** Tonight's questions when they are ready and not already the lead. */
  tonight: RightNowTonight | null;
}

/** Tonight's own seams (useNowLoop's `tonight`), handed in by NowView. */
export interface RightNowTonight {
  childName: string;
  gender?: string | null;
  /** Asked only about a practice the parent SAW and has not answered. */
  practice: Practice | null;
  notice: Milestone | null;
  dayQuestion: { key: string; vars: Record<string, string> } | null;
  onPractice: (answer: "did" | "not_today") => void;
  onNotice: (status: "yes" | "not_yet") => Promise<unknown> | unknown;
  /** Opens the full evening at its words step (the reviewed field writes). */
  onWrite: () => void;
  onOpenAll: () => void;
}

export default function NowRightNow({ now, lang, visit, tonight }: NowRightNowProps) {
  const { childProfile, actionPlans = [], behaviorLogs = [], openHardMomentNow } = useArbor();
  const { uiLang, t } = useLanguage();
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
  // Tonight's progress on this device, per child and day (a reload never asks again).
  const today = dayKey(now);
  const [progress, setProgress] = useState<TonightProgress>(() => readTonightProgress(childProfile.id, today));
  useEffect(() => { setProgress(readTonightProgress(childProfile.id, today)); }, [childProfile.id, today]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const todays = progress.day === today ? progress : { day: today, done: [], kept: 0 };
  const queue = tonightQueue({ practice: !!tonight?.practice, notice: !!tonight?.notice, words: !!tonight?.dayQuestion }, todays);
  const state = selectRightNow({ part, hard, hardDoor, routine, visit: !!visit, tonight: !!tonight && queue.total > 0 });
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
  } else if (state.kind === "tonight" && tonight) {
    return <RightNowShell now={now} part={part} copy={copy}>
      <TonightAsk
        tonight={tonight}
        lang={lang}
        t={t}
        queue={queue}
        kept={todays.kept}
        busy={busy}
        failed={failed}
        copy={copy}
        onDone={(question, kept) => {
          const next = answerTonight(todays, question, kept);
          writeTonightProgress(childProfile.id, next);
          setProgress(next);
        }}
        setBusy={setBusy}
        setFailed={setFailed}
      />
    </RightNowShell>;
  } else {
    return null;
  }

  const clock = clockOf(now.getHours() * 60 + now.getMinutes());
  return <section className="now-right-now arbor-fade" data-module="now-right-now" data-state={state.kind} data-part={part} data-drafted={state.kind === "visit" && visit?.drafted ? "true" : undefined} aria-label={copy.region}>
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

type RightNowCopy = (typeof RIGHT_NOW_COPY)["en" | "he"];

/** The Right now frame (face, part badge, clock label) around tonight's question. */
function RightNowShell({ now, part, copy, children }: { now: Date; part: DayPart; copy: RightNowCopy; children: React.ReactNode }) {
  const clock = clockOf(now.getHours() * 60 + now.getMinutes());
  return <section className="now-right-now arbor-fade" data-module="now-right-now" data-state="tonight" data-part={part} aria-label={copy.region}>
    <span className="now-right-now-face" aria-hidden="true">
      <HeroAvatar size={52} animate={false} ring={false} badge={false} decorative />
      <span className="now-right-now-badge" data-part={part}><Icon name={PART_ICON[part]} size={16} fill={1} /></span>
    </span>
    <div className="now-right-now-text">
      <p className="now-right-now-label" data-testid="now-right-now-label">{copy.label(clock)}</p>
      {children}
    </div>
  </section>;
}

/* One question at a time, two answers each; the words question hands over to
   the full evening at its words step. Answers go through Tonight's own seams. */
export function TonightAsk({ tonight, lang, t, queue, kept, busy, failed, copy, onDone, setBusy, setFailed }: {
  tonight: RightNowTonight;
  lang: "en" | "he";
  t: (key: string, vars?: Record<string, string | number>) => string;
  queue: ReturnType<typeof tonightQueue>;
  kept: number;
  busy: boolean;
  failed: boolean;
  copy: RightNowCopy;
  onDone: (question: TonightQuestion, kept: boolean) => void;
  setBusy: (busy: boolean) => void;
  setFailed: (failed: boolean) => void;
}) {
  const g = (s: string) => (lang === "he" ? resolveHebrewSlash(s, tonight.gender) : s);
  const all = <button type="button" className="now-right-now-link" data-testid="now-right-now-tonight-all" onClick={tonight.onOpenAll}>{copy.tonightAll}</button>;
  if (queue.finished || !queue.next) {
    return <>
      <p className="now-right-now-head" dir="auto" data-testid="now-right-now-tonight-done">{copy.tonightDoneHead}</p>
      <p className="now-right-now-sub" dir="auto">{copy.tonightDoneSub(kept)}</p>
      {all}
    </>;
  }
  const question = queue.next;
  const name = tonight.childName || t("today.record.childFallback");
  let head = "";
  let detail = "";
  let yes = "";
  let no = "";
  let onYes: () => void = () => {};
  let onNo: () => void = () => {};
  if (question === "practice" && tonight.practice) {
    head = t("elev.loop.tonight.practice.q");
    detail = practiceText(tonight.practice, "do", lang, tonight.gender) || practiceText(tonight.practice, "say", lang, tonight.gender);
    yes = t("elev.loop.practice.didIt");
    no = t("elev.loop.practice.notToday");
    onYes = () => { tonight.onPractice("did"); onDone("practice", true); };
    onNo = () => { tonight.onPractice("not_today"); onDone("practice", true); };
  } else if (question === "notice" && tonight.notice) {
    head = copy.tonightNoticeQ;
    detail = milestoneText(tonight.notice, "title", t, { gender: tonight.gender ?? null });
    yes = t("ms.observe.yes");
    no = t("ms.observe.notYet");
    const answer = (status: "yes" | "not_yet") => {
      if (busy) return;
      setBusy(true);
      setFailed(false);
      void Promise.resolve()
        .then(() => tonight.onNotice(status))
        .then(() => onDone("notice", true), () => setFailed(true))
        .finally(() => setBusy(false));
    };
    onYes = () => answer("yes");
    onNo = () => answer("not_yet");
  } else if (question === "words" && tonight.dayQuestion) {
    head = g(t(tonight.dayQuestion.key, { ...tonight.dayQuestion.vars, name }));
    yes = copy.tonightWrite;
    no = copy.tonightNothing;
    onYes = () => { onDone("words", false); tonight.onWrite(); };
    onNo = () => onDone("words", false);
  }
  return <>
    <p className="now-right-now-head" dir="auto" data-testid="now-right-now-question" data-question={question}>{head}</p>
    {detail && <p className="now-right-now-detail" dir="auto">{detail}</p>}
    <p className="now-right-now-sub" dir="auto">{copy.tonightAsk(queue.index, queue.total)}</p>
    <div className="now-right-now-answers" role="group" aria-label={head} aria-busy={busy || undefined}>
      <button type="button" className="now-right-now-cta arbor-press" data-testid="now-right-now-yes" disabled={busy} onClick={onYes}>{yes}</button>
      <button type="button" className="now-right-now-alt arbor-press" data-testid="now-right-now-no" disabled={busy} onClick={onNo}>{no}</button>
    </div>
    {failed && <p role="alert" className="now-right-now-sub" data-testid="now-right-now-failed">{copy.tonightFailed}</p>}
    {all}
  </>;
}
