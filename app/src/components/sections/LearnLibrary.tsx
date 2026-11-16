/**
 * Learn Library — Academy's browsable developmental-education shelf.
 *
 * The clarity+capture surface: every read is a Learn Card (5 key points →
 * full read → one thing to try today), saveable in one tap, shareable, and
 * wired into Ask Arbor via the seedCoach seam (prefill only, parent sends).
 *
 * Personalization is explainable and nothing more: the child's age and the
 * Development Map focus domain float matching cards up, and the rail says so
 * in one sentence. FRAMING GATE (inherited from Scholar Hub AP-055): the
 * focus domain is an opportunity to nurture, never a deficit.
 *
 * Static catalogue, no AI call at browse time, no child-data write beyond
 * the bookmark (card id only). TOKEN-DRIVEN styling; HE/RTL via logical CSS.
 */
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { cardCls } from "../ui/kit";
import { PASTEL } from "../../lib/tokens";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useDevScore } from "../../hooks/useDevScore";
import { useArborVoice } from "../../hooks/useArborVoice";
import { ageMonthsFromProfile, ageYearsFromProfile } from "../../lib/childAge";
import { filterByAge, loadShowAllAges, saveShowAllAges, windowFromYears } from "../../lib/ageFilter";
import { agefilterText } from "../../lib/i18nElevation/agefilter";
import { track } from "../../lib/analytics";
import { concernsForBehaviors } from "../../content/selectCards";
import { recentBehaviorTypes } from "../../content/hardMomentSurface";
import { readLearnFeedback, setLearnFeedback, type LearnFeedback } from "../../learn/learnFeedback";
import { learnReadCount, markLearnCardRead, readLearnReadIds } from "../../learn/learnReadState";
import {
  LEARN_CATEGORIES,
  concernsContributed,
  continuesSaved,
  learnCategoryById,
  learnContinuationTopics,
  rankLearnCards,
  searchLearnCards,
  type LearnCard,
  type LearnCategoryId,
  type LearnRankSignals,
} from "../../learn/learnLibrary";
import { continueText } from "../../lib/i18nElevation/continue";
import { LEARN_CARDS, learnCardById } from "../../learn/learnCards";
import { isLearnPilotCard, learnPilotText } from "../../learn/learnPilotRelease";
import { focusDomainContributed, pickDayKey, todaysLearnPick } from "../../learn/todaysPick";
import { ContentActionBar, ContentWhyLine } from "../ui/ContentActionBar";
import { TrustLink } from "../trust/TrustLink";
import { MasterclassReader, loadDone as loadCourseDone } from "./Masterclasses";
import { MASTERCLASSES } from "../../lib/masterclasses";
import { DOMAIN_ART, EMPTY_ART, type ParentArt } from "../../lib/parentArt";
// v10.1 — the design system's Library composition (N-Library-D / N-Library-M).
import { DsRoot, Guide, MoreLink, Route, RouteHead, RouteSection, Row12, Scene, SideRail, Snap, SnapDots, StartHere, type GuideStop } from "../../design/primitives";
import { useComposition } from "../../design/useComposition";
import { forYouCopy } from "../foryou/forYouCopy";
import { AreaForm } from "../foryou/AreaForm";
import { pickShortReads } from "../../learn/shortReads";
import { courseArea, readArea } from "../../learn/courseAreas";
import "../foryou/foryou.css";

// B-PLAY-17: "courses" lists the Masterclasses inside the Library (same age switch).
type Filter = "all" | "saved" | "courses" | LearnCategoryId;

/**
 * R12 — how many reads the browse shelf shows before the parent asks for more.
 *
 * The age filter is ON and IS applied (filterByAge below); it removes 14 of 93
 * cards for a five-year-old, because 79 of the 93 declare a band that really
 * does contain age 5 (0–12, 1–10, 2–8 …). So age alone cannot make this shelf
 * short, and pushing in-band cards behind the "hidden by age" toggle would put
 * a false sentence on screen. The LENGTH problem gets its own, truthfully
 * labelled control: the shelf pages, the age toggle filters, and each says
 * only what it does. Every card stays one tap away (law 6).
 */
const SHELF_PAGE = 30;

const pick = (he: boolean, t: { en: string; he: string }) => (he ? t.he : t.en);

