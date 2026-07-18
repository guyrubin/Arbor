import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import DailyPlayCard from "../overview/DailyPlayCard";
import DailyPlanCard from "../overview/DailyPlanCard";
import CourseCard from "../overview/CourseCard";
import GoalBuilderModal from "../practice/GoalBuilderModal";
import SessionLengthChips from "../practice/SessionLengthChips";
import { selectDailyPlay, concernDomainsFromLogs, daySeedFor, type ScoredActivity, type SessionLength } from "../../playbank/select";
import { recommendCourse, READINESS_COURSES, localizeCourse } from "../../playbank/courses";
import { type PlayActivity, bandForAge, playDomainLabel } from "../../playbank/content";
import { activeGoalDomains, type ActiveGoal } from "../../practice/goalBuilder";
import { buildDailyPlan, buildGoalObservation, estimateLoggedDayCount, type DailyPlan } from "../../practice/dailyPlan";
import { useChildCollection } from "../../hooks/useChildCollection";
import type { GoalObservation } from "../../practice/dailyPlan";

/* Grow › Daily Play — the activity library. Today's top picks for this child,
   matched to their band and recently-logged concerns. The single hero pick also
   appears on Today; here the parent can browse a few ideas for the day. */

/* E6 (age-tuning visibility): every card below is already selected against the
   child's age band — this chip just RENDERS that existing fact ("for age 5").
   Clinical firewall: the age is a plain fact, never a verdict or claim.
   Styling mirrors the existing duration badge chip on DailyPlayCard. */
function AgeChip({ age }: { age: number }) {
  const { t } = useLanguage();
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
    >
      {t("elev.agechips.card", { age })}
    </span>
  );
}

