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
import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { startBillingReturnPoll, BILLING_PENDING_KEY, type BillingReturnDeps } from "../hooks/useEntitlement";
import type { EntitlementInfo } from "./api";
import { translate } from "./i18n";

const FREE = { plan: "free", status: "active", source: "fallback" } as unknown as EntitlementInfo;
const PLUS = { plan: "plus", status: "active", source: "server" } as unknown as EntitlementInfo;

const flush = async () => { for (let i = 0; i < 30; i += 1) await Promise.resolve(); };

/** Runs every scheduled callback immediately, so six tries take no time. */
function immediate(): Pick<BillingReturnDeps, "schedule" | "cancel"> {
  return { schedule: (fn) => { fn(); return 0; }, cancel: () => undefined };
}

describe("1 · the poll gives up out loud", () => {
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
    expect(src).toContain("set.plan.upgradePlus");
  });
});
