import React, { useMemo } from "react";
import { HeartPulse, Moon, Utensils } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useChildCollection } from "../../hooks/useChildCollection";

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
    <div className="bg-[#141821] border border-white/10 rounded-3xl p-6 space-y-4">
      <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider flex items-center gap-1.5">
        <HeartPulse className="w-3.5 h-3.5 text-[#d7aa55]" /> Today&apos;s check-in
      </span>

      <div className="space-y-1.5">
        <span className="text-[11px] text-[#a8a093] font-bold">Mood</span>
        <div className="flex gap-1.5">
          {MOODS.map((m, i) => (
            <button
              key={i}
              onClick={() => save({ mood: i + 1 })}
              aria-label={`Mood ${i + 1}`}
              className={`flex-1 py-2 rounded-xl text-xl border transition ${cur.mood === i + 1 ? "bg-[#d7aa55]/15 border-[#d7aa55]/40" : "bg-white/[0.02] border-white/5 hover:bg-white/5"}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <span className="text-[11px] text-[#a8a093] font-bold flex items-center gap-1"><Moon className="w-3 h-3" /> Sleep: <span className="text-[#f4d991]">{cur.sleepHours}h</span></span>
          <input type="range" min={4} max={16} value={cur.sleepHours} onChange={(e) => save({ sleepHours: parseInt(e.target.value) })} className="w-full accent-[#d7aa55]" />
        </div>
        <div className="space-y-1">
          <span className="text-[11px] text-[#a8a093] font-bold flex items-center gap-1"><Utensils className="w-3 h-3" /> Appetite</span>
          <div className="flex gap-1">
            {(["good", "ok", "poor"] as const).map((a) => (
              <button
                key={a}
                onClick={() => save({ appetite: a })}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold capitalize border transition ${cur.appetite === a ? "bg-[#d7aa55]/15 text-[#f4d991] border-[#d7aa55]/40" : "bg-white/[0.02] text-[#a8a093] border-white/5"}`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="text-[10px] text-[#a8a093]">{today ? "Saved for today." : "Tap to log — feeds your pattern insights over time."}</p>
    </div>
  );
}
