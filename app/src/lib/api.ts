import type { ActionPlan, BedtimeStory, BehaviorAnalysis, SchoolBrief, ChildProfile, BehaviorLog, Milestone, HeroJourneyRender, CoachContract, CouncilTake, MemoryReviewItem, ShareGrant, ShareRole, SharedPacketView, ConsentGrant, ConsentPurpose, DeletionReceipt } from "../types";
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

/**
 * DUX-032: a 409 from an AI-generation endpoint is the server-side escalation
 * screen firing — every 409 in routes/api.ts means "Professional support
 * recommended" and carries `escalationCategory`. request() throws this typed
 * error so the UI can branch on `instanceof` instead of fragile message
 * substring-matching. The server message is preserved verbatim so legacy
 * substring checks keep working unchanged.
 */
export class EscalationRequiredError extends Error {
  readonly status = 409;
  readonly code = "ESCALATION_REQUIRED";
  readonly category?: string;
  constructor(message: string, opts: { category?: string } = {}) {
    super(message);
    this.name = "EscalationRequiredError";
    this.category = opts.category;
  }
}

/**
 * CARE-2: generic API error that carries the HTTP status. Lets callers branch
 * on status (e.g. the shared-view 403 "share ended" → drop the card) without
 * fragile message matching. Message behavior is unchanged for existing catches.
 */
export class ApiError extends Error {
  /**
   * AI-06: the server's `Retry-After` (seconds), preserved for the ONE status
   * where waiting is the correct advice — 429. Without it the quota screen can
   * only say "later", which is exactly the vagueness the generic error had.
   */
  constructor(message: string, readonly status: number, readonly retryAfterSeconds?: number) {
    super(message);
    this.name = "ApiError";
  }
}

/** `Retry-After` in seconds, or undefined when absent/not a number. */
function retryAfterOf(res: { headers: { get(name: string): string | null } }): number | undefined {
  const raw = res.headers.get("Retry-After");
  if (!raw) return undefined;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0 ? n : undefined;
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
    if (res.status === 409) {
      // Server escalation contract (see routes/api.ts): 409 == a safety trigger
      // fired on the input. Never downgrade this to a generic Error.
      const category =
        typeof errData?.escalationCategory === "string" ? errData.escalationCategory : undefined;
      throw new EscalationRequiredError(detail, { category });
    }
    throw new ApiError(detail, res.status, retryAfterOf(res));
  }
  return (await res.json()) as T;
}
const post = <T>(url: string, body: unknown) => request<T>(url, "POST", body);
const get = <T>(url: string) => request<T>(url, "GET");
const del = <T>(url: string) => request<T>(url, "DELETE");

/**
 * Realtime streaming voice coach (RT-2 / AI-V1). POSTs to /api/voice and invokes
 * onDelta once per SCREENED SENTENCE: the server splits the model stream at
 * sentence boundaries, screens the cumulative alias-restored text at each
 * boundary, and emits each sentence as its own delta only after its screen
 * passes — so the caller speaks sentence 1 while the rest is still generating.
 * (When the semantic output classifier is enabled server-side, the whole reply
 * arrives as one delta instead.) Delta events may carry a `tts` payload — a
 * short-TTL screened-sentence token for /api/tts (AI-V5); callers on the voice
 * loop register it via registerTtsToken (lib/naturalVoice.ts). Resolves when
 * the stream completes.
 *
 * VC-4: `opts.onEvent` receives EVERY parsed SSE event (delta / done / error)
 * with its payload. The server's `done` event is safety-load-bearing — it
 * carries the escalation category + crisis `resourcesMarkdown` and the
 * `outputBlocked` + `blockedMarkdown` state. Discarding it (the pre-VC-4
 * behavior) silently dropped crisis resources for voice parents; callers on
 * the voice loop MUST wire `onEvent` and route `done` through
 * `handleVoiceDone` (lib/voiceSafetyEvents.ts).
 */
