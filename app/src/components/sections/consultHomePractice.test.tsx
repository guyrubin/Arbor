/**
 * B-CAREPRO-20 — rendered: with the speech-therapist preset chosen, Consult's
 * step 2 shows a parent-only "At home while you wait" panel naming two worlds
 * (Sound Lab, Word World) in EN and HE, each a 44 px door. The recipient's
 * exact text (the verbatim preview) is unchanged and names no world; the panel
 * carries no count. Teacher and my-records show no panel.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";

const harness = vi.hoisted(() => ({ locale: "en" as "en" | "he" }));

vi.mock("../../context/ArborContext", () => ({
  // the Kid Mode entry seam reads the optional context; outside a provider it is null
  useArborOptional: () => null,
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

const render = (audience: string) => {
  installLocalStorage({ "arbor.consultExportAudience": audience });
  return renderToStaticMarkup(<AskSpecialist />);
};
const panelOf = (html: string) => /data-testid="consult-home-practice"[\s\S]*?(?=<section|<div data-testid="consult-review-export")/.exec(html)?.[0] ?? "";
const previewOf = (html: string) => /data-testid="consult-export-preview"[^>]*>([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "";

beforeEach(() => { harness.locale = "en"; });
afterEach(() => { delete (globalThis as unknown as { localStorage?: Storage }).localStorage; });

describe("B-CAREPRO-20 · Consult names the worlds that work the referred domain", () => {
  for (const locale of ["en", "he"] as const) {
    it(`${locale}: SLP → the panel names exactly two worlds; the preview names none`, () => {
      harness.locale = locale;
      const html = render("slp");
      const panel = panelOf(html);
      expect(panel, "panel rendered").not.toBe("");
      expect(panel).toContain(translate(locale, "elev.carehonesty.consult.home.title"));
      const names = locale === "en" ? ["Sound Lab", "Word World"] : ["מעבדת הצלילים", "עולם המילים"];
      for (const n of names) expect(panel).toContain(n);
      expect((panel.match(/data-testid="consult-home-world"/g) ?? []).length).toBe(2);
      expect((panel.match(/data-testid="consult-home-world"[^>]*class="[^"]*min-h-\[44px\]/g) ?? []).length).toBe(2);
      // names only: no count, no percentage in the panel
      expect(panel.slice(panel.indexOf(">") + 1).replace(/<[^>]+>/g, " ")).not.toMatch(/\d/);
      // exported text unchanged: the recipient preview never names a world
      const preview = previewOf(html);
      expect(preview, "preview rendered").not.toBe("");
      for (const n of names) expect(preview).not.toContain(n);
      expect(preview).not.toContain(translate(locale, "elev.carehonesty.consult.home.title"));
    });
  }

  it("the panel sits in step 2, before the packet card (outside what leaves)", () => {
    const html = render("slp");
    const panelAt = html.indexOf('data-testid="consult-home-practice"');
    expect(panelAt).toBeGreaterThan(html.indexOf('data-testid="consult-reason-section"'));
    expect(panelAt).toBeLessThan(html.indexOf('data-testid="consult-export-preview"'));
  });

  it("teacher and my-records: no panel", () => {
    expect(render("teacher")).not.toContain('data-testid="consult-home-practice"');
    expect(render("self")).not.toContain('data-testid="consult-home-practice"');
  });

  it("NEGATIVE CONTROL: the behaviour preset names its own worlds, not the speech ones", () => {
    const panel = panelOf(render("behavioral_health"));
    expect(panel).toContain("Mood Mountain");
    expect(panel).not.toContain("Sound Lab");
  });
});
