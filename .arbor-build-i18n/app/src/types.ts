import type { PlayDomain } from "./playbank/content";

export interface ChildProfile {
  id: string;
  name: string;
  age: number;
  languages: string[];
  schoolContext: string;
  strengths: string[];
  challenges: string[];
  riskLevel: 'Low' | 'Moderate' | 'High';
  /** Optional profile image — a generated stylized avatar, or a raw photo
   *  (Firebase Storage URL, or an inlined data URL fallback). Rendered by `Avatar`. */
  photoUrl?: string;
  /** Metadata for an AVA-1 generated avatar. The raw reference photo is never stored. */
  avatar?: {
    style: string;
    /** 'descriptor' = built from text cues (no face); 'photo' = stylized from a reference photo. */
    source: 'descriptor' | 'photo';
    createdAt: string;
  };
  /**
   * CI-28: Parent-selected developmental focus goals (1–3).
   * Each entry is a curated goal from GOAL_TILES — never auto-assigned.
   * Written only via explicit parent selection in GoalBuilderModal (gate §D).
   * Feeds Daily Play selector at 1.6× weight on the matching domain.
   * COPPA note: this field stores parent-expressed intent (not child assessment).
   * Gate §E: arbor-safety COPPA review required before shipping to prod.
   */
  activeGoals?: import('./practice/goalBuilder').ActiveGoal[];
  /**
   * CI-29: Parent-entered interest tags (e.g. "Trains", "Dinosaurs").
   * Parent-facing only — the child never enters this field.
   * Preference record only; never interpreted as a clinical/behavioral signal.
   * Feeds Daily Play interest-boost scoring (deterministic, LLM-free).
   * COPPA gate: arbor-safety COPPA/GDPR review required before prod.
   * Clinical gate: interest record is displayed, never interpreted (FDI-04/CI-24 veto class).
   */
  interests?: string[];
  /** ISO timestamp of the last time interests[] was written. */
  interestsUpdatedAt?: string;
  /**
   * Prematurity adjustment (AAP): for babies born preterm, developmental
   * milestones are compared against *corrected* (adjusted) age until ~2 years.
   * `gestationalWeeks` is the gestation at birth (e.g. 32). Term is 40 weeks;
   * the correction is `(40 - gestationalWeeks)` weeks subtracted from chronological age.
   */
  preterm?: {
    gestationalWeeks: number;
  };
  /**
   * B0 — months-precise age spine.
   *
   * Preferred: ISO date string (YYYY-MM-DD) of the child's birth. When present,
   * `lib/childAge.ts` computes exact months from today so a 9-month-old is never
   * stored or shown as age 0.
   *
   * Fallback 1: `ageMonths` — an explicit months value the parent confirmed during
   * onboarding (used when the parent entered an approximate age rather than a DOB).
   *
   * Fallback 2: `age` (whole years, already present) — multiplied by 12 for
   * screens that need months precision but were created before B0. The `age` field
   * MUST stay populated for back-compat with all existing `.age` readers.
   *
   * Append-only: never reorder or remove existing ChildProfile members.
   */
  birthDate?: string;
  ageMonths?: number;
}

export type BehaviorContext = 'Home' | 'School' | 'Transit' | 'Public';

export type DevelopmentalDomainId =
  | 'attachment_regulation'
  | 'language_communication'
  | 'cognition_executive_function'
  | 'social_development'
  | 'independence_adaptive_skills'
  | 'sensory_motor_patterns'
  | 'ecosystem_stressors';

export interface FrameRouting {
  aim: string;
  twoAxes: string;
  story: string;
  shadow: string;
  marriage: string;
  shepherd: string;
}

export interface MemoryReviewItem {
  memoryId: string;
  childId: string;
  status: 'pending' | 'approved' | 'rejected' | 'deleted';
  fact: string;
  source: string;
  retention: string;
  createdAt: string;
  prompt?: string;
  frameRouting?: FrameRouting;
  latestEventId: string;
}

