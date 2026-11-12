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
const returnSrc = fs.readFileSync(path.join(SRC, "hooks", "useBillingReturn.ts"), "utf8");

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
  it("family feedback has one owner/child boundary outside the family screens", () => {
    const app = fs.readFileSync(path.join(SRC, "App.tsx"), "utf8");
    expect(app).toContain('JSON.stringify([user?.uid ?? null, activeChild.id, loading, loadError])');
    expect(app).toMatch(/<ProfileProvider>\s*<FamilyToastScope>/);
    expect(app).toMatch(/<\/FamilyToastScope>\s*<\/ProfileProvider>/);
    expect(toastSrc).toContain('<AnimatePresence key={generation}>');
  });
  it("only visit-free messages outlive a retirement, and none of them carries an action", () => {
    expect(toastSrc).toContain("queueRef.current = queueRef.current.filter((q) => q.outlivesVisit);");
    expect(toastSrc).toContain("setToasts((t) => t.filter((x) => x.outlivesVisit));");
    expect(toastSrc).toContain('const outlivesVisit = options?.outlivesVisit === true && !action;');
    const sites: [string, string][] = [
      ["components/profile/AddChildModal.tsx", 'toast(t("ac.addedToast", { name: childName }), "success", undefined, { outlivesVisit: true });'],
      ["components/layout/DeleteAccountModal.tsx", 'toast(t("set.acctDel.done"), "success", undefined, { outlivesVisit: true });'],
      ["context/ArborContext.tsx", 'toastCtx?.toast(t("elev.nav.linkMoved"), "info", undefined, { outlivesVisit: true });'],
    ];
    for (const [file, call] of sites) expect(fs.readFileSync(path.join(SRC, file), "utf8")).toContain(call);
    // Every other caller keeps the visit's lifetime: no new opt-in slips in unreviewed.
    const optIns = (dir: string): number => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return n + optIns(full);
      if (!/\.tsx?$/.test(e.name) || /\.test\./.test(e.name)) return n;
      return n + (fs.readFileSync(full, "utf8").match(/\{ outlivesVisit: true \}/g) ?? []).length;
    }, 0);
    expect(optIns(SRC)).toBe(sites.length);
  });
  it("ToastContext exposes a {label,onClick} action and threads it through toast()", () => {
    expect(toastSrc).toMatch(/export type ToastAction = \{ label: string; onClick: \(\) => void \}/);
    expect(toastSrc).toMatch(/toast: \(message: string, type\?: ToastType, action\?: ToastAction, options\?: ToastOptions\) => void/);
    // Queued kid-mode toasts must carry the action through the flush too: one
    // item, with its action, goes to the queue or the layer.
    expect(toastSrc).toContain("const item: Toast = outlivesVisit ? { id, type, message, outlivesVisit } : { id, type, message, action };");
    expect(toastSrc).toMatch(/queueRef\.current\.push\(item\)/);
  });

  it("a toast that carries an action is not auto-dismissed after 4 s", () => {
    // Both the direct path and the kid-mode flush skip the timer when an action
    // is present — a 4 s window is not long enough to read and then act.
    expect(toastSrc).toMatch(/if \(!item\.action\) setTimeout\(\(\) => remove\(id\), 4000\)/);
    expect(toastSrc).toMatch(/if \(!q\.action\) setTimeout\(\(\) => remove\(q\.id\), 4000\)/);
  });

  it("the action renders as a real 44 px control, not a bare link", () => {
    expect(toastSrc).toMatch(/tc\.action && \(/);
    expect(toastSrc).toMatch(/className="touch-target inline-flex items-center mt-1/);
  });
});

describe("CR-09 · the billing pending toast uses the slot", () => {
  it("the return lifecycle attaches Retry to the pending message and restarts bounded verification", () => {
    expect(returnSrc).toContain("BILLING_PENDING_KEY");
    expect(returnSrc).toContain('label: current.t("elev.storeshell.plan.retry"), onClick: start');
    expect(returnSrc).toContain("stop = startBillingReturnPoll({");
    expect(returnSrc).toContain("refresh: refreshEntitlement");
  });

  it("the Retry label ships in both locales (law 7)", () => {
    expect(en["elev.storeshell.plan.retry"]).toBeTruthy();
    expect(he["elev.storeshell.plan.retry"]).toBeTruthy();
    expect(he["elev.storeshell.plan.retry"]).toMatch(/[֐-׿]/);
  });
});
