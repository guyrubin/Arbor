import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * N1-02 — the paywall funnel, which reported nothing at all.
 *
 * `git grep 'track("' -- components/billing/** lib/pricing.ts server/*` on the
 * wave's base SHA returned zero hits: the conversion moment opened, a parent
 * pressed the CTA, an entitlement changed, and the product recorded none of it.
 * When the one real purchase happens (WAVE-N1 §5 row 3) it has to be readable,
 * and one purchase is only readable against the two stages that precede it.
 *
 * The two ways this instrumentation could lie, and the tests that prevent them:
 *  - a view event on every RENDER would make `paywall_view` a count of price
 *    fetches and cadence toggles → the mount-once source pin, with the pre-fix
 *    component body as the negative control;
 *  - an `entitlement_active` on every READ of the entitlement would inflate the
 *    last stage until the real purchase was invisible in it (critic C13) → the
 *    behaviour table below, whose negative control is an unchanged tier.
 */

const trackSpy = vi.hoisted(() => vi.fn());
vi.mock("../../lib/analytics", () => ({ track: trackSpy }));

import { recordBillingTransition } from "../../lib/billingTransition";
import { trackCheckoutStart, trackPaywallView } from "../../lib/kpiEvents";
import type { EntitlementInfo } from "../../lib/api";

/** Map-backed localStorage — recordBillingTransition dedups through it. */
function installStorage(): Map<string, string> {
  const map = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
  return map;
}

const ent = (plan: string, status: string, extra: Record<string, unknown> = {}) =>
  ({ plan, status, provider: "stripe", enforced: true, ...extra }) as unknown as EntitlementInfo;

const calls = (name: string) =>
  (trackSpy.mock.calls as [string, Record<string, unknown>?][]).filter((c) => c[0] === name);

const read = (rel: string) =>
  fs
    .readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("N1-02 — entitlement_active fires on a TIER CHANGE, never on a read", () => {
  beforeEach(() => {
    trackSpy.mockClear();
    installStorage();
  });

  it("free → plus emits exactly one entitlement_active carrying the previous tier", () => {
    recordBillingTransition(ent("free", "active"));
    trackSpy.mockClear();
    recordBillingTransition(ent("plus", "active"));
    expect(calls("entitlement_active")).toHaveLength(1);
    expect(calls("entitlement_active")[0][1]).toEqual({ plan: "plus", from: "free" });
  });

  it("NEGATIVE CONTROL: re-reading the SAME entitlement emits nothing", () => {
    recordBillingTransition(ent("free", "active"));
    recordBillingTransition(ent("plus", "active"));
    trackSpy.mockClear();
    recordBillingTransition(ent("plus", "active"));
    recordBillingTransition(ent("plus", "active"));
    recordBillingTransition(ent("plus", "active"));
    expect(calls("entitlement_active")).toHaveLength(0);
  });

  it("NEGATIVE CONTROL: a trial maturing into active on the SAME plan does not re-count", () => {
    recordBillingTransition(ent("free", "active"));
    trackSpy.mockClear();
    recordBillingTransition(ent("plus", "in_trial"));
    expect(calls("entitlement_active")).toHaveLength(1);
    expect(calls("entitlement_active")[0][1]).toEqual({ plan: "plus", from: "free" });
    trackSpy.mockClear();
    // Same subscription, one state later — one family, not two.
    recordBillingTransition(ent("plus", "active"));
    expect(calls("entitlement_active")).toHaveLength(0);
  });

  it("an expansion (plus → family) IS a tier change and carries from: plus", () => {
    recordBillingTransition(ent("free", "active"));
    recordBillingTransition(ent("plus", "active"));
    trackSpy.mockClear();
    recordBillingTransition(ent("family", "active"));
    expect(calls("entitlement_active")[0][1]).toEqual({ plan: "family", from: "plus" });
  });

  it("NEGATIVE CONTROL: a beta/comp grant never reaches the paid stage", () => {
    recordBillingTransition(ent("free", "active"));
    trackSpy.mockClear();
    recordBillingTransition(ent("plus", "active", { enforced: false })); // beta Plus-for-everyone
    expect(calls("entitlement_active")).toHaveLength(0);
    trackSpy.mockClear();
    recordBillingTransition(ent("family", "active", { provider: "comp" }));
    expect(calls("entitlement_active")).toHaveLength(0);
  });

  it("the existing pay events are untouched — this is an addition, not a rewrite", () => {
    recordBillingTransition(ent("free", "active"));
    recordBillingTransition(ent("plus", "in_trial"));
    expect(calls("trial_start")).toHaveLength(1);
    recordBillingTransition(ent("plus", "active"));
    expect(calls("paid")).toHaveLength(1);
  });

  it("no price, currency, email or customer id can reach the sink", () => {
    recordBillingTransition(ent("free", "active"));
    recordBillingTransition(
      ent("plus", "active", { priceEur: 12.99, email: "parent@example.com", customerId: "cus_123" }),
    );
    const props = calls("entitlement_active")[0][1] as Record<string, unknown>;
    expect(Object.keys(props).sort()).toEqual(["from", "plan"]);
    const serialized = JSON.stringify(props);
    expect(serialized).not.toContain("12.99");
    expect(serialized).not.toContain("@");
    expect(serialized).not.toContain("cus_");
  });
});

