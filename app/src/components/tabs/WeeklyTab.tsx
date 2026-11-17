import React, { useEffect, useMemo, useState } from "react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useWeeklyRecap, recapWeekId, recapWeekStartMs, weekAnchorDate } from "../../hooks/useWeeklyRecap";
import { useChildCollection } from "../../hooks/useChildCollection";
import { useObservations } from "../../hooks/useObservations";
import { track } from "../../lib/analytics";
import { appointmentStartMs, nextPrepareVisit, type Appointment } from "../../lib/careTrack";
import { appointmentRoleLabel } from "../../lib/appointmentLabel";
import { weekGlance, glanceHasCounts } from "../../lib/weekGlance";
import { weekReportLines, type WeekPlace } from "../../lib/weekReport";
import { weekInstrument, type InstrumentDate } from "../../lib/weekInstrument";
import { fmtDayTimeV10 } from "../../lib/formatDate";
import { useFamilyPlanDates } from "../../hooks/useFamilyPlan";
import { adultLabel } from "../familyPlan/format";
import { familyPlanCopy } from "../familyPlan/familyPlanCopy";
import { NOW_V10_COPY } from "../companion/now10/nowV10Copy";
import { dayField } from "../../lib/dayField";
import { predictRhythm } from "../../rhythm/predict";
import { buildDayWindowsSummary } from "../../growth/dayWindowsAgg";
import { ageYearsOf } from "../../lib/age/forChild";
import { EMPTY_ART } from "../../lib/parentArt";
import { DsRoot, Fig, Guide, LivingForm, Route, RouteSection, Scene, StartHere, type GuideStop } from "../../design/primitives";
import { useComposition } from "../../design/useComposition";
import QuickLogModal from "../overview/QuickLogModal";
import { weeklyChipIds, isEmptyCurrentWeek, reportWeekBounds } from "../weekly/weeklySelection";
import { whatWorkedThisWeek, WhatWorkedSend } from "../weekly/WhatWorkedCard";
import WeekInstrument from "../weekly/v10/WeekInstrument";
import WhatHelped from "../weekly/v10/WhatHelped";
import CarryNextWeek from "../weekly/v10/CarryNextWeek";
import YourDay from "../weekly/v10/YourDay";
import WeekReadGuide from "../weekly/v10/WeekReadGuide";
import { landOnStop } from "../weekly/v10/landing";
import { weeklyCopy } from "../weekly/v10/weeklyCopy";
import InviteCard from "../referral/InviteCard";
import "../weekly/v10/weeklyV10.css";

/* B-OCCL-02 (6 Oct): the route's ONE data-primary-move literal, spread on the
   control that performs the move, never on a wrapper.
   v3 F-NOW-3: the move lives in the carry band ("For next week", stop 3).
   While an AI digest's suggestion is not yet today's step, the band's "Make it
   today's step" carries it (acceptRendered); in every other state (nothing
   stored, the digest call failed, a fallback digest, the step already taken, a
   history week without an AI suggestion) the band's "Back to Now" carries it.
   Exactly one of the two renders the stamp: never none, never two. */
const ACCEPT_STAMP = { "data-primary-move": "accept-recap-recommendation" } as const;

const PLACE_KEY: Record<WeekPlace, string> = {
  home: "elev.wk.place.home",
  school: "elev.wk.place.school",
  transit: "elev.wk.place.transit",
  public: "elev.wk.place.public",
};

/** The stop ids, top to bottom; `day-windows` lands on the last. */
const STOP = { week: "wk-stage", helped: "wk-helped", next: "wk-next", day: "wk-day" } as const;

