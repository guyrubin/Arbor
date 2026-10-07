/**
 * B-CAREPRO-42 — "therapist" splits into OT, PT and psychology presets.
 *
 * The DATA for the three new consult presets, cloned from the clinician
 * template (consult/packet.ts `clinicianPreset`: the parent's reason and
 * questions + the shared clinician sections, then the ONE evidence section the
 * discipline reads) with each discipline's intake schema: the history
 * questions that profession asks at a first visit, which the parent answers in
 * their own words (never scored, never compared). `therapist` stays as
 * "another clinician" (the generalist ceiling).
 *
 * consult/packet.ts owns `ConsultAudience` / `CONSULT_PRESETS` and is held by
 * another session; this module is the seam it imports (the packet hunk is in
 * REJECTIONS P2-WORDS, B-CAREPRO-42). Pure data; zero runtime model calls.
 *
 * CLINICAL FIREWALL: a schema question asks for the parent's account
 * ("When did she first…?", "What happens when…?"); no question asks the parent
 * to grade the child, and no answer is turned into a count against a norm.
 */

export type SplitClinicianAudience = "ot" | "pt" | "psychology";
export const SPLIT_CLINICIAN_AUDIENCES: readonly SplitClinicianAudience[] = ["ot", "pt", "psychology"];

/** The shared clinician base (mirrors consult/packet.ts PARENT_VOICE_SECTIONS + CLINICIAN_SECTIONS). */
export const CLINICIAN_BASE_SECTIONS = ["reason", "questions", "about", "patterns", "moments", "development", "tried", "adults", "memory", "since-last-visit"] as const;

export interface SplitClinicianPreset {
  audience: SplitClinicianAudience;
  /** The packet sections this audience receives: the clinician base + its evidence section(s). */
  sections: readonly string[];
  /** Same data ceiling as every clinician preset. */
  dataCeiling: { logDerivedPatterns: true; approvedMemoryFacts: true };
  clinicalTermScan: false;
  /** lib/shareScopes id (`report_<audience>`). */
  shareScope: `report_${SplitClinicianAudience}`;
  /** The consult/packet IntakeProfession chip this preset answers to. */
  intake: SplitClinicianAudience;
  /** i18n: the preset's chip label (elev.words.consult.preset.<audience>). */
  labelKey: string;
  /** The intake schema: one i18n key per history question, in the order the professional asks. */
  intakeQuestions: readonly string[];
}

const q = (audience: SplitClinicianAudience, ids: readonly string[]) => ids.map((id) => `elev.words.consult.${audience}.q.${id}`);

const preset = (audience: SplitClinicianAudience, extra: readonly string[], questions: readonly string[]): SplitClinicianPreset => ({
  audience,
  sections: [...CLINICIAN_BASE_SECTIONS, ...extra],
  dataCeiling: { logDerivedPatterns: true, approvedMemoryFacts: true },
  clinicalTermScan: false,
  shareScope: `report_${audience}`,
  intake: audience,
  labelKey: `elev.words.consult.preset.${audience}`,
  intakeQuestions: q(audience, questions),
});

export const SPLIT_CLINICIAN_PRESETS: Record<SplitClinicianAudience, SplitClinicianPreset> = {
  // Occupational therapy: hands, self-care, and how the body takes in the world.
  ot: preset("ot", [], ["hands", "selfCare", "sensory", "play", "school"]),
  // Physiotherapy: how the body moves — the milestones the parent saw, and when.
  pt: preset("pt", ["growth-measurements"], ["firstSteps", "moving", "falls", "tiring", "pain"]),
  // Psychology: feelings, behaviour and what came first, in the parent's words.
  psychology: preset("psychology", ["triggers"], ["feelings", "hardMoments", "sleep", "friends", "family"]),
};

/** True for the three split presets. */
export function isSplitClinicianAudience(v: unknown): v is SplitClinicianAudience {
  return typeof v === "string" && (SPLIT_CLINICIAN_AUDIENCES as readonly string[]).includes(v);
}
