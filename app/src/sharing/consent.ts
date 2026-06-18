/**
 * COPPA-2026 consent ledger (purpose-scoped, server-enforced).
 *
 * A grant records verifiable parental consent for ONE purpose on ONE child:
 *   - face_processing  — turn a reference photo into a stylized avatar
 *   - voice_processing — score the child's recorded speech (cloud ASR)
 *   - ai_training      — let Arbor use child-derived signals to improve models
 *                        (DEFAULT OFF, opt-in; Arbor's stance is to keep this off)
 *
 * Processing consents are time-boxed (default 365d) and re-prompt on expiry.
 * Enforcement is on the server (`requireConsent` middleware): a face/voice
 * endpoint never runs without an active, in-scope grant — the client cannot
 * bypass it. Mirrors the ShareStore pattern (sharing/shares.ts).
 */
import { randomUUID } from "crypto";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";

export type ConsentPurpose = "face_processing" | "voice_processing" | "ai_training";

export type ConsentGrant = {
  id: string;
  childId: string;
  purpose: ConsentPurpose;
  granted: boolean;
  policyVersion: string;
  actorUid: string;
  grantedAt: string;
  expiresAt: string | null; // null = no expiry (until revoked)
  revokedAt: string | null;
};

export const CONSENT_POLICY_VERSION = "2026-06-coppa-1";

/** Active only while granted, unrevoked, and unexpired. */
export const isConsentActive = (
  g: Pick<ConsentGrant, "granted" | "expiresAt" | "revokedAt"> | undefined | null,
  now: number = Date.now(),
): boolean => {
  if (!g || !g.granted) return false;
  if (g.revokedAt) return false;
  if (g.expiresAt && new Date(g.expiresAt).getTime() <= now) return false;
  return true;
};

const DAY = 86_400_000;
// Biometric-adjacent processing consents are time-boxed; ai_training is a
// standing opt-in preference (no expiry).
const defaultExpiry = (purpose: ConsentPurpose, now: number): string | null =>
  purpose === "ai_training" ? null : new Date(now + 365 * DAY).toISOString();

export type NewConsent = { childId: string; purpose: ConsentPurpose; granted: boolean; actorUid: string };

export const buildConsent = (input: NewConsent, now: number = Date.now()): ConsentGrant => ({
  id: randomUUID(),
  childId: input.childId,
  purpose: input.purpose,
  granted: input.granted,
  policyVersion: CONSENT_POLICY_VERSION,
  actorUid: input.actorUid,
  grantedAt: new Date(now).toISOString(),
  expiresAt: input.granted ? defaultExpiry(input.purpose, now) : null,
  revokedAt: input.granted ? null : new Date(now).toISOString(),
});

const latestActive = (grants: ConsentGrant[], purpose: ConsentPurpose, now: number): boolean => {
  const latest = grants
    .filter((g) => g.purpose === purpose)
    .sort((a, b) => b.grantedAt.localeCompare(a.grantedAt))[0];
  return isConsentActive(latest, now);
};

export interface ConsentStore {
  set(grant: ConsentGrant): Promise<ConsentGrant>;
  list(childId: string): Promise<ConsentGrant[]>;
  isActive(childId: string, purpose: ConsentPurpose, now?: number): Promise<boolean>;
  revoke(id: string): Promise<ConsentGrant | null>;
  /** GDPR erasure: hard-delete every consent record for a child. Returns the count. */
  eraseByChild(childId: string): Promise<number>;
}

/** In-memory store for sandbox/dev. */
export class LocalConsentStore implements ConsentStore {
  private grants = new Map<string, ConsentGrant>();
  async set(grant: ConsentGrant) { this.grants.set(grant.id, grant); return grant; }
  async list(childId: string) {
    return [...this.grants.values()].filter((g) => g.childId === childId).sort((a, b) => b.grantedAt.localeCompare(a.grantedAt));
  }
  async isActive(childId: string, purpose: ConsentPurpose, now: number = Date.now()) {
    return latestActive(await this.list(childId), purpose, now);
  }
  async revoke(id: string) {
    const g = this.grants.get(id);
    if (!g) return null;
    const next = { ...g, granted: false, revokedAt: new Date().toISOString() };
    this.grants.set(id, next);
    return next;
  }
  async eraseByChild(childId: string) {
    let removed = 0;
    for (const [id, g] of this.grants) if (g.childId === childId) { this.grants.delete(id); removed += 1; }
    return removed;
  }
}

/** Firestore-backed store (Cloud Run via ADC). Expiry enforced in code. */
export class FirestoreConsentStore implements ConsentStore {
  private readonly db;
  constructor(config: ArborConfig) {
    if (!getApps().length) {
      initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    }
    this.db = getFirestore(config.firestoreDatabaseId);
  }
  private col() { return this.db.collection("consents"); }

  async set(grant: ConsentGrant) { await this.col().doc(grant.id).set(grant); return grant; }
  async list(childId: string) {
    const snap = await this.col().where("childId", "==", childId).get();
    return snap.docs.map((d) => d.data() as ConsentGrant).sort((a, b) => b.grantedAt.localeCompare(a.grantedAt));
  }
  async isActive(childId: string, purpose: ConsentPurpose, now: number = Date.now()) {
    return latestActive(await this.list(childId), purpose, now);
  }
  async revoke(id: string) {
    const ref = this.col().doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const g = doc.data() as ConsentGrant;
    const revokedAt = new Date().toISOString();
    await ref.update({ granted: false, revokedAt });
    return { ...g, granted: false, revokedAt };
  }
  async eraseByChild(childId: string) {
    const snap = await this.col().where("childId", "==", childId).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
    return snap.size;
  }
}
