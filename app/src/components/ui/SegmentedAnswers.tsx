import React, { useRef } from "react";
import { useLanguage } from "../../context/LanguageContext";
import type { ObserveStatus } from "../../lib/milestones/observe";
import { NOTICE_ANSWER_KEYS, NOTICE_ANSWER_ORDER } from "../loop/NoticeCard";
import { Icon } from "./Icon";

/**
 * B-DESIGN-02 (P7-DESIGN framer decision, 7 Oct — the one element taken from
 * Option B's answers; DESIGN.md §Components) — Seen it / Not yet / Not sure as
 * ONE segmented control: a deep-well track (--arbor-paper-deep, --r-lg) holding
 * three equal 44 px cells (--r = outer radius minus the 4 px track padding).
 * P7-DESIGN fix r1 (framer ruling R1, 8 Oct): the resting state is NEUTRAL —
 * three equal plain cells, so no answer reads as pre-selected; the stored
 * answer (`selected`) is the pressed cell — --arbor-clay fill, on-accent label,
 * a leading check glyph — the same treatment for all three (a state mark,
 * never a colour verdict), so an answered card reads MORE present than an
 * unanswered one.
 *
 * Drop-in for loop/NoticeCard's NoticeAnswers (same props, same keys and order,
 * `attrs` on the group for the primary-move stamp). Keyboard: Tab reaches each
 * cell; Arrow keys move along the row in reading order (mirrored in Hebrew),
 * Home / End jump to the ends. Not mounted yet (B-DESIGN-03/04).
 */

/** The cell a key moves focus to, or null when the key is not a move. */
export function segmentStep(index: number, key: string, rtl: boolean, count: number): number | null {
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  const forward = rtl ? "ArrowLeft" : "ArrowRight";
  const back = rtl ? "ArrowRight" : "ArrowLeft";
  if (key === forward) return (index + 1) % count;
  if (key === back) return (index - 1 + count) % count;
  return null;
}

const cellBase = "inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-2 t-base font-semibold transition active:scale-[0.98]";

export function SegmentedAnswers({
  onAnswer,
  selected,
  ariaLabel,
  attrs,
  className = "mt-3",
}: {
  onAnswer: (status: ObserveStatus) => void;
  selected?: ObserveStatus | null;
  ariaLabel: string;
  attrs?: Record<string, string>;
  className?: string;
}) {
  const { t, uiLang } = useLanguage();
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (index: number) => (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const next = segmentStep(index, e.key, uiLang === "he", NOTICE_ANSWER_ORDER.length);
    if (next === null) return;
    e.preventDefault();
    cells.current[next]?.focus();
  };
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      data-testid="segmented-answers"
      {...(attrs ?? {})}
      className={`${className} grid grid-cols-3 gap-1 p-1`}
      style={{ background: "var(--arbor-paper-deep)", borderRadius: "var(--r-lg)" }}
    >
      {NOTICE_ANSWER_ORDER.map((status, i) => {
        const on = selected === status;
        return (
          <button
            key={status}
            ref={(el) => {
              cells.current[i] = el;
            }}
            type="button"
            data-answer={status}
            {...(selected !== undefined ? { "aria-pressed": on } : {})}
            onClick={() => onAnswer(status)}
            onKeyDown={onKeyDown(i)}
            className={`${cellBase} gap-1`}
            style={{
              borderRadius: "var(--r)",
              ...(on
                ? { color: "var(--arbor-on-accent)", background: "var(--arbor-clay)" }
                : { color: "var(--arbor-ink)", background: "transparent" }),
            }}
          >
            {on && <Icon name="check" size={16} weight={600} />}
            {t(NOTICE_ANSWER_KEYS[status])}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedAnswers;
