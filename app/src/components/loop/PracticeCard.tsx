import React from "react";
import { Icon } from "../ui/Icon";
import { FreeText } from "../ui/FreeText";
import { useLanguage } from "../../context/LanguageContext";
import type { Practice } from "../../content/practices";
import type { Milestone } from "../../types";
import { milestoneText } from "../../lib/milestoneData";
import { resolveHebrewSlash } from "../../lib/hebrewSlashGender";
import { shelfLabel, type ShelfId } from "../../lib/shelves/registry";
import type { PracticeAnswer } from "../../lib/practice/choosePractice";
import { ShelfGlyph } from "./ShelfGlyph";

/** The page-language text of a practice field, Hebrew slash forms resolved
 *  from the child's gender (Law 8). */
export function practiceText(p: Practice, field: "do" | "say" | "materials", lang: "en" | "he", gender?: string | null): string {
  const value = p[field];
  if (!value) return "";
  const text = lang === "he" ? value.he : value.en;
  return lang === "he" ? resolveHebrewSlash(text, gender) : text;
}

export interface PracticeCardProps {
  practice: Practice;
  milestone: Milestone;
  shelf: ShelfId;
  childName?: string;
  gender?: string | null;
  /** Today's dose answer, if given (the card shows its one-line receipt). */
  answered?: PracticeAnswer | null;
  onAnswer: (answer: PracticeAnswer) => void;
  /** Undo the dose row (the card asks again). */
  onUndo?: () => void;
  /** B-LOOP-07: the parent's own words on this shelf, dated — THEN and NOW
   *  (lib/today/shelfWords), oldest first; the change is in their words. */
  quotes?: ReadonlyArray<{ text: string; date?: string }>;
  /** B-LOOP-07: a lifecycle line (birthday, first week) inside the header, never a sibling. */
  headerNote?: string | null;
  /** Law 7: the answers ARE the surface's primary move. */
  stampMove?: string;
}

/**
 * B-LOOP-09 / B-LOOP-07 — Today's practice, the design of record
 * (art/mockups/today-option-1.html): a caption row with the shelf mark,
 * the "do" as the display title, the "say" as the one editorial sentence
 * behind a 2 px navy start rule, one muted meta line, one why-line, and
 * the two answers — solid sapphire "Did it" + pale "Not today". After an
 * answer: ONE line ("Noted. Tonight Arbor asks how it went." / "Tomorrow is
 * fine.") — never a count, a streak or a score. Parent register: flat
 * tints, tokens only, logical properties.
 */
