/**
 * C1 — "Arbor Noticed" weekly in-app card (mounted on Today / OverviewTab).
 *
 * Surfaces the single highest WatchLevel signal derived from the child's OWN
 * logged milestones and behavior moments. Read-only: no new data collection,
 * no network call, no push notification — pure in-app display.
 *
 * DUX-011: renders NOTHING with zero detections (no empty state), and carries
 * an unobtrusive per-detection dismiss ("not right") persisted in localStorage
 * per child + domain + level — a NEW detection (different domain or a level
 * change) shows again; the dismissed one stays quiet.
 *
 * NON-DIAGNOSTIC STANCE (hard constraint, do not weaken):
 *   - Only monitor-level detections render: "worth keeping an eye on / worth
 *     mentioning to your pediatrician" — never a diagnosis, score, condition
 *     name, or alarm. No calm/on-track verdict card on Today.
 *   - All copy follows the established monitoring.ts framing rules.
 *
 * C5 link: when the flagged domain maps to an expert-cited Daily Play
 * activity, a secondary CTA links there (no new data, just a tab switch).
 */
import React, { useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { deriveMonitoring, pickHighestWatchSignal, monitoredDomainToPlayHint } from "../../lib/monitoring";
import { PLAY_ACTIVITIES } from "../../playbank/content";
import type { MonitoredDomainId } from "../../lib/monitoring";
// B0 — months-precise age: prefer birthDate/ageMonths over the legacy whole-year
import { ageMonthsFromProfile } from "../../lib/childAge";

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const RULE = "var(--arbor-rule)";
// Peach = calm warm attention (non-alarming). Design system token.
// Distinct from the green "on track" palette and from error red.
const PEACH_INK = "var(--arbor-peach-ink)";
const PEACH_SOFT = "var(--arbor-peach-soft)";

// Per-child localStorage key for dismissed detection signatures (same
// try/catch idiom as FirstStepsRail / the Daily Play sessionLength pref).
const dismissKey = (childId: string) => `arbor.noticed.dismissed.${childId}`;

function readDismissed(childId: string): string[] {
  try {
    const raw = window.localStorage.getItem(dismissKey(childId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function writeDismissed(childId: string, sigs: string[]): void {
  try {
    window.localStorage.setItem(dismissKey(childId), JSON.stringify(sigs));
  } catch {
    /* storage unavailable — dismissal simply won't persist */
  }
}

/**
 * Pick the first Daily Play activity that (a) has an expert `source` and
 * (b) targets the domain that corresponds to the flagged monitoring domain.
 * Returns null when none is available — the card renders without the CTA.
 */
function findCitedActivity(domain: MonitoredDomainId) {
  const hint = monitoredDomainToPlayHint(domain);
  return PLAY_ACTIVITIES.find((a) => a.domain === hint && a.source != null) ?? null;
}

export default function ArborNoticedCard() {
  const { milestones, behaviorLogs, childProfile, setActiveTab } = useArbor();
  const { t } = useLanguage();

  const firstName = (childProfile.name || "your child").split(" ")[0];

  // B0 — use months-precise age when available (birthDate or ageMonths field),
  // then divide back to fractional years for `deriveMonitoring` which still takes
  // ageYears. This preserves the monitoring.ts interface while feeding it an
  // accurate value: a 9-month-old passes 0.75 instead of the legacy 0.
  const ageMonthsPrecise = ageMonthsFromProfile(childProfile);
  const ageYears =
    ageMonthsPrecise !== null
      ? ageMonthsPrecise / 12
      : (childProfile.age ?? 0);

  const monitoring = useMemo(
    () =>
      deriveMonitoring(
        { ageYears, milestones, behaviorLogs },
        firstName,
      ),
    // Re-derive when the child's data changes; not time-sensitive within a session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ageYears, milestones.length, behaviorLogs.length, firstName],
  );

  const signal = useMemo(() => pickHighestWatchSignal(monitoring), [monitoring]);

  // DUX-011 dismiss — per-detection signature (child-scoped key). A different
  // domain or a level change is a NEW detection and shows again.
  const [dismissedSigs, setDismissedSigs] = useState<string[]>(() =>
    readDismissed(childProfile.id),
  );

  // DUX-011 hide-on-empty: `deriveMonitoring` always emits all monitored
  // domains, so a signal object exists even for a zero-data account — the real
  // "nothing detected" case is the absence of a monitor-level signal. With zero
  // detections the card renders NOTHING (no empty/calm placeholder on Today).
  if (!signal || signal.level !== "monitor") return null;

  const signature = `${signal.domain}:${signal.level}`;
  if (dismissedSigs.includes(signature)) return null;

  const dismiss = () => {
    const next = [...dismissedSigs, signature];
    writeDismissed(childProfile.id, next);
    setDismissedSigs(next);
  };

  // Build the body copy for the monitor state using the translation keys.
  function buildMonitorBody(): string {
    const area = t("noticed.domain." + signal!.domain);
    const hasMilestone = signal!.reasons.includes("milestone_overdue");
    const hasPattern = signal!.reasons.includes("behavior_pattern");
    if (hasMilestone && hasPattern) {
      return t("noticed.monitor.body.both", {
        name: firstName,
        area,
        n: signal!.patternMoments,
      });
    }
    if (hasMilestone) return t("noticed.monitor.body.milestone", { name: firstName, area });
    return t("noticed.monitor.body.pattern", { n: signal!.patternMoments, area });
  }

  const citedActivity = findCitedActivity(signal.domain as MonitoredDomainId);

  return (
    <section
      className="rounded-[22px] p-5"
      style={{ background: PEACH_SOFT, border: `1px solid ${RULE}` }}
      aria-label={t("noticed.monitor.title")}
    >
      {/* Eyebrow + unobtrusive per-detection dismiss */}
      <div className="flex items-center gap-1.5 mb-3">
        <Icon name="visibility" size={14} className="flex-shrink-0" style={{ color: PEACH_INK }} />
        <span className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: PEACH_INK }}>
          {t("noticed.eyebrow")}
        </span>
        <button
          onClick={dismiss}
          aria-label={t("aria.dismiss")}
          className="ms-auto -my-2 -me-2 inline-flex items-center justify-center w-9 h-9 rounded-lg touch-target transition active:scale-[0.98]"
          style={{ color: MUTED }}
        >
          <Icon name="close" size={14} />
        </button>
      </div>

      {/* Title */}
      <p className="text-[14.5px] font-extrabold leading-snug mb-1.5" style={{ color: INK }}>
        {t("noticed.monitor.title")}
      </p>

      {/* Body: the domain signal (counts/patterns only, never a verdict) */}
      <p className="text-[13px] leading-relaxed" style={{ color: MUTED, textWrap: "pretty" } as React.CSSProperties}>
        {buildMonitorBody()}
      </p>

      {/* Non-diagnostic reassurance line */}
      <p className="text-[12px] mt-2 font-medium" style={{ color: PEACH_INK }}>
        {t("noticed.monitor.cta")}
      </p>

      {/* C5 link: expert-cited activity for the flagged domain */}
      {citedActivity && (
        <button
          onClick={() => setActiveTab("daily-play")}
          className="inline-flex items-center gap-1.5 mt-3 text-[12.5px] font-bold rounded-xl px-3 py-2 touch-target transition active:scale-[0.98]"
          style={{
            background: "var(--arbor-paper-elevated)",
            color: PEACH_INK,
            border: `1px solid ${RULE}`,
          }}
          aria-label={t("noticed.activity.aria", { area: t("noticed.domain." + signal!.domain) })}
        >
          <Icon name="open_in_new" size={12} />
          {t("noticed.activity.cta")}
        </button>
      )}
    </section>
  );
}
