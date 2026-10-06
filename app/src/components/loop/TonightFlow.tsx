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
import { ShelfGlyph } from "./ShelfGlyph";
import NoticeCard from "./NoticeCard";
import { practiceText } from "./PracticeCard";

export type TonightStep = 1 | 2 | 3 | "done";

export interface TonightFlowProps {
  childName: string;
  gender?: string | null;
  /** Today's practice (null when none was offered — step 1 is skipped). */
  practice: PracticePick | null;
  /** Today's dose answer, if the parent already answered in the morning. */
  doseAnswer?: PracticeAnswer | null;
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
  /** Tests render each step statically. */
  initialStep?: TonightStep;
  /** Law 7: in the evening the first answer is Today's primary move. */
  stampMove?: string;
}

const pillBase = "inline-flex min-h-[44px] items-center justify-center rounded-full px-4 text-[14px] font-semibold";

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
  const [outcome, setOutcome] = useState<ActionOutcome | null>(null);
  const [line, setLine] = useState("");
  const [quote, setQuote] = useState("");
  const [kept, setKept] = useState(false);
  const name = props.childName || t("today.record.childFallback");

  const next = (from: TonightStep) => setStep(from === 1 ? 2 : from === 2 && props.notice ? 3 : "done");
  const progress = (n: 1 | 2 | 3) => (
    <p data-testid="tonight-progress" className="text-[12.5px] font-semibold" style={{ color: "var(--arbor-muted)" }}>
      {t("elev.loop.tonight.step", { n, total: TONIGHT_STEPS })}
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
    body = (
      <div data-testid="tonight-step-1">
        <div className="flex items-center justify-between gap-2">{progress(1)}</div>
        <div className="mt-2 flex items-center gap-2.5">
          <ShelfGlyph shelf={p.shelf} size={40} />
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold" style={{ color: "var(--arbor-muted)" }}>{t("elev.loop.tonight.practice.caption")}</p>
            <p className="text-[13px] font-semibold" style={{ color: "var(--arbor-ink)" }}>{shelfLabel(p.shelf, t)}</p>
          </div>
        </div>
        <h2 className="mt-3 font-semibold leading-tight" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)", fontSize: "var(--t-xl)" }}>
          {t("elev.loop.tonight.practice.q")}
        </h2>
        <blockquote className="mt-2 border-s-2 ps-3 leading-snug" style={{ borderColor: "var(--arbor-ink)", color: "var(--arbor-ink-soft)", fontFamily: "var(--font-editorial)", fontSize: "var(--t-lg)" }}>
          <FreeText text={`“${say}”`} />
        </blockquote>
        {!answer ? (
          <div
            role="group"
            aria-label={t("elev.loop.tonight.practice.q")}
            data-testid="tonight-practice-answers"
            {...(props.stampMove ? { "data-primary-move": props.stampMove } : {})}
            className="mt-4 flex gap-2.5"
          >
            <button
              type="button"
              data-answer="did"
              onClick={() => { setAnswer("did"); props.onPracticeAnswer("did"); }}
              className="inline-flex min-h-12 flex-[1.15] items-center justify-center gap-2 rounded-full px-5 text-[15px] font-bold"
              style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}
            >
              <Icon name="check" size={20} />
              {t("elev.loop.practice.didIt")}
            </button>
            <button
              type="button"
              data-answer="not_today"
              onClick={() => { setAnswer("not_today"); props.onPracticeAnswer("not_today"); }}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full px-5 text-[15px] font-semibold"
              style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
            >
              {t("elev.loop.practice.notToday")}
            </button>
          </div>
        ) : answer === "not_today" ? (
          <div className="mt-4 space-y-3">
            <p role="status" data-testid="tonight-not-today" className="text-[14px]" style={{ color: "var(--arbor-muted)" }}>{t("elev.loop.practice.notTodayReceipt")}</p>
            <div className="flex flex-wrap gap-2">{nextButton(1)}</div>
          </div>
        ) : (
          <div className="mt-4 space-y-3" data-testid="tonight-how">
            <p className="text-[14px] font-semibold" style={{ color: "var(--arbor-ink)" }}>{t("elev.loop.tonight.practice.how")}</p>
            <div role="group" aria-label={t("elev.loop.tonight.practice.how")} className="flex flex-wrap gap-2">
              {(["helped", "somewhat"] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  data-outcome={o}
                  aria-pressed={outcome === o}
                  onClick={() => { setOutcome(o); props.onOutcome(o); }}
                  className={pillBase}
                  style={{
                    color: outcome === o ? "var(--arbor-clay)" : "var(--arbor-ink)",
                    background: outcome === o ? "var(--arbor-clay-soft)" : "var(--arbor-paper-deep)",
                    border: `1px solid ${outcome === o ? "var(--arbor-clay)" : "var(--arbor-rule-strong)"}`,
                  }}
                >
                  {t(`elev.loop.tonight.practice.${o}`)}
                </button>
              ))}
            </div>
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const text = line.trim();
                if (!text) return;
                props.onWhatHappened(text);
                setLine("");
                next(1);
              }}
            >
              <input
                type="text"
                dir="auto"
                value={line}
                maxLength={280}
                onChange={(e) => setLine(e.target.value)}
                placeholder={t("elev.loop.tonight.practice.what")}
                aria-label={t("elev.loop.tonight.practice.what")}
                data-testid="tonight-what"
                className="min-h-[44px] min-w-0 flex-1 rounded-xl px-3 text-[14.5px]"
                style={{ background: "var(--arbor-paper)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
              />
              <button type="submit" disabled={!line.trim()} className={`${pillBase} disabled:opacity-60`} style={{ color: "var(--arbor-ink)", background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }}>
                {t("elev.loop.tonight.save")}
              </button>
            </form>
            <p className="text-[12.5px]" style={{ color: "var(--arbor-muted)" }}>{t("elev.loop.tonight.helper")}</p>
            <div className="flex flex-wrap gap-2">{nextButton(1)}</div>
          </div>
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
            <p role="status" data-testid="tonight-kept" className="flex items-center gap-1.5 text-[14px]" style={{ color: "var(--arbor-muted)" }}>
              <Icon name="check" size={18} />
              {g(t("elev.loop.tonight.day.receipt", { name }))}
            </p>
            <div className="flex flex-wrap gap-2">{nextButton(2)}</div>
          </div>
        ) : (
          <>
            <form
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
                className="min-h-[44px] min-w-0 flex-1 rounded-xl px-3 text-[14.5px]"
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
        />
        <div className="flex flex-wrap gap-2">
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
      <p role="status" data-testid="tonight-done" className="flex items-center gap-1.5 text-[15px]" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-editorial)" }}>
        <Icon name="dark_mode" size={18} />
        {t("elev.loop.tonight.done")}
      </p>
    );
  }

  return (
    <section data-testid="tonight-flow" data-step={String(step)} aria-label={t("elev.loop.tonight.caption")} className="space-y-3">
      <div className="rounded-[18px] p-4 sm:p-5" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}>
        {body}
      </div>
      {props.onStory && (
      <button
        type="button"
        data-testid="tonight-story"
        onClick={props.onStory}
        className="inline-flex min-h-11 items-center gap-2 px-1 text-[14px] font-semibold"
        style={{ color: "var(--arbor-clay)" }}
      >
        <Icon name="auto_stories" size={20} />
        {t("elev.loop.tonight.story")}
      </button>
      )}
    </section>
  );
}
