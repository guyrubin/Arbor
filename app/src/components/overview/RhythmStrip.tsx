import React, { useMemo } from "react";
import { useReducedMotion } from "motion/react";
import { Activity, Moon, Sparkles } from "lucide-react";
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

export default function RhythmStrip({
  prediction,
  childName,
  onPrepWindow,
}: {
  prediction: RhythmPrediction;
  childName: string;
  /** Open coaching prepped for a specific hard hour. */
  onPrepWindow?: (hour: number) => void;
}) {
  const reduce = useReducedMotion();
  const { confidence, daysNeeded, bands, frictionPeak, calmWindow, windDownHour } = prediction;
  const learning = confidence === "none" || confidence === "low";

  const ariaSummary = useMemo(() => {
    if (learning) return `Arbor is still learning ${childName}'s daily rhythm.`;
    const parts: string[] = [];
    if (frictionPeak) parts.push(`hardest around ${hourLabel(frictionPeak.hour)}`);
    if (calmWindow) parts.push(`calmest ${hourLabel(calmWindow.startHour)} to ${hourLabel(calmWindow.endHour)}`);
    if (windDownHour != null) parts.push(`wind-down near ${hourLabel(windDownHour)}`);
    return `${childName}'s predicted rhythm today: ${parts.join(", ")}.`;
  }, [learning, childName, frictionPeak, calmWindow, windDownHour]);

  return (
    <section
      className="rounded-[22px] overflow-hidden"
      style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-sm)" }}
    >
      <div className="px-6 pt-5 pb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: "var(--arbor-green-ink)" }}>
            <Activity className="w-3.5 h-3.5" /> Today's rhythm
          </span>
          <h2 className="text-lg font-extrabold leading-tight mt-0.5" style={{ fontFamily: "var(--font-display)", color: INK }}>
            {learning ? `Learning ${childName}'s day` : `How ${childName}'s day tends to go`}
          </h2>
        </div>
        {!learning && (
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold flex-shrink-0"
            style={{ background: "var(--arbor-paper-deep)", color: MUTED, border: `1px solid ${RULE}` }}>
            from your last few weeks
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
            Log a few more moments and Arbor will start predicting {childName}'s harder and calmer windows.
            {daysNeeded > 0 && <> About <strong style={{ color: INK }}>{daysNeeded} more day{daysNeeded === 1 ? "" : "s"}</strong> of logging to go.</>}
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
            <span>noon</span>
            <span>{hourLabel(bands[bands.length - 1].hour)}</span>
          </div>

          {/* Insight chips */}
          <div className="flex flex-wrap gap-2 mt-4">
            {frictionPeak && (
              <button
                onClick={() => onPrepWindow?.(frictionPeak.hour)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold transition active:scale-[0.98]"
                style={{ background: TONE.friction.bg, color: TONE.friction.ink }}
              >
                <Sparkles className="w-3.5 h-3.5" /> Get a script ready for {hourLabel(frictionPeak.hour)}
              </button>
            )}
            {windDownHour != null && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold"
                style={{ background: "var(--arbor-paper-deep)", color: INK, border: `1px solid ${RULE}` }}>
                <Moon className="w-3.5 h-3.5" style={{ color: "var(--arbor-lav-ink)" }} /> Start wind-down ~{hourLabel(windDownHour)}
              </span>
            )}
            {calmWindow && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold"
                style={{ background: TONE.calm.bg, color: TONE.calm.ink }}>
                Calmest {hourLabel(calmWindow.startHour)}–{hourLabel(calmWindow.endHour)}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
