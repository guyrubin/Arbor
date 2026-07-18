/**
 * AP-059 — Weekly Missions Calendar Strip
 *
 * A 7-day per-day mission-progress strip rendered at the TOP of the
 * child-facing Learning Studio (PracticeHubTab). Keyed to existing
 * MissionRecord data from usePracticeData — no new write path.
 *
 * Design rules:
 *   - TOKEN-ONLY styling: every color via var(--arbor-*). Zero raw hex.
 *   - RTL: logical CSS properties throughout (marginInlineStart, etc.).
 *     The 7-day slot order is calendar-order (Mon→Sun or oldest→today in
 *     LTR/RTL both) — we use flex with no forced direction override so the
 *     browser mirrors the strip under dir=rtl automatically.
 *   - DISTINCT from the daily-goal ring: this is a weekly cadence strip
 *     (7 day slots), not an animated circular progress ring.
 *   - Child-facing playful register: large touch targets (≥44px), rounded,
 *     emoji-enriched day labels.
 *   - Accessible: role=list, role=listitem, aria-label per slot.
 */
import React, { useMemo } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { usePracticeData } from "../../practice/usePracticeData";
import { weeklyStripDays } from "../../practice/signals";
import type { PracticeDomain } from "../../types";

// ── Activity-type → token mapping ──────────────────────────────────────────
// Uses ONLY existing var(--arbor-*) custom properties defined in index.css :root.
// This is the canonical domain→colour map for the weekly strip; it is deliberately
// a TS constant (not a CSS addition) so index.css is not touched.
//
// Convention matches the existing Chip tone assignments in MissionsTab.tsx:
//   speech    → mint/green  (matches tone="mint")
//   language  → sky         (matches tone="sky")
//   cognition → lav         (matches tone="lav")
//   social    → yellow      (matches tone="yellow")
//   emotional → pink        (matches tone="pink")
const DOMAIN_STRIP: Record<PracticeDomain, { soft: string; ink: string; emoji: string }> = {
  speech:    { soft: "var(--arbor-green-soft)", ink: "var(--arbor-green-ink)",  emoji: "🦜" },
  language:  { soft: "var(--arbor-sky-soft)",   ink: "var(--arbor-sky-ink)",    emoji: "🗣️" },
  cognition: { soft: "var(--arbor-lav-soft)",   ink: "var(--arbor-lav-ink)",    emoji: "📖" },
  social:    { soft: "var(--arbor-yellow-soft)",ink: "var(--arbor-yellow-ink)", emoji: "🎲" },
  emotional: { soft: "var(--arbor-pink-soft)",  ink: "var(--arbor-pink-ink)",   emoji: "🕵️" },
};

/** 3-letter weekday label for a YYYY-MM-DD date, in the UI locale. */
function weekdayShort(date: string, lang: string): string {
  try {
    return new Date(`${date}T12:00:00`).toLocaleDateString(lang === "he" ? "he-IL" : "en-US", {
      weekday: "short",
    });
  } catch {
    return date.slice(8); // day number fallback
  }
}

/** Day-of-month number from YYYY-MM-DD. */
function dayOfMonth(date: string): string {
  return String(parseInt(date.slice(8), 10));
}

// ── Component ──────────────────────────────────────────────────────────────

