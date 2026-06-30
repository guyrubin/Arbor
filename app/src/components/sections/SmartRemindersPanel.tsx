/**
 * SmartRemindersPanel — AP-058
 *
 * A "Smart Reminders" parent-settings dashboard over the existing JITAI nudge
 * engine (lib/jitai.ts). This is a PARENT PREFERENCE surface ONLY.
 *
 * BINDING CLINICAL FRAMING (board-cleared, AP-058):
 *   - Quiet-hours: parent's chosen window, not a child-watching mechanism.
 *   - Calm-window: routes nudges to calmer stretches — NOT described as the app
 *     observing or tracking the child.
 *   - Max-2/day contract: always visible to the parent.
 *   - No copy implying more nudges = better development.
 *   - No monitoring/child-watching/child-tracking copy. No clinical/diagnostic terms.
 *
 * DATA SAFETY:
 *   - Reads/writes ONLY to localStorage via jitaiPrefs.ts.
 *   - No child-data write, no Firestore mutation, no new consent surface.
 *   - Reads next-nudge from the existing JITAI engine via nextNudge() +
 *     useNotifications (same path as the Topbar bell), no new signal path.
 *
 * ENTRY POINTS: Settings modal → "Smart Reminders" row (always visible).
 * Also reachable from Ask Arbor section via setActiveTab("smart-reminders").
 */
import React, { useState, useMemo, useCallback } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { nextNudge } from "../../lib/jitai";
import { predictRhythm } from "../../rhythm/predict";
import { ageMonthsFromProfile } from "../../lib/childAge";
import {
  loadPrefs,
  savePrefs,
  formatHour,
  type JitaiPrefs,
  type NudgeTypeKey,
} from "../../growth/jitaiPrefs";

// ── Token shorthands (all via var(--arbor-*), zero raw hex) ──────────────────
const INK         = "var(--arbor-ink)";
const MUTED       = "var(--arbor-muted)";
const FAINT       = "var(--arbor-faint)";
const RULE        = "var(--arbor-rule)";
const RULE_STRONG = "var(--arbor-rule-strong)";
const PAPER       = "var(--arbor-paper-elevated)";
const PAPER_DEEP  = "var(--arbor-paper-deep)";
const GREEN       = "var(--arbor-green-ink)";
const GREEN_SOFT  = "var(--arbor-green-soft)";
const CLAY        = "var(--arbor-clay)";
const ON_ACCENT   = "var(--arbor-on-accent)";
const PEACH_SOFT  = "var(--arbor-peach-soft)";
const PEACH_INK   = "var(--arbor-peach-ink)";
const LAV_SOFT    = "var(--arbor-lav-soft)";

// ── Hours available in the quiet-hours picker ────────────────────────────────
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);

// ── Nudge kind → i18n key map ─────────────────────────────────────────────────
const KIND_KEY: Record<string, string> = {
  prep:     "sr.nextNudge.kind.prep",
  calm:     "sr.nextNudge.kind.calm",
  log:      "sr.nextNudge.kind.log",
  practice: "sr.nextNudge.kind.practice",
};

