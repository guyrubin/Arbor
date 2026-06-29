import type { BehaviorLog, Milestone, ActionPlan, MemoryReviewItem, PlayLog } from "../types";

/**
 * The Signal Timeline — Arbor's unified developmental activity stream.
 *
 * Every capability writes its own data (behavior logs, milestones, growth plans,
 * approved child memory, coach sessions). This module folds all of those sources
 * into ONE chronological stream plus a derived "momentum" read, so the parent can
 * see the whole story in one place and each feature visibly feeds the next.
 *
 * Pure + framework-free so it is fully unit-testable. The tone union mirrors the
 * Soft-Daylight PASTEL keys in `ui/kit` without importing React.
 */

export type SignalKind = "moment" | "milestone" | "plan" | "memory" | "coach" | "play";
export type SignalTone = "mint" | "coral" | "lav" | "yellow" | "pink" | "sky";

export interface TimelineSignal {
  id: string;
  kind: SignalKind;
  /** ISO timestamp, or null for sources that carry no date (grouped as "Ongoing"). */
  at: string | null;
  title: string;
  detail?: string;
  tone: SignalTone;
  /** Optional render metadata. */
  intensity?: number;
  context?: string;
  photo?: string;
  meta?: string;
}

export interface TimelineSources {
  behaviorLogs?: BehaviorLog[];
  milestones?: Milestone[];
  plans?: ActionPlan[];
  memory?: MemoryReviewItem[];
  conversations?: { id: string; title: string; updatedAt: string }[];
  play?: PlayLog[];
}

const DAY = 24 * 60 * 60 * 1000;

const planStepDone = (s: { completed: boolean; status?: string }) => s.completed || s.status === "done";

const countPlanSteps = (plans: ActionPlan[] = []) => {
  let done = 0;
  let total = 0;
  for (const plan of plans) {
    for (const phase of plan.phases || []) {
      for (const step of phase.steps || []) {
        total += 1;
        if (planStepDone(step)) done += 1;
      }
    }
  }
  return { done, total };
};

const topOf = (values: (string | undefined | null)[]): string | null => {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
};

/** Fold every source into one stream, newest first; undated signals sort last. */
export const buildTimeline = (sources: TimelineSources): TimelineSignal[] => {
  const signals: TimelineSignal[] = [];

  for (const log of sources.behaviorLogs || []) {
    const parts = [log.context, log.durationMinutes ? `${log.durationMinutes}m` : ""].filter(Boolean);
    signals.push({
      id: `moment-${log.id}`,
      kind: "moment",
      at: log.timestamp || null,
      title: log.behaviorType || "Logged moment",
      detail: log.trigger || log.notes || "",
      tone: log.resolved ? "mint" : "coral",
      intensity: log.intensity,
      context: log.context,
      photo: log.photoAttachment,
      meta: parts.join(" · "),
    });
  }

  for (const m of sources.milestones || []) {
    if (!m.checked) continue;
    signals.push({
      id: `milestone-${m.id}`,
      kind: "milestone",
      at: null,
      title: `Observed: ${m.title}`,
      detail: m.description || "",
      tone: "lav",
      meta: m.ageGroup,
    });
  }

  for (const plan of sources.plans || []) {
    const steps = countPlanSteps([plan]);
    signals.push({
      id: `plan-${plan.id}`,
      kind: "plan",
      at: null,
      title: plan.title || "Growth plan",
      detail: plan.issue || "",
      tone: "sky",
      meta: steps.total ? `${steps.done}/${steps.total} steps` : undefined,
    });
  }

  for (const item of sources.memory || []) {
    if (item.status !== "approved") continue;
    signals.push({
      id: `memory-${item.memoryId}`,
      kind: "memory",
      at: item.createdAt || null,
      title: "Approved to memory",
      detail: item.fact,
      tone: "yellow",
      meta: item.source,
    });
  }

  for (const c of sources.conversations || []) {
    signals.push({
      id: `coach-${c.id}`,
      kind: "coach",
      at: c.updatedAt || null,
      title: "Coach session",
      detail: c.title,
      tone: "pink",
    });
  }

  for (const p of sources.play || []) {
    signals.push({
      id: `play-${p.id}`,
      kind: "play",
      at: p.timestamp || null,
      title: `Played: ${p.title}`,
      detail: `Builds ${p.domain}`,
      tone: "mint",
      meta: p.reason === "concern-match" ? "matched to a recent pattern" : undefined,
    });
  }

  return signals.sort((a, b) => {
    if (a.at && b.at) return a.at < b.at ? 1 : a.at > b.at ? -1 : 0;
    if (a.at) return -1;
    if (b.at) return 1;
    return 0;
  });
};

export type Trend = "up" | "down" | "flat";

export interface Momentum {
  momentsThisWeek: number;
  momentsPrevWeek: number;
  momentTrend: Trend;
  avgIntensityThisWeek: number | null;
  avgIntensityPrevWeek: number | null;
  intensityTrend: "easing" | "rising" | "flat" | "none";
  topPattern: string | null;
  topContext: string | null;
  planSteps: { done: number; total: number };
  milestones: { observed: number; total: number };
  winsThisWeek: number;
}

const avg = (nums: number[]): number | null =>
  nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;