export default function WeeklyMissionsStrip() {
  const { childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const data = usePracticeData(childProfile.id);

  const days = useMemo(
    () => weeklyStripDays(data.missions.items, data.today),
    [data.missions.items, data.today]
  );

  const completedCount = days.filter((d) => d.done).length;

  return (
    <section
      aria-label={t("strip.ariaLabel")}
      style={{
        borderRadius: "var(--r-xl)",
        background: "var(--arbor-paper-elevated)",
        border: "1px solid var(--arbor-rule)",
        boxShadow: "var(--shadow-sm)",
        padding: "16px",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "var(--t-md)",
            color: "var(--arbor-ink)",
            lineHeight: 1.2,
          }}
        >
          {t("strip.title")}
        </span>
        {completedCount > 0 && (
          <span
            style={{
              background: "var(--arbor-green-soft)",
              color: "var(--arbor-green-ink)",
              fontWeight: 800,
              fontSize: "var(--t-xs)",
              borderRadius: "999px",
              paddingInline: "10px",
              paddingBlock: "4px",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
            aria-live="polite"
          >
            {t("strip.countDone", { n: completedCount, total: 7 })}
          </span>
        )}
      </div>

      {/* 7-day strip — flex row; browser mirrors under dir=rtl automatically */}
      <ol
        role="list"
        style={{
          display: "flex",
          gap: "6px",
          listStyle: "none",
          padding: 0,
          margin: 0,
          overflowX: "auto",
          // Hide scrollbar on touch — content is still reachable via touch-scroll
          scrollbarWidth: "none",
        }}
      >
        {days.map((day) => {
          const isToday = day.isToday;
          const done = day.done;
          const token = day.domain ? DOMAIN_STRIP[day.domain] : null;

          // Slot sizing and appearance
          const bg = done && token
            ? token.soft
            : isToday
              ? "var(--arbor-paper-deep)"
              : "var(--arbor-paper-sunk)";
          const borderColor = done && token
            ? token.ink
            : isToday
              ? "var(--arbor-primary)"
              : "var(--arbor-rule-strong)";
          const inkColor = done && token
            ? token.ink
            : isToday
              ? "var(--arbor-green-ink)"
              : "var(--arbor-muted)";

          const ariaLabel = done
            ? t("strip.dayDone", { day: weekdayShort(day.date, uiLang), domain: day.domain ?? "" })
            : isToday
              ? t("strip.dayToday", { day: weekdayShort(day.date, uiLang) })
              : day.isFuture
                ? t("strip.dayFuture", { day: weekdayShort(day.date, uiLang) })
                : t("strip.dayEmpty", { day: weekdayShort(day.date, uiLang) });

          return (
            <li
              key={day.date}
              role="listitem"
              aria-label={ariaLabel}
              style={{
                flex: "1 0 0",
                minWidth: "38px",
                minHeight: "72px",
                borderRadius: "var(--r)",
                background: bg,
                border: `2px solid ${borderColor}`,
                boxShadow: isToday ? "var(--shadow-xs)" : "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "3px",
                padding: "6px 4px",
                transition: "background 200ms, border-color 200ms",
                cursor: "default",
                userSelect: "none",
              }}
            >
              {/* Weekday label */}
              <span
                style={{
                  fontSize: "var(--t-xs)",
                  fontWeight: isToday ? 900 : 700,
                  color: inkColor,
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                }}
                aria-hidden="true"
              >
                {isToday ? t("strip.today") : weekdayShort(day.date, uiLang)}
              </span>

              {/* Day-of-month number */}
              <span
                style={{
                  fontSize: "var(--t-xs)",
                  fontWeight: 700,
                  color: "var(--arbor-muted)",
                  lineHeight: 1,
                }}
                aria-hidden="true"
              >
                {dayOfMonth(day.date)}
              </span>

              {/* Status indicator */}
              {done && token ? (
                // Done ring — the domain emoji inside a soft token-coloured disc
                <span
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: token.ink,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    marginTop: "2px",
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                >
                  ✓
                </span>
              ) : isToday ? (
                // Today highlight dot — clay primary
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "var(--arbor-primary)",
                    marginTop: "4px",
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                />
              ) : (
                // Empty circle — future or past with no data
                <span
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    border: `2px solid ${day.isFuture ? "var(--arbor-rule)" : "var(--arbor-rule-strong)"}`,
                    background: "transparent",
                    marginTop: "2px",
                    flexShrink: 0,
                    opacity: day.isFuture ? 0.45 : 0.6,
                  }}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Colour legend — one chip per domain that appeared this week */}
      {completedCount > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px",
            marginTop: "10px",
          }}
          aria-label={t("strip.legendLabel")}
        >
          {(Object.entries(DOMAIN_STRIP) as [PracticeDomain, typeof DOMAIN_STRIP[PracticeDomain]][])
            .filter(([domain]) => days.some((d) => d.domain === domain))
            .map(([domain, tk]) => (
              <span
                key={domain}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  background: tk.soft,
                  color: tk.ink,
                  fontWeight: 800,
                  fontSize: "var(--t-xs)",
                  borderRadius: "999px",
                  paddingInline: "8px",
                  paddingBlock: "3px",
                  whiteSpace: "nowrap",
                }}
                aria-label={domain}
              >
                <span aria-hidden="true">{tk.emoji}</span>
                {t(`strip.domain.${domain}`)}
              </span>
            ))}
        </div>
      )}
    </section>
  );
}
