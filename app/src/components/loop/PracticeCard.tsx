import React, { useId, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { FreeText } from "../ui/FreeText";
import { useLanguage } from "../../context/LanguageContext";
import type { Practice } from "../../content/practices";
import type { Milestone } from "../../types";
import { resolveHebrewSlash } from "../../lib/hebrewSlashGender";
import { shelfLabel, type ShelfId } from "../../lib/shelves/registry";
import type { PracticeAnswer } from "../../lib/practice/choosePractice";
import { ShelfGlyph } from "../ui/ShelfGlyph";
import { practiceDoNamed } from "../../lib/journal/shelfView";
import { practiceTitle, titleIsWholeDo } from "../../lib/practice/practiceTitle";
import { PRACTICE_ADAPTATIONS, PRACTICE_ADAPTATION_KEYS, type PracticeAdaptationKey } from "../../content/practiceAdaptations";
import { Receipt } from "../ui/Receipt";
import { routeHash } from "../../lib/routes";

/** The page-language text of a practice field, Hebrew slash forms resolved
 *  from the child's gender (Law 8). */
export function practiceText(p: Practice, field: "do" | "say" | "materials", lang: "en" | "he", gender?: string | null): string {
  const value = p[field];
  if (!value) return "";
  const text = lang === "he" ? value.he : value.en;
  return lang === "he" ? resolveHebrewSlash(text, gender) : text;
}

/** P5-LOOP c2 r1: "since" answers the parent's quoted words on this shelf
 *  (their date rides in `whyDate`); "startsPage" says, in the child's terms,
 *  that tonight's answer starts an empty shelf's page. */
export type PracticeWhyReason = "empty" | "fewest" | "since" | "startsPage";

const WHY_KEY: Record<PracticeWhyReason, string> = {
  empty: "elev.loop.practice.whyEmpty",
  fewest: "elev.loop.practice.whyFewest",
  since: "elev.loop.practice.whySince",
  startsPage: "elev.loop.practice.whyStartsPage",
};

/** One quoted line in the words slot: the parent's text verbatim, and either
 *  the default "Your words, {date}" lead or a `lead` of its own ("Last night
 *  you wrote:"), with the shelf it was written on after it. */
export interface PracticeQuote {
  text: string;
  date?: string;
  lead?: string;
  shelf?: string;
  /** B-DESIGN-04 (Today critic c2.r4 P2-N1): false when the line was written
   *  on ANOTHER shelf (last night's words on yesterday's practice) — the "Did
   *  it" receipt then never claims the dose was filed "next to your words". */
  onShelf?: boolean;
}

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
  quotes?: ReadonlyArray<PracticeQuote>;
  /** B-LOOP-07: a lifecycle line (birthday, first week) inside the header, never a sibling. */
  headerNote?: string | null;
  /** P5 r1 pass A3: the chooser's REASON for this shelf today (the coverage
   *  count it ranked by — never rendered as a number): nothing this month,
   *  or the fewest notes of all the child's shelves. Otherwise (the
   *  alternation's second shelf) the plain shelf line — never a false claim. */
  whyReason?: PracticeWhyReason | null;
  /** The date the "since" reason names (the newest quoted line on this shelf). */
  whyDate?: string | null;
  /** B-LOOP-13: the AI's one why sentence (todays_focus 1.3.0, screened on the
   *  server; only beside an AI pick). Present → it REPLACES the chooser's
   *  reason line; absent → the chooser's line, unchanged. */
  whyText?: string | null;
  /** Law 7: the answers ARE the surface's primary move (P5 design r1 P0-1:
   *  the stamp sits on the "Did it" / "Not today" group, h ≈ 48, never on the
   *  card; after an answer the route moves it to the next unanswered
   *  control — Today: the first Notice row). */
  stampMove?: string;
  /** P5-LOOP critic c2 r2 (product P1-2, B-LOOP-NEW-2a): "tonight" when the
   *  evening opens on a practice the parent was never shown — the caption is
   *  Tonight's practice and the say is offered "for tonight"; the answers,
   *  the do-line and the stamp are unchanged. Default "day". */
  mode?: "day" | "tonight";
  /** The parent owns this preview. Only onAnswer records it. */
  adaptation?: PracticeAdaptationKey | null;
  onAdapt?: (key: PracticeAdaptationKey | null) => void;
}

