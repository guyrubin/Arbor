import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import type { ArborConfig } from "../config/env.js";
import { createModelProvider, type GenerateJsonOptions, type ModelProvider } from "../ai/modelRouter.js";
import { CapabilityRegistry } from "../ai/capabilities/registry.js";
import { providerRegion } from "../ai/capabilities/policy.js";
import type { CapabilityAdapter } from "../ai/capabilities/contracts.js";
import { createTtsCapabilityAdapter } from "./tts.js";
import { LocalMemoryStore } from "../memory/localMemoryStore.js";
import { FirestoreMemoryStore } from "../memory/firestoreMemoryStore.js";
import { LocalShareStore, FirestoreShareStore } from "../sharing/shares.js";
import { LocalConsentStore, FirestoreConsentStore } from "../sharing/consent.js";
import { loadFramework } from "../services/framework.js";
import { createApiRouter } from "../routes/api.js";
import { createAuthMiddleware } from "./authMiddleware.js";
import { createAiQuota, createCoachGate, createTtsQuota } from "./aiQuota.js";
import { createImageQuota } from "./imageQuota.js";
import { createCounterStore } from "./quotaStore.js";
import { createEntitlementStore, requirePlusFeature } from "./entitlements.js";
import { createReferralStore } from "./referral.js";
import { createBillingWebhookRouter } from "./billing.js";
import { createAdminMetricsStore } from "./adminMetrics.js";
import { initUsageRollup } from "./usageRollup.js";
import { createConsultStore } from "./consultRequests.js";
import { createWaitlistNotifierFromEnv, createWaitlistStore } from "./waitlist.js";
import { createPushTokenStore } from "./pushTokens.js";
import { requestObservability, logger } from "./logger.js";
import { requestContextMiddleware, bindUidToContext } from "./requestContext.js";
import { healthzHandler } from "./healthz.js";

/**
 * SEC-2: tightened Content-Security-Policy (was disabled). Allows exactly what
 * the built client needs: self-hosted bundle, Google fonts, Firebase Auth
 * (popup iframe + token endpoints), Firestore, and the Gemini Live direct
 * browser session (HTTPS + WSS). Local dev keeps CSP off because the Vite dev
 * middleware injects inline/eval scripts and a websocket.
 */
