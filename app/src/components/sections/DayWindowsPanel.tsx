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
import { buildDayWindowsSummary } from "../../growth/dayWindowsAgg";
import { cardCls } from "../ui/kit";

// Token shorthands — all via var(--arbor-*), NO raw hex.
const INK    = "var(--arbor-ink)";
const MUTED  = "var(--arbor-muted)";
const RULE   = "var(--arbor-rule)";
const GREEN  = "var(--arbor-green-ink)";
const GREEN_SOFT = "var(--arbor-green-soft)";
const PAPER_ELEVATED = "var(--arbor-paper-elevated)";
const PAPER_DEEP     = "var(--arbor-paper-deep)";

// Window tone tokens (CSS vars only).
const CALMER_BG  = "var(--arbor-green-soft)";
const CALMER_INK = "var(--arbor-green-ink)";
const TRICKIER_BG  = "var(--arbor-peach-soft)";
const TRICKIER_INK = "var(--arbor-peach-ink)";

export default function DayWindowsPanel() {
  const { behaviorLogs, childProfile, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();

  // ── Derive rhythm from existing engine (read-only, no new data path) ────
  const rhythm = useMemo(
    () =>
      predictRhythm(
        behaviorLogs.map((l) => ({ timestamp: l.timestamp, intensity: l.intensity })),
        Date.now(),
        { ageYears: childProfile.age }
      ),
    [behaviorLogs, childProfile.age]
  );

  const summary = useMemo(() => buildDayWindowsSummary(rhythm, Date.now()), [rhythm]);

  const firstName = (childProfile.name || "your child").split(" ")[0];

  // Build the 24-hour visualization bands (waking window 6–21).
  const vizBands = rhythm.bands.slice(0, 15); // hours 6–20 inclusive

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
        style={{ minHeight: 44, color: GREEN, background: GREEN_SOFT }}
        aria-label={t("dw.back")}
      >
        <Icon name="arrow_back" size={16} />
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
      <div
        className={cardCls + " overflow-hidden"}
        role="region"
        aria-label={t("dw.title")}
      >
        {summary.hasEnoughData ? (
          <>
            {/* 24-hour bar visualization */}
            <HourBar bands={vizBands} uiLang={uiLang} />

            {/* Named windows */}
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5 md:p-6"
              style={{ borderBottom: `1px solid ${RULE}` }}
            >
              {summary.windows.map((w) => {
                const isCalmer = w.label === "usually-calmer";
                const bg  = isCalmer ? CALMER_BG  : TRICKIER_BG;
                const ink = isCalmer ? CALMER_INK : TRICKIER_INK;
                const glyph = isCalmer ? "wb_sunny" : "bedtime";
                const label = isCalmer ? t("dw.label.calmer") : t("dw.label.trickier");
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
                    hardDays: summary.patternObservation.hardDays,
                    daysLogged: summary.patternObservation.daysLogged,
                    peakHour: summary.patternObservation.peakHourLabel,
                  })}
                </p>
              </div>
            )}

            {/* Days-logged badge */}
            <div className="px-5 md:px-6 py-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${RULE}` }}>
              <span
                className="text-[12px] font-bold rounded-full px-3 py-1"
                style={{ background: GREEN_SOFT, color: GREEN }}
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
            <HourBar bands={vizBands} uiLang={uiLang} />
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

// ── Inner: 24-hour bar ─────────────────────────────────────────────────────

interface HourBarProps {
  bands: Array<{ hour: number; tone: "calm" | "watch" | "friction"; score: number }>;
  /** TJB-14: tick labels are TIME, and time is written differently in Hebrew. */
  uiLang: UiLang;
}

function HourBar({ bands, uiLang }: HourBarProps) {
  if (!bands.length) return null;

  return (
    <div
      className="px-5 md:px-6 pt-5 pb-4"
      aria-hidden="true" // decorative — the named windows below are the accessible summary
    >
      <div className="flex items-end gap-[3px] h-10" role="presentation">
        {bands.map((b) => {
          const heightPct = Math.max(15, Math.round(b.score * 100));
          const bg =
            b.tone === "friction"
              ? TRICKIER_BG
              : b.tone === "watch"
              ? "var(--arbor-yellow-soft)"
              : CALMER_BG;
          const border =
            b.tone === "friction"
              ? `1px solid ${TRICKIER_INK}`
              : b.tone === "watch"
              ? "1px solid var(--arbor-yellow-ink)"
              : `1px solid ${CALMER_INK}`;

          return (
            <div
              key={b.hour}
              className="flex-1 rounded-sm transition-all"
              style={{
                height: `${heightPct}%`,
                minHeight: 6,
                background: bg,
                border,
                opacity: 0.85,
              }}
              title={formatHour(b.hour, uiLang)}
            />
          );
        })}
      </div>
      {/* Hour tick labels — sparse (every 3h) */}
      <div className="flex items-center gap-[3px] mt-1">
        {bands.map((b, i) => (
          <div key={b.hour} className="flex-1 text-center">
            {i % 3 === 0 ? (
              <span className="text-[10px]" style={{ color: MUTED }}>
                {formatHour(b.hour, uiLang)}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
