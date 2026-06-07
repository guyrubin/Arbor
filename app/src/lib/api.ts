import type { ActionPlan, BedtimeStory, BehaviorAnalysis, SchoolBrief, ChildProfile, BehaviorLog, Milestone, HeroJourneyRender, CoachContract, CouncilTake, MemoryReviewItem, ShareGrant, ShareRole } from "../types";

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

async function request<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: await authHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
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
const post = <T>(url: string, body: unknown) => request<T>(url, "POST", body);
const get = <T>(url: string) => request<T>(url, "GET");
const del = <T>(url: string) => request<T>(url, "DELETE");

/**
 * Realtime streaming voice coach (RT-2). POSTs to /api/voice and invokes onDelta
 * with each plain-text token as it streams, so the caller can speak sentences the
 * moment they arrive. Resolves when the stream completes.
 */
export async function streamVoice(
  payload: { message: string; childProfile: ChildProfile; scholarLens?: string; language?: "en" | "he" },
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/voice", {
    method: "POST",
    headers: await authHeaders({ Accept: "text/event-stream" }),
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok || !res.body) throw new Error("Voice stream failed to start");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const block = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let event = "message";
      const dataLines: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (!dataLines.length) continue;
      const data = JSON.parse(dataLines.join("\n"));
      if (event === "delta" && data.text) onDelta(data.text);
      else if (event === "error") throw new Error(data.details || data.error || "Voice stream error");
    }
  }
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
  // Co-parent / trusted sharing (server-enforced expiry).
  createShare: (payload: { childId: string; childName?: string; recipientEmail: string; role?: ShareRole; scopes?: string[]; duration?: string }) =>
    post<ShareGrant>("/api/shares", payload),
  listShares: (childId?: string) =>
    get<{ shares: ShareGrant[] }>(`/api/shares${childId ? `?childId=${encodeURIComponent(childId)}` : ""}`),
  revokeShare: (id: string) => del<ShareGrant>(`/api/shares/${encodeURIComponent(id)}`),
  sharedWithMe: () => get<{ shares: ShareGrant[] }>("/api/shared-with-me"),
  // Gemini Live: mint an ephemeral token for a direct browser Live session.
  liveToken: () => post<{ available: boolean; token?: string; model?: string; expiresAt?: string; reason?: string }>("/api/live/token", {}),
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
