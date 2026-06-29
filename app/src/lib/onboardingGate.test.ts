import { describe, expect, it } from "vitest";
import { computeNeedsOnboarding, findIncompleteOnboardingChild } from "./onboardingGate";
import type { ChildProfile } from "../types";

const mk = (over: Partial<ChildProfile> = {}): ChildProfile => ({
  id: "c1",
  name: "Dylan",
  age: 4,
  languages: ["English"],
  schoolContext: "",
  strengths: [],
  challenges: [],
  riskLevel: "Low",
  ...over,
});

describe("onboardingGate — explicit completion, legacy-safe", () => {
  it("shows onboarding for a brand-new account with no children", () => {
    expect(computeNeedsOnboarding(true, false, [])).toBe(true);
  });

  it("does NOT re-onboard legacy profiles with no onboardingComplete field", () => {
    // THE regression test: every existing prod child doc is `undefined` here, and
    // must be treated as already complete (strict === false, never !flag).
    const legacy = mk();
    expect(legacy.onboardingComplete).toBeUndefined();
    expect(computeNeedsOnboarding(true, false, [legacy])).toBe(false);
    expect(findIncompleteOnboardingChild([legacy])).toBeNull();
  });

  it("keeps onboarding active for an explicitly in-flight profile (=== false)", () => {
    const inFlight = mk({ id: "c2", onboardingComplete: false });
    expect(computeNeedsOnboarding(true, false, [inFlight])).toBe(true);
    expect(findIncompleteOnboardingChild([inFlight])?.id).toBe("c2");
  });

  it("treats an explicitly completed profile as done", () => {
    const done = mk({ onboardingComplete: true, onboardingCompletedAt: "2026-06-29T00:00:00.000Z" });
    expect(computeNeedsOnboarding(true, false, [done])).toBe(false);
    expect(findIncompleteOnboardingChild([done])).toBeNull();
  });

  it("resumes the single in-flight child even alongside completed/legacy ones", () => {
    const done = mk({ id: "a", onboardingComplete: true });
    const legacy = mk({ id: "b" });
    const inFlight = mk({ id: "c", onboardingComplete: false });
    expect(findIncompleteOnboardingChild([done, legacy, inFlight])?.id).toBe("c");
    expect(computeNeedsOnboarding(true, false, [done, legacy, inFlight])).toBe(true);
  });

  it("never shows onboarding while loading or without firestore", () => {
    expect(computeNeedsOnboarding(true, true, [])).toBe(false); // still loading
    expect(computeNeedsOnboarding(false, false, [])).toBe(false); // local / no firestore
  });
});
