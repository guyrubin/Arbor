import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useObservationRecord } from "../../hooks/useObservationRecord";
import { goToRoute, useHashQuery } from "../../hooks/useHashQuery";
import { useSheetHistory } from "../../hooks/useSheetHistory";
import { domainName, isDomainId, type DomainId } from "../../lib/domains/registry";
import { DOMAIN_ICONS } from "../../lib/domains/icons";
import type { Observation, ObservationOrigin } from "../../lib/observations";
import { milestoneText } from "../../lib/milestoneData";
import { behaviorTypeLabel } from "../../content/behaviorTaxonomy";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { Sheet, useCompactSurface } from "../ui/Sheet";
import { SheetBreadcrumb } from "../layout/Breadcrumb";
import { portraitDiscussionPrompt } from "../companion/portraitModel";
import { PORTRAIT_COPY } from "../companion/portraitCopy";
import { portraitEvidenceLines, reviewedPortraitDraft } from "../companion/portraitEvidence";
import { openFamilyTopicSheet } from "../companion/familyTopicEvents";
import { PLACE_ICONS, PLACE_LABEL_KEYS } from "../overview/CaptureWhereArea";
import {
  areaMonthCounts, filterByAreaMonth, isMomentRecord, monthBuckets, MOMENTS_RANGES, MOMENTS_VIEWS, parseMonth, parseView, placeCards,
  type MomentsRange, type MomentsView, type MonthBucket,
} from "./momentsModel";
import "./moments.css";

/**
 * F-CHILD-2 — Moments (#/timeline): the parent's kept record seen three ways —
 * over time (month columns, newest first), in different places (only places
 * the parent recorded) and across areas (a bare count per area and month).
 * Counts only: no rates, no shares, no colour scale, no progress shape. Each
 * card's overflow opens the evidence sheet (Discuss · Save question · Open
 * the original). The route's stamps arrive as props from TimelineTab, the leaf.
 */

type DataAttrs = Record<string, string>;
const MONTH_CARDS = 6;
const VIEW_ICONS: Readonly<Record<MomentsView, string>> = { time: "history", places: "home", areas: "grid_view" };
const VIEW_KEYS: Readonly<Record<MomentsView, string>> = {
  time: "companion.moments.view.time",
  places: "companion.moments.view.places",
  areas: "companion.moments.view.areas",
};
const RANGE_KEYS: Readonly<Record<MomentsRange, string>> = {
  3: "companion.portrait.three",
  12: "companion.portrait.year",
  0: "companion.portrait.entire",
};

