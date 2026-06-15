import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Sprout } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import DailyPlayCard from "../overview/DailyPlayCard";
import { selectDailyPlay, concernDomainsFromLogs, daySeedFor, type ScoredActivity } from "../../playbank/select";
import { bandForAge, PLAY_BANDS } from "../../playbank/content";

/* Grow › Daily Play — the activity library. Today's top picks for this child,
   matched to their band and recently-logged concerns. The single hero pick also
   appears on Today; here the parent can browse a few ideas for the day. */

export default function DailyPlayTab() {
  const { behaviorLogs, childProfile, setChatInput, setActiveTab } = useArbor();
  const { toast } = useToast();
  const firstName = (childProfile.name || "your child").split(" ")[0];
  const bandLabel = PLAY_BANDS.find((b) => b.band === bandForAge(childProfile.age))?.label ?? "this stage";

  const [doneIds, setDoneIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`arbor.play.done.${childProfile.id}`) || "[]"); }
    catch { return []; }
  });

  const picks: ScoredActivity[] = useMemo(() => {
    const concernDomains = concernDomainsFromLogs(
      behaviorLogs.map((l) => ({ behaviorType: l.behaviorType, timestamp: l.timestamp })),
      Date.now()
    );
    return selectDailyPlay({
      ageYears: childProfile.age,
      concernDomains,
      recentlyDoneIds: doneIds,
      daySeed: daySeedFor(Date.now()),
    }, 4);
  }, [behaviorLogs, childProfile.age, childProfile.id, doneIds]);

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
          <Sprout className="w-3.5 h-3.5" /> Daily Play
        </span>
        <h1 className="text-[1.6rem] font-extrabold leading-tight mt-0.5" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
          Play ideas for {firstName}
        </h1>
        <p className="text-sm mt-1.5" style={{ color: "var(--arbor-muted)" }}>
          Matched to {bandLabel.toLowerCase()} and what {firstName} has been working through. Each uses things you already have at home.
        </p>
      </header>

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
