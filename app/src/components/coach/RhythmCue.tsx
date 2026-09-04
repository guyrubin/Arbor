import React, { useEffect, useMemo, useState } from "react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { predictRhythm } from "../../rhythm/predict";
import { nextNudge, type Nudge } from "../../lib/jitai";
import { loadPrefs, shownNudgesToday, nudgeDayKey } from "../../growth/jitaiPrefs";
import { trackNudgeActed, trackNudgeDismissed, trackNudgeShown, type NudgeSurface } from "../../lib/jitaiTelemetry";
import { PASTEL } from "../../lib/tokens";

/**
 * RhythmCue — ENG-10 + ENG-11.
 *
 * ENG-11: the JITAI cue existed only inside the notification bell, behind a
 * badge a parent has to go looking for. The engine is allowed TWO cues a day;
 * spending one on a surface nobody opens is spending it on nothing. This is
 * the same cue, from the same engine, rendered where the parent already is —
 * and, unlike the bell, instrumented (lib/jitaiTelemetry), so which cue earns
 * its slot stops being a guess.
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
 *    nextNudge(). This component adds no rules of its own; it only renders
 *    what the engine already decided to allow, and stays silent on null.
 *  - It does NOT call recordNudgeShown(). That counter is the ceiling's
 *    ledger and the bell owns it; incrementing from a second surface would
 *    burn the day's budget twice for one cue.
 *  - Clinical firewall: the card carries the CUE's copy only. No count about
 *    the child, no score, no ring, no colour that means good or bad — the
 *    tone is the cue's own pastel, chosen by kind, not by how the day went.
 */

const DISMISS_KEY_PREFIX = "arbor.rhythmcue.dismissed.";

function dismissedToday(nowMs = Date.now()): string[] {
  try {
    const raw = localStorage.getItem(DISMISS_KEY_PREFIX + nudgeDayKey(nowMs));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

function recordDismissed(kind: string, nowMs = Date.now()): string[] {
  const next = [...new Set([...dismissedToday(nowMs), kind])];
  try {
    localStorage.setItem(DISMISS_KEY_PREFIX + nudgeDayKey(nowMs), JSON.stringify(next));
  } catch {
    /* storage blocked — the cue simply reappears next mount */
  }
  return next;
}

/** day|surface|kind already counted — see the impression effect below. */
const SEEN_IMPRESSIONS = new Set<string>();

export default function RhythmCue({ surface = "coach" }: { surface?: NudgeSurface }) {
  const { childProfile, behaviorLogs, setActiveTab, requestCapture } = useArbor();
  const { t } = useLanguage();

  const [dismissed, setDismissed] = useState<string[]>(() => dismissedToday());

  const firstName = (childProfile.name || "").split(" ")[0];

  const rhythm = useMemo(
    () =>
      predictRhythm(
        behaviorLogs.map((l) => ({ timestamp: l.timestamp, intensity: l.intensity })),
        Date.now(),
        { ageYears: childProfile.age },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [behaviorLogs.length, childProfile.age],
  );

  const loggedToday = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return behaviorLogs.filter((l) => new Date(l.timestamp).getTime() >= start.getTime()).length;
  }, [behaviorLogs]);

  const recent7d = useMemo(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    return behaviorLogs.filter((l) => new Date(l.timestamp).getTime() >= cutoff).length;
  }, [behaviorLogs]);

  const nudge: Nudge | null = useMemo(
    () =>
      nextNudge(
        {
          nowMs: Date.now(),
          rhythm,
          loggedToday,
          recent7d,
          childName: firstName,
          shownToday: shownNudgesToday(),
        },
        loadPrefs(),
      ),
    [rhythm, loggedToday, recent7d, firstName],
  );

  const visible = nudge && !dismissed.includes(nudge.kind) ? nudge : null;

  // ENG-11: an impression, not a decision — and exactly ONE per cue per
  // surface per day. This component is mounted on Today AND on Ask, so a
  // per-mount effect logged the same cue twice on a tab switch, skewing the
  // very metric ENG-11 exists to produce. The seen-set is module-level and
  // day-keyed, so a remount within the day is silent and a new day starts over.
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
      className="rounded-2xl p-4 flex items-start gap-3"
      style={{ background: tone.soft, border: "1px solid var(--arbor-rule)" }}
    >
      <span
        aria-hidden
        className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: "var(--arbor-paper)", color: tone.ink }}
      >
        <Icon name={visible.kind === "bedtime" ? "bedtime" : "auto_awesome"} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: tone.ink }}>
          {t("elev.evening.card.eyebrow")}
        </p>
        <p dir="auto" className="mt-1 text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>
          {t(visible.headlineKey, visible.vars)}
        </p>
        <p dir="auto" className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
          {t(visible.bodyKey, visible.vars)}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
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
              setDismissed(recordDismissed(visible.kind));
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
