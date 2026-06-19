/**
 * MON-2: the billing rails that fill the entitlement seam.
 *
 * RevenueCat is the single entitlement brain across web (RC Web Billing / Stripe),
 * the App Store, and Google Play. Its server webhook is the ONLY writer of
 * `entitlements/{uid}`. Because RevenueCat keys events to our Firebase uid
 * (set as the RC App User ID at SDK init), a parent who subscribes on iPhone is
 * recognised as paid on the web and vice-versa — one source of truth.
 *
 *   RevenueCat  ──POST /webhooks/billing/revenuecat──▶  setEntitlement(uid, record)
 *                                                              │
 *                                                  Firestore entitlements/{uid}
 *                                                              │
 *                                              resolveEntitlement() gates the app
 *
 * Auth: RevenueCat sends the shared secret configured in its dashboard as the
 * `Authorization` header. We compare it to REVENUECAT_WEBHOOK_AUTH and fail
 * closed when unset (503) or mismatched (401).
 *
 * NOTE (mk-p0-2): `comp` / `productId:"referral_month"` records are the one
 * exception to "RevenueCat is the sole writer" — they are written out-of-band by
 * server/referral.ts via setEntitlement, never by this webhook. They carry
 * willRenew:false and lapse to Free on their own (no billing rails involved).
 */
import express from "express";
import type { ArborConfig } from "../config/env.js";
import type {
  BillingProvider,
  EntitlementRecord,
  EntitlementStatus,
  EntitlementStore,
  Plan,
} from "./entitlements.js";
import { logger } from "./logger.js";

/** Minimal shape of a RevenueCat webhook `event` (fields we read; many more exist). */
export type RevenueCatEvent = {
  id?: string;
  event_timestamp_ms?: number | string;
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  entitlement_id?: string;
  entitlement_ids?: string[];
  period_type?: string; // NORMAL | TRIAL | INTRO
  store?: string; // APP_STORE | PLAY_STORE | STRIPE | RC_BILLING | ...
  expiration_at_ms?: number | string;
};

// Event types that (re)grant access.
const GRANTING = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
  "SUBSCRIPTION_EXTENDED",
  "TRIAL_STARTED",
  "TRIAL_CONVERTED",
]);
// Still entitled until period end, but auto-renew is off.
const CANCELLED = new Set(["CANCELLATION"]);
// In a billing-retry grace window — keep access, surface the warning.
const GRACE = new Set(["BILLING_ISSUE"]);
// Hard loss of access.
const REVOKING = new Set(["EXPIRATION", "REFUND", "SUBSCRIPTION_PAUSED"]);

