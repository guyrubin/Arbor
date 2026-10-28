/**
 * B-AIOPS-03 — dated alert-delivery and recovery, one fake sink per signal.
 *
 * Every case runs on a fixed server clock (28 Oct 2026) so the delivered
 * incident's `at` is a date a reader can check, and every incident is checked
 * for content: no child name, message text, uid, email, URL value or secret
 * may appear, whatever the failing request carried. Live unavailability and
 * the prepay alarm at the token route are pinned in routes/opsAlertsRoute.test.ts.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import {
  apiFailureObserver, createOpsAlerts, createOpsAlertsFromConfig, formatIncidentText, safeRouteTemplate, webhookSink,
  type OpsAlertSink, type OpsIncident,
} from "./opsAlerts.js";
import { createBillingWebhookRouter } from "./billing.js";
import { loadConfig, opsWebhookUrl, type ArborConfig } from "../config/env.js";

const T0 = Date.parse("2026-10-28T09:00:00.000Z");
const MIN = 60_000;
const SECRET_BITS = ["Synthetic Child", "child-7c1", "parent@example.com", "uid-123", "Bearer s3cret", "hooks.example.com/T0/SECRET"];

const fakeSink = () => {
  const delivered: OpsIncident[] = [];
  const sink: OpsAlertSink = { async deliver(i) { delivered.push(i); } };
  return { sink, delivered };
};
const clock = () => {
  let t = T0;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
};
const contentFree = (incidents: OpsIncident[]) => {
  const json = JSON.stringify(incidents);
  for (const bit of SECRET_BITS) expect(json).not.toContain(bit);
};

const listen = async (app: express.Express) => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
};

afterEach(() => vi.unstubAllGlobals());

describe("the sink: thresholds, one firing, one recovery", () => {
  it("fires once at the threshold, stays quiet while firing, resolves after a quiet window on a healthy signal", async () => {
    const { sink, delivered } = fakeSink();
    const c = clock();
    const alerts = createOpsAlerts({ owner: "Guy", sinks: [sink], now: c.now });
    alerts.record("live_unavailable", "mint_failed");
    alerts.record("live_unavailable", "mint_failed");
    alerts.ok("live_unavailable");
    await alerts.flush();
    expect(delivered).toEqual([]);
    alerts.record("live_unavailable", "mint_failed");
    alerts.record("live_unavailable", "mint_failed");
    await alerts.flush();
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toEqual({
      signal: "live_unavailable", reason: "mint_failed", state: "firing", at: "2026-10-28T09:00:00.000Z",
      count: 3, windowMinutes: 15, owner: "Guy",
      runbook: "docs/ops/incident-alerts.md#live-unavailable",
      action: expect.stringContaining("prepaid balance"),
    });
    // Healthy before the quiet window: still firing.
    c.advance(10 * MIN);
    alerts.ok("live_unavailable");
    await alerts.flush();
    expect(delivered).toHaveLength(1);
    c.advance(10 * MIN);
    alerts.ok("live_unavailable");
    await alerts.flush();
    expect(delivered[1]).toMatchObject({ state: "resolved", reason: "mint_failed", at: "2026-10-28T09:20:00.000Z", count: 0, owner: "Guy" });
    expect(delivered).toHaveLength(2);
  });

  it("events older than the window do not add up to a burst", async () => {
    const { sink, delivered } = fakeSink();
    const c = clock();
    const alerts = createOpsAlerts({ sinks: [sink], now: c.now });
    for (let i = 0; i < 6; i++) { alerts.record("live_unavailable", "mint_failed"); c.advance(8 * MIN); }
    await alerts.flush();
    expect(delivered).toEqual([]);
  });

  it("unknown signal/reason pairs are dropped; the owner defaults to unassigned; a failing sink never throws into the caller", async () => {
    const bad: OpsAlertSink = { async deliver() { throw new Error("down"); } };
    const alerts = createOpsAlerts({ sinks: [bad] });
    expect(alerts.owner).toBe("unassigned");
    expect(() => alerts.record("billing_webhook_failure", "handler_error")).not.toThrow();
    expect(() => (alerts as any).record("billing_webhook_failure", "child said something")).not.toThrow();
    expect(() => (alerts as any).record("nope", "x")).not.toThrow();
    await expect(alerts.flush()).resolves.toBeUndefined();
  });

  it("a route travels only as a template; anything else is dropped", () => {
    expect(safeRouteTemplate("/api/memory/:childId")).toBe("/api/memory/:childId");
    expect(safeRouteTemplate("/api/memory/child 1?name=Synthetic")).toBeUndefined();
    expect(safeRouteTemplate("Synthetic Child")).toBeUndefined();
  });
});

describe("signal 1 — API 5xx burst (status + route template only)", () => {
  it("ten 5xx answers on one route fire once, naming the template, never the URL value or body; a healthy answer after the quiet window resolves", async () => {
    const { sink, delivered } = fakeSink();
    const c = clock();
    const alerts = createOpsAlerts({ owner: "Guy", sinks: [sink], now: c.now });
    const app = express();
    app.use("/api", apiFailureObserver(alerts));
    const router = express.Router();
    router.get("/memory/:childId", (_req, res) => { res.status(500).json({ error: "boom for Synthetic Child" }); });
    router.get("/health-ish", (_req, res) => { res.json({ ok: true }); });
    app.use("/api", router);
    const { server, base } = await listen(app);
    try {
      for (let i = 0; i < 10; i++) await fetch(`${base}/api/memory/child-7c1`);
      await alerts.flush();
      expect(delivered).toHaveLength(1);
      expect(delivered[0]).toMatchObject({ signal: "api_5xx_burst", reason: "burst", state: "firing", count: 10, windowMinutes: 5,
        route: "/api/memory/:childId", at: "2026-10-28T09:00:00.000Z", runbook: "docs/ops/incident-alerts.md#api-5xx-burst" });
      c.advance(6 * MIN);
      await fetch(`${base}/api/health-ish`);
      await alerts.flush();
      expect(delivered[1]).toMatchObject({ signal: "api_5xx_burst", state: "resolved", at: "2026-10-28T09:06:00.000Z" });
      contentFree(delivered);
    } finally {
      server.close();
    }
  });
});

describe("signal 2 — billing webhook failures (bad signature, not configured, read-only store, handler error)", () => {
  const purchase = { type: "INITIAL_PURCHASE", app_user_id: "uid-123", product_id: "arbor_plus_monthly_v2", store: "RC_BILLING", environment: "PRODUCTION", subscriber_attributes: { $email: { value: "parent@example.com" } } };
  const run = async (config: Partial<ArborConfig>, store: Record<string, unknown>, fn: (post: (auth?: string) => Promise<Response>, c: ReturnType<typeof clock>) => Promise<void>) => {
    const { sink, delivered } = fakeSink();
    const c = clock();
    const alerts = createOpsAlerts({ owner: "Guy", sinks: [sink], now: c.now });
    const app = express();
    app.use("/webhooks/billing", createBillingWebhookRouter({ billingCheckoutUrls: {}, billingAcceptSandbox: false, ...config } as ArborConfig, store as never, alerts));
    const { server, base } = await listen(app);
    try {
      const post = (auth = "Bearer s3cret") => fetch(`${base}/webhooks/billing/revenuecat`, {
        method: "POST", headers: { "content-type": "application/json", authorization: auth }, body: JSON.stringify({ event: purchase }),
      });
      await fn(post, c);
      await alerts.flush();
      contentFree(delivered);
      return delivered;
    } finally {
      server.close();
    }
  };

  it("three bad signatures in 15 minutes fire bad_signature; an accepted delivery after the quiet window resolves it", async () => {
    const writes: unknown[] = [];
    const delivered = await run({ revenueCatWebhookAuth: "Bearer s3cret" }, { setEntitlement: async (...a: unknown[]) => { writes.push(a); } }, async (post, c) => {
      expect((await post("Bearer wrong")).status).toBe(401);
      expect((await post("Bearer wrong")).status).toBe(401);
      expect((await post("Bearer wrong")).status).toBe(401);
      c.advance(16 * MIN);
      expect((await post()).status).toBe(200);
    });
    expect(delivered.map((i) => [i.reason, i.state, i.at])).toEqual([
      ["bad_signature", "firing", "2026-10-28T09:00:00.000Z"],
      ["bad_signature", "resolved", "2026-10-28T09:16:00.000Z"],
    ]);
    expect(writes).toHaveLength(1);
  });

  it("a handler error fires at once (a paid upgrade was dropped), naming the owner and the runbook", async () => {
    const delivered = await run({ revenueCatWebhookAuth: "Bearer s3cret" }, { setEntitlement: async () => { throw new Error("firestore down for uid-123"); } }, async (post) => {
      expect((await post()).status).toBe(500);
    });
    expect(delivered).toEqual([expect.objectContaining({ signal: "billing_webhook_failure", reason: "handler_error", state: "firing", owner: "Guy",
      runbook: "docs/ops/incident-alerts.md#billing-webhook-failure", at: "2026-10-28T09:00:00.000Z" })]);
  });

  it("an unset secret and a read-only store are each their own incident", async () => {
    const unset = await run({}, { setEntitlement: async () => {} }, async (post) => { expect((await post()).status).toBe(503); });
    expect(unset.map((i) => i.reason)).toEqual(["not_configured"]);
    const readOnly = await run({ revenueCatWebhookAuth: "Bearer s3cret" }, {}, async (post) => { expect((await post()).status).toBe(503); });
    expect(readOnly.map((i) => i.reason)).toEqual(["store_read_only"]);
  });
});

describe("delivery — the structured log always, the webhook only when configured", () => {
  it("the webhook receives one plain content-free line { text } and a non-2xx answer is reported by status only", async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => { calls.push({ url, body: String(init.body) }); return new Response("", { status: 200 }); });
    const sink = webhookSink("https://hooks.example.com/T0/SECRET", fetchImpl as unknown as typeof fetch);
    const incident: OpsIncident = { signal: "prepay_low", reason: "below_20_percent", state: "firing", at: "2026-10-28T09:00:00.000Z", count: 1, windowMinutes: 1440,
      owner: "Guy", runbook: "docs/ops/incident-alerts.md#prepay-low", action: "Top up by hand.", prepay: { remaining: 19.5, credit: 100, currency: "EUR" } };
    await sink.deliver(incident);
    expect(Object.keys(JSON.parse(calls[0].body))).toEqual(["text"]);
    expect(JSON.parse(calls[0].body).text).toBe(formatIncidentText(incident));
    expect(formatIncidentText(incident)).toContain("FIRING prepay_low/below_20_percent");
    expect(formatIncidentText(incident)).toContain("balance 19.5 of 100 EUR");
    const failing = webhookSink("https://hooks.example.com/T0/SECRET", (async () => new Response("echo https://hooks.example.com/T0/SECRET", { status: 403 })) as unknown as typeof fetch);
    await expect(failing.deliver(incident)).rejects.toThrow("ops alert webhook answered 403");
  });

  it("config: OPS_ALERT_OWNER and OPS_ALERT_WEBHOOK_URL default off; only an https URL turns delivery on", () => {
    const saved = { owner: process.env.OPS_ALERT_OWNER, url: process.env.OPS_ALERT_WEBHOOK_URL, ledger: process.env.AI_PREPAY_LEDGER };
    try {
      delete process.env.OPS_ALERT_OWNER; delete process.env.OPS_ALERT_WEBHOOK_URL; delete process.env.AI_PREPAY_LEDGER;
      const off = loadConfig();
      expect(off.opsAlertOwner).toBeUndefined();
      expect(off.opsAlertWebhookUrl).toBeUndefined();
      expect(off.aiPrepayLedger).toBeUndefined();
      expect(createOpsAlertsFromConfig(off).delivery).toBe("log");
      expect(createOpsAlertsFromConfig(off).owner).toBe("unassigned");
      process.env.OPS_ALERT_OWNER = "off";
      process.env.OPS_ALERT_WEBHOOK_URL = "off";
      expect(loadConfig().opsAlertOwner).toBeUndefined();
      expect(loadConfig().opsAlertWebhookUrl).toBeUndefined();
      process.env.OPS_ALERT_OWNER = "Guy";
      process.env.OPS_ALERT_WEBHOOK_URL = "https://hooks.example.com/T0/SECRET";
      const on = loadConfig();
      expect(on.opsAlertOwner).toBe("Guy");
      expect(createOpsAlertsFromConfig(on).delivery).toBe("webhook");
      expect(opsWebhookUrl("http://hooks.example.com/x")).toBeUndefined();
      expect(opsWebhookUrl("not a url")).toBeUndefined();
    } finally {
      for (const [k, v] of [["OPS_ALERT_OWNER", saved.owner], ["OPS_ALERT_WEBHOOK_URL", saved.url], ["AI_PREPAY_LEDGER", saved.ledger]] as const) {
        if (v === undefined) delete process.env[k]; else process.env[k] = v;
      }
    }
  });
});