/**
 * WeeklyTab — Now › Weekly report (design system v10.1, boards N-Week-D/M),
 * and the `day-windows` route, which opens this page at "Your day at a glance".
 * Four numbered stops: (1) the week, drawn as an instrument of what the parent
 * recorded, with the headline "{first}'s week, at a glance." and "Counts, not
 * scores."; (2) what helped; (3) what to carry into next week: the digest's
 * suggestion (the route's one primary move), the areas, the next visit; (4) the
 * parent's day at a glance. A past week renders the same page over its own
 * dates, stepped to with Previous week / Next week.
 *
 * Clinical firewall: counts of what the parent recorded, everywhere on the
 * page; no share of a whole about the child, no trend, no colour that grades.
 */
export default function WeeklyTab() {
  const { childProfile, setActiveTab, acceptTodayAction, activeTodayAction, actionLoop, behaviorLogs, activeTab } = useArbor();
  const { user } = useAuth();
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  const copy = weeklyCopy(uiLang);
  const composition = useComposition();
  const phone = composition === "phone";
  // ENG-07: the empty week offers the move that fills it, in place.
  const [logOpen, setLogOpen] = useState(false);

  const recap = useWeeklyRecap();
  const { reports, generating, generate, currentId, currentLabel, labelFor } = recap;

  // F-06: the tab ALWAYS lands on the CURRENT week, never a stored reports[0].
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId) setSelectedId(currentId);
  }, [selectedId, currentId]);

  // B-OCCL-03: the first paint already reads the current week.
  const selected = reports.find((r) => r.id === (selectedId ?? currentId)) ?? null;
  const hasStoredCurrentWeek = reports.some((r) => r.id === currentId);
  const emptyCurrentWeek = isEmptyCurrentWeek(selectedId, currentId, hasStoredCurrentWeek);
  const chipIds = weeklyChipIds(reports.map((r) => r.id), currentId);
  // TJB-19: a week id is a storage key and never renders.
  const reportById = useMemo(() => new Map(reports.map((r) => [r.id, r])), [reports]);
  const chipLabel = (id: string) => (id === currentId ? t("elev.wk.thisWeek") : labelFor(reportById.get(id)));
  const viewId = selectedId ?? currentId;
  const isCurrent = viewId === currentId;
  const at = chipIds.indexOf(viewId);
  const prevId = at >= 0 ? chipIds[at + 1] ?? null : null;
  const nextId = at > 0 ? chipIds[at - 1] : null;

  const first = childProfile.name.split(" ")[0];
  const parentFirst = (user?.displayName || t("nav.parent")).split(" ")[0];
  const locale = he ? "he" : "en";
  const dateLocale = he ? "he-IL" : "en-GB";

  const awaitingLanguage = selected?.id === currentId && recap.languageRefreshPending;
  const digestAccepted = !!selected?.digest && activeTodayAction?.recommendation === selected.digest.tryThisWeek.trim();
  const acceptRendered = !!selected && !awaitingLanguage && selected.digest?.generated === "ai" && !!selected.digest.tryThisWeek.trim() && !digestAccepted;

  /* The report week's counts (lib/weekGlance), lines (lib/weekReport) and
     instrument (lib/weekInstrument), all over the same span: the current week
     from its first instant to now, a past week whole (reportWeekBounds). */
  const observations = useObservations();
  const appointments = useChildCollection<Appointment>(childProfile.id, "appointments");
  /* The dates the rail draws: dated visits and the Family plan's open dates,
     each with who has it ("nobody yet" when no adult has taken it). */
  const plan = useFamilyPlanDates(childProfile.id);
  const meUid = user?.uid ?? "local-sandbox";
  const railDates = useMemo<InstrumentDate[]>(() => {
    const fp = familyPlanCopy[locale];
    const planDates = plan.all
      .filter((d) => d.status === "open")
      .map((d) => {
        const [y, m, day] = d.date.split("-").map(Number);
        const [h, mi] = (d.time ?? "00:00").split(":").map(Number);
        const who = d.holder ? adultLabel(d.holder, meUid, fp) : NOW_V10_COPY[locale].familyPlanNobody;
        return { id: `plan:${d.id}`, startMs: new Date(y, m - 1, day, h || 0, mi || 0).getTime(), label: d.title, sub: d.time ? `${d.time} · ${who}` : who, nobody: !d.holder };
      });
    const visits = appointments.items.map((a) => ({ id: a.id, startMs: appointmentStartMs(a), label: appointmentRoleLabel(a, t) }));
    return [...visits, ...planDates];
  }, [plan.all, appointments.items, meUid, locale, t]);
  const week = useMemo(() => {
    const bounds = reportWeekBounds(viewId, weekAnchorDate(selected), { weekId: recapWeekId, weekStartMs: recapWeekStartMs });
    const nowMs = Date.now();
    const span = isCurrent
      ? { startMs: bounds?.startMs ?? recapWeekStartMs(new Date(nowMs)), endMs: nowMs, lastMs: bounds?.endMs ?? nowMs }
      : bounds && { startMs: bounds.startMs, endMs: bounds.endMs, lastMs: bounds.endMs };
    if (!span) return null;
    const counts = weekGlance({ observations, actionLoop, now: new Date(span.endMs), weekStartMs: span.startMs });
    const glance = isCurrent ? counts : { ...counts, today: 7 };
    return {
      ...span,
      glance,
      lines: weekReportLines({ observations, actionLoop, startMs: span.startMs, endMs: span.endMs }),
      instrument: weekInstrument({
        observations,
        actionLoop,
        logs: behaviorLogs,
        dates: railDates,
        dayStarts: glance.perDay.map((d) => d.startMs),
        endMs: span.endMs,
        isCurrent,
      }),
    };
  }, [viewId, isCurrent, selected, observations, actionLoop, behaviorLogs, railDates]);
  const dashboardShown = !!week && (glanceHasCounts(week.glance) || !!selected);

  // The kicker's dates, day first as the boards write them ("14 to 20 Nov").
  const range = useMemo(() => {
    const fallback = selected ? labelFor(selected) : currentLabel;
    if (!week) return fallback;
    const firstDay = new Date(week.glance.perDay[0].startMs);
    const lastDay = new Date(Math.max(firstDay.getTime(), Math.min(week.glance.perDay[6].startMs, week.lastMs - 1)));
    const dm = (d: Date) => d.toLocaleDateString(he ? "he-IL" : "en-GB", { day: "numeric", month: "short" });
    const sameMonth = firstDay.getMonth() === lastDay.getMonth();
    return `${sameMonth ? firstDay.getDate() : dm(firstDay)}${copy.rangeJoin}${dm(lastDay)}`;
  }, [week, he, selected, labelFor, currentLabel, copy.rangeJoin]);

  // B-TODAY-29: the sentences the parent marked "held the plan" this week.
  const worked = useMemo(
    () => (week ? whatWorkedThisWeek(actionLoop, week.startMs, { locale, childName: first, nowMs: week.endMs }) : []),
    [actionLoop, week, locale, first]
  );

  // The weekday the held words were used, when they all share one ("on Saturday").
  const heldDays = new Set(worked.map((l) => new Date(l.at).toLocaleDateString(dateLocale, { weekday: "long" })));
  const heldDay = heldDays.size === 1 ? [...heldDays][0] : undefined;

  // Your day at a glance: the rhythm window production's day windows read.
  const nowMs = Date.now();
  const ageYears = ageYearsOf(childProfile);
  const daySummary = useMemo(() => {
    const logs = behaviorLogs.map((l) => ({ timestamp: l.timestamp, intensity: l.intensity }));
    const rhythm = predictRhythm(logs, Date.now(), { ageYears });
    return buildDayWindowsSummary(rhythm, Date.now(), logs);
  }, [behaviorLogs, ageYears]);
  const field = useMemo(() => dayField(behaviorLogs, Date.now()), [behaviorLogs]);

  // The next visit inside its Prepare window (the visit Care › Visits anchors on).
  const visit = nextPrepareVisit(appointments.items, nowMs);
  const visitStart = visit ? appointmentStartMs(visit) : null;
  // The Visit summary (#/handoff folds into Care › Visits).
  const openSummary = () => setActiveTab("handoff");

  // The digest the band shows; recap_opened once per shown week.
  const shownDigestWeek = selected?.digest && !awaitingLanguage ? selected.id : null;
  useEffect(() => {
    if (!shownDigestWeek) return;
    track("recap_opened", { week: shownDigestWeek });
    if (shownDigestWeek === currentId && recap.recapUnopened) recap.markRecapOpened();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownDigestWeek, recap.recapUnopened]);

  // `day-windows` folds into this page: land on "Your day at a glance".
  //   The landing is measured (weekly/v10/landing): the stamped primary move
  //   ends fully above the screen or fully below the shell's top strip.
  useEffect(() => {
    if (activeTab !== "day-windows") return;
    const root = document.querySelector<HTMLElement>('[data-testid="weekly-v10"]');
    return root ? landOnStop(STOP.day, root) : undefined;
  }, [activeTab]);

  const carry = shownDigestWeek && selected?.digest ? selected.digest.tryThisWeek.trim() : "";
  const carryIsDraft = !!carry && selected?.digest?.generated === "ai";
  const carryNote = isCurrent && (generating || awaitingLanguage)
    ? t("elev.wk.carry.writing")
    : !isCurrent
      ? t("elev.wk.carry.history")
      : t("elev.wk.carry.none");
  const canWrite = isCurrent && !selected?.digest && !generating && !awaitingLanguage && !!week && glanceHasCounts(week.glance);

  const stepButton = (id: string, dir: "prev" | "next") => (
    <button
      type="button"
      data-testid={dir === "prev" ? "weekly-prev" : "weekly-next"}
      onClick={() => setSelectedId(id)}
      aria-label={t(dir === "prev" ? "elev.wk.prev.aria" : "elev.wk.next.aria", { week: chipLabel(id) })}
      className="btn ghost sm wk10-step"
    >
      {dir === "prev" && <Icon name="arrow_back" size={18} className="rtl:-scale-x-100" />}
      {t(dir === "prev" ? "elev.wk.prev" : "elev.wk.next")}
      {dir === "next" && <Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" />}
    </button>
  );

  /* B-TODAY-22: ONE outline door to the Visit summary, a secondary move, never
     a second gradient beside the band's accept. Beside the figures on desktop;
     a full-width button under the week on phones (one tree, one seat). */
  const summaryDoor = (
    <button
      type="button"
      onClick={openSummary}
      data-testid="weekly-snapshot-door"
      className={`btn ghost ${phone ? "block" : "sm"} wk10-summary`}
    >
      <Icon name="description" size={18} /> {copy.addToSummary}
    </button>
  );

  const counts = week?.glance.counts;
  // The rail's end: the next dated item after the report week, within the Prepare window.
  const weekEnd = week ? week.glance.perDay[6].startMs + 86_400_000 : 0;
  const beyond = useMemo(() => {
    if (!week || !isCurrent) return null;
    const next = railDates
      .filter((d): d is InstrumentDate & { startMs: number } => d.startMs !== null && d.startMs >= weekEnd && d.startMs - nowMs <= 14 * 86_400_000)
      .sort((a, b) => a.startMs - b.startMs)[0];
    return next ? { label: next.label, sub: next.sub, ms: next.startMs, nobody: next.nobody } : null;
  }, [week, isCurrent, railDates, weekEnd, nowMs]);
  // The days a milestone was marked, from the same glance Milestones counts.
  const milestoneDays = week
    ? week.glance.perDay.filter((d) => d.milestones > 0).map((d) => new Date(d.startMs).toLocaleDateString(dateLocale, { weekday: "short", day: "numeric" })).join(", ")
    : "";
  const notThisTime = week?.instrument.counts.not ?? 0;
  const placesLine = week ? week.lines.places.map((p) => t(PLACE_KEY[p.place], { n: p.n })).join(" · ") : "";
  const figures = counts && (counts.moments > 0 || counts.helped > 0 || notThisTime > 0) && (
    <div className="wk10-figs">
      {counts.moments > 0 && <Fig n={counts.moments} unit={copy.momentsKept(counts.moments)} sub={placesLine} size="md" />}
      {counts.helped > 0 && <Fig n={counts.helped} unit={copy.stepsHelped(counts.helped)} sub={notThisTime > 0 ? copy.notThisTimeN(notThisTime) : undefined} size="md" />}
    </div>
  );

  const stops: GuideStop[] = [
    { id: STOP.week, title: copy.stopWeek, sub: copy.stopWeekSubV },
    ...(dashboardShown ? [{ id: STOP.helped, title: copy.stopHelped, sub: copy.stopHelpedSubV }] : []),
    { id: STOP.next, title: copy.stopNext, sub: copy.stopNextSubV },
    { id: STOP.day, title: copy.stopDay, sub: copy.stopDaySubV },
  ];
  const stopNo = (id: string) => stops.findIndex((s) => s.id === id) + 1;

  /* Stop 1 is the week or, with nothing to count and nothing stored, the empty
     card: they exclude each other, so they share ONE stamp. */
  const stage: "weekly-glance" | "weekly-empty" | null = dashboardShown && week ? "weekly-glance" : !selected ? "weekly-empty" : null;
  const stageStamp = { "data-module": stage ?? undefined };

  /* Desktop (N-Week-D): the week's scene beside the "How to read this week"
     rail; phone draws the guide as a row under the scene (N-Week-M). */
  const wrapStage = (scene: React.ReactNode) =>
    !phone && stage === "weekly-glance" ? (
      <div className="g12 wk10-stagegrid">
        <div className="x8">{scene}</div>
        <div className="x4">
          <WeekReadGuide composition={composition} copy={copy} />
        </div>
      </div>
    ) : (
      scene
    );

  const art = EMPTY_ART.weekly;
  const kicker = (
    <span className="gsec">
      <span data-testid="weekly-eyebrow" className="kicker">{range}</span>
      {isCurrent && <StartHere>{copy.startHere}</StartHere>}
    </span>
  );

  return (
    <DsRoot composition={composition} className="wk10" data-testid="weekly-v10">
      <Guide stops={stops} mini={phone} label={copy.onThisPage} current={activeTab === "day-windows" ? stops.length - 1 : 0} />
      <Route composition={composition} tight={phone}>
        <RouteSection id={STOP.week} n={stopNo(STOP.week)} on aria-labelledby="weekly-title">
          {wrapStage(
          <Scene field="now" className="wk10-scene" orbs={phone ? [{ size: 260, left: -170, top: -150, opacity: 0.5 }, { size: 200, right: -110, top: -120, opacity: 0.55, b: true }] : [{ size: 420, left: -250, top: -250, opacity: 0.55 }, { size: 300, right: -150, top: -190, opacity: 0.55, b: true }]}>
            <header className="wk10-head">
              <div className="stack wk10-headtext">
                {kicker}
                <h1 id="weekly-title" data-testid="weekly-title" className="hero">{t("elev.wk.headline", { first })}</h1>
                <p data-testid="weekly-glance-sub" className="wk10-sub">{t("elev.wk.glance.sub")}</p>
              </div>
              {(prevId || nextId) && (
                <div data-testid="weekly-header-actions" className="line wk10-steps">
                  {prevId && stepButton(prevId, "prev")}
                  {nextId && stepButton(nextId, "next")}
                </div>
              )}
              {!phone && stage !== "weekly-empty" && <LivingForm src={art.src} srcSet={art.srcSet} width={96} height={43} crop={{ w: 124.7, h: 83.1, x: -14.4, y: -21.8 }} className="wk10-art" />}
            </header>

            {stage === "weekly-glance" && week ? (
              <div {...stageStamp} data-testid="weekly-glance" className="wk10-stage">
                <div className="wk10-figrow">
                  {figures}
                  {!phone && summaryDoor}
                </div>
                <WeekInstrument
                  data={week.instrument}
                  composition={composition}
                  copy={copy}
                  locale={dateLocale}
                  beyond={beyond}
                  todayStep={isCurrent && !!activeTodayAction && !activeTodayAction.outcome}
                  footer={
                    <div className="line wk10-chiprow">
                      <button type="button" className="wk-q" data-testid="weekly-tile-milestones" onClick={() => setActiveTab("milestones")}>
                        {phone ? copy.milestonesShort(counts?.milestones ?? 0) : copy.milestonesChip(counts?.milestones ?? 0, milestoneDays)}
                        <Icon name="chevron_right" size={15} className="rtl:-scale-x-100" />
                      </button>
                      <span className="wk-q">{phone ? copy.kidShort(counts?.kid ?? 0) : copy.kidChip(counts?.kid ?? 0)}</span>
                    </div>
                  }
                />
              </div>
            ) : stage === "weekly-empty" ? (
              /* F-06: the current week with nothing kept yet says so honestly;
                 its ONE move is the explicit secondary capture-moment
                 (surfaceContract weekly), opened in place. */
              <div {...stageStamp} className="wk10-empty">
                <figure aria-hidden="true" data-testid="weekly-empty-art" className="wk10-empty-art">
                  <img src={art.src} srcSet={art.srcSet} width={art.width} height={art.height} alt="" loading="lazy" decoding="async" />
                </figure>
                <div className="stack wk10-empty-text">
                  <p>{emptyCurrentWeek ? t("elev.wk.emptyThisWeek") : t("wk.noReports")}</p>
                  <div className="line wk10-empty-moves">
                    <button type="button" onClick={() => setLogOpen(true)} data-secondary-move="capture-moment" data-testid="weekly-log-a-moment" className="btn ghost sm">
                      <Icon name="add" size={18} /> {t("elev.wk.logMoment")}
                    </button>
                    {summaryDoor}
                  </div>
                </div>
              </div>
            ) : null}
          </Scene>
          )}
          {/* Phone: the Visit summary door sits under the scene card, as N-Week-M draws it. */}
          {phone && stage === "weekly-glance" && summaryDoor}
          {phone && stage === "weekly-glance" && <WeekReadGuide composition={composition} copy={copy} />}
        </RouteSection>

        {dashboardShown && week && (
          <RouteSection id={STOP.helped} n={stopNo(STOP.helped)} stopTop={2} aria-labelledby="wk-helped-title">
            <div data-module="weekly-helped">
              <WhatHelped
                composition={composition}
                copy={copy}
                t={t}
                uiLang={uiLang}
                locale={dateLocale}
                childFirst={first}
                hardCount={week.instrument.counts.hard}
                steps={week.lines.steps}
                heldWords={<WhatWorkedSend lines={worked} parentName={parentFirst} locale={locale} t={t} />}
                hasHeldWords={worked.length > 0}
                wordsDay={heldDay}
                words={week.lines.words}
                onPlans={() => setActiveTab("plans")}
                onHardMoments={() => setActiveTab("behaviors")}
              />
            </div>
          </RouteSection>
        )}

        <RouteSection id={STOP.next} n={stopNo(STOP.next)} stopTop={2} aria-labelledby="wk-next-title">
          <div data-module="weekly-carry">
            <CarryNextWeek
              composition={composition}
              copy={copy}
              t={t}
              uiLang={uiLang}
              locale={dateLocale}
              areas={week?.lines.areas ?? []}
              visit={visit && visitStart !== null ? { startMs: visitStart, role: appointmentRoleLabel(visit, t) } : null}
              nowMs={nowMs}
              onHardMoments={() => setActiveTab("behaviors")}
              onMoments={() => setActiveTab("timeline")}
              onPrepare={() => setActiveTab("consult")}
              forNextWeek={
                <div data-testid="weekly-carry" className="stack wk10-carry">
                  {carry ? (
                    <div className={carryIsDraft ? "wk10-draft" : "wk10-plain"}>
                      {carryIsDraft && (
                        <p className="line1 wk10-draftlabel">
                          <Icon name="edit" size={15} /> {copy.arborDraft}
                        </p>
                      )}
                      <p data-testid="weekly-carry-text" className="nx-q">
                        <span className="sr-only">{t("elev.wk.carry.label")} </span>
                        <bdi dir="auto">{carry}</bdi>
                      </p>
                    </div>
                  ) : (
                    <p data-testid="weekly-carry-text" className="line1 wk10-note">{carryNote}</p>
                  )}
                  <div className="line wk10-carry-moves">
                    {/* AIX-S6 / TODAY-1: the suggestion feeds Today through the
                        EXISTING acceptTodayAction seam with digest provenance,
                        and ONLY for an AI digest. Once taken, an honest
                        done-state replaces the accept. */}
                    {selected?.digest && !awaitingLanguage && selected.digest.generated === "ai" && !!carry && (
                      digestAccepted ? (
                        <span className="wk10-done" role="status">
                          <Icon name="check_circle" size={18} /> {t("wk.todayStepSet")}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { track("recap_try_accept", { week: selected.id }); acceptTodayAction(selected.digest!.tryThisWeek, "standard", "digest"); }}
                          {...ACCEPT_STAMP}
                          data-testid="weekly-accept"
                          className="btn primary sm"
                        >
                          <Icon name="task_alt" size={18} /> {t("today.action.make")}
                        </button>
                      )
                    )}
                    {canWrite && (
                      <button type="button" data-testid="weekly-generate" onClick={() => void generate()} className="ds-link">
                        {t("elev.wk.carry.write")}
                      </button>
                    )}
                    <button
                      type="button"
                      data-testid="weekly-carry-back"
                      onClick={() => setActiveTab("overview")}
                      {...(acceptRendered ? undefined : ACCEPT_STAMP)}
                      className={acceptRendered ? "ds-link" : "btn primary sm"}
                    >
                      {t("elev.wk.carry.back")}
                    </button>
                  </div>
                </div>
              }
            />
          </div>
        </RouteSection>

        <RouteSection id={STOP.day} n={stopNo(STOP.day)} stopTop={2} aria-labelledby="wk-day-title">
          <div data-module="weekly-day">
            <YourDay
              composition={composition}
              copy={copy}
              t={t}
              uiLang={uiLang}
              locale={dateLocale}
              field={field}
              summary={daySummary}
              onHardMoments={() => setActiveTab("behaviors")}
              aside={
                /* B-SHELL-29: the invite (the ONE place a link leaves the app;
                   it carries no child content) stays on Weekly, folded into the
                   page's one collapsed disclosure; demoted, so the budget is
                   unchanged. */
                <details data-module-disclosure="weekly-more" data-testid="weekly-invite-more" className="wk10-invite">
                  <summary className="nx-inv">
                    <span className="gi" aria-hidden="true"><Icon name="favorite" size={18} /></span>
                    <span id="weekly-invite-title">{t("elev.words.invite.title")}</span>
                    <Icon name="expand_more" size={22} className="wk10-invite-chev" />
                  </summary>
                  <div data-module="weekly-invite" data-module-demoted className="wk10-invite-body">
                    <section data-testid="weekly-invite" aria-labelledby="weekly-invite-title">
                      <p className="small">{t("elev.words.invite.sub", { name: first })}</p>
                      <InviteCard />
                    </section>
                  </div>
                </details>
              }
            />
          </div>
        </RouteSection>
      </Route>

      <QuickLogModal open={logOpen} onClose={() => setLogOpen(false)} />
    </DsRoot>
  );
}
