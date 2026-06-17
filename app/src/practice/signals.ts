import type {
  AdventureResult,
  BandSnapshot,
  DevelopmentMetrics,
  Milestone,
  MimicSession,
  MissionRecord,
  PracticeDomain,
  PracticeEvent,
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
  today: string,
  practiceEvents: PracticeEvent[] = []
): WeeklyActivity {
  const events: { day: string; domain: PracticeDomain }[] = [
    ...speech.filter((x) => inLastDays(x.timestamp, today, 7)).map((x) => ({ day: x.timestamp.slice(0, 10), domain: "speech" as const })),
    ...mimic.filter((x) => inLastDays(x.timestamp, today, 7)).map((x) => ({ day: x.timestamp.slice(0, 10), domain: "speech" as const })),
    ...missions.filter((x) => x.completed && inLastDays(x.timestamp, today, 7)).map((x) => ({ day: x.date, domain: x.domain })),
    ...adventures.filter((x) => inLastDays(x.timestamp, today, 7)).map((x) => ({ day: x.timestamp.slice(0, 10), domain: "cognition" as const })),
    ...practiceEvents.filter((x) => inLastDays(x.timestamp, today, 7)).map((x) => ({ day: x.timestamp.slice(0, 10), domain: x.domain })),
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

/** Accuracy 0–100 over events with a defined correct flag; null when too few. */
function eventAccuracy(events: PracticeEvent[], kinds: PracticeEvent["kind"][], minN = 3): number | null {
  const graded = events.filter((e) => kinds.includes(e.kind) && e.correct !== undefined);
  if (graded.length < minN) return null;
  return (graded.filter((e) => e.correct).length / graded.length) * 100;
}

/**
 * Blend milestone completion with live practice signal per domain.
 * Milestones anchor the band; practice data refines it where it exists.
 * Deliberately returns bands — never "developmental age" point estimates.
 *
 * `events` (Feelings Lab, Words/Express modes, Memory Match) and `heroMetrics`
 * (story-choice deltas) extend the passive-assessment inputs when present.
 */
export function domainBands(
  milestones: Milestone[],
  speech: SpeechAttempt[],
  missions: MissionRecord[],
  adventures: AdventureResult[],
  events: PracticeEvent[] = [],
  heroMetrics?: Partial<DevelopmentMetrics>
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

  const emotionAcc = eventAccuracy(events, ["emotion-id", "emotion-why"]);
  const languageAcc = eventAccuracy(events, ["vocab-naming", "vocab-category", "expressive"]);
  const memoryScores = events.filter((e) => e.kind === "memory" && e.score !== undefined);
  const memoryAcc = memoryScores.length >= 2
    ? memoryScores.reduce((s, e) => s + (e.score ?? 0), 0) / memoryScores.length
    : null;
  const calmCount = events.filter((e) => e.kind === "calm").length;
  // Story-choice metrics: empathy reads as social signal; courage/resilience as
  // emotional regulation practice. Capped nudges, not drivers.
  const heroSocial = Math.min((heroMetrics?.empathy ?? 0) * 2, 8);
  const heroEmotional = Math.min(((heroMetrics?.courage ?? 0) + (heroMetrics?.resilience ?? 0)) * 1.5, 8);

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
      if (domain === "cognition") {
        if (advBySkillDomain !== null) {
          signal = signal * 0.6 + advBySkillDomain * 0.4;
          basis.push("Adventure comprehension");
        }
        if (memoryAcc !== null) {
          signal = signal * 0.75 + memoryAcc * 0.25;
          basis.push("Memory Match");
        }
      }
      if (domain === "language" && languageAcc !== null) {
        signal = signal * 0.6 + languageAcc * 0.4;
        basis.push("Words & Express practice");
      }
      if (domain === "emotional") {
        if (emotionAcc !== null) {
          signal = signal * 0.6 + emotionAcc * 0.4;
          basis.push("Feelings Lab");
        }
        if (calmCount > 0) {
          signal += Math.min(calmCount, 5);
          basis.push("calm-down practice");
        }
        if (heroEmotional > 0) {
          signal += heroEmotional;
          basis.push("story choices");
        }
      }
      if (domain === "social" && heroSocial > 0) {
        signal += heroSocial;
        basis.push("story choices");
      }
    }
    const boost = missionBoost(domain);
    if (boost > 0) basis.push("daily missions");
    signal = Math.max(0, Math.min(100, signal + boost));
    return { domain, signal: Math.round(signal), band: toBand(signal), basis };
  });
}

/* ---------------- Assessment depth (Epic 1): confidence, history, trend ---------------- */

export type ConfidenceLevel = "low" | "medium" | "high";

/**
 * How much observed data backs each domain's band. Pure volume+recency framing
 * ("based on a little / a fair amount / a lot of recent observation") — it does
 * not claim statistical confidence.
 */
