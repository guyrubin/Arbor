import React, { useRef } from "react";
import { useLanguage } from "../../context/LanguageContext";
import type { ObserveStatus } from "../../lib/milestones/observe";
import { NOTICE_ANSWER_KEYS, NOTICE_ANSWER_ORDER } from "../loop/NoticeCard";

/**
 * B-DESIGN-02 (P7-DESIGN framer decision, 7 Oct — the one element taken from
 * Option B's answers; DESIGN.md §Components) — Seen it / Not yet / Not sure as
 * ONE segmented control: a deep-well track (--arbor-paper-deep, --r-lg) holding
 * three equal 44 px cells (--r = outer radius minus the 4 px track padding).
 * "Seen it" alone is outlined in sapphire; "Not yet" / "Not sure" are plain and
 * equal; the stored answer (`selected`) takes the same pressed treatment for
 * all three — a state mark, never a colour verdict.
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
        const seen = status === "yes";
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
            className={cellBase}
            style={{
              borderRadius: "var(--r)",
              ...(on
                ? { color: "var(--arbor-clay)", background: "var(--arbor-clay-soft)", boxShadow: "inset 0 0 0 1.5px var(--arbor-clay)" }
                : seen
                  ? { color: "var(--arbor-clay)", background: "var(--arbor-paper-elevated)", boxShadow: "inset 0 0 0 1.5px var(--arbor-clay)" }
                  : { color: "var(--arbor-ink)", background: "transparent" }),
            }}
          >
            {t(NOTICE_ANSWER_KEYS[status])}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedAnswers;
