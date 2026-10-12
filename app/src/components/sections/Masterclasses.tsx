import React, { Suspense, lazy, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { celebrate } from "../../lib/celebrate";
import { Icon } from "../ui/Icon";
import { FreeText } from "../ui/FreeText";
import { SpeakButton } from "../ui/SpeakButton";
import { cardCls, IconBadge, PASTEL, type PastelKey } from "../ui/kit";
import { TrustLink } from "../trust/TrustLink";
import { useLanguage } from "../../context/LanguageContext";
import { useArbor } from "../../context/ArborContext";
import { MASTERCLASSES, FRAME_LABELS, type FrameId, type Masterclass } from "../../lib/masterclasses";
import { loadCharter, aimVirtues } from "../../lib/becoming";
// W0.7 — age-fit filtering (shared helper; banding reused from playbank/stages)
import { filterByAge, loadShowAllAges, saveShowAllAges, windowFromYears, type AgeWindowMonths } from "../../lib/ageFilter";
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
import { rankLearnCards, type LearnRankSignals } from "../../learn/learnLibrary";
import { pickShortReads } from "../../learn/shortReads";
import { ageVisibleLearnCards, devMapHasSignal, pickDayKey, todaysLearnPick } from "../../learn/todaysPick";
// v3 EXTRA-FORYOU: courses and reads by area (the ONE domain registry: names,
// glyphs, order, and one ink/soft pair per area).
import { courseArea, courseAreaCounts, readArea } from "../../learn/courseAreas";
import { domainName, type DomainId } from "../../lib/domains/registry";
import { DOMAIN_ICONS } from "../../lib/domains/icons";
import { DOMAIN_VARS } from "../../lib/tokens";
import { DOMAIN_ART } from "../../lib/parentArt";
// v3 F-FORYOU-1: Daily Play's readiness courses are the parent's reading now.
import { READINESS_COURSES, localizeCourse, type PlayCourse } from "../../playbank/courses";
import { PLAY_BANDS } from "../../playbank/content";
import type { DevelopmentMetricId } from "../../types";
import { TryTodayButton } from "./useTryToday";
import { takeLibraryScroll } from "./forYouScroll";
import ReadinessReader from "./ReadinessReader";

// v3 F-FORYOU-1: a read opens in a sheet over this page. Loaded on first
// open (createPortal has no server render, and most visits open no read).
const ForYouReadSheet = lazy(() => import("./ForYouReadSheet"));

const FRAME_TONE: Record<FrameId, PastelKey> = {
  aim: "sky",
  twoAxes: "mint",
  story: "lav",
  shadow: "coral",
  marriage: "pink",
  shepherd: "yellow",
};

/** Which virtues each masterclass builds — used to rank by the Family Charter. */
const MASTERCLASS_VIRTUES: Record<string, DevelopmentMetricId[]> = {
  "holding-the-line-without-anger": ["wisdom", "responsibility"],
  "building-responsibility-by-age": ["responsibility"],
  "repair-after-conflict": ["empathy", "truth"],
  "raising-courage-without-harshness": ["courage", "resilience"],
};

/** v3 EXTRA-FORYOU: a private-use mark the topic why-line is split on, so the
 *  parent's question renders through FreeText (bidi-isolated) between the
 *  translated lead and tail. It is never displayed. */
const TOPIC_SLOT = "\uE000";

/** v3 EXTRA-FORYOU: a "Courses by area" chip, in the Learn filter pill's shape and tokens. */
const AREA_CHIP = "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold transition focus:outline-none focus-visible:ring-2";
const areaChipStyle = (on: boolean): React.CSSProperties => on
  ? { background: "var(--arbor-subtab-active)", color: "var(--arbor-subtab-on-ink)" }
  : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink-soft)", border: "1px solid var(--arbor-rule)" };

/** v3 F-FORYOU-1: one card shape for a parent course and a readiness course:
 *  a compact row on a phone (glyph, title, meta), a card from sm up. */
const COURSE_CARD = `${cardCls} flex min-h-11 min-w-0 items-center gap-3 p-3 text-start transition motion-safe:hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 sm:flex-col sm:items-stretch sm:gap-3 sm:p-5`;

/** v3 F-FORYOU-1: the area's glyph in a soft blob of the area's own tone (a
 *  domain colour names the AREA, never anything about the child). */
