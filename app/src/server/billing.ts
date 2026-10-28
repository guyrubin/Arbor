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
import {
  isStaleBillingEvent,
  recordStillEntitles,
  type BillingProvider,
  type EntitlementRecord,
  type EntitlementStatus,
  type EntitlementStore,
  type Plan,
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
  environment?: string; // PRODUCTION | SANDBOX
  /** TRANSFER only (a restore on another account): the App User IDs the
   *  subscription leaves and the ones it now belongs to. TRANSFER carries no
   *  app_user_id, product or expiry of its own. */
  transferred_from?: string[];
  transferred_to?: string[];
};

// Event types that (re)grant access. TEMPORARY_ENTITLEMENT_GRANT is RevenueCat's
// store-outage grant (at most 24 h; EXPIRATION follows if validation fails).
const GRANTING = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
  "SUBSCRIPTION_EXTENDED",
  "TEMPORARY_ENTITLEMENT_GRANT",
  "REFUND_REVERSED",
  "TRIAL_STARTED",
  "TRIAL_CONVERTED",
]);
// Still entitled until period end, but auto-renew is off. A refund arrives as
// CANCELLATION (cancel_reason CUSTOMER_SUPPORT) with the expiry at the refund,
// so the record lapses at once. SUBSCRIPTION_PAUSED pauses at period end.
const CANCELLED = new Set(["CANCELLATION", "SUBSCRIPTION_PAUSED"]);
// In a billing-retry grace window — keep access, surface the warning.
const GRACE = new Set(["BILLING_ISSUE"]);
// Hard loss of access.
const REVOKING = new Set(["EXPIRATION", "REFUND"]);
/** Every type that changes an entitlement. Anything else (INVOICE_ISSUANCE, an
 *  unpaid invoice; EXPERIMENT_ENROLLMENT; VIRTUAL_CURRENCY_TRANSACTION;
 *  PURCHASE_REDEEMED; PRICE_INCREASE_*) is acknowledged and never written:
 *  none of them is a payment. */
const ENTITLEMENT_TYPES = new Set([...GRANTING, ...CANCELLED, ...GRACE, ...REVOKING]);
/** B-GA-20: a restore on another account. It moves an EXISTING subscription
 *  (transferWritesFromRevenueCat), so it is applied, never mapped as a grant. */
const TRANSFER = "TRANSFER";
/** Stores whose sandbox needs a tester the account owner invited (TestFlight,
 *  Play license testers) and which App Review uses against the prod backend. */
const NATIVE_STORES = new Set(["APP_STORE", "MAC_APP_STORE", "PLAY_STORE"]);

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

/**
 * Events the webhook acknowledges without writing an entitlement.
 *  - "test": the dashboard's "Send test event" (type TEST, made-up user id);
 *    a 200 proves the Authorization header matches, nothing is granted.
 *  - "ignored": any type outside ENTITLEMENT_TYPES. Before 20 Oct an unknown
 *    type was written as a grant, so an unpaid INVOICE_ISSUANCE unlocked Plus.
 *  - "sandbox": a web test-card purchase. The web sandbox checkout is the live
 *    Purchase Link with `/sandbox/` in front of the same token, so any parent
 *    could reach it from their own checkout URL; in prod it must never grant
 *    Plus. Native-store sandbox still applies (App Review buys in the sandbox
 *    against prod). Every web sandbox event applies where `billingAcceptSandbox`
 *    is on (every env but prod).
 */
