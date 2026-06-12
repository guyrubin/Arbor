import type {
  AdventureResult,
  Milestone,
  MimicSession,
  MissionRecord,
  PracticeDomain,
  SpeechAttempt,
  SpeechLevel,
} from "../types";

/* Pure scoring engine for the Practice Studio + Development Copilot.
   No I/O, no Date.now() inside the math (callers pass `today`) — unit-testable. */

export const RESULT_WEIGHT: Record<SpeechAttempt["result"], number> = { got: 1, almost: 0.5, missed: 0 };

export interface SoundStats {
  sound: string;
  attempts: number;
  accuracy: number;          // 0–100 weighted accuracy, all-time
  recentAccuracy: number;    // 0–100 over the last 10 attempts
  trend: "up" | "down" | "flat";
  levelReached: SpeechLevel;
}

const LEVEL_ORDER: SpeechLevel[] = ["sound", "word", "sentence", "story"];

export function soundStats(attempts: SpeechAttempt[]): SoundStats[] {
  const bySound = new Map<string, SpeechAttempt[]>();
  for (const a of attempts) {
    const list = bySound.get(a.sound) ?? [];
    list.push(a);
    bySound.set(a.sound, list);
  }
  const out: SoundStats[] = [];
  for (const [sound, list] of bySound) {
    const sorted = [...list].sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
    const pct = (xs: SpeechAttempt[]) =>
      xs.length === 0 ? 0 : Math.round((xs.reduce((s, x) => s + RESULT_WEIGHT[x.result], 0) / xs.length) * 100);
    const accuracy = pct(sorted);
    const recent = sorted.slice(-10);
    const earlier = sorted.slice(0, Math.max(0, sorted.length - 10));
    const recentAccuracy = pct(recent);
    const earlierAccuracy = earlier.length > 0 ? pct(earlier) : recentAccuracy;
    const trend: SoundStats["trend"] =
      sorted.length < 4 || Math.abs(recentAccuracy - earlierAccuracy) < 8
        ? "flat"
        : recentAccuracy > earlierAccuracy
          ? "up"
          : "down";
    const levelReached = sorted.reduce<SpeechLevel>((best, a) => {
      if (a.result === "got" && LEVEL_ORDER.indexOf(a.level) > LEVEL_ORDER.indexOf(best)) return a.level;
      return best;
    }, "sound");
    out.push({ sound, attempts: sorted.length, accuracy, recentAccuracy, trend, levelReached });
  }
  return out.sort((a, b) => b.attempts - a.attempts);
}

/** YYYY-MM-DD for a Date in local time. */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgo(today: string, n: number): string {
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() - n);
  return dayKey(d);
}

/** Consecutive practice days ending today or yesterday (any completed mission counts). */
export function streakDays(missions: MissionRecord[], today: string): number {
  const done = new Set(missions.filter((m) => m.completed).map((m) => m.date));
  let start = 0;
  if (!done.has(today)) {
    if (!done.has(daysAgo(today, 1))) return 0;
    start = 1;
  }
  let streak = 0;
  for (let i = start; done.has(daysAgo(today, i)); i++) streak++;
  return streak;
}

export interface WeeklyActivity {
  sessions: number;          // practice interactions in the last 7 days
  activeDays: number;        // distinct days with any activity (0–7)
  domainsTouched: PracticeDomain[];
}

const inLastDays = (iso: string, today: string, n: number): boolean => {
  const t = iso.slice(0, 10);
  return t > daysAgo(today, n) && t <= today;
};

export function weeklyActivity(
  speech: SpeechAttempt[],
  mimic: MimicSession[],
  missions: MissionRecord[],
  adventures: AdventureResult[],
  today: string
): WeeklyActivity {
  const events: { day: string; domain: PracticeDomain }[] = [
    ...speech.filter((x) => inLastDays(x.timestamp, today, 7)).map((x) => ({ day: x.timestamp.slice(0, 10), domain: "speech" as const })),
    ...mimic.filter((x) => inLastDays(x.timestamp, today, 7)).map((x) => ({ day: x.timestamp.slice(0, 10), domain: "speech" as const })),
    ...missions.filter((x) => x.completed && inLastDays(x.timestamp, today, 7)).map((x) => ({ day: x.date, domain: x.domain })),
    ...adventures.filter((x) => inLastDays(x.timestamp, today, 7)).map((x) => ({ day: x.timestamp.slice(0, 10), domain: "cognition" as const })),
  ];
  return {
    sessions: events.length,
    activeDays: new Set(events.map((e) => e.day)).size,
    domainsTouched: [...new Set(events.map((e) => e.domain))],
  };
}

/**
 * Development Score (0–100): a *practice consistency* score, not child ability.
 * 40 pts volume (capped at 20 interactions/wk) + 35 pts consistency (active days
 * of 7) + 25 pts breadth (domains of 5 touched this week).
 */
export function developmentScore(week: WeeklyActivity): number {
  const volume = Math.min(week.sessions, 20) / 20 * 40;
  const consistency = Math.min(week.activeDays, 7) / 7 * 35;
  const breadth = Math.min(week.domainsTouched.length, 5) / 5 * 25;
  return Math.round(volume + consistency + breadth);
}

/* ---------------- Domain bands (Copilot) ---------------- */

export type BandLevel = "emerging" | "developing" | "on-track" | "strong";

export interface DomainBand {
  domain: PracticeDomain;
  /** 0–100 blended signal strength backing the band. */
  signal: number;
  band: BandLevel;
  /** Which inputs contributed (for honest UI copy). */
  basis: string[];
}

