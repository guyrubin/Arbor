/**
 * MOB-07 / IA-15 (item 15) — the money moment has a losing branch.
 *
 * `?billing=success` fires ONE "Activating your subscription…" toast which
 * auto-removes after four seconds, then polls `/api/entitlement` six times at
 * 2.5 s. Before this item that sequence had no exit other than success: a
 * `refresh()` that rejected produced an unhandled rejection and killed the
 * poll on the first try, and a plan that stayed free simply ran out of tries.
 * Either way a parent who had just paid was left in silence, on Today, with no
 * second message and nothing to press.
 *
 * These are behavioural tests against the shared module (hooks/useEntitlement),
 * driven by an injected scheduler so no wall-clock time passes. Each has its
 * named negative control: the pre-fix implementation is reproduced inline and
 * asserted to fail the same assertion.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { startBillingReturnPoll, BILLING_PENDING_KEY, FALLBACK_FREE, type BillingReturnDeps } from "../hooks/useEntitlement";
import type { EntitlementInfo } from "./api";
import { translate } from "./i18n";

const FREE: EntitlementInfo = { ...FALLBACK_FREE, source: "default" };
const PLUS: EntitlementInfo = {
  ...FREE,
  plan: "plus",
  limits: { coachMessagesPerDay: null, maxChildren: 6, professionalReports: true, advancedPlans: true, coParentSeats: 1 },
  source: "store",
  provider: "stripe",
};
const APP_TRIAL: EntitlementInfo = { ...PLUS, source: "trial", provider: "none", status: "in_trial", willRenew: false };

const flush = async () => { for (let i = 0; i < 30; i += 1) await Promise.resolve(); };
afterEach(() => vi.useRealTimers());

/** Runs every scheduled callback immediately, so six tries take no time. */
function immediate(): Pick<BillingReturnDeps, "schedule" | "cancel"> {
  return { schedule: (fn) => { fn(); return 0; }, cancel: () => undefined };
}

