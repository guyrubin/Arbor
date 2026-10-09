import { toAnalyzeLogInputs } from "./analyzeLogPayload";
import { toDigestLogInputs, toDigestMilestoneInputs } from "./digestPayload";
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

/** B-CAREPRO-12: one behaviour log as the School Brief sends it — what
 *  happened, what set it off, what helped, and the day. No notes, intensity,
 *  duration, photo or excerpt. */
export type HandoffLogInput = { behaviorType: string; trigger: string; response: string; day: string };
/** B-CAREPRO-12: one observed, in-window milestone — area and title only. */
export type HandoffMilestoneInput = { domain: string; title: string };

/** B-CAREPRO-10: POST /shares 409 code — the owner's co-parent seat is in use. */
export const SEAT_IN_USE = "seat_in_use";

/** B-KID-05: image endpoints' 429 code — today's drawing quota is spent
 *  (server/imageQuota.ts). Not "busy": no Retry-After, nothing to retry today. */
export const IMAGE_RESTING = "image_resting";

/** True for the image-quota "resting" refusal (matched by code, never by copy). */
export const isImageResting = (err: unknown): boolean =>
  err instanceof ApiError && err.status === 429 && err.message === IMAGE_RESTING;

/**
 * B-KID-119: whether this session's plan grants ANY scene/comic image. Learnt
 * from /entitlement (`imageAllowance`) and from a "resting" refusal of a scene
 * or comic; `false` makes generateScene/generateComic refuse locally (no
 * network call) so a free family's kid mode never fires a request certain to
 * be refused — every caller already renders the built-in manifest art on a
 * refusal. `null` = not known yet (the server still decides).
 */
let sceneImagesAllowed: boolean | null = null;
export const noteImageAllowance = (a: { perDay: number; perMonth: number } | null | undefined): void => {
  if (a) sceneImagesAllowed = a.perDay > 0 && a.perMonth > 0;
};
export const sceneImagesOff = (): boolean => sceneImagesAllowed === false;
/** Test-only. */
export const __resetImageAllowance = (): void => { sceneImagesAllowed = null; };
const sceneImagePost = (url: string, payload: unknown) =>
  sceneImagesOff()
    ? Promise.reject(new ApiError(IMAGE_RESTING, 429))
    : post<{ dataUrl: string }>(url, payload).catch((err) => {
        if (isImageResting(err)) sceneImagesAllowed = false;
        throw err;
      });

/** B-KID-33: a hero-journey answer is a render only when it has the render's
 *  shape. A moderated answer (`{ text, outputBlocked }`) or any other body
 *  throws, so the reader falls back to the authored story instead of crashing
 *  on `render.scenes.find`. */
export function assertHeroJourneyRender(r: HeroJourneyRender): HeroJourneyRender {
  const v = r as unknown as { scenes?: unknown; choices?: unknown; outputBlocked?: unknown } | null;
  if (!v || v.outputBlocked === true || !Array.isArray(v.scenes) || !Array.isArray(v.choices)) {
    throw new ApiError("This story could not be personalised right now.", 422);
  }
  return r;
}

