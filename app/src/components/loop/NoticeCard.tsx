import React, { useState } from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import type { Milestone } from "../../types";
import { milestoneText } from "../../lib/milestoneData";
import { milestoneAgeLine } from "../../lib/milestoneAgeLine";
import { shelfLabel, type ShelfId } from "../../lib/shelves/registry";
import { OBSERVED_WHEN, type ObserveStatus, type ObservedWhen } from "../../lib/milestones/observe";
import { ShelfGlyph } from "./ShelfGlyph";

/** Where the card is in its short life: asking · seen (When + keep) · thanked (not yet / not sure) · kept. */
export type NoticePhase = "ask" | "seen" | "thanked" | "kept";

/** The answer label keys, in display order ("Seen it" leads). */
export const NOTICE_ANSWER_KEYS: Readonly<Record<ObserveStatus, string>> = {
  yes: "elev.loop.notice.seen",
  not_yet: "ms.observe.notYet",
  not_sure: "ms.observe.notSure",
};
const ANSWERS: readonly ObserveStatus[] = ["yes", "not_yet", "not_sure"];

export interface NoticeCardProps {
  milestone: Milestone;
  shelf: ShelfId;
  /** The child's profile gender — the catalogue's Hebrew slash forms resolve from it. */
  gender?: string | null;
  /** Writes through the one seam (setMilestoneObservation → lib/milestones/observe). */
  onAnswer: (status: ObserveStatus) => void;
  /** "When?" after "Seen it" — re-writes the same "yes" with `observedWhen`. */
  onWhen?: (when: ObservedWhen) => void;
  /** "Keep a moment?" — the one-line quote (a keepsake on this milestone). */
  onKeepQuote?: (text: string) => void;
  /** "Add a photo" — opens the existing capture sheet. */
  onKeepPhoto?: () => void;
  /** Critic r3 (P1): "Undo" where the answer was given — the caller writes
   *  back the document it held BEFORE the answer (byte-equal), the card asks
   *  again. A mis-tap never travels silently into the clinician packet. */
  onUndo?: () => void;
  /** "row" sits inside a parent card (Today); "card" is its own card (Milestones, Journal). */
  variant?: "row" | "card";
  /** Start phase (tests render each phase statically). */
  initialPhase?: NoticePhase;
  /** Marks the answers as the surface's primary move (Law 7 stamp). */
  stampMove?: string;
}

/**
 * B-LOOP-04 — one milestone worth noticing, in the parent register: the
 * milestone's title (display face), what it looks like (body), the ONE
 * sourced age line (`milestoneAgeLine`, muted, or nothing) and three 44 px
 * answers in one row. "Seen it" opens an inline strip (no modal): When? and
 * Keep a moment?. "Not yet" / "Not sure" thank in one neutral line; the
 * caller does not offer that shelf again today (no chasing).
 *
 * FIREWALL: no count, no colour verdict, no "behind", no comparison; the
 * age line is the source's own sentence and is identical whatever the
 * answer. Logical properties only (ms/me/ps/pe/start/end).
 */
