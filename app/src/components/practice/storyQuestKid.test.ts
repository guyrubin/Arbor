/**
 * B-KID-32 (KC-21) — the Story Quest generator is out of the kid register.
 * The kid world rendered "Make a brand-new adventure": a model call behind a
 * child's tap, a dead tap at quota, and a 402 that queued the paywall for the
 * parent's exit. Now: no generator in Story Quest, and openPaywall opens
 * nothing while Kid Mode is open (nothing queued). Static pins (no jsdom).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

describe("B-KID-32: Story Quest in Kid Mode", () => {
  const adv = read("components/practice/AdventuresTab.tsx");
  it("renders no generator and makes no model call", () => {
    expect(adv).not.toContain("api.generateAdventure");
    expect(adv).not.toContain("elev.practice.adventures.gen.create");
    expect(adv).not.toContain("Make-a-new-adventure CTA");
    expect(adv).toContain("const scenarios = ageScenarios;");
  });
});

describe("B-KID-32: a paywall is never queued by a child's tap", () => {
  const ctx = read("context/ArborContext.tsx");
  const fn = ctx.slice(ctx.indexOf("const openPaywall = ("), ctx.indexOf("const closePaywall"));
  it("openPaywall returns before setting state while Kid Mode is open", () => {
    expect(fn).toContain("if (isKidModeActive()) return;");
    expect(fn.indexOf("if (isKidModeActive()) return;")).toBeLessThan(fn.indexOf("setPaywall("));
  });
  it("NEGATIVE CONTROL: the pre-fix one-liner set the state unconditionally", () => {
    const preFix = 'const openPaywall = (feature?: string, suggestedPlan?: "plus" | "family") => setPaywall({ open: true, feature, suggestedPlan });';
    expect(preFix).not.toContain("isKidModeActive");
  });
});
