import React, { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";
import { BehaviorLog } from "../../types";

/** Multi-month behavior-intensity trend (last 6 months). */
export default function TrendsChart({ logs, milestonesPercent }: { logs: BehaviorLog[]; milestonesPercent: number }) {
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
    <div className="bg-[#141821] border border-white/10 rounded-3xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-[#d7aa55]" /> Trend over time
          </span>
          <h3 className="text-lg font-bold text-white mt-1">Behavior intensity · last 6 months</h3>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-[#f4d991]">{milestonesPercent}%</div>
          <span className="text-[10px] text-[#a8a093] uppercase tracking-wide">milestone readiness</span>
        </div>
      </div>
      {hasData ? (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" stroke="#a8a093" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 5]} stroke="#a8a093" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "#0c0e14", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: "#f4d991" }}
                formatter={(v: any, _n: any, item: any) => [`avg ${v}/5 · ${item?.payload?.count || 0} events`, "Intensity"]}
              />
              <Line type="monotone" dataKey="avg" stroke="#d7aa55" strokeWidth={2.5} dot={{ r: 3, fill: "#d7aa55" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-32 flex items-center justify-center text-center text-xs text-[#a8a093] border border-dashed border-white/10 rounded-2xl">
          A few weeks of logs will reveal your longer-term trend here.
        </div>
      )}
    </div>
  );
}
