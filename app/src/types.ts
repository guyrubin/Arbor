export interface ChildProfile {
  id: string;
  name: string;
  age: number;
  languages: string[];
  schoolContext: string;
  strengths: string[];
  challenges: string[];
  riskLevel: 'Low' | 'Moderate' | 'High';
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

export interface Milestone {
  id: string;
  domain: DevelopmentalDomainId;
  ageGroup: string;
  title: string;
  description: string;
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
  | 'wisdom';

export type DevelopmentMetrics = Record<DevelopmentMetricId, number>;

export type HeroPackId = 'courage' | 'responsibility' | 'growth' | 'wisdom';

/** A choice offered at the Decision beat. Selecting it moves the child's metrics. */
export interface HeroChoice {
  id: string; // 'a' | 'b' | 'c'
  /** Fallback label (English); the AI personalizes the rendered label. */
  label: string;
  /** Short consequence cue the AI expands into the Consequence beat. */
  outcomeHint: string;
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
  /** Canonical one-line beat summary the AI must follow (English). */
  spine: string;
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
  /** Base metric points awarded for completing the journey (before the choice). */
  baseReward: Partial<DevelopmentMetrics>;
  beats: HeroBeat[];
  learningObjective: string;
  parentReflection: { practiced: string[]; questions: string[] };
}

/** AI-personalized rendering of one beat for a specific child. */
export interface HeroSceneRender {
  beatId: HeroBeatId;
  title: string;
  narration: string;
  imagePrompt: string;
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
  | 'expressive';       // open question / scene description / story starter

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
