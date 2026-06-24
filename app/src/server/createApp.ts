import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import type { ArborConfig } from "../config/env.js";
import { createModelProvider } from "../ai/modelRouter.js";
import { LocalMemoryStore } from "../memory/localMemoryStore.js";
import { FirestoreMemoryStore } from "../memory/firestoreMemoryStore.js";
import { LocalShareStore, FirestoreShareStore } from "../sharing/shares.js";
import { LocalConsentStore, FirestoreConsentStore } from "../sharing/consent.js";
import { loadFramework } from "../services/framework.js";
import { createApiRouter } from "../routes/api.js";
import { createAuthMiddleware } from "./authMiddleware.js";
import { createAiQuota } from "./aiQuota.js";
import { createImageQuota } from "./imageQuota.js";
import { createCounterStore } from "./quotaStore.js";
import { createEntitlementStore, createCoachMeter, requirePlusFeature } from "./entitlements.js";
import { createReferralStore } from "./referral.js";
import { createBillingWebhookRouter } from "./billing.js";
import { createAdminMetricsStore } from "./adminMetrics.js";
import { initUsageRollup } from "./usageRollup.js";
import { createConsultStore } from "./consultRequests.js";
import { createWaitlistStore } from "./waitlist.js";
import { createPushTokenStore } from "./pushTokens.js";
import { requestObservability } from "./logger.js";
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

export const createApp = (config: ArborConfig) => {
  const app = express();
  // Cloud Run (and Firebase Hosting rewrites) front the app with a proxy, so the
  // real client IP arrives via X-Forwarded-For. Trust exactly one hop so
  // express-rate-limit keys on the user, not the proxy. (Without this it logs
  // ERR_ERL_UNEXPECTED_X_FORWARDED_FOR and rate-limits everyone as one IP.)
  app.set("trust proxy", 1);
  const framework = loadFramework();
  const modelProvider = createModelProvider(config);
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
      "/api/chat",
      "/api/council",
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
    ],
    createAiQuota(counters)
  );
  // S2: per-user DAILY image-generation cap + global circuit breaker. Closes the
  // unbounded-cost leak on the three image endpoints (avatar / scene / comic),
  // which previously had no quota at all.
  app.use(
    ["/api/generate-avatar", "/api/generate-scene", "/api/generate-comic"],
    createImageQuota(counters)
  );
  // MON-1: free-tier coach meter + Plus-only feature gates. Production enforces
  // by default; local beta can still opt out with ENFORCE_ENTITLEMENTS=false.
  app.use(["/api/chat", "/api/council"], createCoachMeter(entitlementStore, counters));
  app.use("/api/generate-handoff", requirePlusFeature(entitlementStore, "professionalReports", "Professional reports"));
  app.use("/api/generate-plan", requirePlusFeature(entitlementStore, "advancedPlans", "Advanced growth plans"));
  app.use("/api", createApiRouter({ config, modelProvider, memoryStore, shareStore, consentStore, framework, entitlementStore, referralStore, counters, consultStore, adminMetrics, waitlistStore, pushTokenStore }));

  return app;
};
