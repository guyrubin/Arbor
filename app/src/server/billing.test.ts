import { describe, expect, it } from "vitest";
import { planFromRevenueCat, recordFromRevenueCat, billingCheckoutUrl, offeredCurrencies, SOLD_PLANS, webhookSkipReason, createBillingWebhookRouter } from "./billing.js";
import type { ArborConfig } from "../config/env.js";
import { isStaleBillingEvent, recordStillEntitles, type EntitlementRecord } from "./entitlements.js";

const cfg = (over: Partial<ArborConfig>): ArborConfig =>
  ({ billingCheckoutUrls: {}, ...over } as ArborConfig);

describe("RevenueCat → entitlement mapping (MON-2)", () => {
  it("maps a Family product to the family plan, others to plus", () => {
    expect(planFromRevenueCat({ product_id: "arbor_family_monthly" })).toBe("family");
    expect(planFromRevenueCat({ entitlement_ids: ["family"] })).toBe("family");
    expect(planFromRevenueCat({ product_id: "arbor_plus_annual" })).toBe("plus");
    expect(planFromRevenueCat({ product_id: "something_else" })).toBe("plus");
  });

  it("an initial App Store purchase grants an active plan with renewal date", () => {
    const out = recordFromRevenueCat({
      type: "INITIAL_PURCHASE",
      app_user_id: "firebase-uid-1",
      product_id: "arbor_plus_monthly",
      store: "APP_STORE",
      period_type: "NORMAL",
      expiration_at_ms: 4102444800000, // 2100-01-01
    });
    expect(out).not.toBeNull();
    expect(out!.uid).toBe("firebase-uid-1");
    expect(out!.record.plan).toBe("plus");
    expect(out!.record.status).toBe("active");
    expect(out!.record.provider).toBe("app_store");
    expect(out!.record.willRenew).toBe(true);
    expect(out!.record.currentPeriodEnd).toBe("2100-01-01T00:00:00.000Z");
  });

  it("a trial start is marked in_trial", () => {
    const out = recordFromRevenueCat({
      type: "TRIAL_STARTED",
      app_user_id: "u2",
      product_id: "arbor_family_annual",
      store: "STRIPE",
      period_type: "TRIAL",
      expiration_at_ms: 4102444800000,
    });
    expect(out!.record.plan).toBe("family");
    expect(out!.record.status).toBe("in_trial");
    expect(out!.record.provider).toBe("stripe");
  });

  it("a cancellation keeps the plan but turns off renewal", () => {
    const out = recordFromRevenueCat({
      type: "CANCELLATION",
      app_user_id: "u3",
      product_id: "arbor_plus_monthly",
      store: "PLAY_STORE",
    });
    expect(out!.record.plan).toBe("plus");
    expect(out!.record.status).toBe("canceled");
    expect(out!.record.willRenew).toBe(false);
    expect(out!.record.provider).toBe("play_store");
  });

  it("an expiration revokes access (drops to free)", () => {
    const out = recordFromRevenueCat({
      type: "EXPIRATION",
      app_user_id: "u4",
      product_id: "arbor_plus_monthly",
      store: "APP_STORE",
    });
    expect(out!.record.plan).toBe("free");
    expect(out!.record.status).toBe("expired");
    expect(out!.record.willRenew).toBe(false);
  });

  it("an event without an app_user_id is skipped (null)", () => {
    expect(recordFromRevenueCat({ type: "RENEWAL", product_id: "arbor_plus_monthly" })).toBeNull();
  });

  it("carries the event id + timestamp for idempotent, ordered writes", () => {
    const out = recordFromRevenueCat({
      id: "evt_123",
      event_timestamp_ms: 1750000000000,
      type: "RENEWAL",
      app_user_id: "u5",
      product_id: "arbor_plus_monthly",
      store: "APP_STORE",
    });
    expect(out!.record.lastEventId).toBe("evt_123");
    expect(out!.record.lastEventTs).toBe(1750000000000);
  });
});