/** Decide the plan from the product / entitlement identifiers RevenueCat sends. */
export const planFromRevenueCat = (event: RevenueCatEvent): Plan => {
  const ids = [
    ...(event.entitlement_ids ?? []),
    event.entitlement_id,
    event.product_id,
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
  if (ids.some((s) => s.includes("family"))) return "family";
  if (ids.some((s) => s.includes("plus") || s.includes("pro"))) return "plus";
  return "plus"; // any other paid product → Plus floor
};

const providerFromStore = (store: string | undefined): BillingProvider => {
  switch (String(store ?? "").toUpperCase()) {
    case "APP_STORE":
    case "MAC_APP_STORE":
      return "app_store";
    case "PLAY_STORE":
      return "play_store";
    case "STRIPE":
    case "RC_BILLING":
    case "WEB":
      return "stripe";
    default:
      return "none";
  }
};

/** Translate a RevenueCat event into the entitlement record we persist. */
export const recordFromRevenueCat = (
  event: RevenueCatEvent,
): { uid: string; record: EntitlementRecord } | null => {
  const uid = event.app_user_id || event.original_app_user_id;
  if (!uid) return null;
  const type = String(event.type ?? "").toUpperCase();
  const provider = providerFromStore(event.store);
  const periodEnd = event.expiration_at_ms
    ? new Date(Number(event.expiration_at_ms)).toISOString()
    : null;
  const productId = event.product_id ?? null;
  const rcOriginalAppUserId = event.original_app_user_id ?? uid;
  const lastEventId = event.id;
  const lastEventTs = event.event_timestamp_ms ? Number(event.event_timestamp_ms) : undefined;

  if (REVOKING.has(type)) {
    return {
      uid,
      record: {
        plan: "free",
        status: "expired",
        provider,
        productId,
        willRenew: false,
        currentPeriodEnd: periodEnd,
        rcOriginalAppUserId,
        lastEventId,
        lastEventTs,
      },
    };
  }

  // Treat unknown event types conservatively as a grant refresh (RevenueCat only
  // calls the webhook for entitlement-affecting events).
  if (!GRANTING.has(type) && !CANCELLED.has(type) && !GRACE.has(type)) {
    logger.info("RevenueCat event treated as grant refresh", { type });
  }

  const isTrial = String(event.period_type ?? "").toUpperCase() === "TRIAL";
  let status: EntitlementStatus = "active";
  if (isTrial) status = "in_trial";
  if (CANCELLED.has(type)) status = "canceled";
  if (GRACE.has(type)) status = "grace_period";
  const willRenew = !CANCELLED.has(type) && !GRACE.has(type);

  return {
    uid,
    record: {
      plan: planFromRevenueCat(event),
      status,
      provider,
      productId,
      willRenew,
      currentPeriodEnd: periodEnd,
      rcOriginalAppUserId,
      lastEventId,
      lastEventTs,
    },
  };
};

/**
 * Mounted OUTSIDE the auth-gated `/api` group (RevenueCat carries no Firebase
 * token). Path: POST /webhooks/billing/revenuecat.
 */
export const createBillingWebhookRouter = (config: ArborConfig, store: EntitlementStore) => {
  const router = express.Router();
  router.post("/revenuecat", express.json({ limit: "256kb" }), async (req, res) => {
    const expected = config.revenueCatWebhookAuth;
    if (!expected) {
      logger.error("RevenueCat webhook hit but REVENUECAT_WEBHOOK_AUTH is unset");
      res.status(503).json({ error: "Billing webhook not configured" });
      return;
    }
    if (req.header("authorization") !== expected) {
      res.status(401).json({ error: "Unauthorized webhook" });
      return;
    }
    if (!store.setEntitlement) {
      logger.error("Entitlement store is read-only; cannot persist billing event");
      res.status(503).json({ error: "Entitlement store not writable" });
      return;
    }
    try {
      const event: RevenueCatEvent = req.body?.event ?? req.body ?? {};
      const mapped = recordFromRevenueCat(event);
      if (!mapped) {
        res.status(202).json({ ok: true, skipped: "missing app_user_id" });
        return;
      }
      await store.setEntitlement(mapped.uid, mapped.record);
      logger.info("Billing entitlement updated", {
        uid: mapped.uid,
        plan: mapped.record.plan,
        status: mapped.record.status ?? null,
        eventType: event.type ?? null,
      });
      res.status(200).json({ ok: true });
    } catch (error) {
      logger.error("RevenueCat webhook processing failed", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });
  return router;
};

/**
 * Plan+cadence → RevenueCat package identifier. These MUST match the package
 * identifiers configured in the RevenueCat offering (one offering holds all four
 * packages); the Web Purchase Link pre-selects the plan the parent clicked via
 * `?package_id`. Keep in sync with the dashboard.
 */
export const WEB_PACKAGE_IDS: Record<string, string> = {
  plus_monthly: "plus_monthly",
  plus_annual: "plus_annual",
  family_monthly: "family_monthly",
  family_annual: "family_annual",
};

/**
 * Build the hosted-checkout URL for a plan + cadence. The Firebase uid is
 * forwarded so the resulting purchase's webhook lands on the right account.
 *
 * Preferred: a RevenueCat **Web Purchase Link** (`BILLING_WEB_PURCHASE_LINK` =
 * `https://pay.rev.cat/<token>`). RevenueCat requires the URL-encoded App User ID
 * as a PATH segment and pre-selects the product via `?package_id`:
 *   https://pay.rev.cat/<token>/<uid>?package_id=<pkg>&email=<email>
 * Fallback: per-plan hosted links (e.g. Stripe Payment Links) where the uid is a
 * `client_reference_id` query param.
 */
export const billingCheckoutUrl = (
  config: ArborConfig,
  opts: { plan: "plus" | "family"; cadence: "monthly" | "annual"; uid: string; email: string | null },
): string | null => {
  const key = `${opts.plan}_${opts.cadence}`;

  if (config.billingWebPurchaseLink) {
    try {
      const base = config.billingWebPurchaseLink.replace(/\/+$/, "");
      const target = `${base}/${encodeURIComponent(opts.uid)}`;
      const params = new URLSearchParams();
      const pkg = WEB_PACKAGE_IDS[key];
      if (pkg) params.set("package_id", pkg);
      if (opts.email) params.set("email", opts.email);
      const qs = params.toString();
      return qs ? `${target}?${qs}` : target;
    } catch (error) {
      logger.error("Invalid BILLING_WEB_PURCHASE_LINK in config", error, { plan: opts.plan, cadence: opts.cadence });
      return null;
    }
  }

  const base = config.billingCheckoutUrls[key];
  if (!base) return null;
  try {
    const url = new URL(base);
    url.searchParams.set("client_reference_id", opts.uid);
    if (opts.email) url.searchParams.set("prefilled_email", opts.email);
    return url.toString();
  } catch (error) {
    logger.error("Invalid billing checkout URL in config", error, { plan: opts.plan, cadence: opts.cadence });
    return null;
  }
};
