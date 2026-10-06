/**
 * DayWindowsPanel — AP-051
 *
 * A "Day at a Glance" visualization of calm/trickier windows derived from the
 * existing JITAI rhythm engine (lib/jitai.ts) and predictRhythm.
 *
 * BINDING RULES (board-cleared copy — do NOT modify strings):
 *   - Title: "Your Day at a Glance"
 *   - Labels: "Usually calmer" / "Often trickier"
 *   - Guard (ALWAYS visible): "These are tendencies, not predictions — every day is different…"
 *   - Low-data: "Keep logging and these patterns get clearer…"
 *   - Pattern anchored to "the days you logged"
 *   - NO "predict/prediction/will be/dysregulated/behavioral episode"
 *
 * B-TODAY-06: no colour grades the child's day. The bars are single-ink with
 * opacity ∝ the hour's count of hard (4–5) logs and an aria count per hour;
 * there is no "Usually calmer" window (absence is not calm); the day count is
 * read from the logs (growth/dayWindowsAgg), and every hour is formatted in
 * the UI language. Below the evidence floor the strip stays uniform.
 *
 * READ-ONLY: consumes existing RhythmPrediction and BehaviorLog data.
 * Does NOT write any child data. Does NOT generate new signals.
 * Does NOT replace the existing Today/Overview inline nudge (AP-006 / jitai.ts) —
 * this is an ADDITIONAL detail view reachable from Today.
 */
import React, { useMemo } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import type { UiLang } from "../../lib/i18n";
import { predictRhythm } from "../../rhythm/predict";
import { formatHour } from "../../lib/pulse";
import { buildDayWindowsSummary, type HourCount } from "../../growth/dayWindowsAgg";
import { cardCls } from "../ui/kit";
import { ageYearsOf } from "../../lib/age/forChild";

// Token shorthands — all via var(--arbor-*), NO raw hex.
// B-TODAY-06: ink, muted and paper only — no green/peach grading.
const INK    = "var(--arbor-ink)";
const MUTED  = "var(--arbor-muted)";
const RULE   = "var(--arbor-rule)";
const PAPER_ELEVATED = "var(--arbor-paper-elevated)";
const PAPER_DEEP     = "var(--arbor-paper-deep)";