export default function LearnLibrary() {
  const {
    childProfile,
    seedCoach,
    savedLearnIds,
    toggleSavedLearn,
    behaviorLogs,
    pendingLearnRequest,
    consumeLearnRequest,
    acceptTodayAction,
    actionLoop,
    activeFamilyTopic,
  } = useArbor();
  const { t, uiLang, aiLang } = useLanguage();
  const composition = useComposition();
  const desk = composition === "desk";
  const copy = forYouCopy(uiLang);
  const he = aiLang === "he";
  const isRtl = uiLang === "he";
  const firstName = (childProfile.name || "").split(" ")[0];
  const score = useDevScore();
  const ageYears = ageYearsFromProfile(childProfile);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [openCourseId, setOpenCourseId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<LearnFeedback>(() => readLearnFeedback());

  // LC-21 — reads the parent has already opened, on this device, for THIS
  // child (the shelf is child-scoped throughout: age window, ranking, saved).
  // Storage that is unavailable or cleared yields [], which renders the same
  // correct, unmarked library the surface shipped with.
  const [readIds, setReadIds] = useState<string[]>(() => readLearnReadIds(childProfile.id));
  useEffect(() => {
    setReadIds(readLearnReadIds(childProfile.id));
  }, [childProfile.id]);
  const markRead = (cardId: string) => setReadIds(markLearnCardRead(childProfile.id, cardId));

  // LL — deep-link seam: another surface asked for one read or one shelf.
  useEffect(() => {
    if (!pendingLearnRequest) return;
    if (pendingLearnRequest.cardId && learnCardById(pendingLearnRequest.cardId)) {
      setOpenId(pendingLearnRequest.cardId);
      // A deep-linked open is an open: mark it here too, or arriving from the
      // hub's "today's read" would leave the library still showing it unread.
      markRead(pendingLearnRequest.cardId);
    } else if (pendingLearnRequest.category) {
      setFilter(pendingLearnRequest.category as Filter);
      setOpenId(null);
    }
    consumeLearnRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLearnRequest]);

  // LL-A2 — observed-signal ranking input: recent logged behavior types mapped
  // through the controlled concern vocabulary. Counts, never verdicts.
  const recentConcerns = useMemo(
    () => concernsForBehaviors(recentBehaviorTypes(behaviorLogs, new Date())),
    [behaviorLogs]
  );

  // W2 2.5: saved bookmarks feed the ranking as a topic-continuation nudge
  // ("continues what you saved") — card ids only, no child data.
  const signals: LearnRankSignals = useMemo(
    () => ({
      ageYears,
      focusDomain: score.focusDomain,
      recentConcerns,
      helpfulness: feedback,
      savedIds: savedLearnIds,
    }),
    [ageYears, score.focusDomain, recentConcerns, feedback, savedLearnIds]
  );

  const ranked = useMemo(() => rankLearnCards(LEARN_CARDS, signals), [signals]);

  // OBJ-LEARN-01 — the surface contract says the shelf is age-banded, and it
  // was not: 93 cards, 0–1 bands included, in one 23,000 px column for a
  // five-year-old. This is the SAME mechanism Masterclasses already uses
  // (lib/ageFilter `filterByAge` + `windowFromYears`, the per-surface
  // "Show all ages" preference, and the "N hidden by age" toggle) — ported,
  // not reinvented, so both shelves behave identically. LearnCard states its
  // band in YEARS, which is exactly what `windowFromYears` takes.
  const [showAllAges, setShowAllAges] = useState<boolean>(() => loadShowAllAges("learn"));
  const childMonths = ageMonthsFromProfile(childProfile);
  const { visible: ageVisible, hidden: ageHidden } = useMemo(
    () => filterByAge(ranked, (c) => windowFromYears(c.ageMin, c.ageMax), childMonths),
    [ranked, childMonths]
  );
  const toggleShowAllAges = () => {
    setShowAllAges((prev) => {
      const next = !prev;
      saveShowAllAges("learn", next);
      try { track("agefilter_toggle", { surface: "learn", showAll: next }); } catch { /* noop */ }
      return next;
    });
  };
  const inScope = showAllAges ? ranked : ageVisible;

  // B-PLAY-17: the courses shelf rides the SAME age switch as the reads shelf
  // (lib/ageFilter over each course's year band; "Show all ages" lifts it).
  const { visible: coursesAgeVisible, hidden: coursesAgeHidden } = useMemo(
    () => filterByAge(MASTERCLASSES, (m) => windowFromYears(m.ageMinYears, m.ageMaxYears), childMonths),
    [childMonths]
  );
  const courses = showAllAges ? MASTERCLASSES : coursesAgeVisible;
  const courseDone = useMemo(() => loadCourseDone(), [openCourseId]);

  const visible = useMemo(() => {
    let list = inScope;
    if (filter === "saved") list = list.filter((c) => savedLearnIds.includes(c.id));
    else if (filter === "courses") list = [];
    else if (filter !== "all") list = list.filter((c) => c.category === filter);
    return searchLearnCards(list, query, he);
  }, [inScope, filter, query, he, savedLearnIds]);

  const featured = inScope.slice(0, 2);
  const browsing = filter === "all" && query.trim() === "";
  // The featured rail already shows these two; don't repeat them in the grid.
  const gridAll = browsing ? visible.filter((c) => !featured.some((f) => f.id === c.id)) : visible;
  // R12: page the BROWSE shelf only. Once the parent has filtered or searched
  // they have narrowed it themselves, and every match should land. Order is
  // rankLearnCards' — the first page is the best-ranked page, not a slice of
  // the catalogue file. featured + grid together stay within SHELF_PAGE.
  const [showAllShelf, setShowAllShelf] = useState(false);
  const shelfCapped = browsing && !showAllShelf && gridAll.length > SHELF_PAGE - featured.length;
  const gridCards = shelfCapped ? gridAll.slice(0, SHELF_PAGE - featured.length) : gridAll;

  // OBJ-LEARN-02 — a read used to open in place: focus stayed on the card the
  // parent had just left, and the browser Back button left the library
  // entirely. The reader now pushes ONE history entry carrying the card id, so
  // Back closes the read and returns to the shelf. The entry keeps the CURRENT
  // hash on purpose: ArborContext owns `#/<tab>` and rewrites anything else, so
  // a `#/learn/<cardId>` hash would be fought back within a tick. The card id
  // rides in history state instead, and only `popstate` (never `hashchange`)
  // drives this, so the two mechanisms never collide.
  const openCard = (id: string) => {
    setOpenId(id);
    markRead(id);
    try {
      window.history.pushState({ ...(window.history.state ?? {}), arborLearnCard: id }, "", window.location.href);
    } catch { /* history unavailable — the reader still opens */ }
    try { track("learn_open_card", { card: id }); } catch { /* noop */ }
  };

  useEffect(() => {
    const onPop = () => {
      const state = (window.history.state ?? {}) as { arborLearnCard?: string };
      setOpenId(state.arborLearnCard && learnCardById(state.arborLearnCard) ? state.arborLearnCard : null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /** Closing from inside the reader must retire the history entry it pushed,
   *  or Back would re-open the read the parent just closed. */
  const closeCard = () => {
    setOpenId(null);
    const state = (window.history.state ?? {}) as { arborLearnCard?: string };
    if (state.arborLearnCard) { try { window.history.back(); } catch { /* noop */ } }
  };

  // A count of what the PARENT read. Intersected with the catalogue so a read
  // id left behind by a card that has gone dark cannot overstate it. Never a
  // fraction, a ring, or anything that reads as a verdict on the child.
  const readCount = useMemo(
    () => learnReadCount(readIds, LEARN_CARDS.map((c) => c.id)),
    [readIds]
  );

  const openCourse = openCourseId ? MASTERCLASSES.find((m) => m.id === openCourseId) : undefined;
  if (openCourse) {
    return <MasterclassReader m={openCourse} onBack={() => setOpenCourseId(null)} />;
  }

  const open = openId ? learnCardById(openId) : undefined;
  if (open) {
    // LL-A8 — context-rich ask: mention recent related logging only when true.
    const related = concernsContributed(open, recentConcerns);
    const askPrompt = pick(he, open.ask) + (related ? ` ${t("learn.askContext")}` : "");
    const todayTaken = actionLoop.some(
      (a) => a.source === "learn-read" && a.recommendation === pick(he, open.tryToday).trim()
    );
    return (
      <LearnReader
        card={open}
        he={he}
        isRtl={isRtl}
        saved={savedLearnIds.includes(open.id)}
        onBack={closeCard}
        onToggleSave={() => toggleSavedLearn(open.id)}
        onAsk={() => seedCoach({ prompt: askPrompt, source: "learn-library" })}
        pulse={feedback[open.id]}
        onPulse={(v) => {
          const next = setLearnFeedback(open.id, feedback[open.id] === v ? null : v);
          setFeedback({ ...next });
          try { track("learn_pulse", { card: open.id, value: String(v) }); } catch { /* noop */ }
        }}
        todayTaken={todayTaken}
        onAddToday={() => {
          acceptTodayAction(pick(he, open.tryToday).trim(), "tiny", "learn-read");
          try { track("learn_add_today", { card: open.id }); } catch { /* noop */ }
        }}
        t={t}
      />
    );
  }

  // ── v10.1 composition (N-Library-D/M) ──────────────────────────────────
  const libName = firstName || t("learn.yourChild");
  const featuredIds = new Set(featured.map((c) => c.id));
  // Linked from your week: the same short-reads rule For you used (the reads
  // that meet the open family question first, then the next in rank order),
  // never repeating the two picked reads.
  const linked = pickShortReads(inScope.filter((c) => !featuredIds.has(c.id)), activeFamilyTopic?.title);
  // V77: Linked from your week is the read For you picked today (the same
  // todaysLearnPick call, the same signals), else the first short read.
  const forYouPick = todaysLearnPick(LEARN_CARDS, { ...signals, topicText: activeFamilyTopic?.title ?? null }, {
    childId: childProfile.id,
    dayKey: pickDayKey(new Date()),
    logs: behaviorLogs,
  });
  const linkedRead = forYouPick?.card ?? linked.reads[0] ?? null;
  const linkedNote = forYouPick && !forYouPick.fromSaved && forYouPick.fromConcerns ? forYouPick.fromMoment : null;
  const areaGroups = LEARN_CATEGORIES
    .map((cat) => ({ cat, reads: gridAll.filter((c) => c.category === cat.id) }))
    .filter((g) => g.reads.length > 0);
  // V77: on a phone section 1 is the Library stage and section 2 "Picked for
  // {name}" (the picks and the read linked from For you), one-word stops.
  const stops: GuideStop[] = [
    { id: "lib-picked", title: desk ? t("learn.pickedTitle", { name: libName }) : copy.stopLibrary, sub: copy.libGuidePickedSub },
    { id: "lib-linked", title: desk ? copy.libGuideLinked : copy.stopPicked, sub: copy.libGuideLinkedSub },
    { id: "lib-areas", title: desk ? copy.libGuideAreas : copy.stopAreas, sub: copy.libGuideAreasSub },
    { id: "lib-browse", title: desk ? copy.libGuideBrowse : copy.stopBrowse, sub: copy.libGuideBrowseSub },
  ];
  // Honest why-line: claim only the signals that actually contributed.
  const pickedWhy = (() => {
    const name = libName;
    const logsContributed = featured.some((c) => concernsContributed(c, recentConcerns));
    // ENG-07: `score.focusDomain` alone is NOT evidence of a Development Map
    // (it is set for a day-0 profile too). focusDomainContributed applies
    // fromFocus's standard: an observation on the map AND the domain on a
    // card actually shown; otherwise the line falls to the age-only variant.
    const focusContributed = focusDomainContributed(score, featured);
    const base =
      focusContributed && logsContributed ? t("learn.whyFullLogs", { name })
      : focusContributed ? t("learn.whyFull", { name })
      : logsContributed ? t("learn.whyAgeLogs", { name })
      : t("learn.whyAge", { name });
    // W2 2.5: the continuation variant ONLY when a saved read's topic boosted
    // a featured card — the bookmark signal, never an outcome claim.
    const topics = learnContinuationTopics(LEARN_CARDS, signals);
    const savedBoosted = featured.some((c) => continuesSaved(c, topics));
    return savedBoosted ? `${base} ${continueText("elev.continue.learn.why", uiLang === "he")}` : base;
  })();

  const card = (c: LearnCard, i: number, primary = false, isFeatured = false, inArea = false) => (
    <LearnGridCard
      key={c.id}
      card={c}
      he={he}
      featured={isFeatured}
      inArea={inArea}
      desk={desk}
      primary={primary}
      index={i}
      saved={savedLearnIds.includes(c.id)}
      read={readIds.includes(c.id)}
      onOpen={() => openCard(c.id)}
      onToggleSave={() => toggleSavedLearn(c.id)}
      t={t}
    />
  );

  // Controls: search, Reads · Courses, Saved, the count and the age switch.
  const controls = (
    <div data-module="learn-filters" className="lib-controls">
      <label className="lib-search">
        <span className="sr-only">{t("learn.search")}</span>
        <Icon name="search" size={18} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("learn.search")} dir="auto" />
      </label>
      <div className="segr" role="group" aria-label={copy.libViewLabel}>
        <button type="button" aria-pressed={filter !== "courses"} className={filter !== "courses" ? "on" : undefined} onClick={() => setFilter("all")}>{copy.libReads}</button>
        <button type="button" aria-pressed={filter === "courses"} className={filter === "courses" ? "on" : undefined} onClick={() => setFilter(filter === "courses" ? "all" : "courses")}>{t("learn.courses")}</button>
      </div>
      <button
        type="button"
        aria-pressed={filter === "saved"}
        onClick={() => setFilter(filter === "saved" ? "all" : "saved")}
        className={`chip line lib-saved${filter === "saved" ? " on" : ""}`}
      >
        <Icon name="bookmark" size={16} />
        {`${t("learn.saved")}${savedLearnIds.length > 0 ? ` · ${savedLearnIds.length}` : ""}`}
      </button>
      <span className="lib-count">
        {filter === "courses" ? t("learn.courses.count", { n: courses.length }) : t("learn.count", { n: inScope.length })}
        {filter !== "courses" && readCount > 0 && ` · ${t("elev.learnCare.read.count", { n: readCount })}`}
      </span>
      {/* OBJ-LEARN-01 — the Masterclasses toggle, verbatim: rendered only when
          the age view actually hides something (or the parent already opted
          in), so every card stays reachable. One switch drives reads and courses. */}
      {(filter === "courses" ? (coursesAgeHidden.length > 0 || showAllAges) : (ageHidden.length > 0 || showAllAges)) && (
        <span className="lib-age">
          {!showAllAges && (filter === "courses" ? coursesAgeHidden.length : ageHidden.length) > 0 && (
            <span className="small" dir="auto">
              {filter === "courses"
                ? agefilterText("elev.agefilter.hiddenCount", he, { n: coursesAgeHidden.length })
                : agefilterText("elev.agefilter.hiddenCount", he, { n: ageHidden.length })}
            </span>
          )}
          <button
            type="button"
            role="switch"
            aria-checked={showAllAges}
            onClick={toggleShowAllAges}
            data-testid={filter === "courses" ? "agefilter-toggle-courses" : "agefilter-toggle-learn"}
            className="ghostb lib-switch min-h-11"
          >
            {showAllAges && <Icon name="check" size={16} />}
            {agefilterText("elev.agefilter.showAll", he)}
          </button>
        </span>
      )}
    </div>
  );

  const whyLine = <ContentWhyLine surface="learn-rail" trustLink why={pickedWhy} />;
  // 1 · Picked for {name}: the stage with the two picked reads.
  const pickedStage = (
    <Scene
      as="section"
      field="now"
      data-module="learn-picked"
      className={`fy-scene lib-stage${desk ? " x8" : ""}`}
      aria-labelledby="lib-title"
      orbs={desk ? [{ size: 360, left: -220, bottom: -240, opacity: 0.55 }, { size: 300, right: -150, top: -200, opacity: 0.6, b: true }] : [{ size: 240, left: -140, bottom: -160, opacity: 0.5 }, { size: 200, right: -110, top: -130, opacity: 0.55, b: true }]}
    >
      <div className="line between" style={{ flexWrap: "wrap", gap: 8 }}>
        <span className="gsec">
          <span className="kicker">{desk ? t("learn.pickedTitle", { name: libName }) : copy.stopLibrary}</span>
          <StartHere>{copy.startHere}</StartHere>
        </span>
      </div>
      <div className="fy-pick-head" style={desk ? undefined : { gridTemplateColumns: "minmax(0, 1fr)" }}>
        <div className="stack fy-col" style={{ gap: 8 }}>
          <h1 className="hero">
            <span id="lib-title">{t("learn.title")}</span>
          </h1>
          <p className="fy-pick-hook">{t("learn.subtitle")}</p>
        </div>
        {desk && <AreaForm art={EMPTY_ART.learn} width={170} ratio={0.62} zoom={1.02} />}
      </div>
      {/* Why-line rides the shared slot (masterplan 3.1) — TrustLink mounts
          directly after the why text ("How Arbor decides →"). On a phone it
          follows the picked reads, so the first read clears the capture dock. */}
      {desk && whyLine}
      {desk && <div className="g12 lib-featured">{featured.map((c, i) => <div key={c.id} className="x6">{card(c, i, i === 0, true)}</div>)}</div>}
    </Scene>
  );

  // 2 · Linked from your week, and what the parent saved.
  const linkedCard = (
    <>
      {linkedRead && (
        <button key={linkedRead.id} type="button" className="rdc lib-rdc lib-linked" data-testid="learn-linked-read" onClick={() => openCard(linkedRead.id)}>
          <AreaForm art={DOMAIN_ART[readArea(linkedRead.category)]} width={desk ? 120 : 44} ratio={desk ? 0.57 : 0.7} zoom={desk ? 1.13 : 1.25} />
          <span className="meta">
            <span className="lib-on">{forYouPick ? copy.libOnForYou : pick(he, learnCategoryById(linkedRead.category).label)}</span>
            <span className="line" style={{ gap: 4 }}><Icon name="schedule" size={15} />{t("learn.minutes", { n: linkedRead.minutes })}</span>
          </span>
          <span className="ttl" dir="auto">{pick(he, linkedRead.title)}</span>
          {linkedNote ? (
            <span className="from" dir="auto">{copy.libFromNote(new Intl.DateTimeFormat(he ? "he-IL" : "en-GB", { weekday: "short", day: "numeric", month: "short" }).format(linkedNote.at))}</span>
          ) : !forYouPick && linked.matched.has(linkedRead.id) ? (
            <span className="from">{t("elev.learnCare.shortReads.matched")}</span>
          ) : null}
          <span className="go"><span className="line" style={{ gap: 4 }}>{t("learn.readCard")}<Icon name="chevron_right" size={15} className="rtl:-scale-x-100" /></span></span>
        </button>
      )}
    </>
  );
  const savedCard = (
    <div className="crs lib-savedcard">
        <span className="gi" aria-hidden="true"><Icon name="bookmark" size={16} /></span>
        <span className="nm">
          {t("learn.saved")}
          <small>{savedLearnIds.length > 0 ? copy.libSavedCount(savedLearnIds.length) : t("learn.emptySaved")}</small>
        </span>
        {savedLearnIds.length > 0 && <MoreLink onClick={() => setFilter("saved")}>{copy.libSavedOpen}</MoreLink>}
      </div>
  );
  const linkedReads = (
    <>
      {linkedCard}
      {savedCard}
    </>
  );

  // 3 · Choose an area.
  const areaTiles = (
    <div className="lib-areas" role="group" aria-label={copy.libGuideAreas} data-module="learn-areas">
      <button type="button" aria-pressed={filter === "all"} className={`topic min-h-11${filter === "all" ? " on" : ""}`} onClick={() => setFilter("all")}>
        <span className="lib-areaglyph" aria-hidden="true"><Icon name="menu_book" size={20} /></span>
        <span>{t("learn.all")}</span>
      </button>
      {LEARN_CATEGORIES.map((c) => (
        <button key={c.id} type="button" data-shelf={c.id} aria-pressed={filter === c.id} className={`topic min-h-11${filter === c.id ? " on" : ""}`} onClick={() => setFilter(filter === c.id ? "all" : c.id)}>
          <AreaForm art={DOMAIN_ART[readArea(c.id)]} width={desk ? 64 : 76} ratio={0.62} zoom={1.15} />
          <span dir="auto">{pick(he, c.label)}</span>
        </button>
      ))}
    </div>
  );

  // 4 · Browse the library: by area, three reads each, every read one tap
  // from "All in this area" or "All N reads" (R12: the shelf's own length
  // control, separate from the age switch).
  const browseByArea = (
    <div className="stack fy-col" style={{ gap: desk ? 14 : 12 }}>
      {areaGroups.map(({ cat, reads }) => (
        <div key={cat.id} className={desk ? "lib-arearow" : "vt lib-areacard"}>
          <div className="lib-areahead">
            {desk && <AreaForm art={DOMAIN_ART[readArea(cat.id)]} width={96} ratio={0.62} zoom={1.15} />}
            <span className={desk ? "stack fy-col" : "line between lib-areahead-m"} style={{ gap: 2 }}>
              <h3 className="h3" dir="auto">{pick(he, cat.label)}</h3>
              <MoreLink onClick={() => setFilter(cat.id)}>{desk ? copy.libAllInArea : t("learn.all")}</MoreLink>
            </span>
          </div>
          {desk ? (
            <div className="lib-areareads">{reads.slice(0, 3).map((c, i) => card(c, i, false, false, true))}</div>
          ) : (
            <ul className="lib-rows">
              {reads.slice(0, 3).map((c) => (
                <li key={c.id} className="lib-row">
                  <button type="button" className="lib-rowopen" onClick={() => openCard(c.id)}>
                    <AreaForm art={DOMAIN_ART[readArea(c.category)]} width={56} ratio={0.7} zoom={1.22} />
                    <span className="nm" dir="auto">
                      {pick(he, c.title)}
                      <small>{t("learn.minutes", { n: c.minutes })} · {t("learn.ages", { min: c.ageMin, max: c.ageMax })}{readIds.includes(c.id) ? ` · ${t("elev.learnCare.read.badge")}` : ""}</small>
                    </span>
                  </button>
                  <ContentActionBar
                    variant="inline"
                    surface="learn-card"
                    actions={[{ verb: "save", onClick: () => toggleSavedLearn(c.id), active: savedLearnIds.includes(c.id), label: savedLearnIds.includes(c.id) ? t("learn.savedLabel") : t("learn.save"), icon: savedLearnIds.includes(c.id) ? "bookmark_added" : "bookmark", fill: savedLearnIds.includes(c.id) ? 1 : 0 }]}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
  const flatGrid = (
    <div className="lib-grid">{gridCards.map((c, i) => card(c, i, !(browsing && featured.length > 0) && i === 0))}</div>
  );
  const shelfToggle = browsing && gridAll.length > 0 && (
    <button
      type="button"
      onClick={() => {
        setShowAllShelf((prev) => {
          const next = !prev;
          try { track("learn_shelf_page", { showAll: next }); } catch { /* noop */ }
          return next;
        });
      }}
      data-testid="learn-shelf-more"
      aria-expanded={showAllShelf}
      className="ghostb lib-more"
    >
      <Icon name={showAllShelf ? "expand_less" : "expand_more"} size={16} />
      {showAllShelf ? copy.libByArea : copy.libAllReads}
    </button>
  );

  // The shelf: Courses, the browse, or the narrowed results (search, Saved, an area).
  const shelfTitle = filter === "courses" ? t("learn.courses") : browsing ? t("learn.allReads") : filter === "saved" ? t("learn.saved") : filter !== "all" ? pick(he, learnCategoryById(filter).label) : copy.libResults(visible.length);
  const shelf = (
    <div data-module="learn-shelf" className="stack fy-col" style={{ gap: 12 }} aria-label={shelfTitle}>
      {!desk || !browsing ? <RouteHead id="lib-browse-title" title={shelfTitle} sub={filter === "courses" ? t("learn.courses.count", { n: courses.length }) : !browsing && visible.length > 0 ? copy.libResults(visible.length) : undefined} link={browsing ? shelfToggle : undefined} /> : null}
      {filter === "courses" ? (
        /* B-PLAY-17: Courses — the Masterclasses, opened in the same course reader. */
        <ul className="lib-courses" data-testid="learn-courses">
          {courses.map((m, i) => (
            <li key={m.id}>
              <button
                type="button"
                {...(i === 0 ? LEARN_MOVE_STAMP : {})}
                onClick={() => setOpenCourseId(m.id)}
                data-testid="learn-course-row"
                className="crs fy-crs"
              >
                <AreaForm art={DOMAIN_ART[courseArea(m.id) ?? "family"]} width={60} ratio={0.66} zoom={1.22} />
                <span className="nm" dir="auto">
                  {he ? m.titleHe : m.title}
                  <small>{he ? m.hookHe : m.hook}</small>
                  <span className="pips">
                    <span className="small">{m.durationMin} {t("master.min")}</span>
                    {courseDone[m.id] && <span className="small"><Icon name="check" size={13} /> {t("learn.courses.done")}</span>}
                  </span>
                </span>
                <Icon name="chevron_right" size={18} className="rtl:-scale-x-100" />
              </button>
            </li>
          ))}
        </ul>
      ) : gridCards.length > 0 ? (
        browsing && !showAllShelf ? browseByArea : flatGrid
      ) : (
        <EmptyState
          icon={filter === "saved" ? "bookmark" : "search_off"}
          illustration={filter === "saved" ? EMPTY_ART.learn : undefined}
          text={filter === "saved" ? t("learn.emptySaved") : t("learn.emptySearch", { q: query.trim() })}
          action={
            // LC-33: the saved shelf's empty state was a dead end.
            filter === "saved"
              ? { label: t("elev.learnCare.saved.browse", { name: firstName }), onClick: () => { setFilter("all"); setQuery(""); } }
              : { label: t("learn.clearSearch"), onClick: () => setQuery("") }
          }
        />
      )}
    </div>
  );

  return (
    <DsRoot composition={composition} className="stack fy-col lib-page" style={{ gap: desk ? 18 : 14 }} dir={isRtl ? "rtl" : "ltr"}>
      {browsing && featured.length > 0 && <Guide stops={stops} mini={!desk} label={copy.onThisPage} />}
      {!(browsing && featured.length > 0) && <h1 className="h3 lib-h1">{t("learn.title")}</h1>}
      {controls}
      {browsing && featured.length > 0 ? (
        <Route composition={composition} className="fy-route">
          {desk ? (
            <RouteSection id="lib-picked" n={1} on>
              <Row12>
                {pickedStage}
                <SideRail id="lib-linked" n={2} title={copy.libGuideLinked} titleId="lib-linked-title" className="x4">
                  <div className="stack fy-col" data-testid="learn-linked" style={{ gap: 10 }}>{linkedReads}</div>
                </SideRail>
              </Row12>
            </RouteSection>
          ) : (
            <>
              <RouteSection id="lib-picked" n={1} on>{pickedStage}</RouteSection>
              <RouteSection id="lib-linked" n={2} stopTop={4} aria-labelledby="lib-linked-title">
                <div className="stack fy-col" data-testid="learn-linked" style={{ gap: 10 }}>
                  {/* The board's sub ("and the read linked from For you") is left out: the first pick must clear the capture dock at 375. */}
                  <RouteHead id="lib-linked-title" title={t("learn.pickedTitle", { name: libName })} />
                  <Snap label={t("learn.pickedTitle", { name: libName })}>
                    {featured.map((c, i) => card(c, i, i === 0, true))}
                    {linkedRead && <div className="lib-card featured">{linkedCard}</div>}
                  </Snap>
                  <SnapDots count={featured.length + (linkedRead ? 1 : 0)} />
                  {/* On a phone the why-line follows the picks, so the first pick clears the capture dock. */}
                  {whyLine}
                </div>
              </RouteSection>
            </>
          )}
          <RouteSection id="lib-areas" n={3} stopTop={desk ? 0 : 4} aria-labelledby="lib-areas-title">
            <div className="stack fy-col" style={{ gap: 12 }}>
              <RouteHead id="lib-areas-title" title={copy.libGuideAreas} sub={copy.libGuideAreasSub} />
              {areaTiles}
            </div>
          </RouteSection>
          <RouteSection id="lib-browse" n={4} stopTop={desk ? 0 : 4} aria-labelledby="lib-browse-title">
            {desk && <RouteHead id="lib-browse-title" title={t("learn.allReads")} sub={copy.libGuideBrowseSub} link={shelfToggle} />}
            {shelf}
          </RouteSection>
        </Route>
      ) : (
        <>
          {filter !== "courses" && filter !== "saved" && areaTiles}
          {shelf}
        </>
      )}
      {/* Provenance — editorial stance, no assessment */}
      <p className="small lib-provenance">{t("learn.provenance")}</p>
    </DsRoot>
  );
}

/** W2-SHELLPLAY critic r1: the page's ONE primary-move stamp (check:framework
 *  counts exactly one in source), spread onto the first rendered card's open
 *  control — the first Picked card, else the first shelf card, or the first
 *  course row under Courses. Never a section. */
const LEARN_MOVE_STAMP = { "data-primary-move": "open-learn-card" } as const;

/* ── Grid card ──────────────────────────────────────────────────────────── */

function LearnGridCard({
  card,
  he,
  saved,
  read,
  featured,
  inArea,
  desk = true,
  primary,
  index,
  onOpen,
  onToggleSave,
  t,
}: {
  card: LearnCard;
  he: boolean;
  saved: boolean;
  /** LC-21 — the parent already opened this read on this device. */
  read?: boolean;
  featured?: boolean;
  /** V77: inside an area row the area is the row's heading, so the card drops it. */
  inArea?: boolean;
  /** The composition: a phone's picked card is compact (no art, a text Read). */
  desk?: boolean;
  /** W2-SHELLPLAY critic r1: this card's open control carries the page's ONE
   *  data-primary-move (the first rendered card). */
  primary?: boolean;
  index: number;
  onOpen: () => void;
  onToggleSave: () => void;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  const cat = learnCategoryById(card.category);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.24) }}
      className={`relative lib-card${featured ? " featured" : ""}`}
    >
      <button
        type="button"
        onClick={onOpen}
        {...(primary ? LEARN_MOVE_STAMP : {})}
        className="rdc lib-rdc"
      >
        {/* Keep the full 44px bookmark footprint above the title, even when
            this metadata fits on one line. */}
        <div className="meta flex min-h-11 items-center gap-2 flex-wrap pe-12">
          {featured && desk && <AreaForm art={DOMAIN_ART[readArea(card.category)]} width={44} ratio={0.7} zoom={1.25} />}
          {!inArea && <span>{pick(he, cat.label)}</span>}
          <span className="inline-flex items-center gap-1">
            <Icon name="schedule" size={15} />
            {t("learn.minutes", { n: card.minutes })}
          </span>
          <span>{t("learn.ages", { min: card.ageMin, max: card.ageMax })}</span>
          {/* LC-21 — a quiet marker for a read the PARENT already opened.
              Absent when nothing is known (cleared or blocked storage). */}
          {read && (
            <span className="inline-flex items-center gap-1">
              <Icon name="check" size={14} />
              {t("elev.learnCare.read.badge")}
            </span>
          )}
        </div>
        <h3 className="ttl" dir="auto">
          {pick(he, card.title)}
        </h3>
        <span className="go">
          {/* V77: a picked card's Read is a pill — filled on the first, ghost on the second. */}
          <span className={featured && desk ? (index === 0 ? "keepb" : "ghostb q") : "inline-flex items-center gap-1"}>
            {t("learn.readCard")}
            <Icon name="chevron_right" size={16} className="rtl:-scale-x-100" />
          </span>
        </span>
      </button>
      {/* Bookmark — sibling, never nested inside the open button. The card-level
          save is the shared bar's compact variant: same verb, same order canon,
          same handler as the reader's segmented bar. */}
      <div className="absolute top-2.5 end-2.5">
        <ContentActionBar
          variant="inline"
          surface="learn-card"
          actions={[
            {
              verb: "save",
              onClick: onToggleSave,
              active: saved,
              label: saved ? t("learn.savedLabel") : t("learn.save"),
              icon: saved ? "bookmark_added" : "bookmark",
              fill: saved ? 1 : 0,
            },
          ]}
        />
      </div>
    </motion.div>
  );
}

/* ── Reader ─────────────────────────────────────────────────────────────── */

function LearnReader({
  card,
  he,
  isRtl,
  saved,
  onBack,
  onToggleSave,
  onAsk,
  pulse,
  onPulse,
  todayTaken,
  onAddToday,
  t,
}: {
  card: LearnCard;
  he: boolean;
  isRtl: boolean;
  saved: boolean;
  onBack: () => void;
  onToggleSave: () => void;
  onAsk: () => void;
  pulse: 1 | -1 | undefined;
  onPulse: (v: 1 | -1) => void;
  todayTaken: boolean;
  onAddToday: () => void;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  const cat = learnCategoryById(card.category);
  const tone = PASTEL[cat.tone];
  const [copied, setCopied] = useState(false);
  // LL-A7 — listen mode: the whole read, spoken via the shared voice stack.
  const voice = useArborVoice();
  const listenText = useMemo(
    () =>
      [pick(he, card.title), ...card.keyPoints.map((k) => pick(he, k)), pick(he, card.body)].join(
        "\n\n"
      ),
    [card, he]
  );
  useEffect(() => () => voice.stop(), [card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const share = async () => {
    const points = card.keyPoints.map((k, i) => `${i + 1}. ${pick(he, k)}`).join("\n");
    // A pilot read leaving the app keeps its label. Without this, unreviewed
    // content travels attributed to Arbor with nothing saying it is a pilot.
    const pilotLine = isLearnPilotCard(card.id) ? `\n\n${learnPilotText(he ? "he" : "en").note}` : "";
    const text = `${pick(he, card.title)}\n\n${points}${pilotLine}\n\n— Arbor`;
    try { track("learn_share", { card: card.id }); } catch { /* noop */ }
    try {
      if (navigator.share) {
        await navigator.share({ title: pick(he, card.title), text });
        return;
      }
    } catch { /* fall through to clipboard */ }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  const headingRef = React.useRef<HTMLHeadingElement | null>(null);
  useEffect(() => { headingRef.current?.focus(); }, [card.id]);

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[760px] space-y-5"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-bold min-h-[44px] rounded-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{ color: "var(--arbor-muted)" }}
      >
        <Icon name="arrow_back" size={16} className="rtl:-scale-x-100" />
        {t("learn.back")}
      </button>

      {/* Hero band — W2-SHELLPLAY r2 (learn design): ONE flat tone band. The old
          linear-gradient(tone.soft → paper-deep) nested a token that is itself a
          gradient (invalid CSS: the band rendered bare) and read as a second
          gradient family beside --gradient-cta. */}
      <div
        className="rounded-[22px] p-5 sm:p-6"
        data-testid="learn-reader-hero"
        style={{ background: tone.soft }}
      >
        <div className="flex items-center gap-3 mb-4">
          <span
            className="inline-flex items-center justify-center rounded-[18px] flex-shrink-0"
            style={{ background: "var(--arbor-paper-elevated)", color: tone.ink, width: 52, height: 52, boxShadow: "var(--shadow-xs)" }}
          >
            <Icon name={cat.msIcon} size={26} />
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide"
              style={{ background: "var(--arbor-paper-elevated)", color: tone.ink }}
            >
              {pick(he, cat.label)}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: tone.ink }}>
              <Icon name="schedule" size={13} />
              {t("learn.minutes", { n: card.minutes })}
            </span>
            <span className="text-xs font-semibold" style={{ color: tone.ink }}>
              {t("learn.ages", { min: card.ageMin, max: card.ageMax })}
            </span>
          </div>
        </div>
        {/* OBJ-LEARN-02: focus moves here on open, so a screen reader announces
            the read instead of leaving the cursor on the shelf behind it. It is
            an h2, not an h1 — the page's one h1 belongs to the hub (CR-21). */}
        <h2
          ref={headingRef}
          tabIndex={-1}
          data-testid="learn-reader-heading"
          className="text-xl md:text-[1.55rem] leading-tight tracking-tight focus:outline-none"
          dir="auto"
          style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
        >
          {pick(he, card.title)}
        </h2>
        <p className="text-[13px] mt-2 leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>
          {pick(he, card.hook)}
        </p>
        {isLearnPilotCard(card.id) && (
          <p
            className="mt-3 rounded-[14px] px-3 py-2 text-xs leading-relaxed"
            dir="auto"
            data-testid="learn-pilot-note"
            style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink-soft)" }}
          >
            <span className="font-bold" style={{ color: "var(--arbor-ink)" }}>
              {learnPilotText(he ? "he" : "en").status}
            </span>
            {" — "}
            {learnPilotText(he ? "he" : "en").note}
          </p>
        )}
      </div>

      {/* Action bar — the shared ContentActionBar: canonical done · save ·
          share, then this surface's extras (listen · ask). "Add to today" also
          keeps its in-context CTA in the try-today section below — same
          handler, contextual primary (documented judgment call). */}
      <ContentActionBar
        variant="bar"
        surface="learn-reader"
        actions={[
          {
            verb: "done",
            onClick: onAddToday,
            active: todayTaken,
            disabled: todayTaken,
            label: todayTaken ? t("learn.addedToday") : t("learn.addToday"),
            icon: todayTaken ? "check_circle" : "add_task",
            fill: todayTaken ? 1 : 0,
          },
          {
            verb: "save",
            onClick: onToggleSave,
            active: saved,
            label: saved ? t("learn.savedLabel") : t("learn.save"),
            icon: saved ? "bookmark_added" : "bookmark",
            fill: saved ? 1 : 0,
          },
          {
            verb: "share",
            onClick: () => void share(),
            label: copied ? t("learn.copied") : t("learn.share"),
            icon: copied ? "check" : "ios_share",
          },
        ]}
        extras={[
          ...(voice.supported
            ? [
                {
                  id: "listen",
                  label: voice.speaking ? t("learn.listening") : t("learn.listen"),
                  icon: voice.speaking ? "stop_circle" : "graphic_eq",
                  active: voice.speaking,
                  onClick: () => {
                    voice.toggle(listenText);
                    try { track("learn_listen", { card: card.id }); } catch { /* noop */ }
                  },
                },
              ]
            : []),
          { id: "ask", label: t("nav.tab.coach"), icon: "forum", onClick: onAsk },
        ]}
      />

      {/* Key points */}
      <section aria-label={t("learn.keyPoints")}>
        <h3 className="text-lg font-bold mb-3" style={{ color: "var(--arbor-ink)" }}>
          {t("learn.keyPoints")}
        </h3>
        <ol className="space-y-3">
          {card.keyPoints.map((point, i) => (
            <li key={i} className="flex gap-3">
              <span
                className="inline-flex items-center justify-center rounded-full flex-shrink-0 w-6 h-6 text-xs font-extrabold mt-0.5"
                style={{ background: tone.soft, color: tone.ink }}
                aria-hidden
              >
                {i + 1}
              </span>
              <p className="t-base leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>
                {pick(he, point)}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Full read */}
      <section aria-label={t("learn.fullRead")}>
        <h3 className="text-lg font-bold mb-3" style={{ color: "var(--arbor-ink)" }}>
          {t("learn.fullRead")}
        </h3>
        <div className="space-y-3.5">
          {pick(he, card.body)
            .split("\n\n")
            .map((para, i) => (
              <p key={i} className="t-base leading-relaxed max-w-[72ch]" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>
                {para}
              </p>
            ))}
        </div>
      </section>

      {/* Try this today */}
      <section
        aria-label={t("learn.tryToday")}
        className="rounded-[18px] p-5"
        style={{ background: tone.soft }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Icon name="flag" size={18} style={{ color: tone.ink }} />
          <h3 className="text-[14px] font-extrabold" style={{ color: tone.ink }}>
            {t("learn.tryToday")}
          </h3>
        </div>
        <p className="t-base leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink)" }}>
          {pick(he, card.tryToday)}
        </p>
        {/* LL-A6 — one tap into the Today action loop, honest provenance */}
        <button
          onClick={onAddToday}
          disabled={todayTaken}
          className="mt-3 inline-flex items-center gap-1.5 font-bold text-[13px] rounded-[14px] px-4 py-2.5 min-h-[44px] transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 disabled:opacity-70"
          style={{
            background: "var(--arbor-paper-elevated)",
            color: tone.ink,
            border: "1px solid var(--arbor-rule)",
          }}
        >
          <Icon name={todayTaken ? "check_circle" : "add_task"} size={16} fill={todayTaken ? 1 : 0} />
          {todayTaken ? t("learn.addedToday") : t("learn.addToday")}
        </button>
      </section>

      {/* LL-A11 — helpful pulse: counts only, tunes this device's ranking */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-[12px] font-bold" style={{ color: "var(--arbor-muted)" }}>
          {t("learn.pulseAsk")}
        </span>
        <button
          onClick={() => onPulse(1)}
          aria-pressed={pulse === 1}
          className="inline-flex items-center gap-1.5 rounded-full px-3 min-h-11 text-[12px] font-bold transition active:scale-[0.96] focus:outline-none focus-visible:ring-2"
          style={
            pulse === 1
              ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid transparent" }
              : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }
          }
        >
          <Icon name="thumb_up" size={15} fill={pulse === 1 ? 1 : 0} />
          {t("learn.pulseYes")}
        </button>
        <button
          onClick={() => onPulse(-1)}
          aria-pressed={pulse === -1}
          className="inline-flex items-center gap-1.5 rounded-full px-3 min-h-11 text-[12px] font-bold transition active:scale-[0.96] focus:outline-none focus-visible:ring-2"
          style={
            pulse === -1
              ? { background: "var(--arbor-paper-deep)", color: "var(--arbor-ink-soft)", border: "1px solid transparent" }
              : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }
          }
        >
          <Icon name="thumb_down" size={15} fill={pulse === -1 ? 1 : 0} />
          {t("learn.pulseNo")}
        </button>
      </div>

      {/* Provenance hedge — editorial, not diagnostic. Masterplan 3.1: the
          TrustLink chip closes the why → Trust Center chain, after the
          provenance text on the same wrapping row (scholar-hub-reader parity;
          UI-WIRE 2026-08-20 inventory gap). */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: "var(--arbor-faint)" }}>
        <span dir="auto">{t("learn.provenance")}</span>
        <TrustLink surface="learn-reader" />
      </div>
    </motion.article>
  );
}

/* ── Empty state ────────────────────────────────────────────────────────── */

function EmptyState({
  icon,
  text,
  action,
  illustration,
}: {
  icon: string;
  text: string;
  action?: { label: string; onClick: () => void };
  /** P7-DESIGN art: the saved shelf's picture in place of the icon tile (decorative). */
  illustration?: ParentArt;
}) {
  return (
    <div className={`${cardCls} p-8 flex flex-col items-center text-center gap-3`}>
      {illustration ? (
        <figure aria-hidden data-testid="learn-empty-art" className="m-0 overflow-hidden" style={{ inlineSize: "min(280px, 100%)", borderRadius: "var(--r-xl)", background: "var(--arbor-paper-deep)" }}>
          <img src={illustration.src} srcSet={illustration.srcSet} width={illustration.width} height={illustration.height} alt="" loading="lazy" decoding="async" style={{ display: "block", inlineSize: "100%", blockSize: "auto", aspectRatio: `${illustration.width} / ${illustration.height}`, objectFit: "cover" }} />
        </figure>
      ) : (
        <span
          className="inline-flex items-center justify-center rounded-[18px] w-12 h-12"
          style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}
        >
          <Icon name={icon} size={24} />
        </span>
      )}
      <p className="text-[13px] max-w-[40ch]" style={{ color: "var(--arbor-muted)" }}>
        {text}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-1.5 font-bold text-[13px] rounded-[14px] px-4 py-2.5 min-h-[44px] transition active:scale-[0.98] focus:outline-none focus-visible:ring-2"
          style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-clay-deep)", border: "1px solid var(--arbor-clay-border)" }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
