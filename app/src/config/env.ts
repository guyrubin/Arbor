export type ArborEnvironment = "local" | "dev" | "stage" | "prod";
export type ModelProviderKind = "gemini_dev" | "vertex";
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
  vertexModelChat: string;
  vertexModelStory: string;
  vertexModelAnalysis: string;
  vertexModelHandoff: string;
  /** Image-generation model (Gemini 2.5 Flash Image / "Nano Banana"). Outputs carry SynthID + C2PA. */
  vertexModelImage: string;
  modelProvider: ModelProviderKind;
  geminiApiKey?: string;
  geminiModel: string;
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
  /** MON-2: hosted-checkout links keyed `${plan}_${cadence}` (e.g. plus_monthly). */
  billingCheckoutUrls: Record<string, string>;
  /** MON-2: customer self-service portal (Stripe Billing portal) for web subs. */
  billingManageUrl?: string;
};

const boolFromEnv = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const parseArborEnv = (value: string | undefined): ArborEnvironment => {
  const normalized = (value || "local").toLowerCase();
  if (["local", "dev", "stage", "prod"].includes(normalized)) return normalized as ArborEnvironment;
  throw new Error(`Invalid ARBOR_ENV "${value}". Use local, dev, stage, or prod.`);
};

const parseModelProvider = (value: string | undefined, arborEnv: ArborEnvironment): ModelProviderKind => {
  const normalized = (value || (arborEnv === "prod" ? "vertex" : "gemini_dev")).toLowerCase();
  if (normalized === "gemini_dev" || normalized === "vertex") return normalized;
  throw new Error(`Invalid MODEL_PROVIDER "${value}". Use gemini_dev or vertex.`);
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

  const config: ArborConfig = {
    nodeEnv: process.env.NODE_ENV || "development",
    arborEnv,
    port: Number(process.env.PORT || 3000),
    appUrl: process.env.APP_URL || "http://localhost:3000",
    corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    gcpProjectId: process.env.GCP_PROJECT_ID,
    gcpRegion: process.env.GCP_REGION || "europe-west4",
    vertexLocation: process.env.VERTEX_LOCATION || process.env.GCP_REGION || "europe-west4",
    vertexModelChat: process.env.VERTEX_MODEL_CHAT || "claude-3-5-sonnet@anthropic",
    vertexModelStory: process.env.VERTEX_MODEL_STORY || "gemini-2.5-flash",
    vertexModelAnalysis: process.env.VERTEX_MODEL_ANALYSIS || "gemini-2.5-flash",
    vertexModelHandoff: process.env.VERTEX_MODEL_HANDOFF || "gemini-2.5-flash",
    vertexModelImage: process.env.VERTEX_MODEL_IMAGE || "gemini-2.5-flash-image",
    modelProvider,
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
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
    billingCheckoutUrls: {
      ...(process.env.BILLING_URL_PLUS_MONTHLY ? { plus_monthly: process.env.BILLING_URL_PLUS_MONTHLY } : {}),
      ...(process.env.BILLING_URL_PLUS_ANNUAL ? { plus_annual: process.env.BILLING_URL_PLUS_ANNUAL } : {}),
      ...(process.env.BILLING_URL_FAMILY_MONTHLY ? { family_monthly: process.env.BILLING_URL_FAMILY_MONTHLY } : {}),
      ...(process.env.BILLING_URL_FAMILY_ANNUAL ? { family_annual: process.env.BILLING_URL_FAMILY_ANNUAL } : {}),
    },
    billingManageUrl: process.env.BILLING_MANAGE_URL,
  };

  if (config.arborEnv === "prod") {
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
