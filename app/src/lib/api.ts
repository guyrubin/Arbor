import type { ActionPlan, BedtimeStory, BehaviorAnalysis, SchoolBrief, ChildProfile, BehaviorLog, Milestone, HeroJourneyRender, CoachContract, CouncilTake, MemoryReviewItem } from "../types";

/**
 * Typed fetch wrappers for the Arbor API. An auth-token provider can be
 * registered (by AuthContext) so requests carry a Firebase ID token when
 * available.
 */
type TokenProvider = () => Promise<string | null>;
let tokenProvider: TokenProvider | null = null;

export function setAuthTokenProvider(fn: TokenProvider) {
  tokenProvider = fn;
}

// Preferred language for AI-generated content (parenting guidance, scripts,
// stories, insights). Set by LanguageContext; appended to outgoing AI prompts.
let aiLanguage: "en" | "he" = "en";

export function setAiLanguage(lang: "en" | "he") {
  aiLanguage = lang;
}

/** Current AI content language — pass as `language` in AI request bodies so the
 *  server owns prompt localization (preferred over the client-side directive). */
export function getAiLanguage(): "en" | "he" {
  return aiLanguage;
}

export function aiLanguageInstruction(): string {
  return aiLanguage === "he"
    ? "\n\nIMPORTANT: Respond entirely in Hebrew (עברית), using warm, natural parent-facing language."
    : "";
}

export async function authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...extra };
  try {
    const token = tokenProvider ? await tokenProvider() : null;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* ignore token errors — request proceeds anonymously */
  }
  return headers;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: await authHeaders(), body: JSON.stringify(body) });
  if (!res.ok) {
    let detail = "Request failed";
    try {
      const errData = await res.json();
      detail = errData.details || errData.error || detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export const api = {
  analyzeBehavior: (payload: { logs: BehaviorLog[]; childProfile: ChildProfile }) =>
    post<BehaviorAnalysis>("/api/analyze-behavior", payload),
  generatePlan: (payload: { challengeTopic: string; childProfile: ChildProfile }) =>
    post<ActionPlan>("/api/generate-plan", payload),
  generateStory: (payload: { childName: string; age: number; topic: string; moral: string }) =>
    post<BedtimeStory>("/api/generate-story", payload),
  generateHeroJourney: (payload: { storyId: string; childName: string; age: number; language: "en" | "he" }) =>
    post<HeroJourneyRender>("/api/generate-hero-journey", payload),
  generateBrief: (payload: { childProfile: ChildProfile; logs: BehaviorLog[]; milestones: Milestone[]; audience: string }) =>
    post<SchoolBrief>("/api/generate-handoff", payload),
  extractLog: (payload: { message: string; childProfile: ChildProfile }) =>
    post<{ behaviorType: string; intensity: number; durationMinutes: number; context: string; trigger: string; response: string; notes: string }>("/api/extract-log", payload),
  vision: (payload: { image: { dataUrl: string }; mode: "observe" | "document"; note?: string; childProfile: ChildProfile }) =>
    post<VisionResult>("/api/vision", payload),
  council: (payload: { message: string; childProfile: ChildProfile; scholarLens?: string; language?: "en" | "he" }) =>
    post<{ text: string; contract?: CoachContract; council?: CouncilTake[]; memoryReviewItems?: MemoryReviewItem[] }>("/api/council", payload),
};

export type VisionObserve = {
  mode: "observe"; offTopic: boolean; observations: string[]; possibleMeanings: string[];
  tryToday: string[]; avoid: string[]; nonDiagnosticNote: string;
};
export type VisionDocument = {
  mode: "document"; offTopic: boolean; documentType: string; summary: string; keyPoints: string[];
  suggestedMemory: string[]; questionsForProfessional: string[]; handoffNote: string;
};
export type VisionResult = VisionObserve | VisionDocument;
