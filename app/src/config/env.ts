import { liveExceptionFromEnv } from "../ai/liveResidency.js";

export type ArborEnvironment = "local" | "dev" | "stage" | "prod";
/** B-INF-04: "mock" = deterministic fixtures for the sandbox audit lanes
 *  (ai/mockProvider.ts) — zero outbound model calls; refused in prod. */
export type ModelProviderKind = "gemini_dev" | "vertex" | "mock";
export type MemoryAdapterKind = "local" | "firestore";

export type ArborConfig = {
  nodeEnv: string;
  arborEnv: ArborEnvironment;
  port: number;
  appUrl: string;
  corsOrigins: string[];
  gcpProjectId?: string;
  gcpRegion: string;
  vertexLocation: string;
  /** B-PROV-03: Vertex location for Claude (Anthropic publisher) calls
   *  (VERTEX_CLAUDE_LOCATION, default "eu"). The multi-region value "eu" uses
   *  the aiplatform.eu.rep.googleapis.com endpoint with locations/eu; a
   *  regional value ("europe-west4") the regional host. Gemini routes keep
   *  `vertexLocation`. Optional so hand-built test configs stay valid
   *  (absent = "eu", ai/claudeVertexProvider claudeVertexLocation). */
  vertexClaudeLocation?: string;
  vertexModelChat: string;
  vertexModelStory: string;
  vertexModelAnalysis: string;
  vertexModelHandoff: string;
  /** Image-generation model (Gemini 2.5 Flash Image / "Nano Banana"). Outputs carry SynthID + C2PA. */
  vertexModelImage: string;
  /** Ordered Vertex locations tried for image generation when the primary
   *  region is saturated (429/503). First entry is always `gcpRegion` (B-GA-27:
   *  images no longer follow the text `vertexLocation`).
   *  Every entry must satisfy the route policy region (EU in prod); non-EU
   *  entries are dropped at request time, never silently used. */
  vertexImageRegions: string[];
  modelProvider: ModelProviderKind;
  geminiApiKey?: string;
  geminiModel: string;
  /** VC-7: hard enablement gate for Gemini Live (parent realtime voice).
   *  Default FALSE — setting GEMINI_API_KEY for any other reason (e.g. a
   *  dev-API fallback) must NEVER silently route voice around the screened
   *  /voice path. Flipping LIVE_ENABLED=true IS the GD-3 unlock and stays an
   *  explicit Guy decision once the Live turn-guard slate (VC-1..VC-5) is
   *  green — never an env side-effect. */
  liveEnabled: boolean;
  /** Supported parent realtime model; pinned in production and exercised by the Live smoke. */
  liveModel: string;
  /** B-PROV-01: last day (YYYY-MM-DD, UTC end of day) production may admit the
   *  GLOBAL AI Studio Live endpoint under the dated residency exception.
   *  Env LIVE_GLOBAL_EXCEPTION_UNTIL (alias LIVE_RESIDENCY_EXCEPTION_UNTIL);
   *  unset → the program default in ai/liveResidency.ts; "off" → none.
   *  Optional so hand-built test configs stay valid (absent = no exception). */
  liveGlobalExceptionUntil?: string;
  /** B-PROV-01: the Vertex `eu` Live attempt (LIVE_VERTEX_EU, default off). */
  liveVertexEu?: boolean;
  /** B-PROV-01: Vertex location for the EU Live attempt (LIVE_VERTEX_LOCATION). */
  liveVertexLocation?: string;
  /** Local-dev image model (Gemini Developer API). */
  geminiImageModel: string;
  firebaseProjectId?: string;
  firestoreDatabaseId: string;
  knowledgePath?: string;
  memoryAdapter: MemoryAdapterKind;
  enableLocalMemoryAdapter: boolean;
  enableHighRiskReviewQueue: boolean;
  /** Hard cap on tokens any single model generation may produce (runaway/cost guard). */
  maxOutputTokens: number;
  /** Max number of approved memory facts injected into a coach prompt (token-window guard). */
  memoryPromptMaxFacts: number;
  /** MON-2: shared secret RevenueCat sends as the webhook Authorization header. */
  revenueCatWebhookAuth?: string;
  /** STORE-4: RevenueCat SECRET API key (server-only) used to delete the
   *  subscriber record on account deletion. When unset, that deletion class is
   *  honestly reported as skipped — never silently claimed done. */
  revenuecatSecretApiKey?: string;
  /** STORE-4: Firebase Storage bucket holding user uploads
   *  (users/{uid}/children/{childId}/photos/*) — swept on account deletion. */
  storageBucket?: string;
  /** MON-2: RevenueCat Web Purchase Link base (`https://pay.rev.cat/<token>`). When
   *  set, the uid is appended as a path segment and the plan via `?package_id`. */
  billingWebPurchaseLink?: string;
  /** MON-2: per-plan hosted-checkout links keyed `${plan}_${cadence}` (Stripe fallback). */
  billingCheckoutUrls: Record<string, string>;
  /** MON-2: customer self-service portal (Stripe Billing portal) for web subs. */
  billingManageUrl?: string;
  /** Child articulation ASR provider. Parent voice stays on Gemini Live — this is
   *  ONLY for scoring the child's pronunciation. "gemini" = Vertex multimodal audio
   *  (no vendor/secrets); "none" = on-device Web Speech fallback only. */
  childAsrProvider: "none" | "gemini" | "soapbox" | "whisper";
  /** Hosted (OpenAI-compatible) Whisper transcription endpoint for child ASR fallback. */
  whisperApiUrl?: string;
  whisperApiKey?: string;
  whisperModel: string;
  /** SoapBox Labs kid-ASR endpoint + key (phoneme-level; primary when licensed). */
  soapboxApiUrl?: string;
  soapboxApiKey?: string;
  /** Neural text-to-speech provider for natural read-aloud (Epic A). "google" =
   *  Google Cloud Text-to-Speech on the SAME GCP project via ADC (no new vendor);
   *  "none" (default) = the browser SpeechSynthesis floor only, so the app ships
   *  unchanged until this is deliberately enabled. */
  ttsProvider: "none" | "google";
  /** Cloud TTS voice names per locale; empty → the API's default voice for the locale. */
  ttsVoiceEn: string;
  ttsVoiceHe: string;
  /** Hard kill-switch: when true, /api/tts is disabled regardless of ttsProvider. */
  ttsDisabled: boolean;
  /** mk-p0-2 referral loop: secret salt for the per-user HMAC referral code, and
   *  the max number of referral months a single referrer can ever earn. */
  referralSecret: string;
  referralMaxGrants: number;
};

