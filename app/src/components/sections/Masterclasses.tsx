import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { celebrate } from "../../lib/celebrate";
import { Icon } from "../ui/Icon";
import { FreeText } from "../ui/FreeText";
import { SpeakButton } from "../ui/SpeakButton";
import { EvidenceChip } from "../ui/EvidenceChip";
import { cardCls, IconBadge, PASTEL, type PastelKey } from "../ui/kit";
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
import { LEARN_CATEGORIES, rankLearnCards, type LearnRankSignals } from "../../learn/learnLibrary";
import { pickShortReads } from "../../learn/shortReads";
import { ageVisibleLearnCards, devMapHasSignal, pickDayKey, todaysLearnPick } from "../../learn/todaysPick";
// v3 EXTRA-FORYOU: courses and reads by area (the ONE domain registry: names,
// glyphs, order) and the family-ritual door's picture.
import { courseArea, courseAreaCounts, readArea } from "../../learn/courseAreas";
import { domainName, type DomainId } from "../../lib/domains/registry";
import { DOMAIN_ICONS } from "../../lib/domains/icons";
import { TOGETHER_ART } from "../../lib/parentArt";
import type { DevelopmentMetricId } from "../../types";
// AP-055: Scholar Hub weekly concept feed
import ScholarHubCard from "./ScholarHubCard";
import { TrustLink } from "../trust/TrustLink";
// AP-053: Academy "For You" — copilot focus + Learning Map join
import AcademyForYou from "./AcademyForYou";

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

/** v3 EXTRA-FORYOU: a private-use mark the topic why-line is split on, so the
 *  parent's question renders through FreeText (bidi-isolated) between the
 *  translated lead and tail. It is never displayed. */
const TOPIC_SLOT = "\uE000";

/** v3 EXTRA-FORYOU: a "Courses by area" chip, in the Learn filter pill's shape and tokens. */
const AREA_CHIP = "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold transition focus:outline-none focus-visible:ring-2";
const areaChipStyle = (on: boolean): React.CSSProperties => on
  ? { background: "var(--arbor-subtab-active)", color: "var(--arbor-subtab-on-ink)" }
  : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink-soft)", border: "1px solid var(--arbor-rule)" };

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
 * desktop two-column layout that shipped — so a missing matchMedia degrades to
 * the old behaviour rather than to nothing.
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

/** Arbor Academy › Parent Masterclasses — short, frame-routed lessons that build
 *  the parent's own competence (the calm, competent adult). Text-first, bilingual. */
