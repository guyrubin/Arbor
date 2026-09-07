/**
 * MOB-12 (wave T) — "Relaunch onboarding demo" never ships on a parent's
 * real first-run Ready screen.
 *
 * StepReady is rendered with react-dom/server (node harness, contexts mocked).
 * Production mode = `showReplay={false}` (the root computes it as
 * `import.meta.env.DEV || entitlement.isAdmin === true`; under vitest DEV is
 * true, so the prop — not the env — is what the render pins). Negative
 * control: `showReplay={true}` renders the replay button (the pre-fix state).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ t: (k: string) => k, uiLang: "en", aiLang: "en", setUiLang: () => undefined, setAiLang: () => undefined }),
}));
vi.mock("../../context/ProfileContext", () => ({ useProfile: () => ({ addChild: async () => undefined, updateChild: async () => undefined, profiles: [] }) }));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: () => undefined }) }));
vi.mock("../../hooks/useEntitlement", () => ({ useEntitlement: () => ({ entitlement: { isAdmin: false }, loading: false }) }));
vi.mock("../../lib/api", () => ({ api: {} }));
vi.mock("../../lib/analytics", () => ({ track: () => undefined }));
vi.mock("../profile/AvatarCreator", () => ({ default: () => null }));
vi.mock("../billing/LegalLinks", () => ({ LegalLinks: () => null, default: () => null }));

import { StepReady, StepChild, StepDomains } from "./OnboardingFlow";

const here = path.dirname(fileURLToPath(import.meta.url));
const flow = readFileSync(path.join(here, "OnboardingFlow.tsx"), "utf8");

const render = (showReplay: boolean) =>
  renderToStaticMarkup(
    React.createElement(StepReady, {
      name: "Noa",
      ageYears: 3,
      ageMonthsPart: 4,
      selectedDomains: [],
      avatarResult: null,
      saving: false,
      onSubmit: () => undefined,
      onReplay: () => undefined,
      showReplay,
    }),
  );

const buttonCount = (html: string) => (html.match(/<button\b/g) ?? []).length;

describe("StepReady in production mode has exactly one button (Enter Arbor)", () => {
  it("showReplay=false → one button, no 'demo' affordance", () => {
    const html = render(false);
    expect(buttonCount(html)).toBe(1);
    expect(html).toContain("ob.step.ready.cta");
    expect(html).not.toContain("ob.demo.relaunch");
  });

  it("negative control: showReplay=true renders the replay button (the pre-fix screen)", () => {
    const html = render(true);
    expect(buttonCount(html)).toBe(2);
    expect(html).toContain("ob.demo.relaunch");
  });

  it("the root gates the prop on DEV || admin and the prop defaults to false", () => {
    expect(flow).toMatch(/const showReplay = import\.meta\.env\.DEV \|\| entitlement\.isAdmin === true;/);
    expect(flow).toMatch(/<StepReady[\s\S]*?showReplay=\{showReplay\}/);
    expect(flow).toMatch(/showReplay = false,\s*\n\s*\}: \{/);
    expect(flow).toMatch(/\{showReplay && \(\s*<button/);
  });
});

/**
 * OBJ-ONB-01 / MOB-11 (item 26) — step 2 stops inventing a birthday, and step 3
 * stops hiding both ways out.
 *
 * Step 2's age was two range sliders whose write was `birthDate:"2023-09-01"`
 * for "3 years" — a day-01 birthday nobody entered. That matters beyond
 * tidiness: `ageMonthsFromProfile` PREFERS birthDate over ageMonths, so the
 * invented date, not the months the parent stated, is what drove age bands,
 * screening windows and monitoring from then on. Step 3's Continue sat at y960
 * and Skip at y1020 against an 844 fold at 390 px.
 */
const renderChild = (over: Partial<Parameters<typeof StepChild>[0]> = {}) =>
  renderToStaticMarkup(
    React.createElement(StepChild, {
      name: "Noa", setName: () => undefined,
      ageYears: 3, setAgeYears: () => undefined,
      ageMonthsPart: 0, setAgeMonthsPart: () => undefined,
      birthDate: "", setBirthDate: () => undefined,
      languages: [], setLanguages: () => undefined,
      controllerConsent: false, setControllerConsent: () => undefined,
      creating: false, onNext: () => undefined,
      ...over,
    }),
  );

