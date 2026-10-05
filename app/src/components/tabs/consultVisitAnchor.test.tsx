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
  logs: null as unknown[] | null,
}));

vi.mock("../../context/ArborContext", () => ({
  // the Kid Mode entry seam reads the optional context; outside a provider it is null
  useArborOptional: () => null,
  useArbor: () => ({
    childProfile: { id: "c1", name: "Dylan", age: 5, languages: ["English"], schoolContext: "Gan", challenges: [], strengths: ["curious"], interests: [] },
    activeTab: "consult",
    behaviorLogs: harness.logs ?? [
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
  harness.logs = null;
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
      const preview = /data-testid="consult-export-preview"[^>]*>([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "";
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

/* W2-CAREPRO c2 r1 — consult critics (product P1 G1 x4, design P1 G0/G1 x6). */
describe("W2-CAREPRO c2 r1 · a named anchor, the parent's words, step 3 reads first", () => {
  const donePed = { id: "a9", who: "", role: "Pediatrician", profession: "pediatrician", whenIso: new Date(Date.now() - 16 * DAY).toISOString(), when: "", mode: "In person", status: "done" };
  const note = { id: "f9", apptId: "a9", note: "Keep reading together in the evening and come back in six months.", createdAt: new Date(Date.now() - 16 * DAY).toISOString() };
  const decodeHtml = (x: string) => x.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

  for (const locale of ["en", "he"] as const) {
    it(`${locale}: a done visit with this audience's profession anchors step 2 — named, with what they said`, () => {
      harness.locale = locale;
      harness.appts = [donePed];
      harness.followUps = [note];
      localStorage.setItem("arbor.consultExportAudience", "pediatrician");
      const html = decodeHtml(renderToStaticMarkup(<ConsultTab />));
      expect(html).toContain('data-anchor="visit"');
      const line = /<p data-testid="consult-since-counts"[^>]*>([^<]*)<\/p>/.exec(html)![1];
      const prof = translate(locale, "elev.careNet.appt.profession.pediatrician");
      expect(line).toContain(locale === "en" ? prof.toLowerCase() : prof);
      expect(line).toContain(locale === "en" ? "visit on" : "מאז הביקור");
      expect(line).not.toMatch(/%|\bof\b|מתוך/);
      const fig = html.slice(html.indexOf('data-testid="consult-visit-note"'));
      expect(fig).toContain(note.note);
      expect(fig).toContain(translate(locale, "elev.carehonesty.consult.since.visitNote"));
    });

    it(`${locale}: no visit and no share → "since you started" on the record's first day; never a bare synthetic date`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<ConsultTab />);
      expect(html).toContain('data-anchor="start"');
      const line = /<p data-testid="consult-since-counts"[^>]*>([^<]*)<\/p>/.exec(html)![1];
      expect(line.startsWith(locale === "en" ? "Since you started on" : "מאז שהתחלתם")).toBe(true);
    });

    it(`${locale}: a capture-sheet moment (words in trigger, no notes) renders consult-since-moment`, async () => {
      harness.locale = locale;
      const { buildMomentLog } = await import("../../content/behaviorTaxonomy");
      const m = buildMomentLog(locale === "he" ? "שר לבד את כל שיר האמבטיה" : "Sang the whole bath song on his own", "Home", {}, new Date(Date.now() - DAY))!;
      harness.logs = [m];
      const html = renderToStaticMarkup(<ConsultTab />);
      const fig = html.slice(html.indexOf('data-testid="consult-since-moment"'), html.indexOf("</figure>", html.indexOf('data-testid="consult-since-moment"')));
      expect(fig).toContain(m.trigger);
    });

    it(`${locale}: step 3 = the verbatim preview, then the 44 px reviewed toggle, then Copy · PDF · Send; nothing previewed in step 2`, () => {
      harness.locale = locale;
      localStorage.setItem("arbor.consultExportAudience", "pediatrician");
      const html = renderToStaticMarkup(<ConsultTab />);
      const step3 = html.indexOf('id="consult-review-export"');
      const preview = html.indexOf('data-testid="consult-preview"');
      const reviewed = html.indexOf('data-testid="consult-reviewed"');
      const copy = html.indexOf('data-testid="consult-copy"');
      expect(step3).toBeGreaterThan(0);
      expect(preview).toBeGreaterThan(step3);
      expect(reviewed).toBeGreaterThan(preview);
      expect(copy).toBeGreaterThan(reviewed);
      expect(html).not.toMatch(/<input[^>]*type="checkbox"/);
      const toggle = html.slice(reviewed, html.indexOf("</button>", reviewed));
      expect(toggle).toContain('aria-pressed="false"');
      expect(toggle).toContain("w-11 h-11");
      expect(html).toContain("lg:top-[var(--sticky-offset)]");
    });

    it(`${locale}: the preview is clean plain text, one block per line in the reader's direction`, () => {
      harness.locale = locale;
      localStorage.setItem("arbor.consultExportAudience", "pediatrician");
      const html = renderToStaticMarkup(<ConsultTab />);
      const body = /data-testid="consult-export-preview"[^>]*>([\s\S]*?)<\/div>/.exec(html)![1];
      const lines = [...body.matchAll(/<p data-line-role="(\w+)" dir="(\w+)"[^>]*>([^<]*)<\/p>/g)];
      expect(lines.length).toBeGreaterThan(6);
      expect(lines[0][1]).toBe("title");
      for (const [, , dir, text] of lines) {
        expect(dir).toBe(locale === "he" ? "rtl" : "ltr");
        expect(text).not.toMatch(/^#|\*\*|^_|_$/);
      }
      expect(lines.some(([, role, , text]) => role === "item" && text.startsWith("• "))).toBe(true);
    });

    it(`${locale}: ONE gradient — Build carries it (the stamp); Copy is a solid clay secondary`, () => {
      harness.locale = locale;
      localStorage.setItem("arbor.consultExportAudience", "pediatrician");
      const html = renderToStaticMarkup(<ConsultTab />);
      const build = html.slice(html.lastIndexOf("<button", html.indexOf('data-testid="consult-build"')), html.indexOf("</button>", html.indexOf('data-testid="consult-build"')));
      expect(build).toContain("background:var(--gradient-cta)");
      expect(build).toContain("w-full sm:w-auto");
      const copy = html.slice(html.lastIndexOf("<button", html.indexOf('data-testid="consult-copy"')), html.indexOf("</button>", html.indexOf('data-testid="consult-copy"')));
      expect(copy).toContain("background:var(--arbor-clay)");
      expect((html.match(/gradient-cta|arbor-gradient-primary/g) ?? []).length).toBe(1);
    });
  }

  it("exportPlainLines: Markdown scaffold → plain lines with roles (NEGATIVE CONTROL: the raw Markdown trips the scan)", async () => {
    const { exportPlainLines, exportPlainText } = await import("../../consult/plainText");
    const md = "# Dylan — context\n_Prepared 2026-10-05_\n**Demo family — invented data**\n\n## About Dylan\n- Dylan, 3 years.\n\n## Parent note\n\nHe sleeps better.\n";
    expect(/^#|\*\*|^_/m.test(md)).toBe(true);
    const lines = exportPlainLines(md);
    expect(lines.map((l) => l.role)).toEqual(["title", "note", "note", "blank", "head", "item", "blank", "head", "blank", "body"]);
    const text = exportPlainText(md);
    expect(/^#|\*\*|^_/m.test(text)).toBe(false);
    expect(text).toContain("• Dylan, 3 years.");
  });
});

/* W2-CAREPRO c2 r2 — ONE egress set (consult · product P1 G1). The card the
 * parent curates, the step-3 count and the export all read the SAME
 * audience-capped packet: a row the parent toggles is a row that can leave. */
describe("W2-CAREPRO c2 r2 · one egress set per audience", () => {
  const incidentLogs = () => [
    { id: "m1", behaviorType: "Moment", intensity: 1, timestamp: new Date(Date.now() - 2 * DAY).toISOString(), notes: "He said 'big truck go' all the way to gan.", trigger: "big truck go" },
    { id: "t1", behaviorType: "Transition Refusal", intensity: 3, timestamp: new Date(Date.now() - 4 * DAY).toISOString(), trigger: "Leaving the park" },
    { id: "t2", behaviorType: "Transition Refusal", intensity: 3, timestamp: new Date(Date.now() - 5 * DAY).toISOString(), trigger: "Leaving the park" },
  ];
  const rows = (html: string) => (html.match(/data-testid="consult-packet-item"/g) ?? []).length;
  const bullets = (html: string) => {
    const body = /data-testid="consult-export-preview"[^>]*>([\s\S]*?)<\/div>/.exec(html)![1];
    return [...body.matchAll(/<p data-line-role="item"[^>]*>([^<]*)<\/p>/g)].map((m) => decode(m[1]));
  };
  const selected = (html: string, locale: "en" | "he") => {
    const n = /(\d+)/.exec(decode(html.slice(html.indexOf('aria-live="polite"'), html.indexOf("</span>", html.indexOf('aria-live="polite"')))))![1];
    expect(decode(html)).toContain(translate(locale, "consult.selected", { n }));
    return Number(n);
  };

  for (const locale of ["en", "he"] as const) {
    for (const audience of ["pediatrician", "slp", "behavioral_health", "therapist"] as const) {
      it(`${locale} · ${audience}: rendered rows = exported bullets = the step-3 count`, () => {
        harness.locale = locale;
        harness.logs = incidentLogs();
        localStorage.setItem("arbor.consultExportAudience", audience);
        const html = renderToStaticMarkup(<ConsultTab />);
        const n = rows(html);
        expect(n).toBeGreaterThan(0);
        expect(bullets(html).length).toBe(n);
        expect(selected(html, locale)).toBe(n);
      });
    }

    it(`${locale}: NEGATIVE CONTROL — Pediatrician renders no 'What we noticed came first' row; Behavioral health does`, () => {
      harness.locale = locale;
      harness.logs = incidentLogs();
      const triggerTitle = translate(locale, "elev.packet.section.triggers");
      localStorage.setItem("arbor.consultExportAudience", "pediatrician");
      const ped = decode(renderToStaticMarkup(<ConsultTab />));
      localStorage.setItem("arbor.consultExportAudience", "behavioral_health");
      const bh = decode(renderToStaticMarkup(<ConsultTab />));
      expect(bh).toContain("Leaving the park");
      expect(ped).not.toContain("Leaving the park");
      if (!triggerTitle.startsWith("elev.")) {
        expect(bh).toContain(triggerTitle);
        expect(ped).not.toContain(triggerTitle);
      }
      expect(rows(bh)).toBe(rows(ped) + 1);
    });
  }

  it("presetPacket caps clinicians to their preset; self and teacher keep the whole card", async () => {
    const { presetPacket, CONSULT_PRESETS } = await import("../../consult/packet");
    const packet = { sections: ["about", "triggers", "language-observations", "growth-measurements"].map((id) => ({ id, title: id, items: [{ id: `${id}-0`, text: id }] })) } as never;
    for (const a of ["pediatrician", "slp", "behavioral_health", "therapist"] as const) {
      const ids = presetPacket(a, packet).sections.map((s) => s.id);
      for (const id of ids) expect(CONSULT_PRESETS[a].sections).toContain(id);
    }
    expect(presetPacket("pediatrician", packet).sections.map((s) => s.id)).toEqual(["about", "growth-measurements"]);
    expect(presetPacket("self", packet).sections).toHaveLength(4);
  });

  it("design P1: the lg step-3 column is a fixed frame — no column-level scroll; only the preview scrolls", () => {
    localStorage.setItem("arbor.consultExportAudience", "pediatrician");
    const html = renderToStaticMarkup(<ConsultTab />);
    const step3 = /<div id="consult-review-export" data-testid="consult-review-export" class="([^"]*)"/.exec(html)![1];
    expect(step3).not.toContain("overflow-y-auto");
    expect(step3).toContain("lg:max-h-[calc(100dvh-var(--shell-topbar-h)-var(--sticky-offset)-1rem)]");
    const preview = /<section data-testid="consult-preview"[^>]*class="([^"]*)"/.exec(html)![1];
    expect(preview).toContain("lg:overflow-y-auto");
    expect(preview).toContain("lg:max-h-[min(26rem,50dvh)]");
    // the verbs follow the scrolling preview, outside it
    const previewEnd = html.indexOf("</section>", html.indexOf('data-testid="consult-preview"'));
    expect(html.indexOf('data-testid="consult-copy"')).toBeGreaterThan(previewEnd);
    expect(html.indexOf('data-testid="consult-reviewed"')).toBeGreaterThan(previewEnd);
  });
});
