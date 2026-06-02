import React, { useMemo } from "react";
import { Activity, MapPin, CalendarDays, Clock, CheckCircle2 } from "lucide-react";
import { BehaviorLog } from "../../types";
import { timeBand } from "../../lib/behaviorUtils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Surfaces correlations from behavior logs, not just counts. */
export default function PatternInsights({ logs }: { logs: BehaviorLog[] }) {
  const insights = useMemo(() => {
    if (logs.length === 0) return null;

    const avgBy = (key: (l: BehaviorLog) => string | undefined) => {
      const m = new Map<string, { sum: number; n: number }>();
      logs.forEach((l) => {
        const k = key(l);
        if (!k) return;
        const cur = m.get(k) || { sum: 0, n: 0 };
        cur.sum += l.intensity;
        cur.n += 1;
        m.set(k, cur);
      });
      let top = "";
      let topAvg = 0;
      let topN = 0;
      m.forEach((v, k) => {
        const a = v.sum / v.n;
        if (a > topAvg || (a === topAvg && v.n > topN)) {
          top = k;
          topAvg = a;
          topN = v.n;
        }
      });
      return top ? { label: top, avg: topAvg, n: topN } : null;
    };

    const context = avgBy((l) => l.context);
    const day = avgBy((l) => DAYS[new Date(l.timestamp).getDay()]);
    const time = avgBy((l) => timeBand(new Date(l.timestamp).getHours()));
    const resolved = logs.filter((l) => l.resolved).length;
    const resolveRate = Math.round((resolved / logs.length) * 100);

    return { context, day, time, resolveRate, total: logs.length };
  }, [logs]);

  if (!insights) return null;

  const headline =
    insights.context && insights.day
      ? `Hardest moments cluster at ${insights.context.label.toLowerCase()} on ${insights.day.label}.`
      : "Keep logging to reveal stronger patterns.";

  const Tile = ({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) => (
    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-1">
      <span className="text-[10px] uppercase font-black tracking-wider text-[#a8a093] flex items-center gap-1.5">{icon} {label}</span>
      <div className="text-sm font-bold text-white">{value}</div>
      {sub && <div className="text-[10px] text-[#a8a093]">{sub}</div>}
    </div>
  );

  return (
    <div className="bg-gradient-to-br from-[#d7aa55]/5 to-transparent border border-[#d7aa55]/15 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-[#d7aa55]" />
        <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider">Pattern intelligence</span>
      </div>
      <p className="text-sm text-gray-200">{headline}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {insights.context && (
          <Tile icon={<MapPin className="w-3 h-3" />} label="Toughest place" value={insights.context.label} sub={`avg ${insights.context.avg.toFixed(1)}/5 · ${insights.context.n}×`} />
        )}
        {insights.day && (
          <Tile icon={<CalendarDays className="w-3 h-3" />} label="Toughest day" value={insights.day.label} sub={`avg ${insights.day.avg.toFixed(1)}/5 · ${insights.day.n}×`} />
        )}
        {insights.time && (
          <Tile icon={<Clock className="w-3 h-3" />} label="Toughest time" value={insights.time.label} sub={`avg ${insights.time.avg.toFixed(1)}/5 · ${insights.time.n}×`} />
        )}
        <Tile icon={<CheckCircle2 className="w-3 h-3" />} label="Resolved" value={`${insights.resolveRate}%`} sub={`of ${insights.total} events`} />
      </div>
    </div>
  );
}