export const webhookSkipReason = (
  event: RevenueCatEvent,
  config: Pick<ArborConfig, "billingAcceptSandbox">,
): "test" | "ignored" | "sandbox" | null => {
  const type = String(event.type ?? "").toUpperCase();
  if (type === "TEST") return "test";
  if (!ENTITLEMENT_TYPES.has(type) && type !== TRANSFER) return "ignored";
  const sandbox = String(event.environment ?? "").toUpperCase() === "SANDBOX";
  if (sandbox && config.billingAcceptSandbox !== true && !NATIVE_STORES.has(String(event.store ?? "").toUpperCase())) return "sandbox";
  return null;
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

  // Only an entitlement type is ever written (see webhookSkipReason).
  if (!ENTITLEMENT_TYPES.has(type)) return null;

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

/** A RevenueCat anonymous id never names an Arbor account: the SDK logs in
 *  with the Firebase uid, so only those ids hold an `entitlements/{uid}` doc. */
const isAccountId = (id: unknown): id is string =>
  typeof id === "string" && id.trim().length > 0 && !id.startsWith("$RCAnonymousID:");

/** B-GA-20: the accounts a TRANSFER moves a subscription between. An id on
 *  both sides is neither (it keeps what it has). */
export const transferPartiesFromRevenueCat = (event: RevenueCatEvent): { from: string[]; to: string[] } => {
  const from = new Set((Array.isArray(event.transferred_from) ? event.transferred_from : []).filter(isAccountId));
  const to = new Set((Array.isArray(event.transferred_to) ? event.transferred_to : []).filter(isAccountId));
  return { from: [...from].filter((uid) => !to.has(uid)), to: [...to].filter((uid) => !from.has(uid)) };
};

export type BillingWrite = { uid: string; record: EntitlementRecord };

/** Providers whose records the RevenueCat webhook writes (a comp is not one). */
const BILLED = new Set<BillingProvider>(["app_store", "play_store", "stripe"]);

/**
 * B-GA-20 — a restore across accounts. RevenueCat sends TRANSFER when a store
 * account's purchases move to another App User ID (a parent restores on a
 * second Arbor account). The event names only the two sides, so the
 * entitlement FOLLOWS the subscription: the record the old account holds is
 * written to the new one, and the old one drops to Free. Pure: the caller
 * reads the old accounts' records and applies the writes, grants first.
 *
 *  - Only a billed record is moved: a comp (referral month, founder grant) is
 *    not a store purchase, so it neither moves nor is removed.
 *  - Only the subscription the transfer names: when the event names a store,
 *    a record from another store (a web subscription beside an App Store one)
 *    is left where it is.
 *  - Stale-guarded like every other event, with the TRANSFER's own id and
 *    timestamp on every write: a resend writes nothing new, an older event
 *    delivered late cannot re-unlock the old account, and a record that
 *    post-dates the transfer is neither moved nor removed.
 *  - No fabricated paid success: when the old account holds nothing to move
 *    (the TRANSFER arrived before its purchase), nothing is granted; the old
 *    account is still stamped Free so the late purchase cannot unlock it.
 *  - The receiving account keeps what it already has when that lasts at least
 *    as long: a comp month, or another store's live subscription, is never
 *    overwritten by a shorter transferred one (`targets`, the receivers'
 *    current records; the same store's record is the one being replaced).
 */
export const transferWritesFromRevenueCat = (
  event: RevenueCatEvent,
  sources: Readonly<Record<string, EntitlementRecord | null | undefined>>,
  targets: Readonly<Record<string, EntitlementRecord | null | undefined>> = {},
  now: number = Date.now(),
): { grants: BillingWrite[]; removals: BillingWrite[] } => {
  const none = { grants: [], removals: [] };
  if (String(event.type ?? "").toUpperCase() !== TRANSFER) return none;
  const { from, to } = transferPartiesFromRevenueCat(event);
  if (!from.length || !to.length) return none;
  const store = providerFromStore(event.store);
  const lastEventId = event.id;
  const lastEventTs = event.event_timestamp_ms ? Number(event.event_timestamp_ms) : undefined;
  const stamp = { lastEventTs };

  let moving: EntitlementRecord | null = null;
  const removals: BillingWrite[] = [];
  for (const uid of from) {
    const current = sources[uid] ?? null;
    // Written after this transfer: not the subscription it moved.
    if (current && isStaleBillingEvent(current, stamp)) continue;
    const billed = !!current?.provider && BILLED.has(current.provider);
    const paid = !!current && current.plan !== "free" && current.status !== "expired";
    // A comp, or another store's subscription, stays exactly as it is.
    if (paid && (!billed || (store !== "none" && current!.provider !== store))) continue;
    if (paid && (!moving || Date.parse(current!.currentPeriodEnd ?? "") > Date.parse(moving.currentPeriodEnd ?? ""))) moving = current;
    removals.push({
      uid,
      record: {
        plan: "free",
        status: "expired",
        provider: current?.provider ?? store,
        productId: current?.productId ?? null,
        willRenew: false,
        currentPeriodEnd: null,
        rcOriginalAppUserId: current?.rcOriginalAppUserId ?? uid,
        lastEventId,
        lastEventTs,
      },
    });
  }
  const endOf = (r: EntitlementRecord) => (r.currentPeriodEnd ? Date.parse(r.currentPeriodEnd) : Number.POSITIVE_INFINITY);
  const keepsOwn = (uid: string) => {
    const own = targets[uid];
    if (!own || !moving || own.plan === "free" || !recordStillEntitles(own, now)) return false;
    if (own.provider === moving.provider) return false; // the same store's subscription: the transfer replaces it
    return endOf(own) >= endOf(moving);
  };
  const grants: BillingWrite[] = moving
    ? to.filter((uid) => !keepsOwn(uid)).map((uid) => ({
        uid,
        record: {
          plan: moving!.plan,
          status: moving!.status,
          provider: moving!.provider,
          productId: moving!.productId ?? null,
          willRenew: moving!.willRenew,
          currentPeriodEnd: moving!.currentPeriodEnd ?? null,
          rcOriginalAppUserId: uid,
          lastEventId,
          lastEventTs,
        },
      }))
    : [];
  return { grants, removals };
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
    const skip = webhookSkipReason(req.body?.event ?? req.body ?? {}, config);
    if (skip) {
      // 200, so RevenueCat does not retry an event we will never apply.
      const type = req.body?.event?.type ?? null;
      if (skip === "sandbox") logger.warn("RevenueCat web sandbox event ignored in this environment", { type });
      if (skip === "ignored") logger.info("RevenueCat event acknowledged, not an entitlement change", { type });
      res.status(200).json({ ok: true, skipped: skip });
      return;
    }
    if (!store.setEntitlement) {
      logger.error("Entitlement store is read-only; cannot persist billing event");
      res.status(503).json({ error: "Entitlement store not writable" });
      return;
    }
    try {
      const event: RevenueCatEvent = req.body?.event ?? req.body ?? {};
      if (String(event.type ?? "").toUpperCase() === TRANSFER) {
        const { from, to } = transferPartiesFromRevenueCat(event);
        if (!from.length || !to.length) {
          res.status(202).json({ ok: true, skipped: "transfer without account ids" });
          return;
        }
        if (!store.getRecord) {
          logger.error("Entitlement store cannot read records; cannot apply a transfer");
          res.status(503).json({ error: "Entitlement store not readable" });
          return;
        }
        const sources: Record<string, EntitlementRecord | null> = {};
        for (const uid of from) sources[uid] = await store.getRecord(uid);
        const targets: Record<string, EntitlementRecord | null> = {};
        for (const uid of to) targets[uid] = await store.getRecord(uid);
        const { grants, removals } = transferWritesFromRevenueCat(event, sources, targets);
        // Grant before removing: a failure between the two leaves the
        // subscription on both accounts until RevenueCat retries, and the
        // retry finishes the move. The reverse order would lose it on retry.
        for (const write of grants) await store.setEntitlement(write.uid, write.record);
        for (const write of removals) await store.setEntitlement(write.uid, write.record);
        logger.info("Billing entitlement transferred", {
          from,
          to,
          moved: grants.length > 0,
          plan: grants[0]?.record.plan ?? null,
          eventType: TRANSFER,
        });
        res.status(200).json({ ok: true, transferred: grants.length > 0 });
        return;
      }
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
/** BD-53/P2: the checkout currencies on sale — EUR always, ILS when configured. */
export const offeredCurrencies = (config: ArborConfig): string[] => config.billingCurrencies ?? ["EUR"];

/** BD-53/P3 (Guy, 20 Oct 2026): only Plus is sold. Family stays an entitlement
 *  (comps, any existing subscription) but no new checkout starts for it. */
export const SOLD_PLANS: readonly string[] = ["plus"];

export const billingCheckoutUrl = (
  config: ArborConfig,
  opts: { plan: "plus" | "family"; cadence: "monthly" | "annual"; uid: string; email: string | null; currency?: string },
): string | null => {
  const key = `${opts.plan}_${opts.cadence}`;

  if (config.billingWebPurchaseLink) {
    try {
      const target = new URL(config.billingWebPurchaseLink.trim());
      if (target.protocol !== "https:" || target.username || target.password || !opts.uid) return null;
      target.pathname = `${target.pathname.replace(/\/+$/, "")}/${encodeURIComponent(opts.uid)}`;
      target.hash = "";
      const params = target.searchParams;
      const pkg = WEB_PACKAGE_IDS[key];
      if (pkg) params.set("package_id", pkg);
      // BD-53/P2: name the currency the price was shown in; RevenueCat would
      // otherwise pick one by the buyer's location once a second one exists.
      if (opts.currency) params.set("currency", opts.currency);
      if (opts.email) params.set("email", opts.email);
      return target.toString();
    } catch (error) {
      logger.error("Invalid BILLING_WEB_PURCHASE_LINK in config", error, { plan: opts.plan, cadence: opts.cadence });
      return null;
    }
  }

  const base = config.billingCheckoutUrls[key];
  if (!base) return null;
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" || url.username || url.password || !opts.uid) return null;
    url.searchParams.set("client_reference_id", opts.uid);
    if (opts.email) url.searchParams.set("prefilled_email", opts.email);
    return url.toString();
  } catch (error) {
    logger.error("Invalid billing checkout URL in config", error, { plan: opts.plan, cadence: opts.cadence });
    return null;
  }
};
