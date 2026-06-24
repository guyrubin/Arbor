import React, { useState } from "react";
import { Sprout, Clock, ChevronDown, Check, MessageSquare } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { localizeActivity } from "../../playbank/content";
import type { DailyPlan } from "../../practice/dailyPlan";
import type { SessionLength } from "../../playbank/select";
import SessionLengthChips from "../practice/SessionLengthChips";

/**
 * CI-30 — DailyPlanCard: hero card in the DailyPlayTab.
 *
 * Clinical-gate compliance (verdict: build-ready-narrowed):
 * - why-line is pre-screened by screenModelOutputLexical in dailyPlan.ts (assembleWhyLine).
 *   This component only renders plan.whyLine — it never re-constructs it.
 * - No progress score / % / ring / "on track" / "goal achieved" copy or code path.
 * - Observation: parent-attributed free-text, max 200 chars, written via onObservationSubmit.
 *   The caller (DailyPlayTab) routes this to useChildCollection("goalObservations") —
 *   arbor-safety COPPA review gates prod deploy (requiredFix #4).
 * - Weekend variant: isWeekend drives defaultSessionLength and why-line note; no separate screen.
 * - "developmentally informed, grounded in CDC/AAP/ASHA/WHO" is embedded in the pre-screened
 *   why-line (firewall §0). Never "clinically validated/clinician-reviewed/assesses/screens/evaluates".
 *
 * RTL: all layout uses logical CSS properties via Tailwind where possible; flex direction
 * inherits document dir (set by LanguageContext on <html>).
 *
 * Empty states:
 *   - plan === null && noGoal: renders the NO-GOAL state ("Set a focus goal to get today's plan.").
 *   - plan !== null && plan.sparse: activity IS shown, why-line reads "Sharpens as you log more days."
 *   - plan !== null: happy path.
 */

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const GREEN = "var(--arbor-green-ink)";
const GREEN_SOFT = "var(--arbor-green-soft)";
const RULE = "var(--arbor-rule)";

interface DailyPlanCardProps {
  plan: DailyPlan | null;
  /** True when there are no active goals set (CI-28). */
  noGoal: boolean;
  childName: string;
  done: boolean;
  onDid: (plan: DailyPlan) => void;
  onCoach: (plan: DailyPlan) => void;
  /** Called after parent submits the post-activity observation text. */
  onObservationSubmit: (text: string) => Promise<void>;
  /** CI-31: session length controlled from DailyPlayTab. */
  sessionLength: SessionLength;
  onSessionLengthChange: (s: SessionLength) => void;
  /** Called when parent taps "Set a focus goal" in the no-goal state. */
  onSetGoal: () => void;
}

type CardState = "plan" | "observing" | "done";