export default function NoticeCard({
  milestone,
  shelf,
  gender,
  onAnswer,
  onWhen,
  onKeepQuote,
  onKeepPhoto,
  onUndo,
  variant = "card",
  initialPhase = "ask",
  stampMove,
}: NoticeCardProps) {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<NoticePhase>(initialPhase);
  const [when, setWhen] = useState<ObservedWhen>("today");
  const [quote, setQuote] = useState("");

  const g = { gender: gender ?? null };
  const title = milestoneText(milestone, "title", t, g);
  const looks = milestoneText(milestone, "looks", t, g) || milestoneText(milestone, "desc", t, g);
  const ageLine = milestoneAgeLine(milestone, t);
  const shelfName = shelfLabel(shelf, t);

  const answer = (status: ObserveStatus) => {
    onAnswer(status);
    setPhase(status === "yes" ? "seen" : "thanked");
  };
  const undo = () => {
    onUndo?.();
    setWhen("today");
    setPhase("ask");
  };
  const pickWhen = (w: ObservedWhen) => {
    setWhen(w);
    onWhen?.(w);
  };
  const keep = () => {
    const text = quote.trim();
    if (!text) return;
    onKeepQuote?.(text);
    setPhase("kept");
  };

  const frame =
    variant === "card"
      ? { className: "rounded-[18px] p-4", style: { background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" } }
      : { className: "py-3", style: {} };

  return (
    <article
      data-testid="notice-card"
      data-milestone-id={milestone.id}
      data-shelf={shelf}
      data-phase={phase}
      aria-label={t("elev.loop.notice.aria")}
      className={frame.className}
      style={frame.style}
    >
      <div className="flex items-start gap-3">
        <ShelfGlyph shelf={shelf} size={36} />
        <div className="min-w-0 flex-1">
          <p data-testid="notice-shelf" className="text-[12.5px] font-semibold" style={{ color: "var(--arbor-muted)" }}>
            {shelfName}
          </p>
          <h3
            data-testid="notice-title"
            className="mt-0.5 font-semibold leading-tight"
            style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)", fontSize: "var(--t-lg)" }}
          >
            {title}
          </h3>
          {looks && (
            <p data-testid="notice-looks" className="mt-1 text-[14px] leading-snug" style={{ color: "var(--arbor-ink-soft)" }}>
              {looks}
            </p>
          )}
          {ageLine && (
            <p data-testid="notice-age-line" className="mt-1.5 flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--arbor-muted)" }}>
              <Icon name="menu_book" size={14} />
              <span data-testid="notice-age-text">{ageLine}</span>
            </p>
          )}

          {phase === "ask" && (
            <div
              role="group"
              aria-label={t("ms.observePrompt")}
              data-testid="notice-answers"
              {...(stampMove ? { "data-primary-move": stampMove } : {})}
              className="mt-3 flex flex-wrap gap-2"
            >
              {ANSWERS.map((status) => {
                const seen = status === "yes";
                return (
                  <button
                    key={status}
                    type="button"
                    data-answer={status}
                    onClick={() => answer(status)}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-4 text-[14px] font-semibold transition active:scale-[0.98]"
                    style={
                      seen
                        ? { color: "var(--arbor-clay)", background: "var(--arbor-paper-elevated)", border: "1.5px solid var(--arbor-clay)" }
                        : { color: "var(--arbor-ink)", background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }
                    }
                  >
                    {t(NOTICE_ANSWER_KEYS[status])}
                  </button>
                );
              })}
            </div>
          )}

          {phase === "seen" && (
            <div data-testid="notice-seen-strip" className="mt-3 space-y-3">
              <div className="flex items-center gap-2">
                <p role="status" data-testid="notice-receipt" className="flex min-w-0 items-center gap-1.5 text-[13px]" style={{ color: "var(--arbor-muted)" }}>
                  <Icon name="check" size={16} />
                  {t("elev.loop.notice.seenReceipt", { shelf: shelfName })}
                </p>
              {onUndo && (
                <button
                  type="button"
                  data-testid="notice-undo"
                  onClick={undo}
                  className="ms-auto inline-flex min-h-[44px] items-center rounded-full px-3 text-[13px] font-semibold"
                  style={{ color: "var(--arbor-clay)" }}
                >
                  {t("elev.loop.notice.undo")}
                </button>
              )}
              </div>
              <div role="group" aria-label={t("elev.loop.notice.when")} data-testid="notice-when">
                <p className="text-[13px] font-semibold" style={{ color: "var(--arbor-ink)" }}>{t("elev.loop.notice.when")}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {OBSERVED_WHEN.map((w) => {
                    const on = w === when;
                    return (
                      <button
                        key={w}
                        type="button"
                        data-when={w}
                        aria-pressed={on}
                        onClick={() => pickWhen(w)}
                        className="inline-flex min-h-[44px] items-center rounded-full px-4 text-[14px] font-semibold"
                        style={{
                          color: on ? "var(--arbor-clay)" : "var(--arbor-ink)",
                          background: on ? "var(--arbor-clay-soft)" : "var(--arbor-paper-deep)",
                          border: `1px solid ${on ? "var(--arbor-clay)" : "var(--arbor-rule-strong)"}`,
                        }}
                      >
                        {t(`elev.loop.notice.when.${w}`)}
                      </button>
                    );
                  })}
                </div>
              </div>
              {(onKeepQuote || onKeepPhoto) && (
                <div data-testid="notice-keep">
                  <p className="text-[13px] font-semibold" style={{ color: "var(--arbor-ink)" }}>{t("elev.loop.notice.keep")}</p>
                  {onKeepQuote && (
                    <form
                      className="mt-1.5 flex items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        keep();
                      }}
                    >
                      <input
                        type="text"
                        dir="auto"
                        value={quote}
                        maxLength={200}
                        onChange={(e) => setQuote(e.target.value)}
                        placeholder={t("elev.loop.notice.keep.placeholder")}
                        aria-label={t("elev.loop.notice.keep")}
                        data-testid="notice-keep-quote"
                        className="min-h-[44px] min-w-0 flex-1 rounded-xl px-3 text-[14px]"
                        style={{ background: "var(--arbor-paper)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
                      />
                      <button
                        type="submit"
                        disabled={!quote.trim()}
                        className="inline-flex min-h-[44px] items-center rounded-full px-4 text-[14px] font-semibold disabled:opacity-60"
                        style={{ color: "var(--arbor-ink)", background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }}
                      >
                        {t("elev.loop.notice.keep.save")}
                      </button>
                    </form>
                  )}
                  {onKeepPhoto && (
                    <button
                      type="button"
                      data-testid="notice-keep-photo"
                      onClick={onKeepPhoto}
                      className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-1 text-[14px] font-semibold"
                      style={{ color: "var(--arbor-clay)" }}
                    >
                      <Icon name="photo_camera" size={18} />
                      {t("elev.loop.notice.keep.photo")}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {phase === "thanked" && (
            <div className="mt-3 flex items-center gap-2">
              <p role="status" data-testid="notice-thanks" className="min-w-0 text-[13px] leading-snug" style={{ color: "var(--arbor-muted)" }}>
                {t("elev.loop.notice.thanks")}
              </p>
              {onUndo && (
                <button
                  type="button"
                  data-testid="notice-undo"
                  onClick={undo}
                  className="ms-auto inline-flex min-h-[44px] items-center rounded-full px-3 text-[13px] font-semibold"
                  style={{ color: "var(--arbor-clay)" }}
                >
                  {t("elev.loop.notice.undo")}
                </button>
              )}
            </div>
          )}

          {phase === "kept" && (
            <p role="status" data-testid="notice-kept" className="mt-3 flex items-center gap-1.5 text-[13px]" style={{ color: "var(--arbor-muted)" }}>
              <Icon name="check" size={16} />
              {t("elev.loop.notice.keptReceipt")}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
