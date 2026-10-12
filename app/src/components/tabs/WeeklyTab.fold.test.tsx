import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* v3 F-NOW-3 — re-pin of B-OCCL-02 (6 Oct) and B-OCCL-03 (7 Oct) for the
   Weekly report as the v3 mock draws it.

   What stays: the route's ONE data-primary-move literal (WeeklyTab
   ACCEPT_STAMP) is spread on the control that performs the move, never on a
   wrapper, and EVERY state renders exactly one stamp, EN + HE.

   What moved (the re-pin): the letter (RecapStoryCards) left #/weekly, so its
   accept and its stamped Next went with it, and so did the header's
   "Create this week's story" / Retell that carried the stamp when nothing was
   to accept (generateIsMove; generation is automatic now). The move lives in
   the mock's "For next week:" band at the END of the report: "Make it today's
   step" carries it while an AI digest's suggestion is not yet today's step,
   and "Back to Now" carries it in every other state. The B-OCCL-02 line model
   (accept bottom <= 640 px at 375) pinned the letter's place above the
   capture dock; the mock puts the band after the dashboard, so at 375 the
   move is reached by scrolling. That trade is the mock's and is OWED to Guy
   and to a rendered sweep (primaryMoveOccluded false once scrolled into
   view); this guard pins the order and the 44 px controls instead. Invented
   examples only. */

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});
vi.mock("../../lib/analytics", () => ({ track: () => undefined }));
const tab = vi.hoisted(() => ({
  reports: [] as unknown[],
  active: null as null | { recommendation: string },
  observations: [] as unknown[],
  generating: false,
}));
vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({
    childProfile: { id: "child-invented", name: "Noa", birthDate: "2022-05-01" },
    setActiveTab: () => undefined,
    acceptTodayAction: () => undefined,
    activeTodayAction: tab.active,
    behaviorLogs: [], playLogs: [], milestones: [], checkedMilestones: 0,
    actionLoop: [], approvedMemoryItems: [], keptInsights: [],
  }),
}));
vi.mock("../../hooks/useObservations", () => ({ useObservations: () => tab.observations }));
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: () => ({ items: [] }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("../../hooks/useWeeklyRecap", async () => {
  const actual = await vi.importActual<typeof import("../../hooks/useWeeklyRecap")>("../../hooks/useWeeklyRecap");
  return {
    ...actual,
    useWeeklyRecap: () => ({
      reports: tab.reports, generating: tab.generating, generate: async () => undefined,
      currentId: actual.recapWeekId(new Date()), currentLabel: "This week", labelFor: () => "Week of 3 October",
      languageRefreshPending: false, recapUnopened: false, markRecapOpened: () => undefined,
    }),
  };
});
vi.mock("../referral/InviteCard", () => ({ default: () => null }));
vi.mock("../overview/QuickLogModal", () => ({ default: () => null }));

import { recapWeekId, recapWeekStartMs } from "../../hooks/useWeeklyRecap";
import { translate } from "../../lib/i18n";
import type { Observation } from "../../lib/observations";
import WeeklyTab from "./WeeklyTab";

const here = path.dirname(fileURLToPath(import.meta.url));
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const TAB = strip(readFileSync(path.join(here, "WeeklyTab.tsx"), "utf8"));

const NOW = new Date(2026, 9, 14, 15, 0);
const FIRST = new Date(recapWeekStartMs(NOW));
const on = (day: number, hour: number) => new Date(FIRST.getFullYear(), FIRST.getMonth(), FIRST.getDate() + day, hour).toISOString();
const moment = (at: string, n: number) => ({
  id: `behaviorLogs:invented-${n}`, childId: "child-invented", at, domains: ["feelings"], kind: "moment",
  value: { type: "moment", behaviorType: "Moment" }, source: "parent_typed", origin: "behaviorLogs",
  ageAtObservationMonths: 52, pretermCorrected: false,
}) as unknown as Observation;
const RECORDS = [moment(on(0, 9), 1), moment(on(1, 18), 2)];

const TRY = { en: "Name the next transition out loud, once, before it starts.", he: "אמרו בקול את המעבר הבא, פעם אחת, לפני שהוא מתחיל." } as const;
const digest = (lang: "en" | "he", generated: "ai" | "fallback") => ({
  title: "Week", subject: "Week", preheader: "", summary: "", highlights: [], watchFor: [],
  tryThisWeek: TRY[lang], generated,
  stats: { weekOf: "2026-10-10", daysCovered: 2, momentsLogged: 2, previousWeekMoments: 0, resolvedCount: 0, topContext: "Home", topBehavior: "", milestonesDone: 0, milestonesTotal: 0 },
});
const stored = (lang: "en" | "he", kind: "ai" | "fallback" | "failed") => ({
  id: recapWeekId(NOW), lang, weekStart: "2026-10-10", generatedAt: on(4, 6),
  summary: { count: 2, resolved: 1, topTrigger: "Transitions" }, milestoneWins: [], planProgress: { done: 0, total: 0 },
  insight: "insight",
  ...(kind === "failed" ? {} : { digest: digest(lang, kind) }),
});

const render = (lang: "en" | "he", reports: unknown[], records: unknown[] = RECORDS, opts: { active?: { recommendation: string }; generating?: boolean } = {}) => {
  state.lang = lang;
  tab.reports = reports;
  tab.observations = records;
  tab.active = opts.active ?? null;
  tab.generating = !!opts.generating;
  return renderToStaticMarkup(<WeeklyTab />);
};
const stamps = (html: string) => html.match(/data-primary-move=/g) ?? [];
const stampedTag = (html: string) => /<button[^>]*data-primary-move="accept-recap-recommendation"[^>]*>/.exec(html)?.[0] ?? "";
const tagOf = (html: string, testId: string) => new RegExp(`<[a-z]+ [^>]*data-testid="${testId}"[^>]*>`).exec(html)?.[0] ?? "";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

describe("#/weekly — the ONE stamp lives in the carry band (v3 F-NOW-3 re-pin of B-OCCL-02)", () => {
  it("one data-primary-move literal, a shared const spread on the two band controls; never on a wrapper", () => {
    expect(TAB.match(/\bdata-primary-move\b(?!-)/g)).toHaveLength(1);
    expect(TAB).toContain('const ACCEPT_STAMP = { "data-primary-move": "accept-recap-recommendation" } as const;');
    expect(TAB.match(/ACCEPT_STAMP/g)).toHaveLength(3);
    expect(TAB).toMatch(/acceptTodayAction\(selected\.digest!\.tryThisWeek, "standard", "digest"\); \}\}\s+\{\.\.\.ACCEPT_STAMP\}\s+data-testid="weekly-accept"/);
    expect(TAB).toMatch(/data-testid="weekly-carry-back"\s+onClick=\{\(\) => setActiveTab\("overview"\)\}\s+\{\.\.\.\(acceptRendered \? undefined : ACCEPT_STAMP\)\}/);
    // The letter, its stamped Next and the generate-as-move rule left the route.
    expect(TAB).not.toMatch(/RecapStoryCards|generateIsMove|weekly-recap|weekly-insight|PageHeader|HeroAvatar/);
  });

  it("order: kicker → title → the counts line → the dashboard (or the empty card) → the carry band → the phone's summary door → the invite disclosure", () => {
    const ret = TAB.indexOf("  return (\n");
    const marks = [
      'data-testid="weekly-eyebrow"',
      'data-testid="weekly-title"',
      'data-testid="weekly-glance-sub"',
      "<WeekGlance",
      'data-module="weekly-empty"',
      'data-module="weekly-carry"',
      '{summaryDoor("end")}',
      "<details",
    ].map((mark) => TAB.indexOf(mark, ret));
    expect(ret).toBeGreaterThan(0);
    expect(marks.every((i) => i > ret)).toBe(true);
    expect([...marks].sort((a, b) => a - b)).toEqual(marks);
  });

  it("the kicker is 12 px in sentence case; the counts line shows at every width", () => {
    const eyebrowTag = /<p data-testid="weekly-eyebrow"[^>]*>/.exec(TAB)?.[0] ?? "";
    expect(eyebrowTag).toContain("text-[12px]");
    expect(eyebrowTag).not.toMatch(/uppercase|text-\[11px\]/);
    const subTag = /<p data-testid="weekly-glance-sub"[^>]*>/.exec(TAB)?.[0] ?? "";
    expect(subTag).not.toBe("");
    expect(subTag).not.toMatch(/\bhidden\b/);
  });

  it("every band control keeps the 44 px floor", () => {
    for (const id of ["weekly-accept", "weekly-generate", "weekly-carry-back"]) {
      const at = TAB.indexOf(`data-testid="${id}"`);
      expect(at, id).toBeGreaterThan(0);
      expect(TAB.slice(at, TAB.indexOf(">", TAB.indexOf("className=", at))), id).toContain("min-h-[44px]");
    }
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: the header reads "Weekly report · {dates}" and "{first}'s week, at a glance."`, () => {
      const html = render(lang, []);
      const kicker = /<p data-testid="weekly-eyebrow"[^>]*>([^<]*)<\/p>/.exec(html)?.[1] ?? "";
      const range = new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-GB", { month: "short", day: "numeric" })
        .formatRange(new Date(2026, 9, 10), new Date(2026, 9, 16));
      expect(kicker).toBe(translate(lang, "elev.wk.kicker", { range }));
      if (lang === "en") expect(kicker).toMatch(/^Weekly report · 10\D+16 Oct$/);
      expect(/<h1 data-testid="weekly-title"[^>]*>([^<]*)<\/h1>/.exec(html)?.[1]).toBe(translate(lang, "elev.wk.headline", { first: "Noa" }));
      expect(/<p data-testid="weekly-glance-sub"[^>]*>([^<]*)<\/p>/.exec(html)?.[1]).toBe(translate(lang, "elev.wk.glance.sub"));
    });

    it(`${lang}: nothing stored, nothing kept → the empty card, then the band; "Back to Now" carries the one stamp`, () => {
      const html = render(lang, [], []);
      expect(html).toContain('data-module="weekly-empty"');
      expect(html).not.toContain('data-module="weekly-glance"');
      expect(stamps(html)).toHaveLength(1);
      const tag = stampedTag(html);
      expect(tag).toContain('data-testid="weekly-carry-back"');
      expect(tag).toContain("background:var(--arbor-ink)");
      expect(html).not.toContain('data-testid="weekly-accept"');
      expect(html).not.toContain('data-testid="weekly-generate"');
      expect(html).toContain(translate(lang, "elev.wk.carry.none"));
      expect(html).toContain(translate(lang, "elev.wk.carry.back"));
      expect(html.indexOf('data-module="weekly-empty"')).toBeLessThan(html.indexOf('data-module="weekly-carry"'));
    });

    it(`${lang}: records, nothing stored → the dashboard, then the band; "Write it now" is a quiet unstamped link inside it`, () => {
      const html = render(lang, []);
      expect(html).toContain('data-module="weekly-glance"');
      expect(stamps(html)).toHaveLength(1);
      expect(stampedTag(html)).toContain('data-testid="weekly-carry-back"');
      const gen = tagOf(html, "weekly-generate");
      expect(gen).not.toBe("");
      expect(gen).not.toContain("data-primary-move");
      expect(gen).not.toContain("gradient");
      expect(gen).toContain("underline");
      const band = html.indexOf('data-module="weekly-carry"');
      expect(html.indexOf('data-module="weekly-glance"')).toBeLessThan(band);
      expect(html.indexOf('data-testid="weekly-generate"')).toBeGreaterThan(band);
      expect(html.indexOf('data-testid="weekly-generate"')).toBeLessThan(html.indexOf('data-testid="weekly-carry-back"'));
      // While the digest is being written, the band says so and offers no link.
      const writing = render(lang, [], RECORDS, { generating: true });
      expect(writing).not.toContain('data-testid="weekly-generate"');
      expect(writing).toContain(translate(lang, "elev.wk.carry.writing"));
      expect(stamps(writing)).toHaveLength(1);
    });

    it(`${lang}: stored week, the digest call failed → "Back to Now" carries the stamp; the link can ask again`, () => {
      const html = render(lang, [stored(lang, "failed")]);
      expect(stamps(html)).toHaveLength(1);
      expect(stampedTag(html)).toContain('data-testid="weekly-carry-back"');
      expect(html).toContain('data-testid="weekly-generate"');
      expect(html).not.toContain('data-testid="weekly-accept"');
    });

    it(`${lang}: stored AI digest → "Make it today's step" carries the stamp and the page's one gradient; "Back to Now" is plain`, () => {
      const html = render(lang, [stored(lang, "ai")]);
      expect(stamps(html)).toHaveLength(1);
      const tag = stampedTag(html);
      expect(tag).toContain('data-testid="weekly-accept"');
      expect(tag).toContain("--arbor-gradient-primary");
      expect(html.match(/--arbor-gradient-primary/g)).toHaveLength(1);
      const back = tagOf(html, "weekly-carry-back");
      expect(back).not.toContain("data-primary-move");
      expect(back).toContain("background:transparent");
      expect(html).toContain(`<bdi dir="auto">${TRY[lang]}</bdi>`);
      expect(html).toContain(translate(lang, "today.action.make").replace(/'/g, "&#x27;"));
      expect(html).not.toContain('data-testid="weekly-generate"');
    });

    it(`${lang}: stored fallback digest → its suggestion in the band, no accept; "Back to Now" carries the stamp`, () => {
      const html = render(lang, [stored(lang, "fallback")]);
      expect(stamps(html)).toHaveLength(1);
      expect(stampedTag(html)).toContain('data-testid="weekly-carry-back"');
      expect(html).not.toContain('data-testid="weekly-accept"');
      expect(html).toContain(`<bdi dir="auto">${TRY[lang]}</bdi>`);
    });

    it(`${lang}: the suggestion is already today's step → the honest done-state; "Back to Now" carries the stamp`, () => {
      const html = render(lang, [stored(lang, "ai")], RECORDS, { active: { recommendation: TRY[lang] } });
      expect(stamps(html)).toHaveLength(1);
      expect(stampedTag(html)).toContain('data-testid="weekly-carry-back"');
      expect(html).not.toContain('data-testid="weekly-accept"');
      expect(html).toContain(translate(lang, "wk.todayStepSet").replace(/'/g, "&#x27;"));
      expect(html).toMatch(/role="status"/);
    });
  }
});
