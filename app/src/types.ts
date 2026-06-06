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
