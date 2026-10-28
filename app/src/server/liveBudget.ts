/** B-AIOPS-02: the shared-family daily Live (realtime voice) allowance.
 *
 * Accepted intent (GA backlog, Interpretation): Free 3 minutes, Plus/Family
 * 20 minutes of realtime voice per FAMILY per day, across every parent,
 * session and device. A direct-to-provider Live token stays usable until its
 * provider expiry, so a client-side countdown proves nothing and a refund on
 * a browser "closed" report would let a modified client keep spending the
 * token. The enforceable unit is therefore a NON-REFUNDABLE, EXPIRING
 * RESERVATION: minting a token reserves a bounded slice (<= 5 min) against
 * today's family allowance inside one transaction, and the token's provider
 * `expireTime` IS the reservation end. Renewal is simply the next mint: it
 * reserves the next slice only while allowance remains. Observed connection time is recorded
 * beside the reservation for B-GA-26 reconciliation; it never credits the
 * budget on a client report, and even the opt-in expiry credit can never
 * exceed the unconsumed part of an expired reservation.
 *
 * The FALLBACK path (browser speech-to-text → /api/voice → read-aloud) spends
 * the same allowance. Each fallback turn reserves VOICE_TURN_RESERVE_MS before
 * the model is called; when the response ends the SERVER settles it to the
 * spoken length of what it actually handled (the parent's words plus every
 * released reply sentence, at SPOKEN_CHARS_PER_SECOND). Unlike a Live token,
 * nothing outlives that response, so settling below the reserve refunds
 * nothing a client could still spend. A server crash mid-turn leaves the turn
 * unsettled; it is charged its full reserve at expiry.
 *
 * Storage: `aiQuota/live_family_{familyId}_{YYYY-MM-DD}` (Admin SDK only; the
 * rules file has no client match for aiQuota, unlike `families/{id}` which a
 * member may update). Family-level usage only: parent uids and millisecond
 * counts, no child data, no audio, no transcripts. The day is the UTC day,
 * the same boundary liveUsage.ts already splits on (no family timezone exists).
 */
import { randomUUID } from "node:crypto";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import type { Plan } from "./entitlements.js";
import { logger } from "./logger.js";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const envNum = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return process.env[name] !== undefined && Number.isFinite(v) && v >= 0 ? v : fallback;
};

/** Accepted allowance per plan (minutes/day), env-overridable for staging. */
export const liveAllowanceMs = (plan: Plan): number =>
  (plan === "free" ? envNum("LIVE_FREE_MINUTES_PER_DAY", 3) : envNum("LIVE_PAID_MINUTES_PER_DAY", 20)) * MINUTE_MS;
/** One reservation (and token lifetime) is at most 5 minutes; never longer. */
export const LIVE_SLICE_MAX_MS = 5 * MINUTE_MS;
export const liveSliceMs = (): number =>
  Math.min(LIVE_SLICE_MAX_MS, Math.max(MINUTE_MS, envNum("LIVE_RESERVATION_MINUTES", 5) * MINUTE_MS));
/** A remainder shorter than this cannot carry a conversation: treat as spent. */
export const LIVE_MIN_SLICE_MS = 30_000;
/** Expiry reconciliation policy. "none" (default): an expired reservation is
 *  charged in full. "observed": an expired reservation whose telemetry is
 *  complete (clean close, no heartbeat gap) is charged its observed time —
 *  the credit is bounded by the unconsumed part and never issued before the
 *  provider expiry, but a modified client that keeps talking after a fake
 *  close still gains up to (slice - observed). Leave off until server-owned
 *  session control exists (B-GA-26). */
export type LiveCreditPolicy = "none" | "observed";
export const liveCreditPolicy = (): LiveCreditPolicy =>
  (process.env.LIVE_RECONCILE_CREDIT || "").toLowerCase() === "observed" ? "observed" : "none";

/** 429 body: the allowance does not refresh "in a moment" — no Retry-After. */
export const LIVE_RESTING = "live_resting";
export const LIVE_RESTING_BODY = Object.freeze({
  error: "Voice time for today is used up",
  code: LIVE_RESTING,
  retryable: false,
});

