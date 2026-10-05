import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { useArbor } from "../../context/ArborContext";
import { EvidenceChip } from "../ui/EvidenceChip";
import { useChildCollection } from "../../hooks/useChildCollection";
import { latestRecheckDueAt } from "../../lib/screeningRecheck";
import { comparisonAgeMonths, milestoneText, selectWeeklyFocus } from "../../lib/milestoneData";
import { ageMonthsFromProfile } from "../../lib/childAge";
import DevScoreCard from "../sections/DevScoreCard";
import ScreeningSheet from "../sections/ScreeningSheet";
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
// W2-GROWTH r1 / B-GROWTH-NEW-1A — the "Recent observations" column (log
// types as titles, the stored English context in the meta) merged into the
// New-since rows: the parent's own words, dated, in the reader's language.
import { buildNewSince, newSinceAnchor } from "../../lib/growthNewSince";
import type { LangObservation } from "../../growth/vocabAgg";
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
        observationUpdatedAt: chosenWatch.observationUpdatedAt as string | undefined,
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
        observationUpdatedAt: selected.milestone.observationUpdatedAt as string | undefined,
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
      observationUpdatedAt: undefined as string | undefined,
    };
  }, [chosenWatch, milestones, comparisonMonths, t]);

  // B-GROWTH-NEW-1A (W2-GROWTH r1) — "New since {date}": 2–4 dated rows in
  // the parent's own words (milestones marked seen, words written down, the
  // newest moment's note) since the PREVIOUS visit (useLastVisit's slot, read
  // only; seven days when there is none). It replaces both the hero's count
  // trio ("5 noticed · 2 areas · 6 moments") and the separate Recent column.
  // GP-07 (felt response): "Seen it" stamps observationUpdatedAt, so the row
  // appears here, in the same frame. Counts and words only — no comparison.
  const langObs = useChildCollection<LangObservation>(childProfile.id, "langObs", { orderByField: "timestamp", orderDir: "desc" });
  const previousVisitAt = childProfile.lastVisitPreviousAt ?? null;
  const sinceMs = useMemo(() => newSinceAnchor(previousVisitAt, Date.now()), [previousVisitAt]);
  const newSince = useMemo(
    () => buildNewSince({ sinceMs, milestones, langObs: langObs.items, behaviorLogs, milestoneTitle: (m) => milestoneText(m, "title", t), t }),
    [sinceMs, milestones, langObs.items, behaviorLogs, t],
  );
  const sinceLabel = previousVisitAt
    ? t("elev.growth.newSince.label", { date: fmtDay(new Date(sinceMs).toISOString(), uiLang) })
    : t("elev.growth.newSince.labelWeek");
  // B-GROWTH-NEW-1A — the record is ONE card with three views (Map · Words · Tree).
  const [recordTab, setRecordTab] = useState<"map" | "words" | "tree">("map");

  // GP-06 — THE primary move of this hub, performed ON this hub. The Growth
  // contract declares primaryMove "notice-milestone" (lib/surfaceContract.ts),
  // but the hero opened the SCREENER — the anxiety surface — and marking a
  // milestone meant Growth → Milestones → domain row → expand band → "Seen it".
  // The observe row below is the same three-state control the Milestones map
  // uses, wired to the same setMilestoneObservation seam and the same capped
  // celebration; the hero now focuses it instead of opening the check sheet.
  // W2-GROWTH r1: the hero's scroll-to CTA is deleted — the observe row sits
  // in the first viewport, so the move is already on screen.
  const [justNoticedId, setJustNoticedId] = useState<string | null>(null);
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
      {/* W2-GROWTH r1 + B-GROWTH-NEW-1A/1B — the hub opens on what CHANGED.
          H1 "What's new with {name}" (--t-2xl), then the New-since well, then
          the focus card whose observe row is THE stamped control — all inside
          the first 375 viewport. The slogan hero, its scroll-to CTA and the
          count trio ("5 noticed · 2 areas · 6 moments") are cut: totals, not
          what changed, and a dashboard in the parent register. */}
      <header data-testid="growth-hub-hero" className="space-y-2">
        <h1
          className="break-words font-semibold leading-tight"
          style={{ fontFamily: "var(--font-display)", fontSize: "var(--t-2xl)", color: "var(--arbor-ink)" }}
        >
          {firstName ? t("elev.growth.whatsNew.title", { name: firstName }) : t("elev.growth.whatsNew.titleGeneric")}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <EvidenceChip />
        </div>
      </header>
      {/* Item 11 (IA-02): the surface contract reaches the DOM. `data-module`
          marks a top-level sibling module (what moduleBudget counts);
          `data-primary-move` marks the ONE control that performs the move
          surfaceContract.ts declares for this route — the observe GROUP
          below (W2-GROWTH r1: it used to sit on this 851 px section, so the
          above-the-fold check measured the container's top edge). */}
      <section data-module="growth-weekly-focus" className="space-y-4" aria-labelledby="growth-weekly-focus">
        {/* New since — 2–4 dated rows in the parent's own words. A zero-event
            visit renders nothing here and the focus card is the hero. */}
        {newSince.length > 0 && (
          <div
            data-testid="growth-new-since"
            className="rounded-[var(--r-lg)] p-4"
            style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
          >
            <p className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }} data-testid="growth-since-line">{sinceLabel}</p>
            <ul className="mt-2 space-y-2">
              {newSince.map((row) => (
                <li key={row.id} data-testid={`growth-new-since-${row.kind}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="min-w-0 break-words text-sm" style={{ color: "var(--arbor-ink)" }}>
                    {row.text}
                    {row.quote && (
                      <>
                        {" "}
                        <bdi dir="auto" style={{ fontFamily: "var(--font-editorial)", fontSize: "var(--t-md)" }}>{row.quote}</bdi>
                      </>
                    )}
                  </span>
                  <span className="text-xs" style={{ color: "var(--arbor-muted)" }}>· {fmtDay(row.dateIso, uiLang)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: "var(--arbor-green-ink)" }} data-testid="growth-focus-eyebrow">
              <Icon name={weeklyFocus.chosen ? "visibility" : "explore"} size={16} />
              {weeklyFocus.chosen ? tGCare(uiLang, "elev.gcare.growth.watch.eyebrow") : t("growth.focus.eyebrow")}
            </span>
            {/* W2-GROWTH r1: the H2 steps down to --t-xl under the --t-2xl H1. */}
            <h2 id="growth-weekly-focus" className="mt-1.5 break-words font-semibold leading-tight" style={{ fontFamily: "var(--font-display)", fontSize: "var(--t-xl)", color: "var(--arbor-ink)" }}>{weeklyFocus.title}</h2>
            {weeklyFocus.hint && (
              <p className="mt-1 text-[12px] font-bold" style={{ color: "var(--arbor-green-ink)" }}>{weeklyFocus.hint}</p>
            )}
            <p className="mt-1.5 max-w-2xl break-words text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{weeklyFocus.body}</p>
            {/* GP-06 — the observe row: the hub's primary move, in place.
                Same three states and the same seam as the Milestones map
                (setMilestoneObservation → observationUpdatedAt), so a mark made
                here is the same record entry made there. CLINICAL FIREWALL:
                three equally-weighted answers, one tone, no grade — "Not yet"
                is never styled as a failure. GP-12: 44px targets.
                W2-GROWTH r1: the answers carry the card's weight (elevated
                paper, strong rule, ink label) — they read as alive, not
                disabled, and nothing below them is louder. */}
            {weeklyFocus.milestoneId && (
              <div className="mt-4" data-testid="growth-observe-row">
                <p className="text-[12px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>
                  {t("elev.waveR.growth.observe.prompt")}
                </p>
                <div
                  className="mt-2 grid max-w-md grid-cols-3 gap-2"
                  role="group"
                  aria-label={t("elev.waveR.growth.observe.aria")}
                  data-primary-move="notice-milestone"
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
                        className="min-h-11 rounded-xl px-1.5 text-sm font-bold transition active:scale-[0.98]"
                        style={{
                          background: selected ? "var(--arbor-green-soft)" : "var(--arbor-paper-elevated)",
                          color: selected ? "var(--arbor-green-ink)" : "var(--arbor-ink)",
                          border: `1px solid ${selected ? "var(--arbor-green-ink)" : "var(--arbor-rule-strong)"}`,
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {/* The felt response (B-GROWTH-NEW-1B): after "Seen it" the line
                    names where it went; after "Not sure" it is an open loop the
                    parent can come back to close — a date, never a nudge. */}
                {justNoticedId === weeklyFocus.milestoneId ? (
                  <p className="mt-1.5 text-xs font-bold" style={{ color: "var(--arbor-green-ink)" }} data-testid="growth-observe-kept" aria-live="polite">
                    {firstName
                      ? t("elev.growth.observe.kept", { name: firstName, date: fmtDay(new Date().toISOString(), uiLang) })
                      : t("elev.growth.observe.keptGeneric", { date: fmtDay(new Date().toISOString(), uiLang) })}
                  </p>
                ) : weeklyFocus.observationStatus === "not_sure" && weeklyFocus.observationUpdatedAt ? (
                  <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }} data-testid="growth-observe-again">
                    {t("elev.growth.observe.notSureAgain", { date: fmtDay(weeklyFocus.observationUpdatedAt, uiLang) })}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
                    {t("elev.waveR.growth.observe.hint")}
                  </p>
                )}
              </div>
            )}
            {/* W2-GROWTH r1: one filled CTA per page, and it spells the
                contract's primaryMove. With a focus milestone the observe row
                is the move and everything here is a link; with none, noticing
                happens on the Milestones map, so "Review milestones" carries
                the stamp and the one --gradient-cta. */}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
              {weeklyFocus.action === "check" ? (
                <button type="button" onClick={() => setCheckOpen(true)} data-testid="growth-focus-check" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold transition" style={{ color: "var(--arbor-green-ink)" }}>
                  <Icon name="assignment_turned_in" size={18} />
                  {t("growth.focus.check")}
                </button>
              ) : (
                <button type="button" onClick={() => setActiveTab("daily-play")} data-testid="growth-focus-try" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold transition" style={{ color: "var(--arbor-green-ink)" }}>
                  <Icon name="play_arrow" size={18} />
                  {t("growth.focus.try")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveTab("milestones")}
                // With no focus milestone, noticing happens on the Milestones map:
                // the stamp moves here (the contract's zero-focus state).
                data-primary-move={weeklyFocus.milestoneId ? undefined : "notice-milestone"}
                className={weeklyFocus.milestoneId
                  ? "inline-flex min-h-11 items-center gap-1.5 text-sm font-bold transition"
                  : "inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold transition active:scale-[0.98]"}
                style={weeklyFocus.milestoneId
                  ? { color: "var(--arbor-ink)" }
                  : { background: "var(--gradient-cta)", color: "var(--arbor-on-accent)" }}
              >
                <Icon name="edit_note" size={18} /> {t("growth.focus.review")}
              </button>
              {/* A choice the parent made has to be a choice they can unmake. */}
              {weeklyFocus.chosen && (
                <button type="button" data-testid="growth-focus-unwatch" onClick={() => { clearWatchFocus(childProfile.id); setWatchTick((n) => n + 1); }} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold transition" style={{ color: "var(--arbor-muted)" }}>
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
      </section>
      {/* TJB-28 → B-TODAY-18: the reason card moved to Today's continuation
          slot (the B-AI-06 coordinator); Growth keeps the close-of-day WRITE. */}
      {/* B-GROWTH-NEW-1A — ONE Record card: Map · Words · Tree. The map (the
          record's home, counts only), the first-words ledger (GP-33) and the
          tree of what the PARENT noticed (GP-30) used to be three top-level
          objects; they are three views of one record now. */}
      <section data-module="growth-map" aria-labelledby="growth-record-title" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="growth-record-title" className="break-words font-semibold leading-tight" style={{ fontFamily: "var(--font-display)", fontSize: "var(--t-lg)", color: "var(--arbor-ink)" }}>
            {firstName ? t("elev.growth.record.title", { name: firstName }) : t("elev.growth.record.titleGeneric")}
          </h2>
          <div role="tablist" aria-labelledby="growth-record-title" className="inline-flex gap-1 rounded-xl p-1" style={{ background: "var(--arbor-paper-deep)" }}>
            {(["map", "words", "tree"] as const).map((key) => {
              const on = recordTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  id={`growth-record-tab-${key}`}
                  data-testid={`growth-record-tab-${key}`}
                  aria-selected={on}
                  aria-controls="growth-record-panel"
                  onClick={() => setRecordTab(key)}
                  className="min-h-11 rounded-lg px-3 text-xs font-bold transition"
                  style={on
                    ? { background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }
                    : { color: "var(--arbor-muted)" }}
                >
                  {t(`elev.growth.record.tab.${key}`)}
                </button>
              );
            })}
          </div>
        </div>
        <div role="tabpanel" id="growth-record-panel" aria-labelledby={`growth-record-tab-${recordTab}`}>
          {recordTab === "map" ? <DevScoreCard /> : recordTab === "words" ? <FirstWordsLedger /> : <ArborTreeCard />}
        </div>
      </section>
      {/* B-GROWTH-30 — the record by area (spine Option A): one row per domain
          of the registry that has something noticed, registry order, counts
          and dates only. Stamps its own `growth-record` module. */}
      <RecordByDomain />
      {/* B-GROWTH-03: the Growth SpineRibbon (-> Academy) is removed — the
          Journal mount keeps the spine promise (spinePromiseMounts.test.ts). */}
      {/* Go deeper — Milestones · Timeline · Development Check (with its
          recheck date). Deep-dive doors are visible cards, not a second tab
          layer; each is a real route. W2-GROWTH r1: the Development Check
          pointer joined this module (it was an unstamped top-level sibling). */}
      <div data-module="growth-deep-dives" className="space-y-3">
      <h2 className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("elev.growth.deeper.title")}</h2>
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
      </div>
      {/* W2-GROWTH r1 (Law 7) — the tail is DEMOTED, never removed: one
          collapsed disclosure (the `language-more` pattern) so every capability
          keeps its door while the budget counts what is really on the page.
          Demoted modules keep their own `data-module` and add
          `data-module-demoted` (top-level = stamps minus demoted). */}
      <details data-module-disclosure="growth-more" className="rounded-2xl" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-3">
          <Icon name="expand_more" size={18} />
          <span className="min-w-0">
            <span className="block text-sm font-bold" style={{ color: "var(--arbor-ink)" }}>{t("elev.growth.more.title")}</span>
            <span className="block text-xs" style={{ color: "var(--arbor-muted)" }}>{t("elev.growth.more.sub")}</span>
          </span>
        </summary>
        <div className="space-y-4 px-4 pb-4">
          {/* GP-32 — the month the family just finished, as COUNTS of what the
              PARENT noticed and kept. Never a progress report on the child: no
              scores, no deltas, no "areas needing work". Renders once per month
              and returns null the rest of the time. */}
          <div data-module="growth-month" data-module-demoted><MonthInReview /></div>
          {/* Masterplan 1.7 / IA canon (L3): the Full Picture (route id "copilot")
              is homed HERE — never a hub pill. Teaser carries no number
              (B-GROWTH-01); no score, verdict, or risk framing (CLINICAL
              FIREWALL). W2-GROWTH r1: its CTA is a text link with a chevron. */}
          <section
            data-module="growth-full-picture"
            data-module-demoted
            data-testid="full-picture-card"
            aria-labelledby="full-picture-title"
          >
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
                <Icon name="center_focus_strong" size={24} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 id="full-picture-title" className="break-words text-lg font-semibold leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
                    {tFP(uiLang, "elev.fullpicture.title")}
                  </h3>
                  <span className="inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-extrabold" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
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
                className="inline-flex min-h-11 flex-shrink-0 items-center gap-1 text-sm font-bold transition"
                style={{ color: "var(--arbor-green-ink)" }}
              >
                {tFP(uiLang, "elev.fullpicture.card.cta")}
                <Icon name="chevron_right" size={18} className="rtl:rotate-180" />
              </button>
            </div>
          </section>
        </div>
      </details>
      <ScreeningSheet open={checkOpen} onClose={() => setCheckOpen(false)} />
    </div>
  );
}