const boolFromEnv = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

/** Ordered, de-duplicated image regions: the primary location first, then the
 *  configured (or default EU) fallbacks. Blank entries are ignored. */
export const imageRegionsFromEnv = (value: string | undefined, primary: string): string[] => {
  const configured = (value ?? "europe-west1,europe-west3").split(",").map((s) => s.trim()).filter(Boolean);
  return Array.from(new Set([primary, ...configured]));
};

const parseArborEnv = (value: string | undefined): ArborEnvironment => {
  const normalized = (value || "local").toLowerCase();
  if (["local", "dev", "stage", "prod"].includes(normalized)) return normalized as ArborEnvironment;
  throw new Error(`Invalid ARBOR_ENV "${value}". Use local, dev, stage, or prod.`);
};

const parseModelProvider = (value: string | undefined, arborEnv: ArborEnvironment): ModelProviderKind => {
  const normalized = (value || (arborEnv === "prod" ? "vertex" : "gemini_dev")).toLowerCase();
  if (normalized === "gemini_dev" || normalized === "vertex" || normalized === "mock") return normalized;
  throw new Error(`Invalid MODEL_PROVIDER "${value}". Use gemini_dev, vertex or mock.`);
};

const parseMemoryAdapter = (value: string | undefined, arborEnv: ArborEnvironment): MemoryAdapterKind => {
  const normalized = (value || (arborEnv === "prod" ? "firestore" : "local")).toLowerCase();
  if (normalized === "local" || normalized === "firestore") return normalized;
  throw new Error(`Invalid MEMORY_ADAPTER "${value}". Use local or firestore.`);
};

