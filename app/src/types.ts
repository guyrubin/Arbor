export interface ChildProfile {
  id: string;
  name: string;
  age: number;
  languages: string[];
  schoolContext: string;
  strengths: string[];
  challenges: string[];
  riskLevel: 'Low' | 'Moderate' | 'High';
  photoUrl?: string;
}

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
}

export interface Milestone {
  id: string;
  domain: DevelopmentalDomainId;
  ageGroup: string;
  title: string;
  description: string;
  checked: boolean;
}

export interface ActionPlan {
  id: string;
  title: string;
  issue: string;
  phases: {
    name: string;
    description: string;
    steps: { text: string; completed: boolean }[];
  }[];
  scripts: { scenario: string; say: string; avoid: string }[];
  successIndicators: string[];
  // Provenance + closed-loop fields (optional so existing seed data stays valid).
  childId?: string;
  createdAt?: string;
  source?: 'coach' | 'generated' | 'seed';
  sourcePrompt?: string;
  followUpDueAt?: string;
}

/**
 * A single thing the parent agreed to watch for over time, derived from a
 * coach answer's `observe` list. Closes the "Track over time" loop the PRD
 * promises (data-model object #8, previously unimplemented).
 */
export interface TrackingPrompt {
  id: string;
  childId: string;
  metric: string;
  prompt: string;
  frequency: 'daily' | 'weekly' | 'event';
  createdAt: string;
  sourcePrompt?: string;
  active: boolean;
}

export type OutcomeRating = 'worse' | 'same' | 'better' | 'resolved';

/**
 * The result of a saved plan, captured at follow-up. Feeds back into future
 * coach context (data-model object #9, previously unimplemented).
 */
export interface InterventionOutcome {
  id: string;
  planId: string;
  childId: string;
  rating: OutcomeRating;
  note?: string;
  createdAt: string;
}

export type FeedbackRating = 'useful' | 'partly' | 'not';

/**
 * A teacher/professional note fragment captured from a coach answer. Lets the
 * Handoff Hub compose from real logged interactions instead of a cold
 * regeneration (H-07).
 */
export interface HandoffFragment {
  id: string;
  childId: string;
  createdAt: string;
  prompt?: string;
  teacher: string;
  professional: string;
}

/** Per-answer usefulness rating — the measurable basis for the PRD's "70% useful today" metric. */
export interface AnswerFeedback {
  id: string;
  childId: string;
  messageRef: string;
  rating: FeedbackRating;
  note?: string;
  lens?: string;
  createdAt: string;
}

export interface BedtimeStory {
  title: string;
  pages: string[];
  illustrationPrompt: string;
  discussionQuestions: string[];
  summary: string;
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
