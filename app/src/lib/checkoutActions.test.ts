/**
 * STORE-2 G2 — native-path behavioural guard for the ONE platform gate
 * (lib/checkoutActions.ts).
 *
 * Apple 3.1.1 / Play Payments: with the native flag set, NO code path may call
 * the web checkout/portal endpoints or navigate to a hosted checkout URL. The
 * web negative control at the bottom proves the guard measures the gate, not a
 * broken mock (heredoc lesson: every filter needs a negative test).
 */
import { describe, expect, it, vi } from "vitest";
import {
  performCheckout,
  performOpenPortal,
  performRestore,
  type CheckoutDeps,
  type NativePurchaseOutcome,
  type NativeRestoreOutcome,
} from "./checkoutActions";

const makeDeps = (overrides: Partial<CheckoutDeps> = {}): CheckoutDeps & {
  calls: Record<string, number>;
} => {
  const calls: Record<string, number> = {
    billingCheckout: 0, billingPortal: 0, navigate: 0,
    nativePurchase: 0, nativeManage: 0, nativeRestore: 0, refresh: 0,
  };
  return {
    calls,
    isNative: true,
    billingCheckout: vi.fn(async () => { calls.billingCheckout++; return { url: "https://pay.rev.cat/tok/uid" }; }),
    billingPortal: vi.fn(async () => { calls.billingPortal++; return { url: "https://billing.stripe.com/session" }; }),
    navigate: vi.fn(() => { calls.navigate++; }),
    nativePurchase: vi.fn(async (): Promise<NativePurchaseOutcome> => { calls.nativePurchase++; return "purchased"; }),
    nativeManage: vi.fn(async () => { calls.nativeManage++; return true; }),
    nativeRestore: vi.fn(async (): Promise<NativeRestoreOutcome> => { calls.nativeRestore++; return "restored"; }),
    refresh: vi.fn(async () => { calls.refresh++; return null; }),
    ...overrides,
  };
};

describe("G2 — native binary: the web checkout is unreachable", () => {
  it("startCheckout on native never calls /api/billing/checkout and never navigates", async () => {
    const deps = makeDeps();
    const result = await performCheckout(deps, "plus", "monthly");
    expect(result).toBe("purchased");
    expect(deps.calls.billingCheckout).toBe(0);
    expect(deps.calls.navigate).toBe(0);
    expect(deps.calls.nativePurchase).toBe(1);
    expect(deps.calls.refresh).toBe(1); // entitlement invalidated after purchase
  });

  it("native user-cancel is silent (a 'cancelled' outcome, not an error) and does not refresh", async () => {
    const deps = makeDeps({ nativePurchase: async () => "cancelled" });
    const result = await performCheckout(deps, "family", "annual");
    expect(result).toBe("cancelled");
    expect(deps.calls.billingCheckout).toBe(0);
    expect(deps.calls.navigate).toBe(0);
    expect(deps.calls.refresh).toBe(0);
  });

  it("native purchase failure degrades to 'error'/'unavailable' — still zero web-checkout reachability", async () => {
    const deps = makeDeps({ nativePurchase: async () => { throw new Error("store down"); } });
    const result = await performCheckout(deps, "plus", "annual");
    expect(result).toBe("error");
    expect(deps.calls.billingCheckout).toBe(0);
    expect(deps.calls.navigate).toBe(0);
  });

  it("openPortal on native opens the platform surface, never the Stripe/RC web portal", async () => {
    const deps = makeDeps();
    const result = await performOpenPortal(deps);
    expect(result).toBe("managed");
    expect(deps.calls.billingPortal).toBe(0);
    expect(deps.calls.navigate).toBe(0);
    expect(deps.calls.nativeManage).toBe(1);
  });

  it("openPortal on native reports 'unavailable' (no web fallback) when the platform surface fails", async () => {
    const deps = makeDeps({ nativeManage: async () => false });
    const result = await performOpenPortal(deps);
    expect(result).toBe("unavailable");
    expect(deps.calls.billingPortal).toBe(0);
    expect(deps.calls.navigate).toBe(0);
  });

  it("restore on native runs restorePurchases then refreshes the entitlement", async () => {
    const deps = makeDeps();
    const result = await performRestore(deps);
    expect(result).toBe("restored");
    expect(deps.calls.nativeRestore).toBe(1);
    expect(deps.calls.refresh).toBe(1);
  });
});

describe("G2 negative control — web path DOES use the hosted checkout (proves the gate is measured)", () => {
  it("startCheckout on web calls /api/billing/checkout and navigates to the returned URL", async () => {
    const deps = makeDeps({ isNative: false });
    const result = await performCheckout(deps, "plus", "monthly");
    expect(result).toBe("redirected");
    expect(deps.calls.billingCheckout).toBe(1);
    expect(deps.calls.navigate).toBe(1);
    expect(deps.calls.nativePurchase).toBe(0);
  });

  it("openPortal on web navigates to the portal URL", async () => {
    const deps = makeDeps({ isNative: false });
    const result = await performOpenPortal(deps);
    expect(result).toBe("redirected");
    expect(deps.calls.billingPortal).toBe(1);
    expect(deps.calls.navigate).toBe(1);
    expect(deps.calls.nativeManage).toBe(0);
  });

  it("openPortal on web with no configured portal is 'unavailable' without navigating", async () => {
    const deps = makeDeps({ isNative: false, billingPortal: async () => ({ url: null }) });
    const result = await performOpenPortal(deps);
    expect(result).toBe("unavailable");
    expect(deps.calls.navigate).toBe(0);
  });

  it("restore on web is inert: 'unavailable' without touching native billing", async () => {
    const deps = makeDeps({ isNative: false });
    const result = await performRestore(deps);
    expect(result).toBe("unavailable");
    expect(deps.calls.nativeRestore).toBe(0);
    expect(deps.calls.refresh).toBe(0);
  });

  it("web checkout failure yields the CARE-5 'unavailable' info outcome, no navigation", async () => {
    const deps = makeDeps({ isNative: false, billingCheckout: async () => { throw new Error("503"); } });
    const result = await performCheckout(deps, "family", "monthly");
    expect(result).toBe("unavailable");
    expect(deps.calls.navigate).toBe(0);
  });
});
