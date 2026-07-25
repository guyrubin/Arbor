/**
 * CARE-2 — recipient shared view v0: the server side of "Shared with you".
 *
 * Closes the sharing dead end: a recipient who holds a live, scoped grant can
 * open a READ-ONLY view of exactly the granted scopes. Everything here is
 * fail-closed and rides existing seams:
 *
 *  - grant resolution: `shareStore.get` + `isShareActive` (server-enforced
 *    expiry/revocation) + `grantScopes` (CARE-3 fail-closed scope
 *    normalization — an unrecognized legacy scope string grants NOTHING);
 *  - egress: `buildSharedScopePacket` (consult/packet.ts) is the ONLY way
 *    child data reaches a recipient, so `assertWithinCeiling` (forbidden-token
 *    scan for everyone + clinical-term scan for non-clinician recipients) runs
 *    on every payload. Raw subcollection documents are never returned — only
 *    derived, counts-only packet section lines.
 *
 * No new capture paths, no write access: the route is GET-only and this module
 * exposes no writers.
 */
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import type { MemoryStore } from "../memory/types.js";
import { foldMemoryEvents } from "../memory/memoryService.js";
import { grantScopes, isShareActive, type ShareRole, type ShareStore } from "../sharing/shares.js";
import { buildSharedScopePacket, type BuildPacketInput, type ConsultPacket } from "../consult/packet.js";
import { ClinicalLanguageError } from "../lib/clinicalScan.js";

/** The child record inputs the packet builder needs — everything EXCEPT nowMs. */
export type SharedChildRecord = Omit<BuildPacketInput, "nowMs">;

/** Read seam for the owner's child record. Injectable so tests (and the local
 *  adapter) never touch Firestore. Returns null when no record exists. */
export interface SharedChildRecordSource {
  load(ownerUid: string, childId: string): Promise<SharedChildRecord | null>;
}

/** What the recipient endpoint returns on success: grant metadata for the
 *  header + the guard-checked, scope-capped packet sections. Counts only —
 *  never a raw log/milestone/plan document. */
export type SharedPacketView = {
  childName: string | null;
  ownerEmail: string | null;
  role: ShareRole;
  expiresAt: string | null;
  scopes: string[];
  generatedAt: string;
  sections: ConsultPacket["sections"];
};

export type SharedPacketResult =
  | { status: 200; view: SharedPacketView }
  /** 403 = no access NOW (revoked, expired, wrong/missing recipient, or a
   *  legacy grant whose scopes fail-closed to nothing). The client drops the
   *  card on this status. */
  | { status: 403; error: string }
  | { status: 404; error: string }
  /** 422 = the fail-closed egress guard blocked the assembled payload. The
   *  guarded content is NEVER echoed back. */
  | { status: 422; error: string };

/** Resolve a recipient's shared-view request. Pure orchestration — all
 *  authorization and all egress guarding happens in the seams it calls. */
export async function resolveSharedPacket(opts: {
  grantId: string;
  /** Authenticated recipient email (null when unauthenticated → fail closed). */
  recipientEmail: string | null;
  shareStore: ShareStore;
  source: SharedChildRecordSource;
  now?: number;
}): Promise<SharedPacketResult> {
  const { grantId, recipientEmail, shareStore, source } = opts;
  const now = opts.now ?? Date.now();

  const grant = await shareStore.get(grantId);
  if (!grant) return { status: 404, error: "Share not found" };

  // Recipient identity check — fails closed without an authenticated email.
  const email = (recipientEmail ?? "").trim().toLowerCase();
  if (!email || email !== grant.recipientEmail) {
    return { status: 403, error: "This share is not addressed to you" };
  }

  // Server-enforced expiry/revocation.
  if (!isShareActive(grant, now)) {
    return { status: 403, error: "This share has been revoked or has expired" };
  }

  // CARE-3 fail-closed scope resolution: unrecognized legacy strings grant
  // nothing; a grant that resolves to zero scopes grants NO view at all.
  const scopes = grantScopes(grant);
  if (scopes.length === 0) {
    return { status: 403, error: "This share does not grant any recognized scopes" };
  }

  const record = await source.load(grant.ownerUid, grant.childId);
  if (!record) return { status: 404, error: "The shared child record is not available" };

  try {
    const packet = buildSharedScopePacket(scopes, grant.role === "professional", { ...record, nowMs: now });
    return {
      status: 200,
      view: {
        childName: grant.childName ?? null,
        ownerEmail: grant.ownerEmail ?? null,
        role: grant.role,
        expiresAt: grant.expiresAt ?? null,
        scopes,
        generatedAt: packet.generatedAt,
        sections: packet.sections,
      },
    };
  } catch (error) {
    if (error instanceof ClinicalLanguageError) {
      // Fail closed: never emit (or echo) content the egress guard blocked.
      return { status: 422, error: "This share cannot be displayed" };
    }
    throw error;
  }
}

