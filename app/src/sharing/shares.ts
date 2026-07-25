/**
 * Co-parent / trusted sharing with SERVER-ENFORCED expiry (v6 TRB-3 + SAFE-4).
 *
 * A share grant gives another adult (co-parent, viewer, or professional) scoped,
 * time-boxed access to a child's information. Expiry is enforced on the server:
 * every read passes grants through `isShareActive`, so an expired or revoked grant
 * never resolves — the client cannot bypass it.
 */
import { randomUUID } from "crypto";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import { normalizeScopes, type ShareScopeId } from "../lib/shareScopes.js";

export type ShareRole = "co_parent" | "viewer" | "professional";

export type ShareGrant = {
  id: string;
  ownerUid: string;
  ownerEmail: string | null;
  childId: string;
  childName: string | null;
  recipientEmail: string;
  role: ShareRole;
  /** Stable ShareScopeIds (CARE-3), e.g. ["story_timeline", "report_teacher"].
   *  Pre-CARE-3 grants may still hold English display labels — always resolve
   *  through `grantScopes`/`grantAllowsScope`, never read this field raw. */
  scopes: string[];
  createdAt: string;
  expiresAt: string | null;   // ISO, or null = until revoked
  revokedAt: string | null;
};

/** SERVER-ENFORCED expiry: a grant resolves only while live and unrevoked. */
export const isShareActive = (g: Pick<ShareGrant, "expiresAt" | "revokedAt">, now: number = Date.now()): boolean => {
  if (g.revokedAt) return false;
  if (g.expiresAt && new Date(g.expiresAt).getTime() <= now) return false;
  return true;
};

/** SERVER-ENFORCED scope resolution (CARE-3): what a grant's stored scopes —
 *  stable IDs or pre-migration English labels — actually grant. FAILS CLOSED:
 *  an unrecognized legacy string resolves to nothing, never a broader default. */
export const grantScopes = (g: Pick<ShareGrant, "scopes">): ShareScopeId[] => normalizeScopes(g.scopes);

/** True only while the grant is live AND resolves the stable scope ID. This is
 *  the ONE check any recipient-facing read must pass (CARE-2 consumes it). */
export const grantAllowsScope = (
  g: Pick<ShareGrant, "scopes" | "expiresAt" | "revokedAt">,
  scope: ShareScopeId,
  now: number = Date.now(),
): boolean => isShareActive(g, now) && grantScopes(g).includes(scope);

/** Map a friendly duration to a concrete expiry instant (the server's source of truth). */
export const expiryFromDuration = (duration: string | undefined, now: number = Date.now()): string | null => {
  const d = (duration || "").toLowerCase().trim();
  const iso = (ms: number) => new Date(now + ms).toISOString();
  const DAY = 86_400_000;
  if (!d || d.includes("never") || d.includes("revok")) return null;
  if (d.includes("7") || d.includes("week")) return iso(7 * DAY);
  if (d.includes("30") || d.includes("month")) return iso(30 * DAY);
  if (d.includes("90") || d.includes("term")) return iso(90 * DAY);
  if (d.includes("60")) return iso(60 * DAY);
  return iso(30 * DAY);
};

export type NewShare = {
  ownerUid: string;
  ownerEmail: string | null;
  childId: string;
  childName?: string | null;
  recipientEmail: string;
  role?: ShareRole;
  scopes?: string[];
  duration?: string;
};

export const buildGrant = (input: NewShare, now: number = Date.now()): ShareGrant => ({
  id: randomUUID(),
  ownerUid: input.ownerUid,
  ownerEmail: input.ownerEmail ?? null,
  childId: input.childId,
  childName: input.childName ?? null,
  recipientEmail: input.recipientEmail.trim().toLowerCase(),
  role: input.role ?? "viewer",
  // CARE-3: store stable scope IDs only. Requested scopes (stable IDs or legacy
  // English labels from an old client) normalize through the fail-closed map —
  // unrecognized strings are DROPPED, never widened. No scopes requested at all
  // keeps the historical narrowest default (timeline → story_timeline).
  scopes: input.scopes?.length ? normalizeScopes(input.scopes) : ["story_timeline" satisfies ShareScopeId],
  createdAt: new Date(now).toISOString(),
  expiresAt: expiryFromDuration(input.duration, now),
  revokedAt: null,
});

