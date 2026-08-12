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

/**
 * Clinical firewall (JRNL-1): this payload is parent-visible (the whole stats
 * object ships to the client and is echoed into the AI prompt), so it carries
 * COUNTS ONLY — no derived intensity score and no easing/steady/worsening
 * trend verdict may ever be added back here.
 */
export type WeeklyDigestStats = {
  weekOf: string;
  daysCovered: number;
  momentsLogged: number;
  previousWeekMoments: number;
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

  return {
    weekOf: new Date(weekAgo).toISOString().slice(0, 10),
    daysCovered: new Set(inWeek.map((l) => new Date(l.timestamp).toISOString().slice(0, 10))).size,
    momentsLogged: inWeek.length,
    previousWeekMoments: inPrevWeek.length,
    resolvedCount: inWeek.filter((l) => l.resolved).length,
    topContext: mode(inWeek.map((l) => l.context)),
    topBehavior: mode(inWeek.map((l) => l.behaviorType)),
    milestonesDone: milestones.filter((m) => m.checked).length,
    milestonesTotal: milestones.length,
  };
};

/** The narrative fields an email render needs (AI or fallback — same shape). */
export type DigestNarrativeFields = {
  title: string;
  subject: string;
  preheader: string;
  summary: string;
  highlights: string[];
  watchFor: string[];
  tryThisWeek: string;
};

export type DigestEmailRender = { subject: string; preheader: string; bodyText: string };

/**
 * W2 2.2: render the weekly digest as a plain-text email (subject + preheader
 * + body). Pure and deterministic — the /api/digest/email-preview endpoint
 * and any future provider send both go through here, so the email channel can
 * never drift from the in-app digest.
 *
 * Subject = the mockup frame-6 notification voice ("היום יש תובנה חדשה
 * בשבילכם 💚 / פתחו את Arbor ותגלו מה חדש"), localized by `language`.
 *
 * Clinical firewall (JRNL-1 extends to email): counts only. The body renders
 * this week's counts and never touches previousWeekMoments — two week counts
 * side by side read as a trend delta.
 */
export const buildDigestEmail = (input: {
  childName: string;
  language?: "en" | "he";
  narrative: DigestNarrativeFields;
  stats: WeeklyDigestStats;
}): DigestEmailRender => {
  const he = input.language === "he";
  const { narrative: n, stats: s, childName } = input;

  // Notification voice (Maytal frame 6) for the subject line.
  const subject = he
    ? `יש תובנה חדשה על ${childName} 💚`
    : `A new insight about ${childName} is waiting 💚`;
  const preheader = n.preheader.trim() || (he ? "פתחו את Arbor ותגלו מה חדש" : "Open Arbor to see what's new");

  const L = he
    ? {
        watch: "שווה שיחה:",
        tryLbl: "שווה לנסות השבוע:",
        counts: `השבוע במספרים: ${s.momentsLogged} רגעים נשמרו על פני ${s.daysCovered} ימים · ${s.resolvedCount} נפתרו יחד · אבני דרך: ${s.milestonesDone} מתוך ${s.milestonesTotal}.`,
        open: "פתחו את Arbor ותגלו מה חדש.",
      }
    : {
        watch: "Worth a conversation:",
        tryLbl: "Try this week:",
        counts: `The week in counts: ${s.momentsLogged} moments captured across ${s.daysCovered} days · ${s.resolvedCount} worked through together · milestones: ${s.milestonesDone} of ${s.milestonesTotal}.`,
        open: "Open Arbor to see what's new.",
      };

  const bodyText = [
    n.title,
    "",
    n.summary,
    "",
    ...n.highlights.map((h) => `• ${h}`),
    ...(n.watchFor.length > 0 ? ["", `${L.watch} ${n.watchFor.join(" ")}`] : []),
    "",
    `${L.tryLbl} ${n.tryThisWeek}`,
    "",
    L.counts,
    L.open,
  ].join("\n");

  return { subject, preheader, bodyText };
};

/** Deterministic fallback narrative when AI is unavailable. */
export const fallbackDigestNarrative = (childName: string, stats: WeeklyDigestStats) => {
  const highlights: string[] = [];
  if (stats.momentsLogged > 0) {
    highlights.push(`You logged ${stats.momentsLogged} moment${stats.momentsLogged === 1 ? "" : "s"} across ${stats.daysCovered} day${stats.daysCovered === 1 ? "" : "s"} — that attention is the foundation of everything Arbor can see.`);
  }
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
