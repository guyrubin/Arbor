import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { celebrate } from "../../lib/celebrate";
import { Icon } from "../ui/Icon";
import { SpeakButton } from "../ui/SpeakButton";
import { EvidenceChip } from "../ui/EvidenceChip";
import { IconBadge, type PastelKey } from "../ui/kit";
import { useLanguage } from "../../context/LanguageContext";
import { useArbor } from "../../context/ArborContext";
import { MASTERCLASSES, FRAME_LABELS, type FrameId, type Masterclass } from "../../lib/masterclasses";
import { loadCharter, aimVirtues } from "../../lib/becoming";
// W0.7 — age-fit filtering (shared helper; banding reused from playbank/stages)
import { filterByAge, loadShowAllAges, saveShowAllAges, windowFromYears } from "../../lib/ageFilter";
import { agefilterText } from "../../lib/i18nElevation/agefilter";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { track } from "../../lib/analytics";
// LC-04 — the Learn hub's "today's pick" is the REAL ranking, not file order.
import { useDevScore } from "../../hooks/useDevScore";
import { ageYearsFromProfile } from "../../lib/childAge";
import { concernsForBehaviors } from "../../content/selectCards";
import { recentBehaviorTypes } from "../../content/hardMomentSurface";
import { readLearnFeedback } from "../../learn/learnFeedback";
import { LEARN_CARDS } from "../../learn/learnCards";
import type { LearnRankSignals } from "../../learn/learnLibrary";
import { devMapHasSignal, pickDayKey, todaysLearnPick } from "../../learn/todaysPick";
// v3 EXTRA-FORYOU: courses and reads by area (the ONE domain registry: names,
// glyphs, order) and the family-ritual door's picture.
import { courseArea, courseAreaCounts, readArea } from "../../learn/courseAreas";
import { domainName, type DomainId } from "../../lib/domains/registry";
import { DOMAIN_ART, EMPTY_ART, TOGETHER_ART } from "../../lib/parentArt";
import type { DevelopmentMetricId } from "../../types";
// AP-055: Scholar Hub weekly concept feed
import ScholarHubCard from "./ScholarHubCard";
import { TrustLink } from "../trust/TrustLink";
// AP-053: Academy "For You" — copilot focus + Learning Map join
import AcademyForYou from "./AcademyForYou";
// v10.1 — the design system's For you composition (N-ForYou-D / N-ForYou-M).
import { DsRoot, Guide, MoreLink, Route, RouteHead, RouteSection, Row12, Scene, StartHere, Tile, type GuideStop } from "../../design/primitives";
import { useComposition } from "../../design/useComposition";
import { forYouCopy } from "../foryou/forYouCopy";
import { AreaForm } from "../foryou/AreaForm";
import { ForYouPrograms, openProgramPage, programWeekLine, useForYouProgram } from "../foryou/ForYouPrograms";
import "../foryou/foryou.css";

const FRAME_TONE: Record<FrameId, PastelKey> = {
  aim: "sky",
  twoAxes: "mint",
  story: "lav",
  shadow: "coral",
  marriage: "pink",
  shepherd: "yellow",
};

/** Which virtues each masterclass builds — used to recommend by the Family Charter. */
const MASTERCLASS_VIRTUES: Record<string, DevelopmentMetricId[]> = {
  "holding-the-line-without-anger": ["wisdom", "responsibility"],
  "building-responsibility-by-age": ["responsibility"],
  "repair-after-conflict": ["empathy", "truth"],
  "raising-courage-without-harshness": ["courage", "resilience"],
};

/** How many course rows the rail shows before the parent asks for all of them. */
const RAIL_COURSES = 3;

const DONE_KEY = "arbor.masterclasses.done";
export const loadDone = (): Record<string, boolean> => {
  try { return JSON.parse(localStorage.getItem(DONE_KEY) || "{}"); } catch { return {}; }
};

// Wave-8: private parent reflection — client-only localStorage, never sent/stored server-side.
const REFLECT_KEY = "arbor.masterclasses.reflection";
const loadReflection = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(REFLECT_KEY) || "{}"); } catch { return {}; }
};

/** The thread's connector between two knots (ink from the parent's note, pencil after Arbor's). */
function Thr({ ai }: { ai?: boolean }) {
  return (
    <span className="thr" aria-hidden="true">
      <svg viewBox="0 0 48 28" preserveAspectRatio="none">
        <path className={ai ? "g-ai" : "g-ink"} d="M0 14 C16 0, 32 28, 48 14" style={ai ? { strokeWidth: 3.5 } : undefined} />
      </svg>
    </span>
  );
}

/** For you, the parent › For you — today's pick tied to what the parent wrote,
 *  courses by area, the family's program, and the doors to the Library and a
 *  family ritual. Arbor Academy › Parent Masterclasses: short, frame-routed
 *  lessons that build the parent's own competence. Text-first, bilingual. */
