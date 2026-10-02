import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * B-TODAY-21 clinical-firewall guard — the ONE "What changed since you left"
 * card (ported from ProgressNarrative.firewall.test.ts).
 *
 * Standing constraint (law 1): a parent surface carries counts of
 * parent-noticed things and EVENT language only. The card it replaces said
 * "{reached} of {total}" + "Areas (of 7)" (the dev-map card) and, before that,
 * "{thisWeek} moments this week vs {lastWeek} last week" (ProgressNarrative):
 * a total is a grade and two windows side by side are a trend.
 *
 * Banned in every string the card can render, both locales (acceptance):
 *   "of {total}", "vs", "%", "more than", "fewer", "up", "down",
 *   HE "מתוך" (out of), "יותר" (more), "פחות" (less).
 * Scanned three ways: the dictionary values of every key the card renders,
 * the rendered markup across every line kind in EN + HE, and the component
 * + composer source (code only). Negative controls feed the scanners the
 * verbatim retired strings so the guard can never pass vacuously.
 * And the card is HIDDEN on day-0 and with no events.
 */

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
vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({
    behaviorLogs: [{ id: "a", timestamp: "2026-09-28T08:00:00.000Z" }],
    playLogs: [],
    childProfile: { id: "c1", name: "Maya" },
    setActiveTab: () => undefined,
  }),
}));
vi.mock("../../lib/analytics", () => ({ track: () => undefined }));

import { en as baseEn, he as baseHe } from "../../lib/i18n";
import { elevationEn, elevationHe } from "../../lib/i18nElevation";
import WhatChanged from "./WhatChanged";
import { composeWhatChanged, type WhatChangedLine } from "./whatChangedEvents";

/** The dictionaries t() resolves against (base keys win over elevation). */
const en: Record<string, string> = { ...elevationEn, ...baseEn };
const he: Record<string, string> = { ...elevationHe, ...baseHe };

