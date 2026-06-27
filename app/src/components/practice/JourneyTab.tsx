import React, { useMemo } from "react";
import { motion } from "motion/react";
import { CalendarDays, CheckCircle2, History, Sparkles, Target, Trophy } from "lucide-react";
import { useArbor, type ActiveTab } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { PageHeader, SectionCard, cardCls, Chip } from "../ui/kit";
import { DOMAIN_META, fillTemplate } from "../../practice/content";
import { computeAchievements } from "../../practice/achievements";
import { composeWeek, suggestObjectives } from "../../practice/journey";
import { useCopilot, usePracticeData } from "../../practice/usePracticeData";
import { domainMilestoneCounts } from "../../practice/signals";
import type { JourneyObjective, MissionRecord } from "../../types";
import { track } from "../../lib/analytics";

const TAB_BY_EXTRA: Record<string, ActiveTab> = {
  speech: "speech",
  mimic: "mimic",
  adventures: "adventures",
  stories: "stories",
  feelings: "feelings",
};

export default function JourneyTab() {
  const { childProfile, milestones, setActiveTab } = useArbor();
  const { t } = useLanguage();
  const data = usePracticeData(childProfile.id);
  const copilot = useCopilot(milestones, data, childProfile.id);
  const objectivesCol = useChildCollection<JourneyObjective>(childProfile.id, "journeyObjectives", {
    orderByField: "createdAt",
    orderDir: "desc",
    max: 120,
  });
  const first = childProfile.name.split(" ")[0];
  const month = data.today.slice(0, 7);
  const vars = { name: first, age: childProfile.age, lang: childProfile.languages?.[1] };

  const week = useMemo(
    () => composeWeek(copilot.bands, copilot.recommendation, data.today),
    [copilot.bands, copilot.recommendation, data.today]
  );
  const suggestedObjectives = useMemo(() => suggestObjectives(copilot.bands, month), [copilot.bands, month]);
  const currentObjectives = useMemo(
    () => objectivesCol.items.filter((o) => o.month === month),
    [objectivesCol.items, month]
  );
  const objectives = currentObjectives.length > 0 ? currentObjectives : suggestedObjectives;
  const startedObjectives = currentObjectives.length > 0;

  const achievements = useMemo(
    () => computeAchievements({
      speech: data.speech.items,
      mimic: data.mimic.items,
      missions: data.missions.items,
      adventures: data.adventures.items,
      events: data.events.items,
      stats: data.stats,
      streak: data.streak,
      heroRuns: copilot.heroRunCount,
    }),
    [data.speech.items, data.mimic.items, data.missions.items, data.adventures.items, data.events.items, data.stats, data.streak, copilot.heroRunCount]
  );
  const earnedCount = achievements.filter((a) => a.earned).length;

  const startObjectives = () => {
    suggestedObjectives.forEach((o) => void objectivesCol.upsert(o));
    track("journey_objectives_started", { month });
  };

  const toggleObjective = (obj: JourneyObjective) => {
    void objectivesCol.upsert({
      ...obj,
      done: !obj.done,
      createdAt: obj.createdAt || new Date().toISOString(),
    });
    track("journey_objective_toggled", { domain: obj.domain, done: !obj.done });
  };

  const toggleMission = (missionId: string, domain: MissionRecord["domain"], date: string) => {
    const existing = data.missions.items.find((r) => r.date === date && r.missionId === missionId);
    const rec: MissionRecord = existing
      ? { ...existing, completed: !existing.completed, timestamp: new Date().toISOString() }
      : { id: `${date}-${missionId}`, date, missionId, domain, completed: true, timestamp: new Date().toISOString() };
    void data.missions.upsert(rec);
    track("journey_mission_toggled", { mission: missionId, domain, completed: rec.completed });
  };

  const snapshots = [...copilot.snapshots].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);
  // AP-CF-snapshots: count register for the historical progression — parent-noticed
  // milestones per domain, never the 0–100 `signal`. Fallback for legacy snapshots.
  const domainCounts = useMemo(() => domainMilestoneCounts(milestones), [milestones]);

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader
        eyebrow="Practice Studio"
        title={t("prac.journey.title")}
        subtitle={t("prac.journey.sub", { name: first })}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`${cardCls} p-5`}>
          <p className="text-2xl font-extrabold" style={{ color: "var(--arbor-ink)" }}>{data.score}</p>
          <p className="text-[11px] mt-1" style={{ color: "var(--arbor-muted)" }}>Practice consistency score</p>
        </div>
        <div className={`${cardCls} p-5`}>
          <p className="text-2xl font-extrabold" style={{ color: "var(--arbor-ink)" }}>{data.week.activeDays}</p>
          <p className="text-[11px] mt-1" style={{ color: "var(--arbor-muted)" }}>Active practice days this week</p>
        </div>
        <div className={`${cardCls} p-5`}>
          <p className="text-2xl font-extrabold" style={{ color: "var(--arbor-ink)" }}>{objectives.filter((o) => o.done).length}/{objectives.length}</p>
          <p className="text-[11px] mt-1" style={{ color: "var(--arbor-muted)" }}>Monthly objectives done</p>
        </div>
        <div className={`${cardCls} p-5`}>
          <p className="text-2xl font-extrabold" style={{ color: "var(--arbor-ink)" }}>{earnedCount}/{achievements.length}</p>
          <p className="text-[11px] mt-1" style={{ color: "var(--arbor-muted)" }}>Effort badges earned</p>
        </div>
      </div>

      <SectionCard title="This week" icon={<CalendarDays className="w-5 h-5" />} tone="mint"
        action={<Chip tone="mint">Focus: {DOMAIN_META[copilot.recommendation.domain].label}</Chip>}>
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
          {week.map((day) => {
            const done = data.missions.items.some((r) => r.date === day.date && r.missionId === day.mission.id && r.completed);
            const extraTab = TAB_BY_EXTRA[day.extra.tab];
            return (
              <div key={day.date} className={`${cardCls} p-4 flex flex-col gap-3`} style={day.isToday ? { border: "1px solid rgba(52,178,119,0.55)" } : undefined}>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-extrabold" style={{ color: day.isToday ? "var(--arbor-green-ink)" : "var(--arbor-muted)" }}>{day.weekday}</p>
                    {day.isToday && <Chip tone="mint">Today</Chip>}
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--arbor-muted)" }}>{day.date.slice(5)}</p>
                </div>
                <div>
                  <p className="text-xl">{day.mission.emoji}</p>
                  <p className="text-sm font-extrabold leading-snug mt-1" style={{ color: "var(--arbor-ink)" }}>{day.mission.title}</p>
                  <p className="text-[10.5px] mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{fillTemplate(day.mission.steps[0], vars)}</p>
                </div>
                <button
                  onClick={() => toggleMission(day.mission.id, day.mission.domain, day.date)}
                  className="mt-auto inline-flex items-center justify-center gap-1.5 text-[11px] font-extrabold px-3 py-2 rounded-xl"
                  style={done ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> {done ? "Done" : "Mark done"}
                </button>
                <button
                  onClick={() => setActiveTab(extraTab)}
                  className="text-start rounded-xl p-3 transition"
                  style={{ background: DOMAIN_META[day.mission.domain].soft }}
                >
                  <span className="block text-[10px] font-extrabold uppercase tracking-wide" style={{ color: DOMAIN_META[day.mission.domain].color }}>Aimed extra</span>
                  <span className="block text-[11px] font-extrabold mt-1" style={{ color: "var(--arbor-ink)" }}>{day.extra.title}</span>
                  <span className="block text-[10px] mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{day.extra.detail}</span>
                </button>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title={`${month} objectives`} icon={<Target className="w-5 h-5" />} tone="coral"
        action={!startedObjectives && (
          <button onClick={startObjectives} className="inline-flex items-center gap-2 text-xs font-extrabold px-4 py-2.5 rounded-xl text-white" style={{ background: "var(--arbor-peach-ink)" }}>
            <Sparkles className="w-3.5 h-3.5" /> Start these
          </button>
        )}>
        <p className="text-[11px] mb-4" style={{ color: "var(--arbor-muted)" }}>
          Objectives are suggested from the current weakest and strongest domains. They are coaching targets, not clinical goals.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {objectives.map((obj) => {
            const meta = DOMAIN_META[obj.domain];
            return (
              <button key={obj.id} onClick={() => toggleObjective(obj)} className={`${cardCls} p-4 text-start transition hover:shadow-md`}>
                <span className="inline-flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl inline-flex items-center justify-center" style={{ background: meta.soft, color: meta.color }}>
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                  <Chip tone={obj.domain === "speech" ? "mint" : obj.domain === "language" ? "sky" : obj.domain === "cognition" ? "lav" : obj.domain === "social" ? "yellow" : "pink"}>
                    {meta.label}
                  </Chip>
                </span>
                <span className="block text-sm font-extrabold mt-3" style={{ color: "var(--arbor-ink)" }}>{obj.title}</span>
                <span className="block text-[11px] mt-2" style={{ color: obj.done ? "var(--arbor-green-ink)" : "var(--arbor-muted)" }}>{obj.done ? "Completed" : "Tap to mark complete"}</span>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Achievements" icon={<Trophy className="w-5 h-5" />} tone="yellow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {achievements.map((a) => (
            <div key={a.id} className={`${cardCls} p-4`} style={{ opacity: a.earned ? 1 : 0.58 }}>
              <div className="flex items-start gap-3">
                <span className="text-3xl">{a.emoji}</span>
                <div>
                  <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{a.title}</p>
                  <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{a.detail}</p>
                  <Chip tone={a.earned ? "mint" : "sky"}>{a.earned ? "Earned" : "Not yet"}</Chip>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Historical progression" icon={<History className="w-5 h-5" />} tone="sky">
        {snapshots.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>
            Arbor will keep one weekly snapshot once practice data loads — a count of how many milestones you&apos;ve noticed in each domain. It&apos;s historical context and a conversation starter, never a diagnostic chart.
          </p>
        ) : (
          <div className="space-y-3">
            {snapshots.map((snap) => (
              <div key={snap.id} className={`${cardCls} p-4`}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{snap.id}</p>
                  <span className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>{snap.date}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  {snap.bands.map((b) => {
                    const meta = DOMAIN_META[b.domain];
                    // Count register: persisted parent-noticed counts, with a
                    // current-tally fallback for snapshots written before counts existed.
                    const fallback = domainCounts.get(b.domain);
                    const reached = b.reached ?? fallback?.reached ?? 0;
                    const total = b.total ?? fallback?.total ?? 0;
                    return (
                      <div key={b.domain}>
                        <p className="text-[10px] font-bold mb-1" style={{ color: meta.color }}>{meta.label}</p>
                        <p className="text-[11px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{reached} of {total}</p>
                        <p className="text-[10px]" style={{ color: "var(--arbor-muted)" }}>noticed</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </motion.div>
  );
}