/** Fallback turns: reserved before the model call, settled on the server. */
export const VOICE_TURN_RESERVE_MS = LIVE_MIN_SLICE_MS;
/** Conservative speaking rate for the fallback loop's spoken length (EN/HE). */
export const SPOKEN_CHARS_PER_SECOND = 14;
export const spokenMsForChars = (chars: number): number =>
  Math.ceil((Math.max(0, chars) / SPOKEN_CHARS_PER_SECOND) * 1000);

export type LiveReservation = {
  id: string;
  /** "live" (a provider token; absent on documents written before turns) or
   *  "turn" (one server-settled fallback-loop turn). */
  kind?: "live" | "turn";
  uid: string;
  ms: number;
  startedAt: number;
  expiresAt: number;
  observedMs: number;
  incomplete: boolean;
  closed: boolean;
  /** Charged amount once the token has expired; null while live. */
  settledMs: number | null;
};
export type LiveBudgetDay = {
  familyId: string;
  day: string;
  /** Settled, non-refundable milliseconds. */
  consumedMs: number;
  reservations: Record<string, LiveReservation>;
  updatedAt: number;
};

export const liveBudgetDay = (now: number): string => new Date(now).toISOString().slice(0, 10);
export const liveBudgetDayEnd = (day: string): number => Date.parse(`${day}T00:00:00Z`) + DAY_MS;
export const emptyLiveBudgetDay = (familyId: string, day: string): LiveBudgetDay =>
  ({ familyId, day, consumedMs: 0, reservations: {}, updatedAt: 0 });

/** What an expired reservation costs. Lost telemetry is never priced as zero. */
export function settleCharge(r: LiveReservation, policy: LiveCreditPolicy): number {
  // An unsettled turn that reached its expiry is a turn the server never
  // finished settling (a crash): its full reserve, whatever the policy.
  if (policy !== "observed" || r.kind === "turn") return r.ms;
  if (r.incomplete || !r.closed) return r.ms;
  return Math.min(r.ms, Math.max(0, r.observedMs));
}

/** Settle every reservation whose provider token has expired (server clock). */
export function settleExpired(doc: LiveBudgetDay, now: number, policy: LiveCreditPolicy = liveCreditPolicy()): LiveBudgetDay {
  let consumedMs = doc.consumedMs;
  const reservations: Record<string, LiveReservation> = {};
  for (const [id, r] of Object.entries(doc.reservations)) {
    if (r.settledMs === null && now >= r.expiresAt) {
      const charged = settleCharge(r, policy);
      consumedMs += charged;
      reservations[id] = { ...r, settledMs: charged };
    } else reservations[id] = r;
  }
  return { ...doc, consumedMs, reservations, updatedAt: now };
}

/** Settled time plus every live reservation at its full slice. */
export const committedMs = (doc: LiveBudgetDay): number =>
  doc.consumedMs + Object.values(doc.reservations).reduce((sum, r) => sum + (r.settledMs === null ? r.ms : 0), 0);

export type ReservePlan = { ok: true; ms: number } | { ok: false; remainingMs: number };
/** Size the next slice from what the family has left today. */
export function planReservation(doc: LiveBudgetDay, plan: Plan): ReservePlan {
  const remainingMs = Math.max(0, liveAllowanceMs(plan) - committedMs(doc));
  const ms = Math.min(liveSliceMs(), remainingMs);
  if (ms >= LIVE_MIN_SLICE_MS) return { ok: true, ms };
  return { ok: false, remainingMs };
}

export type ObservedUpdate = { observedMs: number; incomplete: boolean; closed: boolean };
/** Record observed connection time. Pure bookkeeping: committedMs is unchanged. */
export function recordObserved(doc: LiveBudgetDay, id: string, obs: ObservedUpdate, now: number): LiveBudgetDay {
  const r = doc.reservations[id];
  if (!r || r.settledMs !== null) return doc;
  const next: LiveReservation = {
    ...r,
    observedMs: Math.min(r.ms, Math.max(r.observedMs, obs.observedMs)),
    incomplete: r.incomplete || obs.incomplete,
    closed: r.closed || obs.closed,
  };
  return { ...doc, reservations: { ...doc.reservations, [id]: next }, updatedAt: now };
}

