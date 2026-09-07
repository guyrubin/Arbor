import React, { useMemo } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor, type ActiveTab } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { PageHeader, SectionCard, cardCls, Chip } from "../ui/kit";
import { DOMAIN_META, fillTemplate } from "../../practice/content";
import { computeAchievements } from "../../practice/achievements";
import { aimDomains, composeWeek, suggestObjectives } from "../../practice/journey";
import { aimVirtues, loadCharter } from "../../lib/becoming";
import { useCopilot, usePracticeData } from "../../practice/usePracticeData";
import { domainMilestoneCounts } from "../../practice/signals";
// GP-08: the age window every other count on the parent side uses.
import { ageWindowMilestones, comparisonAgeMonths } from "../../lib/milestoneData";
import { ageMonthsFromProfile } from "../../lib/childAge";
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
  // KID-17: objectives follow the family's Charter aims (HeroJourneyTab
  // pattern), never the child's weakest signal.
  const suggestedObjectives = useMemo(
    () => suggestObjectives(copilot.bands, month, aimDomains(aimVirtues(loadCharter()))),
    [copilot.bands, month],
  );
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
      // KID-6: monotonic distinct-day count — never the loss-framed streak.
      daysPracticed: data.daysPracticed,
      heroRuns: copilot.heroRunCount,
    }),
    [data.speech.items, data.mimic.items, data.missions.items, data.adventures.items, data.events.items, data.stats, data.daysPracticed, copilot.heroRunCount]
  );
  const earnedAchievements = useMemo(() => achievements.filter((a) => a.earned), [achievements]);
  const earnedCount = earnedAchievements.length;

  const missionsDone = data.missions.items.filter((m) => m.completed).length;
  const objectivesDone = objectives.filter((o) => o.done).length;
  // Every number in the stat row is zero — nothing has happened yet.
  const statsAreEmpty = missionsDone === 0 && data.week.activeDays === 0 && objectivesDone === 0 && earnedCount === 0;

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
  // milestones per domain, never the 0–100 `signal`.
  //
  // GP-08 residue: the denominator came from the WHOLE 0–6y catalogue, so a
  // three-year-old's parent read "0 of 38" — 38 milestones most of which are
  // not this child's age to reach. The window (current CDC band + one earlier)
  // is the same one Growth, Milestones, the Full Picture and the Copilot's own
  // live cards already use. The snapshot's own `reached` is kept — it is the
  // parent's noticed count on that date and the only genuinely historical part
  // of the row — and clamped to the window it is now counted against.
  const domainCounts = useMemo(() => {
    const chronoMonths = ageMonthsFromProfile(childProfile) ?? Math.round((childProfile.age || 0) * 12);
    const inWindow = ageWindowMilestones(milestones, comparisonAgeMonths(chronoMonths, childProfile.preterm?.gestationalWeeks));
    return domainMilestoneCounts(inWindow);
  }, [milestones, childProfile]);

  // KID-17 / law 1: the family's OWN charter aims — never a reading of the
  // child. `recommend()` is charter-aimed since Builder A, but a bare
  // "Focus: {domain}" chip with no why-line reads as a pointer at a weakest
  // area whatever produced it. The chip now names the aim the family chose,
  // and renders only when they have chosen one.
  const aims = useMemo(() => aimDomains(aimVirtues(loadCharter())), []);

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader
        eyebrow="Practice Studio"
        title={t("prac.journey.title")}
        subtitle={t("prac.journey.sub", { name: first })}
      />

      {/* RUN-08: on day 0 all four cards read 0 — a wall of zeros that teaches
          nothing and reads as a report card the family has already failed. One
          teach line instead, naming the single move that starts the record.
          The cards return the moment any of them has something to count. */}
      {statsAreEmpty ? (
        <div className={`${cardCls} p-5`} data-testid="journey-zero-teach">
          <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
            {t("elev.growth.journey.zeroTeach")}
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* KID-17: counts, never a 0–100 score that grades the parent. */}
        <div className={`${cardCls} p-5`}>
          <p className="text-2xl font-extrabold" style={{ color: "var(--arbor-ink)" }}>{missionsDone}</p>
          <p className="text-[11px] mt-1" style={{ color: "var(--arbor-muted)" }}>{t("elev.practice.journey.missionsDone")}</p>
        </div>
        <div className={`${cardCls} p-5`}>
          <p className="text-2xl font-extrabold" style={{ color: "var(--arbor-ink)" }}>{data.week.activeDays}</p>
          <p className="text-[11px] mt-1" style={{ color: "var(--arbor-muted)" }}>Active practice days this week</p>
        </div>
        <div className={`${cardCls} p-5`}>
          <p className="text-2xl font-extrabold" style={{ color: "var(--arbor-ink)" }}>{objectivesDone}/{objectives.length}</p>
          <p className="text-[11px] mt-1" style={{ color: "var(--arbor-muted)" }}>Monthly objectives done</p>
        </div>
        <div className={`${cardCls} p-5`}>
          <p className="text-2xl font-extrabold" style={{ color: "var(--arbor-ink)" }}>{earnedCount}/{achievements.length}</p>
          <p className="text-[11px] mt-1" style={{ color: "var(--arbor-muted)" }}>Effort badges earned</p>
        </div>
      </div>
      )}

      <SectionCard title="This week" icon={<Icon name="calendar_month" size={20} />} tone="mint"
        action={aims.length > 0
          ? <Chip tone="mint">{t("elev.growth.journey.aim", { domain: DOMAIN_META[aims[0]].label })}</Chip>
          : undefined}>
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
          {week.map((day) => {
            const done = data.missions.items.some((r) => r.date === day.date && r.missionId === day.mission.id && r.completed);
            const extraTab = TAB_BY_EXTRA[day.extra.tab];
            return (
              <div key={day.date} className={`${cardCls} p-4 flex flex-col gap-3`} style={day.isToday ? { border: "1px solid var(--arbor-green-ink)" } : undefined}>
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
                  className="mt-auto inline-flex min-h-11 items-center justify-center gap-1.5 text-[11px] font-extrabold px-3 py-2 rounded-xl"
                  style={done ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}
                >
                  <Icon name="check_circle" size={14} /> {done ? "Done" : "Mark done"}
                </button>
                <button
                  onClick={() => setActiveTab(extraTab)}
                  className="text-start min-h-11 rounded-xl p-3 transition"
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

      <SectionCard title={`${month} objectives`} icon={<Icon name="target" size={20} />} tone="coral"
        action={!startedObjectives && (
          <button onClick={startObjectives} className="inline-flex min-h-11 items-center gap-2 text-xs font-extrabold px-4 py-2.5 rounded-xl text-white" style={{ background: "var(--arbor-peach-ink)" }}>
            <Icon name="auto_awesome" size={14} /> Start these
          </button>
        )}>
        <p className="text-[11px] mb-4" style={{ color: "var(--arbor-muted)" }}>
          Objectives focus on the areas your current goals point to — coaching targets, not clinical goals.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {objectives.map((obj) => {
            const meta = DOMAIN_META[obj.domain];
            return (
              <button key={obj.id} onClick={() => toggleObjective(obj)} className={`${cardCls} min-h-11 p-4 text-start transition hover:shadow-md`}>
                <span className="inline-flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl inline-flex items-center justify-center" style={{ background: meta.soft, color: meta.color }}>
                    <Icon name="check_circle" size={16} />
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

      <SectionCard title="Achievements" icon={<Icon name="trophy" size={20} />} tone="yellow">
        {/* OBJ-KID-02 (law 3): the twelve unearned badges used to render at
            opacity 0.58 — a greyed silhouette wall with its requirement showing,
            i.e. pressure mechanics on the parent door. Earned badges render at
            full opacity; the rest are a COUNT, not a wall. */}
        <p className="text-[11px] mb-3" style={{ color: "var(--arbor-muted)" }}>
          {t("elev.practice.journey.badgesEarned", { n: earnedCount, total: achievements.length })}
        </p>
        {earnedAchievements.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {earnedAchievements.map((a) => (
              <div key={a.id} className={`${cardCls} p-4`}>
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{a.emoji}</span>
                  <div>
                    <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{a.title}</p>
                    <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{a.detail}</p>
                    <Chip tone="mint">{t("elev.practice.journey.earned")}</Chip>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Historical progression" icon={<Icon name="history" size={20} />} tone="sky">
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
                    // GP-08: the denominator is the child's age window, never the
                    // whole catalogue. A domain with nothing in the window is not
                    // rendered at all — "0 of 0" is not a fact about a child.
                    const windowed = domainCounts.get(b.domain);
                    const total = windowed?.total ?? 0;
                    if (total === 0) return null;
                    const reached = Math.min(b.reached ?? windowed?.reached ?? 0, total);
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
