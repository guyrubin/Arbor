/**
 * B-CAREPRO-42 — #/consult step 1: "therapist" splits into OT, PT and
 * psychology. Each preset renders as its own chip (one radio checked), opens
 * its profession's intake (the history questions it asks at a first visit,
 * EN + HE), and "therapist" stays as "Another clinician". Rendered at the real
 * component (the consultNoDirectory harness).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";

const harness = vi.hoisted(() => ({ locale: "en" as "en" | "he" }));

vi.mock("../../services/professionals", () => ({ ARBOR_PROFESSIONALS: [] }));
vi.mock("../../context/ArborContext", () => ({
  useArborOptional: () => null,
  useArbor: () => ({
    childProfile: { id: "c1", name: "Dylan", age: 5, languages: ["English"], schoolContext: "Gan", challenges: ["transitions"], strengths: ["curious"], interests: [] },
    behaviorLogs: [{ id: "l1", behaviorType: "Transition Refusal", intensity: 3, timestamp: new Date().toISOString() }],
    milestones: [],
    actionPlans: [],
    actionLoop: [],
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
import { SPLIT_CLINICIAN_AUDIENCES, SPLIT_CLINICIAN_PRESETS } from "../../content/consultPresets";

const row = (html: string) => {
  const at = html.indexOf('data-testid="consult-audience-row"');
  return html.slice(at, html.indexOf("</div>", at));
};
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/[⁨⁩]/g, "");

beforeEach(() => { harness.locale = "en"; });

describe("B-CAREPRO-42 · the split presets on #/consult", () => {
  for (const locale of ["en", "he"] as const) {
    it(`${locale}: three new chips; 'therapist' reads as another clinician; no intake list until one is chosen`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<AskSpecialist />);
      const r = plain(row(html));
      for (const p of SPLIT_CLINICIAN_AUDIENCES) {
        expect(r).toContain(`data-split-preset="${p}"`);
        expect(r).toContain(plain(translate(locale, SPLIT_CLINICIAN_PRESETS[p].labelKey)));
      }
      expect(r).toContain(plain(translate(locale, "elev.words.consult.preset.therapistOther")));
      expect(html).not.toContain('data-testid="consult-split-intake"');
    });

    for (const p of SPLIT_CLINICIAN_AUDIENCES) {
      it(`${locale}: the ${p} preset renders its intake — its chip alone is checked`, () => {
        harness.locale = locale;
        const html = plain(renderToStaticMarkup(<AskSpecialist intake={p} />));
        const r = row(html);
        expect(r.match(/aria-checked="true"/g)).toHaveLength(1);
        expect(r).toMatch(new RegExp(`aria-checked="true"[^>]*data-split-preset="${p}"`));
        const block = html.slice(html.indexOf('data-testid="consult-split-intake"'));
        expect(block).toContain(plain(translate(locale, "elev.words.consult.mayAsk")));
        for (const k of SPLIT_CLINICIAN_PRESETS[p].intakeQuestions) expect(block).toContain(plain(translate(locale, k, { name: "Dylan" })));
      });
    }
  }

  it("source: the split chips set the intake (B-LOOP-12 packet path); consult/packet.ts is untouched by this item", () => {
    const src = readFileSync(new URL("./AskSpecialist.tsx", import.meta.url), "utf8");
    expect(src).toContain("setIntake(p);");
    expect(src).toContain("SPLIT_CLINICIAN_PRESETS[split].intakeQuestions");
  });
});
