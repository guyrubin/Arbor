import React, { useEffect, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { keptDay } from "../../lib/kept/keptThings";
import type { YearBook } from "../../lib/keepsakeYear";
import { keptMonthLabel } from "../../lib/keepsakeMonth";
import { openPrintableReport, type ReportDoc } from "../../lib/reportExport";
import { SendSheet } from "../share/SendSheet";
import { keptDateLabel, keptItemText, keptTextLanguage } from "./KeptItem";

/** Plain text and print only. A picture of the child does not leave with a
 * year book; that path stays on releaseChildLikeness. */
export function yearPageDoc(book: YearBook, name: string, lang: "en" | "he"): ReportDoc {
  const year = Number(book.yearKey);
  return {
    presentation: "kept-year", title: name, subtitle: book.yearKey, sections: [],
    chapters: book.months.map(month => ({
      heading: keptMonthLabel(month.monthKey, lang, year),
      items: month.items.map(item => ({ text: item.text, date: keptDateLabel(item.at, lang), language: keptTextLanguage(item.language) })),
    })),
  };
}

export function yearPageText(book: YearBook, name: string, lang: "en" | "he"): string {
  const year = Number(book.yearKey);
  const chapters = book.months.map(month => [keptMonthLabel(month.monthKey, lang, year), ...month.items.map(item => keptItemText(item, name, lang))].join("\n"));
  return [name, book.yearKey, "", chapters.join("\n\n")].join("\n");
}

/** One calendar year of parent-kept words and firsts, oldest month first.
 * Print and Send review the whole year. An incomplete year cannot leave. */
export default function KeptYearBook({ book, childName, disabled, beforeExport, asPage = false }: {
  book: YearBook; childName: string; disabled: boolean; beforeExport: () => boolean; asPage?: boolean;
}) {
  const { t, uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const [send, setSend] = useState(false);
  const Heading = asPage ? "h1" : "h2";
  const year = Number(book.yearKey);
  useEffect(() => { if (disabled) setSend(false); }, [disabled]);
  return <article className="kept-year-book" data-testid="kept-year-book">
    <Heading data-testid="kept-year-title">{t("kept.year", { year: book.yearKey, name: childName })}</Heading>
    <p className="kept-year-line">{t("kept.yearLine")}</p>
    <div className="kept-year-actions">
      <button type="button" className="kept-text-button" data-testid="kept-year-print" disabled={disabled} onClick={() => { if (beforeExport()) void openPrintableReport(yearPageDoc(book, childName, lang), childName, lang); }}>{t("kept.yearPrint")}</button>
      <button type="button" className="kept-text-button" data-testid="kept-year-send" disabled={disabled} onClick={() => { if (beforeExport()) setSend(true); }}>{t("kept.send")}</button>
    </div>
    {book.months.map(month => <section key={month.monthKey} className="kept-year-chapter" data-testid="kept-year-chapter">
      <h3>{keptMonthLabel(month.monthKey, lang, year)}</h3>
      {month.items.map(item => <p key={item.id} className="kept-words">
        <time dateTime={keptDay(item.at) ?? undefined}>{keptDateLabel(item.at, lang)}</time>
        <bdi dir="auto" lang={keptTextLanguage(item.language)}>{item.text}</bdi>
      </p>)}
    </section>)}
    {send && !disabled && <SendSheet open onClose={() => setSend(false)} text={yearPageText(book, childName, lang)} artifact="growth_card" surface="kept_year" beforeSend={beforeExport} />}
  </article>;
}
