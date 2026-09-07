import React, { useEffect, useState, useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { celebrate } from "../../lib/celebrate";
import { GraduationCap } from "lucide-react";
import { Icon } from "../ui/Icon";
import { HubHero } from "../ui/HubHero";
import { SpineRibbon } from "../ui/SpineRibbon";
import { EvidenceChip } from "../ui/EvidenceChip";
import { cardCls, IconBadge, ProgressBar, PASTEL, type PastelKey } from "../ui/kit";
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
import type { DevelopmentMetricId } from "../../types";
// AP-055: Scholar Hub weekly concept feed
import ScholarHubCard from "./ScholarHubCard";
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

const DONE_KEY = "arbor.masterclasses.done";
const loadDone = (): Record<string, boolean> => {
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
  const { t, aiLang } = useLanguage();
  const { childProfile, setActiveTab, behaviorLogs, savedLearnIds, requestLearnRead } = useArbor();
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
  if (open) return <Reader m={open} he={he} isDone={!!done[open.id]} onDone={() => markDone(open.id)} onBack={() => setOpenId(null)} frameLabel={frameLabel(open.frame)} tone={FRAME_TONE[open.frame]} reflection={reflection[open.id] || ""} onReflect={(val) => saveReflection(open.id, val)} />;

  // ── Catalog ──────────────────────────────────────────────────────────────
  const doneCount = Object.values(done).filter(Boolean).length;
  const total = MASTERCLASSES.length;
  const allDone = doneCount >= total;
  const childName = (childProfile.name || "").split(" ")[0] || (he ? "ילדכם" : "your child");

  // E2 hero — the next unfinished course drives the ONE CTA and the
  // minutes-to-next count. CLINICAL FIREWALL: the stat trio is counts and a
  // plain duration fact only (total courses / completed / minutes to next).
  // There is no per-course "started" state in the app — we render the honest
  // catalog count instead of fabricating one.
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
  };
  const todaysRead = todaysLearnPick(LEARN_CARDS, learnSignals, {
    childId: childProfile.id,
    dayKey: pickDayKey(new Date()),
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
  const pickWhy = !todaysRead
    ? ""
    : todaysRead.fromSaved
      ? t("elev.learnCare.pick.why.saved")
      : todaysRead.fromConcerns
        ? t("elev.learnCare.pick.why.logs")
        : todaysRead.fromFocus && devMapHasSignal(devScore)
          ? t("elev.learnCare.pick.why.focus", { name: childName })
          : t("elev.learnCare.pick.why.age", { name: childName });

  const heroStats = [
    { value: total, label: t("elev.hero.academy.stat.courses") },
    { value: doneCount, label: t("elev.hero.academy.stat.completed") },
    ...(todaysRead
      ? [{ value: todaysRead.card.minutes, label: t("elev.learnCare.pick.stat.minutes") }]
      : nextCourse
        ? [{ value: nextCourse.durationMin, label: t("elev.hero.academy.stat.minNext") }]
        : []),
  ];

  // ── The Learning Map rail ───────────────────────────────────────
  // Declared ONCE and placed in exactly one of two mutually exclusive slots:
  // the left column of the desktop shell, or the collapsed disclosure a phone
  // gets below the gallery (R17). One definition, so the two layouts cannot
  // drift into two different rails.
  const railStack = (
    <>
      <p className="text-[11px] uppercase tracking-widest font-bold px-1" style={{ color: "var(--arbor-green-ink)" }}>
        {t("academy.learnMap.title")}
        <span className="block normal-case tracking-normal text-[12px] font-medium mt-1" style={{ color: "var(--arbor-muted)" }} dir="auto">
          {t("academy.learnMap.sub", { name: childName })}
        </span>
      </p>

      {/* AP-053: Academy "For You" — copilot focus recommendation + per-domain
          Learning Map roll-up (ring + count bars). Pure frontend join; no new
          AI call; no new Firestore read. Least-explored framing (board-cleared). */}
      <AcademyForYou />

      {/* AP-055: Scholar Hub — one developmental concept per week, auto-matched
          to the child's least-explored domain. Non-diagnostic, editorial. */}
      <ScholarHubCard />

      {/* Recommended-by-Family-Charter strip — relocated into the rail. */}
      {recommended.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.25)" }}>
          <p className="text-[11px] uppercase tracking-widest font-bold mb-2.5" style={{ color: "var(--arbor-green-ink)" }}>
            {t("master.rec")}
          </p>
          <div className="flex flex-wrap gap-2">
            {recommended.map((c) => (
              <button
                key={c.id}
                onClick={() => setOpenId(c.id)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold transition motion-safe:hover:-translate-y-0.5"
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

      {/* Catalog-wide progress — relocated beneath the Learning Map. Gentle
          continuity, never gamified pressure. */}
      {doneCount > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--arbor-paper-deep)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${(doneCount / total) * 100}%`, background: "var(--arbor-green-ink)" }} />
          </div>
          <span className="text-[12px] font-bold whitespace-nowrap" style={{ color: allDone ? "var(--arbor-green-ink)" : "var(--arbor-muted)" }}>
            {allDone ? t("master.progress.all") : t("master.progress.count", { done: doneCount, total })}
          </span>
        </div>
      )}
    </>
  );

  // The spine ribbon travels with the rail: it is the same "what tunes this
  // catalogue" material, and on a phone it was three more modules of it
  // standing between the hero and the first course.
  const spineRibbon = (
      <SpineRibbon
        tone="sky"
        icon="account_tree"
        text={t("elev.spine.academy")}
        onFollow={() => setActiveTab("development")}
        testId="academy-spine-ribbon"
      />
  );

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
      <div data-primary-move="open-todays-pick" className="mx-auto w-full min-w-0 max-w-[1180px]">
        <HubHero
          zeroLine={t("elev.growthTruth.hero.empty")}
          tone="sky"
          icon={GraduationCap}
          eyebrow={t("elev.hero.academy.eyebrow")}
          title={t("elev.hero.academy.title", { name: childName })}
          subtitle={t("elev.hero.academy.sub")}
          cta={todaysRead ? {
            label: t("elev.learnCare.pick.cta"),
            onClick: () => requestLearnRead({ cardId: todaysRead.card.id, source: "learn-hub-todays-pick" }),
            icon: <Icon name="menu_book" size={16} />,
            testId: "academy-hero-cta",
          } : nextCourse ? {
            label: t("elev.hero.academy.cta"),
            onClick: () => setOpenId(nextCourse.id),
            icon: <Icon name="school" size={16} />,
            testId: "academy-hero-cta",
          } : undefined}
          stats={heroStats}
          testId="academy-hub-hero"
        />
        {/* Meta row — pulled up under the hero (hero carries its own mb-6). */}
        <div className="-mt-3 mb-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
          <EvidenceChip />
          {/* LC-04: the honest why-line for today's read — the same claim
              discipline as the Learn Library rail (only signals that scored). */}
          {todaysRead && (
            <p
              data-testid="academy-pick-why"
              dir="auto"
              className="text-[11.5px] font-semibold leading-relaxed"
              style={{ color: "var(--arbor-muted)" }}
            >
              <span className="font-extrabold" style={{ color: "var(--arbor-green-ink)" }}>
                {t("elev.learnCare.pick.eyebrow")}
              </span>
              {" · "}
              {he ? todaysRead.card.title.he : todaysRead.card.title.en}
              {" — "}
              {pickWhy}
            </p>
          )}
        </div>
      </div>
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto w-full min-w-0 max-w-[1180px] space-y-6">
      {/* LC-05 / RUN-11 — the two kid-register doors that stood here ("Story
          journeys" → #/journey, "Comic library" → #/comics) are DELETED. This
          is the parent-learning hub: a comic shelf and a hero-story catalogue
          are the child's register (law 2), and they pushed the first actual
          course to 3,300 px behind three modules that were not courses. Both
          destinations remain reachable from the Stories hub, which is their
          home — no capability is lost (law 6). The surviving third tile said
          only "continue to lessons", which is what the page already does. */}

      <header className="border-b px-1 pb-4" style={{ borderColor: "var(--arbor-rule)" }}>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--arbor-green-ink)" }}>{t("sec.master.eyebrow")}</p>
        <h1 className="mt-1 text-2xl leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("sec.master.title")}</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("sec.master.sub")}</p>
      </header>

      {/* R17 — a phone meets a COURSE right after the hero and the pick line.
          MEASURED at 390 (round 2b): the first course card sat at 1,675 px, because
          the single-column collapse stacked the whole Learning Map rail — spine
          ribbon, For You, Scholar Hub, the charter strip, the catalogue progress
          bar — between the hero and the catalogue. Five modules that are not
          courses, on the surface whose ONE job is courses. Nothing is removed
          (law 6): below `md` the rail becomes one collapsed disclosure BELOW the
          gallery, and from `md` up it is the left column exactly as designed. */}
      {!phone && <div data-module="academy-spine" style={{ display: "contents" }}>{spineRibbon}</div>}

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
            <h2 className="text-[15px] font-extrabold uppercase tracking-widest" style={{ color: "var(--arbor-muted)" }}>
              {t("academy.courses.title")}
            </h2>
            {/* W0.7 — "Show all ages" toggle: only rendered when the child's-age
                view actually hides something (or the parent already opted in). */}
            {(ageHidden.length > 0 || showAllAges) && (
              <span className="ms-auto inline-flex items-center gap-2">
                {!showAllAges && ageHidden.length > 0 && (
                  <span className="text-[11px] font-bold" style={{ color: "var(--arbor-faint)" }} dir="auto">
                    {agefilterText("elev.agefilter.hiddenCount", he, { n: ageHidden.length })}
                  </span>
                )}
                <button
                  type="button"
                  role="switch"
                  aria-checked={showAllAges}
                  onClick={toggleShowAllAges}
                  data-testid="agefilter-toggle-masterclasses"
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-extrabold transition"
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
          <div className="grid sm:grid-cols-2 gap-4">
            {catalog.map((c) => {
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
                  {/* Gradient header band — pulled from FRAME_TONE → PASTEL (soft→
                      elevated). No raw hex; Material Symbols "school" centred. */}
                  <div
                    className="relative flex items-center justify-center"
                    style={{
                      height: 74,
                      background: `linear-gradient(135deg, ${p.soft}, var(--arbor-paper-elevated))`,
                    }}
                  >
                    <span className="inline-flex items-center justify-center rounded-2xl" style={{ background: p.soft, color: p.ink, width: 44, height: 44 }}>
                      <Icon name="school" size={24} fill={1} />
                    </span>
                  </div>

                  {/* Body */}
                  <div className="flex flex-col gap-2 p-5 flex-1">
                    {/* domain/frame pill at the top of the body */}
                    <span className="self-start inline-flex items-center gap-1.5">
                      <span className="text-[10.5px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: p.soft, color: p.ink }}>
                        {frameLabel(c.frame)}
                      </span>
                      {/* W0.7 age chip — a catalog fact ("Ages 4–8"), never a verdict. */}
                      {outOfBand && c.ageMinYears != null && (
                        <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full" dir="auto" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
                          {c.ageMaxYears != null
                            ? agefilterText("elev.agefilter.chip", he, { min: c.ageMinYears, max: c.ageMaxYears })
                            : agefilterText("elev.agefilter.chipPlus", he, { min: c.ageMinYears })}
                        </span>
                      )}
                    </span>
                    <h3 className="text-[15px] font-extrabold leading-snug" dir="auto" style={{ color: "var(--arbor-ink)" }}>
                      {he ? c.titleHe : c.title}
                    </h3>
                    {/* meta line — "N lessons · M min" (honest catalog facts) */}
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold flex-wrap" style={{ color: "var(--arbor-muted)" }}>
                      <span className="inline-flex items-center gap-1"><Icon name="menu_book" size={13} /> {t("academy.lessons", { n: lessons })}</span>
                      <span aria-hidden="true" style={{ opacity: 0.6 }}>·</span>
                      <span className="inline-flex items-center gap-1"><Icon name="schedule" size={13} /> {c.durationMin} {t("master.min")}</span>
                    </span>
                    <p className="text-[12.5px] leading-relaxed line-clamp-2" dir="auto" style={{ color: "var(--arbor-muted)" }}>
                      {he ? c.hookHe : c.hook}
                    </p>

                    {/* Per-card progress — binary 0/100 from the existing done
                        localStorage state. The app has NO granular course % model,
                        so the bar is strictly empty or full (1-of-1 done count),
                        never a fabricated continuous percentage. */}
                    <div className="mt-auto pt-3 space-y-3">
                      <ProgressBar value={isCardDone ? 1 : 0} total={1} tone="mint" height={6} />
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
                          : <>{t("master.read")} →</>}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
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
            dir="auto"
          >
            <Icon name="unfold_more" size={18} />
            {t("academy.rail.more")}
          </summary>
          <div className="space-y-5 pb-3 pt-4">
            {spineRibbon}
            {railStack}
          </div>
        </details>
      )}
    </motion.div>
    </>
  );
}

function Reader({ m, he, isDone, onDone, onBack, frameLabel, tone, reflection, onReflect }: {
  m: Masterclass; he: boolean; isDone: boolean; onDone: () => void; onBack: () => void; frameLabel: string; tone: PastelKey; reflection: string; onReflect: (v: string) => void;
}) {
  const { t } = useLanguage();
  // Wave-8: a single subtle brand-colored burst on completing a lesson
  // (capped + reduced-motion-safe via lib/celebrate — Law 7).
  const onComplete = () => {
    celebrate({ kind: "lesson" });
    onDone();
  };
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5 max-w-[760px]">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: "var(--arbor-muted)" }}>
        <Icon name="arrow_back" size={16} /> {t("master.all")}
      </button>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <IconBadge tone={tone}><Icon name="school" size={20} /></IconBadge>
          <span className="text-[10.5px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>{frameLabel}</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}><Icon name="schedule" size={13} /> {m.durationMin} {t("master.min")}</span>
        </div>
        <h1 className="text-2xl md:text-[1.9rem] leading-tight tracking-tight" dir="auto" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
          {he ? m.titleHe : m.title}
        </h1>
        <p className="text-[15px] leading-relaxed mt-2" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>
          {he ? m.hookHe : m.hook}
        </p>
      </div>

      <div className="space-y-5">
        {m.sections.map((s, i) => (
          <section key={i}>
            <h2 className="text-[15px] font-extrabold mb-1" dir="auto" style={{ color: "var(--arbor-ink)" }}>{he ? s.headingHe : s.heading}</h2>
            <p className="text-[14px] leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>{he ? s.bodyHe : s.body}</p>
          </section>
        ))}
      </div>

      {/* What to say — the verbatim parent script */}
      <div className="rounded-2xl p-4" style={{ background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.25)" }}>
        <p className="text-[11px] uppercase tracking-widest font-bold mb-1.5 inline-flex items-center gap-1.5" style={{ color: "var(--arbor-green-ink)" }}>
          <Icon name="format_quote" size={15} fill={1} /> {t("master.whatToSay")}
        </p>
        <p className="text-[15px] leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-editorial)", fontStyle: "italic" }}>{he ? m.parentScriptHe : m.parentScript}</p>
      </div>

      {/* Try tonight */}
      <div className="rounded-2xl p-4" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
        <p className="text-[11px] uppercase tracking-widest font-bold mb-1.5 inline-flex items-center gap-1.5" style={{ color: "var(--arbor-muted)" }}>
          <Icon name="bedtime" size={15} fill={1} /> {t("master.tryTonight")}
        </p>
        <p className="text-[14px] leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink)" }}>{he ? m.tryTonightHe : m.tryTonight}</p>
      </div>

      {/* Wave-8: private parent reflection — client-only localStorage, never sent or stored server-side. */}
      <div className="rounded-2xl p-4" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}>
        <p className="text-[11px] uppercase tracking-widest font-bold mb-1.5 inline-flex items-center gap-1.5" style={{ color: "var(--arbor-muted)" }}>
          <Icon name="edit_note" size={16} fill={1} /> {t("master.reflect.label")}
        </p>
        <textarea
          value={reflection}
          onChange={(e) => onReflect(e.target.value)}
          placeholder={t("master.reflect.placeholder")}
          dir="auto"
          rows={2}
          className="w-full text-[14px] leading-relaxed rounded-lg px-3 py-2 resize-y min-h-[64px] focus:outline-none focus:ring-2"
          style={{ color: "var(--arbor-ink)", background: "var(--arbor-paper-sunk)", border: "1px solid var(--arbor-rule)" }}
        />
        <p className="text-[11px] mt-1.5" style={{ color: "var(--arbor-faint)" }}>{t("master.reflect.hint")}</p>
      </div>

      {isDone ? (
        <div className="text-center text-sm font-bold inline-flex items-center justify-center gap-2 w-full" style={{ color: "var(--arbor-green-ink)" }}>
          <Icon name="check" size={17} fill={1} /> {t("master.markedComplete")}
        </div>
      ) : (
        <button onClick={onComplete} className="w-full py-3 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98]" style={{ background: "var(--gradient-cta)" }}>
          <Icon name="check" size={17} fill={1} /> {t("master.markComplete")}
        </button>
      )}
    </motion.div>
  );
}
