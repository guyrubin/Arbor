import React, { useState } from "react";
import { Icon } from "../ui/Icon";
import { FreeText } from "../ui/FreeText";
import { useLanguage } from "../../context/LanguageContext";
import type { Milestone } from "../../types";
import type { ActionOutcome } from "../../actionLoop/model";
import { resolveHebrewSlash } from "../../lib/hebrewSlashGender";
import { shelfLabel, type ShelfId } from "../../lib/shelves/registry";
import type { PracticeAnswer, PracticePick } from "../../lib/practice/choosePractice";
import type { ObserveStatus, ObservedWhen } from "../../lib/milestones/observe";
import { TONIGHT_STEPS } from "../../lib/loop/tonight";
import { GOAL_SCALE_VALUES, type FamilyGoal, type GoalScaleKey, type GoalScaleValue } from "../../lib/goals";
import { ShelfGlyph } from "../ui/ShelfGlyph"; // B-DESIGN-04: the 44 px duotone glyph
import NoticeCard from "./NoticeCard";
import { practiceText } from "./PracticeCard";
// B-STATUS-01: the one receipt line of parent mode.
import { Receipt } from "../ui/Receipt";
import { routeHash } from "../../lib/routes";

export type TonightStep = 1 | 2 | 3 | 4 | "done";

export interface TonightFlowProps {
  childName: string;
  gender?: string | null;
  /** Today's practice (null when none was offered — step 1 is skipped). */
  practice: PracticePick | null;
  /** Today's dose answer, if the parent already answered in the morning. */
  doseAnswer?: PracticeAnswer | null;
  /** When that answer was given (the dose row's acceptedAt) — the receipt
   *  under the say reads "this morning" before noon, else "earlier today". */
  doseAt?: string | null;
  /** Step 1: "Did it" / "Not today" (writes the day's dose row). */
  onPracticeAnswer: (answer: PracticeAnswer) => void;
  /** Step 1: how it went — the parent's choice, never inferred. */
  onOutcome: (outcome: Exclude<ActionOutcome, "not_today">) => void;
  /** Step 1: "What happened?" — one line, saved as a moment on the practice's shelf. */
  onWhatHappened: (text: string) => void;
  /** Step 2: the question (key + vars from lib/loop/tonight tonightDayQuestion). */
  dayQuestion: { key: string; vars: Record<string, string> };
  /** Step 2: the kept words (a `quote` keepsake). */
  onQuote: (text: string) => void;
  /** Step 3: one watch-for card from a shelf step 1 did not use. */
  notice: { milestone: Milestone; shelf: ShelfId } | null;
  onNotice: (status: ObserveStatus) => void;
  onNoticeWhen?: (when: ObservedWhen) => void;
  onNoticeUndo?: () => void;
  /** The story door (the last quiet line); omitted when no story fits the child (B-PLAY-24). */
  onStory?: () => void;
  /** B-PROG-07: the family's active goals, passed ONLY on the last day of the
   *  active program week (dayKey(now) === programWeekRange(startedAt, week).to)
   *  and never while a coach step is open; else absent. Step 4 asks how each
   *  went, answered in the family's OWN five words — the number never renders. */
  weeklyGoals?: FamilyGoal[];
  /** Step 4: the chip writes scoreGoal(goal, value) (one score per local day). */
  onGoalScore?: (goalId: string, value: GoalScaleValue) => void;
  /** Tests render each step statically. */
  initialStep?: TonightStep;
  /** Law 7: in the evening Tonight's CURRENT step is Today's primary move —
   *  the ONE literal moves with the step (critic c2 r1 P1-1): step 1's
   *  answers, then its how-group (or the not-today forward), step 2's
   *  words form (or its forward once kept), step 3's watch-for answers. */
  stampMove?: string;
}

const pillBase = "inline-flex min-h-[44px] items-center justify-center rounded-full px-4 t-base font-semibold";

/**
 * B-LOOP-10 — Tonight, one card, three steps (design of record: the tonight
 * state of art/mockups/today-option-1.html). Each step is one tap plus an
 * optional line; "{n} of 3" is the only progress (no bar, no timer); a step
 * can be skipped and then writes nothing. The question states what happened
 * and asks; it never tells the parent what the child felt. The story door is
 * the last line, under the card.
 */