const here = path.dirname(fileURLToPath(import.meta.url));
const code = (rel: string) =>
  readFileSync(path.join(here, rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\/\/[^\n"'`]*$/gm, "");

/* ── The banned vocabulary (acceptance, verbatim) ─────────────────────────── */
const BANNED: { name: string; re: RegExp }[] = [
  { name: "'of {total}'", re: /\bof\s+\{?total\}?/i },
  { name: "'vs'", re: /\bvs\.?(?=\s|$)/i },
  { name: "'%'", re: /%/ },
  { name: "'more than'", re: /\bmore\s+than\b/i },
  { name: "'fewer'", re: /\bfewer\b/i },
  { name: "'up'", re: /\bup\b/i },
  { name: "'down'", re: /\bdown\b/i },
  { name: "HE 'מתוך'", re: /מתוך/ },
  { name: "HE 'יותר'", re: /יותר/ },
  { name: "HE 'פחות'", re: /פחות/ },
];
const firstHit = (text: string) => BANNED.find(({ re }) => re.test(text))?.name ?? null;

/** Every dictionary key the card can render. */
const CARD_KEYS = [
  ...Object.keys(en).filter((k) => k.startsWith("elev.brief.changed.")),
  "elev.recap.ready",
  "elev.recap.ready.aria",
  "elev.recap.days",
  "elev.sincevisit.row.noticed",
  "elev.sincevisit.more",
  "elev.closeloop.coldstart.one",
  "elev.closeloop.coldstart.many",
  "elev.firsts.first_milestone.title",
];

describe("negative controls — the scanners catch the retired copy", () => {
  it("dev-map card: '{reached} of {total}' and '(of 7)'", () => {
    expect(firstHit("{reached} of {total} noticed")).toBe("'of {total}'");
    expect(firstHit("Areas (of 7)")).toBeNull(); // a literal total is caught by the source scan below
  });
  it("ProgressNarrative week compare, EN + HE", () => {
    expect(firstHit("{thisWeek} moments this week vs {lastWeek} last week.")).toBe("'vs'");
    expect(firstHit("4 רגעים יותר מבשבוע שעבר")).toBe("HE 'יותר'");
  });
  it("trend words, %, out-of in Hebrew", () => {
    expect(firstHit("Calm moments are up this week")).toBe("'up'");
    expect(firstHit("fewer meltdowns")).toBe("'fewer'");
    expect(firstHit("80% on track")).toBe("'%'");
    expect(firstHit("5 מתוך 7 תחומים")).toBe("HE 'מתוך'");
    expect(firstHit("פחות התפרצויות")).toBe("HE 'פחות'");
  });
});

describe("the card's dictionary is event-only in BOTH locales", () => {
  it("every rendered key exists in en + he with the same {vars}", () => {
    const vars = (s: string) => (s.match(/\{[a-z]+\}/gi) ?? []).sort();
    expect(CARD_KEYS.filter((k) => k.startsWith("elev.brief.changed.")).length).toBeGreaterThanOrEqual(8);
    for (const k of CARD_KEYS) {
      expect(en[k], `en ${k}`).toBeTruthy();
      expect(he[k], `he ${k}`).toBeTruthy();
      expect(vars(he[k]), `{var} mismatch on ${k}`).toEqual(vars(en[k]));
    }
  });

  for (const [lang, dict] of [["en", en], ["he", he]] as const) {
    it(`${lang}: no banned comparative / total / trend word`, () => {
      for (const k of CARD_KEYS) expect(firstHit(dict[k]), `${lang} ${k} = "${dict[k]}"`).toBeNull();
    });
  }
});

const RECAP = { currentReport: { id: "r" }, recapUnopened: true, currentId: "2026-W40" } as unknown as Parameters<typeof WhatChanged>[0]["recap"];
const NO_RECAP = { currentReport: null, recapUnopened: false, currentId: "2026-W40" } as unknown as Parameters<typeof WhatChanged>[0]["recap"];
const EVERY_LINE: WhatChangedLine[][] = [
  [
    { kind: "first", first: "first_milestone", title: "Points at a dog" },
    { kind: "milestone", title: "Stacks two blocks", at: 1 },
    { kind: "step", step: "Name the feeling", outcome: "helped", focusId: "action-1", at: 1 },
    { kind: "facts", count: 2 },
  ],
  [
    { kind: "step", step: "Name the feeling", outcome: "somewhat", focusId: "action-1", at: 1 },
    { kind: "milestone", title: "Says two words together", at: 2 },
    { kind: "moments", count: 1, quote: "said butterfly", focusId: "moment-a" },
    { kind: "noticed" },
  ],
  [
    { kind: "facts", count: 1 },
    { kind: "moments", count: 6, quote: "bath time", focusId: "moment-b" },
  ],
];
const visibleText = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");

describe("the rendered card is event-only in EN + HE", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: no banned word in any rendered line, recap, overflow, cold-start or days line`, () => {
      state.lang = lang;
      for (const lines of EVERY_LINE) {
        const html = renderToStaticMarkup(
          React.createElement(WhatChanged, { lines, hiddenCount: 3, recap: RECAP, rhythmDaysNeeded: 2, onLineTap: () => undefined, onMore: () => undefined }),
        );
        expect(html.match(/data-testid="what-changed"/g), "exactly one card").toHaveLength(1);
        expect(firstHit(visibleText(html)), `${lang}: ${visibleText(html)}`).toBeNull();
      }
    });
  }
});

describe("the component + composer carry no total, delta or percentage mechanism", () => {
  const card = code("WhatChanged.tsx");
  const composer = code("whatChangedEvents.ts");
  it("no total, prior window or percentage reaches copy", () => {
    for (const src of [card, composer]) {
      expect(src).not.toMatch(/\btotal\s*:/);
      expect(src).not.toMatch(/totalMilestones|lastWeek|prevWeek|weekCompare|percent/i);
      expect(src).not.toMatch(/\(of\s*7\)|"%"|'%'/);
    }
  });
  it("no streak walk: only totalDays is read", () => {
    expect(card).not.toMatch(/\.(current|loggedToday)\b/);
  });
});

describe("hidden on day-0 and with no events", () => {
  it("day-0 / first visit: the composer has no previous visit → no lines", () => {
    const r = composeWhatChanged({
      previousVisitAt: null,
      behaviorLogs: [{ id: "a", timestamp: "2026-09-28T08:00:00.000Z" }],
      playLogs: [],
      milestones: [],
      actionLoop: [],
      approvedFactsSince: 4,
      firstsState: { seen: [] },
    });
    expect(r.lines).toEqual([]);
  });

  it("no events and no recap line → the card renders nothing (EN + HE)", () => {
    for (const lang of ["en", "he"] as const) {
      state.lang = lang;
      const html = renderToStaticMarkup(
        React.createElement(WhatChanged, { lines: [], hiddenCount: 0, recap: NO_RECAP, rhythmDaysNeeded: 2, onLineTap: () => undefined, onMore: () => undefined }),
      );
      expect(html).toBe("");
    }
  });

  it("OverviewTab gates the mount on returning + not day-0", () => {
    const overview = code("../tabs/OverviewTab.tsx");
    expect(overview).toMatch(/changedWould\s*=\s*!dayZero\s*&&\s*isReturning\s*&&/);
    expect(overview).toMatch(/previousVisitAt:\s*isReturning\s*&&\s*!dayZero/);
  });
});