export const loadConfig = (): ArborConfig => {
  const arborEnv = parseArborEnv(process.env.ARBOR_ENV);
  const modelProvider = parseModelProvider(process.env.MODEL_PROVIDER, arborEnv);
  const memoryAdapter = parseMemoryAdapter(process.env.MEMORY_ADAPTER, arborEnv);
  const enableLocalMemoryAdapter = boolFromEnv(process.env.ENABLE_LOCAL_MEMORY_ADAPTER, arborEnv !== "prod");
  // B-GA-27 (9 Oct 2026): Gemini text routes run in europe-west3 (gemini-3.5-flash
  // is not served in europe-west4; the `eu` multi-region answered 5 of 25 calls
  // in more than 15 s, europe-west3 none after the cold first call). Images do
  // not follow the text location: their primary region is GCP_REGION.
  const vertexLocation = process.env.VERTEX_LOCATION || "europe-west3";
  const gcpRegion = process.env.GCP_REGION || "europe-west4";

  const config: ArborConfig = {
    nodeEnv: process.env.NODE_ENV || "development",
    arborEnv,
    port: Number(process.env.PORT || 3000),
    appUrl: process.env.APP_URL || "http://localhost:3000",
    corsOrigins: Array.from(new Set([
      ...(process.env.CORS_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
      // Native shells (Capacitor): the iOS/Android webviews send these fixed
      // origins. They are not secrets and are always allowed so the mobile apps
      // can reach the API without a CORS_ORIGINS env change on every deploy.
      "capacitor://localhost", // iOS
      "https://localhost",     // Android (androidScheme: https)
    ])),
    gcpProjectId: process.env.GCP_PROJECT_ID,
    gcpRegion,
    vertexLocation,
    // B-PROV-03: Claude on the Vertex `eu` multi-region endpoint by default.
    vertexClaudeLocation: (process.env.VERTEX_CLAUDE_LOCATION || "").trim() || "eu",
    // AIR-4: default coach model is the current Claude Sonnet generation on
    // Vertex (resolved to the bare publisher id `claude-sonnet-5`). The PROD
    // env-var flip + quality sign-off remain Guy's gate (GG-3): coach-core-v1 +
    // eval:safety + the hard-moment suite must re-run green against the new
    // resolved id, and evals/pinned-models.json is refreshed in the same PR.
    vertexModelChat: process.env.VERTEX_MODEL_CHAT || "claude-sonnet-5@anthropic",
    // B-GA-27: the 2.5 Flash default retires on Vertex 20 Oct 2026; gemini-3.5-flash
    // is GA with retirement no earlier than 19 May 2027.
    vertexModelStory: process.env.VERTEX_MODEL_STORY || "gemini-3.5-flash",
    vertexModelAnalysis: process.env.VERTEX_MODEL_ANALYSIS || "gemini-3.5-flash",
    vertexModelHandoff: process.env.VERTEX_MODEL_HANDOFF || "gemini-3.5-flash",
    vertexModelImage: process.env.VERTEX_MODEL_IMAGE || "gemini-2.5-flash-image",
    // 22 Sep 2026: europe-west4 returned 429 "Resource exhausted" on 26 of 35
    // scene requests with project quota at 0 % — regional capacity, not quota.
    // Family imagery stays in the EU: the fallback list is EU-only by default.
    vertexImageRegions: imageRegionsFromEnv(process.env.VERTEX_IMAGE_REGIONS, gcpRegion),
    modelProvider,
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || "gemini-3.5-flash",
    // B-INF-04: the mock provider means zero outbound model calls — the
    // realtime Live path (its own token mint) is off, the client takes the
    // existing browser-voice fallback.
    liveEnabled: modelProvider !== "mock" && boolFromEnv(process.env.LIVE_ENABLED, false),
    liveModel: process.env.LIVE_MODEL || "gemini-3.8-live",
    liveGlobalExceptionUntil: liveExceptionFromEnv(process.env.LIVE_GLOBAL_EXCEPTION_UNTIL ?? process.env.LIVE_RESIDENCY_EXCEPTION_UNTIL),
    liveVertexEu: boolFromEnv(process.env.LIVE_VERTEX_EU, false),
    liveVertexLocation: process.env.LIVE_VERTEX_LOCATION || "europe-west4",
    geminiImageModel: process.env.GEMINI_IMAGE_MODEL || process.env.VERTEX_MODEL_IMAGE || "gemini-2.5-flash-image",
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID,
    firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || "(default)",
    knowledgePath: process.env.ARBOR_KNOWLEDGE_PATH || process.env.KNOWLEDGE_PATH,
    memoryAdapter,
    enableLocalMemoryAdapter,
    enableHighRiskReviewQueue: boolFromEnv(process.env.ENABLE_HIGH_RISK_REVIEW_QUEUE, true),
    maxOutputTokens: Number(process.env.MAX_OUTPUT_TOKENS || 8192),
    memoryPromptMaxFacts: Number(process.env.MEMORY_PROMPT_MAX_FACTS || 40),
    revenueCatWebhookAuth: process.env.REVENUECAT_WEBHOOK_AUTH,
    revenuecatSecretApiKey: process.env.REVENUECAT_SECRET_API_KEY,
    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET ||
      ((process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID)
        ? `${process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID}.firebasestorage.app`
        : undefined),
    billingWebPurchaseLink: process.env.BILLING_WEB_PURCHASE_LINK,
    billingCheckoutUrls: {
      ...(process.env.BILLING_URL_PLUS_MONTHLY ? { plus_monthly: process.env.BILLING_URL_PLUS_MONTHLY } : {}),
      ...(process.env.BILLING_URL_PLUS_ANNUAL ? { plus_annual: process.env.BILLING_URL_PLUS_ANNUAL } : {}),
      ...(process.env.BILLING_URL_FAMILY_MONTHLY ? { family_monthly: process.env.BILLING_URL_FAMILY_MONTHLY } : {}),
      ...(process.env.BILLING_URL_FAMILY_ANNUAL ? { family_annual: process.env.BILLING_URL_FAMILY_ANNUAL } : {}),
    },
    billingManageUrl: process.env.BILLING_MANAGE_URL,
    childAsrProvider: (() => {
      const v = (process.env.CHILD_ASR_PROVIDER || "none").toLowerCase();
      if (modelProvider === "mock") return "none"; // B-INF-04: no outbound ASR under mock
      return v === "gemini" || v === "soapbox" || v === "whisper" ? v : "none";
    })(),
    whisperApiUrl: process.env.WHISPER_API_URL,
    whisperApiKey: process.env.WHISPER_API_KEY,
    whisperModel: process.env.WHISPER_MODEL || "whisper-1",
    soapboxApiUrl: process.env.SOAPBOX_API_URL,
    soapboxApiKey: process.env.SOAPBOX_API_KEY,
    ttsProvider: (process.env.TTS_PROVIDER || "none").toLowerCase() === "google" ? "google" : "none",
    ttsVoiceEn: process.env.TTS_VOICE_EN || "",
    ttsVoiceHe: process.env.TTS_VOICE_HE || "",
    ttsDisabled: modelProvider === "mock" || boolFromEnv(process.env.TTS_DISABLED, false), // B-INF-04: no outbound TTS under mock
    // No PII goes into the code; the salt only makes the code non-enumerable.
    referralSecret: process.env.REFERRAL_SECRET || "arbor-referral-dev-salt",
    referralMaxGrants: Number(process.env.REFERRAL_MAX_GRANTS || 5),
  };

  if (config.arborEnv === "prod") {
    // B-INF-04: this is also the refusal of MODEL_PROVIDER=mock in prod
    // (config/env.test.ts pins it) — fixtures never answer a real family.
    if (config.modelProvider !== "vertex") {
      throw new Error("Production Arbor requires MODEL_PROVIDER=vertex.");
    }
    if (config.memoryAdapter !== "firestore") {
      throw new Error("Production Arbor requires MEMORY_ADAPTER=firestore.");
    }
    if (config.enableLocalMemoryAdapter) {
      throw new Error("Production Arbor cannot enable ENABLE_LOCAL_MEMORY_ADAPTER.");
    }
    if (!config.gcpProjectId || !config.firebaseProjectId) {
      throw new Error("Production Arbor requires GCP_PROJECT_ID and FIREBASE_PROJECT_ID.");
    }
  }

  if (config.modelProvider === "vertex" && !config.gcpProjectId) {
    throw new Error("MODEL_PROVIDER=vertex requires GCP_PROJECT_ID.");
  }

  if (config.memoryAdapter === "firestore" && !config.firebaseProjectId) {
    throw new Error("MEMORY_ADAPTER=firestore requires FIREBASE_PROJECT_ID.");
  }

  return config;
};
