/** B-AIOPS-03 — the AI Studio prepay balance is readable and alarms at 20 %,
 * dated, without any automatic reload. The balance is read from Arbor's own
 * server-owned meter (reserved Live minutes since the last top-up × Guy's rate). */
import { describe, expect, it, vi } from "vitest";
import { balanceFrom, createPrepayMonitor, MemoryPrepayCounter, parsePrepayLedger, PREPAY_ALARM_FRACTION } from "./prepayBalance.js";
import { createOpsAlerts, type OpsIncident } from "./opsAlerts.js";
import * as prepayModule from "./prepayBalance.js";

const LEDGER = { credit: 100, currency: "EUR", since: "2026-10-28", perLiveMinute: 0.5 };
const MIN = 60_000;

describe("AI_PREPAY_LEDGER parsing (default off)", () => {
  it("off, unset, malformed or half-set ledgers never read as a balance", () => {
    expect(parsePrepayLedger(undefined)).toBeUndefined();
    expect(parsePrepayLedger("off")).toBeUndefined();
    expect(parsePrepayLedger("{not json")).toBeUndefined();
    expect(parsePrepayLedger(JSON.stringify({ ...LEDGER, credit: 0 }))).toBeUndefined();
    expect(parsePrepayLedger(JSON.stringify({ ...LEDGER, perLiveMinute: undefined }))).toBeUndefined();
    expect(parsePrepayLedger(JSON.stringify({ ...LEDGER, since: "28/10/2026" }))).toBeUndefined();
    expect(parsePrepayLedger(JSON.stringify(LEDGER))).toEqual(LEDGER);
  });
});

describe("the readable balance", () => {
  it("credit minus reserved Live minutes at the configured rate; low at or below 20 % of the credit", () => {
    expect(PREPAY_ALARM_FRACTION).toBe(0.2);
    expect(balanceFrom(LEDGER, 100 * MIN)).toMatchObject({ liveMinutes: 100, spent: 50, remaining: 50, low: false, basis: "reserved_live_minutes" });
    expect(balanceFrom(LEDGER, 159 * MIN).low).toBe(false);
    expect(balanceFrom(LEDGER, 160 * MIN)).toMatchObject({ remaining: 20, low: true });
  });
});

describe("the 20 % alarm — dated delivery, once per crossing, recovery after a top-up, never a reload", () => {
  it("fires once when the balance crosses 20 %, resolves when a new top-up reads above it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-10-28T18:30:00.000Z"));
    try {
      const delivered: OpsIncident[] = [];
      const alerts = createOpsAlerts({ owner: "Guy", sinks: [{ async deliver(i) { delivered.push(i); } }] });
      const counter = new MemoryPrepayCounter();
      const monitor = createPrepayMonitor(LEDGER, counter, alerts);
      for (let i = 0; i < 31; i++) await monitor.onLiveReserved(5 * MIN); // 155 min → €22.50 left
      await alerts.flush();
      expect(delivered).toEqual([]);
      await monitor.onLiveReserved(5 * MIN); // 160 min → €20.00 left: the line
      await monitor.onLiveReserved(5 * MIN); // still low: no second page
      await alerts.flush();
      expect(delivered).toEqual([expect.objectContaining({
        signal: "prepay_low", reason: "below_20_percent", state: "firing", at: "2026-10-28T18:30:00.000Z", owner: "Guy",
        prepay: { remaining: 20, credit: 100, currency: "EUR" }, runbook: "docs/ops/incident-alerts.md#prepay-low",
      })]);
      expect(await monitor.read()).toMatchObject({ remaining: 17.5, low: true });
      // Guy tops up by hand and records the new top-up day: a fresh counter.
      vi.setSystemTime(Date.parse("2026-10-29T08:00:00.000Z"));
      const toppedUp = createPrepayMonitor({ ...LEDGER, since: "2026-10-29" }, counter, alerts);
      expect(await toppedUp.read()).toMatchObject({ remaining: 100, low: false });
      await alerts.flush();
      expect(delivered[1]).toMatchObject({ state: "resolved", at: "2026-10-29T08:00:00.000Z" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("no automatic reload exists: the module exposes no top-up or payment call, and an off ledger counts nothing", async () => {
    expect(Object.keys(prepayModule).filter((k) => /reload|top.?up|charge|payment|purchase/i.test(k))).toEqual([]);
    const counter = new MemoryPrepayCounter();
    const off = createPrepayMonitor(undefined, counter, createOpsAlerts({ sinks: [] }));
    await off.onLiveReserved(5 * MIN);
    expect(counter.totals.size).toBe(0);
    expect(await off.read()).toBeNull();
  });
});