export default function TonightFlow(props: TonightFlowProps) {
  const { t, uiLang } = useLanguage();
  const lang: "en" | "he" = uiLang === "he" ? "he" : "en";
  const g = (s: string) => (lang === "he" ? resolveHebrewSlash(s, props.gender) : s);
  const firstStep: TonightStep = props.practice ? 1 : 2;
  const [step, setStep] = useState<TonightStep>(props.initialStep ?? firstStep);
  const [answer, setAnswer] = useState<PracticeAnswer | null>(props.doseAnswer ?? null);
  // P5-LOOP critic c2 r2 (design P1 / B-LOOP-NEW-2b): a "Did it" given EARLIER
  // (the morning card) is confirmed by a muted receipt under the say; a tap
  // in this step needs none (the heading already moved on).
  const [answeredHere, setAnsweredHere] = useState(false);
  const [outcome, setOutcome] = useState<ActionOutcome | null>(null);
  const [line, setLine] = useState("");
  const [quote, setQuote] = useState("");
  const [kept, setKept] = useState(false);
  const [goalMarks, setGoalMarks] = useState<Record<string, GoalScaleValue>>({});
  const hasGoals = !!(props.weeklyGoals?.length && props.onGoalScore);
  const totalSteps = hasGoals ? TONIGHT_STEPS + 1 : TONIGHT_STEPS;
  const name = props.childName || t("today.record.childFallback");
  const forwardReady = !!outcome || !!line.trim();
  // Law 7: ONE stamp, spread on whichever action group the current step shows.
  const stamp: Record<string, string> = props.stampMove ? { "data-primary-move": props.stampMove } : {};

  // B-PROG-07: on a program week's last day the family's goals are step 4.
  const next = (from: TonightStep) =>
    setStep(from === 1 ? 2 : from === 2 && props.notice ? 3 : (from === 2 || from === 3) && hasGoals ? 4 : "done");
  const progress = (n: 1 | 2 | 3 | 4) => (
    <p data-testid="tonight-progress" className="arbor-num t-sm font-semibold" style={{ color: "var(--arbor-muted)" }}>
      {t("elev.loop.tonight.step", { n, total: totalSteps })}
    </p>
  );
  const skipButton = (from: TonightStep) => (
    <button type="button" data-testid="tonight-skip" onClick={() => next(from)} className={pillBase} style={{ color: "var(--arbor-muted)" }}>
      {t("elev.loop.tonight.skip")}
    </button>
  );
  const nextButton = (from: TonightStep) => (
    <button
      type="button"
      data-testid="tonight-next"
      onClick={() => next(from)}
      className={pillBase}
      style={{ color: "var(--arbor-ink)", background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }}
    >
      {t("elev.loop.tonight.next")}
    </button>
  );

  let body: React.ReactNode = null;
  if (step === 1 && props.practice) {
    const p = props.practice;
    const say = practiceText(p.practice, "say", lang, props.gender);
    // c2 r2 design P1: once "Did it" is in, the display heading IS the live
    // question ("How did it go?") — never the answered "Did you try it today?".
    const did = answer === "did";
    const doseHour = props.doseAt ? new Date(props.doseAt).getHours() : NaN;
    // a "Did it" tapped on tonight's practice card moments ago is not "earlier"
    const doseMs = props.doseAt ? Date.parse(props.doseAt) : NaN;
    const justNow = Number.isFinite(doseMs) && Date.now() - doseMs < 30 * 60_000;
    const earlierReceipt = did && !answeredHere && !justNow && props.doseAnswer === "did"
      ? t(Number.isFinite(doseHour) && doseHour < 12 ? "elev.loop.tonight.practice.didMorning" : "elev.loop.tonight.practice.didEarlier")
      : null;
    body = (
      <div data-testid="tonight-step-1">
        {/* P7-DESIGN fix r1 (R6, overview design P1-1): the morning card's
            kicker row — glyph · the caption in the label style over the shelf ·
            "1 of 3" as the inline-end tag where the minutes sit in the morning,
            on a hairline. */}
        <header data-testid="tonight-band" className="flex items-center gap-3 pb-2.5" style={{ borderBottom: "1px solid var(--arbor-rule)" }}>
          <ShelfGlyph shelf={p.shelf} />
          <div className="min-w-0 flex-1">
            <p data-testid="tonight-kicker" className="arbor-type-kicker">{t("elev.loop.tonight.practice.caption")}</p>
            <p className="mt-0.5 t-base font-semibold leading-tight" style={{ color: "var(--arbor-ink)" }}>{shelfLabel(p.shelf, t)}</p>
          </div>
          <span className="inline-flex h-[30px] flex-none items-center rounded-full px-2.5" style={{ background: "var(--arbor-paper)", boxShadow: "inset 0 0 0 1px var(--arbor-rule)" }}>
            {progress(1)}
          </span>
        </header>
        <h2 id="tonight-step-1-q" data-testid="tonight-step-1-heading" className="mt-3 font-semibold leading-tight" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)", fontSize: "var(--t-xl)" }}>
          {t(did ? "elev.loop.tonight.practice.how" : "elev.loop.tonight.practice.q")}
        </h2>
        <blockquote data-testid="tonight-say" className="mt-2 arbor-accent-rule arbor-type-say" style={{ color: "var(--arbor-ink)" }}>
          <FreeText text={t("elev.loop.ms.quoted", { text: say })} />
        </blockquote>
        {/* B-STATUS-01: the morning's answer, drawn by the one Receipt line —
            shown, not announced (it answers nothing tapped here). */}
        {earlierReceipt && (
          <Receipt testId="tonight-did-receipt" size="sm" className="mt-1.5" announce={false}>
            {earlierReceipt}
          </Receipt>
        )}
        {!answer ? (
          <div
            role="group"
            aria-label={t("elev.loop.tonight.practice.q")}
            data-testid="tonight-practice-answers"
            {...stamp}
            className="mt-4 flex gap-2.5"
          >
            <button
              type="button"
              data-answer="did"
              onClick={() => { setAnswer("did"); setAnsweredHere(true); props.onPracticeAnswer("did"); }}
              className="inline-flex min-h-12 flex-[1.15] items-center justify-center gap-2 rounded-full px-5 t-base font-bold"
              style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}
            >
              <Icon name="check" size={20} />
              {t("elev.loop.practice.didIt")}
            </button>
            <button
              type="button"
              data-answer="not_today"
              onClick={() => { setAnswer("not_today"); setAnsweredHere(true); props.onPracticeAnswer("not_today"); }}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full px-5 t-base font-semibold"
              style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
            >
              {t("elev.loop.practice.notToday")}
            </button>
          </div>
        ) : answer === "not_today" ? (
          <div className="mt-4 space-y-3">
            {/* B-STATUS-01: announced only when "Not today" was tapped HERE. */}
            <Receipt testId="tonight-not-today" icon={null} announce={answeredHere}>{t("elev.loop.practice.notTodayReceipt")}</Receipt>
            <div className="flex flex-wrap gap-2" {...stamp}>{nextButton(1)}</div>
          </div>
        ) : (
          <form
            className="mt-4 space-y-3"
            data-testid="tonight-how"
            onSubmit={(e) => {
              e.preventDefault();
              const text = line.trim();
              if (text) props.onWhatHappened(text);
              setLine("");
              next(1);
            }}
          >
            {/* Law 7: the how-group IS the evening's move once "Did it" is in
                (the morning answer, or step 1's own tap). c2 r2 design P1: the
                question is the heading above (no second 14 px label), and the
                outcome chips are the answer row — min-h-12, clay-dim fill,
                clay-deep ink: visibly heavier than "Next". */}
            <div role="group" aria-labelledby="tonight-step-1-q" data-testid="tonight-how-answers" {...stamp} className="flex flex-wrap gap-2.5">
              {(["helped", "somewhat"] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  data-outcome={o}
                  aria-pressed={outcome === o}
                  onClick={() => { setOutcome(o); props.onOutcome(o); }}
                  data-testid="tonight-outcome"
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-full px-5 t-base font-bold"
                  style={{
                    color: "var(--arbor-clay-deep)",
                    background: "var(--arbor-clay-dim)",
                    border: `2px solid ${outcome === o ? "var(--arbor-clay-deep)" : "transparent"}`,
                  }}
                >
                  {outcome === o && <Icon name="check" size={18} />}
                  {t(`elev.loop.tonight.practice.${o}`)}
                </button>
              ))}
            </div>
            <input
              type="text"
              dir="auto"
              value={line}
              maxLength={280}
              onChange={(e) => setLine(e.target.value)}
              placeholder={t("elev.loop.tonight.practice.what")}
              aria-label={t("elev.loop.tonight.practice.what")}
              data-testid="tonight-what"
              className="min-h-[44px] w-full min-w-0 rounded-xl px-3 t-base"
              style={{ background: "var(--arbor-paper)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
            />
            <p className="t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.loop.tonight.helper")}</p>
            {/* Critic c2 r1 (design P1): ONE forward button. Once an outcome or
                a line exists it is "Save & next" in the CTA treatment — the
                evening's only gradient; before that a plain "Next". */}
            <button
              type="submit"
              data-testid="tonight-save-next"
              data-ready={forwardReady ? "true" : "false"}
              className={pillBase}
              style={forwardReady
                ? { color: "var(--arbor-on-accent)", background: "var(--gradient-cta)", boxShadow: "var(--shadow-sm)" }
                : { color: "var(--arbor-ink)", background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }}
            >
              {t(forwardReady ? "elev.loop.tonight.saveNext" : "elev.loop.tonight.next")}
            </button>
          </form>
        )}
        {!answer && <div className="mt-2">{skipButton(1)}</div>}
      </div>
    );
  } else if (step === 2) {
    body = (
      <div data-testid="tonight-step-2">
        {progress(2)}
        <h2 className="mt-2 font-semibold leading-tight" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)", fontSize: "var(--t-xl)" }}>
          <FreeText text={g(t(props.dayQuestion.key, { ...props.dayQuestion.vars, name }))} />
        </h2>
        {kept ? (
          <div className="mt-3 space-y-3">
            {/* B-STATUS-01: the kept words, with a link to where they went. */}
            <Receipt testId="tonight-kept" link={{ where: g(t("elev.loop.said.title", { name })), href: `#${routeHash("language", { view: "said" })}`, testId: "tonight-kept-open" }}>
              {g(t("elev.loop.tonight.day.receipt", { name }))}
            </Receipt>
            <div className="flex flex-wrap gap-2" {...stamp}>{nextButton(2)}</div>
          </div>
        ) : (
          <>
            <form
              data-testid="tonight-quote-form"
              {...stamp}
              className="mt-3 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const text = quote.trim();
                if (!text) return;
                props.onQuote(text);
                setKept(true);
              }}
            >
              <input
                type="text"
                dir="auto"
                value={quote}
                maxLength={280}
                onChange={(e) => setQuote(e.target.value)}
                placeholder={t("elev.loop.tonight.day.placeholder")}
                aria-label={t("elev.loop.tonight.day.placeholder")}
                data-testid="tonight-quote"
                className="min-h-[44px] min-w-0 flex-1 rounded-xl px-3 t-base"
                style={{ background: "var(--arbor-paper)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)", fontFamily: "var(--font-editorial)" }}
              />
              <button type="submit" disabled={!quote.trim()} className={`${pillBase} disabled:opacity-60`} style={{ color: "var(--arbor-ink)", background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }}>
                {t("elev.loop.tonight.keep")}
              </button>
            </form>
            <div className="mt-2">{skipButton(2)}</div>
          </>
        )}
      </div>
    );
  } else if (step === 3 && props.notice) {
    body = (
      <div data-testid="tonight-step-3">
        {progress(3)}
        <h2 className="mt-2 font-semibold leading-tight" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)", fontSize: "var(--t-lg)" }}>
          {t("elev.loop.tonight.notice.title")}
        </h2>
        <NoticeCard
          key={props.notice.milestone.id}
          milestone={props.notice.milestone}
          shelf={props.notice.shelf}
          gender={props.gender}
          childName={props.childName}
          variant="row"
          onAnswer={props.onNotice}
          onWhen={props.onNoticeWhen}
          onUndo={props.onNoticeUndo}
          answers="segmented"
          answersAttrs={stamp}
        />
        <div className="flex flex-wrap gap-2">
          {hasGoals ? nextButton(3) : (
          <button
            type="button"
            data-testid="tonight-finish"
            onClick={() => setStep("done")}
            className={pillBase}
            style={{ color: "var(--arbor-ink)", background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }}
          >
            {t("elev.loop.tonight.finish")}
          </button>
          )}
        </div>
      </div>
    );
  } else if (step === 4 && hasGoals && props.weeklyGoals) {
    // B-PROG-07: the week's goal question — the family's words, answered with
    // the family's own five words (the outcome-chip recipe); never a number.
    const goals = props.weeklyGoals;
    const one = goals.length === 1;
    body = (
      <div data-testid="tonight-step-4">
        {progress(4)}
        <h2 id="tonight-step-4-q" className="mt-2 font-semibold leading-tight" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)", fontSize: "var(--t-lg)" }}>
          <FreeText text={one ? t("elev.program.goals.tonight.qGoal", { goal: goals[0].text }) : t("elev.program.goals.tonight.qMany")} />
        </h2>
        <div className="mt-3 space-y-4">
          {goals.map((goal, gi) => (
            <div key={goal.id} data-testid="tonight-goal" className="space-y-2">
              {!one && (
                <p className="border-s-2 ps-3 leading-snug" style={{ borderColor: "var(--arbor-ink)", color: "var(--arbor-ink-soft)", fontFamily: "var(--font-editorial)", fontSize: "var(--t-base)" }}>
                  <FreeText text={goal.text} />
                </p>
              )}
              <div
                role="group"
                aria-label={t("elev.program.goals.tonight.qGoal", { goal: goal.text })}
                data-testid="tonight-goal-answers"
                {...(gi === 0 ? stamp : {})}
                className="flex flex-wrap gap-2"
              >
                {GOAL_SCALE_VALUES.map((v) => {
                  const on = goalMarks[goal.id] === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      data-testid="tonight-goal-chip"
                      aria-pressed={on}
                      onClick={() => { setGoalMarks((m) => ({ ...m, [goal.id]: v })); props.onGoalScore!(goal.id, v); }}
                      className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full px-4 t-base font-bold"
                      style={{
                        color: "var(--arbor-clay-deep)",
                        background: "var(--arbor-clay-dim)",
                        border: `2px solid ${on ? "var(--arbor-clay-deep)" : "transparent"}`,
                      }}
                    >
                      {on && <Icon name="check" size={18} />}
                      <bdi dir="auto">{goal.scale[String(v) as GoalScaleKey]}</bdi>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="tonight-finish"
            onClick={() => setStep("done")}
            className={pillBase}
            style={{ color: "var(--arbor-ink)", background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }}
          >
            {t("elev.loop.tonight.finish")}
          </button>
        </div>
      </div>
    );
  } else {
    body = (
      <p role="status" data-testid="tonight-done" className="flex items-center gap-1.5 t-base" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-editorial)" }}>
        <Icon name="dark_mode" size={18} />
        {t("elev.loop.tonight.done")}
      </p>
    );
  }

  return (
    <section data-testid="tonight-flow" data-step={String(step)} aria-label={t("elev.loop.tonight.caption")} className="space-y-3">
      {/* R6: at 21:00 this is the screen's PRIMARY card — the morning card's
          depth (--arbor-shadow-primary, its hairline ring) on the token radius. */}
      <div data-testid="tonight-card" className="arbor-depth-primary p-4 sm:p-5" style={{ background: "var(--arbor-paper-elevated)", borderRadius: "var(--r-xl)" }}>
        {body}
      </div>
      {props.onStory && (
      <button
        type="button"
        data-testid="tonight-story"
        onClick={props.onStory}
        className="inline-flex min-h-11 items-center gap-2 px-1 t-base font-semibold"
        style={{ color: "var(--arbor-clay)" }}
      >
        <Icon name="auto_stories" size={20} />
        {t("elev.loop.tonight.story")}
      </button>
      )}
    </section>
  );
}
