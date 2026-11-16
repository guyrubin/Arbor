import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useObservationRecord } from "../../hooks/useObservationRecord";
import { goToRoute, useHashQuery } from "../../hooks/useHashQuery";
import { useSheetHistory } from "../../hooks/useSheetHistory";
import { domainName, isDomainId, type DomainId } from "../../lib/domains/registry";
import { DOMAIN_ICONS } from "../../lib/domains/icons";
import type { Observation, ObservationOrigin } from "../../lib/observations";
import { milestoneText } from "../../lib/milestoneData";
import { noticeMilestoneId, openNoticeDetail } from "../../lib/noticeNavigation";
import { NOTICE_DETAIL_COPY } from "../companion/noticeDetailCopy";
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
  areaMonthCounts, filterByAreaMonth, isKind, isMomentRecord, kindCounts, monthBuckets, MOMENTS_KINDS, MOMENTS_RANGES, MOMENTS_VIEWS, parseKind, parseMonth, parseView, placeCards, placeOf,
  type MomentsKind, type MomentsRange, type MomentsView, type MonthBucket,
} from "./momentsModel";
import { DsRoot, Guide, MoreLink, Route, RouteHead, RouteSection, Scene, StartHere, Tile } from "../../design/primitives";
import { useComposition } from "../../design/useComposition";
import { useObservations } from "../../hooks/useObservations";
import { shelfCoverage } from "../../lib/milestones/selectByShelf";
import { shelfLabel } from "../../lib/shelves/registry";
import MomentsAreas from "./v10/MomentsAreas";
import MomentsByKind, { type KindObject } from "./v10/MomentsByKind";
import MomentsNewest, { type NewestLabels } from "./v10/MomentsNewest";
import MomentsShelves from "./v10/MomentsShelves";
import { STAGE_ORBS } from "./v10/stageOrbs";
import KeptThingsPage from "../kept/KeptThingsPage";
import { MOMENTS_V10_COPY } from "./momentsV10Copy";
import "./moments.css";
import "./mychild.css";

/**
 * F-CHILD-2 — Moments (#/timeline): the parent's kept record seen three ways —
 * across areas (one card per area: its months as plain counts and the newest
 * words), over time (month columns, newest first) and by place (only places
 * the parent recorded). Counts only: no rates, no shares, no colour scale by
 * value, no progress shape. Each card's overflow opens the evidence sheet
 * (Discuss · Save question · Open the original). The route's stamps arrive as
 * props from TimelineTab, the leaf.
 *
 * v4 (consolidation): Across areas leads; the views are one segmented control;
 * beside them, which moments are in view — All · Kept · Hard moments · Things
 * <name> said (?kind=) — so the hard-moments list, the kept things and the
 * words are filters of this one record, each with a quiet door to its full
 * page (#/behaviors logs and patterns, #/language the words). The time range
 * (3 months · a year · everything) moved out of the toolbar to the panel's
 * head, where it reads as a property of what is shown.
 */

type DataAttrs = Record<string, string>;
const MONTH_CARDS = 6;
const VIEW_KEYS: Readonly<Record<MomentsView, string>> = {
  time: "companion.moments.view.time",
  places: "companion.moments.view.places",
  areas: "companion.moments.view.areas",
};
const KIND_KEYS: Readonly<Record<Exclude<MomentsKind, "said">, string>> = {
  all: "companion.moments.kind.all",
  kept: "companion.moments.kind.kept",
  hard: "companion.moments.kind.hard",
};
const RANGE_KEYS: Readonly<Record<MomentsRange, string>> = {
  3: "companion.portrait.three",
  12: "companion.portrait.year",
  0: "companion.portrait.entire",
};

