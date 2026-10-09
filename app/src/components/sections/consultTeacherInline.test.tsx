/**
 * B-CAREPRO-36 (closure) — rendered: "Prepare for a visit" with the teacher
 * preset shows the School Brief editor INLINE (the parent never leaves the
 * page), under the page's one H1, carrying the route's ONE primary-move stamp
 * on the brief's "Save as PDF". #/school-brief is this page with the teacher
 * preselected (ConsultTab; source facts in lib/careRows.test.ts). The brief's
 * own fail-closed export path is unchanged (schoolBriefEgress.test.ts,
 * schoolBrief/schoolBrief.test.ts). EN + HE.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";

const harness = vi.hoisted(() => ({ locale: "en" as "en" | "he" }));

vi.mock("../../context/ArborContext", () => ({
  useArborOptional: () => null,
  useArbor: () => ({
    childProfile: { id: "c1", name: "Dylan", age: 5, languages: ["English"], schoolContext: "Gan Shaked", challenges: [], strengths: ["Builds towers"], interests: [] },
    behaviorLogs: [],
    milestones: [],
    actionPlans: [],
    approvedMemoryItems: [],
    setActiveTab: vi.fn(),
    openPaywall: vi.fn(),
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
vi.mock("../ui/Modal", () => ({ Modal: () => null }));

import AskSpecialist from "./AskSpecialist";
import SchoolBrief from "./SchoolBrief";

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

const stamps = (html: string) => [...html.matchAll(/data-primary-move="([^"]+)"/g)].map((m) => m[1]);

beforeEach(() => { harness.locale = "en"; installLocalStorage(); });
afterEach(() => { delete (globalThis as unknown as { localStorage?: Storage }).localStorage; });

describe("B-CAREPRO-36 · the teacher preset shows the School Brief editor inline", () => {
  for (const locale of ["en", "he"] as const) {
    it(`${locale}: teacher → the brief draft and its actions render on the page, under the teacher line, with no second H1`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<AskSpecialist anchorAudience="teacher" primaryMoveStamp={{ "data-primary-move": "build-share-packet" }} />);
      const branch = html.indexOf('data-testid="consult-teacher-branch"');
      expect(branch).toBeGreaterThan(-1);
      expect(html.indexOf('data-module="brief-draft"')).toBeGreaterThan(branch);
      expect(html.indexOf('data-testid="school-brief-actions"')).toBeGreaterThan(branch);
      // the page's teacher line leads the branch; the editor brings no header
      expect(html).toContain(translate(locale, "elev.carehonesty.consult.teacher.title", { name: "Dylan" }).replace(/'/g, "&#x27;"));
      expect(html).not.toMatch(/<h1[\s>]/);
      expect(html).not.toContain(translate(locale, "schoolBrief.subtitle", { name: "Dylan" }).replace(/'/g, "&#x27;"));
      // the draft is the teacher preset's (setting + strengths), built on the device
      expect(html).toContain(locale === "he" ? "Gan Shaked" : "Setting: Gan Shaked.");
      expect(html).toContain("Builds towers");
      // no packet text and no packet verbs for a teacher; the old "Open" door is gone
      expect(html).not.toContain('data-testid="consult-export-preview"');
      expect(html).not.toContain('data-testid="consult-build"');
      expect(html).not.toContain('data-testid="consult-teacher-open"');
    });
  }

  it("ONE primary-move stamp in the DOM, carrying the HOST route's move, on the brief's Save as PDF", () => {
    for (const move of ["build-share-packet", "build-school-brief", "copy-handoff-brief"]) {
      const html = renderToStaticMarkup(<AskSpecialist anchorAudience="teacher" primaryMoveStamp={{ "data-primary-move": move }} />);
      expect(stamps(html), move).toEqual([move]);
      const actions = html.slice(html.indexOf('data-testid="school-brief-actions"'), html.indexOf('data-module="brief-draft"'));
      expect(actions).toContain(`data-primary-move="${move}"`);
    }
  });

  it("NEGATIVE CONTROL: a clinician preset renders the packet flow, never the brief", () => {
    const html = renderToStaticMarkup(<AskSpecialist anchorAudience="pediatrician" primaryMoveStamp={{ "data-primary-move": "build-share-packet" }} />);
    expect(html).not.toContain('data-module="brief-draft"');
    expect(html).not.toContain('data-testid="consult-teacher-branch"');
    expect(html).toContain('data-testid="consult-reason-section"');
    expect(html).toContain('data-testid="consult-build"');
    expect(stamps(html)).toEqual(["build-share-packet"]);
  });
});

describe("B-CAREPRO-36 · the embedded editor", () => {
  it("the parent's note for the teacher goes into the draft the parent reviews (EN + HE)", () => {
    for (const locale of ["en", "he"] as const) {
      harness.locale = locale;
      const html = renderToStaticMarkup(<SchoolBrief embedded teacherNote="  Loves trains, use them for transitions.  " />);
      expect(html).toContain("Loves trains, use them for transitions.");
      expect(html).not.toContain("  Loves trains");
    }
  });

  it("embedded: no header of its own; standalone keeps its H1 and its own move", () => {
    const embedded = renderToStaticMarkup(<SchoolBrief embedded primaryMove="build-share-packet" />);
    expect(embedded).not.toContain("<header");
    expect(stamps(embedded)).toEqual(["build-share-packet"]);
    const standalone = renderToStaticMarkup(<SchoolBrief />);
    expect(standalone).toMatch(/<h1[\s>]/);
    expect(stamps(standalone)).toEqual(["build-school-brief"]);
  });

  it("a blank note adds nothing to the draft", () => {
    const withBlank = renderToStaticMarkup(<SchoolBrief embedded teacherNote="   " />);
    const without = renderToStaticMarkup(<SchoolBrief embedded />);
    expect(withBlank).toBe(without);
  });
});
