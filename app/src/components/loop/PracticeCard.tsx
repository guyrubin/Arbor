import React from "react";
import { Icon } from "../ui/Icon";
import { FreeText } from "../ui/FreeText";
import { useLanguage } from "../../context/LanguageContext";
import type { Practice } from "../../content/practices";
import type { Milestone } from "../../types";
import { resolveHebrewSlash } from "../../lib/hebrewSlashGender";
import { shelfLabel, type ShelfId } from "../../lib/shelves/registry";
import type { PracticeAnswer } from "../../lib/practice/choosePractice";
import { ShelfGlyph } from "./ShelfGlyph";
import { practiceTitle, titleIsWholeDo } from "../../lib/practice/practiceTitle";

/** The page-language text of a practice field, Hebrew slash forms resolved
 *  from the child's gender (Law 8). */
export function practiceText(p: Practice, field: "do" | "say" | "materials", lang: "en" | "he", gender?: string | null): string {
  const value = p[field];
  if (!value) return "";
  const text = lang === "he" ? value.he : value.en;
  return lang === "he" ? resolveHebrewSlash(text, gender) : text;
}

export type PracticeWhyReason = "empty" | "fewest";

const WHY_KEY: Record<PracticeWhyReason, string> = {
  empty: "elev.loop.practice.whyEmpty",
  fewest: "elev.loop.practice.whyFewest",
};

export interface PracticeCardProps {
  practice: Practice;
  /** null for a shelf-level practice (B-LOOP-08 follow-up). */
  milestone: Milestone | null;
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
  /** P5 r1 pass A3: the chooser's REASON for this shelf today (the coverage
   *  count it ranked by — never rendered as a number): nothing this month,
   *  or the fewest notes of all the child's shelves. Otherwise (the
   *  alternation's second shelf) the plain shelf line — never a false claim. */
  whyReason?: PracticeWhyReason | null;
  /** B-LOOP-13: the AI's one why sentence (todays_focus 1.3.0, screened on the
   *  server; only beside an AI pick). Present → it REPLACES the chooser's
   *  reason line; absent → the chooser's line, unchanged. */
  whyText?: string | null;
  /** Law 7: the answers ARE the surface's primary move (P5 design r1 P0-1:
   *  the stamp sits on the "Did it" / "Not today" group, h ≈ 48, never on the
   *  card; after an answer the route moves it to the next unanswered
   *  control — Today: the first Notice row). */
  stampMove?: string;
}

/**
 * B-LOOP-09 / B-LOOP-07 — Today's practice, the design of record
 * (art/mockups/today-option-1.html): a caption row with the shelf mark,
 * a short title (≤ 8 words, the do's first clause — lib/practice/
 * practiceTitle; P5 r1 P0-1) at --t-lg, the full do at body size, the "say"
 * as the one --t-xl editorial sentence
 * behind a 2 px navy start rule, one muted meta line, one why-line, and
 * the two answers — solid sapphire "Did it" + pale "Not today". After an
 * answer: ONE line ("Noted. Tonight Arbor asks how it went." / "Tomorrow is
 * fine.") — never a count, a streak or a score. Parent register: flat
 * tints, tokens only, logical properties.
 */
export default function PracticeCard({
  practice,
  shelf,
  childName,
  gender,
  answered,
  onAnswer,
  onUndo,
  quotes,
  headerNote,
  whyReason,
  whyText,
  stampMove,
}: PracticeCardProps) {
  const { t, uiLang } = useLanguage();
  const lang: "en" | "he" = uiLang === "he" ? "he" : "en";
  const shelfName = shelfLabel(shelf, t);
  const doText = practiceText(practice, "do", lang, gender);
  const titleText = practiceTitle(doText, lang);
  const stamp = stampMove ? { "data-primary-move": stampMove } : {};
  const sayText = practiceText(practice, "say", lang, gender);
  const materials = practiceText(practice, "materials", lang, gender);
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
          data-testid="practice-title"
          className="mt-3 font-semibold leading-snug"
          style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)", fontSize: "var(--t-lg)" }}
        >
          {titleText}
        </h2>
        {/* P5 r1 pass A1: the parent's OWN words on this shelf, dated, right
            under the title — THEN and NOW when both exist (lib/today/shelfWords).
            ONE line each (date first, the words after; the full sentence in the
            title attribute) so "Did it" stays ≤ 640 at 375 with both present. */}
        {quotes && quotes.length > 0 && (
          <div data-testid="practice-quotes" className="mt-2 space-y-1 border-s-2 ps-3" style={{ borderColor: "var(--arbor-clay)" }}>
            {quotes.map((q, i) => (
              <p key={i} data-testid="practice-quote" title={q.text} className="truncate leading-snug" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-editorial)", fontSize: "var(--t-base)" }}>
                {q.date && (
                  <span style={{ color: "var(--arbor-muted)", fontFamily: "var(--font-sans)", fontSize: "var(--t-sm)" }}>
                    {t("elev.loop.practice.quoteMeta", { date: q.date })} ·{" "}
                  </span>
                )}
                <FreeText text={`“${q.text}”`} />
              </p>
            ))}
          </div>
        )}
        <blockquote
          data-testid="practice-say"
          className="mt-3 border-s-2 ps-3 leading-snug"
          style={{ borderColor: "var(--arbor-ink)", color: "var(--arbor-ink-soft)", fontFamily: "var(--font-editorial)", fontSize: "var(--t-xl)" }}
        >
          {t("elev.loop.practice.say")} <FreeText text={`“${sayText}”`} />
        </blockquote>
        {!titleIsWholeDo(titleText, doText) && (
          <p data-testid="practice-do" className="mt-2 leading-snug" style={{ color: "var(--arbor-ink)", fontSize: "var(--t-base)" }}>
            {doText}
          </p>
        )}
        {answered ? (
          <div className="mt-4 flex items-center gap-2">
            <p role="status" data-testid="practice-receipt" className="flex min-w-0 items-center gap-1.5 text-[14px]" style={{ color: "var(--arbor-muted)" }}>
              <Icon name="check" size={18} />
              {/* pass A1: the dose is filed on the shelf, next to the parent's words */}
              {t(answered === "did" ? (quotes && quotes.length > 0 ? "elev.loop.practice.didReceiptWords" : "elev.loop.practice.didReceipt") : "elev.loop.practice.notTodayReceipt", { name: childName || t("today.record.childFallback"), shelf: shelfName })}
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
            {...stamp}
            className="mt-4 flex gap-2.5"
          >
            <button
              type="button"
              data-answer="did"
              onClick={() => onAnswer("did")}
              className="inline-flex min-h-12 flex-[1.15] items-center justify-center gap-2 rounded-full px-5 text-[15px] font-bold transition active:scale-[0.98]"
              style={{ background: "var(--gradient-cta)", color: "var(--arbor-on-accent)", boxShadow: "var(--shadow-sm)" }}
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
        {/* P5 r1 pass A1/A3: the meta and the reason sit UNDER the answers, so
            the parent's words fit above "Did it" at 375 (bottom ≤ 640). */}
        <p data-testid="practice-meta" className="mt-3" style={{ color: "var(--arbor-muted)", fontSize: "var(--t-sm)" }}>{meta}</p>
        <p data-testid="practice-why" className="mt-1 italic leading-snug" style={{ color: "var(--arbor-muted)", fontFamily: "var(--font-editorial)", fontSize: "var(--t-base)" }}>
          {whyText?.trim() || t(whyReason ? WHY_KEY[whyReason] : "elev.loop.practice.whyShelf", { shelf: shelfName, name: childName || t("today.record.childFallback") })}
        </p>
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
