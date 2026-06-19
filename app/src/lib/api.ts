import type { ActionPlan, BedtimeStory, BehaviorAnalysis, SchoolBrief, ChildProfile, BehaviorLog, Milestone, HeroJourneyRender, CoachContract, CouncilTake, MemoryReviewItem, ShareGrant, ShareRole } from "../types";
import type { AdventureScenario } from "../practice/content";

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

/**
 * MON-2: a 402 from a metered/Plus-gated endpoint is not a generic error — it's
 * a conversion moment. request() throws this so the UI can open the paywall
 * (with the suggested plan + which feature was hit) instead of showing an error.
 */
export class PaywallError extends Error {
  readonly status = 402;
  readonly plan?: "plus" | "family";
  readonly feature?: string;
  constructor(message: string, opts: { plan?: "plus" | "family"; feature?: string } = {}) {
    super(message);
    this.name = "PaywallError";
    this.plan = opts.plan;
    this.feature = opts.feature;
  }
}

async function request<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: await authHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    let detail = "Request failed";
    let errData: any = null;
    try {
      errData = await res.json();
      detail = errData.details || errData.error || detail;
    } catch {
      /* non-JSON error body */
    }
    if (res.status === 402) {
      const plan = errData?.upgrade?.plan === "family" ? "family" : "plus";
      throw new PaywallError(detail, { plan, feature: errData?.upgrade?.feature });
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
  // AVA-1: generate a stylized character avatar from descriptors (default) or an
  // optional reference photo. The photo is never stored server-side.
  generateAvatar: (payload: { descriptors?: AvatarDescriptors; photo?: { dataUrl: string }; style?: AvatarStyle }) =>
    post<{ dataUrl: string; style: string; source: "descriptor" | "photo" }>("/api/generate-avatar", payload),
  // AVA-3: render a story-beat scene featuring the child's generated character.
  generateScene: (payload: { imagePrompt: string; avatar?: { dataUrl: string }; style?: AvatarStyle }) =>
    post<{ dataUrl: string }>("/api/generate-scene", payload),
  // A3b: a full-page Hero Comic panel starring the child's hero (avatar reference).
  generateComic: (payload: {
    avatar?: { dataUrl: string };
    heroName?: string;
    sidekickName?: string;
    theme?: string;
    dialogue?: string;
    sfx?: string[];
    setting?: string;
    style?: AvatarStyle;
  }) => post<{ dataUrl: string }>("/api/generate-comic", payload),
  // Generative Cognitive Adventure personalized to the child (AdventureScenario shape).
  generateAdventure: (payload: { childProfile: ChildProfile; focusSkill?: string }) =>
    post<AdventureScenario>("/api/generate-adventure", payload),
  // Child articulation scoring (cloud SoapBox/Whisper). `configured:false` => fall back on-device.
  childAsrStatus: () => get<{ configured: boolean; provider: string }>("/api/score-utterance"),
  scoreUtterance: (payload: { target: string; sound: string; level: string; audio: { dataUrl: string; mimeType?: string } }) =>
    post<{ configured: boolean; result?: "got" | "almost" | "missed"; heard?: string; confidence?: number; provider?: string }>("/api/score-utterance", payload),
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
  // MON-1: plan + limits + usage for the signed-in parent.
  entitlement: () => get<EntitlementInfo>("/api/entitlement"),
  // MON-2: start a hosted checkout for a plan + cadence; returns the URL to open.
  billingCheckout: (plan: "plus" | "family", cadence: "monthly" | "annual") =>
    post<{ url: string }>("/api/billing/checkout", { plan, cadence }),
  // MON-2: self-service portal link to manage/cancel a web subscription.
  billingPortal: () => get<{ url: string | null }>("/api/billing/portal"),
  // ADM-1: founder dashboard — users + paying-by-plan + today's token spend (403 if not admin).
  adminOverview: () => get<AdminOverview>("/api/admin/overview"),
  // RET-1: "{child}'s week" digest (stats are computed server-side from the data we send).
  digest: (payload: { childProfile: ChildProfile; logs: BehaviorLog[]; milestones: Milestone[]; language?: "en" | "he" }) =>
    post<WeeklyDigest>("/api/digest", payload),
  // CMP-2: GDPR server-side export + erasure.
  privacyExport: (childId: string) =>
    get<{ exportedAt: string; childId: string; serverData: { memoryEvents: unknown[]; shares: unknown[] } }>(`/api/privacy/export/${encodeURIComponent(childId)}`),
  privacyErase: (childId: string) =>
    post<{ erased: { memoryEvents: number; shares: number }; erasedAt: string }>("/api/privacy/erase", { childId }),
  // MON-3 v1: durable consultation request (email-based transaction).
  requestConsult: (payload: { professionalId: string; childId?: string; note?: string; preferredMode?: string }) =>
    post<{ request: { id: string; professionalName: string; status: string; createdAt: string }; mailto: string | null }>("/api/consult-requests", payload),
  // mk-p0-2: the signed-in parent's stable invite code + shareable link + earned months.
  referralCode: () => get<ReferralCodeInfo>("/api/referral/code"),
  // mk-p0-2: redeem a captured referral code on the referred parent's activation.
  referralActivate: (code: string) =>
    post<ReferralActivateResult>("/api/referral/activate", { code }),
};

