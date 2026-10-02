/**
 * B-CAREPRO-04 → B-CAREPRO-19 — Consult never shows a professional directory.
 *
 * B-CAREPRO-04 hid the "Verified professionals" rail while the directory was
 * empty. B-CAREPRO-19 (G3) retired the directory itself: #/find-pro lands on
 * Consult, the rail and the Send-to-a-professional modal are deleted, and the
 * one send verb is "Send to someone you trust" (the same audience-capped
 * text). Rendered at the real component, EN and HE — including with a
 * directory entry, which no longer brings anything back.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";

const harness = vi.hoisted(() => ({ locale: "en" as "en" | "he", pros: [] as unknown[] }));

vi.mock("../../services/professionals", () => ({
  get ARBOR_PROFESSIONALS() { return harness.pros; },
}));

vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({
    childProfile: { id: "c1", name: "Dylan", age: 5, languages: ["English"], schoolContext: "Gan", challenges: ["transitions"], strengths: ["curious"], interests: [] },
    behaviorLogs: [{ id: "l1", behaviorType: "Transition Refusal", intensity: 3, timestamp: new Date().toISOString() }],
    milestones: [],
    actionPlans: [],
    approvedMemoryItems: [],
    setActiveTab: vi.fn(),
    requestConsultPrefill: vi.fn(),
    pendingConsultPrefill: null,
    consumeConsultPrefill: vi.fn(),
  }),
}));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({
    uiLang: harness.locale,
    t: (key: string, vars?: Record<string, string | number>) => translate(harness.locale, key, vars),
  }),
}));
vi.mock("../../hooks/useChildCollection", () => ({
  useChildCollection: () => ({ items: [], loaded: true, upsert: vi.fn(), remove: vi.fn() }),
}));
vi.mock("../../lib/api", () => ({ authHeaders: async () => ({}) }));
vi.mock("../../lib/loopEvents", () => ({ trackShareInitiated: vi.fn(), trackShareCompleted: vi.fn() }));
vi.mock("../ui/Modal", () => ({ Modal: () => null }));

import AskSpecialist from "./AskSpecialist";

const STRINGS = ["Verified professionals", "אנשי מקצוע מאומתים"];

beforeEach(() => { harness.locale = "en"; harness.pros = []; });

describe("B-CAREPRO-19 — no directory rail or professional verb on Consult", () => {
  it("negative control: the shipped directory really is empty and the rail keys are gone", async () => {
    const real = await vi.importActual<typeof import("../../services/professionals")>("../../services/professionals");
    expect(real.ARBOR_PROFESSIONALS).toEqual([]);
    expect(translate("en", "care.pros.title")).toBe("care.pros.title");
    expect(translate("he", "care.pros.title")).toBe("care.pros.title");
  });

  for (const locale of ["en", "he"] as const) {
    it(`${locale}: the consult page renders the trusted-send verb and no directory heading`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<AskSpecialist />);
      // non-vacuity: the page really rendered its packet
      expect(html.length).toBeGreaterThan(2000);
      expect(html).toContain('data-testid="consult-send-trusted"');
      expect(html).not.toContain('data-testid="consult-send-pro"');
      for (const s of STRINGS) expect(html.includes(s), `${locale} DOM carries "${s}"`).toBe(false);
    });
  }

  it("a directory entry brings nothing back (the rail is deleted, not gated)", () => {
    harness.pros = [{ id: "p1", name: "Test Record", role: "OT", langs: "EN", mode: "Online", city: "", rating: 5, verified: true, tone: "mint" }];
    const html = renderToStaticMarkup(<AskSpecialist />);
    expect(html).not.toContain(STRINGS[0]);
    expect(html).not.toContain('data-testid="consult-send-pro"');
  });

  it("source: no rail, no Send modal, no door to #/find-pro", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const src = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "AskSpecialist.tsx"), "utf8");
    expect(src.length).toBeGreaterThan(5000);
    for (const gone of ["ProsRail", "hasDirectory", "FindProfessional", "setSendOpen", 'setActiveTab("find-pro")', "/api/professionals"]) {
      expect(src, gone).not.toContain(gone);
    }
    // NEGATIVE CONTROL: the pre-change mount is what the rule catches.
    expect("{hasDirectory && ProsRail}").toContain("ProsRail");
  });
});
