import React, { useMemo } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { cardCls } from "../ui/kit";

type Checkin = { id: string; date: string; mood: number; sleepHours: number; appetite: "good" | "ok" | "poor" };

const todayKey = () => new Date().toISOString().slice(0, 10);
const MOODS = ["😢", "🙁", "😐", "🙂", "😄"];

/** Lightweight daily sleep / mood / appetite tracker that enriches pattern intelligence. */
export default function DailyCheckinCard() {
  const { childProfile } = useArbor();
  const col = useChildCollection<Checkin>(childProfile.id, "wellness");
  const today = useMemo(() => col.items.find((c) => c.id === todayKey()), [col.items]);

  const cur: Checkin = today || { id: todayKey(), date: todayKey(), mood: 3, sleepHours: 10, appetite: "ok" };
  const save = (patch: Partial<Checkin>) => void col.upsert({ ...cur, ...patch });

  return (
    <div className={`${cardCls} p-6 space-y-4`}>
      <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--arbor-green-ink)" }}>
        <Icon name="favorite" size={14} /> Today&apos;s check-in
      </span>

      <div className="space-y-1.5">
        <span className="text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>Mood</span>
        <div className="flex gap-1.5">
          {MOODS.map((m, i) => (
            <button
              key={i}
              onClick={() => save({ mood: i + 1 })}
              aria-label={`Mood ${i + 1}`}
              className="flex-1 py-2 rounded-xl text-xl transition"
              style={cur.mood === i + 1 ? { background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.40)" } : { background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: "var(--arbor-muted)" }}><Icon name="bedtime" size={12} /> Sleep: <span style={{ color: "var(--arbor-green-ink)" }}>{cur.sleepHours}h</span></span>
          <input type="range" min={4} max={16} value={cur.sleepHours} onChange={(e) => save({ sleepHours: parseInt(e.target.value) })} className="w-full" style={{ accentColor: "var(--arbor-clay)" }} />
        </div>
        <div className="space-y-1">
          <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: "var(--arbor-muted)" }}><Icon name="restaurant" size={12} /> Appetite</span>
          <div className="flex gap-1">
            {(["good", "ok", "poor"] as const).map((a) => (
              <button
                key={a}
                onClick={() => save({ appetite: a })}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-bold capitalize transition"
                style={cur.appetite === a ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.40)" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="text-[10px]" style={{ color: "var(--arbor-muted)" }}>{today ? "Saved for today." : "Tap to log — feeds your pattern insights over time."}</p>
    </div>
  );
}