/** CARE-6: owner-side listing options. `includeInactive` returns revoked and
 *  expired grants too — the owner's own grant records (createdAt/expiresAt/
 *  revokedAt) ARE the sharing audit history; no separate event log needed.
 *  Recipient reads are untouched: an inactive grant never resolves for them. */
export type ListByOwnerOptions = { includeInactive?: boolean };

export interface ShareStore {
  create(grant: ShareGrant): Promise<ShareGrant>;
  listByOwner(ownerUid: string, childId?: string, opts?: ListByOwnerOptions): Promise<ShareGrant[]>;
  listByRecipient(email: string): Promise<ShareGrant[]>;
  get(id: string): Promise<ShareGrant | null>;
  revoke(id: string, ownerUid: string): Promise<ShareGrant | null>;
  /** GDPR erasure: hard-delete every grant (active, expired, or revoked) the owner created for a child. */
  eraseByChild(ownerUid: string, childId: string): Promise<number>;
}

/** In-memory store for sandbox/dev. */
export class LocalShareStore implements ShareStore {
  private grants = new Map<string, ShareGrant>();

  async create(grant: ShareGrant) { this.grants.set(grant.id, grant); return grant; }

  async listByOwner(ownerUid: string, childId?: string, opts?: ListByOwnerOptions) {
    return [...this.grants.values()]
      .filter((g) => g.ownerUid === ownerUid && (!childId || g.childId === childId) && (opts?.includeInactive || isShareActive(g)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listByRecipient(email: string) {
    const e = email.trim().toLowerCase();
    return [...this.grants.values()]
      .filter((g) => g.recipientEmail === e && isShareActive(g))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(id: string) { return this.grants.get(id) ?? null; }

  async revoke(id: string, ownerUid: string) {
    const g = this.grants.get(id);
    if (!g || g.ownerUid !== ownerUid) return null;
    const next = { ...g, revokedAt: new Date().toISOString() };
    this.grants.set(id, next);
    return next;
  }

  async eraseByChild(ownerUid: string, childId: string) {
    let removed = 0;
    for (const [id, g] of this.grants) {
      if (g.ownerUid === ownerUid && g.childId === childId) {
        this.grants.delete(id);
        removed += 1;
      }
    }
    return removed;
  }
}

/** Firestore-backed store (Cloud Run via ADC). Expiry is still enforced in code. */
export class FirestoreShareStore implements ShareStore {
  private readonly db;
  constructor(config: ArborConfig) {
    if (!getApps().length) {
      initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    }
    this.db = getFirestore(config.firestoreDatabaseId);
  }
  private col() { return this.db.collection("shares"); }

  async create(grant: ShareGrant) {
    await this.col().doc(grant.id).set(grant);
    return grant;
  }

  async listByOwner(ownerUid: string, childId?: string, opts?: ListByOwnerOptions) {
    let q = this.col().where("ownerUid", "==", ownerUid) as FirebaseFirestore.Query;
    if (childId) q = q.where("childId", "==", childId);
    const snap = await q.get();
    return snap.docs
      .map((d) => d.data() as ShareGrant)
      .filter((g) => opts?.includeInactive || isShareActive(g))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listByRecipient(email: string) {
    const snap = await this.col().where("recipientEmail", "==", email.trim().toLowerCase()).get();
    return snap.docs
      .map((d) => d.data() as ShareGrant)
      .filter((g) => isShareActive(g))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(id: string) {
    const doc = await this.col().doc(id).get();
    return doc.exists ? (doc.data() as ShareGrant) : null;
  }

  async revoke(id: string, ownerUid: string) {
    const ref = this.col().doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const g = doc.data() as ShareGrant;
    if (g.ownerUid !== ownerUid) return null;
    const revokedAt = new Date().toISOString();
    await ref.update({ revokedAt });
    return { ...g, revokedAt };
  }

  async eraseByChild(ownerUid: string, childId: string) {
    const snap = await this.col()
      .where("ownerUid", "==", ownerUid)
      .where("childId", "==", childId)
      .get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
    return snap.size;
  }
}