describe("N1-02 — the view and start events carry ids only", () => {
  beforeEach(() => trackSpy.mockClear());

  it("paywall_view keeps a server capability id, and refuses the 402 MESSAGE", () => {
    trackPaywallView({ plan: "plus", reason: "advancedPlans" });
    expect(calls("paywall_view")[0][1]).toEqual({ plan: "plus", reason: "advancedPlans" });
    trackSpy.mockClear();
    // NEGATIVE CONTROL — the message, which is what a careless call site has to
    // hand, is copy and cannot pass the id gate in any language.
    trackPaywallView({ plan: "plus", reason: "Upgrade to Plus for unlimited coach messages" });
    expect(calls("paywall_view")[0][1]).toEqual({ plan: "plus", reason: "other" });
  });

  it("checkout_start names the plan and the channel, and nothing else", () => {
    trackCheckoutStart({ plan: "family", channel: "native" });
    expect(calls("checkout_start")[0][1]).toEqual({ plan: "family", channel: "native" });
    expect(Object.keys(calls("checkout_start")[0][1] ?? {}).sort()).toEqual(["channel", "plan"]);
  });
});

describe("N1-02 — the call sites are LIVE (source pins + pre-fix negative controls)", () => {
  const modal = read("components/billing/PaywallModal.tsx");
  const transition = read("lib/billingTransition.ts");

  it("the scanned files are non-empty (a vacuous pass is not a pass)", () => {
    expect(modal.length).toBeGreaterThan(200);
    expect(transition.length).toBeGreaterThan(200);
  });

  it("the view fires from a mount-once effect whose deps are [paywall.open]", () => {
    expect(modal).toContain("trackPaywallView({");
    const effect = modal.slice(modal.indexOf("trackPaywallView({"));
    const deps = effect.slice(effect.indexOf("}, ["), effect.indexOf("]);") + 3);
    expect(deps).toContain("paywall.open");
    // Render-loop guard: the price/cadence/selection state must NOT be a dep,
    // or a store price arriving late would emit a second view for one open.
    expect(deps).not.toMatch(/cadence|selected|rows|nativePrices/);
  });

  it("the view reads the capability id, never the message or a price", () => {
    const call = modal.match(/trackPaywallView\(\{[^}]*\}\)/)?.[0];
    expect(call).toBeTruthy();
    expect(call).toContain("paywall.feature");
    expect(call).not.toMatch(/message|price|amount|email|detail/i);
  });

  it("NEGATIVE CONTROL: the pre-fix modal (no telemetry at all) fails the pin", () => {
    const preFix = [
      "  useEffect(() => {",
      '    if (paywall.open) setSelected(paywall.suggestedPlan ?? "plus");',
      "  }, [paywall.open, paywall.suggestedPlan]);",
      "",
      "  const rows = buildPlanRows(",
    ].join("\n");
    expect(modal).not.toContain(preFix);
  });

  it("the CTA reports the launch before the platform gate runs", () => {
    expect(modal).toContain("trackCheckoutStart({");
    const cta = modal.slice(modal.indexOf("trackCheckoutStart({"));
    expect(cta.indexOf("startCheckout(selected, cadence)")).toBeGreaterThan(0);
    expect(modal).toMatch(/channel: isNativePlatform \? "native" : "web"/);
    // NEGATIVE CONTROL — the pre-fix one-liner handler must be gone.
    expect(modal).not.toContain("onClick={() => void startCheckout(selected, cadence)}");
  });

  it("the transition guard is a plan comparison, not a status check alone", () => {
    expect(transition).toContain("trackEntitlementActive({ plan: e.plan, from: previousPlan })");
    expect(transition).toContain("previousPlan !== e.plan");
    // NEGATIVE CONTROL — an unguarded emit inside the existing branch would
    // fire on every real-paid read that changed status only.
    expect(transition).not.toMatch(/trackPaid\(e\.plan\);\s*trackEntitlementActive/);
  });

  it("no server-side twin was added: the client transition is the one choke point", () => {
    for (const rel of ["server/entitlements.ts", "server/billing.ts"]) {
      const file = path.resolve(__dirname, "..", "..", rel);
      if (!fs.existsSync(file)) continue;
      expect(fs.readFileSync(file, "utf8")).not.toContain("entitlement_active");
    }
  });
});
