/**
 * STORE-2 — nativeBilling unit tests against a mocked RC SDK module
 * (acceptance #3/#5/#8): App User ID follows the Firebase uid, packages
 * resolve by the shared WEB_PACKAGE_IDS identifiers, user-cancel maps to a
 * silent outcome, and the price map comes from the store product only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const purchases = {
  configure: vi.fn(async () => undefined),
  getAppUserID: vi.fn(async () => ({ appUserID: "anon-rc-id" })),
  logIn: vi.fn(async () => ({ customerInfo: {}, created: false })),
  logOut: vi.fn(async () => ({ customerInfo: {} })),
  getOfferings: vi.fn(async () => ({ current: null })),
  purchasePackage: vi.fn(async () => ({ customerInfo: {}, productIdentifier: "x" })),
  restorePurchases: vi.fn(async () => ({ customerInfo: {} })),
  getCustomerInfo: vi.fn(async () => ({ customerInfo: { managementURL: null } })),
};

vi.mock("@revenuecat/purchases-capacitor", () => ({ Purchases: purchases }));
vi.mock("./runtime", () => ({ isNativePlatform: true, nativePlatform: "ios" }));

const OFFERING = {
  current: {
    identifier: "default",
    availablePackages: [
      { identifier: "plus_monthly", product: { identifier: "arbor_plus_monthly", price: 12.99, priceString: "€12.99", currencyCode: "EUR" } },
      { identifier: "plus_annual", product: { identifier: "arbor_plus_annual", price: 119, priceString: "€119.00", currencyCode: "EUR" } },
      { identifier: "family_monthly", product: { identifier: "arbor_family_monthly", price: 19.99, priceString: "€19.99", currencyCode: "EUR" } },
    ],
  },
};

// The module memoizes configuration, so import once and configure with a key.
vi.stubEnv("VITE_RC_API_KEY_IOS", "appl_public_test_key");
const billing = await import("./nativeBilling");

beforeEach(() => {
  vi.clearAllMocks();
  purchases.getOfferings.mockResolvedValue(OFFERING as never);
});

describe("configure + identity", () => {
  it("configures once with the platform public key and reuses it", async () => {
    expect(await billing.configureNativeBilling()).toBe(true);
    expect(await billing.configureNativeBilling()).toBe(true);
    expect(purchases.configure.mock.calls.length).toBeLessThanOrEqual(1); // memoized after first success
  });

  it("logs in with the Firebase uid when RC holds a different App User ID", async () => {
    await billing.syncNativeBillingUser("firebase-uid-1");
    expect(purchases.logIn).toHaveBeenCalledWith({ appUserID: "firebase-uid-1" });
  });

  it("skips logIn when the RC App User ID already matches", async () => {
    purchases.getAppUserID.mockResolvedValueOnce({ appUserID: "firebase-uid-1" });
    await billing.syncNativeBillingUser("firebase-uid-1");
    expect(purchases.logIn).not.toHaveBeenCalled();
  });

  it("logs out on sign-out", async () => {
    await billing.syncNativeBillingUser(null);
    expect(purchases.logOut).toHaveBeenCalled();
  });
});

describe("purchase", () => {
  it("resolves the package by the shared identifier (plan × cadence) and purchases it", async () => {
    expect(await billing.purchaseNative("plus", "annual")).toBe("purchased");
    const arg = (purchases.purchasePackage.mock.calls[0] as unknown[])[0] as { aPackage: { identifier: string } };
    expect(arg.aPackage.identifier).toBe("plus_annual");
  });

  it("reports 'unavailable' when the offering lacks the package (family_annual absent)", async () => {
    expect(await billing.purchaseNative("family", "annual")).toBe("unavailable");
    expect(purchases.purchasePackage).not.toHaveBeenCalled();
  });

  it("maps a user-cancelled sheet to the silent 'cancelled' outcome", async () => {
    purchases.purchasePackage.mockRejectedValueOnce({ userCancelled: true, code: "1" });
    expect(await billing.purchaseNative("plus", "monthly")).toBe("cancelled");
  });

  it("maps a real store failure to 'error'", async () => {
    purchases.purchasePackage.mockRejectedValueOnce(new Error("billing unavailable"));
    expect(await billing.purchaseNative("plus", "monthly")).toBe("error");
  });
});

describe("prices (spec §2.4 — store product is the only source)", () => {
  it("builds the price map from storeProduct priceString/price/currencyCode", async () => {
    const map = await billing.getNativePriceMap();
    expect(map?.plus.monthly).toEqual({ priceString: "€12.99", amount: 12.99, currencyCode: "EUR" });
    expect(map?.plus.annual?.priceString).toBe("€119.00");
    expect(map?.family.annual).toBeUndefined(); // absent package → no price, never a EUR constant
  });
});