const cspDirectives = () => ({
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  objectSrc: ["'none'"],
  frameAncestors: ["'self'"],
  scriptSrc: ["'self'", "https://apis.google.com"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
  imgSrc: ["'self'", "data:", "blob:", "https://lh3.googleusercontent.com"],
  mediaSrc: ["'self'", "blob:", "data:"],
  workerSrc: ["'self'", "blob:"],
  connectSrc: [
    "'self'",
    "https://identitytoolkit.googleapis.com",
    "https://securetoken.googleapis.com",
    "https://www.googleapis.com",
    "https://firestore.googleapis.com",
    "https://generativelanguage.googleapis.com",
    "wss://generativelanguage.googleapis.com",
  ],
  frameSrc: ["'self'", "https://*.firebaseapp.com", "https://accounts.google.com"],
});

/**
 * COACH-3 + AIR-8: the CapabilityRegistry the app boots with. Since AIR-8 the
 * registry has a REAL request-time consumer: /api/tts resolves synthesis
 * through `registry.get("speech_synthesis", ...)` (server/tts.ts
 * dispatchSpeechSynthesis), so this is the live TTS dispatch seam — not
 * boot-only scaffolding. The structured-text adapters remain a declared
 * surface (routes call the ModelProvider directly; the policy layer inside
 * modelForRoute is what is live there). Exact-match only: policy
 * (selectProvider) chooses an eligible provider first, and no implicit
 * fallback can weaken it; a missing adapter fails closed (not_configured).
 * The TTS adapter itself runs the unconditional lexical safety floor, so the
 * registry never exposes unscreened synthesis to any caller.
 */
export const buildCapabilityRegistry = (config: ArborConfig, modelProvider: ModelProvider): CapabilityRegistry => {
  const registry = new CapabilityRegistry();
  const region = providerRegion(config.vertexLocation);

  registry.register(createTtsCapabilityAdapter(config));

  const structuredText = (provider: string, model: string): CapabilityAdapter<"structured_text", GenerateJsonOptions, unknown> => ({
    capability: "structured_text",
    provider: { provider, model, region: provider === "gemini_dev" ? "global" : region },
    execute: (options) => modelProvider.generateJson(options),
  });
  if (config.modelProvider === "vertex") {
    registry.register(structuredText("vertex_claude", config.vertexModelChat));
    registry.register(structuredText("vertex_gemini", config.vertexModelAnalysis));
  } else {
    registry.register(structuredText("gemini_dev", config.geminiModel));
  }
  return registry;
};

export const createApp = (config: ArborConfig) => {
  const app = express();
  // Cloud Run (and Firebase Hosting rewrites) front the app with a proxy, so the
  // real client IP arrives via X-Forwarded-For. Trust exactly one hop so
  // express-rate-limit keys on the user, not the proxy. (Without this it logs
  // ERR_ERL_UNEXPECTED_X_FORWARDED_FOR and rate-limits everyone as one IP.)
  app.set("trust proxy", 1);
  const framework = loadFramework();
  const modelProvider = createModelProvider(config);
  // COACH-3 + AIR-8: register the config's real AI adapters at boot (duplicate
  // or malformed registrations throw here, not mid-request). The registry is
  // handed to the API router — /api/tts dispatches synthesis through it.
  const aiCapabilityRegistry = buildCapabilityRegistry(config, modelProvider);
  app.set("aiCapabilityRegistry", aiCapabilityRegistry);
  const memoryStore = config.memoryAdapter === "firestore"
    ? new FirestoreMemoryStore(config)
    : new LocalMemoryStore();
  const shareStore = config.memoryAdapter === "firestore"
    ? new FirestoreShareStore(config)
    : new LocalShareStore();
  const consentStore = config.memoryAdapter === "firestore"
    ? new FirestoreConsentStore(config)
    : new LocalConsentStore();
  // COST-1: shared usage counters (Firestore in prod) back both the hourly AI
  // quota and the free-tier coach meter, so caps hold across Cloud Run instances.
  const counters = createCounterStore(config);
  const entitlementStore = createEntitlementStore(config);
  // mk-p0-2: referral store writes comp Plus grants through the entitlement seam.
  const referralStore = createReferralStore(config, entitlementStore);
  const consultStore = createConsultStore(config);
  // B2: pre-auth waitlist capture — no AI, no entitlement dependency.
  const waitlistStore = createWaitlistStore(config);
  const waitlistNotifier = createWaitlistNotifierFromEnv();
  // WAITLIST-OPS-DOCS: make the prod-arming state observable (a mistyped env var
  // silently disables founder notifications otherwise).
  logger.info(`Waitlist founder notifications ${waitlistNotifier ? "enabled" : "disabled"}`);
  // C2: push token store. Always created (firebase-admin is an existing dep);
  // the feature is gated client-side by VITE_FIREBASE_VAPID_KEY, not by this.
  const pushTokenStore = createPushTokenStore(config);
  // ADM-1 / COST-3: founder metrics read-side + the daily token-usage rollup writer.
  const adminMetrics = createAdminMetricsStore(config);
  initUsageRollup(config);

  // OPS-1: request ids + structured request logs on every route.
  app.use(requestObservability);
  // COST-2: carry request id + uid through the async chain for token-usage attribution.
  app.use(requestContextMiddleware);

  // OPS-A1: unauthenticated liveness + version probe, mounted before the /api auth
  // chain so deploys can be verified from outside (CI smoke / uptime / curl).
  app.get("/healthz", healthzHandler);

  app.use(helmet({
    contentSecurityPolicy: config.arborEnv === "local" ? false : { directives: cspDirectives() },
    crossOriginEmbedderPolicy: false, // Firebase auth popup is cross-origin
  }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed by Arbor CORS policy."));
    }
  }));
  // MON-2: billing webhook — mounted BEFORE the /api auth + rate-limit chain
  // (RevenueCat carries its own shared-secret header, not a Firebase token) and
  // parses its own JSON body. It is the only writer of entitlements/{uid}.
  app.use("/webhooks/billing", createBillingWebhookRouter(config, entitlementStore));
  app.use("/api", rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Rate limit exceeded",
      details: "Too many Arbor requests from this IP. Please wait a minute and try again."
    }
  }));
  // Vision/document images need a larger body than the default API limit.
  app.use("/api/vision", express.json({ limit: "12mb" }));
  // Image-generation endpoints receive the child's generated avatar (a ~1-2MB
  // data URL) as a style reference, which blows the 250kb default → 413 and a
  // blank card. Give them the same headroom as vision (handlers still enforce a
  // 6MB per-image cap). This is the fix for the "Academy/Playbank cards have no
  // images" regression (generate-scene was returning 413 in prod).
  app.use(
    ["/api/generate-scene", "/api/generate-comic", "/api/generate-avatar"],
    express.json({ limit: "12mb" }),
  );
  app.use(express.json({ limit: "250kb" }));
  app.use("/api", createAuthMiddleware(config));
  // COST-2: now that auth has resolved, stamp the uid onto the active usage context.
  app.use("/api", bindUidToContext);
  // A1/A2 (CIL-bugs-imagegen-quota-missing): per-user hourly cap on EVERY
  // route that calls a paid model or mints a paid token. The original allow-list
  // was missing /voice, /extract-log, /generate-adventure, /generate-hero-journey,
  // and /live/token — all of which call the model and previously had only the
  // ~30/min IP backstop (no per-user ceiling). Added here without touching any
  // route handler or consent/billing middleware.
  // The image-gen endpoints are also included for the hourly abuse cap AND get a
  // tighter daily image cap below (S2 — image generation is a pricier SKU).
  app.use(
    [
      "/api/voice",
      "/api/extract-log",
      "/api/vision",
      "/api/generate-plan",
      "/api/generate-story",
      "/api/generate-adventure",
      "/api/generate-hero-journey",
      "/api/analyze-behavior",
      "/api/generate-handoff",
      "/api/digest",
      "/api/generate-avatar",
      "/api/generate-scene",
      "/api/generate-comic",
      "/api/live/token",
      // VC-7: the upcoming screened Live turn endpoint sits under the SAME
      // per-user metering as the token mint, so Live usage is bounded and
      // visible the moment that route lands (firewall condition 4).
      "/api/live/turn",
      // AIR-5: the lightweight Today's Focus generator is a model call, so it
      // sits inside the hourly AI quota — but NOT under the coach meter (an
      // ambient card must never silently burn the free plan's daily coach
      // messages; the /chat+/council coach gate below deliberately excludes it).
      "/api/todays-focus",
    ],
    createAiQuota(counters)
  );
  // AIR-6: /api/tts left the model-call quota — spoken sentences are not model
  // calls and must never 429 a voice conversation mid-session. It gets its own
  // character-based daily meter (Cloud TTS bills per character). The lexical
  // safety screen inside the /tts handler is untouched and unconditional.
  app.use("/api/tts", createTtsQuota(counters));
  // S2: per-user DAILY image-generation cap + global circuit breaker. Closes the
  // unbounded-cost leak on the three image endpoints (avatar / scene / comic),
  // which previously had no quota at all.
  app.use(
    ["/api/generate-avatar", "/api/generate-scene", "/api/generate-comic"],
    createImageQuota(counters)
  );
  // MON-1: free-tier coach meter + Plus-only feature gates. Production enforces
  // by default; local beta can still opt out with ENFORCE_ENTITLEMENTS=false.
  // AIR-7: /chat and /council use ONE combined gate (hourly quota + entitlement
  // resolved concurrently, coach meter after) instead of the serial
  // aiQuota→coachMeter pair — same headers, same 429/402 payloads, fewer
  // sequential Firestore round-trips before the first model token.
  app.use(["/api/chat", "/api/council"], createCoachGate(counters, entitlementStore));
  app.use("/api/generate-handoff", requirePlusFeature(entitlementStore, "professionalReports", "Professional reports"));
  app.use("/api/generate-plan", requirePlusFeature(entitlementStore, "advancedPlans", "Advanced growth plans"));
  app.use("/api", createApiRouter({ config, modelProvider, memoryStore, shareStore, consentStore, framework, entitlementStore, referralStore, counters, consultStore, adminMetrics, waitlistStore, waitlistNotifier, pushTokenStore, aiCapabilityRegistry }));

  return app;
};
