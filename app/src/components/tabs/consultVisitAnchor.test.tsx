/**
 * W2-CAREPRO r2 — rendered Consult (EN + HE).
 *
 * P1 (product + design): the route's one stamp sits on a REAL act — "Build the
 * one-page summary" under step 1 — never on the already-selected chip; step 2
 * opens on record content on a first visit (a numerator-only sentence); the
 * "At home while you wait" disclosure has a visible chevron and no slab; at lg
 * the step-3 verbs are a sticky end column.
 * B-CAREPRO-NEW-2a: a visit 5 days ahead names the H1 and preselects step 1;
 * a visit 3 days past opens the one "What did they suggest?" loop.
 * B-CAREPRO-NEW-2b: the parent's latest words since the anchor head step 2
 * (parent-only; "Start my note from this" seeds the reason).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { nextPrepareVisit, visitAwaitingOutcome } from "../../lib/careTrack";

const DAY = 86_400_000;
const harness = vi.hoisted(() => ({
  locale: "en" as "en" | "he",
  appts: [] as unknown[],
  followUps: [] as unknown[],
}));

vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({
    childProfile: { id: "c1", name: "Dylan", age: 5, languages: ["English"], schoolContext: "Gan", challenges: [], strengths: ["curious"], interests: [] },
    activeTab: "consult",
    behaviorLogs: [
      { id: "l1", behaviorType: "Moment", intensity: 1, timestamp: new Date(Date.now() - 2 * DAY).toISOString(), notes: "He said 'big truck go' all the way to gan." },
      { id: "l2", behaviorType: "Transition Refusal", intensity: 3, timestamp: new Date(Date.now() - 4 * DAY).toISOString() },
    ],
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
  useChildCollection: (_id: string, name: string) => ({
    items: name === "appointments" ? harness.appts : name === "apptFollowUps" ? harness.followUps : [],
    loaded: true,
    upsert: vi.fn(),
    remove: vi.fn(),
  }),
}));
vi.mock("../../lib/loopEvents", () => ({ trackShareInitiated: vi.fn(), trackShareCompleted: vi.fn() }));
vi.mock("../sections/Reports", () => ({ REPORTS: [], useReportExport: () => vi.fn(), useConsultPdf: () => vi.fn() }));

import ConsultTab from "./ConsultTab";

const upcomingSlp = { id: "a1", who: "", role: "Speech therapist", profession: "slp", whenIso: new Date(Date.now() + 5 * DAY).toISOString(), when: "", mode: "In person", status: "confirmed" };
const pastPed = { id: "a0", who: "", role: "Pediatrician", profession: "pediatrician", whenIso: new Date(Date.now() - 3 * DAY).toISOString(), when: "", mode: "In person", status: "confirmed" };

function installLocalStorage() {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  } as Storage;
}

beforeEach(() => {
  harness.locale = "en";
  harness.appts = [];
  harness.followUps = [];
  installLocalStorage();
});

const h1Of = (html: string) => /<h1 data-testid="consult-h1"[^>]*>([^<]*)<\/h1>/.exec(html)![1];
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

describe("W2-CAREPRO r2 · the stamp is a real act", () => {
  it("exactly one stamp, on the 44 px Build button under step 1 — not on any audience chip", () => {
    const html = renderToStaticMarkup(<ConsultTab />);
    expect((html.match(/data-primary-move="/g) ?? []).length).toBe(1);
    const btn = /<button[^>]*data-testid="consult-build"[^>]*>/.exec(html)![0];
    expect(btn).toContain('data-primary-move="build-share-packet"');
    expect(btn).toContain("min-h-[44px]");
    const chips = html.slice(html.indexOf('data-testid="consult-audience-row"'), html.indexOf('data-testid="consult-build"'));
    expect(chips).not.toContain("data-primary-move");
    // the build button comes after the chips and before step 2
    expect(html.indexOf('data-testid="consult-build"')).toBeLessThan(html.indexOf('data-testid="consult-reason-section"'));
  });

  it("the step-3 target is addressable and focusable; at lg it is the sticky end column", () => {
    const html = renderToStaticMarkup(<ConsultTab />);
    const panes = html.slice(html.indexOf('data-testid="consult-panes"'), html.indexOf('data-testid="consult-panes"') + 200);
    expect(panes).toContain("lg:grid-cols-[minmax(0,1fr)_22rem]");
    const step3 = /<div id="consult-review-export" data-testid="consult-review-export" class="([^"]*)"/.exec(html)![1];
    expect(step3).toContain("lg:sticky");
    expect(html).toMatch(/id="consult-review-export"[^>]*>\s*<h2 tabindex="-1"/);
    // the gradient Copy lives in that column
    expect(html.indexOf('data-testid="consult-copy"')).toBeGreaterThan(html.indexOf('id="consult-review-export"'));
  });
});

describe("W2-CAREPRO r2 · step 2 opens on the record", () => {
  for (const locale of ["en", "he"] as const) {
    it(`${locale}: first visit → a numerator-only counts sentence heads step 2 (no %, no x-of-y)`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<ConsultTab />);
      const line = /<p data-testid="consult-since-counts"[^>]*>([^<]*)<\/p>/.exec(html)![1];
      expect(line).toContain(translate(locale, "elev.reports.line.momentsLogged.other", { n: 2 }));
      expect(line).not.toMatch(/%|\/\s*\d|\bof\b|מתוך/);
      expect(html.indexOf('data-testid="consult-since-head"')).toBeLessThan(html.indexOf('id="consult-reason"'));
    });

    it(`${locale}: B-CAREPRO-NEW-2b — the parent's latest words, quoted, with a seed link; the preview does not carry them`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<ConsultTab />);
      const fig = html.slice(html.indexOf('data-testid="consult-since-moment"'), html.indexOf("</figure>"));
      expect(decode(fig)).toContain("He said 'big truck go' all the way to gan.");
      expect(fig).toContain(translate(locale, "elev.carehonesty.consult.sinceMoment.seed"));
      expect(fig).toContain("var(--arbor-peach-soft)");
      expect(fig).toContain("<bdi");
      const preview = /data-testid="consult-export-preview"[^>]*>([\s\S]*?)<\/pre>/.exec(html)?.[1] ?? "";
      expect(decode(preview)).not.toContain("big truck go");
    });
  }

  it("the home disclosure: list-none summary with a rotating chevron; no sunk slab fill", () => {
    localStorage.setItem("arbor.consultExportAudience", "slp");
    const html = renderToStaticMarkup(<ConsultTab />);
    const tag = /<details data-testid="consult-home-practice"[^>]*>/.exec(html)![0];
    expect(tag).not.toContain("--arbor-paper-sunk");
    const summary = html.slice(html.indexOf('data-testid="consult-home-practice"'), html.indexOf("</summary>", html.indexOf('data-testid="consult-home-practice"')));
    expect(summary).toContain("list-none");
    expect(summary).toContain("expand_more");
    expect(summary).toContain("group-open:rotate-180");
  });
});

describe("B-CAREPRO-NEW-2a · Consult anchors on the next visit", () => {
  it("unit: nextPrepareVisit picks the open Prepare window; visitAwaitingOutcome the unanswered past visit", () => {
    const now = Date.now();
    expect(nextPrepareVisit([upcomingSlp, pastPed] as never, now)?.id).toBe("a1");
    expect(visitAwaitingOutcome([upcomingSlp, pastPed] as never, [], now)?.id).toBe("a0");
    expect(visitAwaitingOutcome([pastPed] as never, [{ id: "f1", apptId: "a0", note: "x", createdAt: "" }], now)).toBeNull();
    expect(visitAwaitingOutcome([{ ...pastPed, status: "done" }] as never, [], now)).toBeNull();
    expect(visitAwaitingOutcome([{ ...pastPed, whenIso: new Date(now - 30 * DAY).toISOString() }] as never, [], now)).toBeNull();
  });

  for (const locale of ["en", "he"] as const) {
    it(`${locale}: a visit 5 days ahead names the H1 and preselects the speech-therapist audience`, () => {
      harness.locale = locale;
      harness.appts = [upcomingSlp];
      const html = renderToStaticMarkup(<ConsultTab />);
      const h1 = decode(h1Of(html));
      expect(h1).toContain(translate(locale, "elev.careNet.appt.profession.slp"));
      expect(h1).not.toBe(translate(locale, "elev.consult.h1"));
      expect(html).toMatch(/role="radio" aria-checked="true"[^>]*>(?:<[^>]+>)*[^<]*?(?:<\/[^>]+>)*/);
      const checked = /aria-checked="true"[\s\S]*?<\/button>/.exec(html)![0];
      expect(decode(checked)).toContain(translate(locale, "elev.carehonesty.consult.audience.slp"));
      expect(html).not.toContain('data-testid="consult-visit-outcome"');
    });

    it(`${locale}: a visit 3 days past opens ONE 'What did they suggest?' line (no stamp of its own)`, () => {
      harness.locale = locale;
      harness.appts = [pastPed];
      const html = renderToStaticMarkup(<ConsultTab />);
      expect((html.match(/data-testid="consult-visit-outcome"/g) ?? []).length).toBe(1);
      const sec = html.slice(html.indexOf('data-testid="consult-visit-outcome"'), html.indexOf("</section>", html.indexOf('data-testid="consult-visit-outcome"')));
      expect(decode(sec)).toContain(translate(locale, "elev.careNet.appt.profession.pediatrician"));
      expect(sec).not.toContain("data-primary-move");
      expect(sec).toContain("min-h-11");
      expect(h1Of(html)).toBe(translate(locale, "elev.consult.h1"));
    });
  }

  it("no appointment: the H1 stays 'Prepare for a visit' and no loop renders", () => {
    const html = renderToStaticMarkup(<ConsultTab />);
    expect(h1Of(html)).toBe(translate("en", "elev.consult.h1"));
    expect(html).not.toContain('data-testid="consult-visit-outcome"');
  });
});
