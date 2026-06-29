/**
 * Canonical scholar registry (v4 D1 / SCH-1). One source of truth that makes the
 * scholar lens *load-bearing*: it maps a (possibly free-text) lens to a stable
 * scholar, the knowledge card(s) that back it, the domains it speaks to, its
 * default Six Frame, and — critically — the scholar's actual *method*, which is
 * injected into the coach prompt so selecting a lens changes how the model reasons.
 */
export type ScholarEntry = {
  id: string;            // canonical slug
  name: string;          // display name (matches scholarsInfo.name)
  concept: string;       // parent-facing engine name
  method: string;        // the actual approach, injected into the prompt
  defaultFrame: string;  // Six Frame key
  domains: string[];     // developmental domains this lens speaks to
  cardIds: string[];     // knowledge card ids that back this lens
};

export const SCHOLARS: ScholarEntry[] = [
  {
    id: "vygotsky", name: "Lev Vygotsky", concept: "Next Best Challenge",
    method: "Find the edge of what the child can do with support, then scaffold one small step beyond it and fade help as mastery grows. Avoid both boredom (too easy) and overwhelm (too hard): model it, do it together, then hand it over.",
    defaultFrame: "aim", domains: ["cognition_executive_function", "language_communication"], cardIds: ["vygotsky-zpd"],
  },
  {
    id: "bowlby", name: "John Bowlby", concept: "Attachment & Repair",
    method: "Read distress as dysregulated communication, not misbehavior. Restore the secure base first — co-regulate and reconnect — then repair the rupture with a short, honest reconnection before any teaching.",
    defaultFrame: "twoAxes", domains: ["attachment_regulation"], cardIds: ["bowlby-secure-base"],
  },
  {
    id: "winnicott", name: "Donald Winnicott", concept: "Good Enough Parent",
    method: "Lower parental pathologizing and guilt — 'good enough' beats perfect. Honor transitional comfort objects and provide a safe holding environment with steady, non-anxious boundaries.",
    defaultFrame: "shadow", domains: ["attachment_regulation", "ecosystem_stressors"], cardIds: ["winnicott-good-enough-parent"],
  },
  {
    id: "montessori", name: "Maria Montessori", concept: "Independence Planner",
    method: "Prepare the environment so the child can succeed independently: child-accessible setups, clear sequences, and structured freedoms. Replace restraint with practical autonomy and protect the child's concentration.",
    defaultFrame: "aim", domains: ["independence_adaptive_skills", "sensory_motor_patterns"], cardIds: ["montessori-prepared-environment"],
  },
  {
    id: "bronfenbrenner", name: "Urie Bronfenbrenner", concept: "Child Ecosystem Map",
    method: "Look beyond the child to the systems around them — home, school, peers, routines, stressors — and the connections between them. Change the environment and those links, not only the child's behavior.",
    defaultFrame: "marriage", domains: ["ecosystem_stressors", "social_development"], cardIds: ["bronfenbrenner-ecosystem"],
  },
  {
    id: "piaget", name: "Jean Piaget", concept: "Developmental Stage Match",
    method: "Match expectations to the child's cognitive stage. In early childhood expect concrete, egocentric, sometimes magical thinking; teach through hands-on experience and avoid abstract reasoning the stage cannot yet support.",
    defaultFrame: "aim", domains: ["cognition_executive_function"], cardIds: ["piaget-stages"],
  },
  {
    id: "erikson", name: "Erik Erikson", concept: "Developmental Arc",
    method: "Frame the moment within the child's current psychosocial task (e.g. autonomy vs. shame, initiative vs. guilt) and support its healthy resolution with encouragement and stage-appropriate independence.",
    defaultFrame: "story", domains: ["independence_adaptive_skills", "social_development"], cardIds: ["erikson-developmental-arc"],
  },
  {
    id: "integrated", name: "Integrated Balanced", concept: "Integrated",
    method: "Blend the lenses: secure the relationship first (Bowlby), set the next achievable challenge (Vygotsky), and adjust the surrounding environment (Bronfenbrenner). Lead with connection, then capability, then context.",
    defaultFrame: "aim", domains: [], cardIds: ["bowlby-secure-base", "vygotsky-zpd", "bronfenbrenner-ecosystem"],
  },
];

export const INTEGRATED = SCHOLARS.find((s) => s.id === "integrated")!;

/** Resolve a (possibly free-text) lens string to a canonical scholar. Tolerates
 *  "Lev Vygotsky", "Vygotskian Scaffolding", "Bowlby's Attachment Model", etc. */
export function resolveScholar(lens?: string | null): ScholarEntry {
  if (!lens) return INTEGRATED;
  const l = lens.toLowerCase();
  if (l.includes("integrated") || l.includes("balanced")) return INTEGRATED;
  return (
    SCHOLARS.find((s) => {
      if (s.id === "integrated") return false;
      const last = s.name.split(" ").pop()!.toLowerCase();
      const stem = last.slice(0, 6); // tolerates "Vygotskian", "Eriksonian", etc.
      return l.includes(s.id) || l.includes(s.name.toLowerCase()) || l.includes(last) || l.includes(stem) || s.concept.toLowerCase() === l;
    }) || INTEGRATED
  );
}

export function getScholarById(id: string): ScholarEntry | undefined {
  return SCHOLARS.find((s) => s.id === id);
}