export default function DailyPlanCard({
  plan,
  noGoal,
  childName,
  done: externalDone,
  onDid,
  onCoach,
  onObservationSubmit,
  sessionLength,
  onSessionLengthChange,
  onSetGoal,
}: DailyPlanCardProps) {
  const { t, uiLang } = useLanguage();
  const [stepsOpen, setStepsOpen] = useState(false);
  const [cardState, setCardState] = useState<CardState>(externalDone ? "done" : "plan");
  const [observationText, setObservationText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sessionTapped, setSessionTapped] = useState(false);

  const handleSessionLength = (v: SessionLength) => {
    setSessionTapped(true);
    onSessionLengthChange(v);
  };

  // ── NO-GOAL empty state ──────────────────────────────────────────────────────
  if (noGoal || !plan) {
    return (
      <section
        aria-label={t("plan.card.eyebrow")}
        className="rounded-[var(--r-xl)] overflow-hidden"
        style={{
          background: "var(--arbor-paper-elevated)",
          border: `1px solid ${RULE}`,
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="p-6 flex flex-col items-start gap-3">
          <span
            className="inline-flex items-center gap-1.5 text-[13px] font-bold"
            style={{ color: GREEN }}
          >
            <Sprout className="w-3.5 h-3.5" />
            {t("plan.card.eyebrow")}
          </span>
          <p className="text-[14px] leading-relaxed" style={{ color: MUTED }}>
            {t("plan.card.noGoalBody")}
          </p>
          <button
            onClick={onSetGoal}
            className="inline-flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-[13px] font-bold transition"
            style={{
              background: GREEN_SOFT,
              color: GREEN,
            }}
          >
            {t("plan.card.setGoalCta")}
          </button>
        </div>
      </section>
    );
  }

  const activity = localizeActivity(plan.scoredActivity.activity, uiLang);

  // Duration badge label — mirrors DailyPlayCard pattern.
  const durationLabel: string = (() => {
    if (sessionLength === "short") return t("play.session.short");
    if (sessionLength === "extended") return t("play.session.extended");
    return t("play.session.standard");
  })();

  // ── OBSERVING state (post-activity observation inline view) ─────────────────
  if (cardState === "observing") {
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!observationText.trim()) return;
      setSubmitting(true);
      try {
        await onObservationSubmit(observationText.trim());
        setCardState("done");
        setObservationText("");
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <section
        aria-label={t("plan.card.eyebrow")}
        className="rounded-[var(--r-xl)] overflow-hidden"
        style={{
          background: "var(--arbor-paper-elevated)",
          border: `1px solid ${RULE}`,
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="p-6 space-y-4">
          <span
            className="inline-flex items-center gap-1.5 text-[13px] font-bold"
            style={{ color: GREEN }}
          >
            <Sprout className="w-3.5 h-3.5" />
            {t("plan.card.eyebrow")}
          </span>
          <h2
            className="text-[1.1rem] font-extrabold leading-tight"
            style={{ fontFamily: "var(--font-display)", color: INK }}
          >
            {t("plan.card.observePrompt")}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
              value={observationText}
              onChange={(e) => setObservationText(e.target.value.slice(0, 200))}
              placeholder={t("plan.card.observePlaceholder")}
              rows={3}
              maxLength={200}
              className="w-full rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none"
              style={{
                background: "var(--arbor-paper-deep)",
                border: `1px solid var(--arbor-rule-strong)`,
                color: INK,
              }}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px]" style={{ color: MUTED }}>
                {observationText.length}/200
              </span>
              <button
                type="submit"
                disabled={!observationText.trim() || submitting}
                className="inline-flex items-center gap-2 font-bold text-sm rounded-2xl px-5 min-h-[44px] transition disabled:opacity-50"
                style={{
                  background: "var(--arbor-gradient-primary)",
                  color: "#fff",
                  boxShadow: "var(--shadow-green)",
                }}
              >
                {submitting ? t("plan.card.submitting") : t("plan.card.submitObservation")}
              </button>
            </div>
          </form>
        </div>
      </section>
    );
  }

  // ── DONE state ───────────────────────────────────────────────────────────────
  if (cardState === "done") {
    return (
      <section
        aria-label={t("plan.card.eyebrow")}
        className="rounded-[var(--r-xl)] overflow-hidden"
        style={{
          background: "var(--arbor-paper-elevated)",
          border: `1px solid ${RULE}`,
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="p-6 space-y-3">
          <span
            className="inline-flex items-center gap-1.5 text-[13px] font-bold"
            style={{ color: GREEN }}
          >
            <Sprout className="w-3.5 h-3.5" />
            {t("plan.card.eyebrow")}
          </span>
          <h2
            className="text-[1.35rem] font-extrabold leading-tight"
            style={{ fontFamily: "var(--font-display)", color: INK }}
          >
            {activity.title}
          </h2>
          <button
            disabled
            className="inline-flex items-center gap-2 font-bold text-sm rounded-2xl px-5 py-3"
            style={{ background: GREEN_SOFT, color: GREEN }}
          >
            <Check className="w-4 h-4" />
            {t("play.did")}
          </button>
          <span
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-full px-2.5 py-1"
            style={{ background: GREEN_SOFT, color: GREEN }}
          >
            <Check className="w-3 h-3" />
            {t("plan.card.observationLogged")}
          </span>
          <p className="text-[12px] mt-1" style={{ color: "var(--arbor-faint)" }}>
            {plan.whyLine}
          </p>
        </div>
      </section>
    );
  }

  // ── HAPPY PATH (plan state) ──────────────────────────────────────────────────
  return (
    <section
      aria-label={t("plan.card.eyebrow")}
      aria-live="polite"
      className="rounded-[var(--r-xl)] overflow-hidden"
      style={{
        background: "var(--arbor-paper-elevated)",
        border: `1px solid ${RULE}`,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="p-6">
        {/* Row 1: eyebrow + duration badge */}
        <div className="flex items-start justify-between gap-3">
          <span
            className="inline-flex items-center gap-1.5 text-[13px] font-bold"
            style={{ color: GREEN }}
          >
            <Sprout className="w-3.5 h-3.5" />
            {t("plan.card.eyebrow")}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold flex-shrink-0"
            style={{
              background: "var(--arbor-paper-deep)",
              color: MUTED,
              border: `1px solid ${RULE}`,
            }}
          >
            <Clock className="w-3 h-3" />
            {durationLabel}
          </span>
        </div>

        {/* Row 2: activity title */}
        <h2
          className="text-[1.35rem] font-extrabold leading-tight mt-2"
          style={{
            fontFamily: "var(--font-display)",
            color: INK,
            textWrap: "balance",
          } as React.CSSProperties}
        >
          {activity.title}
        </h2>

        {/* Row 3: why-line (pre-screened provenance, never causal claim on child) */}
        <p
          className="text-[13px] leading-relaxed mt-1.5 line-clamp-2"
          style={{ color: MUTED }}
        >
          {plan.goal && !plan.sparse ? (
            <>
              {t("plan.card.whyPrefix")}{" "}
              <strong style={{ color: GREEN }}>{plan.goal.label}</strong>
              {plan.matchedInterest
                ? ` — ${t("plan.card.andInterest", { name: childName, interest: plan.matchedInterest })}`
                : ""}
              .{" "}
              <span style={{ color: "var(--arbor-faint)", fontSize: "11px" }}>
                {t("plan.card.firewall")}
              </span>
            </>
          ) : (
            <span>
              {plan.whyLine}
            </span>
          )}
        </p>

        {/* Row 4: household items pills */}
        {activity.householdItems.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {activity.householdItems.map((it) => (
              <span
                key={it}
                className="rounded-full px-2.5 py-1 text-[12px] font-semibold"
                style={{ background: GREEN_SOFT, color: GREEN }}
              >
                {it}
              </span>
            ))}
          </div>
        )}

        {/* CI-31: Session-length chip row */}
        <SessionLengthChips
          value={sessionLength}
          onChange={handleSessionLength}
          tapped={sessionTapped}
        />

        {/* Steps accordion — same pattern as DailyPlayCard */}
        <button
          onClick={() => setStepsOpen((o) => !o)}
          aria-expanded={stepsOpen}
          className="inline-flex items-center gap-1 text-[13px] font-bold mt-4 transition"
          style={{ color: GREEN }}
        >
          {stepsOpen ? t("play.hide") : t("play.how")}
          <ChevronDown
            className="w-4 h-4 transition"
            style={{ transform: stepsOpen ? "rotate(180deg)" : "none" }}
          />
        </button>

        {stepsOpen && (
          <ol className="mt-3 space-y-2.5">
            {activity.steps.map((s, i) => (
              <li
                key={i}
                className="flex gap-3 text-[14px] leading-relaxed"
                style={{ color: INK }}
              >
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-extrabold"
                  style={{ background: GREEN_SOFT, color: GREEN }}
                >
                  {i + 1}
                </span>
                <span style={{ textWrap: "pretty" } as React.CSSProperties}>
                  {s}
                </span>
              </li>
            ))}
          </ol>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2.5 mt-5">
          {/* Primary CTA: "We did this" */}
          <button
            onClick={() => {
              onDid(plan);
              setCardState("observing");
            }}
            className="inline-flex items-center justify-center gap-2 font-bold text-sm rounded-2xl px-5 py-3 transition active:scale-[0.98]"
            style={{
              background: "var(--arbor-gradient-primary)",
              color: "#fff",
              boxShadow: "var(--shadow-green)",
            }}
          >
            <Check className="w-4 h-4" />
            {t("play.did")}
          </button>

          {/* Secondary: Ask Arbor coach shortcut */}
          <button
            onClick={() => onCoach(plan)}
            className="inline-flex items-center justify-center gap-2 font-bold text-sm rounded-2xl px-5 py-3 transition"
            style={{ background: GREEN_SOFT, color: GREEN }}
          >
            <MessageSquare className="w-4 h-4" />
            {t("play.coach")}
          </button>
        </div>
      </div>
    </section>
  );
}