export type ShareRole = 'co_parent' | 'viewer' | 'professional';
export interface ShareGrant {
  id: string;
  ownerUid: string;
  ownerEmail: string | null;
  childId: string;
  childName: string | null;
  recipientEmail: string;
  role: ShareRole;
  scopes: string[];
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

/** M9: proof-of-deletion receipt returned by a full child-data erase. */
export interface DeletionReceipt {
  childId: string;
  erasedAt: string;
  counts: { memoryEvents: number; shares: number; consents?: number };
}

/** COPPA-2026 consent purposes + grant record (client mirror of sharing/consent.ts). */
export type ConsentPurpose = "face_processing" | "voice_processing" | "ai_training";
export interface ConsentGrant {
  id: string;
  childId: string;
  purpose: ConsentPurpose;
  granted: boolean;
  policyVersion: string;
  actorUid: string;
  grantedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface CouncilTake {
  scholarId: string;
  name: string;
  concept: string;
  takeaway: string;
  suggestion: string;
}

export interface CoachContract {
  riskLevel: string;
  ageBand: string;
  domains: DevelopmentalDomainId[];
  nonDiagnosticHypotheses: { label: string; confidence: string; rationale: string }[];
  todayPlan: string[];
  parentScript: string;
  avoid: string[];
  observe: string[];
  escalateIf: string[];
  frameRouting: FrameRouting;
  memoryProposals: { fact: string; source: string; retention: string }[];
  handoffNotes: { teacher: string; professional: string };
  /** Knowledge-card IDs used to ground this answer (populated by the server). */
  sourceCardsUsed?: string[];
}

export interface BehaviorLog {
  id: string;
  timestamp: string;
  behaviorType: string;
  intensity: number; // 1-5
  durationMinutes: number;
  trigger: string;
  response: string;
  notes?: string;
  context?: BehaviorContext;
  resolved?: boolean;
  resolutionNotes?: string;
  photoAttachment?: string;
}

/** A completed Daily Play activity — a positive, lightweight "win" written to
 *  the moat (synced per child) so it shows in the Story timeline and survives a
 *  device switch. Deliberately NOT a BehaviorLog (incident-shaped) so it never
 *  pollutes concern-domain ranking. id is idempotent per activity per day. */
export interface PlayLog {
  id: string; // = `${activityId}.${YYYY-MM-DD}` — idempotent per day
  activityId: string;
  title: string; // denormalized for timeline display without re-lookup
  domain: PlayDomain;
  // CI-28/29 widened this to match ScoredActivity.reason (select.ts): the
  // Daily Plan Generator persists goal-match / interest-match picks too. Purely
  // additive — existing concern/stage values stay valid (zero regression).
  reason: "concern-match" | "stage-match" | "goal-match" | "interest-match";
  source: "today" | "library" | "course";
  timestamp: string; // ISO
}

export interface Milestone {
  id: string;
  domain: DevelopmentalDomainId;
  /** Human-readable checklist label, e.g. "9 months" or "Age 4-5". */
  ageGroup: string;
  /**
   * Numeric anchor for the checklist in months (e.g. 9, 24, 60). Drives
   * corrected-age comparison for preterm infants. Optional for legacy/custom items.
   */
  ageMonths?: number;
  title: string;
  /** Short summary line shown under the title (the CDC-style "most children…" phrasing). */
  description: string;
  /**
   * Plain-language "what the skill looks like" — a concrete, everyday picture of
   * the behavior a parent can actually watch for. Optional; falls back to `description`.
   */
  skillLooksLike?: string;
  checked: boolean;
  references?: { label: string; url: string }[];
  custom?: boolean;
}

export type StepStatus = 'todo' | 'doing' | 'done';

export interface ActionPlan {
  id: string;
  title: string;
  issue: string;
  phases: {
    name: string;
    description: string;
    steps: { text: string; completed: boolean; status?: StepStatus }[];
  }[];
  scripts: { scenario: string; say: string; avoid: string }[];
  successIndicators: string[];
}

export interface BedtimeStory {
  title: string;
  pages: string[];
  illustrationPrompt: string;
  discussionQuestions: string[];
  summary: string;
}

// ── Hero Journey Engine ──────────────────────────────────────────────────────
// Children aged 4–8 become the hero inside archetypal, developmentally-loaded
// stories. The plot is a fixed, vetted "spine" authored in the catalog
// (lib/heroJourneys.ts); the AI only personalizes the narration to the child.

export type DevelopmentMetricId =
  | 'courage'
  | 'responsibility'
  | 'resilience'
  | 'empathy'
  | 'wisdom'
  | 'truth';

export type DevelopmentMetrics = Record<DevelopmentMetricId, number>;

export type HeroPackId = 'courage' | 'responsibility' | 'growth' | 'wisdom' | 'truth';

/** A choice offered at the Decision beat. Selecting it moves the child's metrics. */
export interface HeroChoice {
  id: string; // 'a' | 'b' | 'c'
  /** Fallback label (English); the AI personalizes the rendered label. */
  label: string;
  labelHe?: string;
  /** Short consequence cue the AI expands into the Consequence beat. */
  outcomeHint: string;
  outcomeHintHe?: string;
  metricDeltas: Partial<DevelopmentMetrics>;
}

export type HeroBeatId =
  | 'call'
  | 'challenge'
  | 'fear'
  | 'decision'
  | 'consequence'
  | 'growth'
  | 'victory'
  | 'reflection';

/** One fixed beat of the 8-beat hero spine. Only `decision` carries choices. */
export interface HeroBeat {
  id: HeroBeatId;
  title: string;
  titleHe?: string;
  /** Canonical one-line beat summary the AI must follow (English). */
  spine: string;
  spineHe?: string;
  choices?: HeroChoice[];
}

/** A complete, vetted story definition. Authored as data, never by the model. */
export interface HeroStorySpec {
  id: string; // 'david-and-goliath'
  pack: HeroPackId;
  title: string;
  titleHe: string;
  theme: string;
  origin: 'biblical' | 'original';
  ageRange: [number, number];
  primaryMetric: DevelopmentMetricId;
  /** What kind of dilemma the Decision beat poses — so the "hero move" isn't
   *  always the bravest-sounding option (prudence/repair/patience/truth differ). */
  dilemmaType?: 'courage' | 'prudence' | 'repair' | 'patience' | 'truth';
  /** Base metric points awarded for completing the journey (before the choice). */
  baseReward: Partial<DevelopmentMetrics>;
  beats: HeroBeat[];
  learningObjective: string;
  learningObjectiveHe?: string;
  themeHe?: string;
  parentReflection: { practiced: string[]; questions: string[]; practicedHe?: string[]; questionsHe?: string[] };
  /** Parent-facing archetypal ("why this story") reading, shown on the reflection
   *  beat. Calm senior-advisor voice; bilingual. */
  parentInsight?: { en: string; he: string };
}

/** AI-personalized rendering of one beat for a specific child. */
export interface HeroSceneRender {
  beatId: HeroBeatId;
  title: string;
  narration: string;
  imagePrompt: string;
  /** 2-3 punchy comic sound-effect words for THIS beat (e.g. ["BOOM!","WHOOSH!"]). */
  sfx?: string[];
  /** One short hero line for a speech bubble on this beat's comic panel. */
  dialogue?: string;
}

/** The personalized choice text the model returns for the Decision beat. */
export interface HeroChoiceRender {
  id: string; // matches HeroChoice.id
  label: string;
  consequence: string;
}

/** The full personalized payload returned by POST /api/generate-hero-journey. */
export interface HeroJourneyRender {
  storyId: string;
  title: string;
  scenes: HeroSceneRender[];
  choices: HeroChoiceRender[];
  reflection: { practiced: string[]; questions: string[] };
}

/** A completed (or in-progress) journey, persisted per child. */
export interface HeroJourneyRun {
  id: string;
  storyId: string;
  title: string;
  language: 'en' | 'he';
  startedAt: string;
  completedAt?: string;
  choiceId?: string;
  metricsEarned: Partial<DevelopmentMetrics>;
  render: HeroJourneyRender;
}

export interface BehaviorAnalysis {
  frequencyCount: { [key: string]: number };
  intensityTrend: string; // "rising" | "decreasing" | "stable"
  triggerBreakdown: { trigger: string; percentage: number }[];
  effectivenessRating: string; // feedback on parent's responses
  expertInsights: {
    heading: string;
    text: string;
    scholarLens?: string;
  }[];
  actionPlanSuggestion: string;
}

export interface SchoolBrief {
  title: string;
  date: string;
  overview: string;
  keyStrengths: string[];
  classroomChallenges: string[];
  languageSupportPlan: string[];
  suggestedTeacherStrategies: string[];
  crisisEscalationTrigger: string;
}

/* ---------- Practice Studio (Fall release: speech & language suite) ---------- */

/** Where a practice item sits on the articulation ladder. */
export type SpeechLevel = 'sound' | 'word' | 'sentence' | 'story';

/** One scored articulation attempt. Audio never leaves the device — only the score is stored. */
export interface SpeechAttempt {
  id: string;
  sound: string;            // target sound id, e.g. "s", "r", "sh"
  level: SpeechLevel;
  target: string;           // the word/sentence practiced
  result: 'got' | 'almost' | 'missed';
  method: 'auto' | 'parent'; // browser speech recognition vs parent scoring
  heard?: string;            // what speech recognition transcribed (if auto)
  timestamp: string;
}

/** One mimic-mirror imitation round, parent-rated. Camera is local-only and unrecorded. */
export interface MimicSession {
  id: string;
  packId: string;
  promptId: string;
  rating: 1 | 2 | 3;         // 1 = tried it, 2 = close, 3 = nailed it
  timestamp: string;
}

/** A daily development mission's completion record. */
export interface MissionRecord {
  id: string;                // `${date}-${missionId}`
  date: string;              // YYYY-MM-DD
  missionId: string;
  domain: PracticeDomain;
  completed: boolean;
  timestamp: string;
}

/** One answered scene in a cognitive adventure. */
export interface AdventureResult {
  id: string;
  scenarioId: string;
  sceneId: string;
  skill: AdventureSkill;
  correct: boolean;
  timestamp: string;
}

export type PracticeDomain = 'language' | 'speech' | 'cognition' | 'social' | 'emotional';
export type AdventureSkill = 'vocabulary' | 'logic' | 'sequencing' | 'instructions' | 'abstract';

/* ---------- Ten-epics gap closure (assessment depth, play, journey) ---------- */

/** Generic practice/play interaction record powering passive assessment. */
export type PracticeEventKind =
  | 'emotion-id'        // matched a feeling to a face/scenario
  | 'emotion-why'       // explored why a feeling happens
  | 'calm'              // completed a breathing/calm-down exercise
  | 'memory'            // memory-match round
  | 'vocab-naming'      // named an object
  | 'vocab-category'    // sorted/picked within a category
  | 'expressive'        // open question / scene description / story starter
  | 'phonics'           // matched a letter to its sound (early reading)
  | 'sight-word'        // read/recognized a high-frequency sight word
  | 'letter-trace'      // traced a letter path in the tracing mini-game
  | 'rhythm'            // kept the beat in Beat Keeper (regulation/timing)
  | 'pattern'           // continued a sequence in Pattern Power (logic)
  | 'pose'              // copied a hero action pose in Hero Pose (body imitation)
  | 'lang-strategy';    // LANG-15: parent logged a serve-and-return / narrated-play / shared-reading moment

export interface PracticeEvent {
  id: string;
  kind: PracticeEventKind;
  domain: PracticeDomain;
  /** True/false where the round has a right answer; omitted for open-ended. */
  correct?: boolean;
  /** 0-100 where graded (e.g. memory round completion quality). */
  score?: number;
  meta?: string;
  timestamp: string;
}

/** Weekly persisted snapshot of the domain bands — the historical progression record. */
export interface BandSnapshot {
  id: string;            // ISO week key, e.g. "2026-W24"
  date: string;          // YYYY-MM-DD when taken
  bands: { domain: PracticeDomain; signal: number; band: string }[];
}

/** A monthly development objective on the Journey. */
export interface JourneyObjective {
  id: string;
  month: string;         // YYYY-MM
  title: string;
  domain: PracticeDomain;
  done: boolean;
  createdAt: string;
}

/**
 * Weekly snapshot of the Longitudinal Development Score (moat artifact, PRD C4).
 * The canonical shape lives in `growth/devScore.ts` (kept dependency-free); this
 * re-export makes the moat artifact discoverable alongside the other typed records.
 */
export type { DevScoreSnapshot } from "./growth/devScore";

/**
 * A `DevScoreSnapshot` as persisted in the child collection — adds the `id`
 * (ISO week key, e.g. "2026-W24") so it is idempotent per week and survives
 * device changes. Only `DevScoreCard` writes these; the Today strip is read-only.
 */
export interface StoredDevScoreSnapshot {
  id: string;            // ISO week key, e.g. "2026-W24"
  takenMs: number;
  overall: number;
  byDomain: Record<string, number>;
}

/**
 * C4 — Physical growth entry: a parent-logged measurement at a point in time.
 * Stored in the append-only "growthEntries" child collection (Firestore when
 * signed-in, localStorage in sandbox). All three measurements are optional so
 * parents can log whatever their pediatrician measured that visit. At least one
 * must be present (enforced by `isValidEntry` in growth/growthEntries.ts).
 *
 * NO percentile is computed — Arbor does not embed a WHO/CDC reference table,
 * so we show the raw longitudinal trajectory only and invite discussion with
 * the pediatrician. Parent-controlled data about their own child; no new
 * consent surface required.
 */
export interface GrowthEntry {
  id: string;
  childId: string;
  /** ISO-8601 date the measurement was taken, e.g. "2026-06-21". */
  date: string;
  heightCm?: number;
  weightKg?: number;
  headCircumferenceCm?: number;
  /** Optional free-text note (e.g. "at 18-month check-up"). */
  note?: string;
}
