import React, { useMemo } from "react";
import { CalendarCheck, Check, Compass, Flame, MessageSquare, Sparkles, Target } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import { SectionCard, cardCls, Chip } from "../ui/kit";
import { PlayShell, PlayHeader } from "../ui/playkit";
import ProgressRing from "../ui/ProgressRing";
import { DOMAIN_META, MISSION_CYCLE, fillTemplate, type MissionTemplate } from "../../practice/content";
import { cycleDayFor } from "../../practice/missionToday";
import { usePracticeData, useCopilot } from "../../practice/usePracticeData";
import { weeklyMissionPlan } from "../../practice/signals";
import type { MissionRecord } from "../../types";
import { track } from "../../lib/analytics";

/**
 * Mission card — one mission from the 5-day rotation. Shared between the full
 * studio (5-day grid + Development Score) and the folded Today loop. Promoted
 * the title to a real <h3> so the Today section keeps a clean heading outline
 * under its section <h2>; hit areas are >=44px for touch.
 */
export function MissionCard({
  m,
  featured,
  done,
  onToggle,
  onCoach,
}: {
  m: MissionTemplate;
  featured?: boolean;
  done: boolean;
  onToggle: (m: MissionTemplate) => void;
  onCoach: (m: MissionTemplate) => void;
}) {
  const vars = useMissionVars();
  const meta = DOMAIN_META[m.domain];
  return (
    <div className={`${cardCls} p-5 space-y-3 relative`} style={featured ? { border: `1px solid ${meta.color}` } : undefined}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2.5">
          <span className="text-2xl" aria-hidden="true">{m.emoji}</span>
          <span>
            <h3 className="block text-sm font-bold" style={{ color: "var(--arbor-ink)" }}>{m.title}</h3>
            <Chip tone={m.domain === "speech" ? "mint" : m.domain === "language" ? "sky" : m.domain === "cognition" ? "lav" : m.domain === "social" ? "yellow" : "pink"}>{meta.label}</Chip>
          </span>
        </span>
        <button
          onClick={() => onToggle(m)}
          aria-pressed={done}
          className="inline-flex items-center justify-center gap-1.5 text-xs font-extrabold px-3.5 min-h-[44px] rounded-xl transition flex-shrink-0 active:scale-[0.98]"
          style={done ? { background: "var(--arbor-clay)", color: "#fff" } : { background: meta.soft, color: meta.color }}
        >
          <Check className="w-3.5 h-3.5" aria-hidden="true" /> {done ? "Done!" : "Mark done"}
        </button>
      </div>
      <ol className="space-y-1.5 text-xs list-decimal list-inside" style={{ color: "var(--arbor-ink)" }}>
        {m.steps.map((s, i) => (
          <li key={i} className="leading-relaxed">{fillTemplate(s, vars)}</li>
        ))}
      </ol>
      <button onClick={() => onCoach(m)} className="inline-flex items-center gap-1 text-[11px] font-bold min-h-[44px] transition" style={{ color: "var(--arbor-muted)" }}>
        <MessageSquare className="w-3 h-3" aria-hidden="true" /> Coach me through this
      </button>
    </div>
  );
}

// Template vars (child first name / age / second language) used to fill mission
// step + coach-prompt placeholders. Hook keeps MissionCard self-contained.
function useMissionVars() {
  const { childProfile } = useArbor();
  return {
    name: childProfile.name.split(" ")[0],
    age: childProfile.age,
    lang: childProfile.languages?.[1],
  };
}

/**
 * Development Missions — Otsimo-style daily skill play, one mission a day on a
 * 5-day rotation, plus the Fitbit-style Development Score. The score measures
 * PRACTICE CONSISTENCY (volume, days, breadth) — never child ability.
 *
 * `variant`:
 *  - "full"  (default): the whole studio — score grid, weekly focus, rotation.
 *    Wrapped in the child playful register (PlayShell/PlayHeader).
 *  - "today": a single focused block for the parent calm register on Today —
 *    today's mission card + streak pill + a quiet link to the weekly rotation.
 *    No PlayShell, no score grid (that density belongs to Development).
 */
