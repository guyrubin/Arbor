import React, { useMemo } from "react";
import { motion } from "motion/react";
import {
  UserCircle, CheckCircle2, Activity, Languages, Gem, Sprout, ArrowRight, Sparkles,
  BookMarked, Waypoints, ClipboardCheck, Sliders,
} from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { PageHeader, SectionCard, Chip, IconBadge, cardCls, PASTEL } from "../ui/kit";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Child Intelligence › Development Profile — ONE scrolling narrative ("My Child"
 * unification). Instead of sending the parent into seven sibling tabs, this page
 * tells the child's whole story top-to-bottom — who they are, what's happening
 * now, milestones, strengths, language, what Arbor remembers, and the next step
 * — with each chapter linking into its full tool.
 */
export default function ChildProfile() {
  const {
    childProfile, milestones, milestonesPercent, checkedMilestones, totalMilestones,
    behaviorLogs, actionPlans, approvedMemoryItems, pendingMemoryItems, setActiveTab,
  } = useArbor();
  const first = childProfile.name.split(" ")[0];

  // Chapter 2 — what this week actually looked like, from the real log.
  const week = useMemo(() => {
    const cutoff = Date.now() - 7 * DAY_MS;
    const recent = behaviorLogs.filter((l) => new Date(l.timestamp).getTime() >= cutoff);
    const avg = recent.length ? recent.reduce((s, l) => s + l.intensity, 0) / recent.length : null;
    return { count: recent.length, avg, latest: recent[0] ?? null, resolved: recent.filter((l) => l.resolved).length };
  }, [behaviorLogs]);

  // Chapter 3 — the next milestones worth watching for this age.
  const nextMilestones = useMemo(() => milestones.filter((m) => !m.checked).slice(0, 3), [milestones]);

  // Chapter 7 — the live plan, if one exists.
  const activePlan = actionPlans[0] ?? null;
  const planProgress = useMemo(() => {
    if (!activePlan) return null;
    let done = 0, total = 0;
    activePlan.phases.forEach((ph) => ph.steps.forEach((s) => { total += 1; if (s.completed) done += 1; }));
    return { done, total };
  }, [activePlan]);

  // Derive the current developmental focus from the child's real profile.
  const challengeText = childProfile.challenges.join(" ");
  const focus = [
    childProfile.languages.length > 1 && { label: "Language Transition", tone: "sky" as const },
    /anx|regulat|meltdown|emotion|sensory/i.test(challengeText) && { label: "Emotional Regulation", tone: "coral" as const },
    /school|kindergarten|class/i.test(childProfile.schoolContext) && { label: "School Readiness", tone: "mint" as const },
  ].filter(Boolean) as { label: string; tone: "sky" | "coral" | "mint" }[];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader
        eyebrow="My Child"
        title={`${first}'s development profile`}
        subtitle={`${first}'s whole story in one place — patterns, milestones, strengths, language, and what Arbor remembers.`}
        action={
          <button onClick={() => setActiveTab("coach")} className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3" style={{ background: "linear-gradient(135deg,#3cc081,#34b277 60%,#2a9c66)", boxShadow: "0 8px 20px rgba(52,178,119,0.28)" }}>
            <Sparkles className="w-4 h-4" /> Ask Arbor about {first}
          </button>
        }
      />

      {/* Chapter 1 — who {first} is */}
      <SectionCard title={`${first}, age ${childProfile.age}`} icon={<UserCircle className="w-5 h-5" />} tone="mint">
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <Field label="Languages" value={childProfile.languages.join(" · ") || "—"} />
          <Field label="School context" value={childProfile.schoolContext || "—"} />
          <Field label="Risk level" value={childProfile.riskLevel} />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--arbor-muted)" }}>Current developmental focus</p>
            <div className="flex flex-wrap gap-1.5">
              {focus.length > 0 ? focus.map((f) => <Chip key={f.label} tone={f.tone}>{f.label}</Chip>) : <span className="text-sm" style={{ color: "var(--arbor-muted)" }}>Exploring — add a challenge to focus Arbor.</span>}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Chapter 2 — right now: this week's real moments */}
      <SectionCard title="Right now" icon={<Activity className="w-5 h-5" />} tone="coral">
        {week.count > 0 ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
              {week.count} moment{week.count === 1 ? "" : "s"} logged this week
              {week.avg !== null && <> · average intensity <strong>{week.avg.toFixed(1)}/5</strong></>}
              {week.resolved > 0 && <> · {week.resolved} marked resolved</>}.
            </p>
            {week.latest && (
              <div className={`${cardCls} p-3.5 text-sm`}>
                <span className="text-[10px] uppercase font-extrabold tracking-wider" style={{ color: "var(--arbor-muted)" }}>Most recent</span>
                <p className="mt-1 font-semibold" style={{ color: "var(--arbor-ink)" }}>{week.latest.behaviorType}</p>
                {week.latest.trigger && <p className="text-xs mt-0.5" style={{ color: "var(--arbor-muted)" }}>Trigger: {week.latest.trigger}</p>}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>No moments logged in the past week. A 20-second note after a hard (or great!) moment keeps {first}'s story sharp.</p>
        )}
        <div className="flex flex-wrap gap-3 mt-3">
          <JumpLink onClick={() => setActiveTab("behaviors")} color="#cf6f37">Open Moments</JumpLink>
          <JumpLink onClick={() => setActiveTab("timeline")} color="#cf6f37">See {first}'s Story timeline</JumpLink>
        </div>
      </SectionCard>

      {/* Chapter 3 — milestones */}
      <SectionCard title="Development milestones" icon={<CheckCircle2 className="w-5 h-5" />} tone="mint">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--arbor-paper-deep)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${milestonesPercent}%`, background: "linear-gradient(90deg,#3cc081,#2a9c66)" }} />
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--arbor-muted)" }}>
              <strong style={{ color: "var(--arbor-ink)" }}>{checkedMilestones} of {totalMilestones}</strong> reached ({milestonesPercent}%) for age {childProfile.age}.
            </p>
          </div>
        </div>
        {nextMilestones.length > 0 && (
          <div className="mt-3 space-y-2">
            <span className="text-[10px] uppercase font-extrabold tracking-wider" style={{ color: "var(--arbor-muted)" }}>Worth watching next</span>
            <ul className="space-y-1.5 text-sm" style={{ color: "var(--arbor-ink)" }}>
              {nextMilestones.map((m) => (
                <li key={m.id} className="flex items-start gap-2">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#34b277" }} /> {m.title}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap gap-3 mt-3">
          <JumpLink onClick={() => setActiveTab("milestones")} color="#1f8a5a">Review all milestones</JumpLink>
          <JumpLink onClick={() => setActiveTab("screening")} color="#1f8a5a">Run a development check</JumpLink>
        </div>
      </SectionCard>

      {/* Chapter 4 — strengths & where to support */}
      <div className="grid lg:grid-cols-2 gap-4">
        <SectionCard title="Strengths" icon={<Gem className="w-5 h-5" />} tone="mint">
          <ul className="space-y-3">
            {childProfile.strengths.map((s) => (
              <li key={s} className="flex items-start gap-3">
                <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#34b277" }} />
                <span className="text-sm" style={{ color: "var(--arbor-ink)" }}>{s}</span>
              </li>
            ))}
            {childProfile.strengths.length === 0 && <li className="text-sm" style={{ color: "var(--arbor-muted)" }}>Add strengths in the profile editor.</li>}
          </ul>
        </SectionCard>
        <SectionCard title="Where to support" icon={<Sprout className="w-5 h-5" />} tone="coral">
          <ul className="space-y-3">
            {childProfile.challenges.map((c) => (
              <li key={c} className={`${cardCls} p-3.5 flex items-start justify-between gap-3`}>
                <span className="text-sm" style={{ color: "var(--arbor-ink)" }}>{c}</span>
                <button onClick={() => setActiveTab("plans")} className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold" style={{ color: "#cf6f37" }}>
                  Build a plan <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
            {childProfile.challenges.length === 0 && <li className="text-sm" style={{ color: "var(--arbor-muted)" }}>Add challenges in the profile editor.</li>}
          </ul>
        </SectionCard>
      </div>

      {/* Chapter 5 — language & communication */}
      <SectionCard title="Language & communication" icon={<Languages className="w-5 h-5" />} tone="sky">
        <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
          {childProfile.languages.length > 1
            ? `${first} is growing up with ${childProfile.languages.join(" and ")} — a real developmental asset that can look like a delay during the transition. The Language Lab tracks both languages so progress is never miscounted.`
            : `${first}'s home language is ${childProfile.languages[0] || "not set"}. Track expressive and receptive growth in the Language Lab.`}
        </p>
        <div className="mt-3"><JumpLink onClick={() => setActiveTab("language")} color="#2d7eb5">Open Language Lab</JumpLink></div>
      </SectionCard>

      {/* Chapter 6 — what Arbor remembers (the parent-approved memory) */}
      <SectionCard title="What Arbor remembers" icon={<BookMarked className="w-5 h-5" />} tone="lav">
        {approvedMemoryItems.length > 0 ? (
          <ul className="space-y-1.5 text-sm" style={{ color: "var(--arbor-ink)" }}>
            {approvedMemoryItems.slice(0, 5).map((m) => (
              <li key={m.memoryId} className="flex items-start gap-2">
                <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#6354c4" }} /> {m.fact}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>
            Nothing approved yet. When you chat with Arbor, it proposes durable facts about {first} — you approve what it may remember.
          </p>
        )}
        {pendingMemoryItems.length > 0 && (
          <p className="text-xs mt-2 font-bold" style={{ color: "#6354c4" }}>{pendingMemoryItems.length} proposal{pendingMemoryItems.length === 1 ? "" : "s"} waiting for your review.</p>
        )}
        <div className="mt-3"><JumpLink onClick={() => setActiveTab("memory")} color="#6354c4">Review {first}'s memory</JumpLink></div>
      </SectionCard>

      {/* Chapter 7 — the next step */}
      <SectionCard title="The next step" icon={activePlan ? <Sliders className="w-5 h-5" /> : <ClipboardCheck className="w-5 h-5" />} tone="yellow">
        {activePlan && planProgress ? (
          <>
            <p className="text-sm" style={{ color: "var(--arbor-ink)" }}>
              Active plan: <strong>{activePlan.title}</strong> — {planProgress.done} of {planProgress.total} steps done.
            </p>
            <div className="mt-3"><JumpLink onClick={() => setActiveTab("plans")} color="#a9780f">Continue the plan</JumpLink></div>
          </>
        ) : (
          <>
            <p className="text-sm" style={{ color: "var(--arbor-ink)" }}>
              No active growth plan. Turn {first}'s current focus into a step-by-step plan with scripts you can use today.
            </p>
            <div className="mt-3"><JumpLink onClick={() => setActiveTab("plans")} color="#a9780f">Create a growth plan</JumpLink></div>
          </>
        )}
      </SectionCard>

      {/* Footer jump strip — the deep tools, one tap away */}
      <div className="grid sm:grid-cols-3 gap-3">
        {([
          { tab: "timeline" as const, tone: "sky" as const, icon: <Waypoints className="w-4 h-4" />, label: `${first}'s Story` },
          { tab: "behaviors" as const, tone: "coral" as const, icon: <Activity className="w-4 h-4" />, label: "Moments" },
          { tab: "memory" as const, tone: "lav" as const, icon: <BookMarked className="w-4 h-4" />, label: "Child Memory" },
        ]).map((l) => (
          <button key={l.tab} onClick={() => setActiveTab(l.tab)} className={`${cardCls} p-4 text-left flex items-center gap-3 transition hover:-translate-y-0.5`}>
            <IconBadge tone={l.tone}>{l.icon}</IconBadge>
            <span className="text-sm font-extrabold flex items-center gap-1.5" style={{ color: "var(--arbor-ink)" }}>
              {l.label} <ArrowRight className="w-3.5 h-3.5" style={{ color: PASTEL[l.tone].ink }} />
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--arbor-muted)" }}>{label}</p>
      <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--arbor-ink)" }}>{value}</p>
    </div>
  );
}

function JumpLink({ onClick, color, children }: { onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 text-xs font-bold" style={{ color }}>
      {children} <ArrowRight className="w-3.5 h-3.5" />
    </button>
  );
}
