/**
 * B-CAREPRO-04 — "Verified professionals" never renders over an empty
 * directory. `ARBOR_PROFESSIONALS` is `[]` and the API adds nothing, so the
 * rail's heading claimed a staffed human-expert layer that does not exist
 * (CARE-4 claim gate). Rendered at the real component, EN and HE.
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
    pendingConsultNote: null,
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
vi.mock("./FindProfessional", () => ({ default: () => null }));
vi.mock("../ui/Modal", () => ({ Modal: () => null }));
vi.mock("./Reports", async () => {
  const REPORTS = [
    { title: "Therapist Summary", desc: "", titleKey: "elev.reports.therapist.title", descKey: "", tone: "lav", type: "therapist" },
  ];
  return { REPORTS, CONSULT_MENU_REPORTS: REPORTS, useReportExport: () => vi.fn() };
});

import AskSpecialist from "./AskSpecialist";

const STRINGS = ["Verified professionals", "אנשי מקצוע מאומתים"];

beforeEach(() => { harness.locale = "en"; harness.pros = []; });

describe("B-CAREPRO-04 — no 'Verified professionals' over an empty directory", () => {
  it("negative control: the shipped directory really is empty and the strings are the real keys", async () => {
    const real = await vi.importActual<typeof import("../../services/professionals")>("../../services/professionals");
    expect(real.ARBOR_PROFESSIONALS).toEqual([]);
    expect(translate("en", "care.pros.title")).toBe(STRINGS[0]);
    expect(translate("he", "care.pros.title")).toBe(STRINGS[1]);
  });

  for (const locale of ["en", "he"] as const) {
    it(`${locale}: the consult page renders, with zero occurrences of either heading`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<AskSpecialist />);
      // non-vacuity: the page really rendered its packet
      expect(html.length).toBeGreaterThan(2000);
      expect(html).toContain('data-testid="consult-send-trusted"');
      for (const s of STRINGS) expect(html.includes(s), `${locale} DOM carries "${s}"`).toBe(false);
    });
  }

  it("POSITIVE CONTROL: with one verified entry the rail and its heading return", () => {
    harness.pros = [{ id: "p1", name: "Dr. Test", role: "OT", langs: "EN", mode: "Online", city: "", rating: 5, verified: true, tone: "mint" }];
    const html = renderToStaticMarkup(<AskSpecialist />);
    expect(html).toContain(STRINGS[0]);
    expect(html).toContain('data-testid="consult-send-pro"');
  });

  it("the rail mount is gated on hasDirectory (source)", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const src = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "AskSpecialist.tsx"), "utf8");
    expect(src).toContain("{hasDirectory && ProsRail}");
    expect(src).not.toMatch(/^\s*\{ProsRail\}\s*$/m);
  });
});
