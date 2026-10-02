/**
 * B-CAREPRO-17 — rendered: after an export to the pediatrician, reopening
 * Consult shows "Since you last shared with the pediatrician (date)" with its
 * three counts in the on-screen packet and the verbatim preview. The teacher
 * branch is unaffected (no packet text at all), and a first visit shows none.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { recordExport } from "../../consult/exportHistory";

const harness = vi.hoisted(() => ({ locale: "en" as "en" | "he" }));

vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({
    childProfile: { id: "c1", name: "Dylan", age: 5, languages: ["English"], schoolContext: "Gan", challenges: [], strengths: ["curious"], interests: [] },
    behaviorLogs: [{ id: "l1", behaviorType: "Transition Refusal", intensity: 3, timestamp: new Date(Date.now() - 86_400_000).toISOString() }],
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
vi.mock("../../lib/loopEvents", () => ({ trackShareInitiated: vi.fn(), trackShareCompleted: vi.fn() }));
vi.mock("./Reports", () => ({ REPORTS: [], useReportExport: () => vi.fn(), useConsultPdf: () => vi.fn() }));

import AskSpecialist from "./AskSpecialist";

function installLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  } as Storage;
}

beforeEach(() => { harness.locale = "en"; });
afterEach(() => { delete (globalThis as unknown as { localStorage?: Storage }).localStorage; });

describe("B-CAREPRO-17 · Consult shows 'Since you last shared'", () => {
  it("first visit: no since section", () => {
    installLocalStorage({ "arbor.consultExportAudience": "pediatrician" });
    const html = renderToStaticMarkup(<AskSpecialist />);
    expect(html).toContain('data-testid="consult-export-preview"');
    expect(html).not.toContain("Since you last shared");
  });

  for (const locale of ["en", "he"] as const) {
    it(`${locale}: an earlier pediatrician export → the packet and the preview show the section with three counts`, () => {
      harness.locale = locale;
      installLocalStorage({ "arbor.consultExportAudience": "pediatrician" });
      recordExport("c1", "pediatrician", new Date(Date.now() - 5 * 86_400_000).toISOString());
      const html = renderToStaticMarkup(<AskSpecialist />);
      const heading = locale === "en" ? "Since you last shared with the pediatrician" : "מאז ששיתפתם בפעם האחרונה עם רופא/ת הילדים";
      const preview = /data-testid="consult-export-preview"[^>]*>([\s\S]*?)<\/pre>/.exec(html);
      expect(preview, "preview rendered").toBeTruthy();
      expect(preview![1]).toContain(heading);
      expect(preview![1]).toContain("1 new moment logged.");
      expect(preview![1]).toContain("0 action plans added.");
      expect(preview![1]).toContain("0 milestones newly noticed.");
    });
  }

  it("teacher: unaffected — the School Brief branch, no packet text", () => {
    installLocalStorage({ "arbor.consultExportAudience": "teacher" });
    recordExport("c1", "teacher", new Date(Date.now() - 5 * 86_400_000).toISOString());
    const html = renderToStaticMarkup(<AskSpecialist />);
    expect(html).toContain('data-testid="consult-teacher-branch"');
    expect(html).not.toContain("Since you last");
    expect(html).not.toContain('data-testid="consult-export-preview"');
  });
});
