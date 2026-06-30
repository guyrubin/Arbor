import React, { useState } from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { localizeActivity } from "../../playbank/content";
import type { ScoredActivity, SessionLength } from "../../playbank/select";
import { ShareButton } from "../ui/ShareButton";
import type { ShareCardOpts } from "../../lib/shareCard";
import SessionLengthChips from "../practice/SessionLengthChips";

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
  concernLabel,
  goalLabel,
  sessionLength,
  onSessionLengthChange,
  sessionTapped,
  rhythmHintTime,
}: {
  pick: ScoredActivity;
  childName: string;
  done: boolean;
  onDid: (a: ScoredActivity) => void;
  onCoach: (a: ScoredActivity) => void;
  /** Localized domain word driving a concern-match (e.g. "settling big feelings"). */
  concernLabel?: string;
  /** CI-28: label of the active goal that drove this pick (for "because" line). */
  goalLabel?: string;
  /** CI-31: currently selected session length (controls chip row + duration badge). */
  sessionLength?: SessionLength;
  /** CI-31: called when the parent taps a chip. */
  onSessionLengthChange?: (v: SessionLength) => void;
  /** CI-31: true once any chip has been tapped this session (hides rhythm hint). */
  sessionTapped?: boolean;
  /** CI-31: rhythm calmWindow hour label (e.g. "10am") for the hint line. */
  rhythmHintTime?: string;
}) {
  const [open, setOpen] = useState(false);
  const { t, uiLang } = useLanguage();
  const { reason, matchedInterest } = pick;
  const activity = localizeActivity(pick.activity, uiLang);

  // CI-31: duration badge text — shows selected chip range when a chip has been
  // chosen, otherwise falls back to the activity's own durationMin.
  const durationLabel: string = (() => {
    if (!sessionLength) return t("play.min", { n: activity.durationMin });
    if (sessionLength === "short")    return t("play.session.short");
    if (sessionLength === "extended") return t("play.session.extended");
    return t("play.session.standard");
  })();

  // CI-29: interest-match why-line variants (FIX 2: no effect-verb on child capacity;
  // FIX 5: parent-facing "about the child", never kid-companion second-person).
  // Backward compat: concernLabel (live) used when no named interest is available.
  const why =
    reason === "goal-match" && goalLabel
      ? t("play.whyGoal", { goal: goalLabel, name: childName })
      : reason === "interest-match" && matchedInterest
      ? t("play.whyInterestStage", { name: childName, interest: matchedInterest })
      : reason === "concern-match" && matchedInterest
      ? t("play.whyInterestConcern", { name: childName, interest: matchedInterest })
      : reason === "concern-match" && concernLabel
      ? t("play.whyConcernNamed", { area: concernLabel, name: childName })
      : reason === "concern-match"
      ? t("play.whyConcern", { name: childName })
      : t("play.whyStage", { name: childName });

  return (
    <section
      className="rounded-[var(--r-xl)] overflow-hidden"
      style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-sm)" }}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: GREEN }}>
              <Icon name="eco" size={16} /> {t("play.eyebrow")}
            </span>
            <h2 className="text-[1.35rem] font-extrabold leading-tight mt-1" style={{ fontFamily: "var(--font-display)", color: INK, textWrap: "balance" } as React.CSSProperties}>
              {activity.title}
            </h2>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold flex-shrink-0"
            style={{ background: "var(--arbor-paper-deep)", color: MUTED, border: `1px solid ${RULE}` }}>
            <Icon name="schedule" size={14} /> {durationLabel}
          </span>
        </div>

        {/* CI-29: Interest-match chip — only when themeableContextSlot=true AND
            a sanitized interest was matched. Tone=lav per design spec.
            Speaks to the parent about the child (never kid-companion). */}
        {reason === "interest-match" && matchedInterest && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold mt-2"
            style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }}
          >
            <Icon name="favorite" size={14} />
            {t("play.interestMatchChip", { name: childName, interest: matchedInterest })}
          </span>
        )}

        {/* What it builds — the developmental "why", stated plainly */}
        <p className="text-[15px] leading-relaxed mt-3" style={{ color: INK, textWrap: "pretty" } as React.CSSProperties}>
          <span style={{ color: GREEN, fontWeight: 700 }}>{t("play.builds")} </span>{activity.whatItBuilds}
        </p>

        {/* Expert attribution — shown only when a verified source is present.
            Parent-facing; calm-clinical register; mechanism/attribution only (no outcome claims). */}
        {activity.source && (
          <p className="mt-1.5" style={{ fontSize: "var(--t-xs)", color: "var(--arbor-muted)", lineHeight: 1.4 }}>
            Based on{" "}
            <a
              href={activity.source.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--arbor-muted)", textDecorationColor: "var(--arbor-rule-strong)", textUnderlineOffset: "2px" }}
            >
              {activity.source.org}
            </a>
          </p>
        )}

        {/* Household items */}
        <div className="flex flex-wrap gap-1.5 mt-4">
          {activity.householdItems.map((it) => (
            <span key={it} className="rounded-full px-2.5 py-1 text-[12px] font-semibold"
              style={{ background: GREEN_SOFT, color: GREEN }}>
              {it}
            </span>
          ))}
        </div>

        {/* CI-31: Session-length chips — inserted when the card owns the chip row
            (i.e. on the Overview/Today hero card; in DailyPlayTab the row is
            lifted to tab level and NOT rendered here). */}
        {sessionLength && onSessionLengthChange && (
          <SessionLengthChips
            value={sessionLength}
            onChange={onSessionLengthChange}
            rhythmHintTime={rhythmHintTime}
            tapped={sessionTapped ?? false}
          />
        )}

        {/* Steps (collapsible to keep the card calm) */}
        {/* VIS-2: text-only tap area was ~20px tall — add min-h-[44px] + side padding */}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? t("play.hide") : t("play.how")}
          className="inline-flex items-center gap-1 text-[13px] font-bold mt-4 transition min-h-[44px] px-1"
          style={{ color: GREEN }}
        >
          {open ? t("play.hide") : t("play.how")}
          <Icon name="expand_more" size={18} className="transition" style={{ transform: open ? "rotate(180deg)" : "none" }} />
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
        <div className="flex flex-wrap items-center gap-2.5 mt-5" aria-live="polite">
          <button
            onClick={() => onDid(pick)}
            disabled={done}
            aria-label={done ? t("play.added", { name: childName }) : t("play.did")}
            className="inline-flex items-center justify-center gap-2 font-bold text-sm rounded-2xl px-5 py-3 transition active:scale-[0.98] disabled:cursor-default"
            style={done
              ? { background: GREEN_SOFT, color: GREEN }
              : { background: "var(--arbor-gradient-primary)", color: "#fff", boxShadow: "var(--shadow-green)" }}
          >
            <Icon name="check" size={18} /> {done ? t("play.added", { name: childName }) : t("play.did")}
          </button>
          <button
            onClick={() => onCoach(pick)}
            className="inline-flex items-center justify-center gap-2 font-bold text-sm rounded-2xl px-5 py-3 transition"
            style={{ background: GREEN_SOFT, color: GREEN }}
          >
            <Icon name="forum" size={18} /> {t("play.coach")}
          </button>
        </div>

        <p className="text-[12px] mt-3.5" style={{ color: "var(--arbor-faint)" }}>{why}</p>

        {/* Honest, optional share moment — only after a genuine completion. No
            auto-prompt, no streak, no nag; it simply appears and can be ignored. */}
        {done && (
          <div className="mt-3">
            <ShareButton
              artifact="growth_card"
              surface="daily_play"
              childName={childName}
              label={t("play.shareWin", { name: childName })}
              getCardOpts={(): ShareCardOpts => ({
                name: childName,
                headline: `${childName} played: ${activity.title}`,
                sub: activity.whatItBuilds,
              })}
            />
          </div>
        )}
      </div>
    </section>
  );
}