describe("billingCheckoutUrl (MON-2 web purchase link)", () => {
  it("preserves configured URL parameters and selects exactly the requested package", () => {
    const url = new URL(billingCheckoutUrl(cfg({ billingWebPurchaseLink: "https://pay.rev.cat/tok/?currency=EUR&package_id=old#fragment" }), {
      plan: "plus", cadence: "monthly", uid: "u1", email: null,
    })!);
    expect(url.pathname).toBe("/tok/u1");
    expect(url.searchParams.get("currency")).toBe("EUR");
    expect(url.searchParams.getAll("package_id")).toEqual(["plus_monthly"]);
    expect(url.hash).toBe("");
  });
  it.each(["not-a-url", "http://pay.rev.cat/tok", "javascript:alert(1)", "https://user:pass@pay.rev.cat/tok"])("rejects unusable checkout config: %s", billingWebPurchaseLink => {
    expect(billingCheckoutUrl(cfg({ billingWebPurchaseLink }), { plan: "plus", cadence: "monthly", uid: "u1", email: null })).toBeNull();
  });
  it("builds a RevenueCat Web Purchase Link: uid as path segment + package_id", () => {
    const url = billingCheckoutUrl(cfg({ billingWebPurchaseLink: "https://pay.rev.cat/tok" }), {
      plan: "family", cadence: "annual", uid: "firebaseUid1", email: null,
    });
    expect(url).toBe("https://pay.rev.cat/tok/firebaseUid1?package_id=family_annual");
  });

  it("trims a trailing slash and appends the prefilled email", () => {
    const url = billingCheckoutUrl(cfg({ billingWebPurchaseLink: "https://pay.rev.cat/tok/" }), {
      plan: "plus", cadence: "monthly", uid: "u1", email: "parent@example.com",
    });
    expect(url).toBe("https://pay.rev.cat/tok/u1?package_id=plus_monthly&email=parent%40example.com");
  });

  it("URL-encodes a uid containing reserved characters in the path", () => {
    const url = billingCheckoutUrl(cfg({ billingWebPurchaseLink: "https://pay.rev.cat/tok" }), {
      plan: "plus", cadence: "annual", uid: "a/b c", email: null,
    });
    expect(url).toBe("https://pay.rev.cat/tok/a%2Fb%20c?package_id=plus_annual");
  });

  it("falls back to a per-plan Stripe link (uid as client_reference_id) when no web link", () => {
    const url = billingCheckoutUrl(cfg({ billingCheckoutUrls: { plus_monthly: "https://buy.stripe.com/test_123" } }), {
      plan: "plus", cadence: "monthly", uid: "u1", email: null,
    });
    expect(url).toContain("https://buy.stripe.com/test_123");
    expect(url).toContain("client_reference_id=u1");
  });

  it("returns null when nothing is configured for the plan", () => {
    expect(billingCheckoutUrl(cfg({}), { plan: "plus", cadence: "monthly", uid: "u1", email: null })).toBeNull();
  });

  it("BD-53/P2: names the checkout currency so RevenueCat never picks one by location", () => {
    const url = new URL(billingCheckoutUrl(cfg({ billingWebPurchaseLink: "https://pay.rev.cat/tok" }), {
      plan: "plus", cadence: "annual", uid: "u1", email: null, currency: "ILS",
    })!);
    expect(url.searchParams.get("currency")).toBe("ILS");
    expect(url.searchParams.get("package_id")).toBe("plus_annual");
  });
});

describe("BD-53 offer (Guy, 20 Oct 2026)", () => {
  it("P2: EUR is always on sale; ILS only when configured", () => {
    expect(offeredCurrencies(cfg({}))).toEqual(["EUR"]);
    expect(offeredCurrencies(cfg({ billingCurrencies: ["EUR", "ILS"] }))).toEqual(["EUR", "ILS"]);
  });

  it("P3: only Plus is sold; Family keeps its entitlement but starts no checkout", () => {
    expect(SOLD_PLANS).toEqual(["plus"]);
  });

  it("the checkout route sells only SOLD_PLANS and falls back to EUR for an unoffered currency", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../routes/api.ts", import.meta.url), "utf8");
    expect(src).toContain("if (!SOLD_PLANS.includes(plan) || ");
    expect(src).toContain('const currency = offeredCurrencies(config).includes(requested) ? requested : "EUR";');
    expect(src).toContain("currencies: offeredCurrencies(config),");
  });

  it("BILLING_CURRENCIES parses to EUR plus ILS only when it names ILS", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../config/env.ts", import.meta.url), "utf8");
    expect(src).toContain('billingCurrencies: ["EUR", ...((process.env.BILLING_CURRENCIES || "")');
  });

  it("production sells ILS and the Hebrew landing shows the same shekel prices as ILS_PRICES", async () => {
    const { readFileSync } = await import("node:fs");
    const { ILS_PRICES, formatPrice } = await import("../lib/pricing.js");
    const prod = readFileSync(new URL("../../../cloudbuild.prod.yaml", import.meta.url), "utf8");
    expect(prod).toContain("|BILLING_CURRENCIES=EUR,ILS|");
    const plus = ILS_PRICES.plus!;
    for (const page of ["arbor-marketing-landing-page-he.html", "index.html"]) {
      const html = readFileSync(new URL(`../../public/marketing/${page}`, import.meta.url), "utf8");
      expect(html, page).toContain(`${formatPrice(plus.monthly, "ILS")} <small>`);
      expect(html, page).toContain(`₪${plus.annual} <small>`);
      expect(html, page).toContain(`כ־${formatPrice(Math.round((plus.annual / 12) * 100) / 100, "ILS")}`);
      expect(html, page).not.toContain("€");
    }
  });
});

