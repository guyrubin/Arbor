/** B-GA-26: observed Live connection time, NOT provider-billed audio minutes.
 * No audio/transcripts/tokens are stored. Server clocks and transactional deltas
 * make duplicate callbacks and concurrent heartbeats safe across instances.
 * Lost telemetry is explicitly incomplete; it is never priced as zero usage.
 */
import { randomUUID } from "node:crypto";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import type { Plan } from "./entitlements.js";
import { logger } from "./logger.js";

export type LiveUsageEvent = "opened" | "heartbeat" | "closed";
export type LiveUsageSession = {
  uid: string; familyId: string; plan: Plan; model: string;
  createdAt: number; expiresAt: number; openedAt?: number; lastSeenAt?: number;
  observedMs: number; closed: boolean; incomplete: boolean;
};
const MAX_GAP_MS = 45_000;
export function advanceLiveUsage(session: LiveUsageSession, event: LiveUsageEvent, now: number) {
  const next = { ...session };
  if (next.closed) return { session: next, deltaMs: 0, opened: false };
  const time = Math.max(next.createdAt, Math.min(now, next.expiresAt));
  let deltaMs = 0;
  let opened = false;
  if (event === "opened" && next.openedAt === undefined && now < next.expiresAt) {
    next.openedAt = time;
    next.lastSeenAt = time;
    opened = true;
  } else if (next.lastSeenAt !== undefined) {
    const gap = Math.max(0, time - next.lastSeenAt);
    // A suspended tab or a missing close must not invent minutes of speech.
    deltaMs = Math.min(gap, MAX_GAP_MS);
    next.incomplete ||= gap > MAX_GAP_MS;
    next.observedMs += deltaMs;
    next.lastSeenAt = Math.max(next.lastSeenAt, time);
  }
  if (event === "closed" || now >= next.expiresAt) next.closed = true;
  return { session: next, deltaMs, opened };
}

/** Half-open intervals: a heartbeat exactly at midnight belongs to yesterday. */
export function splitLiveUsageDays(end: number, remaining: number): Map<string, number> {
  const slices = new Map<string, number>();
  while (remaining > 0) {
    const day = new Date(end - 1).toISOString().slice(0, 10);
    const start = Date.parse(`${day}T00:00:00Z`);
    const amount = Math.min(remaining, end - start);
    slices.set(day, amount); remaining -= amount; end -= amount;
  }
  return slices;
}

export interface LiveUsageStore {
  create(input: Omit<LiveUsageSession, "createdAt" | "observedMs" | "closed" | "incomplete">): Promise<string>;
  report(uid: string, id: string, event: LiveUsageEvent): Promise<{ observedMs: number; incomplete: boolean } | null>;
}
const validId = (id: string) => /^[0-9a-f-]{36}$/.test(id);
export class MemoryLiveUsageStore implements LiveUsageStore {
  readonly sessions = new Map<string, LiveUsageSession>();
  async create(input: Parameters<LiveUsageStore["create"]>[0]) {
    const now = Date.now();
    for (const [id, s] of this.sessions) if (s.expiresAt + 86_400_000 < now) this.sessions.delete(id);
    const id = randomUUID();
    this.sessions.set(id, { ...input, createdAt: now, observedMs: 0, closed: false, incomplete: false });
    return id;
  }
  async report(uid: string, id: string, event: LiveUsageEvent) {
    const session = this.sessions.get(id);
    if (!validId(id) || !session || session.uid !== uid) return null;
    const result = advanceLiveUsage(session, event, Date.now());
    this.sessions.set(id, result.session);
    return { observedMs: result.session.observedMs, incomplete: result.session.incomplete };
  }
}

export function createLiveUsageStore(config: ArborConfig): LiveUsageStore {
  if (config.memoryAdapter !== "firestore") return new MemoryLiveUsageStore();
  if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
  const db = getFirestore(config.firestoreDatabaseId);
  // Existing aiQuota TTL and account-erasure path apply to these short-lived records.
  const ref = (uid: string, id: string) => db.collection("aiQuota").doc(`live_session_${uid}_${id}`);
  return {
    async create(input) {
      const id = randomUUID();
      await ref(input.uid, id).create({ ...input, createdAt: Date.now(), observedMs: 0, closed: false,
        incomplete: false, expireAt: new Date(input.expiresAt + 86_400_000) });
      return id;
    },
    async report(uid, id, event) {
      if (!validId(id)) return null;
      const committed = await db.runTransaction(async (tx) => {
        const doc = ref(uid, id);
        const snap = await tx.get(doc);
        if (!snap.exists) return null;
        const previous = snap.data() as LiveUsageSession;
        if (previous.uid !== uid) return null;
        const now = Date.now();
        const result = advanceLiveUsage(previous, event, now);
        tx.update(doc, result.session);
        if (result.deltaMs || result.opened) {
          // Split time at UTC midnight rather than crediting yesterday to today.
          const slices = splitLiveUsageDays(Math.min(now, previous.expiresAt), result.deltaMs);
          const openedDay = new Date(now).toISOString().slice(0, 10);
          if (result.opened && !slices.has(openedDay)) slices.set(openedDay, 0);
          for (const [day, ms] of slices) {
            tx.set(db.collection("usageRollup").doc(day), {
              date: day, live: { observedSessionMs: FieldValue.increment(ms),
                openedSessions: FieldValue.increment(result.opened && day === openedDay ? 1 : 0),
                byPlan: { [previous.plan]: { observedSessionMs: FieldValue.increment(ms) } } },
            }, { merge: true });
          }
        }
        return { observedMs: result.session.observedMs, incomplete: result.session.incomplete,
          deltaMs: result.deltaMs, familyId: previous.familyId, plan: previous.plan, model: previous.model };
      });
      if (committed) {
        logger.info("ai.usage", { route: "realtime_audio", provider: "gemini_live", model: committed.model,
          userUid: uid, familyId: committed.familyId, plan: committed.plan, sessionId: id,
          usageUnit: "observed_connection_ms", observedMs: committed.deltaMs,
          incomplete: committed.incomplete, billingVerified: false });
        return { observedMs: committed.observedMs, incomplete: committed.incomplete };
      }
      return null;
    },
  };
}
