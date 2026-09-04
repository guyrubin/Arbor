/* keepsakeCounts — ENG-14(a): "Arbor knows {n} things about {name}".
 *
 * THE DEFECT THIS CLOSES
 * ──────────────────────
 * Compounding value was invisible in week 1. The dev-map card returns null
 * until devScore confidence exists; ProgressNarrative is skipped on day 0; the
 * "Arbor remembers" counter only renders inside the since-strip, for RETURNING
 * parents who already have rows. So the newest parent — the one who most needs
 * to see the record growing — saw nothing grow at all, and ChildMemory (the
 * moat) had no pointer from anywhere.
 *
 * CLINICAL FIREWALL — THIS IS A COUNT, AND ONLY A COUNT
 * ────────────────────────────────────────────────────
 * `total` is how many things Arbor holds. It is NOT:
 *   - a completeness score (there is no denominator, and none may be added);
 *   - progress toward a target (there is no target, and none may be invented);
 *   - a comparison with last week (there is no delta, and none may be shown);
 *   - a judgement about the parent (7 is not better than 3).
 * The returned shape carries no maximum, no ratio and no trend precisely so a
 * render surface cannot draw a ring or a bar from it. Adding a denominator
 * here is a firewall breach, not a feature.
 */

/** The parts that make up what Arbor knows — each a plain count. */
export interface KnowsInput {
  /** Facts the parent filled in on the profile (name, age, interests…). */
  profileFacts: number;
  /** Moments kept. */
  moments: number;
  /** Milestones the parent noticed. */
  milestones: number;
  /** Memories the parent explicitly approved. */
  memories: number;
}

export interface KnowsPart {
  /** Stable id → i18n key (elev.knows.part.<id>), never display copy. */
  id: "profile" | "moments" | "milestones" | "memories";
  count: number;
}

export interface KnowsCount {
  total: number;
  /** Only the parts that actually have something — an empty part is not a gap
   *  to be shamed with a zero row. */
  parts: KnowsPart[];
}

const clamp = (n: number) => Math.max(0, Math.trunc(n) || 0);

/**
 * The profile facts a parent has actually given, counted honestly: a field
 * left blank is simply not counted. There is no "profile 60% complete" here
 * and there must never be one.
 */
export function countProfileFacts(profile: {
  name?: string;
  age?: number | null;
  ageMonths?: number | null;
  birthDate?: string;
  languages?: readonly unknown[];
  strengths?: readonly unknown[];
  interests?: readonly unknown[];
  challenges?: readonly unknown[];
  photoUrl?: string;
} | null | undefined): number {
  if (!profile) return 0;
  let n = 0;
  if (profile.name && profile.name.trim()) n += 1;
  const hasAge =
    typeof profile.ageMonths === "number" ||
    (typeof profile.age === "number" && profile.age >= 0) ||
    !!(profile.birthDate && profile.birthDate.trim());
  if (hasAge) n += 1;
  for (const list of [profile.languages, profile.strengths, profile.interests, profile.challenges]) {
    if (list && list.length) n += list.length;
  }
  if (profile.photoUrl && profile.photoUrl.trim()) n += 1;
  return n;
}

/** Sum the parts. Pure. Negative/NaN inputs degrade to 0, never to a lie. */
export function arborKnows(input: KnowsInput): KnowsCount {
  const parts: KnowsPart[] = [
    { id: "profile", count: clamp(input.profileFacts) },
    { id: "moments", count: clamp(input.moments) },
    { id: "milestones", count: clamp(input.milestones) },
    { id: "memories", count: clamp(input.memories) },
  ];
  return {
    total: parts.reduce((sum, p) => sum + p.count, 0),
    parts: parts.filter((p) => p.count > 0),
  };
}
