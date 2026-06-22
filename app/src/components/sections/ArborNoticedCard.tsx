/**
 * C1 — "Arbor Noticed" weekly in-app card (Development / Growth tab).
 *
 * Surfaces the single highest WatchLevel signal derived from the child's OWN
 * logged milestones and behavior moments. Read-only: no new data collection,
 * no network call, no push notification — pure in-app display.
 *
 * NON-DIAGNOSTIC STANCE (hard constraint, do not weaken):
 *   - Calm state: encouraging, never manufactured concern.
 *   - Monitor state: "worth keeping an eye on / worth mentioning to your
 *     pediatrician" — never a diagnosis, score, condition name, or alarm.
 *   - All copy follows the established monitoring.ts framing rules.
 *
 * C5 link: when the flagged domain maps to an expert-cited Daily Play
 * activity, a secondary CTA links there (no new data, just a tab switch).
 */
import React, { useMemo } from "react";
import { Eye, CheckCircle2, ExternalLink } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { deriveMonitoring, pickHighestWatchSignal, monitoredDomainToPlayHint } from "../../lib/monitoring";
import { PLAY_ACTIVITIES } from "../../playbank/content";
import type { MonitoredDomainId } from "../../lib/monitoring";

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const RULE = "var(--arbor-rule)";
const GREEN = "var(--arbor-green-ink)";
const GREEN_SOFT = "var(--arbor-green-soft)";
// Peach = calm warm attention (non-alarming). Design system token.
// Distinct from the green "on track" palette and from error red.
const PEACH_INK = "var(--arbor-peach-ink)";
const PEACH_SOFT = "var(--arbor-peach-soft)";

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
  const ageYears = childProfile.age ?? 0;

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

  // No signal = no milestones/logs yet; stay silent rather than show an empty card.
  if (!signal) return null;

  const isCalm = signal.level === "on_track";
  const bgColor = isCalm ? GREEN_SOFT : PEACH_SOFT;
  const accentColor = isCalm ? GREEN : PEACH_INK;
  const Icon = isCalm ? CheckCircle2 : Eye;

  // Build the body copy for the monitor state using the translation keys.
  function buildMonitorBody(): string {
    if (isCalm) return t("noticed.calm.body", { name: firstName });
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

  const citedActivity = !isCalm ? findCitedActivity(signal.domain as MonitoredDomainId) : null;

  return (
    <section
      className="rounded-[22px] p-5"
      style={{ background: bgColor, border: `1px solid ${RULE}` }}
      aria-label={isCalm ? t("noticed.calm.title", { name: firstName }) : t("noticed.monitor.title")}
    >
      {/* Eyebrow */}
      <div className="flex items-center gap-1.5 mb-3">
        <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accentColor }} aria-hidden="true" />
        <span className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
          {t("noticed.eyebrow")}
        </span>
      </div>

      {/* Title */}
      <p className="text-[14.5px] font-extrabold leading-snug mb-1.5" style={{ color: INK }}>
        {isCalm
          ? t("noticed.calm.title", { name: firstName })
          : t("noticed.monitor.title")}
      </p>

      {/* Body: calm encouragement or the domain signal */}
      <p className="text-[13px] leading-relaxed" style={{ color: MUTED, textWrap: "pretty" } as React.CSSProperties}>
        {buildMonitorBody()}
      </p>

      {/* Monitor-state: non-diagnostic reassurance line */}
      {!isCalm && (
        <p className="text-[12px] mt-2 font-medium" style={{ color: PEACH_INK }}>
          {t("noticed.monitor.cta")}
        </p>
      )}

      {/* C5 link: expert-cited activity for the flagged domain */}
      {citedActivity && (
        <button
          onClick={() => setActiveTab("daily-play")}
          className="inline-flex items-center gap-1.5 mt-3 text-[12.5px] font-bold rounded-xl px-3 py-2 touch-target transition active:scale-[0.98]"
          style={{
            background: "var(--arbor-paper-elevated)",
            color: accentColor,
            border: `1px solid ${RULE}`,
          }}
          aria-label={t("noticed.activity.aria", { area: t("noticed.domain." + signal!.domain) })}
        >
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
          {t("noticed.activity.cta")}
        </button>
      )}
    </section>
  );
}