function AreaBlob({ area }: { area: DomainId | null }) {
  const tone = area ? DOMAIN_VARS[area] : null;
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl sm:h-12 sm:w-12"
      style={tone ? { background: tone.soft, color: tone.ink } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}
    >
      <Icon name={area ? DOMAIN_ICONS[area] : "school"} size={22} />
    </span>
  );
}

/** v3 F-FORYOU-1: a readiness course's age span in whole years, from the
 *  Daily Play bands it is written for (maxYears exclusive, as PLAY_BANDS). */
function readinessYears(course: PlayCourse): { min: number; max: number } | null {
  const spans = PLAY_BANDS.filter((b) => course.bands.includes(b.band));
  if (!spans.length) return null;
  return { min: Math.min(...spans.map((b) => b.minYears)), max: Math.max(...spans.map((b) => b.maxYears)) };
}
const readinessWindow = (course: PlayCourse): AgeWindowMonths | null => {
  const years = readinessYears(course);
  return years ? { minMonths: years.min * 12, maxMonths: years.max * 12 } : null;
};

const DONE_KEY = "arbor.masterclasses.done";
export const loadDone = (): Record<string, boolean> => {
  try { return JSON.parse(localStorage.getItem(DONE_KEY) || "{}"); } catch { return {}; }
};

/**
 * R17 — true below Tailwind's `md` (768 px), i.e. on a phone.
 *
 * The same seam ui/Sheet.tsx uses for `useCompactSurface`: a media QUERY read
 * through `useSyncExternalStore`, not a device sniff, so rotating the phone
 * re-renders. SSR and any environment without matchMedia read false — the
 * desktop layout — so a missing matchMedia degrades to the wide layout rather
 * than to nothing. (v3 F-FORYOU-1: the hub itself is one responsive column
 * set now and no longer reads it.)
 */
const PHONE_QUERY = "(max-width: 767.98px)";
const subscribePhone = (onChange: () => void) => {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const readPhone = () =>
  typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(PHONE_QUERY).matches;
export function usePhoneLayout(): boolean {
  return useSyncExternalStore(subscribePhone, readPhone, () => false);
}

// Wave-8: private parent reflection — client-only localStorage, never sent/stored server-side.
const REFLECT_KEY = "arbor.masterclasses.reflection";
const loadReflection = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(REFLECT_KEY) || "{}"); } catch { return {}; }
};

/** For you, the parent (#/masterclasses) — today's pick, short reads for the
 *  parent's question, and the library of courses by area, with the door to the
 *  family's rituals. Short, frame-routed lessons that build the parent's own
 *  competence (the calm, competent adult). Text-first, bilingual. */
