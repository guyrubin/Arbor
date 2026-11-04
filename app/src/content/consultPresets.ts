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
export const CLINICIAN_BASE_SECTIONS = ["reason", "questions", "about", "patterns", "moments", "development", "tried", "everyday-plans", "adults", "memory", "since-last-visit"] as const;

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

/* ── B-CAREPRO-39 — the speech-therapist intake schema (DARK until signed) ───
 *
 * The questions a speech-language therapist asks at intake, answered in the
 * SLP packet from what the family already recorded, or "Not recorded yet".
 * Nothing is scored, compared or graded: an answer is the parent's own
 * milestone answer (dated), a COUNT of the words they logged per language,
 * or the parent's hearing answer (B-NEXT-01). No question carries an age, a
 * number or a cut-off; no answer is turned into a verdict (MDR line).
 *
 * DARK: the schema ships unsigned. consult/packet buildIntakePacket renders
 * the Intake section ONLY for a schema whose `signedBy` and `signedOn` are
 * both set — the clinical reviewer's sign-off (GA B-GA-01, D3). Until then no
 * parent-facing surface shows it. Signing = filling those two fields in this
 * file with the reviewer's sign-off note committed beside it.
 */
export type SlpIntakeSource =
  /** The parent's own answers to these catalogue milestones (lib/milestoneData ids). */
  | { kind: "milestones"; ids: readonly string[] }
  /** The words and phrases the parent logged (Language Lab), counted by language. */
  | { kind: "langObs" }
  /** The parent's hearing answer (lib/hearingCheck, B-NEXT-01). */
  | { kind: "hearing" }
  /** Nothing in the record answers it yet: always "Not recorded yet". */
  | { kind: "none" };

export interface SlpIntakeQuestion {
  id: string;
  /** i18n key (EN + HE, lib/i18nElevation/words.ts), `{name}` = the child's first name. */
  key: string;
  source: SlpIntakeSource;
}

export interface SlpIntakeSchema {
  version: string;
  /** The clinical reviewer's name — null while unsigned (the section stays dark). */
  signedBy: string | null;
  /** ISO date of the sign-off — null while unsigned. */
  signedOn: string | null;
  questions: readonly SlpIntakeQuestion[];
}

const slpQ = (id: string, source: SlpIntakeSource): SlpIntakeQuestion => ({ id, key: `elev.words.consult.slp.q.${id}`, source });

export const SLP_INTAKE_SCHEMA: SlpIntakeSchema = {
  version: "0.1.0-draft",
  signedBy: null,
  signedOn: null,
  questions: [
    slpQ("firstWords", { kind: "milestones", ids: ["cdc-12m-3", "cdc-15m-3"] }),
    slpQ("wordsNow", { kind: "langObs" }),
    slpQ("twoWords", { kind: "milestones", ids: ["cdc-24m-3"] }),
    slpQ("understands", { kind: "milestones", ids: ["cdc-12m-4", "cdc-15m-9", "cdc-18m-5"] }),
    slpQ("understood", { kind: "milestones", ids: ["asha-comm-24m", "cdc-36m-3", "asha-comm-48m"] }),
    slpQ("hearing", { kind: "hearing" }),
    slpQ("feeding", { kind: "milestones", ids: ["asha-feed-9m", "asha-feed-12m", "asha-feed-24m"] }),
    slpQ("family", { kind: "none" }),
    slpQ("lostWords", { kind: "none" }),
  ],
};

/** Lit only by the reviewer's signature (both fields). */
export const slpIntakeSigned = (schema: Pick<SlpIntakeSchema, "signedBy" | "signedOn"> = SLP_INTAKE_SCHEMA): boolean =>
  !!schema.signedBy?.trim() && !!schema.signedOn && Number.isFinite(Date.parse(schema.signedOn));