export default function Masterclasses() {
  const { t, aiLang, uiLang } = useLanguage();
  const { childProfile, behaviorLogs, savedLearnIds, requestLearnRead, setActiveTab, activeFamilyTopic } = useArbor();
  const he = aiLang === "he";
  const [openId, setOpenId] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [reflection, setReflection] = useState<Record<string, string>>({});
  // LC-04: the same shared dev-score derivation the Learn Library ranks on.
  const devScore = useDevScore();
  // R17: where the Learning Map rail renders — left column, or the disclosure.
  const phone = usePhoneLayout();

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
  const frameLabel = (f: FrameId) => (he ? FRAME_LABELS[f].he : FRAME_LABELS[f].en);

  // D3: recommend the masterclasses that build the family's chosen virtues.
  // W0.7: the strip draws from the age-visible catalog, so a course written
  // for ages 4–8 is never "recommended" to a baby's parent by default.
  const aims = aimVirtues(loadCharter());
  const recommended = aims.length
    ? catalog.filter((m) => (MASTERCLASS_VIRTUES[m.id] || []).some((v) => aims.includes(v)))
    : [];

  // ── Reader ───────────────────────────────────────────────────────────────
  if (open) return <MasterclassReader m={open} isDone={!!done[open.id]} onDone={() => markDone(open.id)} onBack={() => setOpenId(null)} reflection={reflection[open.id] || ""} onReflect={(val) => saveReflection(open.id, val)} />;

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
  // real, explainable ranking already existed one pill away in the Learn
  // Library (age band, Development-Map focus domain, the concerns the parent
  // actually logged, their own helpful/not-helpful pulse, saved topics). Same
  // signals, same scorer — now mounted on the hub, with a per-day seed
  // (childId + UTC day) so the pick is stable today and rotates tomorrow.
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
  // that today's winner shares it, so "the area you have been exploring" was
  // false whenever the winning card's domains did not include it. Do not
  // reintroduce a raw signal here; if a new why-line is needed, add its
  // re-derived flag to `todaysLearnPick` (learn/todaysPick.ts).
  // R2 (ENG-07 applied to the hero): `fromFocus` proves the focus domain moved
  // THIS card — it does not prove the parent has explored anything. focusDomain
  // is the lowest-scoring domain with room to grow, and "room to grow" is
  // measured against the catalogue, so a day-0 profile (0 noticed milestones,
  // 0 logs in window) still has one, and the hero said "the area you have been
  // exploring" to a parent who had explored nothing. `devMapHasSignal` is the
  // same gate LearnLibrary's rail already carries: at least one milestone
  // actually noticed, or the claim falls to the age-only variant.
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
  // The title says "for your question" only when the first read meets it; in a
  // mixed row each read that meets it carries its own mark. Minutes on each
  // card, never a count of reads done.
  const readShelf = rankLearnCards(ageVisibleLearnCards(LEARN_CARDS, learnSignals.ageYears), learnSignals)
    .filter((c) => c.id !== todaysRead?.card.id);
  const shortReadRow = pickShortReads(readShelf, activeFamilyTopic?.title);

  // v3 EXTRA-FORYOU: courses by area. Catalogue counts of the courses the
  // parent can see (plain integers, never progress). A filter left on an area
  // the age switch has since emptied falls back to every area.
  const areaCounts = courseAreaCounts(catalog);
  const selectedArea = activeArea && areaCounts.some((a) => a.area === activeArea) ? activeArea : null;

  // ── The Learning Map rail ───────────────────────────────────────
  // Declared ONCE and placed in exactly one of two mutually exclusive slots:
  // the left column of the desktop shell, or the collapsed disclosure a phone
  // gets below the gallery (R17). One definition, so the two layouts cannot
  // drift into two different rails.
  const railStack = (
    <>
      {/* W2-SHELLPLAY critic r1: with no noticed milestone, For You and Scholar
          Hub both rendered the same empty state ("Check off a few milestones"),
          which also contradicted the pick's "from what you noted". One muted
          line with a 44 px door to Growth stands in for both until the map has
          a signal; then the two cards render as before. */}
      {/* W2-SHELLPLAY critic r2 (G0): the rail heading claims a match only
          where one exists — it renders inside the signal branch, and it says
          "Picked for {name}" (the Map itself lives in Growth; no second map
          name in Learn, no "matched to where {name} is growing" over nothing). */}
      {devMapHasSignal(devScore) ? (
        <>
          <p data-testid="academy-rail-title" className="t-lg font-bold px-1" dir="auto" style={{ color: "var(--arbor-green-ink)" }}>
            {t("academy.learnMap.title", { name: childName })}
          </p>
          {/* AP-053: Academy "For You" — the copilot pick. Pure frontend join;
              no new AI call; no new Firestore read. */}
          <AcademyForYou />

          {/* AP-055: Scholar Hub — one developmental concept per week.
              Non-diagnostic, editorial. */}
          <ScholarHubCard />
        </>
      ) : (
        <button
          type="button"
          data-testid="academy-rail-nosignal"
          onClick={() => setActiveTab("milestones")}
          className="inline-flex min-h-11 items-center gap-1.5 px-1 text-start text-[13px] font-semibold"
          style={{ color: "var(--arbor-muted)" }}
          dir="auto"
        >
          {t("elev.growthTruth.learn.rail.noSignal", { name: childName })}
          <Icon name="arrow_forward" size={15} style={uiLang === "he" ? { transform: "scaleX(-1)" } : undefined} />
        </button>
      )}

      {/* Recommended-by-Family-Charter strip — relocated into the rail. */}
      {recommended.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.25)" }}>
          <p className="text-xs uppercase tracking-widest font-bold mb-2.5" style={{ color: "var(--arbor-green-ink)" }}>
            {t("master.rec")}
          </p>
          <div className="flex flex-wrap gap-2">
            {recommended.map((c) => (
              <button
                key={c.id}
                onClick={() => setOpenId(c.id)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold transition motion-safe:hover:-translate-y-0.5"
                dir="auto"
                style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
              >
                {he ? c.titleHe : c.title}
                {done[c.id] && <Icon name="check" size={15} fill={1} style={{ color: "var(--arbor-green-ink)" }} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* B-PLAY-18: the catalogue completion bar ("{done} of {total}") was
          removed — a progress meter on parent reading is scorekeeping. */}
    </>
  );

  // B-PLAY-18: the spine ribbon ("Courses follow what you notice on the
  // Development Map") is removed — the claim is unverified (FU#23): the
  // catalogue order does not read the map.

  return (
    <>
      {/* E2 — Academy hub hero: sits ABOVE the existing page (outside the
          page's motion wrapper — HubHero runs its own reduced-motion-gated
          entrance). E8: EvidenceChip on the hero's meta row. */}
      {/* Item 11 (IA-02): the surface contract reaches the DOM. `data-module`
          marks a top-level sibling module (what moduleBudget counts);
          `data-primary-move` marks the ONE control that performs the move
          surfaceContract.ts declares for this route — here the hero's pick CTA,
          passed to HubHero as a prop, so the stamp rides its wrapper. */}
      <header data-primary-move="open-todays-pick" data-testid="academy-hub-hero" className="mx-auto mb-6 w-full min-w-0 max-w-[1180px]">
        {/* v3 EXTRA-FORYOU: the parent's own hub says so: a quiet sentence-case
            kicker, the title, one line on what is here. */}
        <p data-testid="academy-hero-kicker" className="mb-1 text-sm font-semibold" style={{ color: "var(--arbor-muted)" }}>{t("elev.hero.academy.kicker")}</p>
        <h1 className="text-2xl sm:text-3xl leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("elev.hero.academy.title")}</h1>
        <p data-testid="academy-hero-sub" className="mt-1.5 max-w-[60ch] text-[15px] leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>{t("elev.hero.academy.sub")}</p>
        {(todaysRead || nextCourse) && <section className="mt-4 border-y py-4 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: "var(--arbor-rule)" }}>
          <div className="min-w-0 max-w-[65ch] flex-1 basis-[240px]">
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
            ) : todaysRead && <p data-testid="academy-pick-why" dir="auto" className="mt-1 text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{pickWhy}</p>}
            {pickMinutes != null && <p data-testid="academy-pick-minutes" className="mt-1 text-xs" style={{ color: "var(--arbor-muted)" }}>{pickMinutes} {t(todaysRead ? "elev.learnCare.pick.stat.minutes" : "elev.hero.academy.stat.minNext")}</p>}
          </div>
          <button data-testid="academy-hero-cta" onClick={() => todaysRead ? requestLearnRead({ cardId: todaysRead.card.id, source: "learn-hub-todays-pick" }) : setOpenId(nextCourse!.id)} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold" style={{ background: "var(--gradient-cta)", color: "var(--arbor-on-accent)" }}><Icon name="menu_book" size={16} />{t(todaysRead ? "elev.learnCare.pick.cta" : "elev.hero.academy.cta")}</button>
        </section>}
        <div className="mt-3"><EvidenceChip /></div>
      </header>
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto w-full min-w-0 max-w-[1180px] space-y-6">
      {/* LC-05 / RUN-11 — the two kid-register doors that stood here ("Story
          journeys" → #/journey, "Comic library" → #/comics) are DELETED. This
          is the parent-learning hub: a comic shelf and a hero-story catalogue
          are the child's register (law 2), and they pushed the first actual
          course to 3,300 px behind three modules that were not courses. Both
          destinations remain reachable from the Stories hub, which is their
          home — no capability is lost (law 6). The surviving third tile said
          only "continue to lessons", which is what the page already does. */}

      {/* R17 — a phone meets a COURSE right after the hero and the pick line.
          MEASURED at 390 (round 2b): the first course card sat at 1,675 px, because
          the single-column collapse stacked the whole Learning Map rail — spine
          ribbon, For You, Scholar Hub, the charter strip, the catalogue progress
          bar — between the hero and the catalogue. Five modules that are not
          courses, on the surface whose ONE job is courses. Nothing is removed
          (law 6): below `md` the rail becomes one collapsed disclosure BELOW the
          gallery, and from `md` up it is the left column exactly as designed. */}

      {/* v3 EXTRA-FORYOU: short reads for the parent's question. Three-minute
          Learn reads, one tap each into the Learn reader. A sibling module (the
          route's budget is 3; this and the catalogue are two). Below sm the row
          scrolls sideways (one card and a peek), so the courses stay near the
          top on a phone; from sm up, three columns. Area and minutes only (plus
          a "Your question" mark on a matched read in a mixed row). */}
      {shortReadRow.show && (
        <section data-module="academy-short-reads" data-testid="academy-short-reads" aria-labelledby="academy-short-reads-title" className="min-w-0 space-y-3">
          <div className="px-1">
            <h2 id="academy-short-reads-title" className="text-lg font-bold" style={{ color: "var(--arbor-ink)" }}>
              {t(shortReadRow.forTopic ? "elev.learnCare.shortReads.title" : "elev.learnCare.shortReads.titleAll")}
            </h2>
            <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.learnCare.shortReads.sub")}</p>
          </div>
          <div className="flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible">
            {shortReadRow.reads.map((c) => {
              const area = readArea(c.category);
              return (
                <button
                  key={c.id}
                  type="button"
                  data-testid="academy-short-read"
                  onClick={() => requestLearnRead({ cardId: c.id, source: "learn-hub-short-read" })}
                  className={`${cardCls} flex min-h-11 w-[78%] shrink-0 snap-start flex-col gap-2 p-4 text-start transition motion-safe:hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 sm:w-auto`}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span data-testid="academy-short-read-area" data-area={area} className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink-soft)", border: "1px solid var(--arbor-rule)" }}>
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
                  <span className="line-clamp-3 text-sm leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink-soft)", fontFamily: "var(--font-editorial)", borderInlineStart: "2px solid var(--arbor-rule)", paddingInlineStart: 10 }}>{he ? c.hook.he : c.hook.en}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Design's two-column shell: left = the Learning Map rail (the explicit
          development-map spine — courses matched to where the child is growing),
          right = the "All courses" gallery. Collapses to one column below xl, and
          there the gallery comes FIRST — which is what the order-* pair encodes.
          DOM order is gallery-then-rail so a screen reader and a keyboard meet the
          courses first too, not only the eye. */}
      <div data-module="academy-catalogue" className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
        {/* ── All courses gallery — first in the document, right column at xl ─ */}
        <div className="space-y-4 min-w-0 order-1 xl:order-2" data-testid="academy-courses">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
            <h2 className="text-lg font-bold" style={{ color: "var(--arbor-muted)" }}>
              {t("academy.courses.title")}
            </h2>
            {/* W0.7 — "Show all ages" toggle: only rendered when the child's-age
                view actually hides something (or the parent already opted in). */}
            {(ageHidden.length > 0 || showAllAges) && (
              <span className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:ms-auto sm:w-auto">
                {!showAllAges && ageHidden.length > 0 && (
                  <span className="text-xs font-bold" style={{ color: "var(--arbor-faint)" }} dir="auto">
                    {agefilterText("elev.agefilter.hiddenCount", he, { n: ageHidden.length })}
                  </span>
                )}
                <button
                  type="button"
                  role="switch"
                  aria-checked={showAllAges}
                  onClick={toggleShowAllAges}
                  data-testid="agefilter-toggle-masterclasses"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold transition"
                  style={
                    showAllAges
                      ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.25)" }
                      : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }
                  }
                >
                  <Icon name={showAllAges ? "check" : "unfold_more"} size={14} />
                  {agefilterText("elev.agefilter.showAll", he)}
                </button>
              </span>
            )}
          </div>
          {/* v3 EXTRA-FORYOU: courses by area. One chip per registry domain
              that holds a visible course (its DOMAIN_ICONS glyph and registry
              name), with the plain number of courses in it (a catalogue count,
              never progress). The chips filter the grid below; "All" clears the
              filter. One scrolling row below sm. */}
          {areaCounts.length > 1 && (
            <div className="min-w-0 space-y-1.5">
              <p id="academy-by-area-label" className="px-1 text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("elev.learnCare.byArea")}</p>
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
                    <span className="tabular-nums" style={{ opacity: 0.75 }}>{count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            {catalog.map((c) => {
              // v3 EXTRA-FORYOU: the area chips filter the grid (null = every area).
              if (selectedArea && courseArea(c.id) !== selectedArea) return null;
              const p = PASTEL[FRAME_TONE[c.frame]];
              const isCardDone = !!done[c.id];
              // W0.7: out-of-band courses (reachable via "Show all ages") carry a
              // small age chip so the parent knows why they were tucked away.
              const outOfBand = ageFits.get(c) === "out";
              // Lesson count = number of authored sections (an honest catalog
              // fact, never a fabricated granular %). Pairs with duration in the
              // meta line ("N lessons · M min").
              const lessons = c.sections.length;
              return (
                <button
                  key={c.id}
                  onClick={() => setOpenId(c.id)}
                  className={`${cardCls} flex flex-col text-start overflow-hidden transition motion-safe:hover:-translate-y-0.5`}
                >
                  {/* Body */}
                  <div className="flex flex-col gap-2 p-5 flex-1">
                    {/* domain/frame pill at the top of the body */}
                    <span className="self-start inline-flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ background: p.soft, color: p.ink }}>
                        <Icon name="school" size={16} />{frameLabel(c.frame)}
                      </span>
                      {/* W0.7 age chip — a catalog fact ("Ages 4–8"), never a verdict. */}
                      {outOfBand && c.ageMinYears != null && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" dir="auto" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
                          {c.ageMaxYears != null
                            ? agefilterText("elev.agefilter.chip", he, { min: c.ageMinYears, max: c.ageMaxYears })
                            : agefilterText("elev.agefilter.chipPlus", he, { min: c.ageMinYears })}
                        </span>
                      )}
                    </span>
                    <h3 className="text-[17px] font-bold leading-snug" dir="auto" style={{ color: "var(--arbor-ink)" }}>
                      {he ? c.titleHe : c.title}
                    </h3>
                    {/* meta line — "N lessons · M min" (honest catalog facts) */}
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold flex-wrap" style={{ color: "var(--arbor-muted)" }}>
                      <span className="inline-flex items-center gap-1"><Icon name="menu_book" size={13} /> {t("academy.lessons", { n: lessons })}</span>
                      <span aria-hidden="true" style={{ opacity: 0.6 }}>·</span>
                      <span className="inline-flex items-center gap-1"><Icon name="schedule" size={13} /> {c.durationMin} {t("master.min")}</span>
                    </span>
                    <p className="text-sm leading-relaxed" dir="auto" style={{ color: "var(--arbor-muted)" }}>
                      {he ? c.hookHe : c.hook}
                    </p>

                    {/* Per-card progress — binary 0/100 from the existing done
                        localStorage state. The app has NO granular course % model,
                        so the bar is strictly empty or full (1-of-1 done count),
                        never a fabricated continuous percentage. */}
                    <div className="mt-auto pt-3 space-y-3">
                      {/* Footer status chip CTA */}
                      <span
                        className="inline-flex items-center justify-center gap-1.5 w-full rounded-full px-3 py-1.5 text-[12px] font-extrabold"
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
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* v4 (For you, the parent is ONE screen, no tabs): the Learn
              library's shelves as one row of doors inside the catalogue (not a
              module of its own: the route's budget is 3). A shelf opens the
              library on that shelf (requestLearnRead, the Scholar Hub's own
              door), "Open the library" opens it whole, and The Science sits
              at the card's foot, so every width keeps both doors the Library
              pill and the rail used to carry. */}
          <section data-testid="academy-library" aria-labelledby="academy-library-title" className={`${cardCls} flex flex-col gap-3 p-4`}>
            <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
              <div className="min-w-0">
                <h2 id="academy-library-title" className="text-lg font-bold" style={{ color: "var(--arbor-ink)" }}>{t("elev.learnCare.library.title")}</h2>
                <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.learnCare.library.sub")}</p>
              </div>
              <button
                type="button"
                data-testid="academy-library-open"
                onClick={() => requestLearnRead({ source: "foryou-library" })}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-[13px] font-bold"
                style={{ color: "var(--arbor-clay)" }}
              >
                <Icon name="local_library" size={16} />{t("elev.learnCare.library.open")}<Icon name="arrow_forward" size={14} className="rtl:-scale-x-100" />
              </button>
            </div>
            <div role="group" aria-labelledby="academy-library-title" data-testid="academy-library-shelves" className="flex min-w-0 flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap">
              {LEARN_CATEGORIES.map((shelf) => (
                <button
                  key={shelf.id}
                  type="button"
                  data-shelf={shelf.id}
                  onClick={() => requestLearnRead({ category: shelf.id, source: "foryou-library" })}
                  className={AREA_CHIP}
                  style={areaChipStyle(false)}
                >
                  <Icon name={shelf.msIcon} size={15} />
                  <span dir="auto">{he ? shelf.label.he : shelf.label.en}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]" style={{ color: "var(--arbor-faint)" }}>
              <TrustLink surface="foryou-library" />
            </div>
          </section>

          {/* v3 EXTRA-FORYOU: family formation as a door inside the catalogue
              (not a module of its own: the route's budget is 3). One tap opens
              #/family, where the parent chooses the ritual. */}
          <button
            type="button"
            data-testid="academy-family-door"
            onClick={() => setActiveTab("family")}
            className={`${cardCls} flex w-full min-h-11 items-center gap-4 p-3 text-start transition motion-safe:hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2`}
          >
            <img src={TOGETHER_ART.src} srcSet={TOGETHER_ART.srcSet} width={TOGETHER_ART.width} height={TOGETHER_ART.height} alt="" loading="lazy" className="h-auto w-24 shrink-0 rounded-xl object-cover sm:w-[140px]" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-xs font-semibold" style={{ color: "var(--arbor-muted)" }}>{t("elev.learnCare.family.title")}</span>
              <span className="text-[17px] font-bold leading-snug" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>{t("elev.learnCare.family.headline")}</span>
              <span className="text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.learnCare.family.sub")}</span>
              <span className="mt-1 inline-flex items-center gap-1 text-[13px] font-bold" style={{ color: "var(--arbor-green-ink)" }}>
                {t("elev.learnCare.family.cta")}
                <Icon name="arrow_forward" size={14} className="rtl:-scale-x-100" />
              </span>
            </span>
          </button>
        </div>

        {/* ── Learning Map rail — left column at xl; on a phone it moves into
            the disclosure below the gallery, so it is never rendered twice. */}
        {!phone && (
          <div className="space-y-5 order-2 xl:order-1" data-testid="academy-rail">
            {railStack}
          </div>
        )}
      </div>

      {phone && (
        <details data-testid="academy-rail-disclosure" className={`${cardCls} px-4 py-2`}>
          <summary
            className="flex items-center gap-2 text-[13px] font-extrabold cursor-pointer"
            style={{ color: "var(--arbor-green-ink)", minHeight: 44 }}
          >
            <Icon name="unfold_more" size={18} />
            {t("academy.rail.more")}
          </summary>
          <div className="space-y-5 pb-3 pt-4">
            {railStack}
          </div>
        </details>
      )}
    </motion.div>
    </>
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
