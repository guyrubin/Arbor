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
  domains: string[];
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
}

export interface Milestone {
  id: string;
  domain: 'Emotional' | 'Language' | 'Social' | 'Motor' | 'Cognitive' | 'Independence';
  ageGroup: string;
  title: string;
  description: string;
  checked: boolean;
}

export interface ActionPlan {
  id: string;
  title: string;
  issue: string;
  scholarBadge?: string;
  phases: {
    name: string;
    description: string;
    steps: { text: string; completed: boolean }[];
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
