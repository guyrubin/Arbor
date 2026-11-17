import React, { useMemo, useState, useEffect } from "react";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { ReceiptNoteLine, useReceiptNote } from "../ui/Receipt";
import { routeHash } from "../../lib/routes";
import { useHashQuery } from "../../hooks/useHashQuery";
import { DsRoot, Guide, MoreLink, Route, RouteHead, RouteSection, scrollToSection, Token } from "../../design/primitives";
import { Draw, FrameFigure, FrameHead, RailTile, ReadGuide } from "../moments/v10/frame";
import Icon from "../ui/Icon";
import "../moments/mychild.css";
import { useComposition } from "../../design/useComposition";
import { ChainStrip, type ChainNode } from "../together/ChainStrip";
import { PlayDidThere, PlayGames, PlayHandOver, PlayPreview, PlayTogetherIdeas, usePlayStudio } from "../together/PlayStudio";
import { TOGETHER_COPY } from "../together/togetherCopy";
import { useLanguage } from "../../context/LanguageContext";
import DailyPlayCard from "../overview/DailyPlayCard";
import SourceActivities from "../practice/SourceActivities";
import TomorrowTogether from "../practice/TomorrowTogether";
import DailyPlanCard from "../overview/DailyPlanCard";
import CourseCard from "../overview/CourseCard";
import GoalBuilderModal from "../practice/GoalBuilderModal";
import { GoalFocusLine } from "../practice/GoalFocusLine";
import SessionLengthChips from "../practice/SessionLengthChips";
import { selectDailyPlay, concernDomainsFromLogs, daySeedFor, type ScoredActivity, type SessionLength } from "../../playbank/select";
import { recommendCourse, READINESS_COURSES, localizeCourse, courseActivities, type PlayCourse } from "../../playbank/courses";
import { type PlayActivity, bandForAge, localizeActivity, playDomainLabel } from "../../playbank/content";
import { ageYearsFromProfile } from "../../lib/childAge";
import { focusGoal, goalLabel, activeGoalDomains, type ActiveGoal } from "../../practice/goalBuilder";
import { buildDailyPlan, buildGoalObservation, estimateLoggedDayCount, type DailyPlan } from "../../practice/dailyPlan";
import { useChildCollection } from "../../hooks/useChildCollection";
import type { GoalObservation } from "../../practice/dailyPlan";
import type { ChildProfile } from "../../types";
// GP-01: the months-precise age label is THE parent-facing age render.
import { ageLabel } from "../../lib/childAge";
import { ageYearsOf } from "../../lib/age/forChild";

/* Grow › Daily Play — the activity library. Today's top picks for this child,
   matched to their band and recently-logged concerns. The single hero pick also
   appears on Today; here the parent can browse a few ideas for the day. */

/* E6 (age-tuning visibility): every card below is already selected against the
   child's age band — this chip just RENDERS that existing fact ("for age 5").
   Clinical firewall: the age is a plain fact, never a verdict or claim.
   Styling mirrors the existing duration badge chip on DailyPlayCard. */
function AgeChip({ profile }: { profile: ChildProfile }) {
  const { t } = useLanguage();
  // GP-01: the months-precise label ("7 months"), never the whole-years "age 0".
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-bold"
      style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
    >
      {t("elev.growthTruth.agechip.card", { age: ageLabel(profile, t) })}
    </span>
  );
}

/** Together › Play is scoped to one account and one child, as Together was:
 *  nothing renders while hosted auth is unknown, and a new owner or child
 *  remounts the page, so a preview, a pending keep or a late save from the
 *  previous family can never attach to this one. */
export default function DailyPlayTab() {
  const { childProfile } = useArbor();
  const { user, firebaseEnabled, loading } = useAuth();
  if (!childProfile.id || (firebaseEnabled && (loading || !user))) return null;
  const ownerId = firebaseEnabled ? user!.uid : "local-sandbox";
  return <ScopedDailyPlayTab key={JSON.stringify([ownerId, childProfile.id])} />;
}

