import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import type { ArborConfig } from "../config/env.js";
import { createModelProvider } from "../ai/modelRouter.js";
import { LocalMemoryStore } from "../memory/localMemoryStore.js";
import { FirestoreMemoryStore } from "../memory/firestoreMemoryStore.js";
import { LocalShareStore, FirestoreShareStore } from "../sharing/shares.js";
import { loadFramework } from "../services/framework.js";
import { createApiRouter } from "../routes/api.js";
import { createAuthMiddleware } from "./authMiddleware.js";
import { createAiQuota } from "./aiQuota.js";
import { createCounterStore } from "./quotaStore.js";
import { createEntitlementStore, createCoachMeter, requirePlusFeature } from "./entitlements.js";
import { createConsultStore } from "./consultRequests.js";
import { requestObservability } from "./logger.js";

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
  const framework = loadFramework();
  const modelProvider = createModelProvider(config);
  const memoryStore = config.memoryAdapter === "firestore"
    ? new FirestoreMemoryStore(config)
    : new LocalMemoryStore();
  const shareStore = config.memoryAdapter === "firestore"
    ? new FirestoreShareStore(config)
    : new LocalShareStore();
  // COST-1: shared usage counters (Firestore in prod) back both the hourly AI
  // quota and the free-tier coach meter, so caps hold across Cloud Run instances.
  const counters = createCounterStore(config);
  const entitlementStore = createEntitlementStore(config);
  const consultStore = createConsultStore(config);

  // OPS-1: request ids + structured request logs on every route.
  app.use(requestObservability);

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
  app.use(express.json({ limit: "250kb" }));
  app.use("/api", createAuthMiddleware(config));
  // Per-user hourly cap on the AI-generating endpoints (cost guardrail).
  app.use(
    ["/api/chat", "/api/council", "/api/generate-plan", "/api/generate-story", "/api/analyze-behavior", "/api/generate-handoff", "/api/digest"],
    createAiQuota(counters)
  );
  // MON-1: free-tier coach meter + Plus-only feature gates. No-ops until
  // ENFORCE_ENTITLEMENTS=true (everyone resolves to Plus during the beta).
  app.use(["/api/chat", "/api/council"], createCoachMeter(entitlementStore, counters));
  app.use("/api/generate-handoff", requirePlusFeature(entitlementStore, "professionalReports", "Professional reports"));
  app.use("/api/generate-plan", requirePlusFeature(entitlementStore, "advancedPlans", "Advanced growth plans"));
  app.use("/api", createApiRouter({ config, modelProvider, memoryStore, shareStore, framework, entitlementStore, counters, consultStore }));

  return app;
};
