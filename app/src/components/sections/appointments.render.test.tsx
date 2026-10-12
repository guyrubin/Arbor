/**
 * W2-CAREPRO r2 — rendered Appointments (EN + HE).
 *
 * The sweep fixture has no visit, so two rounds never saw the lifecycle. This
 * renders it from a seeded record: an upcoming speech-therapy visit 5 days out
 * (row, Prepare door) and a past visit 3 days ago (follow-up capture). Plus the
 * r2 design fixes: PageHeader is flush in the gap-6 column, the Add CTA never
 * wraps, the demoted disclosure reads quieter than "Upcoming", and the empty
 * state starts the lifecycle with one-tap profession chips (B-CAREPRO-NEW-2g).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";

const DAY = 86_400_000;
const harness = vi.hoisted(() => ({ locale: "en" as "en" | "he", appts: [] as unknown[], logs: [] as unknown[] }));

vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({ childProfile: { id: "c1", name: "Dylan" }, setActiveTab: vi.fn(), requestConsultPrefill: vi.fn(), behaviorLogs: harness.logs }),
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
    items: name === "appointments" ? harness.appts : [],
    loaded: true,
    upsert: vi.fn(),
    remove: vi.fn(),
  }),
}));

import Appointments from "./Appointments";

const seeded = () => [
  { id: "a1", who: "", role: "Speech therapist", profession: "slp", whenIso: new Date(Date.now() + 5 * DAY).toISOString(), when: "", mode: "In person", status: "confirmed" },
  { id: "a0", who: "", role: "Pediatrician", profession: "pediatrician", whenIso: new Date(Date.now() - 3 * DAY).toISOString(), when: "", mode: "In person", status: "confirmed" },
];

beforeEach(() => { harness.locale = "en"; harness.appts = []; harness.logs = []; });

describe("W2-CAREPRO r2 · the visit lifecycle renders from a seeded record", () => {
  for (const locale of ["en", "he"] as const) {
    it(`${locale}: upcoming row with its profession + a Prepare door; the past visit offers the follow-up capture`, () => {
      harness.locale = locale;
      harness.appts = seeded();
      const html = renderToStaticMarkup(<Appointments />);
      expect(html).toContain(translate(locale, "elev.careNet.appt.profession.slp"));
      expect((html.match(/data-testid="appt-prepare"/g) ?? []).length).toBe(1);
      expect(html).toContain('data-testid="appt-followup-input"');
      expect(html).not.toContain('data-testid="appt-empty-lifecycle"');
      expect((html.match(/data-primary-move="/g) ?? []).length).toBe(1);
    });
  }
});

describe("W2-CAREPRO r2 · one rhythm, a one-line CTA, a quiet disclosure", () => {
  it("PageHeader is flush (no mb-7 stacked on the column's gap-6)", () => {
    const html = renderToStaticMarkup(<Appointments />);
    const header = /<div class="([^"]*)"><div><h1/.exec(html)![1];
    expect(header).not.toContain("mb-7");
    expect(html).toContain("flex flex-col gap-6");
  });

  it("the Add CTA never wraps", () => {
    const tag = /<button[^>]*data-primary-move="add-appointment"[^>]*>/.exec(renderToStaticMarkup(<Appointments />))![0];
    expect(tag).toContain("whitespace-nowrap");
    expect(tag).toContain("flex-shrink-0");
  });

  for (const locale of ["en", "he"] as const) {
    it(`${locale}: the demoted title is body t-base bold (not t-md extrabold); the sub is one line`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<Appointments />);
      const tag = /<span data-testid="appt-more-title" class="([^"]*)"/.exec(html)![1];
      expect(tag).toContain("t-base");
      expect(tag).not.toMatch(/t-md|extrabold/);
      expect(translate(locale, "elev.learnCare.appt.more.sub").length).toBeLessThan(30);
    });
  }
});

describe("B-CAREPRO-NEW-2g · the empty state starts the lifecycle", () => {
  for (const locale of ["en", "he"] as const) {
    it(`${locale}: "Who does Dylan see?" + six 44 px profession chips; the header Add keeps the one stamp`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<Appointments />);
      expect(html).toContain(translate(locale, "elev.learnCare.appt.whoSees", { name: "Dylan" }).replace(/'/g, "&#x27;"));
      const chips = html.slice(html.indexOf('data-testid="appt-empty-professions"'));
      expect((chips.match(/data-profession="/g) ?? []).length).toBe(6);
      expect(chips).toContain(translate(locale, "elev.careNet.appt.profession.slp"));
      expect(chips.slice(0, chips.indexOf("</div>"))).toContain("min-h-[44px]");
      expect((html.match(/data-primary-move="/g) ?? []).length).toBe(1);
      expect(translate(locale, "elev.learnCare.appt.whoSees", { name: "Dylan" })).not.toMatch(/\//);
    });
  }
});

describe("B-CAREPRO-NEW-2h · worth bringing to the next visit", () => {
  it("unit: the newest note wins; one already asked is skipped; none → null", async () => {
    const { latestParentNote } = await import("./Appointments");
    const logs = [
      { timestamp: "2026-09-10T10:00:00Z", notes: "Older note" },
      { timestamp: "2026-09-12T10:00:00Z", notes: "Shoes are where it shows" },
      { timestamp: "2026-09-13T10:00:00Z" },
    ];
    expect(latestParentNote(logs, [])?.text).toBe("Shoes are where it shows");
    expect(latestParentNote(logs, [{ text: "Shoes are where it shows" }])?.text).toBe("Older note");
    expect(latestParentNote([{ timestamp: "2026-09-13T10:00:00Z" }], [])).toBeNull();
  });

  for (const locale of ["en", "he"] as const) {
    it(`${locale}: the well quotes the parent's words under Upcoming (empty and booked), with a 44 px 'Add to my questions'`, () => {
      harness.locale = locale;
      harness.logs = [{ id: "l1", timestamp: new Date(Date.now() - 2 * DAY).toISOString(), behaviorType: "Moment", notes: "Shoes are where it shows" }];
      for (const appts of [[], seeded()]) {
        harness.appts = appts;
        const html = renderToStaticMarkup(<Appointments />);
        const well = html.slice(html.indexOf('data-testid="appt-worth-bringing"'), html.indexOf("</figure>"));
        expect(well).toContain("Shoes are where it shows");
        expect(well).toContain('dir="auto"');
        expect(well).toContain("var(--arbor-paper-deep)");
        expect(well).toContain(translate(locale, "elev.learnCare.appt.worth.add"));
        expect(well).toContain("min-h-[44px]");
        expect(well).not.toMatch(/\d+\s*%/);
        expect((html.match(/data-primary-move="/g) ?? []).length).toBe(1);
      }
    });
  }

  it("no parent note → no well (never invented)", () => {
    harness.logs = [{ id: "l1", timestamp: new Date().toISOString(), behaviorType: "Moment" }];
    expect(renderToStaticMarkup(<Appointments />)).not.toContain('data-testid="appt-worth-bringing"');
  });
});

/* W2-CAREPRO c2 r1 — appointments critics (design P1 G0 module budget, design
 * P1 G1 row hierarchy + chip size, design P1 G2 worth-bringing well, product P1
 * G1 Prepare evidence on the demo family). */
