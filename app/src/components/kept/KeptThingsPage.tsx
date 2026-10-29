import React, { useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildHistory } from "../../hooks/useChildHistory";
import type { BehaviorLog, Milestone } from "../../types";
import type { KeepsakeDoc } from "../../lib/firstsKeepsake";
import type { LangObservation } from "../../growth/vocabAgg";
import { milestoneText } from "../../lib/milestoneData";
import { keptByMonth, keptThings, type KeptKind } from "../../lib/kept/keptThings";
import KeptItem from "./KeptItem";
import KeptMonthPage from "./KeptMonthPage";
import { buildMonthPage } from "../../lib/keepsakeMonth";
import { placeForTab } from "../../lib/companionPlaces";
import { goToRoute } from "../../hooks/useHashQuery";
import Icon from "../ui/Icon";

export function keptMonthLabel(monthKey: string, lang: "en" | "he", currentYear = new Date().getUTCFullYear()): string {
  const date = new Date(`${monthKey}-01T12:00:00Z`);
  return date.toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", { month: "long", ...(date.getUTCFullYear() !== currentYear ? { year: "numeric" as const } : {}), timeZone: "UTC" });
}

/** Current My child disclosure. Reads only the four existing kept sources;
 * older records load explicitly and child changes reset filters and sheets.
 * `asPage`: the reader IS the page (`#/development?view=kept`), so its title
 * is the page's h1. */
export default function KeptThingsPage({ asPage = false }: { asPage?: boolean } = {}) {
  const { childProfile, behaviorLogs, milestoneHistory, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const [filter, setFilter] = useState<"all" | KeptKind>("all");
  const [changed, setChanged] = useState(false);
  const childId = childProfile.id;
  const moments = useChildHistory<BehaviorLog>(childId, "behaviorLogs", "timestamp", behaviorLogs);
  const noticed = useChildHistory<Milestone>(childId, "milestones", undefined, milestoneHistory);
  const notes = useChildHistory<KeepsakeDoc>(childId, "keepsakes");
  const words = useChildHistory<LangObservation>(childId, "langObs", "timestamp");
  const sources = [moments, noticed, notes, words];
  const loading = sources.some(source => source.loading);
  const error = sources.some(source => source.error);
  const confirmed = sources.every(source => source.confirmed);
  const more = sources.some(source => source.more);
  const first = (childProfile.name || "").split(" ")[0] || t("today.record.childFallback");
  const items = useMemo(() => keptThings({
    behaviorLogs: moments.items,
    milestones: noticed.items.map(item => ({ ...item, title: milestoneText(item, "title", t, { gender: childProfile.gender }) })),
    keepsakes: notes.items, langObs: words.items,
  }, childProfile), [moments.items, noticed.items, notes.items, words.items, childProfile, t]);
  const months = keptByMonth(filter === "all" ? items : items.filter(item => item.kind === filter));
  const filters = ["all", "said", "first", "by_herself"] as const;
  const beforeExport = () => {
    if (sources.every(source => source.isCurrent())) { setChanged(false); return true; }
    setChanged(true);
    sources.forEach(source => source.reload());
    return false;
  };

  return <section className="kept-reader" data-testid="kept-reader" aria-label={t("kept.title", { name: first })}>
    {asPage ? <h1 data-testid="kept-reader-title">{t("kept.title", { name: first })}</h1> : <h2>{t("kept.title", { name: first })}</h2>}
    <div className="kept-filters" role="group" aria-label={t("kept.filter")}>
      {filters.map(kind => <button key={kind} type="button" aria-pressed={filter === kind} onClick={() => setFilter(kind)}>{t(`kept.filter.${kind}`)}</button>)}
    </div>
    {changed && <p className="kept-reader-status" role="status">{t("kept.changed")}</p>}
    {error ? <p className="kept-reader-status" role="status">{t("kept.error")} <button type="button" className="kept-text-button" onClick={() => sources.forEach(source => source.reload())}>{t("kept.retry")}</button></p>
      : loading ? <p className="kept-reader-status" role="status">{t("kept.loading")}</p>
      : !confirmed ? <p className="kept-reader-status" role="status">{t("kept.offline")}</p>
      : !months.length && !more ? <p className="kept-reader-status">{t(filter === "all" ? "kept.empty" : "kept.filterEmpty", { name: first })}</p> : null}
    {more && <p className="kept-reader-status">{t("kept.monthPending")}</p>}
    {months.map(month => <section key={month.monthKey} className="kept-month" data-testid="kept-month">
      <KeptMonthPage page={buildMonthPage({ monthKey: month.monthKey, kept: items })!} childName={first} monthLabel={keptMonthLabel(month.monthKey, lang)} disabled={loading || error || !confirmed || more} beforeExport={beforeExport} />
      {month.items.map(item => <KeptItem key={`${childId}:${item.id}`} item={item} childName={first} disabled={loading || error || !confirmed} beforeExport={beforeExport} />)}
    </section>)}
    {more && <button type="button" className="kept-text-button" disabled={loading || error} onClick={() => sources.forEach(source => source.loadMore())}>{t("kept.loadMore")}</button>}
    <button type="button" className="kept-text-button" onClick={() => setActiveTab("language")}>{t("kept.allWords")}</button>
  </section>;
}

/** B-ASKJB-36 — `#/development?view=kept` (also `#/development/kept`): My
 *  child with the kept reader open, a MODE of the My child route like
 *  `?view=program` (Shell picks it; no route id, no contract of its own).
 *  Back — the browser's or this link — returns to My child. Search reaches it
 *  ("kept", "שמרנו": lib/searchIndex.ts). The reader is the one that already
 *  exists; nothing new is read or written here. */
export function KeptReaderMode() {
  const { childProfile } = useArbor();
  const { uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const place = placeForTab("development");
  return <div data-testid="kept-mode" dir={lang === "he" ? "rtl" : "ltr"} lang={lang} className="mx-auto flex w-full min-w-0 max-w-[720px] flex-col gap-2">
    <button
      type="button"
      data-testid="kept-back"
      onClick={() => goToRoute("development")}
      className="-ms-1 inline-flex min-h-11 items-center gap-1 self-start px-1 t-sm font-bold focus:outline-none focus-visible:ring-2"
      style={{ color: "var(--arbor-muted)" }}
    >
      <Icon name="arrow_back" size={18} aria-hidden className="rtl:-scale-x-100" />
      {place[lang]}
    </button>
    <KeptThingsPage key={childProfile.id} asPage />
  </div>;
}
