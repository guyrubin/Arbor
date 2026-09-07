import React, { useMemo } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { cardCls } from "../ui/kit";

type Checkin = { id: string; date: string; mood: number; sleepHours: number; appetite: "good" | "ok" | "poor" };

const todayKey = () => new Date().toISOString().slice(0, 10);
const MOODS = ["😢", "🙁", "😐", "🙂", "😄"];

/** Lightweight daily sleep / mood / appetite tracker inside Today's tools drawer.
 *
 *  TJB-23: this card had no `useLanguage` at all — every label, every appetite
 *  chip and the footer rendered English inside the Hebrew app. All copy now
 *  resolves through `elev.checkin.*` (lib/i18nElevation/foundation.ts, EN + HE).
 *
 *  The footer line changed meaning, deliberately: it used to promise "feeds
 *  your pattern insights over time", and nothing in `src/` reads the `wellness`
 *  collection this card writes (it appears only in the childData export
 *  allow-list). Transcreating that sentence would have shipped the claim into a
 *  second language. It now says what is true — the entry is kept against
 *  today's date. The card's own fate is the open M4.7 decision (FOLLOW-UPS).
 */
export default function DailyCheckinCard() {
  const { childProfile } = useArbor();
  const { t } = useLanguage();
  const col = useChildCollection<Checkin>(childProfile.id, "wellness");
  const today = useMemo(() => col.items.find((c) => c.id === todayKey()), [col.items]);

  const cur: Checkin = today || { id: todayKey(), date: todayKey(), mood: 3, sleepHours: 10, appetite: "ok" };
  const save = (patch: Partial<Checkin>) => void col.upsert({ ...cur, ...patch });

  return (
    <div className={`${cardCls} p-6 space-y-4`} data-testid="daily-checkin-card">
      <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--arbor-green-ink)" }}>
        <Icon name="favorite" size={14} /> {t("elev.checkin.title")}
      </span>

      <div className="space-y-1.5">
        <span className="text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>{t("elev.checkin.mood")}</span>
        <div className="flex gap-1.5">
          {MOODS.map((m, i) => (
            <button
              key={i}
              onClick={() => save({ mood: i + 1 })}
              aria-label={t("elev.checkin.moodAria", { n: i + 1 })}
              className="flex-1 min-h-11 py-2 rounded-xl text-xl transition"
              style={cur.mood === i + 1 ? { background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.40)" } : { background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: "var(--arbor-muted)" }}>
            <Icon name="bedtime" size={12} /> {t("elev.checkin.sleep")}{" "}
            <span style={{ color: "var(--arbor-green-ink)" }}>{t("elev.checkin.sleepValue", { n: cur.sleepHours })}</span>
          </span>
          <input
            type="range"
            min={4}
            max={16}
            value={cur.sleepHours}
            onChange={(e) => save({ sleepHours: parseInt(e.target.value) })}
            aria-label={t("elev.checkin.sleepAria", { n: cur.sleepHours })}
            aria-valuetext={t("elev.checkin.sleepValue", { n: cur.sleepHours })}
            className="w-full"
            style={{ accentColor: "var(--arbor-clay)" }}
          />
        </div>
        <div className="space-y-1">
          <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: "var(--arbor-muted)" }}><Icon name="restaurant" size={12} /> {t("elev.checkin.appetite")}</span>
          <div className="flex gap-1">
            {(["good", "ok", "poor"] as const).map((a) => (
              <button
                key={a}
                onClick={() => save({ appetite: a })}
                aria-pressed={cur.appetite === a}
                className="flex-1 min-h-11 py-1.5 rounded-lg text-[10px] font-bold transition"
                style={cur.appetite === a ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.40)" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
              >
                {t(`elev.checkin.appetite.${a}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="text-[10px]" style={{ color: "var(--arbor-muted)" }} data-testid="daily-checkin-footer">
        {today ? t("elev.checkin.saved") : t("elev.checkin.hint")}
      </p>
    </div>
  );
}