describe("W2-CAREPRO c2 r1 · budget, record hierarchy, the parent's words, a booked demo visit", () => {
  const topLevelModules = (html: string) => {
    // Top-level = a data-module element with no data-module ancestor (the sweep's rule).
    const tags = [...html.matchAll(/<(\/?)(\w+)([^>]*)>/g)];
    const stack: boolean[] = [];
    const out: string[] = [];
    for (const [, close, , attrs] of tags) {
      if (close) { stack.pop(); continue; }
      const mod = /data-module="([^"]+)"/.exec(attrs)?.[1];
      if (mod && !stack.some(Boolean)) out.push(mod);
      if (!/\/$/.test(attrs.trim())) stack.push(!!mod);
    }
    return out;
  };

  for (const locale of ["en", "he"] as const) {
    it(`${locale}: top-level modules = 2 (upcoming + ONE demoted disclosure); past/prepare are nested`, () => {
      harness.locale = locale;
      harness.appts = seeded();
      const html = renderToStaticMarkup(<Appointments />);
      expect(html).toContain('data-module="appt-past"');
      expect(html).toContain('data-module="appt-prepare"');
      const mods = topLevelModules(html.replace(/<(input|img|br|hr|meta|link)\b[^>]*>/g, ""));
      expect(mods).toEqual(["appt-upcoming", "appt-more"]);
      expect(html).toMatch(/<details data-module="appt-more" data-module-demoted="[^"]*"/);
    });

    it(`${locale}: the row title is t-md, the meta is t-sm with the date in a nowrap bdi; one status chip`, () => {
      harness.locale = locale;
      harness.appts = [seeded()[0]];
      const html = renderToStaticMarkup(<Appointments />);
      expect(html).toMatch(/data-testid="appt-row-title" class="t-md font-extrabold"/);
      const meta = html.slice(html.indexOf('data-testid="appt-row-meta"'), html.indexOf("</p>", html.indexOf('data-testid="appt-row-meta"')));
      expect(meta).toContain('class="t-sm"');
      expect(meta).toContain('<bdi class="whitespace-nowrap">');
      const card = html.slice(html.indexOf('data-testid="appt-row-title"'), html.indexOf('data-testid="appt-prepare"'));
      expect((card.match(/rounded-full px-2\.5 py-1/g) ?? []).length).toBe(1);
    });

    it(`${locale}: a capture-sheet moment (words in trigger, no notes) fills 'Worth bringing to the next visit'`, async () => {
      harness.locale = locale;
      harness.appts = [seeded()[0]];
      const { buildMomentLog } = await import("../../content/behaviorTaxonomy");
      const m = buildMomentLog(locale === "he" ? "שר לבד את כל שיר האמבטיה" : "Sang the whole bath song on his own", "Home", {}, new Date(Date.now() - DAY))!;
      harness.logs = [m];
      const html = renderToStaticMarkup(<Appointments />);
      expect(html).toContain(m.trigger);
    });
  }

  it("kit Chip sizes its text with a LENGTH arbitrary value (text-[var(--t-xs)] is read as a colour)", async () => {
    const { readFileSync } = await import("node:fs");
    const kit = readFileSync(new URL("../ui/kit.tsx", import.meta.url), "utf8");
    expect(kit).toContain("text-[length:var(--t-xs)]");
    expect(kit).not.toMatch(/function Chip[\s\S]{0,400}text-\[var\(--t-xs\)\]/);
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: the demo family carries one booked visit inside the 14-day Prepare window`, async () => {
      const { buildDemoFamily } = await import("../../demo/demoFamily");
      const { isPrepareDue } = await import("../../lib/careTrack");
      const now = Date.UTC(2026, 9, 5, 12);
      const f = buildDemoFamily({ lang, now });
      const due = f.collections.appointments.filter((a) => isPrepareDue(a, now));
      expect(due).toHaveLength(1);
      expect(due[0].profession).toBe("slp");
    });
  }
});
