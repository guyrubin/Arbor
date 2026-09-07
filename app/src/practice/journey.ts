import type { DevelopmentMetricId, JourneyObjective, PracticeDomain } from "../types";
import { MISSION_CYCLE, type MissionTemplate } from "./content";
import type { CopilotRecommendation, DomainBand } from "./signals";

/* Journey composer (Epic 9 + Epic 4's weekly action plan output).
   Deterministic for a given week + bands: same plan all week for the family. */

/** R23 (Builder L) — every string this module composes is DATA that a parent
 *  reads on #/journey, and it was English-only, so a Hebrew family met 32 Latin
 *  lines on the door of their own practice week. The English stays (it is the
 *  fixture every test in this suite asserts against, and it is the fallback
 *  when a key is missing); `*Key` is what a rendered surface must use.
 *  Values live in `lib/i18nElevation/practiceDoors.ts` (EN + HE) — the module
 *  that already owns the JourneyTab chrome and the kid-world names. */
export interface JourneyExtra {
  title: string;
  detail: string;
  /** i18n keys for the two strings above; resolved by JourneyTab at render. */
  titleKey: string;
  detailKey: string;
  tab: "speech" | "feelings" | "adventures" | "stories" | "mimic";
}

export interface JourneyDay {
  date: string;              // YYYY-MM-DD
  weekday: string;           // "Mon"
  mission: MissionTemplate;
  /** The day's aimed extra — one concrete activity beyond the mission. */
  extra: JourneyExtra;
  isToday: boolean;
}

/** R23 — `MISSION_CYCLE` lives in practice/content.ts and carries the English
 *  title plus the 3-step parent script. JourneyTab renders the title and the
 *  FIRST step; both are keyed here, by mission id, so the data module keeps its
 *  shape and the rendering surface gets a language. `{name}` survives the
 *  translation in both locales — the caller still runs fillTemplate() over it. */
export const MISSION_COPY_KEYS: Record<string, { title: string; step: string }> = {
  "new-words":        { title: "elev.practice.journey.mission.new-words.title",        step: "elev.practice.journey.mission.new-words.step" },
  "emotion-spotting": { title: "elev.practice.journey.mission.emotion-spotting.title", step: "elev.practice.journey.mission.emotion-spotting.step" },
  "story-retell":     { title: "elev.practice.journey.mission.story-retell.title",     step: "elev.practice.journey.mission.story-retell.step" },
  "sound-safari":     { title: "elev.practice.journey.mission.sound-safari.title",     step: "elev.practice.journey.mission.sound-safari.step" },
  "social-play":      { title: "elev.practice.journey.mission.social-play.title",      step: "elev.practice.journey.mission.social-play.step" },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The canonical, signal-free domain order. Every pick in this module walks it;
 *  nothing here ever sorts the child's domains by band. */
const ROTATION: PracticeDomain[] = ["language", "speech", "cognition", "social", "emotional"];

const xk = (slug: string) => ({
  titleKey: `elev.practice.journey.extra.${slug}.title`,
  detailKey: `elev.practice.journey.extra.${slug}.detail`,
});

const EXTRA_BY_DOMAIN: Record<PracticeDomain, JourneyExtra[]> = {
  speech: [
    { title: "Speech Coach: today's sound", detail: "5 minutes on the current target sound — words first, then one silly sentence.", tab: "speech", ...xk("speech-sound") },
    { title: "Mimic Studio round", detail: "Two imitation rounds — mouth gymnastics count as speech practice.", tab: "mimic", ...xk("mimic-round") },
  ],
  language: [
    { title: "Words mode: naming hunt", detail: "Name 5 objects in one category (kitchen things, animals, clothes).", tab: "speech", ...xk("naming-hunt") },
    { title: "Express mode: question of the day", detail: "One open question at dinner — wait, then expand their answer back.", tab: "speech", ...xk("question-of-the-day") },
  ],
  emotional: [
    { title: "Feelings Lab: emotion match", detail: "One round of matching faces to feelings, then make the faces together.", tab: "feelings", ...xk("emotion-match") },
    { title: "Calm-down practice", detail: "One guided breathing exercise during a calm moment — that's when it sticks.", tab: "feelings", ...xk("calm-down") },
  ],
  cognition: [
    { title: "Adventure scene", detail: "One story scene with choices — thinking practice disguised as play.", tab: "adventures", ...xk("adventure-scene") },
    { title: "Memory Match round", detail: "One pairs round; the grid grows as they get stronger.", tab: "adventures", ...xk("memory-match") },
  ],
  social: [
    { title: "Story Journey", detail: "One hero story with a real choice — talk about what the hero felt after.", tab: "stories", ...xk("story-journey") },
    { title: "Turn-taking game", detail: "Any turn-based game; narrate the waiting and lose at least once.", tab: "adventures", ...xk("turn-taking") },
  ],
};

/** R23 — every extra this module can compose, for the coverage guard. */
export const JOURNEY_EXTRAS: JourneyExtra[] = Object.values(EXTRA_BY_DOMAIN).flat();

/**
 * Compose the 7-day plan: every day carries its rotation mission plus one
 * aimed extra. Extras lean toward the recommendation domain (3 of 7 days),
 * the rest rotate the other domains so breadth survives.
 */
export function composeWeek(
  bands: DomainBand[],
  recommendation: CopilotRecommendation,
  today: string,
  preferred: PracticeDomain[] = []
): JourneyDay[] {
  void bands;
  const start = new Date(`${today}T12:00:00`);
  start.setDate(start.getDate() - start.getDay()); // back to Sunday
  const focus = recommendation.domain;
  // OBJ-GROWTH-05 / KID-17: the aimed extras used to be ordered WEAKEST BAND
  // FIRST, which made the plan a ranked list of the child's areas dressed as
  // play. Order now comes from the family's charter aims (when the caller
  // passes them) and then the canonical rotation - the same signal-free
  // selector suggestObjectives() uses. `bands` is kept for call-site
  // compatibility only and never influences the pick.
  const others: PracticeDomain[] = [];
  for (const d of [...preferred, ...ROTATION]) if (d !== focus && !others.includes(d)) others.push(d);
  // Day-domain layout: focus on Mon/Wed/Sat; the others fill the rest in
  // charter-then-rotation order.
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

/** R23 — an objective is PERSISTED with its English `title` (the Firestore
 *  record predates this fix and a migration is not worth a display bug), so the
 *  key is looked up BY that title rather than by an index the record never
 *  kept. A row written before this change resolves exactly like a fresh one; a
 *  parent-authored objective has no entry and renders as the parent typed it. */
export const OBJECTIVE_TITLE_KEYS: Record<string, string> = Object.fromEntries(
  (Object.entries(OBJECTIVE_TEMPLATES) as [PracticeDomain, string[]][]).flatMap(([domain, titles]) =>
    titles.map((title, i) => [title, `elev.practice.journey.objective.${domain}.${i}`] as const),
  ),
);

/** The canonical, signal-free domain rotation used when the charter names no aim.
 *  OBJ-GROWTH-05: exported so signals.recommend() picks from the SAME order —
 *  one selector, no band ranking anywhere near a rendered pick. */
export const DOMAIN_ROTATION: PracticeDomain[] = ROTATION;

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
  for (const d of [...preferred, ...ROTATION]) if (!order.includes(d)) order.push(d);
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