describe("MOB-11 · the age field states an age; it never fabricates a birthday", () => {
  it("no range slider survives on the age field", () => {
    const html = renderChild();
    expect(html).not.toContain('type="range"');
    expect(html).toContain('data-testid="child-age-field"');
    // Years + months as number inputs, the profile drawer's shape (GP-03).
    expect((html.match(/type="number"/g) ?? [])).toHaveLength(2);
  });

  it("the birthday is an optional disclosure, closed by default", () => {
    expect(renderChild()).toContain("elev.ob.birthday.add");
    expect(renderChild()).not.toContain('data-testid="ob-birthdate"');
  });

  it("submit writes ageMonths and omits birthDate unless the parent entered one", () => {
    const addChild = /const child = await addChild\(\{[\s\S]*?\}\);/.exec(flow)?.[0] ?? "";
    expect(addChild).not.toBe("");
    expect(addChild).toContain("ageMonths: totalAgeMonths");
    expect(addChild).toContain("...(birthDate ? { birthDate } : {})");
    // The state it reads is parent-entered and starts empty.
    expect(flow).toMatch(/useState<string>\(resumeChild\?\.birthDate \?\? ""\)/);
  });

  it("negative control: the shipped step derived the date from the sliders", () => {
    // `const birthDate = birthDateFromAgeMonths(totalAgeMonths);` immediately
    // before addChild, with `birthDate,` passed unconditionally.
    // The import and the call are both gone (the name survives only in the
    // comment at the site, which is where the history belongs).
    expect(flow).not.toMatch(/import \{ birthDateFromAgeMonths \}/);
    expect(flow).not.toMatch(/birthDateFromAgeMonths\(/);
    expect(flow).not.toMatch(/\n\s+birthDate,\n/);
    // The helper still exists for the callers that legitimately want it.
    expect(readFileSync(path.join(here, "../../lib/childAge.ts"), "utf8")).toContain("export function birthDateFromAgeMonths");
  });

  it("the controller-consent control clears 24 px and its label reads at 14", () => {
    const html = renderChild();
    expect(html).toMatch(/width:24px/);
    expect(html).toMatch(/height:24px/);
    expect(html).toContain('class="text-[14px] leading-snug"');
    // Negative control: the shipped 18px box and 12px label are gone.
    expect(html).not.toContain("width:18px;height:18px");
    expect(html).not.toContain('class="text-[12px] leading-snug"');
  });
});

describe("OBJ-ONB-01 · both ways out of step 3 ride the fold", () => {
  const renderDomains = () =>
    renderToStaticMarkup(
      React.createElement(StepDomains, {
        selectedDomains: [], setSelectedDomains: () => undefined,
        onNext: () => undefined, onSkip: () => undefined,
      }),
    );

  it("Continue and Skip sit together in a sticky footer", () => {
    const html = renderDomains();
    const footer = /<div class="sticky bottom-0[^"]*" data-testid="onboarding-domains-footer"[\s\S]*$/.exec(html)?.[0] ?? "";
    expect(footer).not.toBe("");
    expect(footer).toContain("ob.step.continue");
    expect(footer).toContain("ob.step.domains.skip");
    expect(buttonCount(footer)).toBe(2);
    // Both clear the 44 px floor.
    expect((footer.match(/min-height:44px/g) ?? [])).toHaveLength(2);
  });

  it("the seven tiles are still all there, above the footer", () => {
    const html = renderDomains();
    const footerAt = html.indexOf('data-testid="onboarding-domains-footer"');
    expect((html.slice(0, footerAt).match(/aria-pressed=/g) ?? [])).toHaveLength(7);
  });

  it("negative control: the shipped buttons were plain siblings with no sticky ancestor", () => {
    // As shipped, Continue and Skip followed the tile grid and the reassurance
    // line as bare children of the step container, so seven tiles pushed them
    // past an 844 fold.
    expect(flow).not.toMatch(/\{t\("ob\.step\.domains\.footer"\)\}\s*<\/p>\s*\{\/\* Anti-trap/);
    expect(flow).toContain('data-testid="onboarding-domains-footer"');
  });
});