function ScopedDailyPlayTab() {
  const { behaviorLogs, childProfile, setActiveTab, logPlayCompletion, undoPlayCompletion, seedCoach, actionLoop } = useArbor();
  // B-STATUS-01: a logged play answers with ONE receipt line under the header
  // (where it went: the Journal), never a vanishing success toast. Critic r1:
  // the save is reversible, so the line carries Undo (the tap's own state
  // comes back and the day's log goes, only if this tap wrote it).
  const playReceipt = useReceiptNote();
  const savedToJournal = (done: { id: string; created: boolean }, restore: () => void) => playReceipt.show({
    text: t("elev.growth.play.toast.added", { name: firstName }),
    link: { where: t("nav.tab.journal"), href: `#${routeHash("journal")}`, testId: "play-receipt-open" },
    undo: {
      label: t("elev.loop.notice.undo"),
      testId: "play-receipt-undo",
      onUndo: () => { playReceipt.clear(); undoPlayCompletion(done); restore(); },
    },
  });
  const { t, uiLang } = useLanguage();
  const firstName = (childProfile.name || t("learn.yourChild")).split(" ")[0];

  // CI-28: Goal Builder — Goals chip in the DailyPlay tab header.
  const activeGoals: ActiveGoal[] = childProfile.activeGoals ?? [];
  const goal = focusGoal(activeGoals);
  const displayGoals = useMemo(() => goal ? [goal] : [], [goal]);
  const [goalModalOwner, setGoalModalOwner] = useState<string | null>(null);
  useEffect(() => { setGoalModalOwner(null); }, [childProfile.id]);
  const goalDomains = useMemo(() => activeGoalDomains(displayGoals), [displayGoals]);

  const [doneIds, setDoneIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`arbor.play.done.${childProfile.id}`) || "[]"); }
    catch { return []; }
  });

  // CI-31: session-length chip state — lifted to tab level so all grid cards
  // share the same selection. Persisted per-child, mirrors done-ids pattern.
  const [sessionLength, setSessionLength] = useState<SessionLength>(() => {
    try { return (localStorage.getItem(`arbor.play.sessionLength.${childProfile.id}`) as SessionLength) || "standard"; }
    catch { return "standard"; }
  });

  const handleSessionLength = (v: SessionLength) => {
    setSessionLength(v);
    try { localStorage.setItem(`arbor.play.sessionLength.${childProfile.id}`, v); } catch { /* ignore */ }
  };

  // E6: the child's band — the SAME derivation selectDailyPlay applies to
  // ageYearsOf(childProfile); used only to gate the age chip on course cards so the
  // chip is never rendered on a course outside the child's band (truthful fact).
  // Through the age seam: the legacy whole-year `age` field never moves for a
  // profile whose age was entered as months without a DOB, so the play band
  // stayed on the age the child was at onboarding.
  const childBand = useMemo(() => bandForAge(ageYearsFromProfile(childProfile)), [childProfile]);

  const concernDomains = useMemo(
    () => concernDomainsFromLogs(
      behaviorLogs.map((l) => ({ behaviorType: l.behaviorType, timestamp: l.timestamp })),
      Date.now()
    ),
    [behaviorLogs]
  );

  const picks: ScoredActivity[] = useMemo(
    () => selectDailyPlay({
      ageYears: ageYearsOf(childProfile),
      concernDomains,
      // CI-28: inject goal domains at 1.6x weight.
      goalDomains,
      recentlyDoneIds: doneIds,
      daySeed: daySeedFor(Date.now()),
      // CI-29: pass sanitized interests so themeable activities get the 1.3x boost.
      interests: childProfile.interests,
      // CI-31: filter by the parent's declared session length.
      sessionLength,
      // W2.5: continuation weighting from the parent's own reported outcome.
      lastAction: (() => {
        const last = actionLoop.find((entry) => entry.status === "completed" && entry.outcome);
        return last?.outcome ? { recommendation: last.recommendation, outcome: last.outcome } : undefined;
      })(),
    }, 4),
    [concernDomains, goalDomains, ageYearsOf(childProfile), childProfile.interests, doneIds, sessionLength, actionLoop]
  );

  // Recommended course — matched to the child's top logged concern (the moat).
  const course = useMemo(() => recommendCourse(concernDomains), [concernDomains]);
  const [courseProg, setCourseProg] = useState<Record<string, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem(`arbor.course.${childProfile.id}`) || "{}"); }
    catch { return {}; }
  });
  const doneFor = (courseId: string) => courseProg[courseId] ?? [];
  // B-GROWTH-19 — a course step ticked ON writes the playLogs record (source
  // "course", idempotent per activity per day) and only THEN says so.
  // Un-ticking keeps the log: the play happened; the local map only drives
  // the step UI.
  const toggleFor = (course: PlayCourse) => (activityId: string) => {
    const cur = courseProg[course.id] ?? [];
    const adding = !cur.includes(activityId);
    const updated = { ...courseProg, [course.id]: adding ? [...cur, activityId] : cur.filter((x) => x !== activityId) };
    setCourseProg(updated);
    try { localStorage.setItem(`arbor.course.${childProfile.id}`, JSON.stringify(updated)); } catch { /* ignore */ }
    if (!adding) return;
    const activity = courseActivities(course).find((a) => a.id === activityId);
    if (!activity) return;
    const done = logPlayCompletion(activity, "course", course.id);
    savedToJournal(done, () => {
      setCourseProg(courseProg);
      try { localStorage.setItem(`arbor.course.${childProfile.id}`, JSON.stringify(courseProg)); } catch { /* ignore */ }
    });
  };

  // Readiness tracks — parent-chosen goal courses (school / sibling / sleep).
  const [readinessId, setReadinessId] = useState<string>(READINESS_COURSES[0]?.id);
  const readinessCourse = READINESS_COURSES.find((c) => c.id === readinessId) ?? READINESS_COURSES[0];

  // AIX-S4: seeds go through i18n (seed.*) — an HE parent must see a Hebrew
  // prompt appear in their own chat box, never an English paragraph.
  const coachActivity = (a: PlayActivity) => {
    seedCoach({ prompt: t("seed.play", { title: a.title, name: firstName, domain: a.domain }), source: "daily-play" });
  };

  const markDone = (p: ScoredActivity) => {
    // Dual-write: moat (context/Firestore-synced) + local display state.
    const done = logPlayCompletion(p, "library"); // writes to the moat (synced) — single source of truth
    const wasDone = doneIds.includes(p.activity.id);
    const doneKey = `arbor.play.done.${childProfile.id}`;
    setDoneIds((prev) => prev.includes(p.activity.id) ? prev : [...prev, p.activity.id]);
    try {
      const cur: string[] = JSON.parse(localStorage.getItem(doneKey) || "[]");
      if (!cur.includes(p.activity.id)) {
        localStorage.setItem(doneKey, JSON.stringify([...cur, p.activity.id]));
      }
    } catch { /* ignore */ }
    savedToJournal(done, () => {
      if (wasDone) return;
      setDoneIds((prev) => prev.filter((id) => id !== p.activity.id));
      try {
        const cur: string[] = JSON.parse(localStorage.getItem(doneKey) || "[]");
        localStorage.setItem(doneKey, JSON.stringify(cur.filter((id) => id !== p.activity.id)));
      } catch { /* ignore */ }
    });
  };
  const coach = (p: ScoredActivity) => {
    seedCoach({ prompt: t("seed.play", { title: p.activity.title, name: firstName, domain: p.activity.domain }), source: "daily-play" });
  };

  // ── CI-30: Daily Plan Generator ───────────────────────────────────────────
  // The plan is computed once per daySeed from the same ranked picks already
  // in scope. No new API call, no new selector — reuses rankDailyPlay output.

  // CI-30: goal observations sub-collection — written when parent submits the
  // post-activity observation. arbor-safety COPPA review gates prod deploy
  // (reusing CI-23/CI-24/CI-28 write-path precedent; requiredFix #4).
  const goalObservationsCol = useChildCollection<GoalObservation>(
    childProfile.id,
    "goalObservations",
    { orderByField: "timestamp", orderDir: "desc", max: 50 }
  );

  // Estimate distinct logged days for the sparse-data gate (5+ = personalized).
  const loggedDayCount = useMemo(
    () => estimateLoggedDayCount(behaviorLogs.map((l) => ({ timestamp: l.timestamp }))),
    [behaviorLogs]
  );

  // Build the daily plan from the top-ranked pick.
  const dailyPlan: DailyPlan | null = useMemo(
    () =>
      buildDailyPlan({
        picks,
        activeGoals: displayGoals,
        childName: firstName,
        loggedDayCount,
        nowMs: Date.now(),
        // B-PLAY-25: the why-line is written in the page's language.
        lang: uiLang === "he" ? "he" : "en",
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [picks, displayGoals, firstName, loggedDayCount, uiLang]
  );

  // Whether the plan card has been marked done today (per-child localStorage).
  const [planDone, setPlanDone] = useState(() => {
    try {
      const stored = localStorage.getItem(`arbor.plan.done.${childProfile.id}`);
      if (!stored) return false;
      const { date, activityId } = JSON.parse(stored) as { date: string; activityId: string };
      const today = new Date().toISOString().slice(0, 10);
      return date === today && activityId === dailyPlan?.scoredActivity.activity.id;
    } catch { return false; }
  });

  const handlePlanDid = (plan: DailyPlan) => {
    // B-GROWTH-19: the plan's "We did this" writes the same playLogs record as
    // every other path (it used to write only a device-local flag).
    const done = logPlayCompletion(plan.scoredActivity, "today");
    const wasPlanDone = planDone;
    setPlanDone(true);
    try {
      localStorage.setItem(
        `arbor.plan.done.${childProfile.id}`,
        JSON.stringify({ date: new Date().toISOString().slice(0, 10), activityId: plan.scoredActivity.activity.id })
      );
    } catch { /* ignore */ }
    savedToJournal(done, () => {
      if (wasPlanDone) return;
      setPlanDone(false);
      try { localStorage.removeItem(`arbor.plan.done.${childProfile.id}`); } catch { /* ignore */ }
    });
  };

  const handlePlanCoach = (plan: DailyPlan) => {
    const a = plan.scoredActivity.activity;
    seedCoach({
      prompt: plan.goal
        ? t("seed.play.withGoal", { title: a.title, name: firstName, goal: plan.goal.label })
        : t("seed.play", { title: a.title, name: firstName, domain: a.domain }),
      source: "daily-plan",
    });
  };

  const handlePlanObservation = async (text: string): Promise<void> => {
    if (!dailyPlan) return;
    // COPPA/GDPR: parent-attributed observation — never a progress score or verdict.
    // arbor-safety review gates prod (requiredFix #4).
    const obs = buildGoalObservation({ plan: dailyPlan, observationText: text });
    await goalObservationsCol.upsert(obs);
    playReceipt.show({ text: t("elev.growth.play.toast.recorded", { name: firstName }) });
  };

  // CI-31: DailyPlanCard carries its own session length derived from the plan's
  // defaultSessionLength (weekend=extended, weekday=standard). The parent can
  // override via the chip row; we store it per-child so it persists within a day.
  const [planSessionLength, setPlanSessionLength] = useState<SessionLength>(() => {
    try {
      return (localStorage.getItem(`arbor.plan.duration.${childProfile.id}`) as SessionLength) || (dailyPlan?.defaultSessionLength ?? "standard");
    } catch { return dailyPlan?.defaultSessionLength ?? "standard"; }
  });

  const handlePlanSessionLength = (v: SessionLength) => {
    setPlanSessionLength(v);
    try { localStorage.setItem(`arbor.plan.duration.${childProfile.id}`, v); } catch { /* ignore */ }
  };

  // ── v10.1 composition ─────────────────────────────────────────────────────
  const composition = useComposition();
  const phone = composition === "phone";
  const copy = TOGETHER_COPY[uiLang === "he" ? "he" : "en"];
  const studio = usePlayStudio();
  // #/daily-play?section=games (Routines' "Continue a favorite" with nothing played yet) lands on the games.
  const requestedSection = useHashQuery().get("section");
  useEffect(() => {
    if (requestedSection !== "games" && requestedSection !== "more-ideas") return;
    const id = window.setTimeout(() => scrollToSection(requestedSection), 60);
    return () => window.clearTimeout(id);
  }, [requestedSection]);
  // The chain: your focus or what came up → today's play idea → the games in Kids Studio.
  const pickedBecause = goal ? goalLabel(goal, t)
    : concernDomains.includes(course.domain) ? copy.chainCameUp(playDomainLabel(course.domain, uiLang), firstName)
    : null;
  const chain: ChainNode[] = [
    ...(pickedBecause ? [{ kind: "you" as const, tag: goal ? t("elev.goal.profile.title") : copy.chainPicked, text: pickedBecause }] : []),
    ...(dailyPlan ? [{ kind: "arbor" as const, tag: copy.arborSuggests, text: copy.chainOneIdea }] : []),
    ...(studio.kidAvailable && studio.worlds.length > 0 ? [{ kind: "kid" as const, tag: copy.chainKid(firstName), text: copy.chainPlays }] : []),
  ];
  const stops = [
    { id: "idea", title: copy.stopIdea, sub: copy.stopIdeaSub },
    { id: "handover", title: copy.stopHandOver, sub: copy.stopHandOverSub(firstName) },
    ...(studio.kidAvailable ? [{ id: "games", title: copy.stopGames, sub: copy.stopGamesSub }] : []),
    { id: "courses", title: copy.stopCourses, sub: copy.stopCoursesSub },
  ];
  const n = (id: string) => stops.findIndex((s) => s.id === id) + 1;

  const ideaStation = (
    <section className="tg-stack pl-idea" data-module="play-daily-plan" aria-label={t("plan.card.eyebrow")} style={{ gap: 10, minWidth: 0 }}>
      {/* E6: the age fact is the band figure's sub-line when there is a play idea; the chip stands in without one. */}
      {/* The plan card offers "Choose what you're working on" itself when no focus is set; the line shows the focus once one is. */}
      {(goal || !dailyPlan) && <GoalFocusLine goals={activeGoals} testId="daily-play-goals-edit" onClick={() => setGoalModalOwner(childProfile.id)} />}
      {/* CI-30: the goal-linked play idea — post-activity observation writes to goalObservations (COPPA-reviewed path). */}
      <DailyPlanCard
        plan={dailyPlan}
        noGoal={!goal}
        childName={firstName}
        done={planDone}
        onDid={handlePlanDid}
        onCoach={handlePlanCoach}
        onObservationSubmit={handlePlanObservation}
        // v10.1: one "Time I have today" — the plan card's chips choose the length
        // for today's idea and for the More ideas below it.
        sessionLength={sessionLength}
        onSessionLengthChange={(v) => { handleSessionLength(v); handlePlanSessionLength(v); }}
        ageYears={ageYearsOf(childProfile)}
        onSetGoal={() => setGoalModalOwner(childProfile.id)}
        titleInBand
      />
    </section>
  );
  const ideasRail = <PlayTogetherIdeas studio={studio} onMoreIdeas={() => scrollToSection("more-ideas")} />;
  // V77: the drawn guide replaces the colour key (the same three kinds, one palette).
  const guideTile = (
    <RailTile icon="grid_view" title={copy.howToRead}>
      <ReadGuide
        phone={phone}
        steps={[
          { drawing: Draw.cards(), label: copy.stopIdea },
          { drawing: <><span className="pl-ico pl-game" style={{ width: 18, height: 18, borderRadius: 6 }} /><Icon name="arrow_forward" size={15} className="rtl:-scale-x-100" /><span className="ds-pencil" style={{ padding: "0 4px" }}><Icon name="lock" size={14} /></span></>, label: copy.handOver },
          { drawing: <span className="ax"><i className="tok kid" style={{ left: "20%" }} /><i className="tok kid" style={{ left: "50%" }} /><i className="tok kid" style={{ left: "80%" }} /></span>, label: copy.didThere(firstName) },
        ]}
        keyItems={[
          { mark: <span className="ds-pencil" style={{ padding: "0 6px" }} aria-hidden="true"><Icon name="edit" size={14} /></span>, label: copy.keyIdea },
          ...(studio.kidAvailable ? [{ mark: <Token kind="kid" size="sm" label="" />, label: copy.keyGames }] : []),
          { mark: <Token kind="plan" size="sm" label="" />, label: copy.keyCourse },
        ]}
      />
    </RailTile>
  );
  // Today's play idea in the reader's language (the band's title and minutes).
  const bandIdea = dailyPlan ? localizeActivity(dailyPlan.scoredActivity.activity, uiLang) : null;
  const headerBand = (
    <div className="scene now" style={{ padding: phone ? "16px 14px 14px" : "22px 28px 18px", gap: phone ? 12 : 16 }}>
      <i className="orb" style={{ width: 360, height: 360, right: -170, top: -230, opacity: 0.55 }} />
      {/* V77: the band's hero is today's play idea itself — its title, "We did this" (primary)
          and "Coach me on this", and the minutes; the card below draws neither (each once).
          No idea yet: the library title and its line. */}
      <FrameHead
        phone={phone}
        kicker={copy.playKicker}
        startHere={copy.startHere}
        title={<span id="play-title">{bandIdea ? bandIdea.title : t("play.libTitle", { name: firstName })}</span>}
        sub={bandIdea ? t("plan.card.eyebrow") : t("play.libSubtitle", { name: firstName })}
        action={dailyPlan && (
          <span className="line" style={{ gap: 10, flexWrap: "wrap" }}>
            {!planDone && <button type="button" className="btn primary nowrap min-h-11" data-testid="play-band-did" onClick={() => handlePlanDid(dailyPlan)}><Icon name="check" size={18} />{t("play.did")}</button>}
            <button type="button" className="btn ghost nowrap min-h-11" style={{ background: "var(--card)" }} data-testid="play-band-coach" onClick={() => handlePlanCoach(dailyPlan)}>{t("play.coach")}</button>
          </span>
        )}
        figure={bandIdea && <FrameFigure n={bandIdea.durationMin} unit={copy.minUnit} sub={ageLabel(childProfile, t)} />}
      />
      {/* Size pass: the phone drops the strip; why the idea was picked is one line in the band. */}
      {phone
        ? pickedBecause && <p className="pl-p" dir="auto" style={{ position: "relative" }}><b className="strong">{goal ? t("elev.goal.profile.title") : copy.chainPicked}</b> · {pickedBecause}</p>
        : <ChainStrip nodes={chain} composition={composition} label={copy.chainLabel(firstName)} />}
    </div>
  );

  return (
    <DsRoot composition={composition} className="ds-mychild play-v10" data-testid="play-screen" dir={uiLang === "he" ? "rtl" : "ltr"}>
      <div className="tg-stack" style={{ gap: phone ? 12 : 16 }}>
        <Guide label={copy.onThisPage} mini={phone} stops={stops} />
        <ReceiptNoteLine note={playReceipt.note} testId="play-receipt" />
        <Route composition={composition}>
          {/* 1 · the header band: the page's h1, why today's idea, the chain. */}
          <RouteSection id="idea" n={1} on aria-labelledby="play-title">
            {headerBand}
          </RouteSection>

          {/* 2 · the stage (today's play idea, the hand-over, the gate) and the rail (guide, ideas). */}
          <RouteSection id="handover" n={2}>
            {phone ? (
              <div className="tg-stack" style={{ gap: 12 }}>
                <div className="mcst" style={{ padding: "12px 12px 14px" }}>
                  {ideaStation}
                  <PlayHandOver studio={studio} composition={composition} />
                </div>
                {studio.kidAvailable && <PlayDidThere composition={composition} />}
                {guideTile}
                {ideasRail}
              </div>
            ) : (
              <div className="rowa">
                <div className="stg">
                  <div className="mcst" style={{ flex: 1 }}>
                    {ideaStation}
                    <PlayHandOver studio={studio} composition={composition} />
                  </div>
                </div>
                <div className="rlc" style={{ gap: 14 }}>
                  {guideTile}
                  {ideasRail}
                </div>
              </div>
            )}
            {!phone && studio.kidAvailable && <PlayDidThere composition={composition} />}
          </RouteSection>

          {studio.kidAvailable && (
            <RouteSection id="games" n={n("games")}>
              <PlayGames studio={studio} composition={composition} />
            </RouteSection>
          )}

          <RouteSection id="courses" n={n("courses")}>
            <div className={phone ? "tg-stack" : "g12"} style={phone ? { gap: 12 } : { alignItems: "start" }}>
              <section className="vt pl-course" aria-label={copy.playCourse} style={{ gridColumn: "span 7", borderRadius: 18, gap: 8, padding: phone ? "12px 12px 14px" : "14px 18px 16px", minWidth: 0 }}>
                {/* E6: shown only when the course's bands include this child's band. */}
                {course.bands.includes(childBand) && <AgeChip profile={childProfile} />}
                <CourseCard
                  course={course}
                  childName={firstName}
                  completedIds={doneFor(course.id)}
                  onToggle={toggleFor(course)}
                  onCoach={coachActivity}
                  // Honesty gate (masterplan 3.1): a per-child rationale exists ONLY
                  // when the course's domain actually came from the child's logged
                  // concern domains — recommendCourse's no-signal fallback fails this
                  // check and the card then mounts the bare TrustLink instead.
                  why={concernDomains.includes(course.domain)
                    ? t("course.why", { area: playDomainLabel(course.domain, uiLang), name: firstName })
                    : undefined}
                />
              </section>
              {/* Readiness tracks — goal courses the parent chooses (school / sibling / sleep) */}
              <section data-module="play-readiness" className="vt pl-course" aria-labelledby="play-readiness-title" style={{ gridColumn: "span 5", borderRadius: 18, gap: 8, padding: phone ? "12px 12px 14px" : "14px 18px 16px", minWidth: 0 }}>
                <TomorrowTogether />
                <div>
                  <h2 className="pl-t" id="play-readiness-title" style={{ margin: 0, fontSize: 19 }}>{t("play.readinessTitle")}</h2>
                  <p className="pl-p" style={{ marginTop: 2 }}>{t("play.readinessSubtitle")}</p>
                </div>
                <div role="tablist" aria-label={t("play.readinessTitle")} className="line" style={{ flexWrap: "wrap", gap: 8 }}>
                  {READINESS_COURSES.map((rc) => (
                    <button key={rc.id} type="button" role="tab" aria-selected={rc.id === readinessId} className={rc.id === readinessId ? "pl-chip on" : "pl-chip"} style={{ minHeight: 44, border: 0 }} onClick={() => setReadinessId(rc.id)}>
                      {localizeCourse(rc, uiLang).title}
                    </button>
                  ))}
                </div>
                {/* E6: readiness tracks are parent-chosen — chip only when band-true. */}
                {readinessCourse.bands.includes(childBand) && <AgeChip profile={childProfile} />}
                <CourseCard
                  course={readinessCourse}
                  childName={firstName}
                  completedIds={doneFor(readinessCourse.id)}
                  onToggle={toggleFor(readinessCourse)}
                  onCoach={coachActivity}
                />
                {/* p1-comic-reader: deep-link into the Comic Studio from today's practice. */}
                <MoreLink onClick={() => setActiveTab("comics")}>{t("elev.growth.play.comicCta")}</MoreLink>
              </section>
            </div>
          </RouteSection>

          {/* More ideas: the picks (the route's log-play move), after the courses; the board's guide has four stops, so no number. */}
          <section className="rsec" id="more-ideas" aria-labelledby="play-more-title">
            <div className="tg-stack" style={{ gap: 12 }}>
              <div style={{ paddingInlineStart: phone ? 0 : 8 }}><RouteHead id="play-more-title" title={t("companion.together-view.more-ideas")} sub={copy.moreIdeasSub} /></div>
              {/* CI-31: one selection controls all the idea cards. With a play idea its card
                  carries the chips; without one they stand here. */}
              {!dailyPlan && <SessionLengthChips value={sessionLength} onChange={handleSessionLength} ageYears={ageYearsOf(childProfile)} tapped={true} />}
              <div data-module="play-picks" data-primary-move="log-play" className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                <div className="lg:col-span-2"><SourceActivities /></div>
                {/* Today's play idea is shown once, in its own card above. */}
                {picks.filter((p) => p.activity.id !== dailyPlan?.scoredActivity.activity.id).map((p) => (
                  <div key={p.activity.id}>
                    {/* E6: each pick was selected with ageYearsOf(childProfile) — render the fact. */}
                    <div className="mb-1.5"><AgeChip profile={childProfile} /></div>
                    <DailyPlayCard
                      pick={p}
                      childName={firstName}
                      done={doneIds.includes(p.activity.id)}
                      onDid={markDone}
                      onCoach={coach}
                      concernLabel={p.reason === "concern-match" ? playDomainLabel(p.activity.domain, uiLang, p.activity.id) : undefined}
                      goalLabel={
                        p.reason === "goal-match" && goal?.domainId === p.activity.domain
                          ? goalLabel(goal, t)
                          : undefined
                      }
                      sessionLength={sessionLength}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        </Route>
      </div>

      <PlayPreview studio={studio} />
      {studio.heroStep}
      {/* CI-28: Goal Builder modal — opened from the focus line */}
      {goalModalOwner === childProfile.id && <GoalBuilderModal
        key={childProfile.id}
        open
        childId={childProfile.id}
        onClose={() => setGoalModalOwner(null)}
        childName={firstName}
        behaviorLogs={behaviorLogs}
      />}
    </DsRoot>
  );
}
