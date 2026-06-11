/**
 * RET-1: "{child}'s week" — the weekly digest.
 *
 * Composes a deterministic stats core from the parent's logged week (so the
 * digest is truthful even with AI off) and lets the model write the warm
 * narrative on top. The returned payload is channel-agnostic: the in-app card
 * renders it today, and the same JSON is the body for push/email once that
 * infrastructure exists (subject/preheader fields included for that).
 */

type DigestLog = {
  timestamp: string;
  behaviorType: string;
  intensity: number;
  durationMinutes: number;
  trigger?: string;
  response?: string;
  context?: string;
  resolved?: boolean;
};

type DigestMilestone = { title: string; checked: boolean; domain?: string };

export type WeeklyDigestStats = {
  weekOf: string;
  daysCovered: number;
  momentsLogged: number;
  previousWeekMoments: number;
  avgIntensity: number | null;
  intensityTrend: "easing" | "steady" | "intensifying" | "unknown";
  resolvedCount: number;
  topContext: string | null;
  topBehavior: string | null;
  milestonesDone: number;
  milestonesTotal: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const mode = (values: (string | undefined)[]): string | null => {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) || 0) + 1);
  let best: string | null = null;
  let bestN = 0;
  for (const [k, n] of counts) if (n > bestN) { best = k; bestN = n; }
  return best;
};

export const computeWeeklyDigestStats = (
  logs: DigestLog[],
  milestones: DigestMilestone[],
  now: number = Date.now(),
): WeeklyDigestStats => {
  const weekAgo = now - 7 * DAY_MS;
  const twoWeeksAgo = now - 14 * DAY_MS;
  const inWeek = logs.filter((l) => {
    const t = new Date(l.timestamp).getTime();
    return t >= weekAgo && t <= now;
  });
  const inPrevWeek = logs.filter((l) => {
    const t = new Date(l.timestamp).getTime();
    return t >= twoWeeksAgo && t < weekAgo;
  });

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const avgNow = avg(inWeek.map((l) => l.intensity));
  const avgPrev = avg(inPrevWeek.map((l) => l.intensity));
  let intensityTrend: WeeklyDigestStats["intensityTrend"] = "unknown";
  if (avgNow !== null && avgPrev !== null) {
    if (avgNow < avgPrev - 0.3) intensityTrend = "easing";
    else if (avgNow > avgPrev + 0.3) intensityTrend = "intensifying";
    else intensityTrend = "steady";
  }

  return {
    weekOf: new Date(weekAgo).toISOString().slice(0, 10),
    daysCovered: new Set(inWeek.map((l) => new Date(l.timestamp).toISOString().slice(0, 10))).size,
    momentsLogged: inWeek.length,
    previousWeekMoments: inPrevWeek.length,
    avgIntensity: avgNow === null ? null : Math.round(avgNow * 10) / 10,
    intensityTrend,
    resolvedCount: inWeek.filter((l) => l.resolved).length,
    topContext: mode(inWeek.map((l) => l.context)),
    topBehavior: mode(inWeek.map((l) => l.behaviorType)),
    milestonesDone: milestones.filter((m) => m.checked).length,
    milestonesTotal: milestones.length,
  };
};

/** Deterministic fallback narrative when AI is unavailable. */
export const fallbackDigestNarrative = (childName: string, stats: WeeklyDigestStats) => {
  const highlights: string[] = [];
  if (stats.momentsLogged > 0) {
    highlights.push(`You logged ${stats.momentsLogged} moment${stats.momentsLogged === 1 ? "" : "s"} across ${stats.daysCovered} day${stats.daysCovered === 1 ? "" : "s"} — that attention is the foundation of everything Arbor can see.`);
  }
  if (stats.intensityTrend === "easing") highlights.push(`Hard moments are easing compared with last week.`);
  if (stats.resolvedCount > 0) highlights.push(`${stats.resolvedCount} logged moment${stats.resolvedCount === 1 ? " was" : "s were"} marked resolved.`);
  if (stats.milestonesTotal > 0) highlights.push(`Milestones: ${stats.milestonesDone} of ${stats.milestonesTotal} reached.`);
  if (highlights.length === 0) highlights.push(`A quiet week in the log — even one quick note a day keeps ${childName}'s story sharp.`);
  return {
    title: `${childName}'s week`,
    subject: `${childName}'s week in review`,
    preheader: highlights[0],
    summary: highlights.join(" "),
    highlights,
    watchFor: stats.topBehavior ? [`${stats.topBehavior} came up most often${stats.topContext ? ` (mostly at ${stats.topContext.toLowerCase()})` : ""}.`] : [],
    tryThisWeek: stats.momentsLogged === 0
      ? "Log one moment a day — 20 seconds each — and next week's digest gets much smarter."
      : "Pick the most frequent trigger above and pre-empt it once this week with a named transition warning.",
  };
};
