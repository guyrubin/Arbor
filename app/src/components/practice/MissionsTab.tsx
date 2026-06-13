import React, { useMemo } from "react";
import { motion } from "motion/react";
import { CalendarCheck, Check, Compass, Flame, MessageSquare, Sparkles, Target } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { PageHeader, SectionCard, cardCls, Chip } from "../ui/kit";
import ProgressRing from "../ui/ProgressRing";
import { DOMAIN_META, MISSION_CYCLE, fillTemplate, type MissionTemplate } from "../../practice/content";
import { usePracticeData, useCopilot } from "../../practice/usePracticeData";
import type { MissionRecord } from "../../types";
import { track } from "../../lib/analytics";

/**
 * Development Missions — Otsimo-style daily skill play, one mission a day on a
 * 5-day rotation, plus the Fitbit-style Development Score. The score measures
 * PRACTICE CONSISTENCY (volume, days, breadth) — never child ability.
 */
export default function MissionsTab() {
  const { childProfile, milestones, setChatInput, setActiveTab } = useArbor();
  const data = usePracticeData(childProfile.id);
  const { recommendation } = useCopilot(milestones, data, childProfile.id);
  const first = childProfile.name.split(" ")[0];
  const vars = { name: first, age: childProfile.age, lang: childProfile.languages?.[1] };

  // Day in the 5-day cycle, anchored to the calendar so the whole family sees the same mission.
  const cycleDay = useMemo(() => {
    const d = new Date(`${data.today}T12:00:00`);
    const start = new Date(d.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((d.getTime() - start.getTime()) / 86400000);
    return dayOfYear % MISSION_CYCLE.length;
  }, [data.today]);

  const todaysMission = MISSION_CYCLE[cycleDay];
  const recommendedMission = MISSION_CYCLE.find((m) => m.id === recommendation.missionId) ?? todaysMission;

  const recordFor = (m: MissionTemplate): MissionRecord | undefined =>
    data.missions.items.find((r) => r.date === data.today && r.missionId === m.id);

  const toggleMission = (m: MissionTemplate) => {
    const existing = recordFor(m);
    const rec: MissionRecord = existing
      ? { ...existing, completed: !existing.completed, timestamp: new Date().toISOString() }
      : {
          id: `${data.today}-${m.id}`,
          date: data.today,
          missionId: m.id,
          domain: m.domain,
          completed: true,
          timestamp: new Date().toISOString(),
        };
    void data.missions.upsert(rec);
    if (rec.completed) track("mission_done", { mission: m.id, domain: m.domain });
  };

  const askCoach = (m: MissionTemplate) => {
    setChatInput(fillTemplate(m.coachPrompt, vars));
    setActiveTab("coach");
  };

  const completedThisWeek = data.missions.items.filter(
    (r) => r.completed && r.date > new Date(new Date(`${data.today}T12:00:00`).getTime() - 7 * 86400000).toISOString().slice(0, 10)
  ).length;

  const MissionCard = ({ m, featured }: { m: MissionTemplate; featured?: boolean }) => {
    const meta = DOMAIN_META[m.domain];
    const done = recordFor(m)?.completed ?? false;
    return (
      <div className={`${cardCls} p-5 space-y-3 relative`} style={featured ? { border: `1px solid ${meta.color}` } : undefined}>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2.5">
            <span className="text-2xl">{m.emoji}</span>
            <span>
              <b className="block text-sm" style={{ color: "var(--arbor-ink)" }}>{m.title}</b>
              <Chip tone={m.domain === "speech" ? "mint" : m.domain === "language" ? "sky" : m.domain === "cognition" ? "lav" : m.domain === "social" ? "yellow" : "pink"}>{meta.label}</Chip>
            </span>
          </span>
          <button
            onClick={() => toggleMission(m)}
            aria-pressed={done}
            className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3.5 py-2 rounded-xl transition flex-shrink-0"
            style={done ? { background: "#34b277", color: "#fff" } : { background: meta.soft, color: meta.color }}
          >
            <Check className="w-3.5 h-3.5" /> {done ? "Done!" : "Mark done"}
          </button>
        </div>
        <ol className="space-y-1.5 text-xs list-decimal list-inside" style={{ color: "var(--arbor-ink)" }}>
          {m.steps.map((s, i) => (
            <li key={i} className="leading-relaxed">{fillTemplate(s, vars)}</li>
          ))}
        </ol>
        <button onClick={() => askCoach(m)} className="inline-flex items-center gap-1 text-[11px] font-bold transition" style={{ color: "var(--arbor-muted)" }}>
          <MessageSquare className="w-3 h-3" /> Coach me through this
        </button>
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader
        eyebrow="Practice Studio"
        title="Daily Missions"
        subtitle={`One small mission a day for ${first} — language, feelings, stories, sounds and social play, on a steady 5-day rotation.`}
      />

      {/* Development Score (feature 7) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${cardCls} p-5 flex items-center gap-4`}>
          <ProgressRing value={data.score} size={72} stroke={7} color="#34b277">
            <span className="text-lg font-extrabold" style={{ color: "var(--arbor-ink)" }}>{data.score}</span>
          </ProgressRing>
          <div>
            <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>Development Score</p>
            <p className="text-[11px] leading-snug mt-0.5" style={{ color: "var(--arbor-muted)" }}>
              Measures this week&apos;s <b>practice consistency</b> — volume, days and variety. It says nothing about {first}&apos;s ability.
            </p>
          </div>
        </div>
        <div className={`${cardCls} p-5 flex items-center gap-4`}>
          <span className="inline-flex items-center justify-center rounded-2xl flex-shrink-0" style={{ background: "#fdeada", width: 56, height: 56 }}>
            <Flame className="w-6 h-6" style={{ color: "#cf6f37" }} />
          </span>
          <div>
            <p className="text-2xl font-extrabold leading-none" style={{ color: "var(--arbor-ink)" }}>{data.streak}<span className="text-sm font-bold ml-1">day{data.streak === 1 ? "" : "s"}</span></p>
            <p className="text-[11px] mt-1" style={{ color: "var(--arbor-muted)" }}>Practice streak — any completed mission keeps it alive.</p>
          </div>
        </div>
        <div className={`${cardCls} p-5 flex items-center gap-4`}>
          <span className="inline-flex items-center justify-center rounded-2xl flex-shrink-0" style={{ background: "#e5f0fb", width: 56, height: 56 }}>
            <CalendarCheck className="w-6 h-6" style={{ color: "#2f7bbf" }} />
          </span>
          <div>
            <p className="text-2xl font-extrabold leading-none" style={{ color: "var(--arbor-ink)" }}>{completedThisWeek}</p>
            <p className="text-[11px] mt-1" style={{ color: "var(--arbor-muted)" }}>Missions completed in the last 7 days across {data.week.domainsTouched.length || 0} domain{data.week.domainsTouched.length === 1 ? "" : "s"}.</p>
          </div>
        </div>
      </div>

      {/* Copilot re-aim (feature 10 hook) */}
      {recommendedMission.id !== todaysMission.id && (
        <div className="rounded-2xl p-4 flex flex-wrap items-center gap-3 text-xs" style={{ background: DOMAIN_META[recommendation.domain].soft }}>
          <Compass className="w-4 h-4 flex-shrink-0" style={{ color: DOMAIN_META[recommendation.domain].color }} />
          <span style={{ color: "var(--arbor-ink)" }}>
            <b>Copilot suggestion:</b> {recommendation.headline.toLowerCase()} — the <b>{recommendedMission.title}</b> mission below is aimed exactly there.
          </span>
          <button onClick={() => setActiveTab("copilot")} className="ml-auto font-extrabold" style={{ color: DOMAIN_META[recommendation.domain].color }}>
            See why →
          </button>
        </div>
      )}

      {/* Today's mission (feature 6) */}
      <SectionCard title="Today's mission" icon={<Target className="w-5 h-5" />} tone="mint"
        action={<Chip tone="mint" icon={<Sparkles className="w-3 h-3" />}>Day {cycleDay + 1} of 5</Chip>}>
        <MissionCard m={todaysMission} featured />
      </SectionCard>

      {/* Full cycle — do extra missions any day; recommended one highlighted */}
      <SectionCard title="The 5-day rotation" icon={<CalendarCheck className="w-5 h-5" />} tone="sky">
        <p className="text-[11px] mb-4" style={{ color: "var(--arbor-muted)" }}>
          Did today&apos;s already? Any mission can be done any day — breadth across domains is what grows the score.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MISSION_CYCLE.filter((m) => m.id !== todaysMission.id).map((m) => (
            <MissionCard key={m.id} m={m} featured={m.id === recommendedMission.id} />
          ))}
        </div>
      </SectionCard>
    </motion.div>
  );
}
