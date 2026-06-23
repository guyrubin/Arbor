import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Sprout, Target } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import DailyPlayCard from "../overview/DailyPlayCard";
import CourseCard from "../overview/CourseCard";
import GoalBuilderModal from "../practice/GoalBuilderModal";
import { selectDailyPlay, concernDomainsFromLogs, daySeedFor, type ScoredActivity } from "../../playbank/select";
import { recommendCourse, READINESS_COURSES, localizeCourse } from "../../playbank/courses";
import { type PlayActivity } from "../../playbank/content";
import { activeGoalDomains, type ActiveGoal } from "../../practice/goalBuilder";

/* Grow › Daily Play — the activity library. Today's top picks for this child,
   matched to their band and recently-logged concerns. The single hero pick also
   appears on Today; here the parent can browse a few ideas for the day. */

export default function DailyPlayTab() {
  const { behaviorLogs, childProfile, setChatInput, setActiveTab, updateChild } = useArbor();
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
    }, 4),
    [concernDomains, goalDomains, childProfile.age, doneIds]
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
    setChatInput(`We're going to try "${a.title}" with ${firstName} today (it builds ${a.domain}). How can I get the most out of it, and what should I watch for?`);
    setActiveTab("coach");
  };

  const markDone = (p: ScoredActivity) => {
    setDoneIds((prev) => {
      const next = prev.includes(p.activity.id) ? prev : [p.activity.id, ...prev].slice(0, 30);
      try { localStorage.setItem(`arbor.play.done.${childProfile.id}`, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    toast(`Nice. Added to ${firstName}'s day.`, "success");
  };
  const coach = (p: ScoredActivity) => {
    setChatInput(`We're going to try "${p.activity.title}" with ${firstName} today (it builds ${p.activity.domain}). How can I get the most out of it, and what should I watch for?`);
    setActiveTab("coach");
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
              <Sprout className="w-3.5 h-3.5" /> {t("play.libEyebrow")}
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
            aria-label="Manage focus goals"
            className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] font-bold transition mt-1"
            style={{
              background: activeGoals.length > 0 ? "var(--arbor-green-soft)" : "var(--arbor-paper-elevated)",
              color: activeGoals.length > 0 ? "var(--arbor-green-ink)" : "var(--arbor-muted)",
              border: `1px solid ${activeGoals.length > 0 ? "rgba(52,178,119,0.35)" : "var(--arbor-rule)"}`,
            }}
          >
            <Target className="w-3.5 h-3.5" />
            {activeGoals.length > 0 ? `${activeGoals.length} goal${activeGoals.length !== 1 ? "s" : ""} active` : "Set a focus"}
          </button>
        </div>
      </header>

      <div className="max-w-[640px]">
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
                  ? { background: "var(--arbor-clay)", color: "#fff", boxShadow: "var(--shadow-sm)" }
                  : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
              >
                {localizeCourse(rc, uiLang).title}
              </button>
            );
          })}
        </div>
        <CourseCard
          course={readinessCourse}
          childName={firstName}
          completedIds={doneFor(readinessCourse.id)}
          onToggle={toggleFor(readinessCourse.id)}
          onCoach={coachActivity}
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {picks.map((p) => (
          <DailyPlayCard
            key={p.activity.id}
            pick={p}
            childName={firstName}
            done={doneIds.includes(p.activity.id)}
            onDid={markDone}
            onCoach={coach}
            goalLabel={
              p.reason === "goal-match"
                ? activeGoals.find((g) => g.domainId === p.activity.domain)?.label
                : undefined
            }
          />
        ))}
      </div>

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