export default function PracticeCard({
  practice,
  milestone,
  shelf,
  childName,
  gender,
  answered,
  onAnswer,
  onUndo,
  quotes,
  headerNote,
  stampMove,
}: PracticeCardProps) {
  const { t, uiLang } = useLanguage();
  const lang: "en" | "he" = uiLang === "he" ? "he" : "en";
  const shelfName = shelfLabel(shelf, t);
  const doText = practiceText(practice, "do", lang, gender);
  const sayText = practiceText(practice, "say", lang, gender);
  const materials = practiceText(practice, "materials", lang, gender);
  const title = milestoneText(milestone, "title", t, { gender: gender ?? null });
  const meta = [t("elev.loop.practice.minutes", { n: practice.minutes }), materials].filter(Boolean).join(" · ");
  return (
    <section
      data-testid="practice-card"
      data-practice-id={practice.id}
      data-shelf={shelf}
      aria-label={t("elev.loop.practice.caption")}
      className="overflow-hidden rounded-[18px]"
      style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
    >
      <div data-testid="practice-band" className="px-4 pb-2.5 pt-3 sm:px-5" style={{ background: "var(--arbor-clay-soft)" }}>
        <div className="flex items-center gap-2.5">
          <ShelfGlyph shelf={shelf} size={40} />
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold" style={{ color: "var(--arbor-muted)" }}>{t("elev.loop.practice.caption")}</p>
            <p data-testid="practice-shelf" className="text-[13px] font-semibold" style={{ color: "var(--arbor-ink)" }}>
              {headerNote ? `${shelfName} · ${headerNote}` : shelfName}
            </p>
          </div>
        </div>
      </div>
      <div className="px-4 pb-4 sm:px-5">
        <h2
          data-testid="practice-do"
          className="mt-3 font-semibold leading-tight"
          style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)", fontSize: "var(--t-xl)" }}
        >
          {doText}
        </h2>
        <blockquote
          data-testid="practice-say"
          className="mt-3 border-s-2 ps-3 leading-snug"
          style={{ borderColor: "var(--arbor-ink)", color: "var(--arbor-ink-soft)", fontFamily: "var(--font-editorial)", fontSize: "var(--t-xl)" }}
        >
          {t("elev.loop.practice.say")} <FreeText text={`“${sayText}”`} />
        </blockquote>
        {quotes && quotes.length > 0 && (
          <div data-testid="practice-quotes" className="mt-3 space-y-2">
            {quotes.map((q, i) => (
              <figure key={i} data-testid="practice-quote">
                <blockquote className="border-s-2 ps-3 text-[15px] leading-snug" style={{ borderColor: "var(--arbor-clay)", color: "var(--arbor-ink)", fontFamily: "var(--font-editorial)" }}>
                  <FreeText text={q.text} />
                </blockquote>
                {q.date && (
                  <figcaption className="mt-1 ps-3 text-[12px]" style={{ color: "var(--arbor-muted)" }}>
                    {t("elev.loop.practice.quoteMeta", { date: q.date })}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        )}
        <p data-testid="practice-meta" className="mt-3 text-[13px]" style={{ color: "var(--arbor-muted)" }}>{meta}</p>
        <p data-testid="practice-why" className="mt-1 text-[14.5px] italic leading-snug" style={{ color: "var(--arbor-muted)", fontFamily: "var(--font-editorial)" }}>
          {t("elev.loop.practice.why", { shelf: shelfName, title, name: childName || t("today.record.childFallback") })}
        </p>
        {answered ? (
          <div className="mt-4 flex items-center gap-2">
            <p role="status" data-testid="practice-receipt" className="flex min-w-0 items-center gap-1.5 text-[14px]" style={{ color: "var(--arbor-muted)" }}>
              <Icon name="check" size={18} />
              {t(answered === "did" ? "elev.loop.practice.didReceipt" : "elev.loop.practice.notTodayReceipt")}
            </p>
            {onUndo && (
              <button
                type="button"
                data-testid="practice-undo"
                onClick={onUndo}
                className="ms-auto inline-flex min-h-[44px] items-center rounded-full px-3 text-[13px] font-semibold"
                style={{ color: "var(--arbor-clay)" }}
              >
                {t("elev.loop.notice.undo")}
              </button>
            )}
          </div>
        ) : (
          <div
            role="group"
            aria-label={t("elev.loop.practice.caption")}
            data-testid="practice-answers"
            {...(stampMove ? { "data-primary-move": stampMove } : {})}
            className="mt-4 flex gap-2.5"
          >
            <button
              type="button"
              data-answer="did"
              onClick={() => onAnswer("did")}
              className="inline-flex min-h-12 flex-[1.15] items-center justify-center gap-2 rounded-full px-5 text-[15px] font-bold transition active:scale-[0.98]"
              style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}
            >
              <Icon name="check" size={20} />
              {t("elev.loop.practice.didIt")}
            </button>
            <button
              type="button"
              data-answer="not_today"
              onClick={() => onAnswer("not_today")}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full px-5 text-[15px] font-semibold transition active:scale-[0.98]"
              style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
            >
              {t("elev.loop.practice.notToday")}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * B-LOOP-07 — the evening's practice block: its outcome strip only (one line
 * under Tonight), never the card again. Nothing renders before an answer.
 */
export function PracticeOutcomeStrip({ shelf, answered }: { shelf: ShelfId; answered: PracticeAnswer | null | undefined }) {
  const { t } = useLanguage();
  if (!answered) return null;
  return (
    <p role="status" data-testid="practice-outcome-strip" className="flex items-center gap-1.5 px-1 text-[14px]" style={{ color: "var(--arbor-muted)" }}>
      <Icon name="check" size={18} />
      {shelfLabel(shelf, t)} · {t(answered === "did" ? "elev.loop.practice.didReceipt" : "elev.loop.practice.notTodayReceipt")}
    </p>
  );
}