/** mk-p0-2: GET /api/referral/code response. `code`/`link` are null when anon. */
export type ReferralCodeInfo = {
  code: string | null;
  link: string | null;
  earnedMonths: number;
  maxed: boolean;
};

/** mk-p0-2: POST /api/referral/activate result (mirrors server ActivationResult). */
export type ReferralActivateResult =
  | { ok: true; status: "granted"; earnedMonths: number; periodEnd: string }
  | { ok: true; status: "maxed"; earnedMonths: number }
  | { ok: true; status: "already_activated" }
  | { ok: false; status: "self_referral" | "unknown_code" };

export type EntitlementInfo = {
  plan: "free" | "plus" | "family";
  limits: { coachMessagesPerDay: number | null; maxChildren: number; professionalReports: boolean; advancedPlans: boolean; coParentSeats: number };
  source: string;
  enforced: boolean;
  usage: { coachMessagesToday: number };
  status?: "active" | "in_trial" | "grace_period" | "canceled" | "expired" | null;
  provider?: "stripe" | "app_store" | "play_store" | "comp" | "none" | null;
  currentPeriodEnd?: string | null;
  willRenew?: boolean | null;
  isAdmin?: boolean;
};

export type AdminOverview = {
  users: number;
  paying: { plus: number; family: number; trialing: number; total: number };
  usageToday: {
    date: string;
    calls: number;
    promptTokens: number;
    outputTokens: number;
    totalTokens: number;
    byProvider: Record<string, { calls?: number; promptTokens?: number; outputTokens?: number }>;
    approxCostEur: number;
  };
  generatedAt: string;
};

export type WeeklyDigest = {
  title: string;
  subject: string;
  preheader: string;
  summary: string;
  highlights: string[];
  watchFor: string[];
  tryThisWeek: string;
  generated: "ai" | "fallback";
  stats: {
    weekOf: string;
    daysCovered: number;
    momentsLogged: number;
    previousWeekMoments: number;
    avgIntensity: number | null;
    intensityTrend: "easing" | "steady" | "intensifying" | "unknown";
    resolvedCount: number;
    topContext: string | null;
    topBehavior: string | null;
    milestonesDone: number;
    milestonesTotal: number;
  };
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

export type AvatarStyle = "storybook" | "soft3d" | "watercolor" | "flat" | "comichero";
export type AvatarDescriptors = {
  hair?: string;
  skin?: string;
  eyes?: string;
  vibe?: string;
  notes?: string;
};