export default function DayWindowsPanel() {
  const { behaviorLogs, childProfile, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();

  // ── Derive rhythm from existing engine (read-only, no new data path) ────
  const rhythm = useMemo(
    () =>
      predictRhythm(
        behaviorLogs.map((l) => ({ timestamp: l.timestamp, intensity: l.intensity })),
        Date.now(),
        { ageYears: ageYearsOf(childProfile) }
      ),
    [behaviorLogs, ageYearsOf(childProfile)]
  );

  const summary = useMemo(
    () => buildDayWindowsSummary(rhythm, Date.now(), behaviorLogs.map((l) => ({ timestamp: l.timestamp, intensity: l.intensity }))),
    [rhythm, behaviorLogs],
  );

  const firstName = (childProfile.name || "your child").split(" ")[0];


  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5 max-w-[760px]"
    >
      {/* Back navigation */}
      <button
        onClick={() => setActiveTab("overview")}
        className="inline-flex items-center gap-2 font-bold text-sm rounded-full px-4"
        style={{ minHeight: 44, color: INK, background: PAPER_DEEP }}
        aria-label={t("dw.back")}
      >
        {/* OBJ-TODAY-08: `msr` alone left the glyph unmirrored — computed
            transform was `none` in dir=rtl, so back pointed forward in
            Hebrew. Same recipe as the WeeklyTab back icon. */}
        <Icon name="arrow_back" size={16} className="rtl:-scale-x-100" />
        {t("dw.back")}
      </button>

      {/* Header */}
      <div>
        <h1
          className="text-2xl md:text-[2rem] font-extrabold leading-[1.1]"
          style={{ fontFamily: "var(--font-display)", color: INK }}
        >
          {t("dw.title")}
        </h1>
        <p className="text-sm mt-2 max-w-xl leading-relaxed" style={{ color: MUTED }}>
          {t("dw.subtitle")}
        </p>
      </div>

      {/* ── Main card ──────────────────────────────────────────────────── */}
      {/* Item 11 (IA-02): the surface contract reaches the DOM. `data-module`
          marks a top-level sibling module (what moduleBudget counts);
          `data-primary-move` marks the ONE control that performs the move
          surfaceContract.ts declares for this route. */}
      <div
        data-module="day-windows-chart"
        data-primary-move="view-day-windows"
        className={cardCls + " overflow-hidden"}
        role="region"
        aria-label={t("dw.title")}
      >
        {summary.hasEnoughData ? (
          <>
            {/* Hard moments per hour — single ink, opacity ∝ count */}
            <HourBar counts={summary.hourCounts} uiLang={uiLang} />

            {/* Named windows */}
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5 md:p-6"
              style={{ borderBottom: `1px solid ${RULE}` }}
            >
              {summary.windows.map((w) => {
                const bg = PAPER_DEEP;
                const ink = INK;
                const glyph = "schedule";
                const label = t("dw.label.trickier");
                const ariaLabel = t("dw.window.aria", {
                  label,
                  startHour: formatHour(w.startHour, uiLang),
                  endHour: formatHour(w.endHour, uiLang),
                });

                return (
                  <div
                    key={w.label}
                    className="rounded-2xl p-4 flex items-center gap-3"
                    style={{ background: bg }}
                    role="listitem"
                    aria-label={ariaLabel}
                  >
                    <span
                      className="rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 44,
                        height: 44,
                        background: PAPER_ELEVATED,
                        color: ink,
                      }}
                      aria-hidden="true"
                    >
                      <Icon name={glyph} size={20} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold" style={{ color: ink }}>
                        {label}
                      </p>
                      <p
                        className="text-[17px] font-extrabold leading-tight"
                        style={{ fontFamily: "var(--font-display)", color: INK }}
                      >
                        {formatHour(w.startHour, uiLang)}–{formatHour(w.endHour, uiLang)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pattern observation */}
            {summary.patternObservation && (
              <div className="px-5 md:px-6 py-4" style={{ borderBottom: `1px solid ${RULE}` }}>
                <p
                  className="text-[14px] leading-relaxed"
                  style={{ color: INK }}
                  data-testid="dw-pattern-observation"
                >
                  {t("dw.pattern", {
                    n: summary.patternObservation.hardDays,
                    m: summary.patternObservation.daysLogged,
                    hour: formatHour(summary.patternObservation.peakHour, uiLang),
                  })}
                </p>
              </div>
            )}

            {/* Days-logged badge */}
            <div className="px-5 md:px-6 py-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${RULE}` }}>
              <span
                className="text-[12px] font-bold rounded-full px-3 py-1"
                style={{ background: PAPER_DEEP, color: MUTED }}
              >
                {t("dw.daysLogged", { n: summary.daysLogged })}
              </span>
            </div>
          </>
        ) : (
          /* Low-data state */
          <>
            {/* TJB-14: the learning strip. `predictRhythm` FLATTENS every band
                to tone "calm" / score 0 below the usable bar (predict.ts:127),
                so this renders a uniform strip with the hour ticks — the shape
                of the surface filling in, never a pattern claim. Mounting it
                here is what makes the route legible at 3 of 7 days; the
                determinism guard below it is unchanged and always visible. */}
            <HourBar counts={summary.hourCounts} uiLang={uiLang} />
            <div className="px-5 md:px-6 pb-6 flex items-start gap-4">
              <span
                className="rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  width: 44,
                  height: 44,
                  background: "var(--arbor-yellow-soft)",
                  color: "var(--arbor-yellow-ink)",
                }}
                aria-hidden="true"
              >
                {/* TJB-14: `error` announced a fault. Nothing is wrong — the
                    week is simply still in progress. */}
                <Icon name="hourglass_top" size={20} />
              </span>
              <div>
                <p
                  className="text-[15px] font-bold leading-snug"
                  style={{ color: INK }}
                  data-testid="dw-low-data"
                >
                  {t("dw.lowData")}
                </p>
                {summary.daysNeeded > 0 && (
                  <p className="text-[13px] mt-1" style={{ color: MUTED }} data-testid="dw-days-progress">
                    {t("elev.dw.daysLoggedOf", {
                      n: summary.daysLogged,
                      total: summary.daysLogged + summary.daysNeeded,
                    })}
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Determinism guard (ALWAYS visible) ─────────────────────── */}
        <div
          className="px-5 md:px-6 py-4 flex items-start gap-2.5"
          style={{ background: PAPER_DEEP }}
          role="note"
        >
          <span
            className="text-[11px] font-bold uppercase tracking-wide flex-shrink-0 mt-0.5"
            style={{ color: MUTED }}
            aria-hidden="true"
          >
            ~
          </span>
          <p
            className="text-[13px] leading-relaxed"
            style={{ color: MUTED }}
            data-testid="dw-determinism-guard"
          >
            {t("dw.guard")}
          </p>
        </div>
      </div>

      {/* Context line about firstName (non-diagnostic, plain language) */}
      <p className="text-[13px] text-center" style={{ color: MUTED }} data-testid="dw-context-line">
        {t("elev.dw.context", { name: firstName })}
      </p>
    </motion.div>
  );
}

// ── Inner: hard moments per hour ─────────────────────────────────────────

interface HourBarProps {
  /** Hard (4–5) logs per waking hour; all zero below the evidence floor. */
  counts: HourCount[];
  /** TJB-14: tick labels are TIME, and time is written differently in Hebrew. */
  uiLang: UiLang;
}

/**
 * B-TODAY-06: one ink, uniform height, opacity proportional to the hour's
 * count — a count, never a tone. Each bar carries its count for screen
 * readers ("5pm: 3 hard moments").
 */
function HourBar({ counts, uiLang }: HourBarProps) {
  const { t } = useLanguage();
  if (!counts.length) return null;
  const max = Math.max(0, ...counts.map((c) => c.count));

  return (
    <div className="px-5 md:px-6 pt-5 pb-4">
      <div className="flex items-end gap-[3px] h-10" role="list" aria-label={t("dw.bars.aria")}>
        {counts.map((c) => (
          <div
            key={c.hour}
            role="listitem"
            aria-label={t(c.count === 1 ? "dw.hour.aria.one" : "dw.hour.aria", { hour: formatHour(c.hour, uiLang), n: c.count })}
            data-testid="dw-hour-bar"
            className="flex-1 h-full rounded-sm"
            style={{
              background: INK,
              opacity: max > 0 ? 0.08 + 0.92 * (c.count / max) : 0.08,
            }}
            title={formatHour(c.hour, uiLang)}
          />
        ))}
      </div>
      {/* Hour tick labels — sparse (every 3h) */}
      <div className="flex items-center gap-[3px] mt-1" aria-hidden="true">
        {counts.map((c, i) => (
          <div key={c.hour} className="flex-1 text-center">
            {i % 3 === 0 ? (
              <span className="text-[10px]" style={{ color: MUTED }}>
                {formatHour(c.hour, uiLang)}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