export default function MomentsBody({ primaryMoveProps, toolbarModule, viewModule }: {
  primaryMoveProps: DataAttrs;
  toolbarModule: DataAttrs;
  viewModule: DataAttrs;
}) {
  const { childProfile, milestones, setActiveTab, seedCoach, openCaptureSheet, requestJournalFocus } = useArbor();
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  const copy = PORTRAIT_COPY[he ? "he" : "en"];
  const locale = he ? "he-IL" : "en-GB";
  const query = useHashQuery();
  const view = parseView(query.get("view"));
  const rawArea = query.get("area");
  const area: DomainId | null = isDomainId(rawArea) ? rawArea : null;
  const month = parseMonth(query.get("month"));
  const [range, setRange] = useState<MomentsRange>(3);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [selection, setSelection] = useState<{ childId: string; title: string; ids: string[]; domain?: DomainId } | null>(null);
  const [reviewSelection, setReviewSelection] = useState<{ childId: string; ids: string[] }>({ childId: childProfile.id, ids: [] });
  const [visible, setVisible] = useState(20);
  const compact = useCompactSurface();
  const Surface = compact ? Sheet : Modal;
  const tabsId = useId();
  const menuId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rangeRef = useRef<HTMLDivElement | null>(null);
  const rangeChipRef = useRef<HTMLButtonElement | null>(null);
  const rangeItemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const record = useObservationRecord();
  // Moments shows the parent's kept record only: a child's own practice, a
  // screening's answers and a measurement never enter a card or a count.
  const observations = useMemo(() => record.observations.filter(o => o.childId === childProfile.id && isMomentRecord(o)), [record.observations, childProfile.id]);
  const logMap = useMemo(() => new Map((record.sources.behaviorLogs ?? []).map(log => [`behaviorLogs:${log.id}`, log])), [record.sources.behaviorLogs]);
  const scoped = useMemo(() => filterByAreaMonth(observations, area, null), [observations, area]);
  const rangeBuckets = useMemo(() => monthBuckets(scoped, childProfile.id, new Date(), range), [scoped, childProfile.id, range]);
  // A month filter from an older column than the range shows is still honoured.
  const buckets = useMemo(() => (month && !rangeBuckets.some(bucket => bucket.id === month) ? monthBuckets(scoped, childProfile.id, new Date(), 0) : rangeBuckets), [rangeBuckets, scoped, childProfile.id, month]);
  const shownBuckets = useMemo(() => (month ? buckets.filter(bucket => bucket.id === month) : range === 0 ? buckets.filter(bucket => bucket.observations.length > 0) : buckets), [buckets, month, range]);
  const inView = useMemo(() => shownBuckets.flatMap(bucket => bucket.observations), [shownBuckets]);
  const places = useMemo(() => placeCards(inView), [inView]);
  // Across areas: oldest column first, over the range in view (a month filter belongs to the other views).
  const areaColumns = useMemo(() => [...rangeBuckets].reverse(), [rangeBuckets]);
  const tableColumns = `minmax(9rem, 1.4fr) repeat(${areaColumns.length}, minmax(3.25rem, 1fr))`;
  const areaRows = useMemo(() => {
    const rows = areaMonthCounts(areaColumns);
    return area ? rows.filter(row => row.domain === area) : rows;
  }, [areaColumns, area]);

  const selected = selection?.childId === childProfile.id ? selection : null;
  const reviewedIds = reviewSelection.childId === childProfile.id ? reviewSelection.ids : [];
  const selectedObservations = selected ? observations.filter(o => selected.ids.includes(o.id)).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)) : [];
  const closeSelection = useSheetHistory(!!selected, () => setSelection(null));

  // The range menu: focus moves into it on open (onto the checked item),
  // Arrow Up/Down, Home and End rove its items, Escape closes it and returns
  // focus to the chip, Tab closes it, and a pointer outside closes it.
  useEffect(() => {
    if (!menuOpen) return;
    rangeItemRefs.current[Math.max(0, MOMENTS_RANGES.indexOf(range))]?.focus();
    const away = (event: PointerEvent) => { if (rangeRef.current && !rangeRef.current.contains(event.target as Node)) setMenuOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
    // focus lands once per opening, not on every range change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);
  const closeMenu = (refocus: boolean) => {
    setMenuOpen(false);
    if (refocus) rangeChipRef.current?.focus();
  };
  const onChipKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    setMenuOpen(true);
  };
  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = rangeItemRefs.current.filter((item): item is HTMLButtonElement => !!item);
    const at = items.findIndex(item => item === document.activeElement);
    const last = items.length - 1;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeMenu(true); return; }
    if (event.key === "Tab") { setMenuOpen(false); return; }
    const next = event.key === "ArrowDown" ? (at < 0 || at === last ? 0 : at + 1)
      : event.key === "ArrowUp" ? (at <= 0 ? last : at - 1)
      : event.key === "Home" ? 0 : event.key === "End" ? last : -1;
    if (next < 0) return;
    event.preventDefault();
    items[next]?.focus();
  };

  const date = (at: string, year = false) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", ...(year ? { year: "numeric" as const } : {}) }).format(new Date(at));
  const monthLabel = (bucket: Pick<MonthBucket, "from">) => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(bucket.from);
  const multiYear = areaColumns.length > 0 && areaColumns[0].from.getFullYear() !== areaColumns[areaColumns.length - 1].from.getFullYear();
  const columnLabel = (bucket: MonthBucket) => new Intl.DateTimeFormat(locale, { month: "short", ...(multiYear ? { year: "2-digit" as const } : {}) }).format(bucket.from);
  const monthIdLabel = (id: string) => monthLabel({ from: new Date(Number(id.slice(0, 4)), Number(id.slice(5, 7)) - 1, 1) });
  const countLabel = (n: number) => (n === 1 ? t("companion.moments.countOne") : t("companion.moments.count", { n }));
  const sourceLabel = (o: Observation) => ({
    parent_typed: t("companion.portrait.parentTyped"),
    parent_voice: t("companion.portrait.parentVoice"),
    ai_proposed_parent_confirmed: t("companion.portrait.confirmed"),
    kid_practice: t("companion.portrait.childPractice"),
    professional_entered: t("companion.portrait.professional"),
    document_extracted: t("companion.portrait.document"),
    unverified: t("companion.portrait.unverified"),
  }[o.source]);
  const title = (o: Observation): string => {
    const v = o.value;
    switch (v.type) {
      case "moment": { const log = logMap.get(o.id); return log?.trigger?.trim() || log?.notes?.trim() || behaviorTypeLabel(v.behaviorType, t); }
      case "milestone": { const found = milestones.find(item => item.id === v.milestoneId); return found ? milestoneText(found, "title", t, { gender: childProfile.gender ?? null }) : v.title; }
      case "keepsake": return v.note;
      case "word": return v.phrase;
      case "goal_note": return v.text;
      case "fact": return v.fact;
      case "play": return v.title;
      case "practice": return o.origin === "speechAttempts" ? copy.speech : o.origin === "mimicSessions" ? copy.mimic : o.origin === "adventureResults" ? copy.adventure : o.origin === "missionRecords" ? copy.mission : t("companion.portrait.practice");
      case "measurement": return t("companion.portrait.measurement");
      case "check": return t("companion.portrait.check");
    }
  };

  const go = (next: { view?: MomentsView; area?: DomainId | null; month?: string | null }) => {
    const target = { view: next.view ?? view, area: next.area === undefined ? area : next.area, month: next.month === undefined ? month : next.month };
    goToRoute("timeline", { view: target.view, area: target.area ?? undefined, month: target.month ?? undefined });
  };
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const forward = he ? "ArrowLeft" : "ArrowRight";
    const back = he ? "ArrowRight" : "ArrowLeft";
    const last = MOMENTS_VIEWS.length - 1;
    const next = event.key === forward ? (index === last ? 0 : index + 1)
      : event.key === back ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0 : event.key === "End" ? last : -1;
    if (next < 0) return;
    event.preventDefault();
    tabRefs.current[next]?.focus();
    go({ view: MOMENTS_VIEWS[next] });
  };
  const select = (items: Observation[], heading: string, domain?: DomainId) => {
    setVisible(20);
    setReviewSelection({ childId: childProfile.id, ids: [] });
    setSelection({ childId: childProfile.id, title: heading, ids: items.map(o => o.id), domain });
  };
  const question = () => {
    const domains = selected?.domain ? [selected.domain] : [...new Set(selectedObservations.flatMap(o => o.domains))];
    return portraitDiscussionPrompt(domains, domain => domainName(domain, t), he);
  };
  const reviewedDraft = () => {
    const sources = selectedObservations.filter(o => reviewedIds.includes(o.id)).map(o => ({
      childId: o.childId, id: o.id, at: o.at, source: sourceLabel(o),
      text: [title(o), ...portraitEvidenceLines(o, record.sources, he).map(line => `${line.label}: ${line.text}`)].join("\n"),
    }));
    return reviewedPortraitDraft(question(), childProfile.id, sources, he);
  };
  const discuss = () => {
    if (!selected) return;
    const prompt = reviewedDraft();
    closeSelection(() => seedCoach({ prompt, source: "child-portrait" }));
  };
  const saveQuestion = () => {
    if (!selected) return;
    const draft = question();
    const observationIds = reviewedIds.length ? reviewedIds : selected.ids;
    closeSelection(() => openFamilyTopicSheet({ startNew: true, draft, observationIds }));
  };
  const openOriginal = (o: Observation) => closeSelection(() => {
    if (o.origin === "behaviorLogs") { openCaptureSheet({ editLogId: o.id.slice("behaviorLogs:".length), editLog: logMap.get(o.id) }); return; }
    if (o.origin === "milestones" && milestones.some(m => `milestones:${m.id}` === o.id)) { requestJournalFocus(`milestone-${o.id.slice("milestones:".length)}`); setActiveTab("journal"); return; }
    const routes: Partial<Record<ObservationOrigin, Parameters<typeof setActiveTab>[0]>> = { milestones: "milestones", keepsakes: "milestones", growthEntries: "profile", langObs: "language", screenings: "screening", memory: "memory", goalObservations: "practice", actionLoops: "journal", playLogs: "journal", practiceEvents: "journal", speechAttempts: "speech", mimicSessions: "mimic", adventureResults: "adventures", missionRecords: "journal" };
    setActiveTab(routes[o.origin] ?? "journal");
  });

  const filterLabel = [area ? domainName(area, t) : "", month ? monthIdLabel(month) : ""].filter(Boolean).join(" · ");
  const filterChip = (area || month) && view !== "areas" ? (
    <div className="moments-filter" data-moments-filter>
      <span dir="auto">{t("companion.moments.filtered", { filter: filterLabel })}</span>
      <button type="button" className="moments-text-button" onClick={() => go({ area: null, month: null })}>
        <Icon name="close" size={18} />{t("companion.moments.clearFilter")}
      </button>
    </div>
  ) : null;
  const keepButton = (
    <button type="button" {...primaryMoveProps} className="moments-keep" onClick={() => openCaptureSheet()}>
      <Icon name="add" size={20} />{t("companion.moments.keep")}
    </button>
  );
  const emptyRecord = !record.loading && !record.error && record.confirmed && observations.length === 0;

  const band = (o: Observation) => {
    const photo = logMap.get(o.id)?.photoAttachment;
    if (photo) return <div className="moments-band moments-band-photo"><img src={photo} alt={t("companion.portrait.photo")} loading="lazy" /></div>;
    const domain = o.domains[0];
    if (!domain) return <div className="moments-band" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink-soft)" }} aria-hidden="true"><Icon name="auto_stories" size={30} /></div>;
    return <div className="moments-band" style={{ background: `var(--arbor-domain-${domain}-soft)`, color: `var(--arbor-domain-${domain}-ink)` }} aria-hidden="true"><Icon name={DOMAIN_ICONS[domain]} size={30} /></div>;
  };

  return (
    <section className="moments" dir={he ? "rtl" : "ltr"} data-testid="moments-body">
      <h1 className="sr-only">{t("companion.moments.title")}</h1>
      <div {...toolbarModule} className="moments-toolbar">
        <div role="tablist" data-moments-views aria-label={t("companion.moments.tabs")} className="moments-views">
          {MOMENTS_VIEWS.map((key, index) => (
            <button key={key} type="button" role="tab" id={`${tabsId}-${key}`} aria-selected={view === key} aria-controls={`${tabsId}-panel`}
              tabIndex={view === key ? 0 : -1} ref={el => { tabRefs.current[index] = el; }}
              onClick={() => go({ view: key })} onKeyDown={event => onTabKey(event, index)}
              className="moments-view-tab min-h-11">
              <Icon name={VIEW_ICONS[key]} size={18} />{t(VIEW_KEYS[key])}
            </button>
          ))}
        </div>
        <div className="moments-range" ref={rangeRef}>
          <button type="button" ref={rangeChipRef} className="moments-chip" aria-haspopup="menu" aria-expanded={menuOpen} aria-controls={menuId}
            aria-label={t("companion.moments.rangeAria", { range: t(RANGE_KEYS[range]) })} onClick={() => setMenuOpen(open => !open)} onKeyDown={onChipKey}>
            <Icon name="calendar_month" size={18} />{t(RANGE_KEYS[range])}<Icon name="expand_more" size={18} />
          </button>
          {menuOpen && (
            <div role="menu" id={menuId} className="moments-menu" aria-label={t("companion.portrait.range")} onKeyDown={onMenuKey}>
              {MOMENTS_RANGES.map((option, index) => (
                <button key={option} type="button" role="menuitemradio" aria-checked={range === option} className="moments-menu-item"
                  tabIndex={range === option ? 0 : -1} ref={el => { rangeItemRefs.current[index] = el; }}
                  onClick={() => { setRange(option); closeMenu(true); }}>
                  {range === option ? <Icon name="check" size={18} /> : <span className="moments-menu-spacer" aria-hidden="true" />}{t(RANGE_KEYS[option])}
                </button>
              ))}
            </div>
          )}
        </div>
        {keepButton}
      </div>

      <div {...viewModule} role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${view}`} className="moments-panel">
        {record.loading && observations.length === 0 && <p className="moments-note" role="status"><Icon name="history" size={18} />{copy.loading}</p>}
        {record.error && <p className="moments-note" role="status"><Icon name="info" size={18} />{copy.failed}<button type="button" className="moments-text-button" onClick={record.reload}>{copy.retry}</button></p>}
        {emptyRecord ? (
          <div className="moments-empty">
            <h2>{t("companion.portrait.emptyAll")}</h2>
            <p>{t("companion.portrait.emptyAllSub")}</p>
          </div>
        ) : <>
          {filterChip}

          {view === "time" && <>
            <div className="moments-months">
              {shownBuckets.map(bucket => {
                const open = expanded.includes(bucket.id);
                const cards = open ? bucket.observations : bucket.observations.slice(0, MONTH_CARDS);
                return (
                  <section key={bucket.id} className="moments-month" data-moments-month={bucket.id}>
                    <header className="moments-month-head">
                      <h2>{monthLabel(bucket)}</h2>
                      {bucket.observations.length > 0 && <span>{countLabel(bucket.observations.length)}</span>}
                    </header>
                    {bucket.observations.length === 0 && <p className="moments-month-empty">{t("companion.moments.emptyMonth")}</p>}
                    {cards.map(o => (
                      <article key={o.id} className="moments-card" data-observation-id={o.id}>
                        {band(o)}
                        <div className="moments-card-body">
                          <div className="moments-src">
                            <span>{sourceLabel(o)} · {date(o.at)}</span>
                            <button type="button" className="moments-overflow" aria-label={t("companion.moments.overflow")}
                              onClick={() => select([o], date(o.at, true), o.domains[0])}>
                              <Icon name="more_horiz" size={20} />
                            </button>
                          </div>
                          <p className="moments-quote" dir="auto">{title(o)}</p>
                        </div>
                      </article>
                    ))}
                    {!open && bucket.observations.length > MONTH_CARDS && (
                      <button type="button" className="moments-text-button" onClick={() => setExpanded(ids => [...ids, bucket.id])}>
                        {t("companion.moments.showMore")}<Icon name="expand_more" size={18} />
                      </button>
                    )}
                  </section>
                );
              })}
            </div>
            <div className="moments-foot">
              <button type="button" className="moments-text-button" onClick={() => setActiveTab("journal")}>
                <Icon name="auto_stories" size={18} />{t("companion.moments.journal")}<Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" />
              </button>
              {record.more && !record.error && (
                <button type="button" className="moments-text-button" disabled={record.loading} onClick={record.loadMore}>
                  {record.loading ? copy.loading : t("companion.moments.loadMore")}<Icon name="expand_more" size={18} />
                </button>
              )}
            </div>
          </>}

          {view === "places" && <>
            {places.length === 0 ? <p className="moments-note">{t("companion.moments.placesEmpty")}</p> : (
              <div className="moments-places">
                {places.map(place => {
                  const latest = place.observations[0];
                  const label = t(PLACE_LABEL_KEYS[place.context]);
                  return (
                    <button key={place.context} type="button" className="moments-place" data-moments-place={place.context} onClick={() => select(place.observations, label)}>
                      <span className="moments-place-head">
                        <Icon name={PLACE_ICONS[place.context]} size={26} />
                        <span className="moments-place-label">{label}</span>
                      </span>
                      <span className="moments-place-count">{countLabel(place.observations.length)}</span>
                      <span className="moments-place-quote" dir="auto">{title(latest)}</span>
                      <span className="moments-place-date">{date(latest.at)}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="moments-note"><Icon name="info" size={18} />{t("companion.moments.placeNote")}</p>
          </>}

          {view === "areas" && <>
            <div className="moments-section-head">
              <h2>{t("companion.moments.threadTitle")}</h2>
              <p>{t("companion.moments.threadSub")}</p>
            </div>
            {area && (
              <div className="moments-filter" data-moments-filter>
                <span dir="auto">{t("companion.moments.filtered", { filter: domainName(area, t) })}</span>
                <button type="button" className="moments-text-button" onClick={() => go({ area: null, month: null })}>
                  <Icon name="close" size={18} />{t("companion.moments.clearFilter")}
                </button>
              </div>
            )}
            <div className="moments-table-scroll">
              <div role="table" aria-label={t("companion.moments.threadTitle")} className="moments-table">
                <div role="row" className="moments-row moments-row-head" style={{ gridTemplateColumns: tableColumns }}>
                  <span role="columnheader" className="moments-area-head">{t("companion.moments.area")}</span>
                  {areaColumns.map(bucket => <span role="columnheader" key={bucket.id} className="moments-col-head">{columnLabel(bucket)}</span>)}
                </div>
                {areaRows.map(row => (
                  <div role="row" key={row.domain} className="moments-row" data-moments-area={row.domain} style={{ gridTemplateColumns: tableColumns }}>
                    <span role="rowheader" className="moments-area-cell">
                      <button type="button" className="moments-area-button" onClick={() => go({ view: "time", area: row.domain, month: null })}>
                        <Icon name={DOMAIN_ICONS[row.domain]} size={20} style={{ color: `var(--arbor-domain-${row.domain}-ink)` }} />
                        <span>{domainName(row.domain, t)}</span>
                      </button>
                    </span>
                    {row.counts.map((n, i) => (
                      <span role="cell" key={areaColumns[i].id} className="moments-cell">
                        {n > 0 ? (
                          <button type="button" className="moments-bubble" data-moments-count={n}
                            style={{ background: `var(--arbor-domain-${row.domain}-soft)`, color: `var(--arbor-domain-${row.domain}-ink)` }}
                            aria-label={t("companion.moments.cellAria", { area: domainName(row.domain, t), month: monthLabel(areaColumns[i]), n })}
                            onClick={() => go({ view: "time", area: row.domain, month: areaColumns[i].id })}>
                            {n}
                          </button>
                        ) : (
                          <span className="moments-blank"><span aria-hidden="true">—</span><span className="sr-only">{t("companion.portrait.noRecord")}</span></span>
                        )}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <p className="moments-note"><Icon name="info" size={18} />{t("companion.moments.areasNote")}</p>
          </>}
        </>}
      </div>

      <Surface open={!!selected} onClose={() => closeSelection()} scrimBlur title={selected?.title ?? t("companion.portrait.sourceTitle")} maxWidth="max-w-2xl">
        <SheetBreadcrumb label={selected?.title ?? t("companion.portrait.sourceTitle")} close={closeSelection} />
        <div className="moments-evidence" dir={he ? "rtl" : "ltr"}>
          {selectedObservations.length === 0 && <p>{t("companion.portrait.noDomain")}</p>}
          {selectedObservations.length > 0 && <p className="moments-note">{copy.selectionHint}</p>}
          {selectedObservations.slice(0, visible).map(o => {
            const chosen = reviewedIds.includes(o.id);
            const lines = portraitEvidenceLines(o, record.sources, he);
            const keepsake = o.origin === "keepsakes" ? record.sources.keepsakes?.find(item => `keepsakes:${item.milestoneId}` === o.id) : undefined;
            const photo = logMap.get(o.id)?.photoAttachment ?? keepsake?.photoUrl;
            const place = o.value.type === "moment" && o.value.context && o.value.context in PLACE_LABEL_KEYS ? t(PLACE_LABEL_KEYS[o.value.context as keyof typeof PLACE_LABEL_KEYS]) : "";
            return (
              <article key={o.id} className="moments-evidence-item" data-observation-id={o.id}>
                <div className="moments-evidence-meta"><time dateTime={o.at}>{date(o.at, true)}</time><span>{sourceLabel(o)}</span></div>
                {photo && <img className="moments-evidence-photo" src={photo} alt={t("companion.portrait.photo")} loading="lazy" />}
                <h3>{copy.original}</h3>
                <p className="moments-quote" dir="auto">{title(o)}</p>
                {lines.length > 0 && <dl className="moments-evidence-details">{lines.map((line, index) => <div key={`${line.label}-${index}`}><dt>{line.label}</dt><dd dir="auto">{line.text}</dd></div>)}</dl>}
                {place && <p className="moments-meta">{t("companion.portrait.contextLabel")}: {place}</p>}
                <p className="moments-meta">{o.domains.length ? o.domains.map(domain => domainName(domain, t)).join(" · ") : copy.unfiled}</p>
                <label className="moments-select">
                  <input type="checkbox" checked={chosen} disabled={!chosen && reviewedIds.length >= 5}
                    onChange={() => setReviewSelection({ childId: childProfile.id, ids: chosen ? reviewedIds.filter(id => id !== o.id) : [...reviewedIds, o.id].slice(0, 5) })} />
                  <span>{copy.select}</span>
                </label>
                <button type="button" className="moments-text-button" onClick={() => openOriginal(o)}>
                  {o.origin === "behaviorLogs" ? t("companion.portrait.sourceOpen") : o.origin === "milestones" && milestones.some(m => `milestones:${m.id}` === o.id) ? copy.journal : copy.library}
                  <Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" />
                </button>
              </article>
            );
          })}
          {selectedObservations.length > visible && <button type="button" className="moments-text-button" onClick={() => setVisible(n => n + 20)}>{t("companion.portrait.more")}</button>}
          <aside className="moments-interpretation"><h3>{t("companion.portrait.interpretation")}</h3><p>{t("companion.portrait.interpretationText")}</p></aside>
          <div className="moments-evidence-actions">
            <button type="button" className="moments-keep" onClick={discuss}>
              <Icon name="chat_bubble" size={20} />{reviewedIds.length ? copy.discuss : copy.none}
            </button>
            <button type="button" className="moments-text-button" onClick={saveQuestion}>
              <Icon name="bookmark" size={18} />{copy.saveQuestion}
            </button>
          </div>
          {reviewedIds.length > 0 && <p className="moments-note">{copy.shortened}</p>}
        </div>
      </Surface>

    </section>
  );
}