const MILESTONE_DOMAIN_MAP: Record<string, PracticeDomain> = {
  language_communication: "language",
  cognition_executive_function: "cognition",
  social_development: "social",
  attachment_regulation: "emotional",
};

function toBand(signal: number): BandLevel {
  if (signal >= 75) return "strong";
  if (signal >= 55) return "on-track";
  if (signal >= 35) return "developing";
  return "emerging";
}

/**
 * Blend milestone completion with live practice signal per domain.
 * Milestones anchor the band; practice data refines it where it exists.
 * Deliberately returns bands — never "developmental age" point estimates.
 */
export function domainBands(
  milestones: Milestone[],
  speech: SpeechAttempt[],
  missions: MissionRecord[],
  adventures: AdventureResult[]
): DomainBand[] {
  const milestonePct = new Map<PracticeDomain, number>();
  const counts = new Map<PracticeDomain, { done: number; total: number }>();
  for (const m of milestones) {
    const domain = MILESTONE_DOMAIN_MAP[m.domain];
    if (!domain) continue;
    const c = counts.get(domain) ?? { done: 0, total: 0 };
    c.total++;
    if (m.checked) c.done++;
    counts.set(domain, c);
  }
  for (const [domain, c] of counts) milestonePct.set(domain, c.total > 0 ? (c.done / c.total) * 100 : 0);

  const stats = soundStats(speech);
  const speechSignal = stats.length > 0 ? stats.reduce((s, x) => s + x.recentAccuracy, 0) / stats.length : null;

  const advBySkillDomain = adventures.length >= 3
    ? (adventures.filter((a) => a.correct).length / adventures.length) * 100
    : null;

  const missionBoost = (domain: PracticeDomain): number => {
    const done = missions.filter((m) => m.completed && m.domain === domain).length;
    return Math.min(done * 2, 10); // sustained practice nudges the band, max +10
  };

  const domains: PracticeDomain[] = ["language", "speech", "cognition", "social", "emotional"];
  return domains.map((domain) => {
    const basis: string[] = [];
    let signal: number;
    if (domain === "speech") {
      if (speechSignal !== null) {
        signal = speechSignal;
        basis.push("Speech Coach accuracy");
      } else {
        signal = milestonePct.get("language") ?? 50;
        basis.push("language milestones (no speech practice yet)");
      }
    } else {
      const ms = milestonePct.get(domain);
      signal = ms ?? 50;
      basis.push(ms !== undefined ? "milestone checklist" : "no milestone data yet");
      if (domain === "cognition" && advBySkillDomain !== null) {
        signal = signal * 0.6 + advBySkillDomain * 0.4;
        basis.push("Adventure comprehension");
      }
    }
    const boost = missionBoost(domain);
    if (boost > 0) basis.push("daily missions");
    signal = Math.max(0, Math.min(100, signal + boost));
    return { domain, signal: Math.round(signal), band: toBand(signal), basis };
  });
}

export interface CopilotRecommendation {
  domain: PracticeDomain;
  missionId: string;
  headline: string;
  why: string;
}

const DOMAIN_MISSION: Record<PracticeDomain, string> = {
  language: "new-words",
  emotional: "emotion-spotting",
  cognition: "story-retell",
  speech: "sound-safari",
  social: "social-play",
};

const DOMAIN_ACTIVITY: Record<PracticeDomain, string> = {
  language: "naming and vocabulary play",
  emotional: "emotion-recognition games",
  cognition: "story retelling and sequencing play",
  speech: "playful sound practice",
  social: "turn-taking games",
};

/** One concrete weekly recommendation: lowest band wins; ties → least-practiced domain. */
export function recommend(bands: DomainBand[], missions: MissionRecord[]): CopilotRecommendation {
  const practiced = (domain: PracticeDomain) => missions.filter((m) => m.completed && m.domain === domain).length;
  const sorted = [...bands].sort((a, b) => a.signal - b.signal || practiced(a.domain) - practiced(b.domain));
  const target = sorted[0];
  return {
    domain: target.domain,
    missionId: DOMAIN_MISSION[target.domain],
    headline: `Increase ${DOMAIN_ACTIVITY[target.domain]} this week`,
    why: `This is currently the domain with the least signal (${target.band}). Small daily reps move it fastest — tomorrow's mission is aimed there.`,
  };
}

/* ---------------- Speech-recognition match (Record & Compare) ---------------- */

/** Normalized Levenshtein similarity 0–1 between the target word and what was heard. */
export function speechSimilarity(target: string, heard: string): number {
  const a = target.toLowerCase().replace(/[^a-z']/g, "");
  const b = heard.toLowerCase().replace(/[^a-z']/g, "");
  if (!a || !b) return 0;
  if (a === b) return 1;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return 1 - dp[a.length][b.length] / Math.max(a.length, b.length);
}

/** Map a transcription to a practice result. Generous on purpose — this is encouragement, not assessment. */
export function matchResult(target: string, heardPhrase: string): { result: "got" | "almost" | "missed"; bestWord: string } {
  const words = heardPhrase.split(/\s+/).filter(Boolean);
  let best = 0;
  let bestWord = heardPhrase.trim();
  for (const w of words) {
    const s = speechSimilarity(target, w);
    if (s > best) {
      best = s;
      bestWord = w;
    }
  }
  // Whole-phrase fallback for multi-word targets (sentences).
  const phraseSim = speechSimilarity(target.replace(/\s+/g, ""), heardPhrase.replace(/\s+/g, ""));
  best = Math.max(best, phraseSim);
  if (best >= 0.8) return { result: "got", bestWord };
  if (best >= 0.5) return { result: "almost", bestWord };
  return { result: "missed", bestWord };
}
