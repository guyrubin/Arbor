import type { RequestHandler } from "express";
import { getApps, initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { ArborConfig } from "../config/env.js";

/**
 * Whether API routes must carry a verified Firebase ID token. Defaults to off so
 * local/sandbox development keeps working without credentials; set REQUIRE_AUTH=true
 * (and provide Firebase Admin credentials) to enforce it in dev/stage/prod.
 */
const authRequired = () =>
  ["1", "true", "yes", "on"].includes((process.env.REQUIRE_AUTH || "").toLowerCase());

let adminReady = false;

const ensureAdminApp = (config: ArborConfig) => {
  if (adminReady || getApps().length > 0) {
    adminReady = true;
    return;
  }
  // Prefer explicit service-account creds; otherwise fall back to ADC (Cloud Run, etc.).
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const projectId = config.firebaseProjectId;

  if (clientEmail && privateKey && projectId) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  } else {
    initializeApp({ credential: applicationDefault() });
  }
  adminReady = true;
};

/**
 * Express middleware factory. When auth is required it verifies the bearer token and
 * attaches the decoded identity to `req.user`; otherwise it decodes opportunistically
 * (if a token is present) and always calls next().
 */
export const createAuthMiddleware = (config: ArborConfig): RequestHandler => {
  const required = authRequired();

  return async (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

    if (!token) {
      if (required) {
        res.status(401).json({ error: "Unauthorized", details: "Missing Authorization bearer token." });
        return;
      }
      next();
      return;
    }

    try {
      ensureAdminApp(config);
      const decoded = await getAuth().verifyIdToken(token);
      (req as any).user = { uid: decoded.uid, email: decoded.email ?? null };
      next();
    } catch (err: any) {
      if (required) {
        res.status(401).json({ error: "Unauthorized", details: "Invalid or expired Firebase ID token." });
        return;
      }
      // Non-enforced mode: ignore bad tokens and continue as anonymous.
      next();
    }
  };
};
