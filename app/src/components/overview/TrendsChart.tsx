import React, { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";
import { BehaviorLog } from "../../types";
import { cardCls } from "../ui/kit";
import { useLanguage } from "../../context/LanguageContext";

/** Multi-month behavior-intensity trend (last 6 months). */
export default function TrendsChart({ logs, milestonesPercent }: { logs: BehaviorLog[]; milestonesPercent: number }) {
  const { t } = useLanguage();
  const data = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string; sum: number; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString(undefined, { month: "short" }),
        sum: 0,
        count: 0,
      });
    }
    const idx = new Map(months.map((m, i) => [m.key, i]));
    logs.forEach((l) => {
      const d = new Date(l.timestamp);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const i = idx.get(k);
      if (i !== undefined) {
        months[i].sum += l.intensity;
        months[i].count += 1;
      }
    });
    return months.map((m) => ({ label: m.label, avg: m.count ? Number((m.sum / m.count).toFixed(2)) : 0, count: m.count }));
  }, [logs]);

  const hasData = data.some((d) => d.count > 0);

  return (
    <div className={`${cardCls} p-6 space-y-4`}>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--arbor-green-ink)" }}>
            <TrendingUp className="w-3.5 h-3.5" /> {t("trends.eyebrow")}
          </span>
          <h3 className="text-lg font-extrabold mt-1" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("trends.title")}</h3>
        </div>
        <div className="text-end">
          <div className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-green-ink)" }}>{milestonesPercent}%</div>
          <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--arbor-muted)" }}>{t("trends.readiness")}</span>
        </div>
      </div>
      {hasData ? (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="rgba(41,51,63,0.06)" vertical={false} />
              <XAxis dataKey="label" stroke="var(--arbor-muted)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 5]} stroke="var(--arbor-muted)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "#ffffff", border: "1px solid rgba(41,51,63,0.12)", borderRadius: 12, fontSize: 12, boxShadow: "0 8px 24px rgba(41,51,63,0.10)" }}
                labelStyle={{ color: "var(--arbor-clay-deep)", fontWeight: 700 }}
                formatter={(v: any, _n: any, item: any) => [t("trends.tooltip.fmt", { avg: v, count: item?.payload?.count || 0 }), t("trends.tooltip.label")]}
              />
              <Line type="monotone" dataKey="avg" stroke="var(--arbor-clay)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--arbor-clay)" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-32 flex items-center justify-center text-center text-xs rounded-2xl" style={{ color: "var(--arbor-muted)", border: "1px dashed var(--arbor-rule-strong)" }}>
          {t("trends.empty")}
        </div>
      )}
    </div>
  );
}