describe("the webhook never grants Plus from a test or a sandbox event in prod", () => {
  const purchase = { type: "INITIAL_PURCHASE", app_user_id: "u1", product_id: "arbor_plus_monthly_v2", store: "RC_BILLING" };

  it("skips the dashboard TEST event in every environment", () => {
    expect(webhookSkipReason({ type: "TEST", app_user_id: "x" }, { billingAcceptSandbox: true })).toBe("test");
    expect(webhookSkipReason({ type: "test" }, { billingAcceptSandbox: false })).toBe("test");
  });

  it("skips a SANDBOX purchase unless sandbox is accepted; production events always apply", () => {
    expect(webhookSkipReason({ ...purchase, environment: "SANDBOX" }, { billingAcceptSandbox: false })).toBe("sandbox");
    expect(webhookSkipReason({ ...purchase, environment: "sandbox" }, {})).toBe("sandbox");
    expect(webhookSkipReason({ ...purchase, environment: "SANDBOX" }, { billingAcceptSandbox: true })).toBeNull();
    expect(webhookSkipReason({ ...purchase, environment: "PRODUCTION" }, { billingAcceptSandbox: false })).toBeNull();
    expect(webhookSkipReason(purchase, { billingAcceptSandbox: false })).toBeNull();
  });

  it("native-store sandbox still applies in prod: App Review buys in the sandbox against the prod backend", () => {
    for (const store of ["APP_STORE", "MAC_APP_STORE", "PLAY_STORE"]) {
      expect(webhookSkipReason({ ...purchase, store, environment: "SANDBOX" }, { billingAcceptSandbox: false }), store).toBeNull();
    }
    for (const store of ["RC_BILLING", "STRIPE", "PADDLE", "TEST_STORE", undefined]) {
      expect(webhookSkipReason({ ...purchase, store, environment: "SANDBOX" }, { billingAcceptSandbox: false }), String(store)).toBe("sandbox");
    }
  });

  it("only entitlement types are written: an unpaid invoice or an experiment never unlocks Plus", () => {
    for (const type of [
      "INVOICE_ISSUANCE",
      "EXPERIMENT_ENROLLMENT",
      "VIRTUAL_CURRENCY_TRANSACTION",
      "PURCHASE_REDEEMED",
      "TRANSFER",
      "SUBSCRIBER_ALIAS",
      "PRICE_INCREASE_CONSENT_REQUIRED",
      "PRICE_INCREASE_CONSENT_APPROVED",
      "SOMETHING_NEW",
      "",
    ]) {
      expect(webhookSkipReason({ ...purchase, type, environment: "PRODUCTION" }, { billingAcceptSandbox: false }), type).toBe("ignored");
      expect(recordFromRevenueCat({ ...purchase, type }), type).toBeNull();
    }
    for (const type of ["INITIAL_PURCHASE", "RENEWAL", "CANCELLATION", "EXPIRATION", "BILLING_ISSUE", "TEMPORARY_ENTITLEMENT_GRANT", "REFUND_REVERSED", "SUBSCRIPTION_PAUSED"]) {
      expect(webhookSkipReason({ ...purchase, type, environment: "PRODUCTION" }, { billingAcceptSandbox: false }), type).toBeNull();
    }
  });

  it("prod config refuses sandbox by default; other environments accept it", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../config/env.ts", import.meta.url), "utf8");
    expect(src).toContain('billingAcceptSandbox: boolFromEnv(process.env.BILLING_ACCEPT_SANDBOX, arborEnv !== "prod"),');
    const prod = readFileSync(new URL("../../../cloudbuild.prod.yaml", import.meta.url), "utf8");
    expect(prod).toContain("^ARBOR_ENV=prod|");
    expect(prod).not.toContain("BILLING_ACCEPT_SANDBOX");
  });

  it("over HTTP: TEST and prod-sandbox events answer 200 and write nothing; a real purchase writes Plus", async () => {
    const express = (await import("express")).default;
    const writes: Array<[string, unknown]> = [];
    const store = {
      getEntitlement: async () => null,
      setEntitlement: async (uid: string, record: unknown) => {
        writes.push([uid, record]);
      },
    };
    const app = express();
    app.use("/webhooks/billing", createBillingWebhookRouter(cfg({ revenueCatWebhookAuth: "Bearer s3cret", billingAcceptSandbox: false }), store as never));
    const server = app.listen(0);
    try {
      const { port } = server.address() as { port: number };
      const post = (event: object, auth = "Bearer s3cret") =>
        fetch(`http://127.0.0.1:${port}/webhooks/billing/revenuecat`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: auth },
          body: JSON.stringify({ api_version: "1.0", event }),
        });
      expect((await post({ ...purchase, environment: "PRODUCTION" }, "Bearer wrong")).status).toBe(401);
      const test = await post({ type: "TEST", app_user_id: "rc-test-user", environment: "SANDBOX" });
      expect(test.status).toBe(200);
      expect(await test.json()).toEqual({ ok: true, skipped: "test" });
      const sandbox = await post({ ...purchase, environment: "SANDBOX" });
      expect(sandbox.status).toBe(200);
      expect(await sandbox.json()).toEqual({ ok: true, skipped: "sandbox" });
      const invoice = await post({ ...purchase, type: "INVOICE_ISSUANCE", environment: "PRODUCTION" });
      expect(invoice.status).toBe(200);
      expect(await invoice.json()).toEqual({ ok: true, skipped: "ignored" });
      expect(writes).toEqual([]);
      expect((await post({ ...purchase, environment: "PRODUCTION" })).status).toBe(200);
      expect(writes).toHaveLength(1);
      expect(writes[0][0]).toBe("u1");
      expect(writes[0][1]).toMatchObject({ plan: "plus", status: "active", provider: "stripe" });
    } finally {
      server.close();
    }
  });
});