export default function Masterclasses() {
  const { t, aiLang, uiLang } = useLanguage();
  const { childProfile, behaviorLogs, savedLearnIds, requestLearnRead, setActiveTab, activeFamilyTopic } = useArbor();
  const he = aiLang === "he";
  const copy = forYouCopy(uiLang);
  const composition = useComposition();
  const desk = composition === "desk";
  const [openId, setOpenId] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [reflection, setReflection] = useState<Record<string, string>>({});
  const [allCourses, setAllCourses] = useState(false);
  // LC-04: the same shared dev-score derivation the Learn Library ranks on.
  const devScore = useDevScore();
  // B-PROG-05: the family's program, read through the program page's own model.
  const program = useForYouProgram(uiLang === "he" ? "he" : "en");

  // W0.7 — default the catalog to the child's age band; "Show all ages"
  // (persisted per surface) keeps every course reachable (UC-1 rule).
  const [showAllAges, setShowAllAges] = useState<boolean>(() => loadShowAllAges("masterclasses"));
  // v3 EXTRA-FORYOU: the "Courses by area" filter (null = every area). Page state only.
  const [activeArea, setActiveArea] = useState<DomainId | null>(null);
  const childMonths = ageMonthsFromProfile(childProfile);
  const { visible: ageVisible, hidden: ageHidden, fits: ageFits } = filterByAge(
    MASTERCLASSES,
    (m) => windowFromYears(m.ageMinYears, m.ageMaxYears),
    childMonths,
  );
  const catalog = showAllAges ? MASTERCLASSES : ageVisible;
  const toggleShowAllAges = () => {
    setShowAllAges((prev) => {
      const next = !prev;
      saveShowAllAges("masterclasses", next);
      track("agefilter_toggle", { surface: "masterclasses", showAll: next });
      return next;
    });
  };

  useEffect(() => { setDone(loadDone()); setReflection(loadReflection()); }, []);
  const markDone = (id: string) => {
    setDone((d) => {
      const next = { ...d, [id]: true };
      try { localStorage.setItem(DONE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const saveReflection = (id: string, val: string) => {
    setReflection((r) => {
      const next = { ...r, [id]: val };
      try { localStorage.setItem(REFLECT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const open = openId ? MASTERCLASSES.find((m) => m.id === openId) ?? null : null;

  // D3: recommend the masterclasses that build the family's chosen virtues.
  // W0.7: the strip draws from the age-visible catalog, so a course written
  // for ages 4–8 is never "recommended" to a baby's parent by default.
  const aims = aimVirtues(loadCharter());
  const recommended = aims.length
    ? catalog.filter((m) => (MASTERCLASS_VIRTUES[m.id] || []).some((v) => aims.includes(v)))
    : [];

  // ── Reader ───────────────────────────────────────────────────────────────
  if (open) return <MasterclassReader m={open} isDone={!!done[open.id]} onDone={() => markDone(open.id)} onBack={() => setOpenId(null)} reflection={reflection[open.id] || ""} onReflect={(val) => saveReflection(open.id, val)} />;

  // ── Hub ──────────────────────────────────────────────────────────────────
  const firstName = (childProfile.name || "").split(" ")[0];
  const childName = firstName || (he ? "ילדכם" : "your child");

  // B-PLAY-18: no stat trio, no catalogue completion bar — scorekeeping on a
  // reading hub. "Done" stays on each course. W0.7: the fallback move points
  // at the next unfinished course the parent can SEE (age-visible catalog).
  const nextCourse = catalog.find((m) => !done[m.id]);

  // LC-04 — TODAY'S READ: the Learn Library's explainable ranking (age band,
  // focus domain, the concerns the parent logged, their helpful pulse, saved
  // topics, the open family question) with a per-day seed (childId + UTC day),
  // so the pick is stable today and rotates tomorrow.
  // FIREWALL: the signals are the parent's own inputs; no score about the child
  // is read or shown, and the why-line claims only signals that contributed.
  const learnSignals: LearnRankSignals = {
    ageYears: ageYearsFromProfile(childProfile),
    focusDomain: devScore.focusDomain,
    recentConcerns: concernsForBehaviors(recentBehaviorTypes(behaviorLogs, new Date())),
    helpfulness: readLearnFeedback(),
    savedIds: savedLearnIds,
    // v3 EXTRA-FORYOU: the open family question, in the parent's own words.
    topicText: activeFamilyTopic?.title ?? null,
  };
  const todaysRead = todaysLearnPick(LEARN_CARDS, learnSignals, {
    childId: childProfile.id,
    dayKey: pickDayKey(new Date()),
    logs: behaviorLogs,
  });
  // Every branch names a signal that DEMONSTRABLY moved this card: the focus
  // branch reads `todaysRead.fromFocus` (the pick's own re-derivation), gated
  // by `devMapHasSignal` (R2: at least one milestone actually noticed), never
  // the raw `devScore.focusDomain`. If a new why-line is needed, add its
  // re-derived flag to `todaysLearnPick` (learn/todaysPick.ts).
  // B-SHELL-NEW-2j: the parent's own note only on the logs branch (saved outranks it).
  const pickMoment = todaysRead && !todaysRead.fromSaved && todaysRead.fromConcerns ? todaysRead.fromMoment : null;
  // V77: the parent's knot reads "You wrote · Fri 6 Nov" (the boards' day-first short date).
  const pickMomentLead = pickMoment
    ? copy.youWrote(new Intl.DateTimeFormat(uiLang === "he" ? "he-IL" : "en-GB", { weekday: "short", day: "numeric", month: "short" }).format(pickMoment.at))
    : "";
  const pickWhy = !todaysRead
    ? ""
    : todaysRead.fromSaved
      ? t("elev.learnCare.pick.why.saved")
      : todaysRead.fromConcerns
        ? t("elev.learnCare.pick.why.logs")
        : todaysRead.fromFocus && devMapHasSignal(devScore)
          ? t("elev.learnCare.pick.why.focus", { name: childName })
          : t("elev.learnCare.pick.why.age", { name: childName });

  // A plain duration fact about the ONE move (never a completion count).
  const pickMinutes = todaysRead ? todaysRead.card.minutes : nextCourse ? nextCourse.durationMin : null;

  // v3 EXTRA-FORYOU: "Picked for your question" renders only when the open
  // family question DEMONSTRABLY moved today's read (todaysRead.fromTopic),
  // never because a question merely exists. The question is the parent's own
  // words, quoted (bidi-isolated), never paraphrased.
  const pickTopic = todaysRead?.fromTopic && activeFamilyTopic ? activeFamilyTopic.title : null;

  // v10: the parent's own words (a note or the open question) in ink, then
  // Arbor's match in pencil, then this week's program practice when one runs.
  const practice = programWeekLine(program.model);
  const youKnot = todaysRead && (pickTopic || pickMoment) ? (
    <div className="knot you">
      <span className="by">{pickTopic ? t("elev.learnCare.shortReads.matched") : pickMomentLead}</span>
      <span className="q" dir="auto">“<bdi>{pickTopic ?? pickMoment!.text}</bdi>”</span>
    </div>
  ) : null;
  const aiKnot = todaysRead ? (
    <div className="knot ai">
      <span className="by" style={{ color: "var(--sapphire-deep)" }}><Icon name="edit" size={14} />{copy.arborSuggests}</span>
      {pickTopic ? (
        <b data-testid="academy-pick-topic">{t("elev.learnCare.pick.topicTag")}</b>
      ) : (
        <b data-testid="academy-pick-why" data-why={pickMoment ? "moment" : undefined} dir="auto">{pickMoment ? t("elev.learnCare.pick.moment.tail") : pickWhy}</b>
      )}
    </div>
  ) : null;
  const practiceKnot = practice && program.model ? (
    <div className="knot sets fy-practice">
      <span className="by"><Icon name="calendar_month" size={15} />{copy.yourProgram}</span>
      <b dir="auto">{copy.practiceLine(program.model.name, program.model.week)}</b>
    </div>
  ) : null;
  const knots = [youKnot, aiKnot, practiceKnot].filter(Boolean) as React.ReactElement[];
  const threadCols = knots.map((_, i) => (i === 0 && youKnot ? "minmax(0, 1.1fr)" : "minmax(0, 1fr)")).join(" 48px ");

  // v3 EXTRA-FORYOU: courses by area — catalogue counts of the courses the
  // parent can see (plain integers, never progress). A filter left on an area
  // the age switch has since emptied falls back to every area.
  const areaCounts = courseAreaCounts(catalog);
  const selectedArea = activeArea && areaCounts.some((a) => a.area === activeArea) ? activeArea : null;
  const courseList = catalog.filter((c) => !selectedArea || courseArea(c.id) === selectedArea);
  const shownCourses = allCourses ? courseList : courseList.slice(0, RAIL_COURSES);

  const goProgram = () => openProgramPage(setActiveTab as never);
  const openLibrary = () => requestLearnRead({ source: "foryou-library" });

  const pickTitle = todaysRead ? (he ? todaysRead.card.title.he : todaysRead.card.title.en) : nextCourse ? (he ? nextCourse.titleHe : nextCourse.title) : null;
  const pickArt = todaysRead ? DOMAIN_ART[readArea(todaysRead.card.category)] : nextCourse ? DOMAIN_ART[courseArea(nextCourse.id) ?? "family"] : null;

  // V77: the desk reads pick, courses (the rail), programs, more; the phone
  // reads pick, programs, courses, more, with the boards' one-word stops.
  const stopToday: GuideStop = { id: "fy-today", title: desk ? copy.guideToday : copy.stopPick, sub: pickMinutes != null ? copy.guideTodaySub : copy.guideTodayNone };
  const stopCourses: GuideStop = { id: "fy-courses", title: desk ? copy.guideCourses : copy.stopCourses, sub: copy.guideCoursesSub };
  const stopPrograms: GuideStop = { id: "fy-programs", title: desk ? copy.guidePrograms : copy.stopPrograms, sub: program.model ? copy.guideProgramsSub(program.model.name) : copy.guideProgramsNone };
  const stopMore: GuideStop = { id: "fy-more", title: desk ? copy.guideMore : copy.stopMore, sub: copy.guideMoreSub };
  const stops: GuideStop[] = desk ? [stopToday, stopCourses, stopPrograms, stopMore] : [stopToday, stopPrograms, stopCourses, stopMore];

  // ── 1 · For today: the pick, tied to what the parent wrote ──────────────
  const pickScene = (
    <Scene
      as="section"
      field="now"
      className={`fy-scene${desk ? " x8" : ""}`}
      data-module="academy-today"
      data-testid="academy-hub-hero"
      aria-labelledby="fy-pick-title"
      orbs={desk ? [{ size: 400, left: -230, bottom: -250, opacity: 0.6 }, { size: 320, right: -150, top: -210, opacity: 0.65, b: true }] : [{ size: 260, left: -150, bottom: -170, opacity: 0.55 }, { size: 200, right: -100, top: -130, opacity: 0.6, b: true }]}
    >
      <div className="line between" style={{ flexWrap: "wrap", gap: 8 }}>
        <span className="gsec">
          {pickMinutes != null && (
            <span className="kicker" data-testid="academy-pick-minutes">{todaysRead ? (desk ? copy.pickKicker(pickMinutes) : copy.pickKickerShort(pickMinutes)) : copy.pickKickerCourse(pickMinutes)}</span>
          )}
          <StartHere>{copy.startHere}</StartHere>
        </span>
        <span className="fy-meta">
          <EvidenceChip />
          {!desk && <TrustLink surface="foryou-pick" />}
        </span>
      </div>
      <div className="fy-pick-head" style={pickArt ? undefined : { gridTemplateColumns: "minmax(0, 1fr)" }}>
        <div className="stack fy-col" style={{ gap: 8 }}>
          <h1 className="hero" id="fy-pick-title" dir="auto">{pickTitle ?? t("elev.hero.academy.title")}</h1>
          {desk && todaysRead && <p className="fy-pick-hook" dir="auto">{he ? todaysRead.card.hook.he : todaysRead.card.hook.en}</p>}
          {!pickTitle && <p className="fy-pick-hook">{t("elev.hero.academy.sub")}</p>}
        </div>
        {pickArt && <AreaForm art={pickArt} width={desk ? 210 : 116} ratio={0.57} zoom={1.13} />}
      </div>
      {knots.length > 0 && (
        <div className="thread fy-thread" style={{ gridTemplateColumns: threadCols }}>
          {knots.map((k, i) => (
            <React.Fragment key={i}>
              {i > 0 && <Thr ai={knots[i - 1] === aiKnot} />}
              {k}
            </React.Fragment>
          ))}
        </div>
      )}
      {desk && todaysRead && (
        <div className="fy-try">
          <span className="kicker">{t("learn.tryToday")}</span>
          <p dir="auto">{he ? todaysRead.card.tryToday.he : todaysRead.card.tryToday.en}</p>
        </div>
      )}
      {(todaysRead || nextCourse) && (
        <div className="fy-cta">
          <button
            type="button"
            data-primary-move="open-todays-pick"
            data-testid="academy-hero-cta"
            className="btn primary"
            onClick={() => todaysRead ? requestLearnRead({ cardId: todaysRead.card.id, source: "learn-hub-todays-pick" }) : setOpenId(nextCourse!.id)}
          >
            <Icon name="menu_book" size={18} />{t(todaysRead ? "elev.learnCare.pick.cta" : "elev.hero.academy.cta")}
          </button>
          {desk && <TrustLink surface="foryou-pick" className="fy-trust" />}
        </div>
      )}
    </Scene>
  );

  // ── 2 · Courses by area ──────────────────────────────────────────────────
  const ageSwitch = (ageHidden.length > 0 || showAllAges) ? (
    <button type="button" role="switch" aria-checked={showAllAges} onClick={toggleShowAllAges} data-testid="agefilter-toggle-masterclasses" className="fy-switch">
      {showAllAges && <Icon name="check" size={16} />}
      {agefilterText("elev.agefilter.showAll", he)}
      {!showAllAges && <Icon name="chevron_right" size={16} className="rtl:-scale-x-100" />}
    </button>
  ) : null;
  const coursesBody = (
    <>
      <div className="fy-areas">
        <span className="small">
          {showAllAges ? copy.coursesAll(catalog.length) : copy.coursesForAge(catalog.length, firstName)}
          {!showAllAges && ageHidden.length > 0 && <> · {agefilterText("elev.agefilter.hiddenCount", he, { n: ageHidden.length })}</>}
        </span>
        {areaCounts.length > 1 && (
          <div className="fy-area-grid" role="group" aria-label={t("elev.learnCare.byArea")} data-testid="academy-by-area">
            {areaCounts.map(({ area, count }) => (
              <button
                key={area}
                type="button"
                data-area={area}
                aria-pressed={selectedArea === area}
                onClick={() => setActiveArea(selectedArea === area ? null : area)}
                className={`topic${selectedArea === area ? " on" : ""}`}
              >
                <b>{count}</b><span>{domainName(area, t)}</span>
              </button>
            ))}
            {selectedArea && (
              <button type="button" aria-pressed={false} onClick={() => setActiveArea(null)} className="topic all">
                {t("elev.learnCare.byArea.all")}
              </button>
            )}
          </div>
        )}
      </div>
      {shownCourses.map((c) => {
        const art = DOMAIN_ART[courseArea(c.id) ?? "family"];
        const isCardDone = !!done[c.id];
        // W0.7: out-of-band courses (reachable via "Show all ages") carry a
        // small age chip so the parent knows why they were tucked away.
        const outOfBand = ageFits.get(c) === "out";
        // Lesson count = number of authored sections (an honest catalog fact).
        // A finished course fills its marks; nothing finer is recorded.
        const lessons = c.sections.length;
        return (
          <button key={c.id} type="button" className="crs fy-crs" data-testid="academy-course" onClick={() => setOpenId(c.id)}>
            <AreaForm art={art} width={60} ratio={0.66} zoom={1.22} />
            <span className="nm" dir="auto">
              {he ? c.titleHe : c.title}
              <small>{he ? FRAME_LABELS[c.frame].he : FRAME_LABELS[c.frame].en} · {c.durationMin} {t("master.min")}</small>
              {outOfBand && c.ageMinYears != null && (
                <span className="agechip">
                  {c.ageMaxYears != null
                    ? agefilterText("elev.agefilter.chip", he, { min: c.ageMinYears, max: c.ageMaxYears })
                    : agefilterText("elev.agefilter.chipPlus", he, { min: c.ageMinYears })}
                </span>
              )}
              <span className="pips">
                {Array.from({ length: Math.min(lessons, 6) }, (_, i) => <i key={i} className={`pip${isCardDone ? " on" : ""}`} aria-hidden="true" />)}
                <span className="small">{t("academy.lessons", { n: lessons })}</span>
              </span>
            </span>
            <span className="go">
              {isCardDone ? <><Icon name="check" size={15} />{t("master.done")}</> : <><span className="fy-go-t">{t("master.read")}</span><Icon name="chevron_right" size={16} className="rtl:-scale-x-100" /></>}
            </span>
          </button>
        );
      })}
      {!desk && <p className="small fy-legend">{copy.pipsLegend}</p>}
      {courseList.length > RAIL_COURSES && (
        <MoreLink onClick={() => setAllCourses((v) => !v)}>{allCourses ? copy.fewerCourses : copy.allCourses(courseList.length)}</MoreLink>
      )}
      {/* D3: courses that build the family's chosen virtues (Family Charter). */}
      {recommended.length > 0 && (
        <div className="stack fy-col" style={{ gap: 8 }}>
          <span className="kicker">{t("master.rec")}</span>
          <div className="fy-rec">
            {recommended.map((c) => (
              <button key={c.id} type="button" className="chip line" onClick={() => setOpenId(c.id)} dir="auto">
                {he ? c.titleHe : c.title}
                {done[c.id] && <Icon name="check" size={15} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );

  // One catalogue block for both compositions: the rail's own head carries the
  // title on a desk; on a phone the block brings its numbered heading.
  const coursesBlock = (
    <div data-module="academy-catalogue" data-testid="academy-courses" className="stack fy-col" style={{ gap: 12 }}>
      {!desk && <RouteHead id="fy-courses-title" title={t("elev.learnCare.byArea")} sub={copy.coursesForAgeShort(catalog.length, firstName)} />}
      {!desk && ageSwitch && <div className="fy-switchrow">{ageSwitch}</div>}
      {coursesBody}
    </div>
  );

  // ── 4 · More to read, and the Learning Map rail behind one disclosure ────
  // W2-SHELLPLAY critic r2 (G0): the rail heading claims a match only where
  // one exists (inside the signal branch, "Picked for {name}"); with no
  // noticed milestone one muted door to Milestones stands in for both cards.
  const railStack = (
    <>
      {devMapHasSignal(devScore) ? (
        <>
          <p data-testid="academy-rail-title" className="h3" dir="auto">
            {t("academy.learnMap.title", { name: childName })}
          </p>
          {/* AP-053: Academy "For You" — the copilot pick (pure frontend join). */}
          <AcademyForYou />
          {/* AP-055: Scholar Hub — one developmental concept per week. */}
          <ScholarHubCard />
        </>
      ) : (
        <MoreLink onClick={() => setActiveTab("milestones")} className="fy-nosignal">
          <span data-testid="academy-rail-nosignal" dir="auto">{t("elev.growthTruth.learn.rail.noSignal", { name: childName })}</span>
        </MoreLink>
      )}
    </>
  );
  const moreTiles = (
    <>
      <Tile className={desk ? "x6" : undefined} icon="local_library" title={copy.libraryTitle} titleId="fy-library-title">
        <div className="fy-door">
          <AreaForm art={EMPTY_ART.learn} width={desk ? 104 : 84} ratio={0.62} zoom={1.05} />
          <p dir="auto">{copy.librarySub(firstName)}</p>
        </div>
        <MoreLink onClick={openLibrary} className="fy-library-open">
          <span data-testid="academy-library-open">{t("elev.learnCare.library.open")}</span>
        </MoreLink>
      </Tile>
      {/* v3 EXTRA-FORYOU: family formation as a door; #/family opens Together › Stories, where the parent chooses the ritual. */}
      <Tile className={desk ? "x6" : undefined} icon="menu_book" title={t("elev.learnCare.family.title")} titleId="fy-family-title">
        <div className="fy-door">
          <AreaForm art={TOGETHER_ART} width={desk ? 104 : 84} ratio={0.66} zoom={1.05} />
          <p dir="auto"><b>{t("elev.learnCare.family.headline")}</b>{t("elev.learnCare.family.sub")}</p>
        </div>
        <MoreLink onClick={() => setActiveTab("family")}>
          <span data-testid="academy-family-door">{t("elev.learnCare.family.cta")}</span>
        </MoreLink>
      </Tile>
    </>
  );

  // Your programs: section 3 on a desk, section 2 on a phone (the boards' order).
  const programsSection = (
    <RouteSection id="fy-programs" n={desk ? 3 : 2} stopTop={desk ? 0 : 4} aria-labelledby="fy-programs-title">
      <div data-module="academy-programs" className="stack fy-col" style={{ gap: 12 }}>
        <RouteHead id="fy-programs-title" title={copy.guidePrograms} sub={program.model ? (desk ? copy.programsRunningSub : undefined) : t("elev.program.none.title")} />
        <ForYouPrograms state={program} copy={copy} composition={composition} onOpen={goProgram} />
      </div>
    </RouteSection>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto w-full min-w-0 max-w-[1180px]">
      <DsRoot composition={composition} className="stack fy-col fy-page" style={{ gap: desk ? 22 : 14 }} data-testid="foryou-page">
        <Guide stops={stops} mini={!desk} label={copy.onThisPage} />
        <Route composition={composition} className="fy-route">
          {desk ? (
            <RouteSection id="fy-today" n={1} on>
              <Row12>
                {pickScene}
                {/* The rail (SideRail's markup): its head carries the age switch, which belongs to this list. */}
                <aside className="siderail cards x4" id="fy-courses" aria-labelledby="fy-courses-title">
                  <div className="rh fy-railhead">
                    <span className="rstop inline" aria-hidden="true">2</span>
                    <h2 className="h3" id="fy-courses-title">{t("elev.learnCare.byArea")}</h2>
                    {ageSwitch}
                  </div>
                  {coursesBlock}
                </aside>
              </Row12>
            </RouteSection>
          ) : (
            <>
              <RouteSection id="fy-today" n={1} on>
                {pickScene}
              </RouteSection>
              {programsSection}
              <RouteSection id="fy-courses" n={3} stopTop={4} aria-labelledby="fy-courses-title">
                {coursesBlock}
              </RouteSection>
            </>
          )}
          {desk && programsSection}

          <RouteSection id="fy-more" n={4} stopTop={desk ? 0 : 4} aria-labelledby="fy-more-title">
            <div data-module="academy-more" data-module-demoted className="stack fy-col" style={{ gap: 12 }}>
              <RouteHead id="fy-more-title" title={copy.guideMore} />
              {desk ? <Row12>{moreTiles}</Row12> : moreTiles}
              <details data-module-disclosure="academy-rail" data-testid="academy-rail" className="fy-rail-more">
                <summary style={{ minHeight: 44 }}>
                  <Icon name="expand_more" size={18} />
                  {t("academy.rail.more")}
                </summary>
                <div className="fy-rail-body">{railStack}</div>
              </details>
            </div>
          </RouteSection>
        </Route>
      </DsRoot>
    </motion.div>
  );
}

/**
 * B-PLAY-17 — the course reader, exported so the Learn Library's "Courses"
 * filter opens the SAME reader inline. It carries the Learn reader's actions:
 * "Add to today" (acceptTodayAction(tryTonight, "tiny", "learn-read") — one
 * action-loop row, never twice), "Ask Arbor" (seedCoach prefill, the parent
 * sends) and Listen (SpeakButton over the course body). Done and the private
 * reflection persist through this file's own device keys; a caller that does
 * not pass them (Learn) gets the same stored state.
 */
export function MasterclassReader({ m, isDone: isDoneProp, onDone: onDoneProp, onBack, reflection: reflectionProp, onReflect: onReflectProp }: {
  m: Masterclass; isDone?: boolean; onDone?: () => void; onBack: () => void; reflection?: string; onReflect?: (v: string) => void;
}) {
  const { t, aiLang, uiLang } = useLanguage();
  const { childProfile, actionLoop, actionLoopConfirmed, acceptTodayAction, seedCoach } = useArbor();
  const he = aiLang === "he";
  const frameLabel = he ? FRAME_LABELS[m.frame].he : FRAME_LABELS[m.frame].en;
  const tone = FRAME_TONE[m.frame];
  // Self-contained persistence when the caller does not own it (Learn's Courses).
  const [ownDone, setOwnDone] = useState<boolean>(() => !!loadDone()[m.id]);
  const [ownReflection, setOwnReflection] = useState<string>(() => loadReflection()[m.id] || "");
  const isDone = isDoneProp ?? ownDone;
  const reflection = reflectionProp ?? ownReflection;
  const onDone = () => {
    if (onDoneProp) { onDoneProp(); return; }
    const next = { ...loadDone(), [m.id]: true };
    try { localStorage.setItem(DONE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setOwnDone(true);
  };
  const onReflect = (val: string) => {
    if (onReflectProp) { onReflectProp(val); return; }
    const next = { ...loadReflection(), [m.id]: val };
    try { localStorage.setItem(REFLECT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setOwnReflection(val);
  };
  const tryTonight = (he ? m.tryTonightHe : m.tryTonight).trim();
  const todayTaken = actionLoop.some((a) => a.source === "learn-read" && a.recommendation === tryTonight);
  // v3 EXTRA-FORYOU: "Added to today" shows only after the write resolved.
  // The action-loop row appears locally before the server has it (latency
  // compensation), so the row alone is no receipt: the button says "Adding…"
  // while this tap's write is in flight and "Added" once it resolved; a failed
  // write says so under the actions. The call keeps the shared seam's default
  // settlement (the exact call is pinned in learnCourses.test.ts), and under
  // that seam a write the server has not answered in QUEUED_ACK_MS, or one made
  // offline, counts as KEPT: it is in the persistent local cache and syncs on
  // reconnect (lib/firestoreWrite.ts). A rejection that arrives in time still
  // fails. On a later visit, a row in a server-CONFIRMED ledger reads "Added";
  // a row the ledger has not confirmed yet (cache or pending snapshot) reads
  // the neutral "On today's list", never "Added" and never a live "Add".
  const [addState, setAddState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const readerMounted = useRef(true);
  useEffect(() => { readerMounted.current = true; return () => { readerMounted.current = false; }; }, []);
  const addedShown = addState === "saved" || (addState === "idle" && todayTaken && actionLoopConfirmed === true);
  const addListed = !addedShown && addState === "idle" && todayTaken;
  const addToday = () => {
    if (todayTaken) return;
    if (addState === "saving") return;
    setAddState("saving");
    const write = acceptTodayAction(tryTonight, "tiny", "learn-read");
    write.then(
      () => { if (readerMounted.current) setAddState("saved"); },
      () => { if (readerMounted.current) setAddState("failed"); },
    );
    try { track("learn_add_today", { course: m.id }); } catch { /* noop */ }
  };
  const firstName = (childProfile.name || "").split(" ")[0];
  const ask = () => seedCoach({ prompt: t("master.ask.prompt", { title: he ? m.titleHe : m.title, name: firstName || t("learn.yourChild") }), source: "learn-course" });
  const listenText = [
    he ? m.titleHe : m.title,
    he ? m.hookHe : m.hook,
    ...m.sections.flatMap((s) => [he ? s.headingHe : s.heading, he ? s.bodyHe : s.body]),
    he ? m.parentScriptHe : m.parentScript,
    tryTonight,
  ].join(". ");
  // Wave-8: a single subtle brand-colored burst on completing a lesson
  // (capped + reduced-motion-safe via lib/celebrate — Law 7).
  const onComplete = () => {
    celebrate({ kind: "lesson" });
    onDone();
  };
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5 max-w-[760px]">
      <button onClick={onBack} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold" style={{ color: "var(--arbor-muted)" }}>
        <Icon name="arrow_back" size={16} /> {t("master.all")}
      </button>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <IconBadge tone={tone}><Icon name="school" size={20} /></IconBadge>
          <span className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>{frameLabel}</span>
          <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: "var(--arbor-muted)" }}><Icon name="schedule" size={13} /> {m.durationMin} {t("master.min")}</span>
        </div>
        <h1 className="text-2xl md:text-[1.9rem] leading-tight tracking-tight" dir="auto" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
          {he ? m.titleHe : m.title}
        </h1>
        <p className="text-[15px] leading-relaxed mt-2" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>
          {he ? m.hookHe : m.hook}
        </p>
      </div>

      {/* B-PLAY-17: the Learn reader's actions — Add to today · Ask Arbor · Listen. */}
      <div className="flex flex-wrap items-center gap-2" data-testid="course-reader-actions">
        <button
          type="button"
          onClick={addToday}
          disabled={todayTaken}
          aria-busy={addState === "saving"}
          data-testid="course-add-today"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-bold transition disabled:opacity-70"
          style={addedShown
            ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }
            : addListed
              ? { background: "var(--arbor-paper-deep)", color: "var(--arbor-ink-soft)", border: "1px solid var(--arbor-rule)" }
              : { background: "var(--gradient-cta)", color: "var(--arbor-on-accent)" }}
        >
          {/* W2-SHELLPLAY r2 (learn design): the course reader's one --gradient-cta is the
              target's own move, "Add to today"; "Mark complete" below is a ghost. */}
          <Icon name={addedShown ? "check_circle" : addListed ? "event_available" : "add_task"} size={16} fill={addedShown ? 1 : 0} />
          {addState === "saving"
            ? t("elev.learnCare.addToday.saving")
            : addedShown
              ? t("learn.addedToday")
              : addListed
                ? t("elev.learnCare.addToday.listed")
                : t("learn.addToday")}
        </button>
        <button
          type="button"
          onClick={ask}
          data-testid="course-ask"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-bold transition"
          style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
        >
          <Icon name="forum" size={16} /> {t("nav.tab.coach")}
        </button>
        <SpeakButton text={listenText} lang={uiLang} label={t("learn.listen")} size="md" className="touch-target" />
      </div>
      {addState === "failed" && (
        <p role="alert" data-testid="course-add-today-failed" className="t-sm" style={{ color: "var(--arbor-ink-soft)" }}>{t("elev.learnCare.addToday.failed")}</p>
      )}

      <div className="space-y-5">
        {m.sections.map((s, i) => (
          <section key={i}>
            <h2 className="text-[15px] font-extrabold mb-1" dir="auto" style={{ color: "var(--arbor-ink)" }}>{he ? s.headingHe : s.heading}</h2>
            <p className="text-[length:var(--t-base)] leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>{he ? s.bodyHe : s.body}</p>
          </section>
        ))}
      </div>

      {/* What to say — the verbatim parent script */}
      <div className="rounded-2xl p-4" style={{ background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.25)" }}>
        <p className="text-xs uppercase tracking-widest font-bold mb-1.5 inline-flex items-center gap-1.5" style={{ color: "var(--arbor-green-ink)" }}>
          <Icon name="format_quote" size={15} fill={1} /> {t("master.whatToSay")}
        </p>
        <p className="t-base leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-sans)", fontStyle: "normal" }}>{he ? m.parentScriptHe : m.parentScript}</p>
      </div>

      {/* Try tonight */}
      <div className="rounded-2xl p-4" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
        <p className="text-xs uppercase tracking-widest font-bold mb-1.5 inline-flex items-center gap-1.5" style={{ color: "var(--arbor-muted)" }}>
          <Icon name="bedtime" size={15} fill={1} /> {t("master.tryTonight")}
        </p>
        <p className="text-[length:var(--t-base)] leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink)" }}>{he ? m.tryTonightHe : m.tryTonight}</p>
      </div>

      {/* Wave-8: private parent reflection — client-only localStorage, never sent or stored server-side. */}
      <div className="rounded-2xl p-4" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}>
        {/* B-PLAY-17: a real <label> names the field (was a <p> caption). */}
        <label htmlFor={`course-reflect-${m.id}`} className="text-xs uppercase tracking-widest font-bold mb-1.5 inline-flex items-center gap-1.5" style={{ color: "var(--arbor-muted)" }}>
          <Icon name="edit_note" size={16} fill={1} /> {t("master.reflect.label")}
        </label>
        <textarea
          id={`course-reflect-${m.id}`}
          value={reflection}
          onChange={(e) => onReflect(e.target.value)}
          placeholder={t("master.reflect.placeholder")}
          dir="auto"
          rows={2}
          className="w-full text-[length:var(--t-base)] leading-relaxed rounded-lg px-3 py-2 resize-y min-h-[64px] focus:outline-none focus:ring-2"
          style={{ color: "var(--arbor-ink)", background: "var(--arbor-paper-sunk)", border: "1px solid var(--arbor-rule)" }}
        />
        <p className="text-xs mt-1.5" style={{ color: "var(--arbor-faint)" }}>{t("master.reflect.hint")}</p>
      </div>

      {isDone ? (
        <div className="text-center text-sm font-bold inline-flex items-center justify-center gap-2 w-full" style={{ color: "var(--arbor-green-ink)" }}>
          <Icon name="check" size={17} fill={1} /> {t("master.markedComplete")}
        </div>
      ) : (
        <button onClick={onComplete} data-testid="course-mark-complete" className="w-full min-h-11 py-3 font-bold text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98]" style={{ background: "transparent", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}>
          <Icon name="check" size={17} fill={1} /> {t("master.markComplete")}
        </button>
      )}
    </motion.div>
  );
}
