import { isNativePlatform, nativePlatform } from "./runtime";
import type { NativePurchaseOutcome, NativeRestoreOutcome, PaidPlan, Cadence } from "./checkoutActions";

/**
 * STORE-2 — RevenueCat native billing (StoreKit / Play Billing) behind the
 * `native.ts` dynamic-import pattern: the RC SDK is imported ONLY inside these
 * functions, so no native plugin code lands in the web bundle's initial graph,
 * and every export is a typed no-op on web.
 *
 * Contract with the server (server/billing.ts): RevenueCat keys purchase events
 * on the App User ID, and the webhook writes `entitlements/{uid}` — so the RC
 * App User ID MUST be the Firebase uid. `syncNativeBillingUser` enforces that
 * from AuthContext on every auth-state change.
 *
 * SDK public API keys are publishable (not secrets) and ship ONLY in the native
 * CI builds via VITE_RC_API_KEY_IOS / VITE_RC_API_KEY_ANDROID. When absent
 * (e.g. pre-launch), everything below reports "unavailable" and the UI falls
 * back to the existing neutral "checkout isn't live yet" copy.
 */

/** RC package identifiers — the same four logical packages the web checkout
 *  pre-selects (server/billing.ts WEB_PACKAGE_IDS; offering `default`). */
const PACKAGE_IDS: Record<PaidPlan, Record<Cadence, string>> = {
  plus: { monthly: "plus_monthly", annual: "plus_annual" },
  family: { monthly: "family_monthly", annual: "family_annual" },
};

/** Localized price for one package, straight from the store product —
 *  StoreKit/Play is the price authority on native (never lib/pricing.ts). */
export type NativePrice = { priceString: string; amount: number; currencyCode: string };
export type NativePriceMap = Record<PaidPlan, Partial<Record<Cadence, NativePrice>>>;

const rcApiKey = (): string | null => {
  const key =
    nativePlatform === "ios"
      ? (import.meta.env.VITE_RC_API_KEY_IOS as string | undefined)
      : nativePlatform === "android"
        ? (import.meta.env.VITE_RC_API_KEY_ANDROID as string | undefined)
        : undefined;
  return key && key.trim() ? key.trim() : null;
};

let configured = false;
let configuring: Promise<boolean> | null = null;

const loadSdk = () => import("@revenuecat/purchases-capacitor");

/** Configure the RC SDK once per app launch. Safe to call repeatedly; resolves
 *  false (and stays inert) on web or when no API key is shipped. */
export function configureNativeBilling(): Promise<boolean> {
  if (!isNativePlatform) return Promise.resolve(false);
  if (configured) return Promise.resolve(true);
  if (configuring) return configuring;
  configuring = (async () => {
    const apiKey = rcApiKey();
    if (!apiKey) return false;
    try {
      const { Purchases } = await loadSdk();
      await Purchases.configure({ apiKey });
      configured = true;
      return true;
    } catch {
      return false;
    } finally {
      configuring = null;
    }
  })();
  return configuring;
}

/**
 * Keep the RC App User ID in lockstep with Firebase auth: uid on sign-in,
 * logOut on sign-out. Called from AuthContext's onAuthStateChanged; no-op on
 * web and when billing isn't configured. Never throws (auth must not break
 * if billing is down).
 */
export async function syncNativeBillingUser(uid: string | null): Promise<void> {
  if (!(await configureNativeBilling())) return;
  try {
    const { Purchases } = await loadSdk();
    if (uid) {
      const { appUserID } = await Purchases.getAppUserID();
      if (appUserID !== uid) await Purchases.logIn({ appUserID: uid });
    } else {
      await Purchases.logOut().catch(() => undefined); // already anonymous → fine
    }
  } catch {
    /* billing sync failure is non-fatal by design */
  }
}

const isUserCancel = (err: unknown): boolean => {
  const e = err as { userCancelled?: boolean | null; code?: unknown; message?: unknown } | null;
  if (e?.userCancelled) return true;
  // PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR — compare loosely; the code
  // arrives as a string enum value across platforms.
  return /cancel/i.test(String(e?.code ?? "")) || /cancell?ed/i.test(String(e?.message ?? ""));
};

/** Run the native StoreKit/Play purchase sheet for plan × cadence. */
export async function purchaseNative(plan: PaidPlan, cadence: Cadence): Promise<NativePurchaseOutcome> {
  if (!(await configureNativeBilling())) return "unavailable";
  try {
    const { Purchases } = await loadSdk();
    const offerings = await Purchases.getOfferings();
    const wanted = PACKAGE_IDS[plan][cadence];
    const pkg = offerings.current?.availablePackages.find((p) => p.identifier === wanted);
    if (!pkg) return "unavailable";
    await Purchases.purchasePackage({ aPackage: pkg });
    return "purchased";
  } catch (err) {
    return isUserCancel(err) ? "cancelled" : "error";
  }
}

/** Apple-required Restore Purchases. The entitlement refresh happens in
 *  checkoutActions after a "restored" outcome. */
export async function restoreNativePurchases(): Promise<NativeRestoreOutcome> {
  if (!(await configureNativeBilling())) return "unavailable";
  try {
    const { Purchases } = await loadSdk();
    await Purchases.restorePurchases();
    return "restored";
  } catch {
    return "error";
  }
}

/**
 * Open the platform's own subscription-management surface — never the
 * Stripe/RC web portal (that URL class is forbidden inside the native binary).
 * Preferred: RC's managementURL (deep-links to the right store account);
 * fallback: the generic platform subscriptions page.
 */
export async function openNativeManage(): Promise<boolean> {
  if (!isNativePlatform) return false;
  let url =
    nativePlatform === "ios"
      ? "https://apps.apple.com/account/subscriptions"
      : "https://play.google.com/store/account/subscriptions";
  if (await configureNativeBilling()) {
    try {
      const { Purchases } = await loadSdk();
      const { customerInfo } = await Purchases.getCustomerInfo();
      if (customerInfo.managementURL) url = customerInfo.managementURL;
    } catch {
      /* fall through to the generic platform page */
    }
  }
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
    return true;
  } catch {
    return false;
  }
}

let priceMapCache: NativePriceMap | null = null;

/**
 * Localized prices for all four packages from the current offering. Cached per
 * launch. Returns null on web / unconfigured / failure — the price UI renders
 * nothing rather than falling back to stale EUR constants (spec §2.4).
 */
export async function getNativePriceMap(): Promise<NativePriceMap | null> {
  if (priceMapCache) return priceMapCache;
  if (!(await configureNativeBilling())) return null;
  try {
    const { Purchases } = await loadSdk();
    const offerings = await Purchases.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];
    const map: NativePriceMap = { plus: {}, family: {} };
    let found = 0;
    for (const plan of Object.keys(PACKAGE_IDS) as PaidPlan[]) {
      for (const cadence of Object.keys(PACKAGE_IDS[plan]) as Cadence[]) {
        const pkg = packages.find((p) => p.identifier === PACKAGE_IDS[plan][cadence]);
        if (pkg?.product?.priceString) {
          map[plan][cadence] = {
            priceString: pkg.product.priceString,
            amount: pkg.product.price,
            currencyCode: pkg.product.currencyCode,
          };
          found++;
        }
      }
    }
    if (!found) return null;
    priceMapCache = map;
    return map;
  } catch {
    return null;
  }
}
