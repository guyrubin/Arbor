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
const harness = vi.hoisted(() => ({ locale: "en" as "en" | "he", appts: [] as unknown[] }));

vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({ childProfile: { id: "c1", name: "Dylan" }, setActiveTab: vi.fn(), requestConsultPrefill: vi.fn() }),
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

beforeEach(() => { harness.locale = "en"; harness.appts = []; });

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
