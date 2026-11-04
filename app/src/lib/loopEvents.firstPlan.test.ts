/**
 * B-GROWTH-43 round 4 — "the family has a plan" means the same thing on both
 * referral paths: this device has seen the family's first generated plan,
 * the moment ArborContext fires trackFirstPlan and the link's redemption
 * together. A plan on a sibling, made on this device, counts; the active
 * child's plan list is not the test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

vi.mock("./analytics", () => ({ track: vi.fn() }));
vi.mock("./kpiEvents", () => ({ trackSessionClose: vi.fn(), bindSessionClose: vi.fn() }));

import { hasTrackedFirstPlan, trackFirstPlan } from "./loopEvents";

const ls = new Map<string, string>();
beforeEach(() => {
  ls.clear();
  vi.stubGlobal("localStorage", { getItem: (k: string) => ls.get(k) ?? null, setItem: (k: string, v: string) => void ls.set(k, v), removeItem: (k: string) => void ls.delete(k) });
});
afterEach(() => vi.unstubAllGlobals());

describe("B-GROWTH-43 · one test for 'has a plan'", () => {
  it("is false before the first generated plan and true after it, for any child", () => {
    expect(hasTrackedFirstPlan()).toBe(false);
    trackFirstPlan({ steps: 3 }); // a sibling's first plan on this device
    expect(hasTrackedFirstPlan()).toBe(true);
  });

  it("the link path fires at that same moment, and the typed field reads that same flag", () => {
    const ctx = readFileSync(path.resolve(__dirname, "..", "context", "ArborContext.tsx"), "utf8");
    expect(ctx).toMatch(/trackFirstPlan\(planProps\);[^\n]*\n\s*void maybeActivateReferral\(\);/);
    const field = readFileSync(path.resolve(__dirname, "..", "components", "referral", "OfferCodeField.tsx"), "utf8");
    expect(field).toContain("hasPlan: hasTrackedFirstPlan(),");
    const settings = readFileSync(path.resolve(__dirname, "..", "components", "layout", "SettingsModal.tsx"), "utf8");
    expect(settings).not.toContain("actionPlans?.length");
  });
});
