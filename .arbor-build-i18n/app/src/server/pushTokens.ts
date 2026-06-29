/**
 * C2 — Server push token store + nudge sender.
 *
 * PRIVACY CONTRACT:
 *   - Stored: { uid, tokenHash (SHA-256), createdAt }. Raw token NEVER persisted
 *     to Firestore.
 *   - sendNudgePush payload carries NO child data — generic title/body only.
 *   - Firestore collections: "pushTokens" (hash-keyed), "pushTokenIndex" (uid-keyed).
 *
 * DEPLOY-INFRA — scheduled send trigger (build-to-green here; wiring is infra):
 *   Cloud Scheduler (hourly) -> Cloud Function: arbor-nudge-push
 *     reads JITAI window per uid from Firestore,
 *     calls sendNudgePush(uid, store) for matching uids.
 *   /api/push/test-send proves the path before this is provisioned.
 */

import { createHash } from "crypto";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import type { ArborConfig } from "../config/env.js";
import { logger } from "./logger.js";

export type PushTokenRecord = {
  uid: string;
  tokenHash: string;
  createdAt: string;
};

export interface PushTokenStore {
  upsert(uid: string, rawToken: string): Promise<void>;
  remove(uid: string): Promise<void>;
  /** Returns raw token (local) or registered sentinel (Firestore); null = not opted in. */
  getToken(uid: string): Promise<string | null>;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// -- Local (dev/test) --------------------------------------------------------

export class LocalPushTokenStore implements PushTokenStore {
  private records = new Map<string, { hash: string; raw: string; createdAt: string }>();

  async upsert(uid: string, rawToken: string): Promise<void> {
    this.records.set(uid, { hash: sha256(rawToken), raw: rawToken, createdAt: new Date().toISOString() });
  }
  async remove(uid: string): Promise<void> {
    this.records.delete(uid);
  }
  async getToken(uid: string): Promise<string | null> {
    return this.records.get(uid)?.raw ?? null;
  }
}

// -- Firestore (prod) --------------------------------------------------------

export class FirestorePushTokenStore implements PushTokenStore {
  private readonly db;

  constructor(config: ArborConfig) {
    if (!getApps().length) {
      initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    }
    this.db = getFirestore();
  }

  async upsert(uid: string, rawToken: string): Promise<void> {
    const tokenHash = sha256(rawToken);
    await this.db.collection("pushTokens").doc(tokenHash).set(
      { uid, tokenHash, createdAt: new Date().toISOString() },
      { merge: true },
    );
    await this.db.collection("pushTokenIndex").doc(uid).set(
      { tokenHash, updatedAt: new Date().toISOString() },
      { merge: true },
    );
  }

  async remove(uid: string): Promise<void> {
    const indexRef = this.db.collection("pushTokenIndex").doc(uid);
    const snap = await indexRef.get();
    const tokenHash = snap.data()?.tokenHash as string | undefined;
    if (tokenHash) await this.db.collection("pushTokens").doc(tokenHash).delete();
    await indexRef.delete();
  }

  async getToken(uid: string): Promise<string | null> {
    const snap = await this.db.collection("pushTokenIndex").doc(uid).get();
    if (!snap.exists) return null;
    const tokenHash = snap.data()?.tokenHash as string | undefined;
    if (!tokenHash) return null;
    // Raw token is not stored in Firestore (privacy). Return a sentinel
    // confirming opt-in. Prod raw-token retrieval is a deploy-infra follow-up.
    return `registered:${tokenHash}`;
  }
}

export const createPushTokenStore = (config: ArborConfig): PushTokenStore =>
  config.memoryAdapter === "firestore"
    ? new FirestorePushTokenStore(config)
    : new LocalPushTokenStore();

// -- Nudge sender ------------------------------------------------------------

/**
 * Send a generic JITAI nudge to uid via firebase-admin messaging.
 * PRIVACY: notification payload carries NO child data.
 */
export async function sendNudgePush(
  uid: string,
  store: PushTokenStore,
): Promise<"sent" | "no-token" | "error"> {
  const tokenOrSentinel = await store.getToken(uid);
  if (!tokenOrSentinel) return "no-token";

  // Local store returns the raw token; Firestore store returns a sentinel.
  const rawToken = tokenOrSentinel.startsWith("registered:") ? null : tokenOrSentinel;
  if (!rawToken) {
    // DEPLOY-INFRA: prod raw-token retrieval not yet wired. Confirms opt-in only.
    logger.info("sendNudgePush: uid opted in; prod raw-token path pending deploy-infra", { uid });
    return "no-token";
  }

  try {
    const nudgeId = `nudge-${Date.now()}`;
    await getMessaging().send({
      token: rawToken,
      notification: {
        // Generic only — no child data ever.
        title: "Arbor has a moment for you",
        body: "Open Arbor to see what's ready for today.",
      },
      data: { nudgeId },
      webpush: {
        notification: {
          icon: "/arbor-icon-192.png",
          badge: "/arbor-icon-96.png",
          tag: "arbor-nudge",
        },
        fcmOptions: { link: "/" },
      },
    });
    logger.info("sendNudgePush: sent", { uid, nudgeId });
    return "sent";
  } catch (err) {
    logger.error("sendNudgePush: FCM send failed", err as Error, { uid });
    return "error";
  }
}