/** `Retry-After` in seconds, or undefined when absent/not a number. */
function retryAfterOf(res: { headers: { get(name: string): string | null } }): number | undefined {
  const raw = res.headers.get("Retry-After");
  if (!raw) return undefined;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function request<T>(url: string, method: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const headers = await authHeaders();
  signal?.throwIfAborted();
  const res = await fetch(url, {
    ...(signal ? { signal } : {}),
    method,
    headers,
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
    // B-CAREPRO-10: the co-parent seat conflict is the ONE 409 that is not a
    // safety screen. It is matched by its exact code, so every other 409 —
    // including a body that cannot be parsed — still escalates.
    if (res.status === 409 && errData?.error === SEAT_IN_USE) {
      throw new ApiError(SEAT_IN_USE, 409);
    }
    // B-KID-05: image quota exhaustion carries its own code and no retry hint.
    if (res.status === 429 && errData?.code === IMAGE_RESTING) {
      throw new ApiError(IMAGE_RESTING, 429);
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
// Live startup includes auth-token refresh and response JSON, not only fetch.
// Bound the whole operation and never send after an owner has cancelled it.
function liveStartupRequest<T>(body: unknown, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", cancel); };
    const cancel = () => { cleanup(); controller.abort(); reject(new DOMException("Voice start cancelled", "AbortError")); };
    const timer = setTimeout(() => { cleanup(); controller.abort(); reject(new Error("live-token-timeout")); }, 10_000);
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) { cancel(); return; }
    request<T>("/api/live/token", "POST", body, controller.signal).then(
      (value) => { cleanup(); resolve(value); },
      (error) => { cleanup(); reject(error); },
    );
  });
}
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
  // AI-02: `recentTurns` is the same optional same-thread transcript /api/chat
  // accepts (ai/chatContext) — a spoken turn is the same conversation, so it
  // carries the same continuity. Absent ⇒ byte-identical to the legacy request.
  payload: {
    message: string;
    childProfile: ChildProfile;
    scholarLens?: string;
    language?: "en" | "he";
    recentTurns?: { role: "parent" | "coach"; text: string }[];
    contextChildId?: string;
    privateMode?: boolean;
    topicId?: string;
  },
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

/** AI-07: the settled `/api/council` answer, on either transport. */
export type CouncilPayload = {
  text: string;
  contract?: CoachContract;
  council?: CouncilTake[];
  memoryReviewItems?: MemoryReviewItem[];
  /** Set when the server's output screen flagged the answer — the caller must
   *  RETRACT any streamed prose and render `text` (blocked/crisis markdown)
   *  instead, never a merge of the two. */
  outputBlocked?: boolean;
  blockedCategory?: string;
  riskLevel?: string;
  escalationCategory?: string;
};

/**
 * AI-07 — STREAMING scholar council over SSE, the council twin of the /api/chat
 * stream. Before this, `api.council()` was one POST that resolved only when the
 * whole multi-agent orchestration had finished: a silent spinner the parent
 * could not stop.
 *
 * `onDelta` fires once per SCREENED SENTENCE. The server tails the synthesis
 * contract's leading `text` prose out of the model stream, restores aliases,
 * and releases a sentence only after the cumulative screen passes — the exact
 * same seam /api/chat uses (createScreenedProseRelay in routes/api.ts), so the
 * two screens cannot drift. `onStatus` receives milestone STAGE KEYS only
 * (`memory` | `council` | `sources` | `plan`) — never server-authored copy, so
 * the caller owns localization and a HE session never sees English.
 *
 * CANCELLATION: pass `opts.signal`. Aborting it closes the response, which the
 * server reads as the client going away and aborts the upstream provider call
 * (createRouteBudget) — the orchestration genuinely stops rather than running
 * on and billing. An abort surfaces as the fetch's own AbortError.
 *
 * CLINICAL FIREWALL: structured panels and the per-scholar council takes arrive
 * ONLY in the resolved payload (the server's `done` frame), after the full
 * output screen has run on the complete rendered answer. Delta text is prose
 * only. A resolved payload with `outputBlocked` means the streamed prose must
 * be discarded, not appended to.
 */
export async function streamCouncil(
  payload: { topicId?: string; message: string; childProfile: ChildProfile; scholarLens?: string; language?: "en" | "he"; recentTurns?: { role: "parent" | "coach"; text: string }[]; contextChildId?: string },
  onDelta: (text: string) => void,
  opts: { signal?: AbortSignal; onStatus?: (stage: string) => void } = {},
): Promise<CouncilPayload> {
  const res = await fetch("/api/council", {
    method: "POST",
    headers: await authHeaders({ Accept: "text/event-stream" }),
    body: JSON.stringify(payload),
    signal: opts.signal,
  });
  if (!res.ok) {
    // The council sits behind the same metered coach gate as /chat, so the
    // typed errors callers already branch on (402 → paywall, 409 → escalation)
    // MUST survive this path too. Collapsing them into a bare Error here would
    // turn a conversion moment and a safety decision into "try again".
    let detail = "The scholar council could not be reached.";
    let errData: any = null;
    try {
      errData = await res.json();
      detail = errData?.details || errData?.error || detail;
    } catch {
      /* non-JSON error body — keep the neutral default */
    }
    if (res.status === 402) {
      throw new PaywallError(detail, {
        plan: errData?.upgrade?.plan === "family" ? "family" : "plus",
        feature: errData?.upgrade?.feature,
      });
    }
    if (res.status === 409) {
      throw new EscalationRequiredError(detail, {
        category: typeof errData?.escalationCategory === "string" ? errData.escalationCategory : undefined,
      });
    }
    throw new ApiError(detail, res.status, retryAfterOf(res));
  }
  // A server that did not open SSE (no Accept honoured, or a proxy stripped it)
  // still answers with one JSON body — degrade to it rather than failing.
  if (!res.headers.get("content-type")?.includes("text/event-stream") || !res.body) {
    return (await res.json()) as CouncilPayload;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let settled: CouncilPayload | null = null;
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
      if (event === "status" && typeof data.stage === "string") opts.onStatus?.(data.stage);
      else if (event === "delta" && data.text) onDelta(data.text);
      else if (event === "done") settled = data as CouncilPayload;
      else if (event === "error") throw new Error(data.details || data.error || "Council stream error");
    }
  }
  if (!settled) throw new Error("The scholar council ended without a final answer");
  return settled;
}

export const api = {
  // B-AI-02: the parent's AI language rides along (Hebrew insights for a Hebrew parent).
  // B-AI-13 (G-14): the request carries counts, types, triggers and context —
  // never the parent's notes or other free text (lib/analyzeLogPayload).
  analyzeBehavior: (payload: { logs: BehaviorLog[]; childProfile: ChildProfile }) =>
    post<BehaviorAnalysis>("/api/analyze-behavior", { ...payload, logs: toAnalyzeLogInputs(payload.logs), language: getAiLanguage() }),
  // B-ASKJB-27: + the behaviour counts (type -> count over 21 days, no text).
  generatePlan: (payload: { challengeTopic: string; childProfile: ChildProfile; recentTypeCounts?: { type: string; count: number }[] }) =>
    // B-ASKJB-25: the family's language reaches the plan prompt.
    post<ActionPlan>("/api/generate-plan", { ...payload, language: getAiLanguage() }),
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
    post<HeroJourneyRender>("/api/generate-hero-journey", payload).then(assertHeroJourneyRender),
  // LC-11: `language` threads the parent's UI language into the handoff
  // generation seam (mirroring extractLog/vision). The matching languageDirective
  // in the /generate-handoff prompt is a server-side change (src/routes/api.ts).
  // B-CAREPRO-12: the teacher-preset input only — never raw logs or the
  // whole milestone catalogue (the server allow-lists the same fields).
  generateBrief: (payload: { childProfile: ChildProfile; logs: HandoffLogInput[]; milestones: HandoffMilestoneInput[]; audience: string; language?: "en" | "he" }) =>
    post<SchoolBrief>("/api/generate-handoff", payload),
  // AI-CAP-2: `language` threads the parent's AI language into the extraction
  // prompt (mirroring /chat's languageDirective) so an HE description yields
  // HE trigger/response/notes — behaviorType/context stay schema-valued.
  // B-LOOP-06: `milestoneCandidateIds` (the child's open in-window milestones)
  // asks for a milestone match; the server validates every id and answers
  // `milestoneMatch` only then (absent ⇒ the legacy response, byte for byte).
  extractLog: (payload: { message: string; childProfile: ChildProfile; language?: "en" | "he"; milestoneCandidateIds?: string[] }) =>
    post<{
      behaviorType: string; intensity: number; durationMinutes: number; context: string; trigger: string; response: string; notes: string;
      milestoneMatch?: { shelf: string; milestoneId?: string; confidence: "high" | "low" } | null;
    }>("/api/extract-log", payload),
  // childId is REQUIRED by the server's COPPA gate (requireConsent reads it from
  // the body); without it /api/vision fails closed with 451. The caller passes the
  // active child's id. AIX-S1: `language` (getAiLanguage()) drives the server-side
  // languageDirective so a Hebrew parent gets Hebrew observations back.
  importHomeRecommendations: (payload: { childId: string; image: { dataUrl: string } }) =>
    post<import("./programImport").RecommendationDraft>("/api/vision", { ...payload, mode: "recommendations" }),
  vision: (payload: { childId: string; image: { dataUrl: string }; mode: "observe" | "document"; note?: string; childProfile: ChildProfile; language?: "en" | "he" }) =>
    post<VisionResult>("/api/vision", payload),
  // AVA-1: generate a stylized character avatar from descriptors (default) or an
  // optional reference photo. The photo is never stored server-side.
  generateAvatar: (payload: { childId?: string; descriptors?: AvatarDescriptors; character?: AvatarCharacterIntent; photo?: { dataUrl: string }; style?: AvatarStyle }) =>
    post<{ dataUrl: string; style: string; source: "descriptor" | "photo" }>("/api/generate-avatar", payload),
  // AVA-3: render a story-beat scene featuring the child's generated character.
  generateScene: (payload: { imagePrompt: string; avatar?: { dataUrl: string }; style?: AvatarStyle }) =>
    sceneImagePost("/api/generate-scene", payload),
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
    /** G2: the title to letter on a cover page. */
    title?: string;
  }) => sceneImagePost("/api/generate-comic", payload),
  // Generative Cognitive Adventure personalized to the child (AdventureScenario shape).
  generateAdventure: (payload: { childProfile: ChildProfile; focusSkill?: string }) =>
    post<AdventureScenario>("/api/generate-adventure", payload),
  // Child articulation scoring (cloud SoapBox/Whisper). `configured:false` => fall back on-device.
  childAsrStatus: () => get<{ configured: boolean; provider: string }>("/api/score-utterance"),
  scoreUtterance: (payload: { target: string; sound: string; level: string; audio: { dataUrl: string; mimeType?: string } }) =>
    post<{ configured: boolean; result?: "got" | "almost" | "missed"; heard?: string; confidence?: number; provider?: string }>("/api/score-utterance", payload),
  council: (payload: { topicId?: string; message: string; childProfile: ChildProfile; scholarLens?: string; language?: "en" | "he"; recentTurns?: { role: "parent" | "coach"; text: string }[]; contextChildId?: string }) =>
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
  revokeConsent: (id: string, childId: string) =>
    del<{ grant: ConsentGrant }>(`/api/consent/${encodeURIComponent(id)}?childId=${encodeURIComponent(childId)}`),
  // Gemini Live: mint an ephemeral token for a direct browser Live session.
  // AI-V8: config-only availability probe (no SDK call, no token mint server-side).
  // Probe THIS on mount; call liveToken only when the parent toggles voice on.
  // B-ASKJB-02: `exceptionUntil` (YYYY-MM-DD) is the Live residency exception's
  // last day once lane X (B-PROV-01) serves it; lib/liveResidency falls back.
  liveAvailability: () => get<{ available: boolean; exceptionUntil?: string }>("/api/live/availability"),
  /** Returns ephemeral review proposals only; this endpoint cannot commit records. */
  extractConversationProposals: (payload: { transcript: string; childProfile: ChildProfile; milestones: Pick<Milestone, "id" | "title" | "checked" | "observationStatus">[]; language?: "en" | "he" }) =>
    post<{ proposals: unknown[] }>("/api/conversation/proposals", payload),
  // AI-V9: the session language selects the server-pinned persona + voice; the
  // pinned systemInstruction/speechConfig are echoed back for the connect call.
  liveToken: (payload: {
    language?: "en" | "he";
    childId?: string;
    childProfile?: ChildProfile;
    recentTurns?: { role: "parent" | "coach"; text: string }[];
    contextChildId?: string;
    privateMode?: boolean;
    topicId?: string;
  } = {}, opts: { signal?: AbortSignal } = {}) =>
    liveStartupRequest<{ available: boolean; token?: string; model?: string; expiresAt?: string; reason?: string; systemInstruction?: string; speechConfig?: unknown }>(payload, opts.signal),
  // VC-2/VC-3: the authoritative per-turn Live screen. The liveTurnGuard treats
  // ANY failure of this call (network / non-200 / timeout) as FLAGGED (VC-5).
  liveTurn: (payload: { role: "user" | "model"; text: string; language?: "en" | "he"; childId?: string }) =>
    post<import("./liveTurnGuard").LiveTurnVerdict>("/api/live/turn", payload),
  // MON-1: plan + limits + usage for the signed-in parent.
  entitlement: () => get<EntitlementInfo>("/api/entitlement").then((e) => { noteImageAllowance(e.imageAllowance); return e; }),
  // MON-2: start a hosted checkout for a plan + cadence; returns the URL to open.
  billingCheckout: (plan: "plus" | "family", cadence: "monthly" | "annual") =>
    post<{ url: string }>("/api/billing/checkout", { plan, cadence }),
  // MON-2: self-service portal link to manage/cancel a web subscription.
  billingPortal: () => get<{ url: string | null }>("/api/billing/portal"),
  // ADM-1: founder dashboard — users + paying-by-plan + today's token spend (403 if not admin).
  adminOverview: () => get<AdminOverview>("/api/admin/overview"),
  // RET-1: "{child}'s week" digest (stats are computed server-side from the data we send).
  // B-AI-16: counts, types, contexts and outcomes only — no trigger / notes /
  // response / photo leaves the device for the digest (lib/digestPayload).
  digest: (payload: { childProfile: ChildProfile; logs: BehaviorLog[]; milestones: Milestone[]; language?: "en" | "he" }) =>
    post<WeeklyDigest>("/api/digest", { ...payload, logs: toDigestLogInputs(payload.logs), milestones: toDigestMilestoneInputs(payload.milestones) }),
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
  /** B-MEAS-01: measurement cohort tag (founder/comped/smoke = "internal"). */
  cohort?: "internal" | "family";
  /** B-KID-119: the plan's image allowance (server IMAGE_ALLOWANCE row). */
  imageAllowance?: { perDay: number; perMonth: number; heroPer30Days: number };
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
export type AvatarCharacterPreset = "princess" | "superhero" | "explorer" | "custom";
export type AvatarCharacterIntent = {
  preset: AvatarCharacterPreset;
  /** Required only for preset=custom; never inferred from child profile data. */
  customIdea?: string;
};
export type AvatarDescriptors = {
  hair?: string;
  skin?: string;
  eyes?: string;
  vibe?: string;
  notes?: string;
};
