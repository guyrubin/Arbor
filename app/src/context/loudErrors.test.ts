import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * W4 (store-polish audit 2026-08-28) — loud, localized errors.
 *
 * The audit found three native alert()s in ArborContext + one in
 * reportExport.ts, and AI failures from Plans/Behaviors that only ever
 * rendered inside CoachTab's apiError card (invisible on the tab where the
 * parent actually was). These structural pins keep the fixed shape:
 *  - zero alert() in the context / export lib (toasts via ToastContext only),
 *  - each failure path toasts a localized key on the surface that failed,
 *  - the PaywallError branch survives (a 402 opens the upgrade prompt, not a toast),
 *  - the dead bedtime-story context surface stays deleted.
 */

const SRC = path.resolve(__dirname, "..");
const read = (rel: string) =>
  fs
    .readFileSync(path.join(SRC, rel), "utf8")
    // strip comments so prose about the old pattern can't satisfy/trip pins
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const arbor = read("context/ArborContext.tsx");
const reportExport = read("lib/reportExport.ts");

describe("W4 loud errors — alerts are gone, toasts are wired", () => {
  it("ArborContext has ZERO native alert() calls", () => {
    expect(arbor).not.toMatch(/\balert\(/);
  });

  it("reportExport has ZERO native alert() calls and signals a blocked pop-up to its caller", () => {
    expect(reportExport).not.toMatch(/\balert\(/);
    expect(reportExport).toMatch(/openPrintableReport\([^)]*\):\s*boolean/);
  });

  it("plan generation toasts localized success AND failure (failure not routed to CoachTab-only apiError)", () => {
    const fn = arbor.slice(arbor.indexOf("const handleGenerateActionPlan"), arbor.indexOf("const toggleLogResolved"));
    expect(fn).toContain('toast(t("plan.toast.created"');
    expect(fn).toContain('toast(t("err.planCreate"), "error")');
    // The 402 branch survives: a paywall hit opens the upgrade prompt, never a toast.
    expect(fn).toMatch(/err instanceof PaywallError\)\s*openPaywall\(/);
    expect(fn).not.toMatch(/setApiError\(/);
  });

  it("behavior analysis failure toasts on the Behaviors surface (not CoachTab-only apiError)", () => {
    const fn = arbor.slice(arbor.indexOf("const handleAnalyzeBehaviors"), arbor.indexOf("const handleGenerateActionPlan"));
    expect(fn).toContain('toast(t("err.behaviorAnalyze"), "error")');
    expect(fn).not.toMatch(/setApiError\(/);
  });

  it("memory-review update failure + log-form validation toast localized keys", () => {
    expect(arbor).toContain('toast(t("err.memoryUpdate"), "error")');
    expect(arbor).toContain('toast(t("beh.toast.fillBoth"), "error")');
  });

  it("both print-shell callers toast err.popupBlocked when the pop-up is blocked", () => {
    for (const rel of ["components/sections/Reports.tsx", "components/sections/Screening.tsx"]) {
      const code = read(rel);
      expect(code, `${rel} must handle openPrintableReport() === false`).toMatch(
        /!openPrintableReport\([\s\S]{0,80}?toast\(t\("err\.popupBlocked"\), "error"\)/
      );
    }
  });

  it("the dead bedtime-story context surface stays deleted (BedtimeStoriesTab owns its flow)", () => {
    for (const dead of ["handleGenerateStory", "isStoryGenerating", "currentStory", "storyReadingProgress"]) {
      expect(arbor, `ArborContext resurrects dead story surface "${dead}"`).not.toContain(dead);
    }
  });
});