// ── Type definitions ──────────────────────────────────────────────────────────
const NUDGE_TYPES: Array<{
  key: NudgeTypeKey;
  labelKey: string;
  descKey: string;
  tone: string;
  toneSoft: string;
}> = [
  { key: "guidance",  labelKey: "sr.types.guidance.label",  descKey: "sr.types.guidance.desc",  tone: CLAY,      toneSoft: GREEN_SOFT },
  { key: "milestone", labelKey: "sr.types.milestone.label", descKey: "sr.types.milestone.desc", tone: GREEN,     toneSoft: GREEN_SOFT },
  { key: "weekly",    labelKey: "sr.types.weekly.label",    descKey: "sr.types.weekly.desc",    tone: PEACH_INK, toneSoft: PEACH_SOFT },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function SmartRemindersPanel() {
  const { setActiveTab, childProfile, behaviorLogs } = useArbor();
  const { t } = useLanguage();

  // Load prefs from localStorage on first render — no Firestore, no child data.
  const [prefs, setPrefs] = useState<JitaiPrefs>(loadPrefs);
  const [savedFlash, setSavedFlash] = useState(false);

  // Derive the next nudge from the existing JITAI engine (read-only, same path
  // as TopbarBell / useNotifications — no new signal path).
  const firstName = (childProfile.name || "your child").split(" ")[0];

  const ageMonthsPrecise = ageMonthsFromProfile(childProfile);
  const ageYears = ageMonthsPrecise !== null
    ? ageMonthsPrecise / 12
    : (childProfile.age ?? 0);

  const rhythm = useMemo(
    () =>
      predictRhythm(
        behaviorLogs.map((l) => ({ timestamp: l.timestamp, intensity: l.intensity })),
        Date.now(),
        { ageYears }
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [behaviorLogs.length, ageYears],
  );

  const loggedTodayCount = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return behaviorLogs.filter(
      (l) => new Date(l.timestamp).getTime() >= start.getTime()
    ).length;
  }, [behaviorLogs]);

  const recent7d = useMemo(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    return behaviorLogs.filter((l) => new Date(l.timestamp).getTime() >= cutoff).length;
  }, [behaviorLogs]);

  const nudge = useMemo(
    () =>
      nextNudge({
        nowMs: Date.now(),
        rhythm,
        loggedToday: loggedTodayCount,
        recent7d,
        childName: firstName,
      }),
    [rhythm, loggedTodayCount, recent7d, firstName],
  );

  // ── Persist helper ──────────────────────────────────────────────────────────
  const persist = useCallback((next: JitaiPrefs) => {
    setPrefs(next);
    savePrefs(next);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  }, []);

  const toggleType = (key: NudgeTypeKey) => {
    persist({ ...prefs, types: { ...prefs.types, [key]: !prefs.types[key] } });
  };

  const setQuietStart = (h: number) => {
    persist({ ...prefs, quietStart: h });
  };

  const setQuietEnd = (h: number) => {
    persist({ ...prefs, quietEnd: h });
  };

  const toggleCalmWindow = () => {
    persist({ ...prefs, calmWindowOnly: !prefs.calmWindowOnly });
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 max-w-[680px]"
    >
      {/* Back navigation */}
      <button
        onClick={() => setActiveTab("coach")}
        className="inline-flex items-center gap-2 font-bold text-sm rounded-full px-4"
        style={{ minHeight: 44, color: GREEN, background: GREEN_SOFT }}
        aria-label={t("sr.back")}
      >
        <Icon name="arrow_back" size={16} />
        {t("sr.back")}
      </button>

      {/* Header */}
      <div>
        <h1
          className="text-2xl md:text-[2rem] font-extrabold leading-tight"
          style={{ fontFamily: "var(--font-display)", color: INK }}
        >
          {t("sr.title")}
        </h1>
        <p className="text-sm mt-2 max-w-xl leading-relaxed" style={{ color: MUTED }}>
          {t("sr.subtitle")}
        </p>
      </div>

      {/* MAX-2 CONTRACT CARD — always visible (AC-5) */}
      <div
        data-testid="sr-max2-contract"
        className="rounded-2xl p-4 flex items-start gap-3"
        style={{ background: LAV_SOFT, border: `1px solid ${RULE_STRONG}` }}
        role="note"
        aria-label={t("sr.max2")}
      >
        <span
          className="inline-flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ width: 36, height: 36, background: PAPER, color: CLAY }}
          aria-hidden="true"
        >
          <Icon name="notifications" size={18} />
        </span>
        <p className="text-[13px] leading-relaxed font-medium" style={{ color: INK }}>
          {t("sr.max2")}
        </p>
      </div>

      {/* NEXT NUDGE CARD (AC-1) */}
      <Section title={t("sr.nextNudge.label")} icon={<Icon name="bolt" size={16} />}>
        <div
          className="rounded-2xl p-4"
          style={{ background: PAPER_DEEP, border: `1px solid ${RULE}` }}
          data-testid="sr-next-nudge"
        >
          {nudge ? (
            <div className="flex items-center gap-3">
              <span
                className="inline-flex items-center justify-center rounded-xl flex-shrink-0"
                style={{ width: 36, height: 36, background: GREEN_SOFT, color: GREEN }}
                aria-hidden="true"
              >
                <Icon name="notifications" size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-bold" style={{ color: INK }}>
                  {t(KIND_KEY[nudge.kind] ?? "sr.nextNudge.kind.prep")}
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: MUTED }}>
                  {t(nudge.headlineKey, nudge.vars)}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span
                className="inline-flex items-center justify-center rounded-xl flex-shrink-0"
                style={{ width: 36, height: 36, background: PAPER, color: FAINT }}
                aria-hidden="true"
              >
                <Icon name="notifications_off" size={18} />
              </span>
              <p className="text-[13px]" style={{ color: MUTED }}>
                {t("sr.nextNudge.none")}
              </p>
            </div>
          )}
        </div>
      </Section>

      {/* PER-TYPE TOGGLES (AC-2) */}
      <Section title={t("sr.types.heading")} icon={<Icon name="notifications" size={16} />}>
        <div className="space-y-3">
          {NUDGE_TYPES.map(({ key, labelKey, descKey, tone, toneSoft }) => {
            const on = prefs.types[key];
            return (
              <div
                key={key}
                className="rounded-2xl p-4 flex items-center justify-between gap-4"
                style={{
                  background: on ? toneSoft : PAPER_DEEP,
                  border: `1px solid ${on ? tone : RULE}`,
                  transition: "background 0.15s, border-color 0.15s",
                }}
                data-testid={`sr-toggle-${key}`}
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-bold" style={{ color: INK }}>
                    {t(labelKey)}
                  </p>
                  <p className="text-[12px] mt-0.5" style={{ color: MUTED }}>
                    {t(descKey)}
                  </p>
                </div>
                <Toggle
                  on={on}
                  onToggle={() => toggleType(key)}
                  label={t(labelKey)}
                  activeColor={tone}
                />
              </div>
            );
          })}
        </div>
      </Section>

      {/* QUIET HOURS (AC-3) */}
      <Section title={t("sr.quiet.heading")} icon={<Icon name="schedule" size={16} />}>
        <div
          className="rounded-2xl p-4 space-y-4"
          style={{ background: PAPER_DEEP, border: `1px solid ${RULE}` }}
        >
          <p className="text-[13px]" style={{ color: MUTED }}>
            {t("sr.quiet.desc")}
          </p>

          <div className="grid grid-cols-2 gap-3">
            {/* Quiet start */}
            <div>
              <label
                htmlFor="sr-quiet-start"
                className="text-[12px] font-bold block mb-1.5"
                style={{ color: MUTED }}
              >
                {t("sr.quiet.start")}
              </label>
              <select
                id="sr-quiet-start"
                value={prefs.quietStart}
                onChange={(e) => setQuietStart(Number(e.target.value))}
                className="w-full rounded-xl px-3 font-bold text-[13px]"
                style={{
                  minHeight: 44,
                  background: PAPER,
                  color: INK,
                  border: `1px solid ${RULE_STRONG}`,
                  outline: "none",
                }}
                data-testid="sr-quiet-start"
                aria-label={`${t("sr.quiet.start")}: ${formatHour(prefs.quietStart)}`}
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>{formatHour(h)}</option>
                ))}
              </select>
            </div>

            {/* Quiet end */}
            <div>
              <label
                htmlFor="sr-quiet-end"
                className="text-[12px] font-bold block mb-1.5"
                style={{ color: MUTED }}
              >
                {t("sr.quiet.end")}
              </label>
              <select
                id="sr-quiet-end"
                value={prefs.quietEnd}
                onChange={(e) => setQuietEnd(Number(e.target.value))}
                className="w-full rounded-xl px-3 font-bold text-[13px]"
                style={{
                  minHeight: 44,
                  background: PAPER,
                  color: INK,
                  border: `1px solid ${RULE_STRONG}`,
                  outline: "none",
                }}
                data-testid="sr-quiet-end"
                aria-label={`${t("sr.quiet.end")}: ${formatHour(prefs.quietEnd)}`}
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>{formatHour(h)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Summary line */}
          <p
            className="text-[12px] rounded-xl px-3 py-2 font-medium"
            style={{ background: GREEN_SOFT, color: GREEN }}
            data-testid="sr-quiet-summary"
          >
            {t("sr.quiet.summary", {
              start: formatHour(prefs.quietStart),
              end: formatHour(prefs.quietEnd),
            })}
          </p>
        </div>
      </Section>

      {/* CALM-WINDOW SCHEDULING (AC-4) */}
      <Section title={t("sr.calm.heading")} icon={<Icon name="bolt" size={16} />}>
        <div
          className="rounded-2xl p-4 flex items-center justify-between gap-4"
          style={{
            background: prefs.calmWindowOnly ? GREEN_SOFT : PAPER_DEEP,
            border: `1px solid ${prefs.calmWindowOnly ? GREEN : RULE}`,
            transition: "background 0.15s, border-color 0.15s",
          }}
          data-testid="sr-calm-window-row"
        >
          <div className="min-w-0">
            <p className="text-[13px] font-bold" style={{ color: INK }}>
              {t("sr.calm.label")}
            </p>
            <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: MUTED }}>
              {t("sr.calm.desc")}
            </p>
          </div>
          <Toggle
            on={prefs.calmWindowOnly}
            onToggle={toggleCalmWindow}
            label={t("sr.calm.label")}
            activeColor={GREEN}
          />
        </div>
      </Section>

      {/* Saved confirmation */}
      {savedFlash && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-2 text-[13px] font-bold"
          style={{ color: GREEN }}
          role="status"
          aria-live="polite"
          data-testid="sr-saved-flash"
        >
          <Icon name="check_circle" size={16} />
          {t("sr.saved")}
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span
          className="inline-flex items-center justify-center rounded-lg"
          style={{ width: 28, height: 28, background: GREEN_SOFT, color: GREEN }}
          aria-hidden="true"
        >
          {icon}
        </span>
        <h2
          className="text-[13px] font-extrabold uppercase tracking-wide"
          style={{ color: FAINT }}
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({
  on,
  onToggle,
  label,
  activeColor,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
  activeColor: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className="relative rounded-full transition flex-shrink-0"
      style={{
        width: 44,
        height: 26,
        minWidth: 44,
        minHeight: 44,    // touch target via padding compensation
        background: on ? activeColor : RULE_STRONG,
        border: "none",
        cursor: "pointer",
        padding: 0,
        display: "flex",
        alignItems: "center",
      }}
    >
      <span
        className="absolute rounded-full bg-white transition-all"
        style={{
          width: 20,
          height: 20,
          top: 3,
          insetInlineStart: on ? 21 : 3,
          boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
          transition: "inset-inline-start 0.15s",
        }}
        aria-hidden="true"
      />
    </button>
  );
}