/** Release a reservation whose token was NEVER minted (a server-side fact,
 *  not a client report). A reservation that has observed time is kept. */
export function cancelUnminted(doc: LiveBudgetDay, id: string, now: number): LiveBudgetDay {
  const r = doc.reservations[id];
  if (!r || r.settledMs !== null || r.observedMs > 0 || r.closed) return doc;
  const { [id]: _dropped, ...rest } = doc.reservations;
  return { ...doc, reservations: rest, updatedAt: now };
}

/** Settle a fallback turn to the server's own measure of what it handled.
 *  Only an unsettled "turn" settles here; a Live token never does (its charge
 *  is decided at provider expiry), and a turn already charged at expiry stays
 *  charged. */
export function settleTurnCharge(doc: LiveBudgetDay, id: string, chargedMs: number, now: number): LiveBudgetDay {
  const r = doc.reservations[id];
  if (!r || r.kind !== "turn" || r.settledMs !== null) return doc;
  const settledMs = Math.max(0, Math.round(Number.isFinite(chargedMs) ? chargedMs : r.ms));
  return {
    ...doc,
    consumedMs: doc.consumedMs + settledMs,
    reservations: { ...doc.reservations, [id]: { ...r, settledMs } },
    updatedAt: now,
  };
}

export type ReserveInput = { familyId: string; plan: Plan; uid: string };
/** A fallback turn: `holdMs` is how long the server may take before the turn
 *  is treated as crashed and charged its full reserve. */
export type ReserveTurnInput = ReserveInput & { holdMs: number };
export type ReserveResult =
  | { ok: true; reservation: { id: string; day: string; ms: number; expiresAt: number }; allowanceMs: number; remainingMs: number; resetAt: number }
  | { ok: false; code: typeof LIVE_RESTING; allowanceMs: number; remainingMs: number; resetAt: number };
export type BudgetSnapshot = { allowanceMs: number; committedMs: number; remainingMs: number; resetAt: number };

export interface LiveBudgetStore {
  reserve(input: ReserveInput): Promise<ReserveResult>;
  cancel(familyId: string, day: string, id: string): Promise<void>;
  observe(familyId: string, day: string, id: string, obs: ObservedUpdate): Promise<void>;
  peek(familyId: string, plan: Plan): Promise<BudgetSnapshot>;
  /** Fallback path: reserve one turn against the same family-day allowance. */
  reserveTurn(input: ReserveTurnInput): Promise<ReserveResult>;
  /** Fallback path: the server settles the turn it handled (never a client). */
  settleTurn(familyId: string, day: string, id: string, chargedMs: number): Promise<void>;
}

/** One serialized read-modify-write of a family-day document. */
type Atomic = <R>(familyId: string, day: string, fn: (doc: LiveBudgetDay, now: number) => { doc: LiveBudgetDay; result: R }) => Promise<R>;

const reserveWith = (
  doc: LiveBudgetDay, input: ReserveInput, now: number,
  slice: { kind: "live" | "turn"; ms?: number; holdMs?: number } = { kind: "live" },
): { doc: LiveBudgetDay; result: ReserveResult } => {
  const settled = settleExpired(doc, now);
  const allowanceMs = liveAllowanceMs(input.plan);
  const resetAt = liveBudgetDayEnd(settled.day);
  const planned = planReservation(settled, input.plan);
  if (planned.ok === false) {
    const remainingMs = planned.remainingMs;
    return { doc: settled, result: { ok: false, code: LIVE_RESTING, allowanceMs, remainingMs, resetAt } };
  }
  const id = randomUUID();
  // A Live token is bounded by its slice; a turn reserves a fixed amount
  // (never more than what remains) and is held for the route's deadline.
  const ms = slice.ms === undefined ? planned.ms : Math.min(slice.ms, planned.ms);
  const expiresAt = now + (slice.kind === "turn" ? Math.max(1_000, slice.holdMs ?? ms) : ms);
  const reservation: LiveReservation = {
    id, ...(slice.kind === "turn" ? { kind: "turn" as const } : {}), uid: input.uid, ms, startedAt: now, expiresAt,
    observedMs: 0, incomplete: false, closed: false, settledMs: null,
  };
  const next = { ...settled, reservations: { ...settled.reservations, [id]: reservation }, updatedAt: now };
  return {
    doc: next,
    result: { ok: true, reservation: { id, day: next.day, ms, expiresAt: reservation.expiresAt },
      allowanceMs, remainingMs: Math.max(0, allowanceMs - committedMs(next)), resetAt },
  };
};