export function MissionsPanel({ variant = "full" }: { variant?: "today" | "full" }) {
  const { childProfile, milestones, setChatInput, setActiveTab } = useArbor();
  const { t } = useLanguage();
  const { toast } = useToast();
  const data = usePracticeData(childProfile.id);
  const { recommendation } = useCopilot(milestones, data, childProfile.id);
  const first = childProfile.name.split(" ")[0];
  const vars = { name: first, age: childProfile.age, lang: childProfile.languages?.[1] };

  // Day in the 5-day cycle, anchored to the calendar so the whole family — and
  // the folded card on Today — sees the same mission. Shared helper keeps the
  // Today loop and the full studio in agreement.
  const cycleDay = useMemo(() => cycleDayFor(data.today), [data.today]);

  const todaysMission = MISSION_CYCLE[cycleDay];
  const recommendedMission = MISSION_CYCLE.find((m) => m.id === recommendation.missionId) ?? todaysMission;

  // AVA/closed-loop: this week's focus is generated from {name}'s not-yet-reached
  // milestones, re-weighted by what was practiced last week, and regenerates weekly.
  const weekPlan = useMemo(
    () => weeklyMissionPlan(milestones, data.missions.items, data.today),
    [milestones, data.missions.items, data.today]
  );
  const focusCards = weekPlan.focus
    .map((f) => ({ focus: f, mission: MISSION_CYCLE.find((m) => m.id === f.missionId) }))
    .filter((x): x is { focus: typeof x.focus; mission: MissionTemplate } => !!x.mission);
  const hasMilestoneTargets = weekPlan.focus.some((f) => f.gaps > 0);

  const recordFor = (m: MissionTemplate): MissionRecord | undefined =>
    data.missions.items.find((r) => r.date === data.today && r.missionId === m.id);

  const toggleMission = (m: MissionTemplate) => {
    const existing = recordFor(m);
    const willComplete = !(existing?.completed ?? false);
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
    // Optimistic + fire-and-forget; a save failure must not block the UI. On the
    // Today loop, surface a quiet success/error toast (moat write-back).
    void Promise.resolve(data.missions.upsert(rec))
      .then(() => {
        if (variant === "today" && willComplete) toast(t("ov.mission.toastDone", { name: first }), "success");
      })
      .catch(() => {
        if (variant === "today") toast(t("ov.mission.toastErr"), "error");
      });
    if (rec.completed) track("mission_done", { mission: m.id, domain: m.domain });
  };

  const askCoach = (m: MissionTemplate) => {
    setChatInput(fillTemplate(m.coachPrompt, vars));
    setActiveTab("coach");
  };

  const completedThisWeek = data.missions.items.filter(
    (r) => r.completed && r.date > new Date(new Date(`${data.today}T12:00:00`).getTime() - 7 * 86400000).toISOString().slice(0, 10)
  ).length;

  // ── Today variant: single focused block, parent calm register ──────────────
  if (variant === "today") {
    return (
      <section
        className="rounded-[22px] p-5 md:p-6"
        style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-sm)" }}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: "var(--arbor-green-ink)" }}>
            <Target className="w-3.5 h-3.5" aria-hidden="true" /> {t("ov.mission.title")}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold flex-shrink-0"
            style={{ background: "var(--arbor-peach-soft)", color: "var(--arbor-peach-ink)" }}
            aria-label={t("ov.mission.streakA11y", { n: data.streak })}
          >
            🔥 {data.streak}
          </span>
        </div>
        <MissionCard
          m={todaysMission}
          done={recordFor(todaysMission)?.completed ?? false}
          onToggle={toggleMission}
          onCoach={askCoach}
        />
        <button
          onClick={() => setActiveTab("development")}
          className="inline-flex items-center gap-1.5 text-[13px] font-bold mt-3 min-h-[44px] transition"
          style={{ color: "var(--arbor-green-ink)" }}
        >
          {t("ov.mission.more")} →
        </button>
      </section>
    );
  }

  // ── Full variant: the whole studio (child playful register) ────────────────
  return (
    <PlayShell>
      <PlayHeader
        title={t("prac.missions.title")}
        say={t("prac.missions.sub", { name: first })}
        mood="wave"
      />

      {/* Development Score (feature 7) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${cardCls} p-5 flex items-center gap-4`}>
          <ProgressRing value={data.score} size={72} stroke={7} color="var(--arbor-clay)">
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
          <span className="inline-flex items-center justify-center rounded-2xl flex-shrink-0" style={{ background: "var(--arbor-peach-soft)", width: 56, height: 56 }}>
            <Flame className="w-6 h-6" style={{ color: "var(--arbor-peach-ink)" }} />
          </span>
          <div>
            <p className="text-2xl font-extrabold leading-none" style={{ color: "var(--arbor-ink)" }}>{data.streak}<span className="text-sm font-bold ms-1">day{data.streak === 1 ? "" : "s"}</span></p>
            <p className="text-[11px] mt-1" style={{ color: "var(--arbor-muted)" }}>Practice streak — any completed mission keeps it alive.</p>
          </div>
        </div>
        <div className={`${cardCls} p-5 flex items-center gap-4`}>
          <span className="inline-flex items-center justify-center rounded-2xl flex-shrink-0" style={{ background: "var(--arbor-sky-soft)", width: 56, height: 56 }}>
            <CalendarCheck className="w-6 h-6" style={{ color: "var(--arbor-sky-ink)" }} />
          </span>
          <div>
            <p className="text-2xl font-extrabold leading-none" style={{ color: "var(--arbor-ink)" }}>{completedThisWeek}</p>
            <p className="text-[11px] mt-1" style={{ color: "var(--arbor-muted)" }}>Missions completed in the last 7 days across {data.week.domainsTouched.length || 0} domain{data.week.domainsTouched.length === 1 ? "" : "s"}.</p>
          </div>
        </div>
      </div>

      {/* Closed loop: this week's focus from {name}'s not-yet-reached milestones */}
      {focusCards.length > 0 && (
        <SectionCard
          title={`This week's focus for ${first}`}
          icon={<Target className="w-5 h-5" />}
          tone="lav"
          action={<Chip tone="lav" icon={<Sparkles className="w-3 h-3" />}>{hasMilestoneTargets ? "From milestones" : "Balanced week"}</Chip>}
        >
          <p className="text-[11px] mb-4" style={{ color: "var(--arbor-muted)" }}>
            {hasMilestoneTargets
              ? `Chosen from the milestones ${first} hasn't reached yet, and adjusted by what you practiced last week. It refreshes every week.`
              : `A broad, balanced week while ${first}'s milestones fill in. Check off milestones to make this sharper.`}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {focusCards.map(({ focus, mission }) => {
              const meta = DOMAIN_META[focus.domain];
              return (
                <div key={focus.domain} className="space-y-2">
                  {focus.targetMilestone && (
                    <div className="rounded-xl px-3 py-2 text-[11px] leading-snug" style={{ background: meta.soft, color: "var(--arbor-ink)" }}>
                      <b style={{ color: meta.color }}>Builds toward:</b> {focus.targetMilestone}
                      <span className="block mt-0.5" style={{ color: "var(--arbor-muted)" }}>{focus.reason}</span>
                    </div>
                  )}
                  <MissionCard m={mission} featured done={recordFor(mission)?.completed ?? false} onToggle={toggleMission} onCoach={askCoach} />
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Copilot re-aim (feature 10 hook) */}
      {recommendedMission.id !== todaysMission.id && (
        <div className="rounded-2xl p-4 flex flex-wrap items-center gap-3 text-xs" style={{ background: DOMAIN_META[recommendation.domain].soft }}>
          <Compass className="w-4 h-4 flex-shrink-0" style={{ color: DOMAIN_META[recommendation.domain].color }} />
          <span style={{ color: "var(--arbor-ink)" }}>
            <b>Copilot suggestion:</b> {recommendation.headline.toLowerCase()} — the <b>{recommendedMission.title}</b> mission below is aimed exactly there.
          </span>
          <button onClick={() => setActiveTab("copilot")} className="ms-auto font-extrabold" style={{ color: DOMAIN_META[recommendation.domain].color }}>
            See why →
          </button>
        </div>
      )}

      {/* Today's mission (feature 6) */}
      <SectionCard title="Today's mission" icon={<Target className="w-5 h-5" />} tone="mint"
        action={<Chip tone="mint" icon={<Sparkles className="w-3 h-3" />}>Day {cycleDay + 1} of 5</Chip>}>
        <MissionCard m={todaysMission} featured done={recordFor(todaysMission)?.completed ?? false} onToggle={toggleMission} onCoach={askCoach} />
      </SectionCard>

      {/* Full cycle — do extra missions any day; recommended one highlighted */}
      <SectionCard title="The 5-day rotation" icon={<CalendarCheck className="w-5 h-5" />} tone="sky">
        <p className="text-[11px] mb-4" style={{ color: "var(--arbor-muted)" }}>
          Did today&apos;s already? Any mission can be done any day — breadth across domains is what grows the score.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MISSION_CYCLE.filter((m) => m.id !== todaysMission.id).map((m) => (
            <MissionCard key={m.id} m={m} featured={m.id === recommendedMission.id} done={recordFor(m)?.completed ?? false} onToggle={toggleMission} onCoach={askCoach} />
          ))}
        </div>
      </SectionCard>
    </PlayShell>
  );
}
