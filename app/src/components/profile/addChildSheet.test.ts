/**
 * B-SHELL-17 — Add child = onboarding steps 2–3 in a Sheet.
 *
 * Before: AddChildModal had its OWN three-step form — a months range slider,
 * a gender picker, strengths/challenges textareas — and no controller-consent
 * affirmation, so a second child could be added without the consent the first
 * child's onboarding required, with an age control that disagreed with the
 * onboarding/drawer years+months field.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const add = readFileSync(path.join(here, "AddChildModal.tsx"), "utf8").replace(/\r\n/g, "\n");
const onboarding = readFileSync(path.join(here, "AddChildFields.tsx"), "utf8").replace(/\r\n/g, "\n");

describe("B-SHELL-17 · one implementation of the child step", () => {
  it("AddChildModal preserves its existing fields when B-SHELL-36 replaces first run", () => {
    expect(add).toContain('import { StepChild, StepDomains, DOMAINS } from "./AddChildFields";');
    expect(onboarding).toContain("export function StepChild(");
    expect(onboarding).toContain("export function StepDomains(");
    // the one age field lives in StepChild: years + months, never a slider
    const step = onboarding.slice(onboarding.indexOf("export function StepChild("), onboarding.indexOf("export function StepDomains("));
    expect(step).toContain('data-testid="child-age-field"');
  });

  it("the modal's own form is gone: no months slider, no gender picker, no strengths/challenges fields", () => {
    expect(add).not.toMatch(/type="range"/);
    expect(add).not.toMatch(/ac\.ageMonths|ac\.gender|ac\.strengths|ac\.challenges/);
    expect(add).not.toMatch(/<textarea/);
  });

  it("it renders in a Sheet, step 2 then step 3", () => {
    expect(add).toContain('import { Sheet } from "../ui/Sheet";');
    expect(add).toContain('<Sheet open={open} onClose={close} title={t("ac.title")}>');
    expect(add).toMatch(/step === "child" \? \(\s*<StepChild/);
    expect(add).toContain('onNext={() => setStep("domains")}');
  });

  it("adding a child requires the consent checkbox (StepChild's gate + a belt in finish)", () => {
    expect(add).toContain("controllerConsent={controllerConsent} setControllerConsent={setControllerConsent}");
    expect(add).toContain("if (!name.trim() || !controllerConsent || saving) return;");
    const step = onboarding.slice(onboarding.indexOf("export function StepChild("), onboarding.indexOf("export function StepDomains("));
    expect(step).toMatch(/if \(!controllerConsent\) \{\s*setMissing\("consent"\)/);
    expect(step).toContain("<LegalLinks />");
  });

  it("age is entered as years + months and written as months (birthDate only when given)", () => {
    expect(add).toContain("ageMonths: ageYears * 12 + ageMonthsPart");
    expect(add).toContain("...(birthDate ? { birthDate } : {})");
  });

  it("the maxChildren gate is unchanged", () => {
    expect(add).toContain("const atChildLimit = childLimitReached({ entitlement, loading: entitlementLoading, childCount: profiles.length });");
    expect(add).toContain('openPaywall("maxChildren", "plus")');
    expect(add).toContain('<PlanBadge feature="maxChildren" />');
  });

  it("strengths have their named home in the profile drawer", () => {
    const drawer = readFileSync(path.join(here, "ProfileEditDrawer.tsx"), "utf8");
    expect(drawer).toMatch(/<textarea value=\{strengths\}/);
  });
});
