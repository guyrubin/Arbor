import { describe, expect, it } from "vitest";
import { planFromRevenueCat, recordFromRevenueCat, billingCheckoutUrl } from "./billing.js";
import type { ArborConfig } from "../config/env.js";

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
});
