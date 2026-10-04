/**
 * W2-CAREPRO r2 — rendered "Your full record" (EN + HE).
 *
 * P1s: no "Exportable reports" card header (the H1 frames the list); every row
 * title in one family (body face, t-sm bold — HE titles were h3 in the display
 * face and read smaller than their own descriptions); a ~720 px measure; a door
 * to the one complete-record export (Settings > Your data). New items: the lead
 * record opens on a counts-only line from the record (B-CAREPRO-NEW-2e) and a
 * quoted "kept this week" well from the parent's own words (B-CAREPRO-NEW-2f).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";

const DAY = 86_400_000;
const harness = vi.hoisted(() => ({
  locale: "en" as "en" | "he",
  logs: [] as { id: string; timestamp: string; behaviorType: string; notes?: string }[],
  openSettings: vi.fn(),
}));

vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({
    childProfile: { id: "c1", name: "Dylan Cohen", age: 5 },
    setActiveTab: vi.fn(),
    requestConsultPrefill: vi.fn(),
    behaviorLogs: harness.logs,
    milestones: [
      { id: "m1", checked: true, observationUpdatedAt: new Date(Date.now() - 2 * DAY).toISOString() },
      { id: "m2", checked: true, observationUpdatedAt: new Date(Date.now() - 40 * DAY).toISOString() },
      { id: "m3", checked: false, observationUpdatedAt: new Date(Date.now() - DAY).toISOString() },
    ],
    actionPlans: [],
    checkedMilestones: 2,
    totalMilestones: 3,
  }),
}));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({
    uiLang: harness.locale,
    t: (key: string, vars?: Record<string, string | number>) => translate(harness.locale, key, vars),
  }),
}));
vi.mock("../ui/HeroAvatar", () => ({ useHeroAvatar: () => ({ url: null, isGenerated: false }) }));
vi.mock("../../hooks/useChildCollection", () => ({
  useChildCollection: () => ({ items: [], loaded: true, upsert: vi.fn(), remove: vi.fn() }),
}));
vi.mock("../layout/settingsBus", () => ({ requestOpenSettings: harness.openSettings }));

import Reports, { reportsLeadCounts, keptThisWeek } from "./Reports";

beforeEach(() => {
  harness.locale = "en";
  harness.logs = [
    { id: "l1", timestamp: new Date(Date.now() - DAY).toISOString(), behaviorType: "Moment", notes: "I did the gate by myself." },
    { id: "l2", timestamp: new Date(Date.now() - 3 * DAY).toISOString(), behaviorType: "Moment" },
    { id: "l3", timestamp: new Date(Date.now() - 20 * DAY).toISOString(), behaviorType: "Moment", notes: "old" },
  ];
});

describe("W2-CAREPRO r2 · one layer of chrome, one row family, a measure", () => {
  for (const locale of ["en", "he"] as const) {
    it(`${locale}: no 'Exportable reports' header; row titles are body-face p (no h3); a 720 px measure`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<Reports />);
      expect(html).not.toContain(translate(locale, "elev.reports.section"));
      const catalogue = html.slice(html.indexOf('data-module="reports-catalogue"'));
      expect(catalogue).not.toMatch(/<h3/);
      const titles = catalogue.match(/<p data-testid="reports-row-title" class="([^"]*)" style="([^"]*)"/g) ?? [];
      expect(titles.length).toBe(4);
      for (const tag of titles) {
        expect(tag).toContain("t-sm font-bold");
        expect(tag).toContain("var(--font-sans)");
      }
      expect(html).toContain("max-w-[720px]");
      expect(html).not.toContain("max-w-[1180px]");
    });

    it(`${locale}: the last row is the one door to Your data, named for the child`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<Reports />);
      const door = html.slice(html.indexOf('data-testid="reports-your-data"'));
      expect(door).toContain(translate(locale, "elev.reports.yourData", { name: "Dylan" }).replace(/'/g, "&#x27;"));
      expect(door).toContain("min-h-11");
      expect(html.lastIndexOf("<li")).toBeLessThan(html.indexOf('data-testid="reports-your-data"'));
    });
  }

  it("source: the door opens Settings on the data row", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./Reports.tsx", import.meta.url), "utf8");
    expect(src).toContain('onClick={() => requestOpenSettings({ focus: "data" })}');
    expect(src).not.toContain("<SectionCard");
  });
});

describe("B-CAREPRO-NEW-2e · the lead line counts what the parent logged (numerators only)", () => {
  it("unit: this week on a first visit; since the last save after one", () => {
    const now = Date.now();
    const logs = [{ timestamp: new Date(now - DAY).toISOString() }, { timestamp: new Date(now - 3 * DAY).toISOString() }, { timestamp: new Date(now - 20 * DAY).toISOString() }];
    const ms = [{ checked: true, observationUpdatedAt: new Date(now - 2 * DAY).toISOString() }, { checked: false, observationUpdatedAt: new Date(now - DAY).toISOString() }];
    expect(reportsLeadCounts({ logs, milestones: ms, sinceIso: null, nowMs: now })).toMatchObject({ moments: 2, milestones: 1 });
    expect(reportsLeadCounts({ logs, milestones: ms, sinceIso: new Date(now - 2 * DAY).toISOString(), nowMs: now })).toMatchObject({ moments: 1, milestones: 0 });
  });

  for (const locale of ["en", "he"] as const) {
    it(`${locale}: first visit reads the first-visit line with counts; no %, no denominator`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<Reports />);
      const line = /<p data-testid="reports-lead-counts"[^>]*>([^<]*)<\/p>/.exec(html)![1];
      const moments = translate(locale, "elev.reports.line.moments.other", { n: 2 });
      const milestones = translate(locale, "elev.reports.lead.milestones.one", { n: 1 });
      expect(line).toBe(translate(locale, "elev.reports.lead.first", { moments, milestones }));
      expect(line).not.toMatch(/%|\/\s*\d|\bof\b/);
      expect(html.indexOf('data-testid="reports-lead-counts"')).toBeLessThan(html.indexOf('data-primary-move="export-report"'));
    });
  }
});

describe("B-CAREPRO-NEW-2f · kept this week, in the parent's words", () => {
  it("unit: the newest note inside 7 days, else null", () => {
    const now = Date.now();
    expect(keptThisWeek(harness.logs, now)?.quote).toBe("I did the gate by myself.");
    expect(keptThisWeek([{ timestamp: new Date(now - 20 * DAY).toISOString(), notes: "old" }], now)).toBeNull();
  });

  for (const locale of ["en", "he"] as const) {
    it(`${locale}: the quote well is the one peach accent, dir=auto, date isolated; the empty line has no CTA`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<Reports />);
      const well = html.slice(html.indexOf('data-testid="reports-kept"'), html.indexOf("</figure>"));
      expect(well).toContain("I did the gate by myself.");
      expect(well).toContain('dir="auto"');
      expect(well).toContain("<bdi>");
      expect((html.match(/var\(--arbor-peach-soft\)/g) ?? []).length).toBe(1);
      harness.logs = [];
      const empty = renderToStaticMarkup(<Reports />);
      expect(empty).toContain(translate(locale, "elev.reports.kept.empty"));
      expect(empty).not.toContain('data-testid="reports-kept"');
    });
  }
});
