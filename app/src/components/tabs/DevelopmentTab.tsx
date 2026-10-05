import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Sprout } from "lucide-react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { useArbor } from "../../context/ArborContext";
import { HubHero } from "../ui/HubHero";
import { EvidenceChip } from "../ui/EvidenceChip";
import { countSince, WEEK_MS } from "../../lib/pulse";
import { useChildCollection } from "../../hooks/useChildCollection";
import { latestRecheckDueAt } from "../../lib/screeningRecheck";
import { ageWindowMilestones, comparisonAgeMonths, milestoneText, selectWeeklyFocus } from "../../lib/milestoneData";
import { ageMonthsFromProfile } from "../../lib/childAge";
import DevScoreCard from "../sections/DevScoreCard";
import PhysicalGrowthCard from "../sections/PhysicalGrowthCard";
import ScreeningSheet from "../sections/ScreeningSheet";
// B-GROWTH-01 — "areas of N" counted in ONE vocabulary: the milestone domains
// inside the child's age window (numerator and denominator from one array).
import { domainCountsIn } from "../../lib/domainCount";
import { en as fullPictureEn, he as fullPictureHe } from "../../lib/i18nElevation/fullpicture";
import { tGCare } from "../../lib/growthCareText";
// GP-34 — the thing the parent chose to watch for after a Development Check.
import { clearWatchFocus, resolveWatchFocus } from "../../lib/screeningWatch";
// Wave E — the return hook that lives on this surface: the one thing the
// parent left themselves at the close of a day (TJB-28). B-GROWTH-03 moved the
// reminders card (ENG-23) to #/smart-reminders and the family ritual whose
// turn has come (ENG-25) to #/family.
import { closeDay, deriveReturnSignals } from "../../lib/tomorrowReason";
import { readRitualRecord } from "../../lib/familyRitualsCadence";
import { ADVENTURES, type SavedComicMeta } from "../../lib/heroComics";
import { fmtDay } from "../../lib/formatDate";
// R22 (Builder L) — the recent-observation row printed `log.behaviorType`, the
// stored English identifier ("Transition Refusal"), so a Hebrew parent read a
// Latin title in their own record. `behaviorTypeLabel` is the shared resolver
// every other log surface already uses (Behaviors, Journal, Weekly, QuickLog).
import { behaviorTypeLabel } from "../../content/behaviorTaxonomy";
// GP-06 — the hub's declared primaryMove is "notice-milestone"; until now the
// hero opened the SCREENER and marking a milestone took four taps through the
// Milestones map. The observe row below puts the move on the hub.
import { celebrate as fireCelebration } from "../../lib/celebrate";
// GP-22 — the why-line on this card had no door to "how Arbor decides".
// The shared slot mounts the TrustLink itself (trustLink prop).
import { ContentWhyLine } from "../ui/ContentActionBar";
// GP-32 / GP-33 — the month the parent just lived, and the words ledger.
import MonthInReview from "../growth/MonthInReview";
import FirstWordsLedger from "../growth/FirstWordsLedger";
// GP-30 — one leaf per milestone the parent noticed; counts only, never a
// picture of the child (the rule lives in lib/arborTree.ts).
import ArborTreeCard from "../growth/ArborTreeCard";
import RecordByDomain from "../growth/RecordByDomain";

/** Masterplan 1.7 — module-local string resolution for the Full Picture entry
 *  card (same recipe as Screening.tsx × screeningcalm: i18nElevation/index.ts
 *  registration is that file's own recipe, owned separately). */
