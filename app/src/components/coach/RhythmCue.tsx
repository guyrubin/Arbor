import React, { useEffect } from "react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import type { Nudge } from "../../lib/jitai";
import { nudgeDayKey } from "../../growth/jitaiPrefs";
import { trackNudgeActed, trackNudgeDismissed, trackNudgeShown, type NudgeSurface } from "../../lib/jitaiTelemetry";
import { PASTEL } from "../../lib/tokens";

/**
 * RhythmCue — ENG-10 + ENG-11.
 *
 * ENG-11: the JITAI cue existed only inside the notification bell, behind a
 * badge a parent has to go looking for. The engine is allowed TWO cues a day;
 * spending one on a surface nobody opens is spending it on nothing. This is
 * the same cue, from the same engine, rendered where the parent already is —
 * and instrumented (lib/jitaiTelemetry), so which cue earns its slot stops
 * being a guess. B-SHELL-02: the desktop bell is gone; this is THE in-app
 * render site of a nudge on every width.
 *
 * ENG-10: in the evening that cue IS the bedtime door. `lib/timeOfDay
 * bedtimeDoorOpen` (the first production consumer `dayPartFor` has ever had)
 * turns the BEDTIME kind on from 18:00 — or from the family's own wind-down
 * hour — and its action is the `bedtime-stories` route, which until now had no
 * entry point at the hour a parent wants it.
 *
 * CONTRACTS THIS MUST NOT BREAK
 *  - The engine is the ONE decision point: quiet hours, the parent's Smart
 *    Reminders toggles and the max-2/day ceiling are all enforced inside
 *    nextNudge() and the B-AI-06 coordinator (lib/companionOffer). This
 *    component adds no rules of its own; it renders what it is handed and
 *    stays silent on null.
 *  - B-AI-06: the coordinator SPENDS the ceiling (recordNudgeShown, idempotent
 *    per kind per day) where it decides an offer renders — one spender for
 *    every proactive kind, on Today and on Ask.
 *  - Clinical firewall: the card carries the CUE's copy only. No count about
 *    the child, no score, no ring, no colour that means good or bad — the
 *    tone is the cue's own pastel, chosen by kind, not by how the day went.
 */

/** day|surface|kind already counted — see the impression effect below. */
const SEEN_IMPRESSIONS = new Set<string>();

/**
 * B-AI-06: a RENDERER of the coordinator's decision. The single-offer
 * coordinator (components/overview/useCompanionOffer) runs `nextNudge` with
 * the prefs and the shown-ledger, arbitrates it against every other proactive
 * candidate, spends the day's ceiling and owns dismissal (Not today / Later /
 * Undo). This card only renders the nudge it is handed.
 */
export default function RhythmCue({
  surface = "coach",
  nudge,
  onDismiss,
}: {
  surface?: NudgeSurface;
  nudge: Nudge | null;
  onDismiss?: () => void;
}) {
  const { setActiveTab, requestCapture } = useArbor();
  const { t } = useLanguage();

  const visible = nudge;

  // ENG-11: an impression, not a decision — and exactly ONE per cue per
  // surface per day (module-level, day-keyed seen-set).
  useEffect(() => {
    if (!visible) return;
    const key = `${nudgeDayKey()}|${surface}|${visible.kind}`;
    if (SEEN_IMPRESSIONS.has(key)) return;
    SEEN_IMPRESSIONS.add(key);
    trackNudgeShown(visible, surface);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible?.kind, surface]);

  if (!visible) return null;

  const tone = PASTEL[visible.tone];

  return (
    <div
      data-testid="rhythm-cue"
      data-nudge-kind={visible.kind}
      className="flex items-start gap-3 rounded-xl px-3 py-3"
      style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
    >
      <span
        aria-hidden
        className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: "var(--arbor-paper)", color: tone.ink }}
      >
        <Icon name={visible.kind === "bedtime" ? "bedtime" : "auto_awesome"} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p dir="auto" className="text-[14px] font-extrabold leading-snug" style={{ color: "var(--arbor-ink)" }}>
          {t(visible.headlineKey, visible.vars)}
        </p>
        <p dir="auto" className="mt-0.5 text-[12.5px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
          {t(visible.bodyKey, visible.vars)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              trackNudgeActed(visible, surface);
              // ENG-01: the LOG cue asks the landing surface to open capture.
              if (visible.capture) requestCapture(visible.capture);
              setActiveTab(visible.action);
            }}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl text-[12.5px] font-extrabold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{ background: "var(--arbor-paper)", border: "1px solid var(--arbor-rule-strong)", color: tone.ink }}
          >
            {t(visible.ctaKey, visible.vars)}
          </button>
          <button
            type="button"
            aria-label={t("elev.evening.card.dismissAria")}
            onClick={() => {
              trackNudgeDismissed(visible, surface);
              onDismiss?.();
            }}
            className="inline-flex items-center min-h-[44px] px-3 rounded-xl text-[12px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{ color: "var(--arbor-muted)" }}
          >
            {t("elev.evening.card.dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}
