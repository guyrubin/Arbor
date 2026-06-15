import React, { useState } from "react";
import { Sprout, Check, MessageSquare, ChevronDown, Clock } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import type { ScoredActivity } from "../../playbank/select";

/* Daily Play — one stage-appropriate, household-item activity for today,
   matched to what the child has been working through. "Did this" writes a
   small win into the day; "Coach me" hands the activity to Ask Arbor. */

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const GREEN = "var(--arbor-green-ink)";
const GREEN_SOFT = "var(--arbor-green-soft)";
const RULE = "var(--arbor-rule)";

export default function DailyPlayCard({
  pick,
  childName,
  done,
  onDid,
  onCoach,
}: {
  pick: ScoredActivity;
  childName: string;
  done: boolean;
  onDid: (a: ScoredActivity) => void;
  onCoach: (a: ScoredActivity) => void;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  const { activity, reason } = pick;

  const why =
    reason === "concern-match"
      ? t("play.whyConcern", { name: childName })
      : t("play.whyStage", { name: childName });

  return (
    <section
      className="rounded-[22px] overflow-hidden"
      style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-sm)" }}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: GREEN }}>
              <Sprout className="w-3.5 h-3.5" /> {t("play.eyebrow")}
            </span>
            <h2 className="text-[1.35rem] font-extrabold leading-tight mt-1" style={{ fontFamily: "var(--font-display)", color: INK, textWrap: "balance" } as React.CSSProperties}>
              {activity.title}
            </h2>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold flex-shrink-0"
            style={{ background: "var(--arbor-paper-deep)", color: MUTED, border: `1px solid ${RULE}` }}>
            <Clock className="w-3 h-3" /> {t("play.min", { n: activity.durationMin })}
          </span>
        </div>

        {/* What it builds — the developmental "why", stated plainly */}
        <p className="text-[15px] leading-relaxed mt-3" style={{ color: INK, textWrap: "pretty" } as React.CSSProperties}>
          <span style={{ color: GREEN, fontWeight: 700 }}>{t("play.builds")} </span>{activity.whatItBuilds}
        </p>

        {/* Household items */}
        <div className="flex flex-wrap gap-1.5 mt-4">
          {activity.householdItems.map((it) => (
            <span key={it} className="rounded-full px-2.5 py-1 text-[12px] font-semibold"
              style={{ background: GREEN_SOFT, color: GREEN }}>
              {it}
            </span>
          ))}
        </div>

        {/* Steps (collapsible to keep the card calm) */}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 text-[13px] font-bold mt-4 transition"
          style={{ color: GREEN }}
        >
          {open ? t("play.hide") : t("play.how")}
          <ChevronDown className="w-4 h-4 transition" style={{ transform: open ? "rotate(180deg)" : "none" }} />
        </button>
        {open && (
          <ol className="mt-3 space-y-2.5">
            {activity.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-[14px] leading-relaxed" style={{ color: INK }}>
                <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-extrabold"
                  style={{ background: GREEN_SOFT, color: GREEN }}>{i + 1}</span>
                <span style={{ textWrap: "pretty" } as React.CSSProperties}>{s}</span>
              </li>
            ))}
          </ol>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2.5 mt-5">
          <button
            onClick={() => onDid(pick)}
            disabled={done}
            className="inline-flex items-center justify-center gap-2 font-bold text-sm rounded-2xl px-5 py-3 transition active:scale-[0.98] disabled:cursor-default"
            style={done
              ? { background: GREEN_SOFT, color: GREEN }
              : { background: "linear-gradient(135deg,#3cc081,var(--arbor-clay) 60%,var(--arbor-clay-deep))", color: "#fff", boxShadow: "var(--shadow-green)" }}
          >
            <Check className="w-4 h-4" /> {done ? t("play.added", { name: childName }) : t("play.did")}
          </button>
          <button
            onClick={() => onCoach(pick)}
            className="inline-flex items-center justify-center gap-2 font-bold text-sm rounded-2xl px-5 py-3 transition"
            style={{ background: GREEN_SOFT, color: GREEN }}
          >
            <MessageSquare className="w-4 h-4" /> {t("play.coach")}
          </button>
        </div>

        <p className="text-[12px] mt-3.5" style={{ color: "var(--arbor-faint)" }}>{why}</p>
      </div>
    </section>
  );
}
