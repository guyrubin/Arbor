import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Sprout } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import DailyPlayCard from "../overview/DailyPlayCard";
import CourseCard from "../overview/CourseCard";
import { selectDailyPlay, concernDomainsFromLogs, daySeedFor, type ScoredActivity } from "../../playbank/select";
import { recommendCourse } from "../../playbank/courses";
import { type PlayActivity } from "../../playbank/content";

/* Grow › Daily Play — the activity library. Today's top picks for this child,
   matched to their band and recently-logged concerns. The single hero pick also
   appears on Today; here the parent can browse a few ideas for the day. */

export default function DailyPlayTab() {
  const { behaviorLogs, childProfile, setChatInput, setActiveTab } = useArbor();
  const { toast } = useToast();
  const { t } = useLanguage();
  const firstName = (childProfile.name || "your child").split(" ")[0];

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
      recentlyDoneIds: doneIds,
      daySeed: daySeedFor(Date.now()),
    }, 4),
    [concernDomains, childProfile.age, doneIds]
  );

  // Recommended course — matched to the child's top logged concern (the moat).
  const course = useMemo(() => recommendCourse(concernDomains), [concernDomains]);
  const [courseProg, setCourseProg] = useState<Record<string, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem(`arbor.course.${childProfile.id}`) || "{}"); }
    catch { return {}; }
  });
  const courseDone = courseProg[course.id] ?? [];
  const toggleCourseActivity = (activityId: string) => {
    const cur = courseProg[course.id] ?? [];
    const adding = !cur.includes(activityId);
    const updated = { ...courseProg, [course.id]: adding ? [...cur, activityId] : cur.filter((x) => x !== activityId) };
    setCourseProg(updated);
    try { localStorage.setItem(`arbor.course.${childProfile.id}`, JSON.stringify(updated)); } catch { /* ignore */ }
    if (adding) toast(`Nice. Added to ${firstName}'s day.`, "success");
  };
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
        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: "var(--arbor-green-ink)" }}>
          <Sprout className="w-3.5 h-3.5" /> {t("play.libEyebrow")}
        </span>
        <h1 className="text-[1.6rem] font-extrabold leading-tight mt-0.5" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
          {t("play.libTitle", { name: firstName })}
        </h1>
        <p className="text-sm mt-1.5" style={{ color: "var(--arbor-muted)" }}>
          {t("play.libSubtitle", { name: firstName })}
        </p>
      </header>

      <div className="max-w-[640px]">
        <CourseCard
          course={course}
          childName={firstName}
          completedIds={courseDone}
          onToggle={toggleCourseActivity}
          onCoach={coachActivity}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {picks.map((p) => (
          <DailyPlayCard
            key={p.activity.id}
            pick={p}
            childName={firstName}
            done={doneIds.includes(p.activity.id)}
            onDid={markDone}
            onCoach={coach}
          />
        ))}
      </div>
    </motion.div>
  );
}