/**
 * B-LOOP-09 / B-LOOP-07 → B-DESIGN-04 (P7-DESIGN, design of record
 * execution/2026-10-07--design-direction/option-ab-blend.html, frame 01):
 * Today's practice is the screen's PRIMARY card — the one card with the deep
 * shadow (--arbor-shadow-primary) on --r-xl. It opens on a kicker row (the
 * 44 px duotone shelf glyph, the caption as a kicker over the shelf name, and
 * the minutes as a quiet tag) under a hairline; then a short title (≤ 8
 * words, the do's first clause in the child's terms — practiceDoNamed +
 * practiceTitle) in the display face at --t-title; the family's own words
 * (editorial) and the "say" (editorial --t-say, the one largest line) on ONE
 * 2 px ink rule — the screen's one warm accent; the full do at body size; the
 * two answers (the CTA-recipe "Did it" — the route's one — and a pale
 * "Not today"); then the materials and the why-line, muted. After an answer:
 * ONE line — never a count, a streak or a score. Parent register: tokens
 * only, logical properties (the rule and the tag mirror in Hebrew).
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
  whyDate,
  whyText,
  stampMove,
  mode = "day",
  adaptation,
  onAdapt,
}: PracticeCardProps) {
  const { t, uiLang } = useLanguage();
  const lang: "en" | "he" = uiLang === "he" ? "he" : "en";
  const shelfName = shelfLabel(shelf, t);
  // P2-N4: the headline and the do-line name the child ("Give Dylan …"), the
  // same substitution the Journal tile's "Try:" line uses.
  const doText = practiceDoNamed(practice, lang, childName ?? "", gender);
  const titleText = practiceTitle(doText, lang);
  const stamp = stampMove ? { "data-primary-move": stampMove } : {};
  const sayText = practiceText(practice, "say", lang, gender);
  const materials = practiceText(practice, "materials", lang, gender);
  const caption = t(mode === "tonight" ? "elev.loop.tonight.practice.caption" : "elev.loop.practice.caption");
  const hasQuotes = !!quotes && quotes.length > 0;
  const besideWords = !!quotes && quotes.some((q) => q.onShelf !== false);
  const [adaptOpen, setAdaptOpen] = useState(false);
  // B-STATUS-01: the answer this card opened with (null unless a reload).
  const answeredAtMount = useRef<PracticeAnswer | null>(answered ?? null);
  const adaptId = useId();
  const adaptTrigger = useRef<HTMLButtonElement>(null);
  const canAdapt = !!onAdapt && !!PRACTICE_ADAPTATIONS[practice.id];
  const chooseAdaptation = (key: PracticeAdaptationKey | null) => {
    onAdapt?.(key);
    setAdaptOpen(false);
    adaptTrigger.current?.focus();
  };
  return (
    <section
      data-testid="practice-card"
      data-practice-id={practice.id}
      data-shelf={shelf}
      data-mode={mode}
      aria-label={caption}
      className="arbor-depth-primary overflow-hidden px-4 pb-4 pt-3.5 sm:px-5 sm:pb-5"
      style={{ background: "var(--arbor-paper-elevated)", borderRadius: "var(--r-xl)" }}
    >
      {/* The kicker row: glyph · caption over the shelf · the minutes tag, on a hairline. */}
      <header data-testid="practice-band" className="flex items-center gap-3 pb-2.5" style={{ borderBottom: "1px solid var(--arbor-rule)" }}>
        <ShelfGlyph shelf={shelf} />
        <div className="min-w-0 flex-1">
          <p data-testid="practice-kicker" className="arbor-type-kicker">{caption}</p>
          <p data-testid="practice-shelf" className="mt-0.5 t-base font-semibold leading-tight" style={{ color: "var(--arbor-ink)" }}>
            {headerNote ? `${shelfName} · ${headerNote}` : shelfName}
          </p>
        </div>
        <span
          data-testid="practice-minutes"
          className="inline-flex h-[30px] flex-none items-center gap-1 rounded-full px-2.5 t-sm font-semibold"
          style={{ background: "var(--arbor-paper)", boxShadow: "inset 0 0 0 1px var(--arbor-rule)", color: "var(--arbor-ink-soft)" }}
        >
          <Icon name="schedule" size={16} />
          <span className="arbor-num">{t("elev.loop.practice.minutes", { n: practice.minutes })}</span>
        </span>
      </header>
      <h2 data-testid="practice-title" className="mt-2.5 arbor-type-title" style={{ color: "var(--arbor-ink)" }}>
        {titleText}
      </h2>
      {/* P5 r1 pass A1: the parent's OWN words, dated, right under the title
          — last night's line on yesterday's practice first (P5-LOOP c2 r1),
          else THEN and NOW on this shelf (lib/today/shelfWords). ONE line
          each (lead first, the words after; the full sentence in the title
          attribute) so "Did it" stays <= 640 at 375. The words and the say
          share ONE 2 px --arbor-ink inline-start rule: the screen's one warm
          accent (B-DESIGN-04; .arbor-accent-rule). */}
      <div data-testid="practice-words" className="mt-2 arbor-accent-rule">
        {hasQuotes && (
          <div data-testid="practice-quotes" className="space-y-1">
            {quotes!.map((q, i) => (
              <p key={i} data-testid="practice-quote" title={q.text} className="truncate leading-snug" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-editorial)", fontSize: "var(--t-base)" }}>
                {(q.lead || q.date) && (
                  <span style={{ color: "var(--arbor-muted)", fontFamily: "var(--font-sans)", fontSize: "var(--t-sm)" }}>
                    {q.lead ?? `${t("elev.loop.practice.quoteMeta", { date: q.date ?? "" })} ·`}{" "}
                  </span>
                )}
                <FreeText text={t("elev.loop.ms.quoted", { text: q.text })} />
                {q.shelf && (
                  <span data-testid="practice-quote-shelf" style={{ color: "var(--arbor-muted)", fontFamily: "var(--font-sans)", fontSize: "var(--t-sm)" }}>
                    {" · "}<bdi>{q.shelf}</bdi>
                  </span>
                )}
              </p>
            ))}
          </div>
        )}
        <blockquote data-testid="practice-say" className={`${hasQuotes ? "mt-3" : ""} arbor-type-say`} style={{ color: "var(--arbor-ink)" }}>
          <span data-testid="practice-say-label" className="t-sm font-semibold" style={{ color: "var(--arbor-muted)", fontFamily: "var(--font-sans)" }}>
            {t(mode === "tonight" ? "elev.loop.practice.sayTonight" : "elev.loop.practice.say")}
          </span>{" "}
          <FreeText text={t("elev.loop.ms.quoted", { text: sayText })} />
        </blockquote>
      </div>
      {!titleIsWholeDo(titleText, doText) && (
        <p data-testid="practice-do" className="mt-2 t-base leading-snug" style={{ color: "var(--arbor-ink-soft)" }}>
          {doText}
        </p>
      )}
      {answered ? (
        /* B-STATUS-01: the ONE receipt line — what it says is unchanged; a
           "Did it" links to the shelf it was filed on. pass A1: "next to your
           words" only when the words shown ARE on this shelf (P2-N1). An answer
           given before this card mounted (a reload) is drawn, not announced. */
        <Receipt
          testId="practice-receipt"
          className="mt-3.5"
          announce={answered !== answeredAtMount.current}
          link={answered === "did" ? { where: shelfName, href: `#${routeHash("journal", { shelf })}`, testId: "practice-receipt-open" } : null}
          undo={onUndo ? { label: t("elev.loop.notice.undo"), onUndo, testId: "practice-undo" } : null}
        >
          {t(answered === "did" ? (besideWords ? "elev.loop.practice.didReceiptWords" : "elev.loop.practice.didReceipt") : "elev.loop.practice.notTodayReceipt", { name: childName || t("today.record.childFallback"), shelf: shelfName })}
        </Receipt>
      ) : (
        <div
          role="group"
          aria-label={t("elev.loop.practice.caption")}
          data-testid="practice-answers"
          {...stamp}
          className="mt-3.5 flex gap-2.5"
        >
          <button
            type="button"
            data-answer="did"
            onClick={() => onAnswer("did")}
            className="inline-flex min-h-12 flex-[1.15] items-center justify-center gap-2 rounded-full px-5 t-md font-bold transition active:scale-[0.98]"
            style={{ background: "var(--gradient-cta)", color: "var(--arbor-on-accent)", boxShadow: "var(--shadow-sm)" }}
          >
            <Icon name="check" size={20} />
            {t("elev.loop.practice.didIt")}
          </button>
          <button
            type="button"
            data-answer="not_today"
            onClick={() => onAnswer("not_today")}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full px-5 t-md font-semibold transition active:scale-[0.98]"
            style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
          >
            {t("elev.loop.practice.notToday")}
          </button>
        </div>
      )}
      {canAdapt && !answered && (
        <div data-testid="practice-adapt" className="mt-2" dir={lang === "he" ? "rtl" : "ltr"}>
          <button
            type="button"
            ref={adaptTrigger}
            aria-expanded={adaptOpen}
            aria-controls={adaptId}
            onClick={() => setAdaptOpen((open) => !open)}
            className="flex min-h-11 w-full items-center gap-2 rounded-xl px-1 text-start t-sm font-semibold"
            style={{ color: "var(--arbor-clay)" }}
          >
            <span className="flex-1">{t(adaptOpen ? "elev.adapt.close" : "elev.adapt.open")}</span>
            <Icon name={adaptOpen ? "expand_less" : "expand_more"} size={20} />
          </button>
          {adaptation && (
            <p role="status" className="pb-1 t-sm leading-snug" style={{ color: "var(--arbor-muted)" }}>
              {t("elev.adapt.active", { option: t(`elev.adapt.${adaptation}`) })}
            </p>
          )}
          {adaptOpen && (
            <div id={adaptId} className="space-y-2 rounded-xl p-3" style={{ background: "var(--arbor-paper-deep)" }}>
              <p className="t-base font-semibold" style={{ color: "var(--arbor-ink)" }}>{t("elev.adapt.prompt")}</p>
              <div role="group" aria-label={t("elev.adapt.prompt")} className="grid gap-2 sm:grid-cols-2">
                {PRACTICE_ADAPTATION_KEYS.map((key) => (
                  <button key={key} type="button" data-adaptation={key} aria-pressed={adaptation === key}
                    onClick={() => chooseAdaptation(key)}
                    className="min-h-11 rounded-xl px-3 py-2.5 text-start"
                    style={{ background: "var(--arbor-paper-elevated)", border: `1px solid var(${adaptation === key ? "--arbor-clay" : "--arbor-rule"})`, color: "var(--arbor-ink)" }}>
                    <span className="block t-sm font-semibold">{t(`elev.adapt.${key}`)}</span>
                    <span className="block mt-0.5 t-xs leading-snug" style={{ color: "var(--arbor-muted)" }}>{t(`elev.adapt.${key}.detail`)}</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => chooseAdaptation(null)}
                className="min-h-11 w-full rounded-xl px-3 text-start t-sm font-semibold" style={{ color: "var(--arbor-clay)" }}>
                {t("elev.adapt.revert")}
              </button>
              <p className="t-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.adapt.preview")}</p>
            </div>
          )}
        </div>
      )}
      {/* P5 r1 pass A1/A3: the materials and the reason sit UNDER the answers,
          so the parent's words fit above "Did it" at 375 (bottom ≤ 640). The
          minutes moved to the kicker row's tag (B-DESIGN-04). */}
      {materials && (
        <p data-testid="practice-meta" className="mt-3 t-sm" style={{ color: "var(--arbor-muted)" }}>{materials}</p>
      )}
      <p
        data-testid="practice-why"
        className={`${materials ? "mt-1" : "mt-3"} t-base leading-snug${lang === "he" ? "" : " italic"}`}
        style={{ color: "var(--arbor-muted)", fontFamily: "var(--font-editorial)" }}
      >
        {whyText?.trim() || t(whyReason && (whyReason !== "since" || whyDate) ? WHY_KEY[whyReason] : "elev.loop.practice.whyShelf", { shelf: shelfName, name: childName || t("today.record.childFallback"), date: whyDate ?? "" })}
      </p>
    </section>
  );
}
