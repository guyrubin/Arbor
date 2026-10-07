import React, { useState } from "react";
import { Icon } from "../ui/Icon";
import { FreeText } from "../ui/FreeText";
import { useLanguage } from "../../context/LanguageContext";
import type { Milestone } from "../../types";
import { milestoneText } from "../../lib/milestoneData";
import { milestoneAgeLine } from "../../lib/milestoneAgeLine";
import { resolveHebrewSlash } from "../../lib/hebrewSlashGender";
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
/** ONE answer order on every loop surface (P5 critic r1 P1-2): yes · not_yet · not_sure. */
export const NOTICE_ANSWER_ORDER: readonly ObserveStatus[] = ["yes", "not_yet", "not_sure"];

const pill = "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-4 t-base font-semibold";

/**
 * The ONE answer group of the loop (Notice card, the Milestones door rows,
 * the latest card's "Change"): three 44 px pills, "Seen it" alone outlined in
 * sapphire, "Not yet" / "Not sure" pale and equal. `selected` marks the stored
 * answer (aria-pressed); `attrs` carries the route's primary-move stamp onto
 * the answers themselves, never a wrapper.
 */
export function NoticeAnswers({
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
  const { t } = useLanguage();
  return (
    <div role="group" aria-label={ariaLabel} data-testid="notice-answers" {...(attrs ?? {})} className={`${className} flex flex-wrap gap-2`}>
      {NOTICE_ANSWER_ORDER.map((status) => {
        const seen = status === "yes";
        const on = selected === status;
        return (
          <button
            key={status}
            type="button"
            data-answer={status}
            {...(selected !== undefined ? { "aria-pressed": on } : {})}
            onClick={() => onAnswer(status)}
            className={`${pill} transition active:scale-[0.98]`}
            style={
              on
                ? { color: "var(--arbor-clay)", background: "var(--arbor-clay-soft)", border: "1.5px solid var(--arbor-clay)" }
                : seen
                  ? { color: "var(--arbor-clay)", background: "var(--arbor-paper-elevated)", border: "1.5px solid var(--arbor-clay)" }
                  : { color: "var(--arbor-ink)", background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }
            }
          >
            {t(NOTICE_ANSWER_KEYS[status])}
          </button>
        );
      })}
    </div>
  );
}

export interface NoticeCardProps {
  milestone: Milestone;
  shelf: ShelfId;
  /** The child's profile gender — the catalogue's Hebrew slash forms resolve from it. */
  gender?: string | null;
  /** The child's first name — the receipts name the child (critic r1). */
  childName?: string;
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
  /** P5 critic r2 (P1-1): a door / search row shows the answer already given
   *  (the same pills, the chosen one marked); a new tap re-answers it. */
  selected?: ObserveStatus | null;
  /** "row" sits inside a parent card (Today, the shelf map); "card" is its own card. */
  variant?: "row" | "card";
  /** The host already names the shelf (the shelf map's section header): no eyebrow. */
  hideShelf?: boolean;
  /** Start phase (tests render each phase statically). */
  initialPhase?: NoticePhase;
  /** Marks the answers as the surface's primary move (Law 7 stamp). */
  stampMove?: string;
  /** Attributes spread on the answers group (a route's own stamp literal). */
  answersAttrs?: Record<string, string>;
  /** P5-LOOP c2 r2 (B-LOOP-NEW-2f): the newest kept line already on this
   *  shelf — the "Seen it" receipt says the answer was filed next to it
   *  (the quote verbatim, editorial, dir=auto; no chip, no number). */
  besideWords?: string | null;
}

/**
 * B-LOOP-04 — one milestone worth noticing, in the parent register: the
 * milestone's title (display face), what it looks like (body), the ONE
 * sourced age line (`milestoneAgeLine`, muted, or nothing) and the three
 * answers. "Seen it" opens an inline strip (no modal): When? and Keep a
 * moment?. "Not yet" / "Not sure" thank in one neutral line; the caller
 * does not offer that shelf again today (no chasing). A kept line comes back
 * on the 2 px ink rule with "Kept in {name}'s story · {date}" — the one green
 * status on the screen.
 *
 * FIREWALL: no count, no colour verdict, no "behind", no comparison; the
 * age line is the source's own sentence and is identical whatever the
 * answer. Logical properties only; the --t-* scale and radius tokens.
 */
export default function NoticeCard({
  milestone,
  shelf,
  gender,
  childName,
  onAnswer,
  onWhen,
  onKeepQuote,
  onKeepPhoto,
  onUndo,
  variant = "card",
  hideShelf = false,
  initialPhase = "ask",
  selected,
  stampMove,
  answersAttrs,
  besideWords,
}: NoticeCardProps) {
  const { t, uiLang } = useLanguage();
  const [phase, setPhase] = useState<NoticePhase>(initialPhase);
  const [when, setWhen] = useState<ObservedWhen>("today");
  const [quote, setQuote] = useState("");
  const [kept, setKept] = useState("");

  const g = { gender: gender ?? null };
  const title = milestoneText(milestone, "title", t, g);
  const looks = milestoneText(milestone, "looks", t, g) || milestoneText(milestone, "desc", t, g);
  const ageLine = milestoneAgeLine(milestone, t);
  const shelfName = shelfLabel(shelf, t);
  const name = childName || t("today.record.childFallback");
  const he = (s: string) => (uiLang === "he" ? resolveHebrewSlash(s, gender) : s);
  const today = new Date().toLocaleDateString(uiLang === "he" ? "he-IL" : "en-GB", { day: "numeric", month: "short" });

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
    setKept(text);
    setPhase("kept");
  };
  const undoButton = onUndo ? (
    <button type="button" data-testid="notice-undo" onClick={undo} className="ms-auto inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-3 t-sm font-semibold" style={{ color: "var(--arbor-clay)" }}>
      {t("elev.loop.notice.undo")}
    </button>
  ) : null;

  const frame =
    variant === "card"
      ? { className: "rounded-2xl p-4", style: { background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" } }
      : { className: "py-3", style: {} };
  const stamp = stampMove ? { "data-primary-move": stampMove } : {};

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
        {!hideShelf && <ShelfGlyph shelf={shelf} size={36} />}
        <div className="min-w-0 flex-1">
          {!hideShelf && (
            <p data-testid="notice-shelf" className="t-sm font-semibold" style={{ color: "var(--arbor-muted)" }}>
              {shelfName}
            </p>
          )}
          <h3
            data-testid="notice-title"
            className="mt-0.5 font-semibold leading-tight"
            style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)", fontSize: "var(--t-lg)" }}
          >
            {title}
          </h3>
          {looks && (
            <p data-testid="notice-looks" className="mt-1 t-base leading-snug" style={{ color: "var(--arbor-ink-soft)" }}>
              {looks}
            </p>
          )}
          {ageLine && (
            <p data-testid="notice-age-line" className="mt-1.5 flex items-center gap-1.5 t-sm" style={{ color: "var(--arbor-muted)" }}>
              <Icon name="menu_book" size={14} />
              <span data-testid="notice-age-text">{ageLine}</span>
            </p>
          )}

          {phase === "ask" && (
            <NoticeAnswers onAnswer={answer} selected={selected} ariaLabel={t("ms.observePrompt")} attrs={{ ...stamp, ...(answersAttrs ?? {}) }} />
          )}

          {phase === "seen" && (
            <div data-testid="notice-seen-strip" className="mt-3 space-y-3">
              <div className="flex items-center gap-2">
                {besideWords?.trim() ? (
                  <p role="status" data-testid="notice-receipt" data-beside="true" className="min-w-0 t-sm leading-snug" style={{ color: "var(--arbor-ink-soft)" }}>
                    <Icon name="check" size={16} className="me-1 inline-block align-[-3px]" />
                    {t("elev.loop.notice.seenReceiptBeside", { shelf: shelfName, name })}{" "}
                    <span dir="auto" style={{ fontFamily: "var(--font-editorial)" }}>{"“"}{besideWords.trim()}{"”"}</span>
                  </p>
                ) : (
                  <p role="status" data-testid="notice-receipt" className="flex min-w-0 items-center gap-1.5 t-sm" style={{ color: "var(--arbor-muted)" }}>
                    <Icon name="check" size={16} />
                    {t("elev.loop.notice.seenReceipt", { shelf: shelfName, name })}
                  </p>
                )}
                {undoButton}
              </div>
              <div role="group" aria-label={t("elev.loop.notice.when")} data-testid="notice-when">
                <p className="t-sm font-semibold" style={{ color: "var(--arbor-ink)" }}>{t("elev.loop.notice.when")}</p>
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
                        className="inline-flex min-h-[44px] items-center rounded-full px-4 t-base font-semibold"
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
                  <p className="t-sm font-semibold" style={{ color: "var(--arbor-ink)" }}>{t("elev.loop.notice.keep")}</p>
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
                        className="min-h-[44px] min-w-0 flex-1 rounded-xl px-3 t-base"
                        style={{ background: "var(--arbor-paper)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
                      />
                      <button
                        type="submit"
                        data-testid="notice-keep-save"
                        disabled={!quote.trim()}
                        className="inline-flex min-h-[44px] items-center rounded-full px-4 t-base font-semibold disabled:opacity-60"
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
                      className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-1 t-base font-semibold"
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
              <p role="status" data-testid="notice-thanks" className="min-w-0 t-sm leading-snug" style={{ color: "var(--arbor-muted)" }}>
                {t("elev.loop.notice.thanks")}
              </p>
              {undoButton}
            </div>
          )}

          {phase === "kept" && (
            <figure data-testid="notice-kept" className="mt-3">
              {kept && (
                <blockquote className="border-s-2 ps-3 leading-snug" style={{ borderColor: "var(--arbor-ink)", color: "var(--arbor-ink-soft)", fontFamily: "var(--font-editorial)", fontSize: "var(--t-md)" }}>
                  <FreeText text={`“${kept}”`} />
                </blockquote>
              )}
              <figcaption className="mt-2 flex items-center gap-2">
                <span role="status" data-testid="notice-kept-status" className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 t-sm font-semibold" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
                  <Icon name="check" size={16} />
                  {he(t("elev.loop.notice.keptStory", { name, date: today }))}
                </span>
                {undoButton}
              </figcaption>
            </figure>
          )}
        </div>
      </div>
    </article>
  );
}
