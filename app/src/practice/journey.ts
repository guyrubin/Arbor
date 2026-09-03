import type { DevelopmentMetricId, JourneyObjective, PracticeDomain } from "../types";
import { MISSION_CYCLE, type MissionTemplate } from "./content";
import type { CopilotRecommendation, DomainBand } from "./signals";

/* Journey composer (Epic 9 + Epic 4's weekly action plan output).
   Deterministic for a given week + bands: same plan all week for the family. */

export interface JourneyDay {
  date: string;              // YYYY-MM-DD
  weekday: string;           // "Mon"
  mission: MissionTemplate;
  /** The day's aimed extra — one concrete activity beyond the mission. */
  extra: { title: string; detail: string; tab: "speech" | "feelings" | "adventures" | "stories" | "mimic" };
  isToday: boolean;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EXTRA_BY_DOMAIN: Record<PracticeDomain, { title: string; detail: string; tab: JourneyDay["extra"]["tab"] }[]> = {
  speech: [
    { title: "Speech Coach: today's sound", detail: "5 minutes on the current target sound — words first, then one silly sentence.", tab: "speech" },
    { title: "Mimic Studio round", detail: "Two imitation rounds — mouth gymnastics count as speech practice.", tab: "mimic" },
  ],
  language: [
    { title: "Words mode: naming hunt", detail: "Name 5 objects in one category (kitchen things, animals, clothes).", tab: "speech" },
    { title: "Express mode: question of the day", detail: "One open question at dinner — wait, then expand their answer back.", tab: "speech" },
  ],
  emotional: [
    { title: "Feelings Lab: emotion match", detail: "One round of matching faces to feelings, then make the faces together.", tab: "feelings" },
    { title: "Calm-down practice", detail: "One guided breathing exercise during a calm moment — that's when it sticks.", tab: "feelings" },
  ],
  cognition: [
    { title: "Adventure scene", detail: "One story scene with choices — thinking practice disguised as play.", tab: "adventures" },
    { title: "Memory Match round", detail: "One pairs round; the grid grows as they get stronger.", tab: "adventures" },
  ],
  social: [
    { title: "Story Journey", detail: "One hero story with a real choice — talk about what the hero felt after.", tab: "stories" },
    { title: "Turn-taking game", detail: "Any turn-based game; narrate the waiting and lose at least once.", tab: "adventures" },
  ],
};

/**
 * Compose the 7-day plan: every day carries its rotation mission plus one
 * aimed extra. Extras lean toward the recommendation domain (3 of 7 days),
 * the rest rotate the other domains so breadth survives.
 */
export function composeWeek(
  bands: DomainBand[],
  recommendation: CopilotRecommendation,
  today: string
): JourneyDay[] {
  const start = new Date(`${today}T12:00:00`);
  start.setDate(start.getDate() - start.getDay()); // back to Sunday
  const focus = recommendation.domain;
  const others = (["language", "speech", "cognition", "social", "emotional"] as PracticeDomain[])
    .filter((d) => d !== focus)
    .sort((a, b) => (bands.find((x) => x.domain === a)?.signal ?? 50) - (bands.find((x) => x.domain === b)?.signal ?? 50));
  // Day-domain layout: focus on Mon/Wed/Sat; others fill the rest, weakest first.
  const layout: PracticeDomain[] = [others[0], focus, others[1], focus, others[2], others[3], focus];

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const startDay = new Date(d.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((d.getTime() - startDay.getTime()) / 86400000);
    const mission = MISSION_CYCLE[dayOfYear % MISSION_CYCLE.length];
    const domain = layout[i];
    const options = EXTRA_BY_DOMAIN[domain];
    const extra = options[dayOfYear % options.length];
    return { date, weekday: WEEKDAYS[d.getDay()], mission, extra, isToday: date === today };
  });
}

/* ---------------- Monthly objectives ---------------- */

/* KID-17: objectives are EFFORT targets (days, rounds, moments) — never an
   accuracy threshold, a "mostly first-try" verdict, or a grade. */
const OBJECTIVE_TEMPLATES: Record<PracticeDomain, string[]> = {
  speech: ["Practice one target sound on 8 different days", "Practice speech sounds on 12 different days"],
  language: ["Play with 15 new words", "Complete 8 Words/Express rounds"],
  emotional: ["Name feelings in 10 real moments", "Do 8 calm-down practices in calm times"],
  cognition: ["Finish 4 adventures together", "Play the bigger Memory Match grid"],
  social: ["Complete 4 story journeys and talk about the choice", "Practice losing gracefully 6 times"],
};

/** The canonical, signal-free domain rotation used when the charter names no aim. */
const DOMAIN_ROTATION: PracticeDomain[] = ["language", "speech", "cognition", "social", "emotional"];

/**
 * KID-17: the family's charter virtues (lib/becoming.aimVirtues) mapped to the
 * practice domains that build them, order preserved, de-duplicated. This is
 * what steers objective order — the family's stated aims, never the child's
 * weakest signal.
 */
const VIRTUE_DOMAIN: Record<DevelopmentMetricId, PracticeDomain> = {
  empathy: "emotional",
  resilience: "emotional",
  courage: "social",
  responsibility: "social",
  wisdom: "cognition",
  truth: "language",
};
export function aimDomains(virtues: DevelopmentMetricId[]): PracticeDomain[] {
  const out: PracticeDomain[] = [];
  for (const v of virtues) {
    const d = VIRTUE_DOMAIN[v];
    if (d && !out.includes(d)) out.push(d);
  }
  return out;
}

/**
 * Suggest 3 objectives for the month. Order: the family's charter-aimed
 * domains first (in charter order), then the canonical rotation to fill —
 * never sorted by signal, so no objective is a silent weakest-domain pointer.
 * `bands` is accepted for call-site compatibility only; it does not influence
 * the pick.
 */
export function suggestObjectives(bands: DomainBand[], month: string, preferred: PracticeDomain[] = []): JourneyObjective[] {
  void bands;
  const order: PracticeDomain[] = [];
  for (const d of [...preferred, ...DOMAIN_ROTATION]) if (!order.includes(d)) order.push(d);
  const picks: { domain: PracticeDomain; idx: number }[] = [
    { domain: order[0], idx: 0 },
    { domain: order[1], idx: 0 },
    { domain: order[2], idx: 1 },
  ];
  return picks.map((p, i) => ({
    id: `obj-${month}-${p.domain}-${i}`,
    month,
    title: OBJECTIVE_TEMPLATES[p.domain][p.idx] ?? OBJECTIVE_TEMPLATES[p.domain][0],
    domain: p.domain,
    done: false,
    createdAt: new Date().toISOString(),
  }));
}