export function domainConfidence(
  domain: PracticeDomain,
  milestones: Milestone[],
  speech: SpeechAttempt[],
  adventures: AdventureResult[],
  events: PracticeEvent[],
  missions: MissionRecord[]
): ConfidenceLevel {
  const ms = milestones.filter((m) => m.checked).length > 0 ? 4 : 0;
  let n = ms + missions.filter((r) => r.completed && r.domain === domain).length;
  if (domain === "speech") n += speech.length;
  if (domain === "cognition") n += adventures.length + events.filter((e) => e.kind === "memory").length;
  if (domain === "language") n += events.filter((e) => ["vocab-naming", "vocab-category", "expressive"].includes(e.kind)).length;
  if (domain === "emotional") n += events.filter((e) => ["emotion-id", "emotion-why", "calm"].includes(e.kind)).length;
  if (n >= 20) return "high";
  if (n >= 6) return "medium";
  return "low";
}

/** ISO week key, e.g. "2026-W24". */
export function weekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Build this week's snapshot if none exists yet (the historical-progression record). */
export function pendingSnapshot(existing: BandSnapshot[], bands: DomainBand[], today: string): BandSnapshot | null {
  const wk = weekKey(new Date(`${today}T12:00:00`));
  if (existing.some((s) => s.id === wk)) return null;
  return { id: wk, date: today, bands: bands.map((b) => ({ domain: b.domain, signal: b.signal, band: b.band })) };
}

/** Per-domain change vs the previous snapshot (for trend arrows). */
export function bandTrend(history: BandSnapshot[], current: DomainBand[]): Record<PracticeDomain, number> {
  const sorted = [...history].sort((a, b) => (a.id < b.id ? -1 : 1));
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : sorted[sorted.length - 1];
  const out = {} as Record<PracticeDomain, number>;
  for (const b of current) {
    const p = prev?.bands.find((x) => x.domain === b.domain);
    out[b.domain] = p ? b.signal - p.signal : 0;
  }
  return out;
}

/* ---------------- Adaptive play difficulty (Epic 8) ---------------- */

/** Age-appropriate ceiling on Memory Match difficulty (a toddler shouldn't face 12 cards). */
export function memoryMaxCards(age?: number): 6 | 8 | 12 {
  if (age == null) return 12;
  if (age < 3) return 6;
  if (age < 5) return 8;
  return 12;
}

/**
 * Memory Match grid size adapts to recent performance: start small, grow on
 * sustained success, ease back after a hard round — but never above the
 * age-appropriate ceiling (`maxCards`). Returns total card count.
 */
export function memoryGridSize(recentScores: number[], maxCards: 6 | 8 | 12 = 12): 6 | 8 | 12 {
  const last3 = recentScores.slice(-3);
  const avg = last3.length ? last3.reduce((s, x) => s + x, 0) / last3.length : 0;
  const clamp = (n: 6 | 8 | 12): 6 | 8 | 12 => (n <= maxCards ? n : maxCards);
  if (last3.length < 2) return 6;
  if (avg >= 80) {
    if (recentScores.length >= 6 && recentScores.slice(-6).every((s) => s >= 80)) return clamp(12);
    return clamp(8);
  }
  if (avg >= 60) return clamp(8);
  return 6;
}