function tFP(uiLang: string, key: string, vars?: Record<string, string | number>): string {
  let s = (uiLang === "he" ? fullPictureHe[key] : undefined) ?? fullPictureEn[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/* Growth › Development — ONE coherent screen, no inner tab layer (masterplan
   L2: category → pill is the only navigation; deeper capabilities appear as
   visible cards). The former HubTabs facets are re-homed: the "Now" copilot
   strip renders inline below the hero; Milestones and Journey are visible
   link cards to their own routes (the Growth pill row already carries
   Milestones); the child Profile belongs to the Profile category. Every old
   route (#/copilot, #/milestones, #/journey, #/profile) stays valid. */

export default function DevelopmentTab() {
  const { t, uiLang } = useLanguage();
  const { milestones, behaviorLogs, playLogs, childProfile, setActiveTab, setMilestoneObservation } = useArbor();
  const [checkOpen, setCheckOpen] = useState(false);
  const firstName = (childProfile.name || "").split(" ")[0];

  // UND-2 — read-only view of the saved screenings (existing child collection):
  // once a parent-requested re-check comes due, the pointer row says so.
  const screenings = useChildCollection<{ id: string; answeredAt: string; recheckDueAt?: string }>(
    childProfile.id,
    "screenings"
  );
  // B-GROWTH-04: the re-check is a DATE on the Development Check door, as
  // text in neutral ink — the yellow "due" chip was a second proactive hook
  // (Today's one proactive slot owns the reminder, precedence 4).
  const recheckDueAt = useMemo(() => latestRecheckDueAt(screenings.items), [screenings.items]);

  // UND-6 — age-aware weekly focus: "not sure" items in the current corrected
  // band first (watch for it this week), then not-yet/unmarked in-band, then
  // the nearest earlier band — never an infant item for a 4-year-old while
  // in-band items exist. Corrected (preterm-adjusted) months, same spine as
  // the Milestones map.
  const comparisonMonths = useMemo(() => {
    const chronoMonths = ageMonthsFromProfile(childProfile) ?? Math.round((childProfile.age || 0) * 12);
    return comparisonAgeMonths(chronoMonths, childProfile.preterm?.gestationalWeeks);
  }, [childProfile]);

  // GP-34 — the parent's own pick wins over the derived one. Re-read when the
  // check sheet closes (that is where the choice is made) and when the record
  // changes, so a milestone that has since been noticed retires itself.
  const [watchTick, setWatchTick] = useState(0);
  useEffect(() => { if (!checkOpen) setWatchTick((n) => n + 1); }, [checkOpen]);
  const chosenWatch = useMemo(
    () => resolveWatchFocus(childProfile.id, milestones),
    // watchTick is the storage-read trigger; it has no value of its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [childProfile.id, milestones, watchTick],
  );

  const weeklyFocus = useMemo(() => {
    if (chosenWatch) {
      return {
        // B-GROWTH-11: catalogue text by stable id, in the page language.
        title: milestoneText(chosenWatch, "title", t),
        body: milestoneText(chosenWatch, chosenWatch.skillLooksLike ? "looks" : "desc", t),
        hint: t("growth.focus.watchHint"),
        action: "daily-play" as const,
        chosen: true,
        // GP-06: the id is what makes this card actionable in place.
        milestoneId: chosenWatch.id as string | null,
        observationStatus: (chosenWatch.observationStatus ?? (chosenWatch.checked ? "yes" : undefined)) as string | undefined,
      };
    }
    const selected = selectWeeklyFocus(milestones, comparisonMonths);
    if (selected) {
      return {
        title: milestoneText(selected.milestone, "title", t),
        body: milestoneText(selected.milestone, selected.milestone.skillLooksLike ? "looks" : "desc", t),
        // "watch for" vs "try" — observational framing only, never a verdict.
        hint: selected.mode === "watch" ? t("growth.focus.watchHint") : t("growth.focus.tryHint"),
        action: "daily-play" as const,
        chosen: false,
        milestoneId: selected.milestone.id as string | null,
        observationStatus: selected.milestone.observationStatus as string | undefined,
      };
    }
    return {
      title: t("growth.focus.empty.title"),
      body: t("growth.focus.empty.body"),
      hint: null,
      action: "check" as const,
      chosen: false,
      milestoneId: null as string | null,
      observationStatus: undefined as string | undefined,
    };
  }, [chosenWatch, milestones, comparisonMonths, t]);

  // GP-07 (felt response) + GP-10 (dates): noticing a milestone used to move a
  // COUNTER and nothing else — the one act the hub exists for left no visible
  // trace. Noticed milestones now enter the same "recently" list as moments and
  // play, carrying the date they were noticed, so the record visibly grows in
  // the frame the parent marks it. Counts, titles and dates only — no verdicts.
  const recentMoments = useMemo(() => {
    const moments = [
      ...milestones
        .filter((m) => m.checked && m.observationUpdatedAt)
        .map((m) => ({
          id: `milestone-${m.id}`,
          at: new Date(m.observationUpdatedAt as string).getTime(),
          icon: "check_circle",
          title: milestoneText(m, "title", t),
          meta: tGCare(uiLang, "elev.gcare.ms.noticedOn", { date: fmtDay(m.observationUpdatedAt as string, uiLang) }),
        })),
      ...behaviorLogs.map((log) => ({
        id: `behavior-${log.id}`,
        at: new Date(log.timestamp).getTime(),
        icon: "chat_bubble",
        title: behaviorTypeLabel(log.behaviorType, t),
        meta: [log.context, fmtDay(log.timestamp, uiLang)].filter(Boolean).join(" · "),
      })),
      ...playLogs.map((log) => ({
        id: `play-${log.id}`,
        at: new Date(log.timestamp).getTime(),
        icon: "toys",
        title: log.title,
        meta: fmtDay(log.timestamp, uiLang),
      })),
    ];
    return moments
      .filter((m) => Number.isFinite(m.at))
      .sort((a, b) => b.at - a.at)
      .slice(0, 3);
  }, [milestones, behaviorLogs, playLogs, uiLang, t]);

  // E2 hero stat trio — CLINICAL FIREWALL: counts and plain activity facts
  // only ("x of y noticed", active-domain count, moments-this-week count).
  // Never percentages, verdicts, or trend deltas on this surface.
  // GP-08: "x of y" is counted over the child's AGE WINDOW (current corrected
  // band + one earlier — lib/milestoneData.milestoneAgeWindow), never the
  // whole 0–6y catalogue ("0 of 133" on day 0).
  const heroStats = useMemo(() => {
    const inWindow = ageWindowMilestones(milestones, comparisonMonths);
    const noticed = inWindow.filter((m) => m.checked).length;
    // B-GROWTH-01: both domain numbers from the SAME windowed array — the
    // numerator can never exceed the denominator ("6 areas of 5" is gone).
    const { active: domainsActive, total: domainsTotal } = domainCountsIn(inWindow);
    const nowMs = Date.now();
    const weekAgo = nowMs - WEEK_MS;
    const momentsWeek = countSince(behaviorLogs, weekAgo, nowMs) + countSince(playLogs, weekAgo, nowMs);
    return { noticed, total: inWindow.length, domainsActive, domainsTotal, momentsWeek };
  }, [milestones, comparisonMonths, behaviorLogs, playLogs]);

  // GP-06 — THE primary move of this hub, performed ON this hub. The Growth
  // contract declares primaryMove "notice-milestone" (lib/surfaceContract.ts),
  // but the hero opened the SCREENER — the anxiety surface — and marking a
  // milestone meant Growth → Milestones → domain row → expand band → "Seen it".
  // The observe row below is the same three-state control the Milestones map
  // uses, wired to the same setMilestoneObservation seam and the same capped
  // celebration; the hero now focuses it instead of opening the check sheet.
  const observeRowRef = useRef<HTMLDivElement | null>(null);
  const [justNoticedId, setJustNoticedId] = useState<string | null>(null);
  const focusObserveRow = useCallback(() => {
    const el = observeRowRef.current;
    if (!el) return;
    try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch { /* jsdom / old webview */ }
    const firstControl = el.querySelector<HTMLButtonElement>("button");
    firstControl?.focus();
  }, []);
  const observeFocusMilestone = useCallback(
    (milestoneId: string, status: "yes" | "not_sure" | "not_yet", wasChecked: boolean) => {
      setMilestoneObservation(milestoneId, status);
      if (status !== "yes" || wasChecked) return;
      // Law 7 caps (≤12 particles / ≤800ms) + the reduced-motion gate live in
      // lib/celebrate — same burst the Milestones map fires.
      fireCelebration({ kind: "milestone" });
      setJustNoticedId(milestoneId);
    },
    [setMilestoneObservation],
  );

  // B-GROWTH-03: the push-reminder state moved with its card to
  // #/smart-reminders (hooks/usePushPriming).

  // TJB-28 — the facts the close-of-day write chooses from. Every one of them
  // is about the PARENT's next move, never a reading of the child.
  const savedComics = useChildCollection<SavedComicMeta>(childProfile.id, "savedComics");
  // B-GROWTH-04: one derivation (lib/tomorrowReason.deriveReturnSignals),
  // shared with the comic shelf's close-of-day write.
  const returnSignals = useMemo(() => deriveReturnSignals({
    behaviorLogs,
    playLogs,
    watchFocus: chosenWatch != null,
    ritualRecord: readRitualRecord(),
    savedComicCount: savedComics.items.length,
    storyTotal: ADVENTURES.length,
    now: Date.now(),
  }), [chosenWatch, savedComics.items.length, behaviorLogs, playLogs]);
  // TJB-28 CLOSE half (B-TODAY-18: the card that ran it moved to Today) —
  // write tonight's reason once per day, exactly as the comic shelf does.
  useEffect(() => {
    closeDay(childProfile.id, Date.now(), returnSignals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childProfile.id]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1180px] space-y-5 sm:space-y-6">
      {/* E2 — Growth hub hero: eyebrow → job sentence → ONE CTA (quick check)
          → count trio. Sits ABOVE the existing cards; ring/domain internals
          below are untouched. E8: EvidenceChip on the hero's meta row. */}
      <div>
        <HubHero
          compact
          tone="mint"
          icon={Sprout}
          eyebrow={t("elev.hero.growth.eyebrow")}
          title={t("elev.hero.growth.title")}
          subtitle={t("elev.hero.growth.sub")}
          // GP-06: the hero CTA IS the contract's primaryMove ("notice-milestone").
          // The Development Check keeps its own home on the pointer row below.
          cta={{
            label: t("elev.waveR.growth.hero.cta"),
            onClick: focusObserveRow,
            icon: <Icon name="check_circle" size={16} />,
            testId: "growth-hero-cta",
          }}
          stats={[
            { value: heroStats.noticed, label: t("elev.hero.growth.stat.noticed", { total: heroStats.total }) },
            // B-GROWTH-01: numerator and denominator both count milestone
            // domains in the child's age window (one vocabulary, n ≤ total).
            { value: heroStats.domainsActive, label: t("elev.hero.growth.stat.domains", { n: heroStats.domainsActive, total: heroStats.domainsTotal }) },
            { value: heroStats.momentsWeek, label: t("elev.hero.growth.stat.week") },
          ]}
          // RUN-08: day-0 teach line instead of "0 · 0 · 0".
          zeroLine={t("elev.growthTruth.hero.empty")}
          testId="growth-hub-hero"
        />
        {/* Meta row — pulled up under the hero (hero carries its own mb-6). */}
        <div className="-mt-3 flex items-center px-1">
          <EvidenceChip />
        </div>
      </div>
      {/* One action first, then the neutral development picture. */}
      {/* Item 11 (IA-02): the surface contract reaches the DOM. `data-module`
          marks a top-level sibling module (what moduleBudget counts);
          `data-primary-move` marks the ONE control that performs the move
          surfaceContract.ts declares for this route. */}
      <section data-module="growth-weekly-focus" data-primary-move="notice-milestone" className="border-y" style={{ borderColor: "var(--arbor-rule)" }} aria-labelledby="growth-weekly-focus">
        <div className="grid min-w-0 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
          <div className="min-w-0 py-5 xl:pe-6">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: "var(--arbor-green-ink)" }} data-testid="growth-focus-eyebrow">
              <Icon name={weeklyFocus.chosen ? "visibility" : "explore"} size={16} />
              {weeklyFocus.chosen ? tGCare(uiLang, "elev.gcare.growth.watch.eyebrow") : t("growth.focus.eyebrow")}
            </span>
            <h2 id="growth-weekly-focus" className="mt-2 break-words text-xl font-semibold leading-tight sm:text-2xl" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{weeklyFocus.title}</h2>
            {weeklyFocus.hint && (
              <p className="mt-1.5 text-[12px] font-bold" style={{ color: "var(--arbor-green-ink)" }}>{weeklyFocus.hint}</p>
            )}
            <p className="mt-2 max-w-2xl break-words text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{weeklyFocus.body}</p>
            {/* GP-06 — the observe row: the hub's primary move, in place.
                Same three states and the same seam as the Milestones map
                (setMilestoneObservation → observationUpdatedAt), so a mark made
                here is the same record entry made there. CLINICAL FIREWALL:
                three equally-weighted answers, one tone, no grade — "Not yet"
                is never styled as a failure. GP-12: 44px targets. */}
            {weeklyFocus.milestoneId && (
              <div ref={observeRowRef} className="mt-5" data-testid="growth-observe-row">
                <p className="text-[12px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>
                  {t("elev.waveR.growth.observe.prompt")}
                </p>
                <div
                  className="mt-2 grid max-w-md grid-cols-3 gap-1.5"
                  role="group"
                  aria-label={t("elev.waveR.growth.observe.aria")}
                >
                  {([
                    ["yes", tGCare(uiLang, "elev.gcare.ms.observe.yes")],
                    ["not_sure", t("ms.observe.notSure")],
                    ["not_yet", t("ms.observe.notYet")],
                  ] as const).map(([status, label]) => {
                    const selected = weeklyFocus.observationStatus === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        data-testid={`growth-observe-${status}`}
                        aria-pressed={selected}
                        onClick={() => observeFocusMilestone(weeklyFocus.milestoneId as string, status, weeklyFocus.observationStatus === "yes")}
                        className="min-h-11 rounded-lg px-1.5 text-xs font-bold transition active:scale-[0.98]"
                        style={{
                          background: selected ? "var(--arbor-green-soft)" : "var(--arbor-paper-deep)",
                          color: selected ? "var(--arbor-green-ink)" : "var(--arbor-muted)",
                          border: `1px solid ${selected ? "var(--arbor-green-ink)" : "var(--arbor-rule)"}`,
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
                  {justNoticedId === weeklyFocus.milestoneId
                    ? t("elev.waveR.growth.observe.noticed", { date: fmtDay(new Date().toISOString(), uiLang) })
                    : t("elev.waveR.growth.observe.hint")}
                </p>
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={() => weeklyFocus.action === "check" ? setCheckOpen(true) : setActiveTab("daily-play")} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold text-white transition active:scale-[0.98]" style={{ background: "var(--arbor-clay)" }}>
                <Icon name={weeklyFocus.action === "check" ? "assignment_turned_in" : "play_arrow"} size={18} />
                {weeklyFocus.action === "check" ? t("growth.focus.check") : t("growth.focus.try")}
              </button>
              <button type="button" onClick={() => setActiveTab("milestones")} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}>
                <Icon name="edit_note" size={18} /> {t("growth.focus.review")}
              </button>
              {/* A choice the parent made has to be a choice they can unmake. */}
              {weeklyFocus.chosen && (
                <button type="button" data-testid="growth-focus-unwatch" onClick={() => { clearWatchFocus(childProfile.id); setWatchTick((n) => n + 1); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition" style={{ color: "var(--arbor-muted)" }}>
                  {tGCare(uiLang, "elev.gcare.growth.watch.clear")}
                </button>
              )}
            </div>
            {/* GP-22 — this card has always said WHAT to watch for and never
                where the pick came from. The why-line names its inputs and the
                TrustLink opens the Trust Center: a why-line that cannot show
                its inputs is an assertion. */}
            <div className="mt-3">
              <ContentWhyLine why={t("elev.waveR.why.focus")} trustLink surface="growth-focus" />
            </div>
          </div>
          <div className="min-w-0 border-t py-5 xl:border-s xl:border-t-0 xl:ps-6" style={{ borderColor: "var(--arbor-rule)" }}>
            <h3 className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("growth.recent.title")}</h3>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("growth.recent.body")}</p>
            {recentMoments.length > 0 ? (
              <ul className="mt-4 space-y-2.5">
                {recentMoments.map((moment) => (
                  <li key={moment.id} className="flex items-start gap-3 border-b py-3" style={{ borderColor: "var(--arbor-rule)" }}>
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}><Icon name={moment.icon} size={16} /></span>
                    <span className="min-w-0 flex-1"><span className="block break-words text-sm font-bold leading-snug" style={{ color: "var(--arbor-ink)" }}>{moment.title}</span><span className="mt-0.5 block break-words text-xs leading-snug" style={{ color: "var(--arbor-muted)" }}>{moment.meta}</span></span>
                  </li>
                ))}
              </ul>
            ) : (
              <button type="button" onClick={() => setActiveTab("daily-play")} className="mt-4 flex min-h-11 w-full items-center gap-3 rounded-xl p-3 text-start" style={{ border: "1px dashed var(--arbor-rule-strong)" }}>
                <Icon name="add_circle" size={18} style={{ color: "var(--arbor-green-ink)" }} />
                <span className="text-xs font-bold" style={{ color: "var(--arbor-ink)" }}>{t("growth.recent.empty")}</span>
              </button>
            )}
          </div>
        </div>
      </section>
      {/* TJB-28 → B-TODAY-18: the reason card moved to Today's continuation
          slot (the B-AI-06 coordinator); Growth keeps the close-of-day WRITE. */}
      {/* GP-32 — the month the family just finished, as COUNTS of what the
          PARENT noticed and kept. Never a progress report on the child: no
          scores, no deltas, no "areas needing work". Renders once per month
          and returns null the rest of the time. */}
      <MonthInReview />
      {/* Masterplan 1.7 / IA canon (L3): the Full Picture (route id "copilot")
          is homed HERE, as a card on the hub's Now region — never a hub pill.
          This is the upgraded form of the old deep-dive link tile (one home,
          no duplicate). Teaser is a plain COUNT of areas the surface reviews —
          no score, verdict, or risk framing (CLINICAL FIREWALL). */}
      <section
        data-testid="full-picture-card"
        className="border-b py-5"
        style={{ borderColor: "var(--arbor-rule)" }}
        aria-labelledby="full-picture-title"
      >
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
            <Icon name="center_focus_strong" size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="full-picture-title" className="break-words text-lg font-semibold leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
                {tFP(uiLang, "elev.fullpicture.title")}
              </h2>
              <span className="inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-extrabold" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
                {/* B-GROWTH-01: the teaser carries NO number — "5 areas
                    covered" counted a vocabulary the Full Picture does not
                    render (≤4 rows). Numberless until B-GROWTH-22 removes the card. */}
                {t("elev.fullpicture.card.teaser")}
              </span>
            </div>
            <p className="mt-1 max-w-2xl break-words text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
              {firstName
                ? tFP(uiLang, "elev.fullpicture.card.promise", { name: firstName })
                : tFP(uiLang, "elev.fullpicture.card.promise.generic")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("copilot")}
            data-testid="full-picture-cta"
            className="inline-flex min-h-11 flex-shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold text-white transition active:scale-[0.98]"
            style={{ background: "var(--arbor-clay)" }}
          >
            {tFP(uiLang, "elev.fullpicture.card.cta")}
            <Icon name="chevron_right" size={18} className="rtl:rotate-180" />
          </button>
        </div>
      </section>
      {/* The Map — the record's home (counts only). */}
      <div data-module="growth-map" style={{ display: "contents" }}><DevScoreCard /></div>
      {/* B-GROWTH-30 — the record by area (spine Option A): one row per domain
          of the registry that has something noticed, registry order, counts
          and dates only. The fourth stamped module (budget 4); B-GROWTH-02
          folds Map / Words / Tree into this one record card. */}
      <RecordByDomain />
      {/* GP-33 — the first-words ledger. The Language Lab has been writing to
          `langObs` for months and the record never showed it; the words are a
          keepsake, not an aggregate. Counts and dates only. */}
      <FirstWordsLedger />
      {/* GP-30 — the tree of what the PARENT has noticed. Homed here, beside
          the other all-time keepsake ledger, rather than beside DevScoreCard:
          that card's count is age-windowed by design and this one spans the
          whole record, so the two sit in different bands of the hub and the
          tree states its own basis in words. No new route — the Growth hub is
          already the record's home. */}
      <ArborTreeCard />
      {/* B-GROWTH-03: the Growth SpineRibbon (-> Academy) is removed — the
          Journal mount keeps the spine promise (spinePromiseMounts.test.ts). */}
      {/* C1 — Monitoring now lives in ONE home: Development Check (the
          ScreeningSheet). The hub keeps only a slim, neutral pointer into it —
          no scores, verdicts, or risk framing (CLINICAL FIREWALL). */}
      <button
        type="button"
        onClick={() => setCheckOpen(true)}
        data-testid="dev-watching-pointer"
        className="flex w-full min-w-0 flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-start transition active:scale-[0.99] sm:flex-nowrap"
        style={{ minHeight: 44, background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--arbor-paper-deep)" }}>
          <Icon name="visibility" size={18} style={{ color: "var(--arbor-green-ink)" }} />
        </span>
        <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug" style={{ color: "var(--arbor-ink)" }}>
          {firstName
            ? t("dev.watching.line", { name: firstName })
            : t("dev.watching.lineGeneric")}
        </span>
        {/* UND-2 → B-GROWTH-04 — the parent's saved re-check date, as plain
            text in neutral ink (no chip, no colour; CLINICAL FIREWALL). */}
        {recheckDueAt && (
          <span
            data-testid="dev-recheck-date"
            className="flex-shrink-0 text-[12px]"
            style={{ color: "var(--arbor-muted)" }}
          >
            {t("elev.growth.recheck.date", { date: fmtDay(recheckDueAt, uiLang) })}
          </span>
        )}
        <span className="ms-12 inline-flex flex-shrink-0 items-center gap-1 text-[12px] font-bold sm:ms-0" style={{ color: "var(--arbor-green-ink)" }}>
          {t("dev.watching.cta")}
          <Icon name="chevron_right" size={16} className="rtl:rotate-180" />
        </span>
      </button>
      {/* Deep-dive doors — visible cards, not a second tab layer. Each is a
          real route (also reachable from the Growth pill row / fallbacks).
          Masterplan 1.7: the copilot tile moved UP into the Full Picture card
          on the Now region — one home, no duplicate link. */}
      <div data-module="growth-deep-dives" className="grid gap-3 sm:grid-cols-2">
        {([
          { tab: "milestones", glyph: "check_circle", label: t("hub.milestones"), sub: t("elev.growth.link.milestones.sub") },
          // GP-07: this door was labelled "the month-by-month development
          // timeline" and pointed at `journey` — the PRACTICE hub, whose first
          // tile is a numeric "practice consistency score". A parent tapping a
          // timeline from the calm Growth hub landed on a score. The
          // month-by-month layer actually lives in the Story density of the
          // timeline surface (MonthsSpine), so the door now points there and
          // says what it opens.
          { tab: "timeline", glyph: "calendar_month", label: tGCare(uiLang, "elev.gcare.growth.link.timeline.label"), sub: tGCare(uiLang, "elev.gcare.growth.link.timeline.sub") },
        ] as const).map((l) => (
          <button
            key={l.tab}
            onClick={() => setActiveTab(l.tab)}
            className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-start transition"
            style={{ minHeight: 44, background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--arbor-paper-deep)" }}>
              <Icon name={l.glyph} size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block break-words text-sm font-bold leading-snug" style={{ color: "var(--arbor-ink)" }}>{l.label}</span>
              <span className="mt-0.5 block break-words text-xs leading-snug" style={{ color: "var(--arbor-muted)" }}>{l.sub}</span>
            </span>
            <Icon name="chevron_right" size={18} className="rtl:rotate-180 flex-shrink-0" />
          </button>
        ))}
      </div>
      {/* C4 — Physical growth: parent-logged measurements → longitudinal
          trajectory. Raw data only; pediatrician holds the reference charts. */}
      <PhysicalGrowthCard />
      {/* B-GROWTH-03: the ritual card lives on #/family and the reminders card
          on #/smart-reminders — the homes that own their job. */}
      <ScreeningSheet open={checkOpen} onClose={() => setCheckOpen(false)} />
    </div>
  );
}
