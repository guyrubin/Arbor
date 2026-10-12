import React, { useId } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { keptByMonth, type KeptThing } from "../../lib/kept/keptThings";
import { keptTextLanguage } from "../kept/KeptItem";
import { Icon } from "../ui/Icon";
import "./wordsFirstsStrip.css";

/**
 * v3 FEAT-08 — the words-and-firsts strip on My child (#/development).
 *
 * What the parent kept, visible without opening the keepsake disclosure: the
 * words and sentences the child said, and the firsts the parent confirmed,
 * month by month, newest first, on one horizontal track. Read-only and
 * presentational: the portrait passes the record it already loaded
 * (lib/kept/keptThings over useObservationRecord's sources), so the strip adds
 * no listener and no fetch. A quote stays a quote: it never becomes a record
 * observation (B-LOOP-10).
 *
 * Clinical firewall: names and words only. No count, no total, no per-month
 * number, no comparison between months or languages (components/growth
 * ThingsSaid). Month names are headings, nothing more. "First:" is reserved
 * for kind "first", a milestone the parent confirmed or a moment the parent
 * marked as a first; a quote carries the quote glyph and no prefix.
 *
 * Words keep the language they were said in: each sits in a bdi with its own
 * lang and dir="auto", whatever the interface language. Nothing to show
 * renders nothing (no empty card). Logical layout only; the track scrolls on
 * its own, never the page, and in Hebrew it starts from the right.
 */

/** The last six months that hold a kept word or first, newest first. A busy
 *  month keeps every first and its eight newest words; the rest stay one tap
 *  away (#/language, and the disclosure below). */
export const WORDS_STRIP_MONTHS = 6;
export const WORDS_STRIP_WORDS_PER_MONTH = 8;

export type WordsStripMonth = { monthKey: string; items: KeptThing[] };

export function wordsStripMonths(items: readonly KeptThing[]): WordsStripMonth[] {
  const kept = items.filter(item => item.kind === "said" || item.kind === "first");
  return keptByMonth(kept).slice(0, WORDS_STRIP_MONTHS).map(month => {
    const newest = new Set(month.items.filter(item => item.kind === "said").slice(0, WORDS_STRIP_WORDS_PER_MONTH).map(item => item.id));
    return { monthKey: month.monthKey, items: month.items.filter(item => item.kind === "first" || newest.has(item.id)) };
  }).filter(month => month.items.length > 0);
}

/** The month as a heading in the page locale; the year shows only when it is not this one. */
export function wordsStripMonthLabel(monthKey: string, lang: "en" | "he", currentYear = new Date().getUTCFullYear()): string {
  const date = new Date(`${monthKey}-01T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", { month: "long", ...(date.getUTCFullYear() !== currentYear ? { year: "numeric" as const } : {}), timeZone: "UTC" });
}

export interface WordsFirstsStripProps {
  /** The child's first name, for the heading. */
  name: string;
  /** Months newest first (wordsStripMonths), each with its words and firsts newest first. */
  months: readonly WordsStripMonth[];
  /** Opens #/language, where every word lives and a new one is added. */
  onAllWords: () => void;
}

export default function WordsFirstsStrip({ name, months, onAllWords }: WordsFirstsStripProps) {
  const { t, uiLang } = useLanguage();
  const headingId = useId();
  const shown = months.filter(month => month.items.length > 0);
  if (!shown.length) return null;
  const lang = uiLang === "he" ? "he" : "en";
  return (
    <section className="words-strip" data-testid="words-strip" aria-labelledby={headingId}>
      <h2 id={headingId} className="words-strip-title">
        <Icon name="translate" size={20} />
        <span>{t("companion.portrait.words.title", { name })}</span>
      </h2>
      <ol className="words-strip-track" tabIndex={0} aria-labelledby={headingId}>
        {shown.map(month => (
          <li key={month.monthKey} className="words-strip-month" data-testid="words-strip-month">
            <h3>{wordsStripMonthLabel(month.monthKey, lang)}</h3>
            <ul className="words-strip-cards">
              {month.items.map(item => (
                <li key={item.id} className="words-strip-card" data-testid="words-strip-card" data-kind={item.kind}>
                  <Icon name={item.kind === "first" ? "star" : "format_quote"} size={20} className="words-strip-glyph" />
                  <p className="words-strip-words">
                    {item.kind === "first" && <><span className="words-strip-first">{t("companion.portrait.words.first")}</span>{" "}</>}
                    <bdi dir="auto" lang={keptTextLanguage(item.language)}>{item.text}</bdi>
                  </p>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <button type="button" className="words-strip-all" data-testid="words-strip-all" onClick={onAllWords}>
        <span>{t("kept.allWords")}</span>
        <Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" />
      </button>
    </section>
  );
}
