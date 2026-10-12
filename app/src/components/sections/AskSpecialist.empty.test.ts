/* LC-06 — the consult empty state actually mounts for a day-0 record.
 *
 * Pre-fix, `isEmpty = packet.sections.length === 0` could never be true (the
 * packet always carries "about"), so a new profile saw a one-line packet with
 * a live export bar. This renders the REAL AskSpecialist (static markup, node
 * env) with the app contexts stubbed: a profile-only record must mount the
 * `consult.empty.*` state and NO packet rows / export verbs; one logged moment
 * (negative control) must mount the packet rows + the export verbs.
 * B-CAREPRO-28: step 1 (who it is for) renders in both — choosing the
 * audience comes before the record, and a teacher brief needs no moments.
 * v3 F-CARE-1: the landing's stepper keeps Share shut on an empty record and
 * never prints a denominator (block at the end). r2 (review r1): the
 * milestone lines are read through the REAL EN and HE dictionaries with seen,
 * not-yet and not-sure milestones seeded; an empty record keeps the way to
 * the whole record. */

import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { translate } from "../../lib/i18n";

// r2: null = the key-echo t the LC-06 cases read; "en"/"he" = the real dictionary
const lang = vi.hoisted(() => ({ real: null as null | "en" | "he" }));

const record = {
  childProfile: { id: "c1", name: "Noa Levi", age: 4, languages: ["Hebrew"], schoolContext: "", strengths: [], challenges: [] },
  behaviorLogs: [] as Array<{ behaviorType: string; intensity: number; timestamp: string; resolved?: boolean }>,
  milestones: [] as Array<{ id?: string; domain: string; title: string; checked: boolean; observationStatus?: "yes" | "not_sure" | "not_yet" }>,
  actionPlans: [] as Array<{ title: string; issue?: string }>,
  approvedMemoryItems: [] as Array<{ fact: string; status: string }>,
  setActiveTab: vi.fn(),
  pendingConsultPrefill: null,
  consumeConsultPrefill: vi.fn(),
};

vi.mock("../../context/ArborContext", () => ({ useArbor: () => record, useArborOptional: () => null }));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({
    t: (k: string, v?: Record<string, string | number>) => (lang.real ? translate(lang.real, k, v) : k),
    uiLang: lang.real ?? "en",
  }),
}));
vi.mock("./Reports", () => ({ REPORTS: [], useReportExport: () => vi.fn(), useConsultPdf: () => vi.fn() }));
vi.mock("../ui/Modal", () => ({ Modal: () => null, default: () => null }));
vi.mock("../../lib/api", () => ({ authHeaders: async () => ({}) }));
vi.mock("../../lib/loopEvents", () => ({ trackShareInitiated: vi.fn(), trackShareCompleted: vi.fn() }));
vi.mock("../../services/professionals", () => ({ ARBOR_PROFESSIONALS: [] }));
// LC-20: the surface now reads the parent's prepared questions and the
// discipline-specific evidence sinks. Stub the collection hook (it needs the
// auth/profile providers this static render deliberately does without).
vi.mock("../../hooks/useChildCollection", () => ({
  useChildCollection: () => ({ items: [], loaded: true, error: false, remote: false, upsert: vi.fn(), remove: vi.fn(), replaceAll: vi.fn() }),
}));

describe("LC-06 — AskSpecialist empty state", () => {
  it("a profile-only record mounts the empty state and no export bar", async () => {
    const { default: AskSpecialist } = await import("./AskSpecialist");
    const html = renderToStaticMarkup(React.createElement(AskSpecialist));
    expect(html).toContain("consult.empty.title");
    expect(html).toContain("consult.empty.cta");
    expect(html).not.toContain('data-testid="consult-packet-item"');
    expect(html).not.toContain('data-testid="consult-copy"');
    expect(html).toContain('role="radiogroup"');
  });

  it("NEGATIVE CONTROL: one logged moment mounts the packet rows + the audience step instead", async () => {
    record.behaviorLogs = [{ behaviorType: "Transition Refusal", intensity: 3, timestamp: new Date().toISOString() }];
    const { default: AskSpecialist } = await import("./AskSpecialist");
    const html = renderToStaticMarkup(React.createElement(AskSpecialist));
    expect(html).not.toContain("consult.empty.title");
    expect(html).toContain('data-testid="consult-packet-item"');
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('data-testid="consult-copy"');
    expect(html).toContain("elev.carehonesty.consult.preview.toggle");
    record.behaviorLogs = [];
  });
});

/* v3 F-CARE-1 — on the Care landing the three steps are a stepper. With
 * nothing to share, "Share" stays shut and there is no way on; a step is a
 * place to go, never "n of m" or a bar. Counts only: no denominator anywhere
 * in the rendered text (the keys carry no digits, so any "of 3" or "/3" would
 * come from code). */