describe("B-GA-20 webhook replay with native event shapes reconciles the entitlement once", () => {
  const DAY = 86_400_000;
  const T0 = Date.parse("2026-11-01T10:00:00.000Z");
  // The same pipeline the webhook runs: map, skip stale, merge without undefined
  // (FirestoreEntitlementStore.setEntitlement's set(..., { merge: true })).
  const replay = () => {
    let doc: EntitlementRecord | null = null;
    const apply = (event: Parameters<typeof recordFromRevenueCat>[0]) => {
      const mapped = recordFromRevenueCat(event);
      if (!mapped || isStaleBillingEvent(doc, mapped.record)) return false;
      const clean = Object.fromEntries(Object.entries(mapped.record).filter(([, v]) => v !== undefined));
      doc = { ...(doc ?? {}), ...clean } as EntitlementRecord;
      return true;
    };
    return { apply, doc: () => doc as EntitlementRecord, entitles: (now: number) => recordStillEntitles(doc as EntitlementRecord, now) };
  };
  const ios = (type: string, ts: number, over: Record<string, unknown> = {}) => ({
    id: `evt-${type}-${ts}`,
    type,
    app_user_id: "fam-uid",
    original_app_user_id: "fam-uid",
    product_id: "arbor_plus_monthly",
    entitlement_ids: ["plus"],
    period_type: "NORMAL",
    store: "APP_STORE",
    environment: "PRODUCTION",
    event_timestamp_ms: ts,
    expiration_at_ms: T0 + 30 * DAY,
    ...over,
  });

  it("purchase, duplicate, out-of-order, upgrade, refund, reversal, billing issue, expiry and retry", () => {
    const r = replay();
    expect(r.apply(ios("INITIAL_PURCHASE", T0))).toBe(true);
    expect(r.doc()).toMatchObject({ plan: "plus", status: "active", provider: "app_store", willRenew: true });
    expect(r.entitles(T0 + DAY)).toBe(true);

    expect(r.apply(ios("INITIAL_PURCHASE", T0))).toBe(false); // RevenueCat resend

    expect(r.apply(ios("RENEWAL", T0 + 3, { expiration_at_ms: T0 + 60 * DAY }))).toBe(true);
    expect(r.apply(ios("CANCELLATION", T0 + 2))).toBe(false); // older event delivered late
    expect(r.doc()).toMatchObject({ status: "active", willRenew: true });

    expect(r.apply(ios("PRODUCT_CHANGE", T0 + 4, { product_id: "arbor_plus_annual", expiration_at_ms: T0 + 365 * DAY }))).toBe(true);
    expect(r.doc()).toMatchObject({ plan: "plus", productId: "arbor_plus_annual", status: "active" });

    // A refund is CANCELLATION with the expiry at the refund: access ends at once.
    expect(r.apply(ios("CANCELLATION", T0 + 5 * DAY, { cancel_reason: "CUSTOMER_SUPPORT", expiration_at_ms: T0 + 5 * DAY }))).toBe(true);
    expect(r.doc()).toMatchObject({ status: "canceled", willRenew: false });
    expect(r.entitles(T0 + 5 * DAY + 1)).toBe(false);

    expect(r.apply(ios("REFUND_REVERSED", T0 + 6 * DAY, { expiration_at_ms: T0 + 365 * DAY }))).toBe(true);
    expect(r.entitles(T0 + 6 * DAY + 1)).toBe(true);

    expect(r.apply(ios("BILLING_ISSUE", T0 + 7 * DAY))).toBe(true);
    expect(r.doc()).toMatchObject({ status: "grace_period" });
    expect(r.entitles(T0 + 7 * DAY + 1)).toBe(true);

    const expiry = ios("EXPIRATION", T0 + 8 * DAY, { expiration_at_ms: T0 + 8 * DAY });
    expect(r.apply(expiry)).toBe(true);
    expect(r.doc()).toMatchObject({ plan: "free", status: "expired", willRenew: false });
    expect(r.apply(expiry)).toBe(false); // retried delivery changes nothing
    expect(r.doc().plan).toBe("free");
  });

  it("a store outage grant on Play lasts until EXPIRATION; a pause keeps access to period end", () => {
    const play = (type: string, ts: number, over: Record<string, unknown> = {}) =>
      ios(type, ts, { store: "PLAY_STORE", product_id: "arbor_plus_monthly:monthly", ...over });
    const r = replay();
    expect(r.apply(play("TEMPORARY_ENTITLEMENT_GRANT", T0, { expiration_at_ms: T0 + DAY }))).toBe(true);
    expect(r.doc()).toMatchObject({ plan: "plus", provider: "play_store" });
    expect(r.apply(play("EXPIRATION", T0 + 1, { expiration_at_ms: T0 + 1 }))).toBe(true);
    expect(r.doc().plan).toBe("free");

    const p = replay();
    expect(p.apply(play("INITIAL_PURCHASE", T0))).toBe(true);
    expect(p.apply(play("SUBSCRIPTION_PAUSED", T0 + 1))).toBe(true);
    expect(p.doc()).toMatchObject({ plan: "plus", status: "canceled", willRenew: false });
    expect(p.entitles(T0 + 29 * DAY)).toBe(true);
    expect(p.entitles(T0 + 31 * DAY)).toBe(false);
  });

  it("an event without a timestamp still applies and never erases the stored one", () => {
    const r = replay();
    expect(r.apply(ios("INITIAL_PURCHASE", T0))).toBe(true);
    expect(r.apply({ ...ios("RENEWAL", T0), event_timestamp_ms: undefined, expiration_at_ms: T0 + 60 * DAY })).toBe(true);
    expect(r.doc().lastEventTs).toBe(T0);
    expect(isStaleBillingEvent(null, { lastEventTs: T0 })).toBe(false);
    expect(isStaleBillingEvent({ lastEventTs: T0 }, { lastEventTs: undefined })).toBe(false);
    expect(isStaleBillingEvent({ lastEventTs: T0 }, { lastEventTs: T0 })).toBe(true);
    expect(isStaleBillingEvent({ lastEventTs: T0 }, { lastEventTs: T0 + 1 })).toBe(false);
  });
});
