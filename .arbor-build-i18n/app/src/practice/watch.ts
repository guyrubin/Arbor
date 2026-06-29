import type { BehaviorLog, MissionRecord, PracticeDomain } from "../types";
import { SOUND_LIBRARY } from "./content";
import type { DomainBand, SoundStats } from "./signals";

/* Watch Signals (Epic 2) — continuous, non-diagnostic pattern awareness.
 *
 * HARD RULES:
 *  - Never a condition name. We describe observable patterns ("speech sounds
 *    behind typical ages", "frequent intense moments"), never "ASD/ADHD risk".
 *  - Never a diagnosis or probability. Levels are about ATTENTION, not illness:
 *    steady → monitor → worth discussing with a professional.
 *  - Every signal lists its evidence so the parent (and any professional)
 *    can see exactly why it fired. No black boxes.
 *  - Bias toward "a conversation never hurts", but require real data before
 *    firing at all — silence beats noise from three data points.
 */

export type WatchLevel = "steady" | "monitor" | "discuss";

export interface WatchSignal {
  id: string;
  area: string;                 // observable-pattern label, parent-facing
  domain: PracticeDomain;
  level: WatchLevel;
  evidence: string[];           // the exact observations that fired the rule
  plan: string[];               // monitoring plan: activity, tracking step, professional step
}

export interface WatchInput {
  age: number;
  /** Latest screening's flagged domain labels (already non-diagnostic), if any. */
  screeningWatchLabels: string[];
  logs: BehaviorLog[];          // behavior moments (most recent first or any order)
  stats: SoundStats[];          // per-sound practice stats
  bands: DomainBand[];
  missions: MissionRecord[];
  adventureScenes: number;      // total scenes answered
  adventureCorrect: number;     // first-try correct
}

/** Upper bound of the typical acquisition window per sound band. */
const BAND_TYPICAL_MAX: Record<string, number> = { early: 3, middle: 4, late: 7 };

const dayMs = 86_400_000;
const recent = (logs: BehaviorLog[], days: number) =>
  logs.filter((l) => Date.now() - new Date(l.timestamp).getTime() <= days * dayMs);

export function watchSignals(input: WatchInput): WatchSignal[] {
  const out: WatchSignal[] = [];
  const band = (d: PracticeDomain) => input.bands.find((b) => b.domain === d);

  // 1) Speech sounds vs typical ages — only from real practice volume.
  const lagging = input.stats.filter((s) => {
    const entry = SOUND_LIBRARY.find((x) => x.id === s.sound);
    if (!entry) return false;
    const typicalMax = BAND_TYPICAL_MAX[entry.band];
    return input.age > typicalMax && s.attempts >= 6 && s.recentAccuracy < 50;
  });
  if (lagging.length >= 1) {
    const level: WatchLevel = lagging.length >= 3 ? "discuss" : "monitor";
    out.push({
      id: "speech-sounds",
      area: "Speech sounds behind typical ages",
      domain: "speech",
      level,
      evidence: lagging.map((s) => {
        const e = SOUND_LIBRARY.find((x) => x.id === s.sound);
        return `/${s.sound}/ at ${s.recentAccuracy}% after ${s.attempts} practice tries (typically settled ${e?.typicalAge})`;
      }),
      plan: [
        "Keep 5 minutes of daily Speech Coach play on one lagging sound — model, don't correct.",
        "Re-check the trend here in 3 weeks; rising accuracy is the goal, not perfection.",
        ...(level === "discuss"
          ? ["Several sounds are behind their typical window — this is exactly what a speech-language professional assesses well. Arbor can prepare the practice report."]
          : []),
      ],
    });
  }

  // 2) Emotional regulation pattern from logged moments (28-day window).
  const month = recent(input.logs, 28);
  const intense = month.filter((l) => l.intensity >= 4);
  const avgDuration = month.length ? month.reduce((s, l) => s + l.durationMinutes, 0) / month.length : 0;
  if (intense.length >= 6) {
    const level: WatchLevel = intense.length >= 10 && avgDuration >= 15 ? "discuss" : "monitor";
    out.push({
      id: "regulation",
      area: "Frequent intense moments",
      domain: "emotional",
      level,
      evidence: [
        `${intense.length} high-intensity moments logged in the last 28 days`,
        `Average episode length ${Math.round(avgDuration)} minutes`,
      ],
      plan: [
        "Run the Feelings Lab calm-down practice daily during a CALM moment, not mid-storm.",
        "Keep logging moments — the pattern view is what makes any conversation productive.",
        ...(level === "discuss"
          ? ["The frequency and length of these moments is worth discussing with a developmental professional. A conversation never hurts."]
          : []),
      ],
    });
  }

  // 3) Attention & task completion — adventures + missions, needs real volume.
  const advRate = input.adventureScenes >= 10 ? input.adventureCorrect / input.adventureScenes : null;
  const cogBand = band("cognition");
  if (advRate !== null && advRate < 0.4 && cogBand && cogBand.signal < 45) {
    out.push({
      id: "attention",
      area: "Attention & task completion",
      domain: "cognition",
      level: "monitor",
      evidence: [
        `${Math.round(advRate * 100)}% first-try answers across ${input.adventureScenes} adventure scenes`,
        `Thinking & logic band currently ${cogBand.band}`,
      ],
      plan: [
        "Shorten sessions: one adventure scene or one memory round at a time, then stop while it's fun.",
        "Watch whether completion improves with smaller chunks over the next 2-3 weeks.",
      ],
    });
  }

  // 4) Screening-flagged areas carry over (the questionnaire's voice).
  for (const label of input.screeningWatchLabels) {
    const domain: PracticeDomain =
      /language/i.test(label) ? "language" :
      /social/i.test(label) ? "social" :
      /attach|regul/i.test(label) ? "emotional" :
      /think|attention|cognit/i.test(label) ? "cognition" : "language";
    const b = band(domain);
    const level: WatchLevel = b && b.band === "emerging" ? "discuss" : "monitor";
    out.push({
      id: `screening-${domain}-${label.toLowerCase().replace(/\W+/g, "-")}`,
      area: label,
      domain,
      level,
      evidence: [
        "Flagged in your latest Development Check",
        ...(b && b.band === "emerging" ? [`Daily practice signal in this domain is also still ${b.band}`] : []),
      ],
      plan: [
        "The weekly Journey plan aims extra play at this area automatically.",
        ...(level === "discuss"
          ? ["The check and the day-to-day signal point the same way — worth discussing with a professional. Arbor can prepare the report."]
          : ["Re-run the Development Check in 4-6 weeks to see movement."]),
      ],
    });
  }

  // Deduplicate by domain keeping the highest level (screening + live data may overlap).
  const rank: Record<WatchLevel, number> = { steady: 0, monitor: 1, discuss: 2 };
  const byArea = new Map<string, WatchSignal>();
  for (const s of out) {
    const key = `${s.domain}:${s.area}`;
    const cur = byArea.get(key);
    if (!cur || rank[s.level] > rank[cur.level]) byArea.set(key, s);
  }
  return [...byArea.values()].sort((a, b) => rank[b.level] - rank[a.level]);
}