describe("v3 F-CARE-1 — the landing stepper is numerator-only", () => {
  const visibleText = (html: string) => html.replace(/<[^>]+>/g, " ");
  const DENOMINATOR = /\bof\s+\d|\d\s*\/\s*\d|\/\s*\d|מתוך/;
  const tabsOf = (html: string): string[] => html.match(/<button[^>]*data-testid="consult-step"[^>]*>/g) ?? [];

  it("an empty record: three tabs, step 1 open, Share disabled, no Next, no 'of N' or '/N'", async () => {
    const { default: AskSpecialist } = await import("./AskSpecialist");
    const html = renderToStaticMarkup(React.createElement(AskSpecialist, { landing: true }));
    const tabs = tabsOf(html);
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toContain('aria-current="step"');
    expect(tabs[2]).toMatch(/\sdisabled=""/);
    expect(html).toContain("consult.empty.title");
    expect(html).not.toContain('data-testid="consult-next"');
    expect(html).not.toContain('data-testid="consult-copy"');
    // r2: a new family keeps the way to the whole record (#/reports), after "Log a moment"
    expect(html.indexOf('data-testid="consult-full-record"')).toBeGreaterThan(html.indexOf('data-testid="consult-empty-cta"'));
    expect(html.indexOf('data-testid="consult-empty-cta"')).toBeGreaterThan(0);
    expect(visibleText(html)).not.toMatch(DENOMINATOR);
    expect(html).not.toMatch(/role="progressbar"|<progress\b/);
  });

  it("NEGATIVE CONTROL: one logged moment opens Share and Next, still with no denominator", async () => {
    record.behaviorLogs = [{ behaviorType: "Transition Refusal", intensity: 3, timestamp: new Date().toISOString() }];
    const { default: AskSpecialist } = await import("./AskSpecialist");
    const html = renderToStaticMarkup(React.createElement(AskSpecialist, { landing: true }));
    const tabs = tabsOf(html);
    expect(tabs).toHaveLength(3);
    expect(tabs[2]).not.toMatch(/\sdisabled=""/);
    expect(html).toContain('data-testid="consult-next"');
    expect(html).toContain('data-testid="consult-copy"');
    expect(visibleText(html)).not.toMatch(DENOMINATOR);
    record.behaviorLogs = [];
  });

  const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  for (const locale of ["en", "he"] as const) {
    it(`${locale} (real dictionary): the milestone lines are counts (seen, not sure), never a denominator; "not yet" is never listed`, async () => {
      lang.real = locale;
      // invented milestones: two seen, one not yet, one not sure
      record.milestones = [
        { id: "ms1", domain: "language_communication", title: "Names favourite toys", checked: true, observationStatus: "yes" },
        { id: "ms2", domain: "sensory_motor_patterns", title: "Hops on one foot", checked: true, observationStatus: "yes" },
        { id: "ms3", domain: "social_development", title: "Takes turns in a game", checked: false, observationStatus: "not_yet" },
        { id: "ms4", domain: "cognition_executive_function", title: "Sorts blocks by colour", checked: false, observationStatus: "not_sure" },
      ];
      try {
        const { default: AskSpecialist } = await import("./AskSpecialist");
        const html = renderToStaticMarkup(React.createElement(AskSpecialist, { landing: true }));
        const at = html.indexOf('data-testid="consult-export-preview"');
        expect(at).toBeGreaterThan(0);
        const lines = [...html.slice(at).matchAll(/<p[^>]*data-line-role="[^"]*"[^>]*>([\s\S]*?)<\/p>/g)]
          .map((m) => decode(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim());
        const noticed = translate(locale, "elev.packet.item.devNoticed", { n: 2 });
        const observed = `${translate(locale, "elev.packet.item.observed")} (2):`;
        const notSure = `${translate(locale, "elev.packet.item.notSure")} (1):`;
        const milestoneLines = lines.filter((l) => l.includes(noticed) || l.includes(observed) || l.includes(notSure));
        expect(milestoneLines).toHaveLength(3);
        expect(milestoneLines.some((l) => l.includes(noticed))).toBe(true);
        expect(milestoneLines.some((l) => l.includes(observed) && l.includes("Names favourite toys") && l.includes("Hops on one foot"))).toBe(true);
        expect(milestoneLines.some((l) => l.includes(notSure) && l.includes("Sorts blocks by colour"))).toBe(true);
        for (const l of milestoneLines) {
          // the reviewer's pattern, then this block's wider one
          expect(l).not.toMatch(/\bof\s+\d|\/\d|מתוך/);
          expect(l).not.toMatch(DENOMINATOR);
          expect(l).not.toContain("%");
        }
        // the parent's "not yet" is never listed, anywhere on the page
        expect(html).not.toContain("Takes turns in a game");
      } finally {
        lang.real = null;
        record.milestones = [];
      }
    });
  }
});
