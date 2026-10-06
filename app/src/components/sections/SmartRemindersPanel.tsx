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
 *   - Reads next-nudge from the existing JITAI engine via nextNudge() with the
 *     parent's prefs and today's ledger (the same inputs RhythmCue renders
 *     from), no new signal path.
 *   - B-TODAY-02: nothing leaves the app. The contract line says "shows …
 *     inside the app" and that nothing is sent to a phone or email yet.
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
import { shownNudgesToday, NUDGE_DAILY_CEILING } from "../../growth/jitaiPrefs";
import { predictRhythm } from "../../rhythm/predict";
import { ageMonthsFromProfile } from "../../lib/childAge";
import {
  loadPrefs,
  savePrefs,
  type JitaiPrefs,
  type NudgeTypeKey,
} from "../../growth/jitaiPrefs";
/* TJB-14: `jitaiPrefs.formatHour` is English-only ("9:00 pm"), so the Hebrew
   quiet-hours picker and its summary line printed am/pm inside an RTL page.
   `lib/pulse.formatHour` is the language-aware sibling already used by the
   Today pulse (he → 24h "21:00") — one formatter, both locales. */
import { formatHour } from "../../lib/pulse";
import PushPrimingCard from "../nextopen/PushPrimingCard";
import { usePushPriming } from "../../hooks/usePushPriming";
import { ageYearsOf } from "../../lib/age/forChild";

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
const LAV_SOFT    = "var(--arbor-lav-soft)";

// ── Hours available in the quiet-hours picker ────────────────────────────────
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);

// ── Nudge kind → i18n key map ─────────────────────────────────────────────────
const KIND_KEY: Record<string, string> = {
  prep:     "sr.nextNudge.kind.prep",
  calm:     "sr.nextNudge.kind.calm",
  log:      "sr.nextNudge.kind.log",
  practice: "sr.nextNudge.kind.practice",
  bedtime:  "sr.nextNudge.kind.bedtime",
};

// ── Type definitions ──────────────────────────────────────────────────────────
/* B-OCCL-01 (6 Oct): the route's ONE data-primary-move literal, spread on the
   control that performs the move — the first nudge-type switch — never on the
   prefs wrapper. A static const (or undefined), so whiteLabelContrast resolves
   it as a data attribute. */
const PREFS_STAMP = { "data-primary-move": "set-reminder-prefs" } as const;

