import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import type { ArborConfig } from "../config/env.js";
import { createModelProvider } from "../ai/modelRouter.js";
import { LocalMemoryStore } from "../memory/localMemoryStore.js";
import { FirestoreMemoryStore } from "../memory/firestoreMemoryStore.js";
import { loadFramework } from "../services/framework.js";
import { createApiRouter } from "../routes/api.js";

export const createApp = (config: ArborConfig) => {
  const app = express();
  const framework = loadFramework();
  const modelProvider = createModelProvider(config);
  const memoryStore = config.memoryAdapter === "firestore"
    ? new FirestoreMemoryStore(config)
    : new LocalMemoryStore();

  app.use(helmet({ contentSecurityPolicy: false }));
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
  app.use(express.json({ limit: "250kb" }));
  app.use("/api", createApiRouter({ config, modelProvider, memoryStore, framework }));

  return app;
};
