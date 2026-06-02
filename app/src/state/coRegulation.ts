/**
 * E-01 — Immediate co-regulation scripts for the panic button.
 *
 * These must work at 11pm with a screaming child, instantly, offline, with no
 * model call. They are warm, short, and parent-first: the parent regulates
 * themselves before the child can borrow their calm. Curated, not generated,
 * so they are always available and always safe.
 */

export type CoRegulationScript = {
  id: string;
  /** Short label the parent taps. */
  situation: string;
  /** Keywords used to pick the best script from free text. */
  match: string[];
  /** What the parent does with their body first. */
  forParent: string;
  /** Exact words to say, calm and short. */
  say: string;
  /** The trap to avoid in the moment. */
  avoid: string;
};

export const CO_REGULATION_SCRIPTS: CoRegulationScript[] = [
  {
    id: "meltdown",
    situation: "Meltdown / tantrum",
    match: ["meltdown", "tantrum", "screaming", "crying", "rage", "kicking", "throwing"],
    forParent: "Lower yourself to their eye level. Drop your shoulders. Slow your own breath first — they will borrow it.",
    say: "I'm here. You're safe. I'm not going anywhere. We'll get through this together.",
    avoid: "Don't reason, lecture, or threaten right now. A flooded brain can't hear words — it only feels your calm."
  },
  {
    id: "bedtime",
    situation: "Won't sleep",
    match: ["sleep", "bedtime", "night", "won't stay", "keeps getting up", "wake"],
    forParent: "Keep your voice low and boring. Reduce light and stimulation. Be a quiet, steady wall, not a debate partner.",
    say: "It's sleep time now. I'll sit right here. Nothing else needs to happen — just rest.",
    avoid: "Don't start new conversations or negotiations. Repeat the same calm line; predictability is the medicine."
  },
  {
    id: "screen",
    situation: "Screen turned off",
    match: ["screen", "tablet", "ipad", "tv", "phone", "youtube", "game"],
    forParent: "Hold the boundary with a warm face. Name the want before the limit. Expect the protest — it's not defiance, it's grief.",
    say: "You really wanted more. It's hard to stop. The screen is done for today, and I'm right here with the hard feeling.",
    avoid: "Don't turn it back on to stop the crying. One more time teaches that the storm works."
  },
  {
    id: "siblings",
    situation: "Sibling fight",
    match: ["sibling", "brother", "sister", "fighting", "hitting each other", "sharing"],
    forParent: "Get between them calmly. Protect bodies first, sort fairness later. Narrate, don't interrogate.",
    say: "I won't let anyone get hurt. Bodies are safe. Let's take a breath, then we'll figure it out.",
    avoid: "Don't run a courtroom now. Finding who started it can wait until everyone is calm."
  },
  {
    id: "hitting",
    situation: "Hitting / aggression",
    match: ["hit", "hitting", "bite", "kick", "aggressive", "hurt me"],
    forParent: "Calmly block the hand. Stay close but safe. Your steadiness tells them the feeling is survivable.",
    say: "I won't let you hit. I'll keep us both safe. You can be this angry and still be loved.",
    avoid: "Don't hit back, yell, or shame. Big consequences land later; safety and calm land now."
  },
  {
    id: "overwhelm",
    situation: "I'm overwhelmed",
    match: ["overwhelmed", "i can't", "losing it", "exhausted", "done", "breaking"],
    forParent: "This script is for YOU. Put the child somewhere safe. Step back one metre. Breathe out longer than you breathe in.",
    say: "(to yourself) I am the adult. I can be calm even when it's hard. This moment will pass.",
    avoid: "Don't make a big decision while flooded. If you fear losing control, get another adult now."
  }
];

const DEFAULT_SCRIPT = CO_REGULATION_SCRIPTS[0];

/** Pick the best-matching co-regulation script from free text, else a safe default. */
export const pickCoRegulationScript = (text?: string): CoRegulationScript => {
  if (!text) return DEFAULT_SCRIPT;
  const lower = text.toLowerCase();
  let best = DEFAULT_SCRIPT;
  let bestScore = 0;
  for (const script of CO_REGULATION_SCRIPTS) {
    let score = script.match.reduce((acc, keyword) => (lower.includes(keyword) ? acc + 1 : acc), 0);
    // "meltdown" matches generic emotion words (rage, crying) that also appear
    // alongside a specific trigger ("rage when the tablet went off"). Treat it
    // as the fallback so a specific situational script wins an otherwise tie.
    if (score > 0 && script.id === "meltdown") score -= 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = script;
    }
  }
  return best;
};

/** A simple box-breathing cadence (seconds) used by the breathing pacer. */
export const BREATHING_CADENCE = { inhale: 4, hold: 4, exhale: 6 } as const;
