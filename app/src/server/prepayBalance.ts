/**
 * B-AIOPS-03 — the AI Studio prepaid balance, readable, with a 20 % alarm.
 *
 * Live voice on the global endpoint is paid from a prepaid AI Studio balance
 * with auto-reload OFF (Guy's decision). Google exposes no API for that
 * balance, and at €0 the token still mints and the socket dies — so the
 * balance has to be READ from Arbor's own server-owned meter: every Live
 * reservation (B-AIOPS-02) is spend the provider may bill, at most its slice.
 *
 *   readable balance = credit − (reserved Live minutes since the top-up × rate)
 *
 * The credit, its top-up day and the per-minute rate come from ONE config
 * value, `AI_PREPAY_LEDGER` (JSON, default off), e.g.
 *   {"credit":100,"currency":"EUR","since":"2026-10-28","perLiveMinute":0.05}
 * The rate is Guy's, not the code's: no price is invented here. Reserved
 * minutes bound the connection time from above, so with a rate at or above
 * the real per-minute cost the alarm fires early, never late. A new top-up
 * is a new `since` day, which starts a fresh counter.
 *
 * At or below 20 % of the credit the `prepay_low` incident fires (once per
 * crossing); it resolves when the balance reads above 20 % again. NOTHING
 * here reloads, tops up or calls a payment API — the alarm only tells a human.
 */
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import type { ArborConfig, PrepayLedgerConfig } from "../config/env.js";
import type { OpsAlerts } from "./opsAlerts.js";
import { logger } from "./logger.js";

export const PREPAY_ALARM_FRACTION = 0.2;

export { parsePrepayLedger, type PrepayLedgerConfig } from "../config/env.js";

export type PrepayBalance = {
  credit: number;
  currency: string;
  since: string;
  /** Reserved Live minutes counted against this top-up. */
  liveMinutes: number;
  spent: number;
  remaining: number;
  /** remaining ≤ 20 % of the credit. */
  low: boolean;
  basis: "reserved_live_minutes";
};

const cents = (n: number) => Math.round(n * 100) / 100;

export function balanceFrom(ledger: PrepayLedgerConfig, reservedMs: number): PrepayBalance {
  const liveMinutes = Math.max(0, reservedMs) / 60_000;
  const spent = liveMinutes * ledger.perLiveMinute;
  const remaining = ledger.credit - spent;
  return {
    credit: ledger.credit, currency: ledger.currency, since: ledger.since,
    liveMinutes: cents(liveMinutes), spent: cents(spent), remaining: cents(remaining),
    low: remaining <= ledger.credit * PREPAY_ALARM_FRACTION,
    basis: "reserved_live_minutes",
  };
}

/** The monotonic reserved-ms counter per top-up. */
export interface PrepayCounter {
  add(since: string, ms: number): Promise<number>;
  read(since: string): Promise<number>;
}

export class MemoryPrepayCounter implements PrepayCounter {
  readonly totals = new Map<string, number>();
  async add(since: string, ms: number) {
    const next = (this.totals.get(since) ?? 0) + Math.max(0, ms);
    this.totals.set(since, next);
    return next;
  }
  async read(since: string) { return this.totals.get(since) ?? 0; }
}

/** `opsLedger/aiStudioPrepay_{since}`: Admin SDK only, a count of milliseconds. */
export function createPrepayCounter(config: ArborConfig): PrepayCounter {
  if (config.memoryAdapter !== "firestore") return new MemoryPrepayCounter();
  if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
  const db = getFirestore(config.firestoreDatabaseId);
  const ref = (since: string) => db.collection("opsLedger").doc(`aiStudioPrepay_${since}`);
  return {
    async add(since, ms) {
      await ref(since).set({ since, reservedMs: FieldValue.increment(Math.max(0, Math.round(ms))), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return this.read(since);
    },
    async read(since) {
      const snap = await ref(since).get();
      return Number(snap.data()?.reservedMs) || 0;
    },
  };
}

export interface PrepayMonitor {
  /** A Live reservation was granted: count it and check the 20 % line. Never throws. */
  onLiveReserved(ms: number): Promise<void>;
  /** The readable balance, or null while AI_PREPAY_LEDGER is off. */
  read(): Promise<PrepayBalance | null>;
}

export function createPrepayMonitor(ledger: PrepayLedgerConfig | undefined, counter: PrepayCounter, alerts: OpsAlerts): PrepayMonitor {
  const check = (balance: PrepayBalance) => {
    if (balance.low) alerts.record("prepay_low", "below_20_percent", { prepay: { remaining: balance.remaining, credit: balance.credit, currency: balance.currency } });
    else alerts.ok("prepay_low");
  };
  return {
    async onLiveReserved(ms) {
      if (!ledger) return;
      try {
        check(balanceFrom(ledger, await counter.add(ledger.since, ms)));
      } catch (error) {
        logger.error("Prepay ledger update failed", error);
      }
    },
    async read() {
      if (!ledger) return null;
      const balance = balanceFrom(ledger, await counter.read(ledger.since));
      check(balance);
      return balance;
    },
  };
}