/** Store over any serialized backend (in-memory mutex or a Firestore transaction). */
export class LiveBudget implements LiveBudgetStore {
  constructor(private readonly atomic: Atomic) {}
  reserve(input: ReserveInput) {
    return this.atomic<ReserveResult>(input.familyId, liveBudgetDay(Date.now()), (doc, now) => reserveWith(doc, input, now));
  }
  cancel(familyId: string, day: string, id: string) {
    return this.atomic<void>(familyId, day, (doc, now) => ({ doc: cancelUnminted(settleExpired(doc, now), id, now), result: undefined }));
  }
  observe(familyId: string, day: string, id: string, obs: ObservedUpdate) {
    return this.atomic<void>(familyId, day, (doc, now) => ({ doc: settleExpired(recordObserved(doc, id, obs, now), now), result: undefined }));
  }
  peek(familyId: string, plan: Plan) {
    return this.atomic<BudgetSnapshot>(familyId, liveBudgetDay(Date.now()), (doc, now) => {
      const settled = settleExpired(doc, now);
      const allowanceMs = liveAllowanceMs(plan);
      const committed = committedMs(settled);
      return { doc: settled, result: { allowanceMs, committedMs: committed, remainingMs: Math.max(0, allowanceMs - committed), resetAt: liveBudgetDayEnd(settled.day) } };
    });
  }
  reserveTurn(input: ReserveTurnInput) {
    return this.atomic<ReserveResult>(input.familyId, liveBudgetDay(Date.now()),
      (doc, now) => reserveWith(doc, input, now, { kind: "turn", ms: VOICE_TURN_RESERVE_MS, holdMs: input.holdMs }));
  }
  settleTurn(familyId: string, day: string, id: string, chargedMs: number) {
    return this.atomic<void>(familyId, day, (doc, now) => ({ doc: settleExpired(settleTurnCharge(doc, id, chargedMs, now), now), result: undefined }));
  }
}

/** Local/sandbox: a per-key promise chain serializes overlapping mints. */
export class MemoryLiveBudgetStore extends LiveBudget {
  readonly days = new Map<string, LiveBudgetDay>();
  private readonly locks = new Map<string, Promise<unknown>>();
  constructor() {
    super(async (familyId, day, fn) => {
      const key = `${familyId}_${day}`;
      const run = async () => {
        const now = Date.now();
        const { doc, result } = fn(this.days.get(key) ?? emptyLiveBudgetDay(familyId, day), now);
        this.days.set(key, doc);
        for (const [k, d] of this.days) if (liveBudgetDayEnd(d.day) + DAY_MS < now) this.days.delete(k);
        return result;
      };
      const prior = this.locks.get(key) ?? Promise.resolve();
      const next = prior.then(run, run);
      this.locks.set(key, next.catch(() => {}));
      return next;
    });
  }
}

export const liveBudgetDocId = (familyId: string, day: string) => `live_family_${familyId}_${day}`;

export function createLiveBudgetStore(config: ArborConfig): LiveBudgetStore {
  if (config.memoryAdapter !== "firestore") return new MemoryLiveBudgetStore();
  if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
  const db = getFirestore(config.firestoreDatabaseId);
  return new LiveBudget(async (familyId, day, fn) => {
    const ref = db.collection("aiQuota").doc(liveBudgetDocId(familyId, day));
    const outcome = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists ? (snap.data() as LiveBudgetDay) : emptyLiveBudgetDay(familyId, day);
      const now = Date.now();
      const { doc, result } = fn({ ...current, reservations: current.reservations ?? {} }, now);
      // Existing aiQuota TTL policy on `expireAt`: two days after the day ends.
      tx.set(ref, { ...doc, expireAt: new Date(liveBudgetDayEnd(day) + 2 * DAY_MS) });
      return { result, committed: committedMs(doc) };
    });
    logger.info("live.budget", { familyId, day, committedMs: outcome.committed });
    return outcome.result;
  });
}
