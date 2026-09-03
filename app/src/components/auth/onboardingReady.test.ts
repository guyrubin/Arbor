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

import { StepReady } from "./OnboardingFlow";

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
