import React, { useMemo, useState } from "react";
import { useReducedMotion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import type { RhythmPrediction, RhythmTone } from "../../rhythm/predict";
import { hourLabel } from "../../rhythm/predict";

/* Today's Rhythm — a calm horizontal read of the day ahead, learned from the
   family's own log. Honest about uncertainty: shows a "still learning" state
   until there's enough coverage, never invented precision. */

const TONE: Record<RhythmTone, { bg: string; ink: string }> = {
  calm:     { bg: "var(--arbor-green-soft)", ink: "var(--arbor-green-ink)" },
  watch:    { bg: "var(--arbor-yellow-soft)", ink: "var(--arbor-yellow-ink)" },
  friction: { bg: "var(--arbor-peach-soft)", ink: "var(--arbor-peach-ink)" },
};

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const RULE = "var(--arbor-rule)";

/* Pure predicate for the moat-write confirm row, extracted so it is unit-testable
   in the node test harness (no DOM). The confirm row is the honest, opt-in
   memory write: only at high confidence, with a real friction peak, and only
   until the parent has acted on it for this peak. */
export function shouldShowRememberRow(args: {
  confidence: RhythmPrediction["confidence"];
  hasFrictionPeak: boolean;
  canRemember: boolean;
  alreadyRemembered: boolean;
  dismissed: boolean;
}): boolean {
  const learning = args.confidence === "none" || args.confidence === "low";
  return (
    !learning &&
    args.confidence === "high" &&
    args.hasFrictionPeak &&
    args.canRemember &&
    !args.alreadyRemembered &&
    !args.dismissed
  );
}

export default function RhythmStrip({
  prediction,
  childName,
  onPrepWindow,
  onSetWindDownReminder,
  onUseCalmWindow,
  onRememberPattern,
  alreadyRemembered = false,
}: {
  prediction: RhythmPrediction;
  childName: string;
  /** Open coaching prepped for a specific hard hour. */
  onPrepWindow?: (hour: number) => void;
  /** Set a one-tap wind-down reminder for the predicted wind-down hour. */
  onSetWindDownReminder?: (hour: number) => void;
  /** Use the predicted calm window for today's Daily Play. */
  onUseCalmWindow?: (startHour: number, endHour: number) => void;
  /** Propose the repeated friction peak as a (pending) parent-owned memory. */
  onRememberPattern?: (hour: number) => void | Promise<void>;
  /** Hide the confirm row once this peak has been proposed/dismissed for this child. */
  alreadyRemembered?: boolean;
}) {
  const reduce = useReducedMotion();
  const { t } = useLanguage();
  const { confidence, daysNeeded, bands, frictionPeak, calmWindow, windDownHour } = prediction;
  const learning = confidence === "none" || confidence === "low";
  const [remembering, setRemembering] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // The honest moat-write affordance: only at high confidence, with a real
  // friction peak, and only until the parent has acted on it for this peak.
  const showConfirm = shouldShowRememberRow({
    confidence,
    hasFrictionPeak: !!frictionPeak,
    canRemember: !!onRememberPattern,
    alreadyRemembered,
    dismissed,
  });

  const handleRemember = async () => {
    if (!frictionPeak || !onRememberPattern || remembering) return;
    setRemembering(true);
    try {
      await onRememberPattern(frictionPeak.hour);
    } finally {
      setRemembering(false);
    }
  };

  const ariaSummary = useMemo(() => {
    if (learning) return t("rhythm.ariaLearning", { name: childName });
    const parts: string[] = [];
    if (frictionPeak) parts.push(`hardest around ${hourLabel(frictionPeak.hour)}`);
    if (calmWindow) parts.push(`calmest ${hourLabel(calmWindow.startHour)} to ${hourLabel(calmWindow.endHour)}`);
    if (windDownHour != null) parts.push(`wind-down near ${hourLabel(windDownHour)}`);
    return `${childName}'s predicted rhythm today: ${parts.join(", ")}.`;
  }, [learning, childName, frictionPeak, calmWindow, windDownHour, t]);

  return (
    <section
      className="rounded-[22px] overflow-hidden"
      style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-sm)" }}
    >
      <div className="px-6 pt-5 pb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: "var(--arbor-green-ink)" }}>
            <Icon name="monitoring" size={14} /> {t("rhythm.eyebrow")}
          </span>
          <h2 className="text-lg font-extrabold leading-tight mt-0.5" style={{ fontFamily: "var(--font-display)", color: INK }}>
            {learning ? t("rhythm.learningTitle", { name: childName }) : t("rhythm.title", { name: childName })}
          </h2>
        </div>
        {!learning && (
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold flex-shrink-0"
            style={{ background: "var(--arbor-paper-deep)", color: MUTED, border: `1px solid ${RULE}` }}>
            {t("rhythm.fromWeeks")}
          </span>
        )}
      </div>

      {learning ? (
        <div className="px-6 pb-6">
          <div className="flex gap-1" aria-hidden="true">
            {bands.map((b) => (
              <span key={b.hour} className="h-2.5 flex-1 rounded-full" style={{ background: "var(--arbor-paper-sunk)" }} />
            ))}
          </div>
          <p className="text-sm mt-4 leading-relaxed" style={{ color: MUTED, textWrap: "pretty" } as React.CSSProperties}>
            {t("rhythm.learningBody", { name: childName })}
            {daysNeeded > 0 && <> <strong style={{ color: INK }}>{t("rhythm.daysToGo", { n: daysNeeded })}</strong></>}
          </p>
        </div>
      ) : (
        <div className="px-6 pb-6">
          {/* The day bar */}
          <div role="img" aria-label={ariaSummary} className="flex gap-1 items-end" style={{ height: 40 }}>
            {bands.map((b, i) => {
              const tone = TONE[b.tone];
              const h = 14 + Math.round(b.score * 24); // 14–38px by pressure
              return (
                <span
                  key={b.hour}
                  className="flex-1 rounded-md"
                  style={{
                    height: h,
                    background: tone.bg,
                    transition: reduce ? undefined : "height .5s cubic-bezier(.22,1,.36,1)",
                    transitionDelay: reduce ? undefined : `${i * 18}ms`,
                  }}
                />
              );
            })}
          </div>
          {/* Hour ticks */}
          <div className="flex justify-between mt-1.5 text-[10px] font-semibold" style={{ color: "var(--arbor-faint)" }}>
            <span>{hourLabel(bands[0].hour)}</span>
            <span>{t("rhythm.noon")}</span>
            <span>{hourLabel(bands[bands.length - 1].hour)}</span>
          </div>

          {/* Insight chips — every insight is now an actionable, focusable control */}
          <div className="flex flex-wrap gap-2 mt-4">
            {frictionPeak && (
              <button
                type="button"
                onClick={() => onPrepWindow?.(frictionPeak.hour)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 min-h-[44px] text-[12.5px] font-bold transition active:scale-[0.98]"
                style={{ background: TONE.friction.bg, color: TONE.friction.ink }}
              >
                <Icon name="auto_awesome" size={14} /> {t("rhythm.prep", { time: hourLabel(frictionPeak.hour) })}
              </button>
            )}
            {windDownHour != null && (
              <button
                type="button"
                onClick={() => onSetWindDownReminder?.(windDownHour)}
                aria-label={t("rhythm.windDownAction", { time: hourLabel(windDownHour) })}
                className="inline-flex items-center gap-1.5 rounded-full px-3 min-h-[44px] text-[12.5px] font-bold transition active:scale-[0.98]"
                style={{ background: "var(--arbor-paper-deep)", color: INK, border: `1px solid ${RULE}` }}>
                <Icon name="bedtime" size={14} style={{ color: "var(--arbor-lav-ink)" }} /> {t("rhythm.windDown", { time: hourLabel(windDownHour) })}
              </button>
            )}
            {calmWindow && (
              <button
                type="button"
                onClick={() => onUseCalmWindow?.(calmWindow.startHour, calmWindow.endHour)}
                aria-label={t("rhythm.useCalm", { from: hourLabel(calmWindow.startHour), to: hourLabel(calmWindow.endHour) })}
                className="inline-flex items-center gap-1.5 rounded-full px-3 min-h-[44px] text-[12.5px] font-bold transition active:scale-[0.98]"
                style={{ background: TONE.calm.bg, color: TONE.calm.ink }}>
                {t("rhythm.calmest", { from: hourLabel(calmWindow.startHour), to: hourLabel(calmWindow.endHour) })}
              </button>
            )}
          </div>

          {/* Confirm-the-pattern: the honest moat-write. Opt-in, never silent. */}
          {showConfirm && frictionPeak && (
            <div
              role="group"
              aria-label={t("rhythm.rememberAria", { name: childName, time: hourLabel(frictionPeak.hour) })}
              className="flex flex-wrap items-center gap-2 mt-4 pt-4"
              style={{
                borderTop: `1px solid ${RULE}`,
                transition: reduce ? undefined : "opacity .2s ease, transform .2s ease",
              }}
            >
              <p className="text-[13px] leading-snug flex-1 min-w-[180px]" style={{ color: MUTED }}>
                {t("rhythm.rememberPrompt", { name: childName, time: hourLabel(frictionPeak.hour) })}
              </p>
              <button
                type="button"
                onClick={handleRemember}
                disabled={remembering}
                aria-busy={remembering}
                className="inline-flex items-center justify-center rounded-full px-4 min-h-[44px] text-[12.5px] font-bold transition active:scale-[0.98] disabled:opacity-60"
                style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
              >
                {t("rhythm.rememberCta")}
              </button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="inline-flex items-center justify-center rounded-full px-4 min-h-[44px] text-[12.5px] font-bold transition active:scale-[0.98]"
                style={{ background: "var(--arbor-paper-deep)", color: MUTED, border: `1px solid ${RULE}` }}
              >
                {t("rhythm.rememberDismiss")}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
