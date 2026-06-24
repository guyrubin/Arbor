import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import type { SessionLength } from "../../playbank/select";

/**
 * CI-31: Session-length chip row.
 *
 * A three-pill selector (Short / Standard / Extended) that signals the parent's
 * available time budget. Selection is persisted in localStorage per-child by
 * the parent component. No child-data write, no network call — purely additive
 * local state.
 *
 * Accessibility: role="group" + aria-label on the container, aria-pressed on
 * each pill. Min tap target ≥ 44px (py-3 on mobile, py-2 on md+).
 * RTL: handled by dir=rtl on the html element — no manual flex-row-reverse.
 */

interface SessionLengthChipsProps {
  value: SessionLength;
  onChange: (v: SessionLength) => void;
  /** Optional: rhythm calmWindow hint time string (e.g. "10am"). Shown only
   *  when the chip has not been tapped this session. */
  rhythmHintTime?: string;
  /** True once the parent has tapped a chip this session — hides the hint. */
  tapped: boolean;
}

const CHIPS: { id: SessionLength; labelKey: string }[] = [
  { id: "short",    labelKey: "play.session.short" },
  { id: "standard", labelKey: "play.session.standard" },
  { id: "extended", labelKey: "play.session.extended" },
];

export default function SessionLengthChips({
  value,
  onChange,
  rhythmHintTime,
  tapped,
}: SessionLengthChipsProps) {
  const { t } = useLanguage();

  return (
    <div className="mt-4">
      {/* Eyebrow label */}
      <p
        className="text-[11px] font-extrabold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--arbor-muted)" }}
      >
        {t("play.session.eyebrow")}
      </p>

      {/* Chip row */}
      <div
        role="group"
        aria-label={t("play.session.eyebrow")}
        className="flex flex-wrap gap-2"
      >
        {CHIPS.map(({ id, labelKey }) => {
          const active = value === id;
          return (
            <button
              key={id}
              aria-pressed={active}
              onClick={() => onChange(id)}
              className="rounded-full px-3.5 py-3 md:py-2 text-[12.5px] font-bold whitespace-nowrap transition active:scale-[0.98]"
              style={
                active
                  ? {
                      background: "var(--arbor-green-soft)",
                      color: "var(--arbor-green-ink)",
                      border: "1px solid var(--arbor-clay-border)",
                      boxShadow: "var(--shadow-xs)",
                    }
                  : {
                      background: "var(--arbor-paper-deep)",
                      color: "var(--arbor-muted)",
                      border: "1px solid var(--arbor-rule)",
                    }
              }
            >
              {t(labelKey)}
            </button>
          );
        })}
      </div>

      {/* Rhythm hint — visible only when calmWindow exists and chip not yet tapped */}
      {rhythmHintTime && !tapped && (
        <p
          className="mt-2 text-[12px]"
          style={{ color: "var(--arbor-faint)", fontWeight: 400 }}
        >
          {t("play.session.hint", { time: rhythmHintTime })}
        </p>
      )}
    </div>
  );
}
