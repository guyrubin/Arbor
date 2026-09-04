import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Sprout } from "lucide-react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { useArbor } from "../../context/ArborContext";
import { HubHero } from "../ui/HubHero";
import { EvidenceChip } from "../ui/EvidenceChip";
import { countSince, WEEK_MS } from "../../lib/pulse";
import { useChildCollection } from "../../hooks/useChildCollection";
import { isRecheckDue, latestRecheckDueAt } from "../../lib/screeningRecheck";
import { ageWindowMilestones, comparisonAgeMonths, selectWeeklyFocus } from "../../lib/milestoneData";
import { ageMonthsFromProfile } from "../../lib/childAge";
import DevScoreCard from "../sections/DevScoreCard";
import PhysicalGrowthCard from "../sections/PhysicalGrowthCard";
import ScreeningSheet from "../sections/ScreeningSheet";
import { SpineRibbon } from "../ui/SpineRibbon";
import { DOMAIN_META } from "../../practice/content";
import { en as fullPictureEn, he as fullPictureHe } from "../../lib/i18nElevation/fullpicture";
import { tGCare } from "../../lib/growthCareText";
// GP-34 — the thing the parent chose to watch for after a Development Check.
import { clearWatchFocus, resolveWatchFocus } from "../../lib/screeningWatch";
// Wave E — the three return hooks that live on this surface: an honest
// reminders card (ENG-23), the family ritual whose turn has come (ENG-25),
// and the one thing the parent left themselves at the close of a day (TJB-28).
import PushPrimingCard from "../nextopen/PushPrimingCard";
import RitualTurnCard from "../nextopen/RitualTurnCard";
import TomorrowReasonCard from "../nextopen/TomorrowReasonCard";
import { readPushPermission, type PushPermission } from "../../lib/pushPriming";
import { readRitualRecord, ritualOfTheMoment } from "../../lib/familyRitualsCadence";
import { ADVENTURES, type SavedComicMeta } from "../../lib/heroComics";
import { fmtDay } from "../../lib/formatDate";
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
  const recheckDue = useMemo(
    () => isRecheckDue(latestRecheckDueAt(screenings.items)),
    [screenings.items]
  );

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
        title: chosenWatch.title,
        body: chosenWatch.skillLooksLike || chosenWatch.description,
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
        title: selected.milestone.title,
        body: selected.milestone.skillLooksLike || selected.milestone.description,
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
          title: m.title,
          meta: tGCare(uiLang, "elev.gcare.ms.noticedOn", { date: fmtDay(m.observationUpdatedAt as string, uiLang) }),
        })),
      ...behaviorLogs.map((log) => ({
        id: `behavior-${log.id}`,
        at: new Date(log.timestamp).getTime(),
        icon: "chat_bubble",
        title: log.behaviorType,
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
  }, [milestones, behaviorLogs, playLogs, uiLang]);

  // E2 hero stat trio — CLINICAL FIREWALL: counts and plain activity facts
  // only ("x of y noticed", active-domain count, moments-this-week count).
  // Never percentages, verdicts, or trend deltas on this surface.
  // GP-08: "x of y" is counted over the child's AGE WINDOW (current corrected
  // band + one earlier — lib/milestoneData.milestoneAgeWindow), never the
  // whole 0–6y catalogue ("0 of 133" on day 0).
  const heroStats = useMemo(() => {
    const inWindow = ageWindowMilestones(milestones, comparisonMonths);
    const noticed = inWindow.filter((m) => m.checked).length;
    const domainsActive = new Set(milestones.filter((m) => m.checked).map((m) => m.domain)).size;
    const nowMs = Date.now();
    const weekAgo = nowMs - WEEK_MS;
    const momentsWeek = countSince(behaviorLogs, weekAgo, nowMs) + countSince(playLogs, weekAgo, nowMs);
    return { noticed, total: inWindow.length, domainsActive, momentsWeek };
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

  // ENG-23 — reminders. The card ALWAYS renders and always states the truth of
  // this build: `pushCapable()` is false without a VAPID key, and in that build
  // the card says Arbor sends nothing rather than showing a switch that cannot
  // deliver. Capability is resolved async (lib/push is lazily imported so
  // firebase/messaging never enters the main bundle).
  const [pushCapableNow, setPushCapableNow] = useState(false);
  const [pushPermission, setPushPermission] = useState<PushPermission>("unsupported");
  const [pushRegistered, setPushRegistered] = useState(false);
  const [pushPending, setPushPending] = useState(false);
  useEffect(() => {
    setPushPermission(readPushPermission());
    let alive = true;
    void import("../../lib/push.js").then(({ pushCapable }) => {
      if (!alive) return;
      const capable = pushCapable();
      setPushCapableNow(capable);
      setPushRegistered(capable && readPushPermission() === "granted");
    });
    return () => { alive = false; };
  }, []);
  const handlePushToggle = useCallback(async () => {
    const { pushCapable, registerPush, unregisterPush } = await import("../../lib/push.js");
    if (!pushCapable()) return;
    const apiBase = (window as unknown as { __ARBOR_API_BASE__?: string }).__ARBOR_API_BASE__ || "/api";
    setPushPending(true);
    try {
      if (pushRegistered) {
        await unregisterPush(apiBase);
        setPushRegistered(false);
      } else {
        const result = await registerPush(apiBase);
        setPushRegistered(result === "granted");
      }
      setPushPermission(readPushPermission());
    } finally {
      setPushPending(false);
    }
  }, [pushRegistered]);

  // TJB-28 — the facts the close-of-day write chooses from. Every one of them
  // is about the PARENT's next move, never a reading of the child.
  const savedComics = useChildCollection<SavedComicMeta>(childProfile.id, "savedComics");
  const returnSignals = useMemo(() => {
    const now = Date.now();
    const startOfToday = new Date(now).setHours(0, 0, 0, 0);
    return {
      ritualDue: ritualOfTheMoment(now, readRitualRecord()) !== null,
      watchFocus: chosenWatch != null,
      unopenedStory: savedComics.items.length < ADVENTURES.length,
      momentsToday:
        countSince(behaviorLogs, startOfToday, now) + countSince(playLogs, startOfToday, now),
    };
  }, [chosenWatch, savedComics.items.length, behaviorLogs, playLogs]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1180px] space-y-5 sm:space-y-6">
      {/* E2 — Growth hub hero: eyebrow → job sentence → ONE CTA (quick check)
          → count trio. Sits ABOVE the existing cards; ring/domain internals
          below are untouched. E8: EvidenceChip on the hero's meta row. */}
      <div>
        <HubHero
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
            { value: heroStats.domainsActive, label: t("elev.hero.growth.stat.domains") },
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
      {/* TJB-28 — the one thing this parent left themselves at the close of a
          previous day. Renders null on the day it was written and once acted on. */}
      <TomorrowReasonCard signals={returnSignals} childName={firstName} />
      {/* GP-32 — the month the family just finished, as COUNTS of what the
          PARENT noticed and kept. Never a progress report on the child: no
          scores, no deltas, no "areas needing work". Renders once per month
          and returns null the rest of the time. */}
      <MonthInReview />
      {/* One action first, then the neutral development picture. */}
      <section className="overflow-hidden rounded-[24px]" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-sm)" }} aria-labelledby="growth-weekly-focus">
        <div className="grid min-w-0 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
          <div className="min-w-0 p-4 sm:p-6 lg:p-7">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--arbor-green-ink)" }} data-testid="growth-focus-eyebrow">
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
                        className="min-h-11 rounded-lg px-1.5 text-[11px] font-bold transition active:scale-[0.98]"
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
                <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
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
          <div className="min-w-0 border-t p-4 sm:p-6 xl:border-s xl:border-t-0" style={{ background: "var(--arbor-paper-deep)", borderColor: "var(--arbor-rule)" }}>
            <h3 className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("growth.recent.title")}</h3>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("growth.recent.body")}</p>
            {recentMoments.length > 0 ? (
              <ul className="mt-4 space-y-2.5">
                {recentMoments.map((moment) => (
                  <li key={moment.id} className="flex items-start gap-3 rounded-xl bg-white p-3" style={{ border: "1px solid var(--arbor-rule)" }}>
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}><Icon name={moment.icon} size={16} /></span>
                    <span className="min-w-0 flex-1"><span className="block break-words text-xs font-bold leading-snug" style={{ color: "var(--arbor-ink)" }}>{moment.title}</span><span className="mt-0.5 block break-words text-[11px] leading-snug" style={{ color: "var(--arbor-muted)" }}>{moment.meta}</span></span>
                  </li>
                ))}
              </ul>
            ) : (
              <button type="button" onClick={() => setActiveTab("daily-play")} className="mt-4 flex w-full items-center gap-3 rounded-xl bg-white p-3 text-start" style={{ border: "1px dashed var(--arbor-rule-strong)" }}>
                <Icon name="add_circle" size={18} style={{ color: "var(--arbor-green-ink)" }} />
                <span className="text-xs font-bold" style={{ color: "var(--arbor-ink)" }}>{t("growth.recent.empty")}</span>
              </button>
            )}
          </div>
        </div>
      </section>
      {/* Masterplan 1.7 / IA canon (L3): the Full Picture (route id "copilot")
          is homed HERE, as a card on the hub's Now region — never a hub pill.
          This is the upgraded form of the old deep-dive link tile (one home,
          no duplicate). Teaser is a plain COUNT of areas the surface reviews —
          no score, verdict, or risk framing (CLINICAL FIREWALL). */}
      <section
        data-testid="full-picture-card"
        className="overflow-hidden rounded-[24px] p-4 sm:p-6"
        style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-sm)" }}
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
              <span className="inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
                {tFP(uiLang, "elev.fullpicture.card.teaser", { n: Object.keys(DOMAIN_META).length })}
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
      <DevScoreCard />
      {/* GP-33 — the first-words ledger. The Language Lab has been writing to
          `langObs` for months and the record never showed it; the words are a
          keepsake, not an aggregate. Counts and dates only. */}
      <FirstWordsLedger />
      {/* E3 — the spine, made visible (first mount): what this surface's
          noticing feeds. One direction only; plain activity fact, no verdicts.
          The Academy hub's landing route is "masterclasses" (navigation.ts). */}
      <SpineRibbon
        text={t("elev.spine.growth")}
        tone="mint"
        icon="school"
        onFollow={() => setActiveTab("masterclasses")}
        testId="growth-spine-ribbon"
      />
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
        {/* UND-2 — the parent's saved re-check reminder surfaces HERE once due
            (neutral reminder chip — never a verdict; CLINICAL FIREWALL). */}
        {recheckDue && (
          <span
            data-testid="dev-recheck-due"
            className="inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold"
            style={{ background: "var(--arbor-yellow-soft)", color: "var(--arbor-ink)" }}
          >
            <Icon name="notifications" size={12} /> {t("dev.watching.recheckDue")}
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
      <div className="grid gap-3 sm:grid-cols-2">
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
      {/* ENG-25 — the family ritual whose turn has come round. The cadence was
          prose in Academy and nothing acted on it; this is where it comes back. */}
      <RitualTurnCard />
      <ScreeningSheet open={checkOpen} onClose={() => setCheckOpen(false)} />
      {/* ENG-23 — reminders, primed and honest about what this build can do. */}
      <PushPrimingCard
        capable={pushCapableNow}
        permission={pushPermission}
        registered={pushRegistered}
        pending={pushPending}
        onToggle={handlePushToggle}
      />
    </div>
  );
}
