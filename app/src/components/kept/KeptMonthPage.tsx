import React, { useEffect, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { openPrintableReport, type ReportDoc } from "../../lib/reportExport";
import type { MonthPage } from "../../lib/keepsakeMonth";
import { SendSheet } from "../share/SendSheet";
import { keptDateLabel, keptItemText, keptTextLanguage } from "./KeptItem";

export function monthPageDoc(page: MonthPage, name: string, monthLabel: string, lang: "en" | "he"): ReportDoc {
  return {
    presentation: "kept-month", title: name, subtitle: monthLabel, sections: [],
    keptItems: page.items.map(item => ({ text: item.text, date: keptDateLabel(item.at, lang), language: keptTextLanguage(item.language) })),
  };
}

export function monthPageText(page: MonthPage, name: string, monthLabel: string, lang: "en" | "he"): string {
  return [name, monthLabel, "", ...page.items.map(item => keptItemText(item, name, lang))].join("\n");
}

/** The month heading opens the existing print view; Send is a separate,
 * reviewed plain-text action. An incomplete/offline month cannot leave. */
export default function KeptMonthPage({ page, childName, monthLabel, disabled, beforeExport }: { page: MonthPage; childName: string; monthLabel: string; disabled: boolean; beforeExport: () => boolean }) {
  const { t, uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const [send, setSend] = useState(false);
  useEffect(() => { if (disabled) setSend(false); }, [disabled]);
  return <div className="kept-month-actions">
    <h3><button type="button" className="kept-text-button kept-month-link" data-testid="kept-month-print" disabled={disabled} aria-label={`${t("kept.month", { month: monthLabel, name: childName })} · ${t("kept.print")}`} onClick={() => { if (beforeExport()) void openPrintableReport(monthPageDoc(page, childName, monthLabel, lang), childName, lang); }}>{t("kept.month", { month: monthLabel, name: childName })} <span aria-hidden="true">{lang === "he" ? "‹" : "›"}</span></button></h3>
    <button type="button" className="kept-text-button" disabled={disabled} onClick={() => { if (beforeExport()) setSend(true); }} data-testid="kept-month-send">{t("kept.send")}</button>
    {send && !disabled && <SendSheet open onClose={() => setSend(false)} text={monthPageText(page, childName, monthLabel, lang)} artifact="growth_card" surface="kept_month" beforeSend={beforeExport} />}
  </div>;
}