/** Derive this-week-vs-last momentum from the dated signals. `now` is injectable for tests. */
export const computeMomentum = (
  behaviorLogs: BehaviorLog[] = [],
  plans: ActionPlan[] = [],
  milestones: Milestone[] = [],
  now: number = Date.now(),
): Momentum => {
  const inWindow = (ts: string, fromDaysAgo: number, toDaysAgo: number) => {
    const t = new Date(ts).getTime();
    return t > now - fromDaysAgo * DAY && t <= now - toDaysAgo * DAY;
  };

  const thisWeek = behaviorLogs.filter((l) => l.timestamp && inWindow(l.timestamp, 7, 0));
  const prevWeek = behaviorLogs.filter((l) => l.timestamp && inWindow(l.timestamp, 14, 7));

  const momentTrend: Trend =
    thisWeek.length > prevWeek.length ? "up" : thisWeek.length < prevWeek.length ? "down" : "flat";

  const avgThis = avg(thisWeek.map((l) => l.intensity).filter((n) => typeof n === "number"));
  const avgPrev = avg(prevWeek.map((l) => l.intensity).filter((n) => typeof n === "number"));

  let intensityTrend: Momentum["intensityTrend"] = "none";
  if (avgThis != null && avgPrev != null) {
    intensityTrend = avgThis < avgPrev ? "easing" : avgThis > avgPrev ? "rising" : "flat";
  } else if (avgThis != null) {
    intensityTrend = "flat";
  }

  return {
    momentsThisWeek: thisWeek.length,
    momentsPrevWeek: prevWeek.length,
    momentTrend,
    avgIntensityThisWeek: avgThis,
    avgIntensityPrevWeek: avgPrev,
    intensityTrend,
    topPattern: topOf(thisWeek.map((l) => l.behaviorType)),
    topContext: topOf(thisWeek.map((l) => l.context)),
    planSteps: countPlanSteps(plans),
    milestones: {
      observed: milestones.filter((m) => m.checked).length,
      total: milestones.length,
    },
    winsThisWeek: thisWeek.filter((l) => l.resolved).length,
  };
};

export interface NextStep {
  message: string;
  cta?: { label: string; prompt: string };
}

/**
 * A client-side proactive nudge: read the week's signals and surface ONE next
 * best step that routes the parent into the right capability. No AI call — this
 * is the timeline visibly feeding the coach.
 */
export const deriveNextStep = (momentum: Momentum, childName: string): NextStep | null => {
  const name = childName || "your child";

  if (momentum.momentsThisWeek === 0 && momentum.planSteps.total === 0) {
    return {
      message: `${name}'s story starts with a single moment. Capture what happened today and Arbor takes it from there.`,
      cta: { label: "Capture a moment", prompt: "" },
    };
  }

  if (momentum.topPattern && momentum.momentsThisWeek >= 2) {
    const where = momentum.topContext ? `, usually at ${momentum.topContext.toLowerCase()}` : "";
    const easing = momentum.intensityTrend === "easing";
    const trendLine = easing
      ? " Intensity is easing — whatever you're doing is helping."
      : momentum.intensityTrend === "rising"
        ? " Intensity is rising this week — worth a closer look."
        : "";
    return {
      message: `Most of ${name}'s moments this week were "${momentum.topPattern}"${where}.${trendLine}`,
      cta: {
        label: `Ask Arbor about ${momentum.topPattern.toLowerCase()}`,
        prompt: `This week ${name} had several "${momentum.topPattern}" moments${
          momentum.topContext ? ` (mostly at ${momentum.topContext.toLowerCase()})` : ""
        }. What may be happening and what's one thing to try this week?`,
      },
    };
  }

  if (momentum.milestones.total > 0 && momentum.milestones.observed > 0) {
    return {
      message: `You've observed ${momentum.milestones.observed} of ${momentum.milestones.total} milestones for ${name}. Keep noticing — small wins compound.`,
    };
  }

  return null;
};

export type TimelineGroup = { key: string; label: string; signals: TimelineSignal[] };

const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);

/** Group dated signals by day with friendly labels; undated land in "Ongoing". */
export const groupByDay = (signals: TimelineSignal[], now: number = Date.now()): TimelineGroup[] => {
  const todayKey = new Date(now).toISOString().slice(0, 10);
  const yesterdayKey = new Date(now - DAY).toISOString().slice(0, 10);
  const groups: TimelineGroup[] = [];
  const index = new Map<string, TimelineGroup>();

  const ensure = (key: string, label: string) => {
    let g = index.get(key);
    if (!g) {
      g = { key, label, signals: [] };
      index.set(key, g);
      groups.push(g);
    }
    return g;
  };

  for (const s of signals) {
    if (!s.at) {
      ensure("ongoing", "Ongoing").signals.push(s);
      continue;
    }
    const k = dayKey(s.at);
    const label =
      k === todayKey
        ? "Today"
        : k === yesterdayKey
          ? "Yesterday"
          : new Date(s.at).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    ensure(k, label).signals.push(s);
  }

  // Dated groups first (already newest-first from buildTimeline), Ongoing last.
  return groups.sort((a, b) => {
    if (a.key === "ongoing") return 1;
    if (b.key === "ongoing") return -1;
    return a.key < b.key ? 1 : -1;
  });
};