export default function MomentsBody({ primaryMoveProps, toolbarModule, viewModule, sectionModules }: {
  primaryMoveProps: DataAttrs;
  toolbarModule: DataAttrs;
  viewModule: DataAttrs;
  /** v10: the three sections below the stage (By kind · The newest moment · Shelf by shelf). */
  sectionModules: { kinds: DataAttrs; newest: DataAttrs; shelves: DataAttrs };
}) {
  const { childProfile, milestones, setActiveTab, seedCoach, openCaptureSheet } = useArbor();
  const { user } = useAuth();
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  const copy = PORTRAIT_COPY[he ? "he" : "en"];
  const noticeCopy = NOTICE_DETAIL_COPY[he ? "he" : "en"];
  const locale = he ? "he-IL" : "en-GB";
  const query = useHashQuery();
  const rawArea = query.get("area");
  const area: DomainId | null = isDomainId(rawArea) ? rawArea : null;
  const month = parseMonth(query.get("month"));
  // A link that names an area, a month or one observation opens Over time.
  const view = parseView(query.get("view"), !!(area || month || query.get("observation")));
  const kind = parseKind(query.get("kind"));
  // v10.1: Moments, kind Kept, the reader (the year book): #/timeline?kind=kept&reader=book[&year=YYYY].
  const reader = kind === "kept" && query.get("reader") === "book";
  const openReader = (year?: string) => goToRoute("timeline", { kind: "kept", reader: "book", year });
  const firstName = (childProfile.name || "").trim().split(/\s+/)[0] || t("companion.together-view.your-child");
  const [range, setRange] = useState<MomentsRange>(3);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [selection, setSelection] = useState<{ childId: string; title: string; ids: string[]; domain?: DomainId } | null>(null);
  const [dismissedSource, setDismissedSource] = useState<string | null>(null);
  const [reviewSelection, setReviewSelection] = useState<{ childId: string; ids: string[] }>({ childId: childProfile.id, ids: [] });
  const [visible, setVisible] = useState(20);
  const compact = useCompactSurface();
  const composition = useComposition();
  const desk = composition === "desk";
  const v = MOMENTS_V10_COPY[he ? "he" : "en"];
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
  // v10: newest first, for The newest moment and Latest, by date.
  const newestFirst = useMemo(() => [...observations].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)), [observations]);
  const newest = newestFirst[0] ?? null;
  const latestThree = newestFirst.slice(0, 3);
  // Shelf by shelf counts exactly what the journal's shelf grid counts (the last 30 days).
  const shelfSource = useObservations();
  const shelfCounts = useMemo(() => shelfCoverage(shelfSource, new Date()), [shelfSource]);
  const parentInitial = (user?.displayName || "").trim().charAt(0).toUpperCase();
  const sourceScope = `${user?.uid ?? "signed-out"}:${childProfile.id}`;
  const sourceOwnerRef = useRef({ key: sourceScope, active: true });
  if (sourceOwnerRef.current.key !== sourceScope) {
    sourceOwnerRef.current.active = false;
    sourceOwnerRef.current = { key: sourceScope, active: true };
  }
  const sourceOwner = sourceOwnerRef.current;
  useEffect(() => { sourceOwner.active = true; return () => { sourceOwner.active = false; }; }, [sourceOwner]);
  const currentSource = useRef({ record, observations, milestones });
  currentSource.current = { record, observations, milestones };
  const logMap = useMemo(() => new Map((record.sources.behaviorLogs ?? []).map(log => [`behaviorLogs:${log.id}`, log])), [record.sources.behaviorLogs]);
  // v4: the kind filter narrows first; its counts are read before it, over the range and area in view.
  const areaScoped = useMemo(() => filterByAreaMonth(observations, area, null), [observations, area]);
  const counts = useMemo(() => kindCounts(monthBuckets(areaScoped, childProfile.id, new Date(), range).flatMap(bucket => bucket.observations)), [areaScoped, childProfile.id, range]);
  const scoped = useMemo(() => areaScoped.filter(o => isKind(o, kind)), [areaScoped, kind]);
  const rangeBuckets = useMemo(() => monthBuckets(scoped, childProfile.id, new Date(), range), [scoped, childProfile.id, range]);
  // A month filter from an older column than the range shows is still honoured.
  const buckets = useMemo(() => (month && !rangeBuckets.some(bucket => bucket.id === month) ? monthBuckets(scoped, childProfile.id, new Date(), 0) : rangeBuckets), [rangeBuckets, scoped, childProfile.id, month]);
  const shownBuckets = useMemo(() => (month ? buckets.filter(bucket => bucket.id === month) : range === 0 ? buckets.filter(bucket => bucket.observations.length > 0) : buckets), [buckets, month, range]);
  const inView = useMemo(() => shownBuckets.flatMap(bucket => bucket.observations), [shownBuckets]);
  const places = useMemo(() => placeCards(inView), [inView]);
  // Across areas: oldest column first, over the range in view (a month filter belongs to the other views).
  const areaColumns = useMemo(() => [...rangeBuckets].reverse(), [rangeBuckets]);
  const areaRows = useMemo(() => {
    const rows = areaMonthCounts(areaColumns);
    return area ? rows.filter(row => row.domain === area) : rows;
  }, [areaColumns, area]);
  // The newest moment per area in the range (buckets and their rows are newest first).
  const latestByDomain = useMemo(() => {
    const latest = new Map<DomainId, Observation>();
    for (const bucket of rangeBuckets) for (const o of bucket.observations) for (const d of o.domains) if (!latest.has(d)) latest.set(d, o);
    return latest;
  }, [rangeBuckets]);

  // ID-only deep links resolve against the current child's live reader. A
  // removed response cannot linger as an old source copied into route state.
  const requestedId = query.get("child") === childProfile.id ? query.get("observation") : null;
  const requestKey = requestedId ? `${childProfile.id}:${requestedId}` : null;
  const requestedObservation = requestedId && dismissedSource !== requestKey && record.confirmed && !record.error ? observations.find((o) => o.id === requestedId) : null;
  const selected = selection?.childId === childProfile.id ? selection : requestedObservation ? {
    childId: childProfile.id, title: noticeCopy.title, ids: [requestedObservation.id], domain: requestedObservation.domains[0],
  } : null;
  const reviewedIds = reviewSelection.childId === childProfile.id ? reviewSelection.ids : [];
  const selectedObservations = selected ? observations.filter(o => selected.ids.includes(o.id)).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)) : [];
  const closeSelection = useSheetHistory(!!selected, () => { setSelection(null); if (requestKey) setDismissedSource(requestKey); });

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

  // A note's YYYY-MM-DD is the day the parent chose, not midnight UTC.
  const date = (at: string, year = false) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", ...(year ? { year: "numeric" as const } : {}) }).format(new Date(/^\d{4}-\d{2}-\d{2}$/.test(at) ? `${at}T12:00:00` : at));
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

  const go = (next: { view?: MomentsView; area?: DomainId | null; month?: string | null; kind?: MomentsKind }) => {
    const target = { view: next.view ?? view, area: next.area === undefined ? area : next.area, month: next.month === undefined ? month : next.month, kind: next.kind ?? kind };
    goToRoute("timeline", { view: target.view, area: target.area ?? undefined, month: target.month ?? undefined, kind: target.kind === "all" ? undefined : target.kind });
  };
  const kindLabel = (key: MomentsKind) => (key === "said" ? t("companion.moments.kind.said", { name: firstName }) : t(KIND_KEYS[key]));
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
  const openMomentCard = (o: Observation) => {
    if (sourceOwnerRef.current !== sourceOwner || !sourceOwner.active) return;
    const milestoneId = noticeMilestoneId(o.origin, o.id);
    if (milestoneId && currentSource.current.milestones.some((m) => m.id === milestoneId)) {
      openNoticeDetail(childProfile.id, milestoneId);
      return;
    }
    select([o], date(o.at, true), o.domains[0]);
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
    // Closing a sheet completes after browser Back. Re-resolve the exact row
    // then; a child switch or removed source cannot open a held preview.
    const current = currentSource.current;
    if (sourceOwnerRef.current !== sourceOwner || !sourceOwner.active || !current.record.confirmed || current.record.error) return;
    const source = current.observations.find((item) => item.id === o.id && item.childId === childProfile.id);
    if (!source) return;
    if (source.origin === "behaviorLogs") {
      const original = current.record.sources.behaviorLogs?.find((log) => `behaviorLogs:${log.id}` === source.id);
      if (original) openCaptureSheet({ editLogId: original.id, editLog: original });
      return;
    }
    const milestoneId = noticeMilestoneId(source.origin, source.id);
    if (milestoneId && current.milestones.some((m) => m.id === milestoneId)) { openNoticeDetail(childProfile.id, milestoneId); return; }
    const routes: Partial<Record<ObservationOrigin, Parameters<typeof setActiveTab>[0]>> = { milestones: "milestones", keepsakes: "milestones", growthEntries: "profile", langObs: "language", screenings: "screening", memory: "memory", goalObservations: "practice", actionLoops: "journal", playLogs: "journal", practiceEvents: "journal", speechAttempts: "speech", mimicSessions: "mimic", adventureResults: "adventures", missionRecords: "journal" };
    setActiveTab(routes[source.origin] ?? "journal");
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
  const emptyRecord = !record.loading && !record.error && record.confirmed && observations.length === 0;
  // v4: the time range (3 months · a year · everything) — a property of what is
  // shown, so it sits with the panel (its head, or the areas legend), never in the toolbar.
  const rangeControl = (
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
  );

  const band = (o: Observation) => {
    const keepsake = o.origin === "keepsakes" ? record.sources.keepsakes?.find((item) => `keepsakes:${item.milestoneId}` === o.id) : undefined;
    const photo = logMap.get(o.id)?.photoAttachment ?? keepsake?.photoUrl;
    if (photo) return <div className="moments-band moments-band-photo"><img src={photo} alt={t("companion.portrait.photo")} loading="lazy" /></div>;
    const domain = o.domains[0];
    if (!domain) return <div className="moments-band" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink-soft)" }} aria-hidden="true"><Icon name="auto_stories" size={30} /></div>;
    return <div className="moments-band" style={{ background: `var(--arbor-domain-${domain}-soft)`, color: `var(--arbor-domain-${domain}-ink)` }} aria-hidden="true"><Icon name={DOMAIN_ICONS[domain]} size={30} /></div>;
  };

  // ── v10 composition ─────────────────────────────────────────────────────────
  const viewSwitch = (
    <div {...primaryMoveProps} role="tablist" data-moments-views aria-label={t("companion.moments.tabs")} className="vseg">
      {MOMENTS_VIEWS.map((key, index) => (
        <button key={key} type="button" role="tab" id={`${tabsId}-${key}`} aria-selected={view === key} aria-controls={`${tabsId}-panel`}
          tabIndex={view === key ? 0 : -1} ref={el => { tabRefs.current[index] = el; }}
          onClick={() => go({ view: key })} onKeyDown={event => onTabKey(event, index)}
          className={view === key ? "on min-h-11" : "min-h-11"}>
          {t(VIEW_KEYS[key])}
        </button>
      ))}
    </div>
  );
  const kindChips = (
    <div role="group" data-moments-kinds aria-label={t("companion.moments.kinds")} className="kchips">
      {MOMENTS_KINDS.map(key => (
        <button key={key} type="button" className={kind === key ? "kchip on" : "kchip"} data-moments-kind={key} aria-pressed={kind === key} onClick={() => go({ kind: key })}>
          <span dir="auto">{kindLabel(key)}</span>
          {counts[key] > 0 && <b className="arbor-num">{counts[key]}</b>}
        </button>
      ))}
    </div>
  );
  const kindDoor = kind === "hard" ? (
    <MoreLink className="kdoor" onClick={() => setActiveTab("behaviors")}>{t("companion.moments.kind.hardDoor")}</MoreLink>
  ) : kind === "said" ? (
    <MoreLink className="kdoor" onClick={() => setActiveTab("language")}>{t("companion.moments.kind.saidDoor", { name: firstName })}</MoreLink>
  ) : null;

  const panel = (
    <div {...viewModule} role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${view}`} className="mpanel">
      {!reader && view !== "areas" && (filterChip || view === "time" || view === "places") && (
        <div className="line between mhead">{filterChip ?? <span />}{rangeControl}</div>
      )}
      {requestedId && dismissedSource !== requestKey && !requestedObservation && !record.loading && <div className="moments-note" role="status" data-testid="moments-source-unavailable">
        <span>{record.error || !record.confirmed ? noticeCopy.loadFailed : noticeCopy.missing}</span>
        {record.more && <button type="button" className="moments-text-button" onClick={record.loadMore}>{t("companion.moments.loadMore")}</button>}
      </div>}
      {record.loading && observations.length === 0 && <p className="moments-note" role="status"><Icon name="history" size={18} />{copy.loading}</p>}
      {record.error && <p className="moments-note" role="status"><Icon name="info" size={18} />{copy.failed}<button type="button" className="moments-text-button" onClick={record.reload}>{copy.retry}</button></p>}
      {reader ? (
        <KeptThingsPage key={childProfile.id} onOpenYear={openReader} />
      ) : emptyRecord ? (
        <div className="moments-empty">
          <h2>{t("companion.portrait.emptyAll")}</h2>
          <p>{t("companion.portrait.emptyAllSub")}</p>
        </div>
      ) : <>
        {view === "time" && (
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
                        <button type="button" className="moments-card-open" data-testid="moments-card-open" onClick={() => openMomentCard(o)} aria-label={`${noticeCopy.open}: ${title(o)}`}>
                          <span className="moments-quote" dir="auto">{title(o)}</span>
                        </button>
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
        )}

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
          <p className="line1">{t("companion.moments.placeNote")}</p>
        </>}

        {view === "areas" && <>
          {area && (
            <div className="moments-filter" data-moments-filter>
              <span dir="auto">{t("companion.moments.filtered", { filter: domainName(area, t) })}</span>
              <button type="button" className="moments-text-button" onClick={() => go({ area: null, month: null })}>
                <Icon name="close" size={18} />{t("companion.moments.clearFilter")}
              </button>
            </div>
          )}
          <MomentsAreas composition={composition} rows={areaRows} columns={areaColumns} listLabel={t("companion.moments.threadTitle")}
            latest={domain => { const o = latestByDomain.get(domain); return o ? title(o) : ""; }}
            labels={{
              areaName: domain => domainName(domain, t),
              total: n => (desk ? `${countLabel(n)} · ${t(RANGE_KEYS[range])}` : countLabel(n)),
              none: t("companion.moments.cardNone"),
              noRecord: t("companion.portrait.noRecord"),
              momentToken: v.tokenMoment,
              cellAria: (domain, column, n) => t("companion.moments.cellAria", { area: domainName(domain, t), month: monthLabel(column), n }),
              columnLabel,
            }}
            onOpenArea={domain => go({ view: "time", area: domain, month: null })}
            onOpenCell={(domain, column) => go({ view: "time", area: domain, month: column.id })} />
          <div className="mlegend">
            {rangeControl}
            {areaColumns.length > 4 && <span>{t("companion.moments.legendSpan", { from: columnLabel(areaColumns[0]), to: columnLabel(areaColumns[areaColumns.length - 1]) })}</span>}
            <span>{t("companion.moments.areasNote")}</span>
          </div>
        </>}
      </>}
    </div>
  );

  const stage = (
    <Scene field="child" className="mstage" orbs={STAGE_ORBS[composition]}>
      <div {...toolbarModule} className="mstack mtools">
        <div className={desk ? "line between mtop" : "mstack mtop"}>
          <div className="mstack" style={{ gap: 6 }}>
            <span className="gsec"><span className="kicker">{t("companion.moments.title")} · {reader ? t("kept.yearBook") : t(VIEW_KEYS[view])}</span><StartHere>{v.startHere}</StartHere></span>
            <h1 className="hero">{reader ? v.headline.reader : v.headline[view]}</h1>
          </div>
          {/* The reader is one reading, not a view of the record: no view switch. */}
          {reader ? null : desk ? viewSwitch : <div className="mscroll">{viewSwitch}</div>}
        </div>
        {desk ? kindChips : <div className="mscroll">{kindChips}</div>}
        {kindDoor}
      </div>
      {panel}
    </Scene>
  );

  const kindObjects: KindObject[] = [
    { id: "hard", kicker: t("companion.moments.kind.hard"), figure: counts.hard > 0 ? { n: counts.hard, unit: v.hardUnit } : undefined, title: t("companion.moments.kind.hard"), sub: t("companion.moments.kind.hardDoor"), onOpen: () => setActiveTab("behaviors"), testId: "moments-kind-door-hard" },
    { id: "said", kicker: kindLabel("said"), figure: counts.said > 0 ? { n: counts.said, unit: v.saidUnit(counts.said) } : undefined, title: kindLabel("said"), sub: t("companion.moments.kind.saidDoor", { name: firstName }), onOpen: () => setActiveTab("language"), testId: "moments-kind-door-said" },
    { id: "kept", kicker: t("companion.moments.kind.kept"), title: v.keptTitle, sub: v.keptSub, onOpen: () => openReader(), testId: "moments-kind-kept" },
    { id: "time", kicker: t("companion.moments.view.time"), title: t("elev.shelfJournal.all"), sub: v.timeSub, onOpen: () => goToRoute("journal", { view: "all" }), testId: "moments-everything" },
  ];
  const byKind = <MomentsByKind composition={composition} title={v.byKind} items={kindObjects} snapLabel={v.byKind} />;

  const newestLabels: NewestLabels = {
    went: v.newestWent,
    by: o => (o.source === "parent_typed" || o.source === "parent_voice" ? v.youWrote(date(o.at, true)) : `${sourceLabel(o)} · ${date(o.at, true)}`),
    asTyped: o => (o.source === "parent_typed" ? v.keptAsTyped : null),
    title,
    shelf: o => (o.shelf ? v.shelfIs(shelfLabel(o.shelf, t)) : null),
    arborSuggests: v.arborFiled,
    onTheMap: v.onTheMap,
    areas: o => o.domains.map(d => domainName(d, t)).join(" · "),
    seeOnMap: v.seeOnMap,
    more: t("companion.moments.overflow"),
    byPlace: t("companion.moments.view.places"),
    open: t("companion.moments.open"),
    placeNote: t("companion.moments.placeNote"),
    latest: v.latestByDate,
    everything: t("elev.shelfJournal.all"),
    day: o => { const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(o.at) ? `${o.at}T12:00:00` : o.at); return { wd: new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d), d: new Intl.DateTimeFormat(locale, { day: "numeric" }).format(d) }; },
    meta: o => [placeOf(o) ? t(PLACE_LABEL_KEYS[placeOf(o) as keyof typeof PLACE_LABEL_KEYS]) : "", o.domains[0] ? domainName(o.domains[0], t) : "", isKind(o, "hard") ? t("companion.moments.kind.hard") : ""].filter(Boolean).join(" · "),
    tokenLabel: o => (isKind(o, "hard") ? v.tokenHard : v.tokenMoment),
    isHard: o => isKind(o, "hard"),
    nothing: v.nothingNewest,
  };
  const newestSection = (
    <MomentsNewest composition={composition} newest={newest} latest={latestThree} labels={newestLabels} initial={parentInitial}
      places={placeCards(rangeBuckets.flatMap(bucket => bucket.observations)).map(p => ({ id: p.context, label: t(PLACE_LABEL_KEYS[p.context]), observations: p.observations }))}
      onOpen={o => select([o], date(o.at, true), o.domains[0])} onMap={() => setActiveTab("development")}
      onPlaces={() => go({ view: "places" })} onEverything={() => goToRoute("journal", { view: "all" })} onOpenLatest={openMomentCard} />
  );
  const shelvesSection = (
    <MomentsShelves composition={composition} counts={shelfCounts} newestShelf={newest?.shelf ?? null} label={id => shelfLabel(id, t)}
      nothingYet={t("elev.shelfJournal.nothingYetShort")} tokenLabel={v.tokenMoment} onOpen={id => goToRoute("journal", { shelf: id })} />
  );
  // One door each, on both compositions (F-INT-1: one control opens the journal).
  const doors = (
    <nav className="mdoors" aria-label={v.doors}>
      {([
        ["moments-year-book", t("kept.yearBook"), () => openReader()],
        ["moments-journal-door", t("companion.moments.journal"), () => setActiveTab("journal")],
        ["moments-pro-door", t("elev.shelfJournal.flip"), () => goToRoute("journal", { view: "pro" })],
      ] as const).map(([id, label, open]) => (
        <button key={id} type="button" className="ds-link" data-testid={id} onClick={open}>
          {label}<Icon name="chevron_right" size={16} className="rtl:-scale-x-100" />
        </button>
      ))}
      {view === "time" && !emptyRecord && record.more && !record.error && (
        <button type="button" className="ds-link" disabled={record.loading} onClick={record.loadMore}>
          {record.loading ? copy.loading : t("companion.moments.loadMore")}<Icon name="expand_more" size={16} />
        </button>
      )}
    </nav>
  );
  const guideStops = desk
    ? [
      { id: "m-areas", title: reader ? t("kept.yearBook") : t(VIEW_KEYS[view]), sub: reader ? v.keptSub : `${v.guideAreasSub(areaRows.length)} · ${t(RANGE_KEYS[range])}` },
      { id: "m-kinds", title: v.byKind, sub: v.byKindSub },
      { id: "m-newest", title: v.newest, sub: v.newestSub },
      { id: "m-shelves", title: v.shelves, sub: v.shelvesSub },
    ]
    : [
      { id: "m-areas", title: reader ? t("kept.yearBook") : view === "areas" ? v.guideShort.areas : t(VIEW_KEYS[view]) },
      { id: "m-kinds", title: v.guideShort.kinds },
      { id: "m-newest", title: v.guideShort.newest },
      { id: "m-shelves", title: v.guideShort.shelves },
    ];

  return (
    <DsRoot composition={composition} className="ds-mychild moments-v10" dir={he ? "rtl" : "ltr"} data-testid="moments-body">
      <Guide stops={guideStops} mini={!desk} label={v.onThisPage} />
      <Route composition={composition}>
        {desk ? (
          <RouteSection id="m-areas" n={1} on>
            <div className="rowa">
              <div className="stg">{stage}</div>
              <aside {...sectionModules.kinds} className="rlc" id="m-kinds">{byKind}</aside>
            </div>
          </RouteSection>
        ) : <>
          <RouteSection id="m-areas" n={1} on>{stage}</RouteSection>
          <RouteSection id="m-kinds" n={2}><div {...sectionModules.kinds} className="mstack" style={{ gap: 12 }}>{byKind}</div></RouteSection>
        </>}
        <RouteSection id="m-newest" n={3}>
          <div {...sectionModules.newest} className="mstack" style={{ gap: 14 }}>
            <RouteHead title={v.newest} />
            {newestSection}
          </div>
        </RouteSection>
        <RouteSection id="m-shelves" n={4}>
          <div {...sectionModules.shelves} className="mstack" style={{ gap: 14 }}>
            <Tile icon="eco" title={v.shelves} sub={desk ? v.legend : undefined} className="mshelves">
              {shelvesSection}
              {!desk && <p className="line1">{v.legend}</p>}
            </Tile>
            {doors}
          </div>
        </RouteSection>
      </Route>

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
                <button type="button" className="moments-text-button" data-testid="moments-open-source" disabled={!record.confirmed || record.error} onClick={() => openOriginal(o)}>
                  {o.origin === "behaviorLogs" ? t("companion.portrait.sourceOpen") : noticeMilestoneId(o.origin, o.id) && milestones.some(m => m.id === noticeMilestoneId(o.origin, o.id)) ? noticeCopy.open : copy.library}
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
    </DsRoot>
  );
}