describe("1 · the poll gives up out loud", () => {
  it("a never-resolving refresh still reaches the wall-clock deadline once", async () => {
    vi.useFakeTimers();
    let answerLate: (e: EntitlementInfo) => void = () => undefined;
    const toast = vi.fn();
    const onTimeout = vi.fn();
    startBillingReturnPoll({
      toast, t: (k) => k, onTimeout,
      refresh: () => new Promise<EntitlementInfo>((resolve) => { answerLate = resolve; }),
    });
    await vi.advanceTimersByTimeAsync(15_000);
    expect(toast.mock.calls.map((c) => c[0])).toEqual(["pw.activating", BILLING_PENDING_KEY]);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    answerLate(PLUS);
    await flush();
    expect(toast.mock.calls.map((c) => c[0])).toEqual(["pw.activating", BILLING_PENDING_KEY]);
  });

  it("refresh rejects on every try → one pending toast, onTimeout once", async () => {
    const toast = vi.fn();
    const onTimeout = vi.fn();
    const refresh = vi.fn(async () => { throw new Error("network"); });
    startBillingReturnPoll({ toast, t: (k) => k, refresh, onTimeout, ...immediate() });
    await flush();

    expect(refresh).toHaveBeenCalledTimes(6);
    expect(toast.mock.calls.filter((c) => c[0] === BILLING_PENDING_KEY)).toHaveLength(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    // The parent is never told the purchase failed, and never told it worked.
    expect(toast.mock.calls.some((c) => c[0] === "pw.activated")).toBe(false);
  });

  it("plan stays free for every try → the same one pending message", async () => {
    const toast = vi.fn();
    const refresh = vi.fn(async () => FREE);
    startBillingReturnPoll({ toast, t: (k) => k, refresh, maxTries: 3, ...immediate() });
    await flush();

    expect(refresh).toHaveBeenCalledTimes(3);
    expect(toast.mock.calls.map((c) => c[0])).toEqual(["pw.activating", BILLING_PENDING_KEY]);
  });

  it("negative control: the shipped implementation says nothing after a rejection", async () => {
    // hooks/useEntitlement.ts as shipped at 7208d0db, verbatim in shape:
    // no try/catch, no give-up branch.
    const toast = vi.fn();
    const shipped = async (deps: { toast: typeof toast; refresh: () => Promise<EntitlementInfo> }) => {
      let tries = 0;
      deps.toast("pw.activating", "info");
      const poll = async () => {
        tries += 1;
        const ent = await deps.refresh();
        if (ent.plan !== "free") { deps.toast("pw.activated", "success"); return; }
        if (tries < 6) await poll();
      };
      await poll().catch(() => undefined); // the unhandled rejection, contained
    };
    await shipped({ toast, refresh: async () => { throw new Error("network"); } });
    expect(toast.mock.calls).toHaveLength(1);
    expect(toast.mock.calls.some((c) => c[0] === BILLING_PENDING_KEY)).toBe(false);
  });
});

describe("2 · the winning branch is unchanged", () => {
  it("plan flips → activated once, never the pending message", async () => {
    const toast = vi.fn();
    const onTimeout = vi.fn();
    startBillingReturnPoll({ toast, t: (k) => k, refresh: async () => PLUS, onTimeout, ...immediate() });
    await flush();
    expect(toast.mock.calls.map((c) => c[0])).toEqual(["pw.activating", "pw.activated"]);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("a rejection followed by a confirmation still wins", async () => {
    const toast = vi.fn();
    let n = 0;
    const refresh = vi.fn(async () => { n += 1; if (n === 1) throw new Error("network"); return PLUS; });
    startBillingReturnPoll({ toast, t: (k) => k, refresh, ...immediate() });
    await flush();
    expect(toast.mock.calls.map((c) => c[0])).toEqual(["pw.activating", "pw.activated"]);
  });

  it("cancel before the last try suppresses the pending message too", async () => {
    const toast = vi.fn();
    let resolve: (e: EntitlementInfo) => void = () => undefined;
    const cancelPoll = startBillingReturnPoll({
      toast, t: (k) => k, maxTries: 1,
      refresh: () => new Promise<EntitlementInfo>((r) => { resolve = r; }),
    });
    cancelPoll();
    resolve(FREE);
    await flush();
    expect(toast.mock.calls.some((c) => c[0] === BILLING_PENDING_KEY)).toBe(false);
  });
});

describe("web checkout confirmation requires purchased access", () => {
  it("keeps polling through app-trial Plus until the paid web entitlement arrives", async () => {
    const toast = vi.fn();
    const refresh = vi.fn()
      .mockResolvedValueOnce(APP_TRIAL)
      .mockResolvedValueOnce(PLUS);
    startBillingReturnPoll({ toast, t: (k) => k, refresh, ...immediate() });
    await flush();

    expect(refresh).toHaveBeenCalledTimes(2);
    expect(toast.mock.calls.map((c) => c[0])).toEqual(["pw.activating", "pw.activated"]);
  });

  const unconfirmed: Array<[string, Partial<EntitlementInfo>]> = [
    ["Arbor no-card trial", APP_TRIAL],
    ["environment comp", { source: "env", provider: "comp" }],
    ["stored referral comp", { provider: "comp" }],
    ["beta access", { source: "beta_unenforced", enforced: false }],
    ["unenforced store answer", { enforced: false }],
    ["client fallback", { source: "client_fallback" }],
    ["unknown source", { source: "unknown" }],
    ["unbacked store grant", { provider: "none" }],
    ["missing provider", { provider: null }],
    ["App Store subscription", { provider: "app_store" }],
    ["Play Store subscription", { provider: "play_store" }],
    ["provider trial", { status: "in_trial" }],
    ["billing grace period", { status: "grace_period" }],
    ["expired subscription", { status: "expired" }],
    ["missing subscription status", { status: null }],
    ["cancellation with no period end", { status: "canceled", currentPeriodEnd: null }],
    ["cancellation with an invalid period end", { status: "canceled", currentPeriodEnd: "not-a-date" }],
    ["cancellation after its period end", { status: "canceled", currentPeriodEnd: "2000-01-01T00:00:00.000Z" }],
  ];
  it.each(unconfirmed)("does not confirm %s as the web purchase", async (_label, fields) => {
    const toast = vi.fn();
    const refresh = vi.fn(async (): Promise<EntitlementInfo> => ({ ...PLUS, ...fields }));
    startBillingReturnPoll({ toast, t: (k) => k, refresh, maxTries: 2, ...immediate() });
    await flush();

    expect(refresh).toHaveBeenCalledTimes(2);
    expect(toast.mock.calls.map((c) => c[0])).toEqual(["pw.activating", BILLING_PENDING_KEY]);
  });

  it("confirms paid access after renewal was canceled while its paid period remains", async () => {
    const toast = vi.fn();
    const paidUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const refresh = vi.fn(async (): Promise<EntitlementInfo> => ({
      ...PLUS, status: "canceled", willRenew: false, currentPeriodEnd: paidUntil,
    }));
    startBillingReturnPoll({ toast, t: (k) => k, refresh, ...immediate() });
    await flush();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(toast.mock.calls.map((c) => c[0])).toEqual(["pw.activating", "pw.activated"]);
  });

  it("retains recognition of an existing paid Family web subscription", async () => {
    const toast = vi.fn();
    const refresh = vi.fn(async (): Promise<EntitlementInfo> => ({ ...PLUS, plan: "family" }));
    startBillingReturnPoll({ toast, t: (k) => k, refresh, ...immediate() });
    await flush();

    expect(toast.mock.calls.map((c) => c[0])).toEqual(["pw.activating", "pw.activated"]);
  });
});

describe("3 · the message and the place it sends the parent both exist", () => {
  it("the pending copy is written in EN and HE and names Settings › Plan", () => {
    for (const lang of ["en", "he"] as const) {
      expect(translate(lang, BILLING_PENDING_KEY)).not.toBe(BILLING_PENDING_KEY);
    }
    expect(translate("en", BILLING_PENDING_KEY)).toContain("Settings");
  });

  it("Settings suppresses the upgrade CTAs and the Free label while unverified", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../components/layout/SettingsModal.tsx"), "utf8",
    );
    // The free block — usage counter, cadence toggle, both upgrade buttons —
    // is gated on a KNOWN free plan, not merely on a falsy isPaid.
    expect(src).toContain("{!isPaid && !entitlementUnverified && (");
    // And the plan line itself does not print "Your plan: Free" as a verdict.
    expect(src).toContain('data-testid="plan-unknown"');
    expect(src).toMatch(/\) : entitlementUnverified \? \(/);
    // MOB-08's Retry is still the one place a parent can re-ask.
    expect(src).toMatch(/onClick=\{\(\) => void retryEntitlement\(\)\}/);
  });

  it("negative control: an ungated free block would sell an upgrade mid-verification", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../components/layout/SettingsModal.tsx"), "utf8",
    );
    // The shipped gate, which rendered whenever the fallback said "free".
    expect(src).not.toContain("{!isPaid && (\n");
    expect(src).toContain("elev.storeshell.pw.continuePayment");
  });
});