export async function streamVoice(
  payload: { message: string; childProfile: ChildProfile; scholarLens?: string; language?: "en" | "he" },
  onDelta: (text: string) => void,
  opts: { signal?: AbortSignal; onEvent?: (event: string, data: Record<string, unknown>) => void } = {},
): Promise<void> {
  const { signal, onEvent } = opts;
  const res = await fetch("/api/voice", {
    method: "POST",
    headers: await authHeaders({ Accept: "text/event-stream" }),
    body: JSON.stringify(payload),
    signal,
  });
  // AI-06: the voice stream used to throw a bare Error here, DESTROYING the
  // status. So a 429 (this account's hour of AI is spent) and a 451 (no
  // parental consent for this child's voice) both arrived at CoachTab as one
  // unrecognisable failure, which silently "fell back" to browser voice — a
  // fallback that hits the same refusal. The status is now preserved so the
  // caller can say which of the two happened, and what to do about it.
  if (!res.ok) {
    let detail = "Voice stream failed to start";
    try {
      const errData = await res.json();
      detail = errData?.details || errData?.error || detail;
    } catch {
      /* non-JSON error body — keep the neutral default */
    }
    throw new ApiError(detail, res.status, retryAfterOf(res));
  }
  if (!res.body) throw new Error("Voice stream failed to start");
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
      onEvent?.(event, data);
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
  // AP-057: Bedtime Stories — day-rooted, avatar-starring nightly story.
  // Runs escalation screen + redaction on the server; generate-and-discard (no library persistence).
  generateBedtimeStory: (payload: {
    childName: string;
    age: number;
    dayEvents: { description: string; tone?: string }[];
    avatarDescription?: string;
    language?: "en" | "he";
  }) => post<BedtimeStory>("/api/generate-bedtime-story", payload),
  generateHeroJourney: (payload: { storyId: string; childName: string; age: number; language: "en" | "he" }) =>
    post<HeroJourneyRender>("/api/generate-hero-journey", payload),
  // LC-11: `language` threads the parent's UI language into the handoff
  // generation seam (mirroring extractLog/vision). The matching languageDirective
  // in the /generate-handoff prompt is a server-side change (src/routes/api.ts).
  generateBrief: (payload: { childProfile: ChildProfile; logs: BehaviorLog[]; milestones: Milestone[]; audience: string; language?: "en" | "he" }) =>
    post<SchoolBrief>("/api/generate-handoff", payload),
  // AI-CAP-2: `language` threads the parent's AI language into the extraction
  // prompt (mirroring /chat's languageDirective) so an HE description yields
  // HE trigger/response/notes — behaviorType/context stay schema-valued.
  extractLog: (payload: { message: string; childProfile: ChildProfile; language?: "en" | "he" }) =>
    post<{ behaviorType: string; intensity: number; durationMinutes: number; context: string; trigger: string; response: string; notes: string }>("/api/extract-log", payload),
  // childId is REQUIRED by the server's COPPA gate (requireConsent reads it from
  // the body); without it /api/vision fails closed with 451. The caller passes the
  // active child's id. AIX-S1: `language` (getAiLanguage()) drives the server-side
  // languageDirective so a Hebrew parent gets Hebrew observations back.
  vision: (payload: { childId: string; image: { dataUrl: string }; mode: "observe" | "document"; note?: string; childProfile: ChildProfile; language?: "en" | "he" }) =>
    post<VisionResult>("/api/vision", payload),
  // AVA-1: generate a stylized character avatar from descriptors (default) or an
  // optional reference photo. The photo is never stored server-side.
  generateAvatar: (payload: { childId?: string; descriptors?: AvatarDescriptors; photo?: { dataUrl: string }; style?: AvatarStyle }) =>
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
    /** p1-comic-reader: 0 = cover, 1..N = a beat page (additive; backend tolerant). */
    pageIndex?: number;
    /** p1-comic-reader: render a dramatic title cover (no speech bubble). */
    cover?: boolean;
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
  // CARE-6: `history: true` also returns revoked/expired grants — the owner's
  // grant records are the sharing audit trail rendered as "Sharing history".
  listShares: (childId?: string, opts?: { history?: boolean }) => {
    const params = new URLSearchParams();
    if (childId) params.set("childId", childId);
    if (opts?.history) params.set("history", "1");
    const qs = params.toString();
    return get<{ shares: ShareGrant[] }>(`/api/shares${qs ? `?${qs}` : ""}`);
  },
  revokeShare: (id: string) => del<ShareGrant>(`/api/shares/${encodeURIComponent(id)}`),
  sharedWithMe: () => get<{ shares: ShareGrant[] }>("/api/shared-with-me"),
  // CARE-2: the recipient's read-only view of a live grant — exactly the granted
  // scopes, assembled through the fail-closed consult-packet egress. 403 = the
  // share has ended (revoked/expired/not addressed to you) → drop the card.
  sharedPacket: (grantId: string) => get<SharedPacketView>(`/api/shared/${encodeURIComponent(grantId)}/packet`),
  // COPPA-2026 consent: grant/list/revoke purpose-scoped parental consent.
  grantConsent: (payload: { childId: string; purpose: ConsentPurpose; granted?: boolean }) =>
    post<{ grant: ConsentGrant }>("/api/consent", payload),
  listConsent: (childId: string) =>
    get<{ grants: ConsentGrant[] }>(`/api/consent/${encodeURIComponent(childId)}`),
  revokeConsent: (id: string) => del<{ grant: ConsentGrant }>(`/api/consent/${encodeURIComponent(id)}`),
  // Gemini Live: mint an ephemeral token for a direct browser Live session.
  // AI-V8: config-only availability probe (no SDK call, no token mint server-side).
  // Probe THIS on mount; call liveToken only when the parent toggles voice on.
  liveAvailability: () => get<{ available: boolean }>("/api/live/availability"),
  /** Returns ephemeral review proposals only; this endpoint cannot commit records. */
  extractConversationProposals: (payload: { transcript: string; childProfile: ChildProfile; milestones: Pick<Milestone, "id" | "title" | "checked" | "observationStatus">[]; language?: "en" | "he" }) =>
    post<{ proposals: unknown[] }>("/api/conversation/proposals", payload),
  // AI-V9: the session language selects the server-pinned persona + voice; the
  // pinned systemInstruction/speechConfig are echoed back for the connect call.
  liveToken: (payload: { language?: "en" | "he"; childId?: string } = {}) =>
    post<{ available: boolean; token?: string; model?: string; expiresAt?: string; reason?: string; systemInstruction?: string; speechConfig?: unknown }>("/api/live/token", payload),
  // VC-2/VC-3: the authoritative per-turn Live screen. The liveTurnGuard treats
  // ANY failure of this call (network / non-200 / timeout) as FLAGGED (VC-5).
  liveTurn: (payload: { role: "user" | "model"; text: string; language?: "en" | "he"; childId?: string }) =>
    post<import("./liveTurnGuard").LiveTurnVerdict>("/api/live/turn", payload),
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
    post<{ erased: { memoryEvents: number; shares: number; consents?: number }; erasedAt: string }>("/api/privacy/erase", { childId }),
  // STORE-4: FULL account deletion (Apple 5.1.1(v) / Play / GDPR Art. 17) — the
  // per-class receipt is honest: any failure ⇒ complete:false, account survives
  // for retry. Client wipes device-local stores only after a complete receipt.
  accountDelete: () => post<AccountDeletionReceipt>("/api/account/delete", { confirm: "DELETE" }),
  // MON-3 v1: durable consultation request (email-based transaction).
  requestConsult: (payload: { professionalId: string; childId?: string; note?: string; preferredMode?: string }) =>
    post<{ request: { id: string; professionalName: string; status: string; createdAt: string }; mailto: string | null }>("/api/consult-requests", payload),
  // mk-p0-2: the signed-in parent's stable invite code + shareable link + earned months.
  referralCode: () => get<ReferralCodeInfo>("/api/referral/code"),
  // mk-p0-2: redeem a captured referral code on the referred parent's activation.
  referralActivate: (code: string) =>
    post<ReferralActivateResult>("/api/referral/activate", { code }),
  // Pre-auth access request from LoginScreen. This hits the server-side waitlist
  // pipeline rather than relying on the parent having a local mail client.
  requestAccess: (payload: { email: string; source?: string; market?: string }) =>
    post<{ ok: true; duplicate: boolean }>("/api/waitlist", { ...payload, consent: true }),
};

/** mk-p0-2: GET /api/referral/code response. `code`/`link` are null when anon. */
// STORE-4: honest per-class account-deletion receipt (see server/accountDeletion.ts).
export type AccountDeletionReceipt = {
  uid: string;
  complete: boolean;
  authDeleted: boolean;
  receiptAt: string;
  classes: Array<{ class: string; attempted: boolean; deleted: number; failed: number; error?: string; note?: string }>;
  mode?: "local";
};

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
  /** Counts only (clinical firewall JRNL-1) — the digest stats payload carries
   *  no derived intensity score and no trend verdict. */
  stats: {
    weekOf: string;
    daysCovered: number;
    momentsLogged: number;
    previousWeekMoments: number;
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