const NUDGE_TYPES: Array<{
  key: NudgeTypeKey;
  labelKey: string;
  descKey: string;
  tone: string;
  toneSoft: string;
}> = [
  // B-TODAY-02: one switch per NudgeTypeKey; lib/jitai NUDGE_KIND_PREF maps
  // every engine kind onto exactly one of these.
  { key: "guidance", labelKey: "sr.types.guidance.label", descKey: "sr.types.guidance.desc", tone: CLAY,  toneSoft: GREEN_SOFT },
  { key: "moments",  labelKey: "sr.types.moments.label",  descKey: "sr.types.moments.desc",  tone: GREEN, toneSoft: GREEN_SOFT },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function SmartRemindersPanel() {
  const push = usePushPriming();
  const { setActiveTab, childProfile, behaviorLogs } = useArbor();
  const { t, uiLang } = useLanguage();

  // Load prefs from localStorage on first render — no Firestore, no child data.
  const [prefs, setPrefs] = useState<JitaiPrefs>(loadPrefs);
  const [savedFlash, setSavedFlash] = useState(false);

  // Derive the next nudge from the existing JITAI engine (read-only — the same
  // engine RhythmCue renders from, no new signal path).
  const firstName = (childProfile.name || "your child").split(" ")[0];

  const ageMonthsPrecise = ageMonthsFromProfile(childProfile);
  const ageYears = ageMonthsPrecise !== null
    ? ageMonthsPrecise / 12
    : (ageYearsOf(childProfile) ?? 0);

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

  // TJB-03: the preview runs the SAME gated engine RhythmCue runs — the
  // parent's saved prefs + today's shown count are passed in, so the "next
  // nudge" card shows what will actually fire, not what the engine could.
  const shownToday = useMemo(() => shownNudgesToday(), []);
  const nudge = useMemo(
    () =>
      nextNudge(
        {
          nowMs: Date.now(),
          rhythm,
          loggedToday: loggedTodayCount,
          recent7d,
          childName: firstName,
          shownToday,
        },
        prefs,
      ),
    [rhythm, loggedTodayCount, recent7d, firstName, prefs, shownToday],
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
      {/* Back navigation.
          OBJ-SHELL-07: the button said "Back to Settings" and went to #/coach —
          Ask Arbor, which is neither where the parent came from nor what the
          label promised. There is no Settings ROUTE to go back to (Settings is
          a modal), so the honest target is the hub that owns this surface:
          Smart Reminders is one of Today's tools (navigation.ts SECTIONS
          today.tools), and the label now says so. */}
      <button
        onClick={() => setActiveTab("overview")}
        className="inline-flex items-center gap-2 font-bold text-sm rounded-full px-4"
        style={{ minHeight: 44, minWidth: 44, color: GREEN, background: GREEN_SOFT }}
        aria-label={t("elev.sr.back")}
      >
        {/* OBJ-TODAY-08: mirrored like the Day Windows and WeeklyTab backs. */}
        <Icon name="arrow_back" size={16} className="rtl:-scale-x-100" />
        {t("elev.sr.back")}
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

      {/* PER-TYPE TOGGLES (AC-2). The declared move is set-reminder-prefs: this
          is the block where the parent decides what Arbor may send.
          B-OCCL-01 (6 Oct): the stamp is on the FIRST switch (Toggle
          stamped), not on this wrapper (276 px at 375, it ran under the
          capture dock), and the block comes BEFORE the max-2 contract card
          (≈ 237 px at 375) — the contract stays always visible, under it. */}
      <div data-module="reminders-prefs" style={{ display: "contents" }}>
      <Section title={t("sr.types.heading")} icon={<Icon name="notifications" size={16} />}>
        <div className="space-y-3">
          {NUDGE_TYPES.map(({ key, labelKey, descKey, tone, toneSoft }, i) => {
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
                  stamped={i === 0}
                />
              </div>
            );
          })}
        </div>
      </Section>
      </div>

      {/* Item 11 (IA-02): the surface contract reaches the DOM. `data-module`
          marks a top-level sibling module (what moduleBudget counts);
          `data-primary-move` marks the ONE control that performs the move
          surfaceContract.ts declares for this route (B-OCCL-01: the first
          nudge-type switch above). */}
      {/* MAX-2 CONTRACT CARD — always visible (AC-5) */}
      {/* B-TODAY-16: one card, two halves — the max-2 contract and, under a
          rule, the next nudge (it lost its own module slot to Delivery). */}
      <div
        data-module="reminders-contract"
        className="rounded-2xl overflow-hidden"
        style={{ border: `1px solid ${RULE_STRONG}` }}
      >
      <div
        data-testid="sr-max2-contract"
        className="p-4 flex items-start gap-3"
        style={{ background: LAV_SOFT }}
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
        <div className="min-w-0">
          <p className="text-[13px] leading-relaxed font-medium" style={{ color: INK }}>
            {t("sr.max2")}
          </p>
          {/* ENG-02: the contract is a live count, not a promise. */}
          <p className="mt-1 text-[12px] font-bold" style={{ color: MUTED }} data-testid="sr-max2-count">
            {t("sr.max2.count", { n: Math.min(shownToday.length, NUDGE_DAILY_CEILING) })}
          </p>
        </div>
      </div>

      {/* NEXT NUDGE (AC-1) — B-TODAY-16: the contract card's second half (no
          own data-module stamp), so the page keeps 3 top-level modules once
          Delivery takes a slot: contract · prefs · delivery. */}
      <div
        className="p-4"
        style={{ background: PAPER_DEEP, borderTop: `1px solid ${RULE}` }}
        data-testid="sr-next-nudge"
        aria-label={t("sr.nextNudge.label")}
      >
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: FAINT }}>{t("sr.nextNudge.label")}</p>
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
      </div>

      {/* B-TODAY-16 — DELIVERY: phone reminders live where nudges are
          configured, above the quiet-hours disclosure. One mount app-wide
          (Growth no longer mounts it; state from hooks/usePushPriming). The
          card keeps its honest states (lib/pushPriming: "Arbor sends nothing"
          while pushCapable() is false). */}
      <div data-module="reminders-delivery" style={{ display: "contents" }}>
      <Section title={t("elev.sr.delivery.heading")} icon={<Icon name="send" size={16} />}>
        <PushPrimingCard
          capable={push.capable}
          permission={push.permission}
          registered={push.registered}
          pending={push.pending}
          onToggle={push.onToggle}
        />
      </Section>
      </div>

      {/* R25 (item 11) — #/smart-reminders rendered 5 top-level modules against a declared
          moduleBudget of 3. The tail below is DEMOTED, never removed: one
          collapsed disclosure on the pattern components/practice/SpeechCoachTab.tsx
          `speech-more` already ships, so every capability keeps its door (law 6)
          while the fold belongs to the primary move. Demoted modules keep their
          own `data-module` stamp and add `data-module-demoted`, which is what
          makes the budget rule countable: top-level = stamps minus demoted. */}
      <details data-module-disclosure="smart-reminders-more" className="rounded-2xl overflow-hidden" style={{ background: PAPER, border: `1px solid ${RULE}` }}>
        <summary className="cursor-pointer list-none px-6 py-4 min-h-[44px] flex items-center gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-2xl flex-shrink-0" style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }}>
            <Icon name="schedule" size={18} />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("elev.sr.more.title")}</span>
            <span className="block text-[12px]" style={{ color: "var(--arbor-muted)" }}>{t("elev.sr.more.sub")}</span>
          </span>
          <Icon name="expand_more" size={20} className="ms-auto" style={{ color: "var(--arbor-muted)" }} />
        </summary>
        <div className="px-4 pb-4 space-y-4">
      {/* QUIET HOURS (AC-3) */}
      <div data-module="reminders-quiet" data-module-demoted style={{ display: "contents" }}>
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
                aria-label={`${t("sr.quiet.start")}: ${formatHour(prefs.quietStart, uiLang)}`}
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>{formatHour(h, uiLang)}</option>
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
                aria-label={`${t("sr.quiet.end")}: ${formatHour(prefs.quietEnd, uiLang)}`}
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>{formatHour(h, uiLang)}</option>
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
              start: formatHour(prefs.quietStart, uiLang),
              end: formatHour(prefs.quietEnd, uiLang),
            })}
          </p>
        </div>
      </Section>
      </div>

      {/* CALM-WINDOW SCHEDULING (AC-4) */}
      <div data-module="reminders-calm" data-module-demoted style={{ display: "contents" }}>
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
      </div>

        </div>
      </details>

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
  stamped = false,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
  activeColor: string;
  /** B-OCCL-01: the route's primary-move stamp goes on the FIRST switch. */
  stamped?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      {...(stamped ? PREFS_STAMP : undefined)}
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
