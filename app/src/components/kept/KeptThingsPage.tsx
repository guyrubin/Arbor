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

export function keptMonthLabel(monthKey: string, lang: "en" | "he", currentYear = new Date().getUTCFullYear()): string {
  const date = new Date(`${monthKey}-01T12:00:00Z`);
  return date.toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", { month: "long", ...(date.getUTCFullYear() !== currentYear ? { year: "numeric" as const } : {}), timeZone: "UTC" });
}

/** Current My child disclosure. Reads only the four existing kept sources;
 * older records load explicitly and child changes reset filters and sheets. */
export default function KeptThingsPage() {
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
    <h2>{t("kept.title", { name: first })}</h2>
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
