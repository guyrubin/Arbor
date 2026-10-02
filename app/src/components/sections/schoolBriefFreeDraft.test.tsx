/**
 * B-CAREPRO-27 — rendered: a Free parent opening the School Brief sees a
 * teacher brief at once (built on the device from the teacher preset), can
 * reach "Save as PDF", and no request or paywall fires on the way. EN + HE.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";

const harness = vi.hoisted(() => ({
  locale: "en" as "en" | "he",
  generateBrief: vi.fn(),
  openPaywall: vi.fn(),
}));

vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({
    childProfile: { id: "c1", name: "Noa", age: 5, languages: ["Hebrew"], schoolContext: harness.locale === "he" ? "גן שקד" : "Gan Shaked", strengths: [harness.locale === "he" ? "בונה מגדלים" : "Builds towers"], challenges: [] },
    behaviorLogs: [],
    milestones: [],
    actionPlans: [{ id: "p1", title: harness.locale === "he" ? "התראה של חמש דקות" : "Five-minute warning", phases: [] }],
    setActiveTab: vi.fn(),
    openPaywall: harness.openPaywall,
  }),
}));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({
    uiLang: harness.locale,
    t: (key: string, vars?: Record<string, string | number>) => translate(harness.locale, key, vars),
  }),
}));
vi.mock("../../lib/api", async (orig) => {
  const actual = await orig<typeof import("../../lib/api")>();
  return { ...actual, api: { ...actual.api, generateBrief: harness.generateBrief } };
});
vi.mock("../ui/Modal", () => ({ Modal: () => null }));

import SchoolBrief from "./SchoolBrief";

beforeEach(() => {
  harness.generateBrief.mockReset();
  harness.openPaywall.mockReset();
});

describe("B-CAREPRO-27 · Free parent: a teacher brief on open, no paywall", () => {
  for (const locale of ["en", "he"] as const) {
    it(`${locale}: the draft renders with the profile's setting, strengths and what the family tries`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<SchoolBrief />);
      expect(html).toContain('data-module="brief-draft"');
      expect(html).toContain(locale === "he" ? "גן שקד" : "Setting: Gan Shaked.");
      expect(html).toContain(locale === "he" ? "בונה מגדלים" : "Builds towers");
      expect(html).toContain(locale === "he" ? "התראה של חמש דקות" : "Five-minute warning");
      // the one primary move is the print button, reachable without Plus
      expect((html.match(/data-primary-move="build-school-brief"/g) ?? []).length).toBe(1);
      expect(html).toContain(translate(locale, "elev.learnCare.brief.print"));
      // Plus is offered as the AI draft, not demanded
      expect(html).toContain('data-testid="school-brief-ai-draft"');
      expect(harness.generateBrief).not.toHaveBeenCalled();
      expect(harness.openPaywall).not.toHaveBeenCalled();
    });
  }
});
