import { describe, expect, it } from "vitest";
import { planFromRevenueCat, recordFromRevenueCat, billingCheckoutUrl, offeredCurrencies, SOLD_PLANS, webhookSkipReason, createBillingWebhookRouter, transferPartiesFromRevenueCat, transferWritesFromRevenueCat } from "./billing.js";
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
      "SUBSCRIBER_ALIAS",
      "PRICE_INCREASE_CONSENT_REQUIRED",
      "PRICE_INCREASE_CONSENT_APPROVED",
      "SOMETHING_NEW",
      "",
    ]) {
      expect(webhookSkipReason({ ...purchase, type, environment: "PRODUCTION" }, { billingAcceptSandbox: false }), type).toBe("ignored");
      expect(recordFromRevenueCat({ ...purchase, type }), type).toBeNull();
    }
    // B-GA-20: TRANSFER is now applied (it MOVES an existing subscription,
    // see the restore-across-accounts block below) but is still never mapped
    // as a grant of its own.
    expect(webhookSkipReason({ ...purchase, type: "TRANSFER", environment: "PRODUCTION" }, { billingAcceptSandbox: false })).toBeNull();
    expect(recordFromRevenueCat({ ...purchase, type: "TRANSFER" })).toBeNull();
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

describe("B-GA-20 restore across accounts: a TRANSFER moves the entitlement once", () => {
  const DAY = 86_400_000;
  const T0 = Date.parse("2026-11-01T10:00:00.000Z");
  // Several entitlements/{uid} docs, each written the way the webhook writes:
  // map, skip stale, merge without undefined. A TRANSFER reads the old
  // accounts' records, then grants before it removes (the router's order).
  const ledger = () => {
    const docs = new Map<string, EntitlementRecord>();
    const write = (uid: string, record: EntitlementRecord) => {
      if (isStaleBillingEvent(docs.get(uid) ?? null, record)) return false;
      const clean = Object.fromEntries(Object.entries(record).filter(([, v]) => v !== undefined));
      docs.set(uid, { ...(docs.get(uid) ?? {}), ...clean } as EntitlementRecord);
      return true;
    };
    const apply = (event: Parameters<typeof recordFromRevenueCat>[0]) => {
      const mapped = recordFromRevenueCat(event);
      return !!mapped && write(mapped.uid, mapped.record);
    };
    const transfer = (event: Parameters<typeof transferWritesFromRevenueCat>[0]) => {
      const { from } = transferPartiesFromRevenueCat(event);
      const sources = Object.fromEntries(from.map((uid) => [uid, docs.get(uid) ?? null]));
      const { grants, removals } = transferWritesFromRevenueCat(event, sources);
      const applied = [...grants, ...removals].map((w) => write(w.uid, w.record));
      return { grants: grants.map((w) => w.uid), removals: removals.map((w) => w.uid), applied: applied.filter(Boolean).length };
    };
    return {
      apply,
      transfer,
      write,
      doc: (uid: string) => docs.get(uid) ?? null,
      entitles: (uid: string, now: number) => {
        const d = docs.get(uid);
        return !!d && d.plan !== "free" && recordStillEntitles(d, now);
      },
    };
  };
  const purchase = (type: string, ts: number, uid: string, over: Record<string, unknown> = {}) => ({
    id: `evt-${type}-${uid}-${ts}`,
    type,
    app_user_id: uid,
    original_app_user_id: uid,
    product_id: "arbor_plus_monthly",
    entitlement_ids: ["plus"],
    period_type: "NORMAL",
    store: "APP_STORE",
    environment: "PRODUCTION",
    event_timestamp_ms: ts,
    expiration_at_ms: T0 + 30 * DAY,
    ...over,
  });
  // RevenueCat's TRANSFER shape: no app_user_id, product or expiry; the two sides only.
  const transfer = (ts: number, from: string[], to: string[], over: Record<string, unknown> = {}) => ({
    id: `evt-TRANSFER-${ts}`,
    type: "TRANSFER",
    store: "APP_STORE",
    environment: "PRODUCTION",
    event_timestamp_ms: ts,
    transferred_from: from,
    transferred_to: to,
    ...over,
  });

  it("is applied, not acknowledged unwritten; the native-sandbox-in-prod rule is unchanged", () => {
    const prod = { billingAcceptSandbox: false };
    expect(webhookSkipReason(transfer(T0, ["a"], ["b"]), prod)).toBeNull();
    // App Review restores in the native sandbox against prod: applies.
    expect(webhookSkipReason(transfer(T0, ["a"], ["b"], { environment: "SANDBOX" }), prod)).toBeNull();
    expect(webhookSkipReason(transfer(T0, ["a"], ["b"], { environment: "SANDBOX", store: "PLAY_STORE" }), prod)).toBeNull();
    // A web sandbox transfer still never touches prod.
    expect(webhookSkipReason(transfer(T0, ["a"], ["b"], { environment: "SANDBOX", store: "RC_BILLING" }), prod)).toBe("sandbox");
    // It is never mapped as a grant of its own (it names no app_user_id).
    expect(recordFromRevenueCat(transfer(T0, ["a"], ["b"]))).toBeNull();
  });

  it("the entitlement follows the subscription to the new account and leaves the old one", () => {
    const l = ledger();
    expect(l.apply(purchase("INITIAL_PURCHASE", T0, "fam-a"))).toBe(true);
    expect(l.transfer(transfer(T0 + DAY, ["fam-a"], ["fam-b"]))).toEqual({ grants: ["fam-b"], removals: ["fam-a"], applied: 2 });
    expect(l.doc("fam-b")).toMatchObject({ plan: "plus", status: "active", provider: "app_store", productId: "arbor_plus_monthly", willRenew: true, currentPeriodEnd: new Date(T0 + 30 * DAY).toISOString(), rcOriginalAppUserId: "fam-b", lastEventTs: T0 + DAY });
    expect(l.doc("fam-a")).toMatchObject({ plan: "free", status: "expired", willRenew: false, lastEventTs: T0 + DAY });
    expect(l.entitles("fam-b", T0 + 2 * DAY)).toBe(true);
    // Account-bound: the restore cannot leave a second family unlocked.
    expect(l.entitles("fam-a", T0 + 2 * DAY)).toBe(false);
  });

  it("a duplicate TRANSFER changes nothing", () => {
    const l = ledger();
    l.apply(purchase("INITIAL_PURCHASE", T0, "fam-a"));
    const evt = transfer(T0 + DAY, ["fam-a"], ["fam-b"]);
    l.transfer(evt);
    const before = { a: l.doc("fam-a"), b: l.doc("fam-b") };
    expect(l.transfer(evt).applied).toBe(0);
    expect({ a: l.doc("fam-a"), b: l.doc("fam-b") }).toEqual(before);
    expect(l.doc("fam-b")?.plan).toBe("plus");
  });

  it("an older event for the old account delivered late cannot unlock it again", () => {
    const l = ledger();
    l.apply(purchase("INITIAL_PURCHASE", T0, "fam-a"));
    l.transfer(transfer(T0 + 2 * DAY, ["fam-a"], ["fam-b"]));
    expect(l.apply(purchase("RENEWAL", T0 + DAY, "fam-a", { expiration_at_ms: T0 + 60 * DAY }))).toBe(false);
    expect(l.entitles("fam-a", T0 + 3 * DAY)).toBe(false);
    expect(l.entitles("fam-b", T0 + 3 * DAY)).toBe(true);
  });

  it("a newer event already on the new account is not overwritten by a late TRANSFER", () => {
    const l = ledger();
    l.apply(purchase("INITIAL_PURCHASE", T0, "fam-a"));
    // The renewal to the new owner arrives before the transfer that preceded it.
    l.apply(purchase("RENEWAL", T0 + 3 * DAY, "fam-b", { expiration_at_ms: T0 + 90 * DAY }));
    const out = l.transfer(transfer(T0 + DAY, ["fam-a"], ["fam-b"]));
    expect(out.grants).toEqual(["fam-b"]);
    expect(out.applied).toBe(1); // only the removal: the grant was stale
    expect(l.doc("fam-b")).toMatchObject({ currentPeriodEnd: new Date(T0 + 90 * DAY).toISOString(), lastEventTs: T0 + 3 * DAY });
    expect(l.doc("fam-a")?.plan).toBe("free");
  });

  it("a TRANSFER before its purchase grants nothing (no fabricated paid success) and keeps the old account locked", () => {
    const l = ledger();
    expect(l.transfer(transfer(T0 + DAY, ["fam-a"], ["fam-b"]))).toEqual({ grants: [], removals: ["fam-a"], applied: 1 });
    expect(l.doc("fam-b")).toBeNull();
    // The purchase it moved, delivered late, is older than the transfer.
    expect(l.apply(purchase("INITIAL_PURCHASE", T0, "fam-a"))).toBe(false);
    expect(l.entitles("fam-a", T0 + 2 * DAY)).toBe(false);
  });

  it("a retry after a failed removal finishes the move without a second grant", () => {
    const l = ledger();
    l.apply(purchase("INITIAL_PURCHASE", T0, "fam-a"));
    const evt = transfer(T0 + DAY, ["fam-a"], ["fam-b"]);
    // First delivery: the grant landed, the removal failed (500, RevenueCat
    // retries). The router writes grants first, so nothing is lost meanwhile.
    const { grants } = transferWritesFromRevenueCat(evt, { "fam-a": l.doc("fam-a") });
    for (const g of grants) expect(l.write(g.uid, g.record)).toBe(true);
    const granted = l.doc("fam-b");
    expect(l.entitles("fam-a", T0 + 2 * DAY)).toBe(true);
    // The retry reads the old account again: the grant is stale, the removal lands.
    expect(l.transfer(evt)).toEqual({ grants: ["fam-b"], removals: ["fam-a"], applied: 1 });
    expect(l.doc("fam-b")).toEqual(granted);
    expect(l.entitles("fam-a", T0 + 2 * DAY)).toBe(false);
    expect(l.transfer(evt).applied).toBe(0);
  });

  it("another store's subscription and a comp month stay where they are", () => {
    const l = ledger();
    l.apply(purchase("INITIAL_PURCHASE", T0, "fam-a", { store: "STRIPE", product_id: "plus_monthly" }));
    expect(l.transfer(transfer(T0 + DAY, ["fam-a"], ["fam-b"]))).toEqual({ grants: [], removals: [], applied: 0 });
    expect(l.doc("fam-a")).toMatchObject({ plan: "plus", provider: "stripe" });
    expect(l.doc("fam-b")).toBeNull();

    const comp = transferWritesFromRevenueCat(transfer(T0 + DAY, ["fam-c"], ["fam-d"]), {
      "fam-c": { plan: "plus", status: "active", provider: "comp", productId: "referral_month", willRenew: false, currentPeriodEnd: new Date(T0 + 30 * DAY).toISOString() },
    });
    expect(comp).toEqual({ grants: [], removals: [] });
  });

  it("only Arbor accounts take part: RevenueCat anonymous ids and an id on both sides are left out", () => {
    expect(transferPartiesFromRevenueCat(transfer(T0, ["$RCAnonymousID:1", "fam-a"], ["$RCAnonymousID:2", "fam-b"]))).toEqual({ from: ["fam-a"], to: ["fam-b"] });
    expect(transferPartiesFromRevenueCat(transfer(T0, ["fam-a", "fam-b"], ["fam-b"]))).toEqual({ from: ["fam-a"], to: [] });
    expect(transferPartiesFromRevenueCat({ type: "TRANSFER" })).toEqual({ from: [], to: [] });
    expect(transferWritesFromRevenueCat(transfer(T0, ["$RCAnonymousID:1"], ["fam-b"]), {})).toEqual({ grants: [], removals: [] });
    // Not a TRANSFER: no writes, whatever it names.
    expect(transferWritesFromRevenueCat({ ...transfer(T0, ["fam-a"], ["fam-b"]), type: "RENEWAL" }, { "fam-a": { plan: "plus", provider: "app_store", status: "active" } })).toEqual({ grants: [], removals: [] });
  });

  it("over HTTP: a native-sandbox TRANSFER in prod reads the old account, grants the new one, then removes the old", async () => {
    const express = (await import("express")).default;
    const records = new Map<string, EntitlementRecord>([["fam-a", { plan: "plus", status: "active", provider: "app_store", productId: "arbor_plus_monthly", willRenew: true, currentPeriodEnd: new Date(T0 + 30 * DAY).toISOString(), lastEventTs: T0 }]]);
    const calls: string[] = [];
    const store = {
      getPlan: async () => null,
      getRecord: async (uid: string) => { calls.push(`read:${uid}`); return records.get(uid) ?? null; },
      setEntitlement: async (uid: string, record: EntitlementRecord) => { calls.push(`write:${uid}:${record.plan}`); records.set(uid, record); },
    };
    const app = express();
    app.use("/webhooks/billing", createBillingWebhookRouter(cfg({ revenueCatWebhookAuth: "Bearer s3cret", billingAcceptSandbox: false }), store as never));
    const server = app.listen(0);
    try {
      const { port } = server.address() as { port: number };
      const post = (event: object) =>
        fetch(`http://127.0.0.1:${port}/webhooks/billing/revenuecat`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: "Bearer s3cret" },
          body: JSON.stringify({ api_version: "1.0", event }),
        });
      const res = await post(transfer(T0 + DAY, ["fam-a"], ["fam-b"], { environment: "SANDBOX" }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, transferred: true });
      expect(calls).toEqual(["read:fam-a", "write:fam-b:plus", "write:fam-a:free"]);
      expect(records.get("fam-b")).toMatchObject({ plan: "plus", provider: "app_store", lastEventTs: T0 + DAY });

      const empty = await post(transfer(T0 + 2 * DAY, ["$RCAnonymousID:1"], ["fam-b"]));
      expect(empty.status).toBe(202);
      expect(await empty.json()).toEqual({ ok: true, skipped: "transfer without account ids" });
      expect(calls).toHaveLength(3);
    } finally {
      server.close();
    }
  });
});
