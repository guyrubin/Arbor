import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { en, he } from "./i18nElevation/storeShell";

/**
 * CR-09 — the toast layer had two defects the billing return exposed:
 *   1. `top-4` with no safe-area inset, so on a notched phone the layer painted
 *      under the status bar.
 *   2. No action slot. The billing "still confirming" toast told the parent to
 *      wait and gave them nothing to press; the only recovery was navigating to
 *      Settings by words.
 *
 * These are source ratchets (the repo has no DOM test runner): the shapes that
 * carried the defect must not come back, and the shapes that fix it must stay.
 */

const SRC = path.resolve(__dirname, "..");
const toastSrc = fs.readFileSync(path.join(SRC, "context", "ToastContext.tsx"), "utf8");
const shellSrc = fs.readFileSync(path.join(SRC, "components", "layout", "Shell.tsx"), "utf8");

// The pre-fix layer className, verbatim. The two scans below are written
// against this fixture first so a passing test proves the scan can fail.
const PRE_FIX_LAYER = `className="fixed top-4 end-4 z-[80] arbor-app flex flex-col gap-2 w-[min(92vw,340px)]">`;

const hasSafeArea = (src: string) => /top:\s*"calc\(env\(safe-area-inset-top\)/.test(src);
const hasBareTop4 = (src: string) => /className="fixed top-4 /.test(src);

describe("CR-09 · toast layer safe area", () => {
  it("negative control: the pre-fix layer markup is what the scans reject", () => {
    expect(hasBareTop4(PRE_FIX_LAYER)).toBe(true);
    expect(hasSafeArea(PRE_FIX_LAYER)).toBe(false);
  });

  it("the toast layer is offset by the safe-area inset, not a bare top-4", () => {
    expect(hasBareTop4(toastSrc)).toBe(false);
    expect(hasSafeArea(toastSrc)).toBe(true);
  });
});

describe("CR-09 · toast action slot", () => {
  it("ToastContext exposes a {label,onClick} action and threads it through toast()", () => {
    expect(toastSrc).toMatch(/export type ToastAction = \{ label: string; onClick: \(\) => void \}/);
    expect(toastSrc).toMatch(/toast: \(message: string, type\?: ToastType, action\?: ToastAction\) => void/);
    // Queued kid-mode toasts must carry the action through the flush too.
    expect(toastSrc).toMatch(/queueRef\.current\.push\(\{ id, type, message, action \}\)/);
  });

  it("a toast that carries an action is not auto-dismissed after 4 s", () => {
    // Both the direct path and the kid-mode flush skip the timer when an action
    // is present — a 4 s window is not long enough to read and then act.
    expect(toastSrc).toMatch(/if \(!action\) setTimeout\(\(\) => remove\(id\), 4000\)/);
    expect(toastSrc).toMatch(/if \(!q\.action\) setTimeout\(\(\) => remove\(q\.id\), 4000\)/);
  });

  it("the action renders as a real 44 px control, not a bare link", () => {
    expect(toastSrc).toMatch(/tc\.action && \(/);
    expect(toastSrc).toMatch(/className="touch-target inline-flex items-center mt-1/);
  });
});

describe("CR-09 · the billing pending toast uses the slot", () => {
  it("Shell attaches Retry to the BILLING_PENDING_KEY toast and re-reads the entitlement", () => {
    expect(shellSrc).toContain("BILLING_PENDING_KEY");
    expect(shellSrc).toMatch(/label: t\("elev\.storeshell\.plan\.retry"\), onClick: \(\) => \{ void refreshEntitlement\(\); \}/);
    expect(shellSrc).toContain("startBillingReturnPoll({ toast: withRetry");
  });

  it("the Retry label ships in both locales (law 7)", () => {
    expect(en["elev.storeshell.plan.retry"]).toBeTruthy();
    expect(he["elev.storeshell.plan.retry"]).toBeTruthy();
    expect(he["elev.storeshell.plan.retry"]).toMatch(/[֐-׿]/);
  });
});
