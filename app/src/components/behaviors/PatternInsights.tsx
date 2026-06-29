import React, { useMemo } from "react";
import { Icon } from "../ui/Icon";
import { BehaviorLog } from "../../types";
import { timeBand } from "../../lib/behaviorUtils";
import { useLanguage } from "../../context/LanguageContext";
import { PASTEL, type PastelKey } from "../ui/kit";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Surfaces correlations from behavior logs as a calm icon-row list (UC-1).
 *  Keeps the existing context/day/time/resolve-rate correlation logic, but
 *  presents COUNTS only (no per-tile avg-intensity) so it stays clear of the
 *  clinical firewall — these are flat aggregates of parent-noticed moments,
 *  never a verdict on the child. Strings flow through t() for He/En + RTL. */
export default function PatternInsights({ logs }: { logs: BehaviorLog[] }) {
  const { t } = useLanguage();

  const insights = useMemo(() => {
    if (logs.length === 0) return null;

    // Most-frequent bucket by key (count-based, not intensity-ranked).
    const topBy = (key: (l: BehaviorLog) => string | undefined) => {
      const m = new Map<string, number>();
      logs.forEach((l) => {
        const k = key(l);
        if (!k) return;
        m.set(k, (m.get(k) || 0) + 1);
      });
      let top = "";
      let topN = 0;
      m.forEach((n, k) => {
        if (n > topN) {
          top = k;
          topN = n;
        }
      });
      return top ? { label: top, n: topN } : null;
    };

    const context = topBy((l) => l.context);
    const day = topBy((l) => DAYS[new Date(l.timestamp).getDay()]);
    const time = topBy((l) => timeBand(new Date(l.timestamp).getHours()));
    const resolved = logs.filter((l) => l.resolved).length;

    return { context, day, time, resolved, total: logs.length };
  }, [logs]);

  if (!insights) return null;

  const headline =
    insights.context && insights.day
      ? t("beh.pattern.headline", {
          place: insights.context.label.toLowerCase(),
          day: insights.day.label,
        })
      : t("beh.pattern.empty");

  const Row = ({
    iconName,
    fill = 0,
    tone,
    label,
    value,
    sub,
  }: {
    iconName: string;
    fill?: 0 | 1;
    tone: PastelKey;
    label: string;
    value: string;
    sub: string;
  }) => {
    const p = PASTEL[tone];
    return (
      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ width: 40, height: 40, background: p.soft, color: p.ink }}
        >
          <Icon name={iconName} size={20} fill={fill} />
        </span>
        <div className="min-w-0 flex-1 text-start">
          <div className="text-sm font-bold truncate" style={{ color: "var(--arbor-ink)" }}>{value}</div>
          <div className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>{label} · {sub}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: "linear-gradient(120deg,#eef6f1,var(--arbor-lav-soft))", border: "1px solid var(--arbor-rule)" }}>
      <div className="flex items-center gap-2">
        <Icon name="monitoring" size={18} style={{ color: "var(--arbor-green-ink)" }} />
        <span className="text-xs font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-green-ink)" }}>{t("beh.pattern.title")}</span>
      </div>
      <p className="text-base leading-snug" style={{ fontFamily: "var(--font-editorial)", color: "var(--arbor-ink)" }}>{headline}</p>
      <div className="space-y-3">
        {insights.context && (
          <Row iconName="place" tone="sky" label={t("beh.pattern.place")} value={insights.context.label} sub={t("beh.pattern.placeSub", { count: insights.context.n })} />
        )}
        {insights.day && (
          <Row iconName="calendar_month" tone="lav" label={t("beh.pattern.day")} value={insights.day.label} sub={t("beh.pattern.daySub", { count: insights.day.n })} />
        )}
        {insights.time && (
          <Row iconName="schedule" tone="yellow" label={t("beh.pattern.time")} value={insights.time.label} sub={t("beh.pattern.timeSub", { count: insights.time.n })} />
        )}
        <Row iconName="check_circle" fill={1} tone="mint" label={t("beh.pattern.resolved")} value={`${insights.resolved}/${insights.total}`} sub={t("beh.pattern.resolvedSub", { count: insights.resolved, total: insights.total })} />
      </div>
    </div>
  );
}