/* ── Child-record sources ──────────────────────────────────────────────────── */

const num = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Firestore-backed source (Cloud Run via ADC): reads the owner's child doc +
 *  the packet-relevant subcollections the owner's client writes
 *  (users/{uid}/children/{childId}/…) and the approved memory ledger. The raw
 *  documents stay inside this process — only packet-derived lines egress. */
export class FirestoreSharedChildSource implements SharedChildRecordSource {
  private readonly db;
  constructor(config: ArborConfig, private readonly memoryStore: MemoryStore) {
    if (!getApps().length) {
      initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    }
    this.db = getFirestore(config.firestoreDatabaseId);
  }

  async load(ownerUid: string, childId: string): Promise<SharedChildRecord | null> {
    const childRef = this.db.doc(`users/${ownerUid}/children/${childId}`);
    const childDoc = await childRef.get();
    if (!childDoc.exists) return null;
    const profile = childDoc.data() as Record<string, unknown>;

    const [logsSnap, milestonesSnap, plansSnap, memoryEvents] = await Promise.all([
      childRef.collection("behaviorLogs").get(),
      childRef.collection("milestones").get(),
      childRef.collection("actionPlans").get(),
      this.memoryStore.listEvents(childId),
    ]);

    return {
      profile: {
        name: str(profile.name) || "This child",
        age: num(profile.age),
        languages: strArr(profile.languages),
        schoolContext: str(profile.schoolContext) || undefined,
        strengths: strArr(profile.strengths),
        challenges: strArr(profile.challenges),
      },
      logs: logsSnap.docs.map((d) => {
        const l = d.data() as Record<string, unknown>;
        return {
          behaviorType: str(l.behaviorType),
          intensity: num(l.intensity),
          timestamp: str(l.timestamp) || 0,
          trigger: str(l.trigger) || undefined,
          response: str(l.response) || undefined,
          resolved: l.resolved === true,
        };
      }),
      milestones: milestonesSnap.docs.map((d) => {
        const m = d.data() as Record<string, unknown>;
        // UND-4: pass the parent's actual response through (validated against
        // the closed literal set — anything else is dropped, fail quiet).
        const status =
          m.observationStatus === "yes" || m.observationStatus === "not_sure" || m.observationStatus === "not_yet"
            ? m.observationStatus
            : undefined;
        return {
          domain: str(m.domain),
          title: str(m.title),
          checked: m.checked === true,
          status,
          observedAt: str(m.observationUpdatedAt) || undefined,
        };
      }),
      plans: plansSnap.docs.map((d) => {
        const p = d.data() as Record<string, unknown>;
        return { title: str(p.title), issue: str(p.issue) || undefined };
      }),
      memory: foldMemoryEvents(memoryEvents, childId).map((m) => ({ fact: m.fact, status: m.status })),
    };
  }
}

/** Local/sandbox source: the local adapter has no server-side child record
 *  (child data lives in the owner's browser), so a recipient view resolves to
 *  "not available" — fail closed, never fabricated. */
export class NullSharedChildSource implements SharedChildRecordSource {
  async load(): Promise<SharedChildRecord | null> {
    return null;
  }
}

export const createSharedChildRecordSource = (
  config: ArborConfig,
  memoryStore: MemoryStore
): SharedChildRecordSource =>
  config.memoryAdapter === "firestore"
    ? new FirestoreSharedChildSource(config, memoryStore)
    : new NullSharedChildSource();