/** Pick a card theme suited to the child's age (gentler themes for the youngest). */
export function memorySetIndexForAge(age: number | undefined, setCount: number): number {
  if (setCount <= 1) return 0;
  if (age == null) return 0;
  if (age < 4) return 0;       // Animals — most universally recognizable
  if (age < 6) return 1;       // Everyday objects / food
  return 2 % setCount;         // Space and the more abstract themes for older kids
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

/* ---------------- Weekly milestone closed-loop (Kinedu-style) ---------------- */

export interface MissionFocus {
  domain: PracticeDomain;
  missionId: string;
  /** A representative not-yet-reached milestone this focus builds toward. */
  targetMilestone?: string;
  /** Count of unchecked milestones mapped to this domain. */
  gaps: number;
  reason: string;
}

export interface WeeklyMissionPlan {
  weekKey: string;
  focus: MissionFocus[];
}

/**
 * The closed loop: build this WEEK's focus from the child's milestones that are
 * NOT yet reached, re-weighted by what was actually practiced last week. Domains
 * with more gaps rank higher; a domain practiced last week yields slightly to a
 * neglected one (it's progressing), while missed targets persist. Deterministic
 * (no randomness), regenerates each ISO week as milestones/missions change.
 *
 * Pure — pass `today`. Powered by Arbor's logged data, which is the moat: a
 * content-only rival can't aim missions at THIS child's specific open milestones.
 */
export function weeklyMissionPlan(
  milestones: Milestone[],
  missions: MissionRecord[],
  today: string,
  size = 3
): WeeklyMissionPlan {
  const wk = weekKey(new Date(`${today}T12:00:00`));

  // Not-yet-reached milestones grouped by the practice domain they map to.
  const gaps = new Map<PracticeDomain, Milestone[]>();
  for (const m of milestones) {
    const domain = MILESTONE_DOMAIN_MAP[m.domain];
    if (!domain || m.checked) continue;
    const list = gaps.get(domain) ?? [];
    list.push(m);
    gaps.set(domain, list);
  }

  // Missions actually completed in the trailing 7 days, per domain.
  const lastWeekStart = daysAgo(today, 7);
  const doneByDomain = new Map<PracticeDomain, number>();
  for (const r of missions) {
    if (!r.completed || r.date <= lastWeekStart || r.date > today) continue;
    doneByDomain.set(r.domain, (doneByDomain.get(r.domain) ?? 0) + 1);
  }

  const domains: PracticeDomain[] = ["language", "speech", "cognition", "social", "emotional"];
  const scored = domains.map((domain) => {
    const list = gaps.get(domain) ?? [];
    const practiced = doneByDomain.get(domain) ?? 0;
    // Each open milestone is worth 10; recent practice eases priority by up to 8
    // so a neglected domain outranks one already getting attention.
    const priority = list.length * 10 - Math.min(practiced, 4) * 2;
    return { domain, list, gapCount: list.length, practiced, priority };
  });
  scored.sort((a, b) => b.priority - a.priority || b.gapCount - a.gapCount);

  const focus: MissionFocus[] = scored
    .filter((s) => s.gapCount > 0)
    .slice(0, size)
    .map((s) => ({
      domain: s.domain,
      missionId: DOMAIN_MISSION[s.domain],
      targetMilestone: s.list[0]?.title,
      gaps: s.gapCount,
      reason: s.practiced > 0
        ? `${s.gapCount} milestone${s.gapCount === 1 ? "" : "s"} still emerging here — you practiced this ${s.practiced}× last week, so keep the momentum.`
        : `${s.gapCount} milestone${s.gapCount === 1 ? "" : "s"} not yet reached, and nothing logged here last week.`,
    }));

  // No milestone gaps (all checked, or none recorded yet) → a balanced default week.
  if (focus.length === 0) {
    return {
      weekKey: wk,
      focus: domains.slice(0, size).map((domain) => ({
        domain,
        missionId: DOMAIN_MISSION[domain],
        gaps: 0,
        reason: "Keeping a broad, balanced week of play while milestones fill in.",
      })),
    };
  }
  return { weekKey: wk, focus };
}

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

/* ---------------- ASHA articulation: age-gating + dosage ---------------- */

export type AcqBand = "early" | "middle" | "late";

/**
 * Is a target sound developmentally appropriate to drill at this age? Gated to
 * ASHA / Crowe & McLeod acquisition norms (75th-percentile framing): early sounds
 * (plosives/nasals/glides) ~by 3; middle ~by 4; late (liquids/fricatives like
 * l, r, s, sh, ch, th) ~by 5–7. We don't push late sounds before they're typical.
 */
export function isSoundAgeAppropriate(band: AcqBand, age: number): boolean {
  if (band === "early") return true;
  if (band === "middle") return age >= 3;
  return age >= 4; // late
}

/** Filter a sound library to the targets appropriate for the child's age (the moat picks the targets). */
export function ageAppropriateSoundIds(library: { id: string; band: AcqBand }[], age: number): string[] {
  return library.filter((s) => isSoundAgeAppropriate(s.band, age)).map((s) => s.id);
}

export interface SpeechDose {
  trialsToday: number;
  perSessionTarget: number;     // ASHA: 50–100 production trials per session
  sessionMetToday: boolean;
  sessionsThisWeek: number;     // distinct practice days in the trailing 7
  weeklySessionTarget: number;  // ASHA: 2–3 sessions per week
  weeklyMet: boolean;
}

/**
 * ASHA articulation dosage tracking: ~50–100 production trials per session, 2–3
 * sessions/week. Pure — pass `today`. Each SpeechAttempt is one production trial.
 */
export function speechDose(
  attempts: SpeechAttempt[],
  today: string,
  perSessionTarget = 50,
  weeklySessionTarget = 3
): SpeechDose {
  const weekStart = daysAgo(today, 7);
  const trialsToday = attempts.filter((a) => a.timestamp.slice(0, 10) === today).length;
  const days = new Set(
    attempts
      .map((a) => a.timestamp.slice(0, 10))
      .filter((d) => d > weekStart && d <= today)
  );
  const sessionsThisWeek = days.size;
  return {
    trialsToday,
    perSessionTarget,
    sessionMetToday: trialsToday >= perSessionTarget,
    sessionsThisWeek,
    weeklySessionTarget,
    weeklyMet: sessionsThisWeek >= weeklySessionTarget,
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