export default function DailyPlayTab() {
  const { behaviorLogs, childProfile, setActiveTab, logPlayCompletion, updateChild, seedCoach } = useArbor();
  const { toast } = useToast();
  const { t, uiLang } = useLanguage();
  const firstName = (childProfile.name || "your child").split(" ")[0];

  // CI-28: Goal Builder — Goals chip in the DailyPlay tab header.
  const activeGoals: ActiveGoal[] = childProfile.activeGoals ?? [];
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const goalDomains = useMemo(() => activeGoalDomains(activeGoals), [activeGoals]);

  const handleSaveGoals = async (goals: ActiveGoal[]) => {
    await updateChild(childProfile.id, { activeGoals: goals });
    toast("Focus set. Daily Play is now matched to what you're working on.", "success");
  };

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
  // childProfile.age; used only to gate the age chip on course cards so the
  // chip is never rendered on a course outside the child's band (truthful fact).
  const childBand = useMemo(() => bandForAge(childProfile.age), [childProfile.age]);

  const concernDomains = useMemo(
    () => concernDomainsFromLogs(
      behaviorLogs.map((l) => ({ behaviorType: l.behaviorType, timestamp: l.timestamp })),
      Date.now()
    ),
    [behaviorLogs]
  );

  const picks: ScoredActivity[] = useMemo(
    () => selectDailyPlay({
      ageYears: childProfile.age,
      concernDomains,
      // CI-28: inject goal domains at 1.6x weight.
      goalDomains,
      recentlyDoneIds: doneIds,
      daySeed: daySeedFor(Date.now()),
      // CI-29: pass sanitized interests so themeable activities get the 1.3x boost.
      interests: childProfile.interests,
      // CI-31: filter by the parent's declared session length.
      sessionLength,
    }, 4),
    [concernDomains, goalDomains, childProfile.age, childProfile.interests, doneIds, sessionLength]
  );

  // Recommended course — matched to the child's top logged concern (the moat).
  const course = useMemo(() => recommendCourse(concernDomains), [concernDomains]);
  const [courseProg, setCourseProg] = useState<Record<string, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem(`arbor.course.${childProfile.id}`) || "{}"); }
    catch { return {}; }
  });
  const doneFor = (courseId: string) => courseProg[courseId] ?? [];
  const toggleFor = (courseId: string) => (activityId: string) => {
    const cur = courseProg[courseId] ?? [];
    const adding = !cur.includes(activityId);
    const updated = { ...courseProg, [courseId]: adding ? [...cur, activityId] : cur.filter((x) => x !== activityId) };
    setCourseProg(updated);
    try { localStorage.setItem(`arbor.course.${childProfile.id}`, JSON.stringify(updated)); } catch { /* ignore */ }
    if (adding) toast(`Nice. Added to ${firstName}'s day.`, "success");
  };

  // Readiness tracks — parent-chosen goal courses (school / sibling / sleep).
  const [readinessId, setReadinessId] = useState<string>(READINESS_COURSES[0]?.id);
  const readinessCourse = READINESS_COURSES.find((c) => c.id === readinessId) ?? READINESS_COURSES[0];

  const coachActivity = (a: PlayActivity) => {
    seedCoach({ prompt: `We're going to try "${a.title}" with ${firstName} today (it builds ${a.domain}). How can I get the most out of it, and what should I watch for?`, source: "daily-play" });
  };

  const markDone = (p: ScoredActivity) => {
    // Dual-write: moat (context/Firestore-synced) + local display state.
    logPlayCompletion(p, "library"); // writes to the moat (synced) — single source of truth
    setDoneIds((prev) => prev.includes(p.activity.id) ? prev : [...prev, p.activity.id]);
    try {
      const cur: string[] = JSON.parse(localStorage.getItem(`arbor.play.done.${childProfile.id}`) || "[]");
      if (!cur.includes(p.activity.id)) {
        localStorage.setItem(`arbor.play.done.${childProfile.id}`, JSON.stringify([...cur, p.activity.id]));
      }
    } catch { /* ignore */ }
    toast(`Nice. Added to ${firstName}'s day.`, "success");
  };
  const coach = (p: ScoredActivity) => {
    seedCoach({ prompt: `We're going to try "${p.activity.title}" with ${firstName} today (it builds ${p.activity.domain}). How can I get the most out of it, and what should I watch for?`, source: "daily-play" });
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
        activeGoals,
        childName: firstName,
        loggedDayCount,
        nowMs: Date.now(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [picks, activeGoals, firstName, loggedDayCount]
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
    setPlanDone(true);
    try {
      localStorage.setItem(
        `arbor.plan.done.${childProfile.id}`,
        JSON.stringify({ date: new Date().toISOString().slice(0, 10), activityId: plan.scoredActivity.activity.id })
      );
    } catch { /* ignore */ }
    toast(`Nice. Added to ${firstName}'s day.`, "success");
  };

  const handlePlanCoach = (plan: DailyPlan) => {
    const goal = plan.goal ? ` working on ${plan.goal.label}` : "";
    seedCoach({
      prompt: `We're going to try "${plan.scoredActivity.activity.title}" with ${firstName} today${goal}. How can I get the most out of it, and what should I watch for?`,
      source: "daily-plan",
    });
  };

  const handlePlanObservation = async (text: string): Promise<void> => {
    if (!dailyPlan) return;
    // COPPA/GDPR: parent-attributed observation — never a progress score or verdict.
    // arbor-safety review gates prod (requiredFix #4).
    const obs = buildGoalObservation({ plan: dailyPlan, observationText: text });
    await goalObservationsCol.upsert(obs);
    toast(`Nice — added to ${firstName}'s record.`, "success");
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
      className="space-y-5 max-w-[1080px]"
    >
      <header>
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: "var(--arbor-green-ink)" }}>
              <Icon name="eco" size={14} /> {t("play.libEyebrow")}
            </span>
            <h1 className="text-[1.6rem] font-extrabold leading-tight mt-0.5" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
              {t("play.libTitle", { name: firstName })}
            </h1>
            <p className="text-sm mt-1.5" style={{ color: "var(--arbor-muted)" }}>
              {t("play.libSubtitle", { name: firstName })}
            </p>
          </div>
          {/* CI-28: Goals chip — persistent entry to Goal Builder */}
          <button
            onClick={() => setGoalModalOpen(true)}
            aria-label={t("aria.manageFocusGoals")}
            className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 min-h-[44px] text-[12.5px] font-bold transition mt-1"
            style={{
              background: activeGoals.length > 0 ? "var(--arbor-green-soft)" : "var(--arbor-paper-elevated)",
              color: activeGoals.length > 0 ? "var(--arbor-green-ink)" : "var(--arbor-muted)",
              border: `1px solid ${activeGoals.length > 0 ? "var(--arbor-primary-border)" : "var(--arbor-rule)"}`,
            }}
          >
            <Icon name="target" size={14} />
            {activeGoals.length > 0 ? `${activeGoals.length} goal${activeGoals.length !== 1 ? "s" : ""} active` : "Set a focus"}
          </button>
        </div>
      </header>

      {/* CI-30: DailyPlanCard hero — goal-linked daily plan, mounts above existing CourseCard.
          No new tab, no new sidebar item, no new tab registration.
          Post-activity observation writes to goalObservations sub-collection (COPPA-reviewed path). */}
      <div className="max-w-[640px]">
        {/* E6: plan comes from the band-matched picks — render the age fact. */}
        {dailyPlan && <div className="mb-1.5"><AgeChip age={childProfile.age} /></div>}
        <DailyPlanCard
          plan={dailyPlan}
          noGoal={activeGoals.length === 0}
          childName={firstName}
          done={planDone}
          onDid={handlePlanDid}
          onCoach={handlePlanCoach}
          onObservationSubmit={handlePlanObservation}
          sessionLength={planSessionLength}
          onSessionLengthChange={handlePlanSessionLength}
          onSetGoal={() => setGoalModalOpen(true)}
        />
      </div>

      <div className="max-w-[640px]">
        {/* E6: shown only when the course's bands include this child's band. */}
        {course.bands.includes(childBand) && <div className="mb-1.5"><AgeChip age={childProfile.age} /></div>}
        <CourseCard
          course={course}
          childName={firstName}
          completedIds={doneFor(course.id)}
          onToggle={toggleFor(course.id)}
          onCoach={coachActivity}
        />
      </div>

      {/* Readiness tracks — goal courses the parent chooses (school / sibling / sleep) */}
      <section className="max-w-[640px]">
        <div className="mb-3">
          <h2 className="text-lg font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("play.readinessTitle")}</h2>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--arbor-muted)" }}>{t("play.readinessSubtitle")}</p>
        </div>
        <div role="tablist" aria-label={t("play.readinessTitle")} className="flex flex-wrap gap-2 mb-3">
          {READINESS_COURSES.map((rc) => {
            const on = rc.id === readinessId;
            return (
              <button
                key={rc.id}
                role="tab"
                aria-selected={on}
                onClick={() => setReadinessId(rc.id)}
                className="rounded-full px-3.5 py-2 text-[12.5px] font-bold whitespace-nowrap transition"
                style={on
                  ? { background: "var(--arbor-primary)", color: "#fff", boxShadow: "var(--shadow-sm)" }
                  : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
              >
                {localizeCourse(rc, uiLang).title}
              </button>
            );
          })}
        </div>
        {/* E6: readiness tracks are parent-chosen — chip only when band-true. */}
        {readinessCourse.bands.includes(childBand) && <div className="mb-1.5"><AgeChip age={childProfile.age} /></div>}
        <CourseCard
          course={readinessCourse}
          childName={firstName}
          completedIds={doneFor(readinessCourse.id)}
          onToggle={toggleFor(readinessCourse.id)}
          onCoach={coachActivity}
        />
      </section>

      {/* CI-31: chip row lifted to tab level — one selection controls all grid cards */}
      <div className="max-w-[640px]">
        <SessionLengthChips
          value={sessionLength}
          onChange={handleSessionLength}
          tapped={true}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {picks.map((p) => (
          <div key={p.activity.id}>
            {/* E6: each pick was selected with childProfile.age — render the fact. */}
            <div className="mb-1.5"><AgeChip age={childProfile.age} /></div>
            <DailyPlayCard
              pick={p}
              childName={firstName}
              done={doneIds.includes(p.activity.id)}
              onDid={markDone}
              onCoach={coach}
              concernLabel={p.reason === "concern-match" ? playDomainLabel(p.activity.domain, uiLang) : undefined}
              goalLabel={
                p.reason === "goal-match"
                  ? activeGoals.find((g) => g.domainId === p.activity.domain)?.label
                  : undefined
              }
              sessionLength={sessionLength}
            />
          </div>
        ))}
      </div>

      {/* p1-comic-reader: deep-link into the Comic Studio from today's practice. */}
      <button
        onClick={() => setActiveTab("comics")}
        className="inline-flex items-center gap-2 text-[13px] font-bold rounded-full px-4 py-2.5"
        style={{ background: "var(--arbor-primary)", color: "#fff", minHeight: 44 }}
      >
        <Icon name="menu_book" size={16} /> Turn today&apos;s practice into a comic →
      </button>

      {/* CI-28: Goal Builder modal — opened via Goals chip in the header */}
      <GoalBuilderModal
        open={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        childName={firstName}
        activeGoals={activeGoals}
        onSave={handleSaveGoals}
        behaviorLogs={behaviorLogs}
      />
    </motion.div>
  );
}
