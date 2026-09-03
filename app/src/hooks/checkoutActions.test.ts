/**
 * MOB-08 (wave T) — money moments are legible.
 *
 * useCheckout's outcome → effects mapping is pure (resolveCheckoutOutcome /
 * resolveRestoreOutcome) so the node harness can pin it:
 *   native purchased → paywall CLOSES + "You're all set" (pw.activated)
 *   error            → a dedicated purchase-failed line (nothing was charged)
 *   unavailable      → honest "not available right now" — never the
 *                      pre-launch "we'll email you" copy (set.plan.checkoutSoon)
 *   cancelled / redirected → silent (negative controls)
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveCheckoutOutcome, resolveRestoreOutcome } from "./useCheckout";
import { en as shellEn, he as shellHe } from "../lib/i18nElevation/storeShell";

const here = path.dirname(fileURLToPath(import.meta.url));
const hook = readFileSync(path.join(here, "useCheckout.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("resolveCheckoutOutcome", () => {
  it("native purchased → close the paywall and confirm with pw.activated (success)", () => {
    expect(resolveCheckoutOutcome("purchased")).toEqual({ toastKey: "pw.activated", tone: "success", close: true });
  });

  it("error → dedicated purchase-failed key (error tone), paywall stays open for a retry", () => {
    const fx = resolveCheckoutOutcome("error");
    expect(fx).toEqual({ toastKey: "elev.storeshell.pw.purchaseFailed", tone: "error", close: false });
    expect(shellEn[fx.toastKey!]).toMatch(/nothing was charged/i);
    expect(shellHe[fx.toastKey!]).toContain("לא בוצע חיוב");
  });

  it("unavailable → honest not-available copy (info), never the pre-launch email promise", () => {
    const fx = resolveCheckoutOutcome("unavailable");
    expect(fx).toEqual({ toastKey: "elev.storeshell.pw.checkoutUnavailable", tone: "info", close: false });
    expect(fx.toastKey).not.toBe("set.plan.checkoutSoon");
    expect(shellEn[fx.toastKey!]).not.toMatch(/email/i);
  });

  it("negative controls: cancelled and redirected are silent and do not close", () => {
    for (const r of ["cancelled", "redirected"] as const) {
      expect(resolveCheckoutOutcome(r)).toEqual({ toastKey: null, tone: "info", close: false });
    }
  });
});

describe("resolveRestoreOutcome", () => {
  it("restored → close + set.plan.restoreDone", () => {
    expect(resolveRestoreOutcome("restored")).toEqual({ toastKey: "set.plan.restoreDone", tone: "success", close: true });
  });
  it("error → restore-failed (error); unavailable → not-available (info)", () => {
    expect(resolveRestoreOutcome("error").toastKey).toBe("elev.storeshell.pw.restoreFailed");
    expect(resolveRestoreOutcome("error").tone).toBe("error");
    expect(resolveRestoreOutcome("unavailable").toastKey).toBe("elev.storeshell.pw.checkoutUnavailable");
  });
});

describe("useCheckout wiring (source contract)", () => {
  it("applies effects through the pure resolver and closes the paywall via ArborContext", () => {
    expect(hook).toMatch(/applyEffects\(resolveCheckoutOutcome\(result\)\)/);
    expect(hook).toMatch(/applyEffects\(resolveRestoreOutcome\(result\)\)/);
    expect(hook).toMatch(/if \(fx\.close\) arbor\?\.closePaywall\(\);/);
  });

  it("the pre-launch 'we'll email you' key is unreachable from the hook", () => {
    expect(hook).not.toContain("set.plan.checkoutSoon");
  });
});
