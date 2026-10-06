import type { BehaviorLog, MissionRecord, PracticeDomain } from "../types";
import { SOUND_LIBRARY } from "./content";
import type { ScreenDomainId } from "../lib/screening";
import type { DomainBand, SoundStats } from "./signals";
import { translate, domainLabelEn } from "../lib/domains/registry";

/* Watch Signals (Epic 2) — continuous, non-diagnostic pattern awareness.
 *
 * HARD RULES:
 *  - Never a condition name. We describe observable patterns (the domain the
 *    observations sit in, "frequent intense moments"), never "ASD/ADHD risk".
 *  - OBJ-GROWTH-06: no verdict vocabulary anywhere in the strings this module
 *    emits. Parent-facing sentences are i18n KEYS (elev.growthTruth.watch.*),
 *    resolved by the rendering surface in the reader's language, so a Hebrew
 *    family never meets an English literal here (law 7).
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
  /** Practice domain this signal ranks against. `null` when the observation
   *  comes from a screening domain with no practice counterpart (independence,
   *  sensory) — inventing one is what printed "Language" on a sensory row. */
  domain: PracticeDomain | null;
  /** The label to SHOW for this row. Always the row's own domain. */
  domainLabel: string;
  level: WatchLevel;
  /** The observations that fired the rule. An entry beginning `elev.` is an
   *  i18n key the surface resolves; anything else is already display text. */
  evidence: string[];
  plan: string[];               // monitoring plan: activity, tracking step, professional step
}

/** One flagged-free carry-over from the Development Check: the screening's own
 *  domain id plus the label the screening itself renders for it. */
export interface ScreeningWatchArea {
  domain: ScreenDomainId;
  label: string;
}

/* B-GROWTH-26: screening domain → practice-signal counterpart goes THROUGH
 * the domain registry (`translate`), not a private map. Independence and
 * sensory have none (hands / moving carry no practice id) — the row keeps its
 * own label, and the level falls back to the calm default. */

export interface WatchInput {
  age: number;
  /** Latest screening's "worth a conversation" areas, each carrying its OWN
   *  domain id — never a label the caller has to re-guess by regex. */
  screeningWatchLabels: ScreeningWatchArea[];
  logs: BehaviorLog[];          // behavior moments (most recent first or any order)
  stats: SoundStats[];          // per-sound practice stats
  bands: DomainBand[];
  missions: MissionRecord[];
  adventureScenes: number;      // story scenes played (a count; no correctness is read)
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
      area: domainLabelEn("practice", "speech"),
      domain: "speech",
      domainLabel: domainLabelEn("practice", "speech"),
      level,
      evidence: lagging.map((s) => {
        const e = SOUND_LIBRARY.find((x) => x.id === s.sound);
        // Counts, never percentages (IA W4.5): evidence rides into clinician exports.
        const recentWindow = Math.min(s.attempts, 10);
        const landed = Math.round((s.recentAccuracy / 100) * recentWindow);
        return `/${s.sound}/ landed about ${landed} of the last ${recentWindow} practice tries, ${s.attempts} total (typically settled ${e?.typicalAge})`;
      }),
      plan: [
        "Keep 5 minutes of daily Speech Coach play on one lagging sound — model, don't correct.",
        "Re-check the trend here in 3 weeks; rising accuracy is the goal, not perfection.",
        ...(level === "discuss"
          ? ["elev.growthTruth.watch.soundsTypical"]
          : []),
      ],
    });
  }

  // 2) Emotional regulation pattern from logged moments (28-day window).
  const month = recent(input.logs, 28);
  // B-DATA-09: a moment with no recorded intensity is never an intense one.
  const intense = month.filter((l) => typeof l.intensity === "number" && l.intensity >= 4);
  const avgDuration = month.length ? month.reduce((s, l) => s + l.durationMinutes, 0) / month.length : 0;
  if (intense.length >= 6) {
    const level: WatchLevel = intense.length >= 10 && avgDuration >= 15 ? "discuss" : "monitor";
    out.push({
      id: "regulation",
      area: "Frequent intense moments",
      domain: "emotional",
      domainLabel: domainLabelEn("practice", "emotional"),
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

  // 3) (W2-SHELLPLAY critic r2, law 1) The "Attention & task completion" rule
  //    that turned a picture-choice game's first-try rate into a 'monitor'
  //    pattern is gone: a story game is play, never a graded risk signal.
  //    Story Quest contributes scene COUNTS only, and nothing reads .correct.

  // 4) The Development Check's own "worth a conversation" areas carry over, in
  //    the questionnaire's own vocabulary. OBJ-GROWTH-06: the area arrives with
  //    its OWN domain id, so a sensory or independence row is never relabelled
  //    "Language" by a regex fallback, and the evidence line is an i18n key.
  for (const area of input.screeningWatchLabels) {
    const domain: PracticeDomain | null = translate("screen", area.domain, "practice") ?? null;
    const b = domain ? band(domain) : undefined;
    const level: WatchLevel = b && b.band === "emerging" ? "discuss" : "monitor";
    out.push({
      id: `screening-${area.domain}`,
      area: area.label,
      domain,
      domainLabel: area.label,
      level,
      evidence: [
        "elev.growthTruth.watch.fromCheck",
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