export default function Masterclasses() {
  const { t, aiLang, uiLang } = useLanguage();
  const { childProfile, behaviorLogs, savedLearnIds, setActiveTab, activeFamilyTopic } = useArbor();
  const he = aiLang === "he";
  const [openId, setOpenId] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [reflection, setReflection] = useState<Record<string, string>>({});
  // LC-04: the same shared dev-score derivation the Learn reads rank on.
  const devScore = useDevScore();
  // v3 F-FORYOU-1: a read opens in a sheet over this page; a readiness course
  // opens its own reader here.
  const [readId, setReadId] = useState<string | null>(null);
  const [readinessId, setReadinessId] = useState<string | null>(null);
  // v3 F-FORYOU-1: arriving from #/learn without a read (the old library
  // link) lands on the library, not the top of the page. Taken once on mount.
  const [scrollToLibrary] = useState(() => takeLibraryScroll());
  useEffect(() => {
    if (!scrollToLibrary || typeof window === "undefined") return;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector('[data-testid="academy-courses"]')?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [scrollToLibrary]);

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
  // v3 F-FORYOU-1: the readiness courses follow the same age switch, by the
  // Daily Play bands they are written for.
  const { visible: readinessVisible, hidden: readinessHidden, fits: readinessFits } = filterByAge(
    READINESS_COURSES,
    readinessWindow,
    childMonths,
  );
  const readiness = showAllAges ? READINESS_COURSES : readinessVisible;
  const hiddenByAge = ageHidden.length + readinessHidden.length;
  const ageSwitchShown = (ageHidden.length > 0 || showAllAges) || readinessHidden.length > 0;

  // D3 → v3 F-FORYOU-1: the Family Charter ranks the catalogue instead of a
  // strip of its own: the courses that build the family's chosen virtues come
  // first (and so lead the fallback pick), the rest keep their order. W0.7:
  // drawn from the age-visible catalog, so a course written for ages 4–8 is
  // never put first for a baby's parent by default.
  const aims = aimVirtues(loadCharter());
  const buildsAim = (m: Masterclass) => (MASTERCLASS_VIRTUES[m.id] || []).some((v) => aims.includes(v));
  const ageCatalog = showAllAges ? MASTERCLASSES : ageVisible;
  const catalog = aims.length ? [...ageCatalog.filter(buildsAim), ...ageCatalog.filter((m) => !buildsAim(m))] : ageCatalog;
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
  const openReadiness = readinessId ? READINESS_COURSES.find((r) => r.id === readinessId) ?? null : null;

  // ── Readers ──────────────────────────────────────────────────────────────
  if (open) return <MasterclassReader m={open} isDone={!!done[open.id]} onDone={() => markDone(open.id)} onBack={() => setOpenId(null)} reflection={reflection[open.id] || ""} onReflect={(val) => saveReflection(open.id, val)} />;
  if (openReadiness) return <ReadinessReader course={openReadiness} onBack={() => setReadinessId(null)} />;

  // ── Catalog ──────────────────────────────────────────────────────────────
  const childName = (childProfile.name || "").split(" ")[0] || (he ? "ילדכם" : "your child");

  // E2 hero — the next unfinished course drives the fallback CTA.
  // B-PLAY-18: the header stat trio (courses / completed / minutes) and the
  // catalogue completion bar are gone — scorekeeping on a reading hub. "Done"
  // stays on each card; the reading time of today's pick rides its own line.
  // W0.7: the ONE CTA points at the next unfinished course the parent can SEE
  // (the age-visible catalog), never at an age-hidden one.
  const nextCourse = catalog.find((m) => !done[m.id]);

  // LC-04 — TODAY'S READ. The hub's ONE move used to be `catalog.find(!done)`:
  // the first unfinished course in FILE ORDER, identical for every parent until
  // they marked it done, and 10-13 minutes long against a three-minute job. The
  // real, explainable ranking (age band, Development-Map focus domain, the
  // concerns the parent actually logged, their own helpful/not-helpful pulse,
  // saved topics) is mounted on the hub, with a per-day seed (childId + UTC
  // day) so the pick is stable today and rotates tomorrow.
  // v3 F-FORYOU-1: the signals the old side rail showed as cards of their own
  // (Academy For You's focus domain, the charter's virtues) rank here instead.
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
  // Every branch names a signal that DEMONSTRABLY moved this card. The focus
  // branch reads `todaysRead.fromFocus` — the pick's own re-derivation — and
  // not `devScore.focusDomain`: a set focus domain says the parent has one, not
  // that today's winner shares it. Do not reintroduce a raw signal here; if a
  // new why-line is needed, add its re-derived flag to `todaysLearnPick`
  // (learn/todaysPick.ts).
  // R2 (ENG-07 applied to the hero): `fromFocus` proves the focus domain moved
  // THIS card — it does not prove the parent has explored anything. A day-0
  // profile (0 noticed milestones, 0 logs in window) still has a focus domain,
  // so `devMapHasSignal` gates the claim: at least one milestone actually
  // noticed, or the claim falls to the age-only variant.
  // B-SHELL-NEW-2j: only on the logs branch (saved outranks it, as in pickWhy).
  const pickMoment = todaysRead && !todaysRead.fromSaved && todaysRead.fromConcerns ? todaysRead.fromMoment : null;
  const pickMomentLead = (() => {
    if (!pickMoment) return "";
    const day0 = new Date(); day0.setHours(0, 0, 0, 0);
    const at0 = new Date(pickMoment.at); at0.setHours(0, 0, 0, 0);
    const days = Math.round((day0.getTime() - at0.getTime()) / 86_400_000);
    if (days <= 0) return t("elev.learnCare.pick.moment.today");
    if (days === 1) return t("elev.learnCare.pick.moment.yesterday");
    const locale = uiLang === "he" ? "he-IL" : "en-GB";
    return days <= 6
      ? t("elev.learnCare.pick.moment.weekday", { day: new Intl.DateTimeFormat(locale, { weekday: "long" }).format(pickMoment.at) })
      : t("elev.learnCare.pick.moment.date", { day: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(pickMoment.at) });
  })();
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

  // v3 F-FORYOU-1: the pick card's second column. A course lists its lessons
  // by title; a read lists its key points. Plain lines: no state, no ticks,
  // no "lesson n", nothing done or left.
  const pickLessons: string[] = todaysRead
    ? todaysRead.card.keyPoints.map((k) => (he ? k.he : k.en))
    : nextCourse
      ? nextCourse.sections.map((s) => (he ? s.headingHe : s.heading))
      : [];
  // v3 F-FORYOU-1: "Try it today" puts the pick's one small thing on today's
  // list — the same text and source the reader's own "Add to today" writes,
  // so the two can never add it twice.
  const pickTry = todaysRead
    ? (he ? todaysRead.card.tryToday.he : todaysRead.card.tryToday.en).trim()
    : nextCourse
      ? (he ? nextCourse.tryTonightHe : nextCourse.tryTonight).trim()
      : "";
  const openRead = (cardId: string, source: "learn-hub-todays-pick" | "learn-hub-short-read") => {
    setReadId(cardId);
    try { track("learn_deep_link", { source }); } catch { /* noop */ }
  };

  // v3 EXTRA-FORYOU: "Picked for your question". The tag and the quoting
  // why-line render only when the open family question DEMONSTRABLY moved
  // today's read (todaysRead.fromTopic, the pick's own re-derivation), never
  // because a question merely exists. The question is the parent's words,
  // quoted through FreeText (bidi-isolated), never paraphrased.
  const pickTopic = todaysRead?.fromTopic && activeFamilyTopic ? activeFamilyTopic.title : null;
  const [topicLead, topicTail = ""] = t("elev.learnCare.pick.why.topic", { title: TOPIC_SLOT }).split(TOPIC_SLOT);

  // v3 EXTRA-FORYOU: short reads - three whenever the age-fit catalogue holds
  // three besides today's read. The same ranking (the same signals, the
  // question included), today's read left out: the reads that meet the open
  // question first, then the next reads in that same order (learn/shortReads).
  // The kicker says "for your question" only when the first read meets it; in
  // a mixed row each read that meets it carries its own mark. Minutes on each
  // card, never a count of reads done.
  const readShelf = rankLearnCards(ageVisibleLearnCards(LEARN_CARDS, learnSignals.ageYears), learnSignals)
    .filter((c) => c.id !== todaysRead?.card.id);
  const shortReadRow = pickShortReads(readShelf, activeFamilyTopic?.title);

  // v3 EXTRA-FORYOU: courses by area. Catalogue counts of the courses the
  // parent can see, the readiness courses included (plain integers, never
  // progress). A filter left on an area the age switch has since emptied
  // falls back to every area.
  const areaCounts = courseAreaCounts([...catalog, ...readiness]);
  const selectedArea = activeArea && areaCounts.some((a) => a.area === activeArea) ? activeArea : null;

  // B-PLAY-18: the spine ribbon ("Courses follow what you notice on the
  // Development Map") is removed — the claim is unverified (FU#23): the
  // catalogue order does not read the map.

  return (
    <>
      {/* Item 11 (IA-02): the surface contract reaches the DOM. `data-module`
          marks a top-level sibling module (what moduleBudget counts);
          `data-primary-move` marks the ONE control set that performs the move
          surfaceContract.ts declares for this route — here the header that
          holds today's pick and its read CTA. */}
      <header data-primary-move="open-todays-pick" data-testid="academy-hub-hero" className="mx-auto mb-8 w-full min-w-0 max-w-[1180px]">
        {/* v3 EXTRA-FORYOU: the parent's own hub says so: a quiet sentence-case
            kicker, the title, one line on what is here (from sm up). */}
        <p data-testid="academy-hero-kicker" className="mb-1 text-sm font-semibold" style={{ color: "var(--arbor-muted)" }}>{t("elev.hero.academy.kicker")}</p>
        <h1 className="text-2xl sm:text-3xl leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("elev.hero.academy.title")}</h1>
        <p data-testid="academy-hero-sub" className="mt-1.5 hidden max-w-[60ch] text-[15px] leading-relaxed sm:block" style={{ color: "var(--arbor-ink-soft)" }}>{t("elev.hero.academy.sub")}</p>
        {/* v3 F-FORYOU-1: today's pick as one card: the tag (only when the
            question moved it), the title, why it was picked, its length, the
            read, "Try it today" and how Arbor decides; beside it (below it on
            a phone) the lessons or the read's key points, as plain lines. */}
        {(todaysRead || nextCourse) && <section data-testid="academy-pick" className={`${cardCls} mt-5 grid min-w-0 gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-8`}>
          <div className="min-w-0 space-y-2.5">
            {pickTopic && (
              <span data-testid="academy-pick-topic" className="mb-2 inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold" style={{ background: PASTEL.lav.soft, color: PASTEL.lav.ink }}>
                <Icon name="auto_awesome" size={14} fill={1} />{t("elev.learnCare.pick.topicTag")}
              </span>
            )}
            <h2 className="text-xl font-bold leading-snug" dir="auto" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>{todaysRead ? (he ? todaysRead.card.title.he : todaysRead.card.title.en) : (he ? nextCourse!.titleHe : nextCourse!.title)}</h2>
            {/* W2-SHELLPLAY critic r2 (B-SHELL-NEW-2j): when the parent's own
                note moved today's pick, the why-line QUOTES it (lead-in sans
                muted, the note in the editorial face, a peach-ink inline-start
                rule) — never a domain, a score or a count. Otherwise the
                re-derived why-line as before. */}
            {pickTopic ? (
              <p data-testid="academy-pick-why" data-why="family-question" dir="auto" className="mt-2 leading-relaxed" style={{ borderInlineStart: "3px solid var(--arbor-lav-ink)", paddingInlineStart: 12 }}>
                <span className="t-sm" style={{ color: "var(--arbor-muted)", fontFamily: "var(--font-sans)" }}>{topicLead}</span>
                <FreeText text={pickTopic} className="t-base" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-editorial)" }} />
                <span className="t-sm" style={{ color: "var(--arbor-muted)", fontFamily: "var(--font-sans)" }}>{topicTail}</span>
              </p>
            ) : todaysRead && pickMoment ? (
              <p data-testid="academy-pick-why" data-why="moment" dir="auto" className="mt-2 leading-relaxed" style={{ borderInlineStart: "3px solid var(--arbor-peach-ink)", paddingInlineStart: 12 }}>
                <span className="t-sm" style={{ color: "var(--arbor-muted)", fontFamily: "var(--font-sans)" }}>{pickMomentLead}</span>{" "}
                <span className="t-base" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-editorial)" }}>“<bdi>{pickMoment.text}</bdi>”</span>{" "}
                <span className="t-sm" style={{ color: "var(--arbor-muted)", fontFamily: "var(--font-sans)" }}>{t("elev.learnCare.pick.moment.tail")}</span>
              </p>
            ) : todaysRead && <p data-testid="academy-pick-why" dir="auto" className="text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{pickWhy}</p>}
            {pickMinutes != null && (
              <p data-testid="academy-pick-minutes" className="inline-flex flex-wrap items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--arbor-muted)" }}>
                <Icon name="menu_book" size={14} />
                {todaysRead
                  ? <span>{pickMinutes} {t("elev.learnCare.pick.stat.minutes")}</span>
                  : <span>{t("academy.lessons", { n: nextCourse!.sections.length })} · {pickMinutes} {t("master.min")}</span>}
              </p>
            )}
            <div className="flex flex-wrap items-start gap-2 pt-1">
              <button data-testid="academy-hero-cta" onClick={() => todaysRead ? openRead(todaysRead.card.id, "learn-hub-todays-pick") : setOpenId(nextCourse!.id)} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold" style={{ background: "var(--gradient-cta)", color: "var(--arbor-on-accent)" }}><Icon name="menu_book" size={16} />{t(todaysRead ? "elev.learnCare.pick.cta" : "elev.hero.academy.cta")}</button>
              {pickTry && <TryTodayButton recommendation={pickTry} testId="academy-pick-try-today" />}
            </div>
            <TrustLink surface="foryou-pick" />
          </div>
          {pickLessons.length > 0 && (
            <div className="min-w-0 border-t pt-4 lg:border-s lg:border-t-0 lg:ps-8 lg:pt-0" style={{ borderColor: "var(--arbor-rule)" }}>
              <p className="mb-2 text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t(todaysRead ? "elev.learnCare.pick.inThisRead" : "elev.learnCare.pick.lessons")}</p>
              <ol data-testid="academy-pick-lessons" className="list-decimal space-y-1.5 ps-5 t-sm leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>
                {pickLessons.map((line, i) => <li key={i}>{line}</li>)}
              </ol>
            </div>
          )}
        </section>}
      </header>
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto w-full min-w-0 max-w-[1180px] space-y-10">
      {/* LC-05 / RUN-11 — the two kid-register doors that stood here ("Story
          journeys" → #/journey, "Comic library" → #/comics) are DELETED. This
          is the parent-learning hub: a comic shelf and a hero-story catalogue
          are the child's register (law 2). Both destinations remain reachable
          from the Stories hub, which is their home (law 6). */}

      {/* v3 F-FORYOU-1: the side rail is gone (Academy For You, Scholar Hub,
          the charter strip and the phone disclosure that held them). Its
          signals rank the pick and the catalogue above; nothing that is not a
          read or a course stands between the pick and the library. */}

      {/* v3 EXTRA-FORYOU → F-FORYOU-1: short reads for the parent's question.
          Three-minute Learn reads, each opening in a sheet over this page. A
          sibling module (the route's budget is 3; this and the catalogue are
          two). Stacked on a phone; three columns from sm up. Area and minutes
          only (plus a "Your question" mark on a matched read in a mixed row);
          the hook in the family's editorial voice. */}
      {shortReadRow.show && (
        <section data-module="academy-short-reads" data-testid="academy-short-reads" aria-labelledby="academy-short-reads-title" className="min-w-0 space-y-4">
          <div className="px-1">
            <p className="text-sm font-semibold" style={{ color: "var(--arbor-muted)" }}>
              {t(shortReadRow.forTopic ? "elev.learnCare.shortReads.title" : "elev.learnCare.shortReads.titleAll")}
            </p>
            <h2 id="academy-short-reads-title" className="text-xl leading-tight sm:text-2xl" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>{t("elev.learnCare.reads.title")}</h2>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-3">
            {shortReadRow.reads.map((c) => {
              const area = readArea(c.category);
              return (
                <button
                  key={c.id}
                  type="button"
                  data-testid="academy-short-read"
                  onClick={() => openRead(c.id, "learn-hub-short-read")}
                  className={`${cardCls} flex min-h-11 min-w-0 flex-col gap-2.5 p-4 text-start transition motion-safe:hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 sm:p-5`}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span data-testid="academy-short-read-area" data-area={area} className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: DOMAIN_VARS[area].soft, color: DOMAIN_VARS[area].ink }}>
                      <Icon name={DOMAIN_ICONS[area]} size={14} /><span>{domainName(area, t)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--arbor-muted)" }}>
                      <Icon name="schedule" size={13} />{t("learn.minutes", { n: c.minutes })}
                    </span>
                    {shortReadRow.markMatched && shortReadRow.matched.has(c.id) && (
                      <span data-testid="academy-short-read-matched" className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: PASTEL.lav.ink }}>
                        <Icon name="auto_awesome" size={13} />{t("elev.learnCare.shortReads.matched")}
                      </span>
                    )}
                  </span>
                  <span className="text-base font-bold leading-snug" dir="auto" style={{ color: "var(--arbor-ink)" }}>{he ? c.title.he : c.title.en}</span>
                  <span className="arbor-type-say arbor-accent-rule line-clamp-3 block" dir="auto" style={{ fontSize: "var(--t-md)", color: "var(--arbor-ink-soft)" }}>{he ? c.hook.he : c.hook.en}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* v3 F-FORYOU-1: the library — courses by area, in one grid (two
          columns from sm, three at xl; compact rows on a phone), the readiness
          courses beside the parent courses, then the door to the family's
          rituals. */}
      <section data-module="academy-catalogue" data-testid="academy-courses" aria-labelledby="academy-library-title" className="min-w-0 scroll-mt-24 space-y-4">
        <div className="px-1">
          <p className="text-sm font-semibold" style={{ color: "var(--arbor-muted)" }}>{t("elev.learnCare.library.kicker")}</p>
          <h2 id="academy-library-title" className="text-xl leading-tight sm:text-2xl" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>{t("elev.learnCare.library.title")}</h2>
        </div>
        {/* v3 EXTRA-FORYOU: courses by area. One chip per registry domain
            that holds a visible course (its DOMAIN_ICONS glyph and registry
            name), with the plain number of courses in it from sm up (a
            catalogue count, never progress). The chips filter the grid below;
            "All" clears the filter. One scrolling row on a phone. */}
        {areaCounts.length > 1 && (
          <div className="min-w-0">
            <p id="academy-by-area-label" className="sr-only">{t("elev.learnCare.byArea")}</p>
            <div role="group" aria-labelledby="academy-by-area-label" data-testid="academy-by-area" className="flex min-w-0 flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap">
              <button type="button" aria-pressed={selectedArea === null} onClick={() => setActiveArea(null)} className={AREA_CHIP} style={areaChipStyle(selectedArea === null)}>
                {t("elev.learnCare.byArea.all")}
              </button>
              {areaCounts.map(({ area, count }) => (
                <button
                  key={area}
                  type="button"
                  data-area={area}
                  aria-pressed={selectedArea === area}
                  onClick={() => setActiveArea(selectedArea === area ? null : area)}
                  className={AREA_CHIP}
                  style={areaChipStyle(selectedArea === area)}
                >
                  <Icon name={DOMAIN_ICONS[area]} size={15} />
                  <span>{domainName(area, t)}</span>
                  <span className="hidden sm:inline"><span className="tabular-nums" style={{ opacity: 0.75 }}>{count}</span></span>
                </button>
              ))}
            </div>
          </div>
        )}
        {/* W0.7 → v3 F-FORYOU-1: "Show all ages", a quiet text switch under
            the chips, rendered only when the child's-age view actually hides
            something (or the parent already opted in). */}
        {ageSwitchShown && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 px-1">
            {!showAllAges && hiddenByAge > 0 && (
              <span className="text-xs" style={{ color: "var(--arbor-muted)" }} dir="auto">
                {agefilterText("elev.agefilter.hiddenCount", he, { n: hiddenByAge })}
              </span>
            )}
            <button
              type="button"
              role="switch"
              aria-checked={showAllAges}
              onClick={toggleShowAllAges}
              data-testid="agefilter-toggle-masterclasses"
              className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-bold underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2"
              style={{ color: "var(--arbor-green-ink)" }}
            >
              <Icon name={showAllAges ? "check" : "unfold_more"} size={14} />
              {agefilterText("elev.agefilter.showAll", he)}
            </button>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {catalog.map((c) => {
            // v3 EXTRA-FORYOU: the area chips filter the grid (null = every area).
            if (selectedArea && courseArea(c.id) !== selectedArea) return null;
            const isCardDone = !!done[c.id];
            // W0.7: out-of-band courses (reachable via "Show all ages") carry a
            // small age chip so the parent knows why they were tucked away.
            const outOfBand = ageFits.get(c) === "out";
            // Lesson count = number of authored sections (an honest catalog
            // fact, never a fabricated granular %). Pairs with duration in the
            // meta line ("N lessons · M min").
            const lessons = c.sections.length;
            return (
              <button key={c.id} type="button" onClick={() => setOpenId(c.id)} className={COURSE_CARD}>
                <AreaBlob area={courseArea(c.id)} />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {/* W0.7 age chip — a catalog fact ("Ages 4–8"), never a verdict. */}
                  {outOfBand && c.ageMinYears != null && (
                    <span className="self-start rounded-full px-2 py-0.5 text-xs font-bold" dir="auto" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
                      {c.ageMaxYears != null
                        ? agefilterText("elev.agefilter.chip", he, { min: c.ageMinYears, max: c.ageMaxYears })
                        : agefilterText("elev.agefilter.chipPlus", he, { min: c.ageMinYears })}
                    </span>
                  )}
                  <h3 className="text-[17px] font-bold leading-snug" dir="auto" style={{ color: "var(--arbor-ink)" }}>
                    {he ? c.titleHe : c.title}
                  </h3>
                  {/* meta line — "N lessons · M min" (honest catalog facts) */}
                  <span className="inline-flex flex-wrap items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--arbor-muted)" }}>
                    <span className="inline-flex items-center gap-1"><Icon name="menu_book" size={13} /> {t("academy.lessons", { n: lessons })}</span>
                    <span aria-hidden="true" style={{ opacity: 0.6 }}>·</span>
                    <span className="inline-flex items-center gap-1"><Icon name="schedule" size={13} /> {c.durationMin} {t("master.min")}</span>
                  </span>
                  <span className="hidden text-sm leading-relaxed sm:block" dir="auto" style={{ color: "var(--arbor-muted)" }}>
                    {he ? c.hookHe : c.hook}
                  </span>
                  {/* Binary status from the existing done localStorage state:
                      "Done" or "Read". There is NO granular course model and no
                      bar, so nothing here is ever a share or a count. */}
                  <span
                    className="mt-1 hidden items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-[12px] font-extrabold sm:inline-flex"
                    style={
                      isCardDone
                        ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }
                        : { background: "var(--arbor-paper-deep)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule)" }
                    }
                  >
                    {isCardDone
                      ? <><Icon name="check" size={15} fill={1} /> {t("master.done")}</>
                      : <>{t("master.read")}<Icon name="arrow_forward" size={14} className="rtl:-scale-x-100" /></>}
                  </span>
                </span>
              </button>
            );
          })}
          {readiness.map((r) => {
            // v3 F-FORYOU-1 (critic [29]): the readiness courses, read here.
            if (selectedArea && courseArea(r.id) !== selectedArea) return null;
            const shown = localizeCourse(r, he ? "he" : "en");
            const years = readinessYears(r);
            const outOfBand = readinessFits.get(r) === "out";
            return (
              <button key={r.id} type="button" data-testid="academy-readiness-course" onClick={() => setReadinessId(r.id)} className={COURSE_CARD}>
                <AreaBlob area={courseArea(r.id)} />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {outOfBand && years && (
                    <span className="self-start rounded-full px-2 py-0.5 text-xs font-bold" dir="auto" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
                      {agefilterText("elev.agefilter.chip", he, { min: years.min, max: years.max - 1 })}
                    </span>
                  )}
                  <h3 className="text-[17px] font-bold leading-snug" dir="auto" style={{ color: "var(--arbor-ink)" }}>
                    {shown.title}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--arbor-muted)" }}>
                    <Icon name="toys" size={13} /> {t("elev.learnCare.readiness.activities", { n: r.activityIds.length })}
                  </span>
                  <span className="hidden text-sm leading-relaxed sm:block" dir="auto" style={{ color: "var(--arbor-muted)" }}>
                    {shown.whatItBuilds}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* B-PLAY-18: the catalogue completion bar ("{done} of {total}") was
            removed — a progress meter on parent reading is scorekeeping. */}

        {/* v3 F-FORYOU-1: family rituals as a door inside the library (not a
            module of its own: the route's budget is 3). The family area's own
            picture; one tap opens #/family, where the parent chooses the ritual. */}
        <button
          type="button"
          data-testid="academy-family-door"
          onClick={() => setActiveTab("family")}
          className={`${cardCls} flex w-full min-h-11 items-center gap-3 p-3 text-start transition motion-safe:hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 sm:gap-4 sm:p-4`}
        >
          <img src={DOMAIN_ART.family.src} srcSet={DOMAIN_ART.family.srcSet} width={DOMAIN_ART.family.width} height={DOMAIN_ART.family.height} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl object-cover sm:h-[72px] sm:w-[72px]" />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="hidden text-xs font-semibold sm:block" style={{ color: "var(--arbor-muted)" }}>{t("elev.learnCare.family.title")}</span>
            <span className="text-[17px] font-bold leading-snug" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>{t("elev.learnCare.family.headline")}</span>
            <span className="hidden text-sm leading-relaxed sm:block" style={{ color: "var(--arbor-muted)" }}>{t("elev.learnCare.family.sub")}</span>
            <span className="mt-0.5 inline-flex items-center gap-1 text-[13px] font-bold" style={{ color: "var(--arbor-green-ink)" }}>
              {t("elev.learnCare.family.cta")}
              <Icon name="chevron_right" size={16} className="rtl:-scale-x-100" />
            </span>
          </span>
        </button>
      </section>

      {readId && (
        <Suspense fallback={null}>
          <ForYouReadSheet cardId={readId} onClose={() => setReadId(null)} />
        </Suspense>
      )}
    </motion.div>
    </>
  );
}

/**
 * B-PLAY-17 — the course reader. It carries the Learn reader's actions:
 * "Add to today" (acceptTodayAction(tryTonight, "tiny", "learn-read") — one
 * action-loop row, never twice), "Ask Arbor" (seedCoach prefill, the parent
 * sends) and Listen (SpeakButton over the course body). Done and the private
 * reflection persist through this file's own device keys; a caller that does
 * not pass them gets the same stored state. v3 F-FORYOU-1: Back names where it
 * goes, "For you, the parent", with a glyph that mirrors in Hebrew.
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
        <Icon name="arrow_back" size={16} className="rtl:-scale-x-100" /> {t("companion.door.learn")}
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
