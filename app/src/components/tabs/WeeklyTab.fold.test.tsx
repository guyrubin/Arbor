import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

/* B-OCCL-02 (6 Oct) — #/weekly at 375 × 812: the route's data-primary-move
   (accept-recap-recommendation) sat on the letter's display:contents wrapper,
   measured y 510, h 650 EN + HE (sweeps/ship-275042b9) — it ran under the
   fixed capture dock. Fix: the ONE stamp literal (WeeklyTab ACCEPT_STAMP) is
   spread on the control that performs the move — the letter's accept button
   (RecapStoryCards acceptStamp — one data attribute, never a spread, so
   whiteLabelContrast can prove the fill — last card) or, on a history week, the insight
   card's accept — and the header gives back the height above the letter:
   the week label rides in the eyebrow (no subtitle line), PageHeader flush
   (no mb-7), the outline Retell and the history chips sit UNDER the story.

   jsdom has no layout, so this guard asserts (1) the stamp seam in source and
   in the rendered letter, (2) the order of the page source, (3) a line model
   of the accept button's bottom edge on the letter's last card at 375, from
   the measured letter top (510) minus what this fix removed. OWED to a
   rendered check: the sweep's base #/weekly cell opens on card 1, where the
   accept button is not mounted, so the sweep reports no stamp there; a sweep
   state that steps to the last card (rendered-sweep.mjs, not this builder's
   file) must read primaryMoveOccluded false and the stamp bottom <= 640 EN + HE. */

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
vi.mock("../ui/ShareButton", () => ({ default: () => null, ShareButton: () => null }));
/* B-OCCL-03: the whole tab, rendered server-side over a stubbed context. */
const tab = vi.hoisted(() => ({
  reports: [] as unknown[],
  active: null as null | { recommendation: string },
}));
vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({
    childProfile: { id: "dylan-demo", name: "Dylan", birthDate: "2023-08-01" },
    setActiveTab: () => undefined,
    acceptTodayAction: () => undefined,
    activeTodayAction: tab.active,
    behaviorLogs: [], playLogs: [], milestones: [], checkedMilestones: 0,
    actionLoop: [], approvedMemoryItems: [], keptInsights: [],
  }),
}));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("../../hooks/useWeeklyRecap", async () => {
  const actual = await vi.importActual<typeof import("../../hooks/useWeeklyRecap")>("../../hooks/useWeeklyRecap");
  return {
    ...actual,
    useWeeklyRecap: () => ({
      reports: tab.reports, generating: false, generate: async () => undefined,
      currentId: "2026-W40", currentLabel: "This week", labelFor: () => "Week of 27 September",
      languageRefreshPending: false, recapUnopened: false, markRecapOpened: () => undefined,
    }),
  };
});
vi.mock("../weekly/recapEmail", () => ({
  fetchDigestEmailStatus: () => new Promise(() => undefined),
  readEmailOptIn: () => false,
  writeEmailOptIn: () => undefined,
}));
vi.mock("../referral/InviteCard", () => ({ default: () => null }));
vi.mock("../ui/HeroAvatar", () => ({ HeroAvatar: () => null }));
vi.mock("../overview/QuickLogModal", () => ({ default: () => null }));

import RecapStoryCards, { type RecapRecord } from "../weekly/RecapStoryCards";
import { recapWeekStartMs, type WeeklyReport } from "../../hooks/useWeeklyRecap";
import type { WeeklyDigest } from "../../lib/api";
import { translate } from "../../lib/i18n";
import WeeklyTab from "./WeeklyTab";
import { rcString } from "../weekly/recapStrings";

const here = path.dirname(fileURLToPath(import.meta.url));
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const TAB = strip(readFileSync(path.join(here, "WeeklyTab.tsx"), "utf8"));

/* The fallback digest's suggestions (server/digest.ts), plus a 200-character
   AI-length sentence as the bound. */
const TRY = {
  en: [
    "Log one moment a day — 20 seconds each — and next week's digest gets much smarter.",
    "Pick the most frequent trigger above and pre-empt it once this week with a named transition warning.",
    "x".repeat(200),
  ],
  he: [
    "תעדו רגע אחד ביום — 20 שניות בכל פעם — והסיכום של השבוע הבא יהיה חכם יותר.",
    "בחרו את הרגע שחוזר הכי הרבה ונסו להקדים אותו פעם אחת השבוע עם התראה רכה לפני המעבר.",
    "א".repeat(200),
  ],
} as const;

const NOW = new Date("2026-10-01T12:00:00.000Z");
const record = {
  weekStartMs: recapWeekStartMs(NOW),
  behaviorLogs: [],
  playLogs: [],
  milestones: [],
  actionLoop: [],
  approvedFacts: [],
  keptIdeas: [],
  firstsState: { seen: [] },
  milestoneCount: 0,
  promptKey: null,
} as unknown as RecapRecord;
const report = (tryThisWeek: string) =>
  ({
    id: "2026-W40",
    weekLabel: "Week of September 27",
    generatedAt: "2026-10-01T06:00:00.000Z",
    summary: { count: 3, resolved: 2, topTrigger: "Transitions" },
    milestoneWins: [],
    planProgress: { done: 0, total: 0 },
    insight: "insight",
    digest: {
      title: "Week", subject: "Week", preheader: "", summary: "", highlights: [], watchFor: [],
      tryThisWeek, generated: "ai",
      stats: { weekOf: "2026-09-27", daysCovered: 4, momentsLogged: 3, previousWeekMoments: 0, resolvedCount: 0, topContext: "Home", topBehavior: "", milestonesDone: 0, milestonesTotal: 0 },
    },
  }) as unknown as WeeklyReport & { digest: WeeklyDigest };

const renderCard = (lang: "en" | "he", text: string, index = 3) => {
  state.lang = lang;
  return renderToStaticMarkup(
    <RecapStoryCards report={report(text)} record={record} childName="Dylan" canAccept accepted={false} onAccept={() => undefined} onCapture={() => undefined} initialIndex={index} acceptStamp={{ "data-primary-move": "accept-recap-recommendation" }} />,
  );
};

/* The 375 model. Measured: the letter's top at y 510 (EN = HE). Removed
   above it: the subtitle line (mt-2 8 + text-sm 20), PageHeader mb-7 (28),
   the header action row at 375 (gap-3 12 + 44), the history strip (44 +
   pb-1 4 + space-y-6 24); added: the eyebrow at 12 px instead of 11 px (+1.5).
   The letter: section p-1, card p-6, the eyebrow row (≈ 17), then the content
   centred in min-h 380: title 22 px leading-tight, mt-3, the suggestion
   15 px leading-relaxed (24.375 / line) over 375 − 2·16 − 2·4 − 2·24 = 287 px
   at 0.5 em per character (EN width for HE too, a conservative bound),
   mt-5, the accept row (min-h 44; a wrapped share button adds 12 + 44 under
   it, which only moves the centring — counted, the worst case). */
const LETTER_TOP_375 = 510 - (8 + 20) - 28 - (12 + 44) - (44 + 4 + 24) + 1.5;
const FOLD_LIMIT = 640;
const WIDTH = 287;
const lines = (text: string, px: number, em = 0.5) => Math.max(1, Math.ceil((text.length * px * em) / WIDTH));
function acceptBottom(lang: "en" | "he", text: string, top = LETTER_TOP_375) {
  const title = translate(lang, "elev.recap.try.title");
  const titleH = lines(title, 22, 0.52) * 22 * 1.25;
  const bodyH = lines(text, 15) * 15 * 1.625;
  const contentAbove = titleH + 12 + bodyH + 20;
  const content = contentAbove + 44 + (12 + 44);
  const box = 380 - 2 * 24 - 17;
  const offset = Math.max(0, (box - content) / 2);
  return Math.round(top + 4 + 24 + 17 + offset + contentAbove + 44);
}
/** Weekly 1b: the stamped Next on cards 1…n-1 sits in the card's top-end
 *  corner (absolute top-3, no layout height): section p-1 4 + 12 + 44. The
 *  last card has no Next, so the accept model above is unchanged. */
const nextBottom = (top = LETTER_TOP_375) => Math.round(top + 4 + 12 + 44);

describe("#/weekly — the move is the accept button, above the capture dock at 375", () => {
  it("ONE data-primary-move literal in WeeklyTab, a shared const spread on the accept controls; the letter wrapper carries none", () => {
    expect(TAB.match(/\bdata-primary-move\b(?!-)/g)).toHaveLength(1);
    expect(TAB).toContain('const ACCEPT_STAMP = { "data-primary-move": "accept-recap-recommendation" } as const;');
    expect(TAB).toMatch(/<RecapStoryCards\s+acceptStamp=\{acceptRendered \? ACCEPT_STAMP : undefined\}/);
    // whiteLabelContrast: the letter sets ONE data attribute, never a prop spread on the button.
    const LETTER = readFileSync(path.join(here, "../weekly/RecapStoryCards.tsx"), "utf8");
    expect(LETTER).toContain('data-primary-move={acceptStamp?.["data-primary-move"]}');
    expect(LETTER).not.toMatch(/\{\.\.\.accept\w*\}/);
    expect(TAB).toMatch(/onClick=\{\(\) => acceptTodayAction\(selected\.digest!\.tryThisWeek, "standard", "digest"\)\}\s+\{\.\.\.ACCEPT_STAMP\}/);
    expect(TAB).toMatch(/<div data-module="weekly-recap" style=\{\{ display: "contents" \}\}>/);
  });

  it("order: eyebrow (with the week label) → one-line H1 (no subtitle, flush) → the story → Retell + history chips", () => {
    const ret = TAB.indexOf("  return (\n");
    const eyebrow = TAB.indexOf('data-testid="weekly-eyebrow"');
    const h1 = TAB.indexOf('title={t("wk.title", { first })}');
    const recap = TAB.indexOf("<RecapStoryCards");
    const after = TAB.indexOf("{afterStory}", recap);
    expect([ret, eyebrow, h1, recap, after].every((i) => i > 0)).toBe(true);
    expect(ret).toBeLessThan(eyebrow);
    expect(eyebrow).toBeLessThan(h1);
    expect(h1).toBeLessThan(recap);
    expect(recap).toBeLessThan(after);
    expect(TAB.slice(eyebrow, h1)).toContain("labelFor(selected)");
    expect(TAB).not.toMatch(/subtitle=\{selected \? labelFor/);
    expect(TAB).toMatch(/<PageHeader\s+flush/);
    expect(TAB).toContain("action={hasStoredCurrentWeek ? undefined : retellButton}");
    // The chips are built once, before the render, and placed through afterStory only.
    expect(TAB.indexOf("chipIds.map")).toBeLessThan(ret);
    expect(TAB.slice(ret).match(/chipIds\.map/g)).toBeNull();
  });

  it("the eyebrow and the chips: 12 px, no uppercase", () => {
    const eyebrowTag = /<p data-testid="weekly-eyebrow"[^>]*>/.exec(TAB)?.[0] ?? "";
    expect(eyebrowTag).toContain("text-[12px]");
    expect(eyebrowTag).not.toMatch(/uppercase|text-\[11px\]/);
    expect(TAB).toContain('className="text-[12px] font-bold px-3 py-1.5 rounded-full');
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: weekly 1b — every card index renders exactly one stamp, on the visible card's forward control (next, next, next, accept)`, () => {
      const html = renderCard(lang, TRY[lang][0]);
      expect(html.match(/data-primary-move=/g)).toHaveLength(1);
      expect(html).toMatch(/<button[^>]*data-primary-move="accept-recap-recommendation"[^>]*data-testid="recap-accept"/);
      expect(html).not.toMatch(/<section[^>]*data-primary-move/);
      // The last card has no Next: its accept is the forward control.
      expect(html).not.toContain('data-testid="recap-next"');
      const n = (html.match(/class="rounded-full transition-all"/g) ?? []).length;
      expect(n).toBeGreaterThanOrEqual(3);
      for (let i = 0; i < n - 1; i++) {
        const card = renderCard(lang, TRY[lang][0], i);
        expect(card.match(/data-primary-move=/g), `card ${i + 1}`).toHaveLength(1);
        const next = /<button[^>]*data-testid="recap-next"[^>]*>/.exec(card)?.[0] ?? "";
        expect(next).toContain('data-primary-move="accept-recap-recommendation"');
        expect(next).toContain("--arbor-gradient-primary");
        expect(card).not.toContain('data-testid="recap-accept"');
      }
      // No acceptStamp (fallback / accepted letter) → no stamp on any card; WeeklyTab's Retell carries it.
      state.lang = lang;
      for (let i = 0; i < n; i++) {
        const bare = renderToStaticMarkup(
          <RecapStoryCards report={report(TRY[lang][0])} record={record} childName="Dylan" canAccept accepted={false} onAccept={() => undefined} onCapture={() => undefined} initialIndex={i} />,
        );
        expect(bare).not.toContain("data-primary-move");
        if (i < n - 1) expect(/<button[^>]*data-testid="recap-next"[^>]*>/.exec(bare)?.[0] ?? "").not.toContain("gradient");
      }
    });

    it(`${lang}: card 1's stamped Next sits in the card's top-end corner (before its content), bottom ${nextBottom()} ≤ ${FOLD_LIMIT} at 375`, () => {
      const html = renderCard(lang, TRY[lang][0], 0);
      const next = /<button[^>]*data-testid="recap-next"[^>]*>/.exec(html)?.[0] ?? "";
      expect(next).toMatch(/class="absolute top-3 end-3 /);
      expect(html.indexOf('data-testid="recap-next"')).toBeLessThan(html.indexOf('data-testid="recap-card-new"'));
      expect(html.indexOf('data-testid="recap-next"')).toBeLessThan(html.indexOf('data-testid="recap-nav"'));
      expect(nextBottom()).toBeLessThanOrEqual(FOLD_LIMIT);
    });

    for (const text of TRY[lang]) {
      it(`${lang}: accept bottom ≤ ${FOLD_LIMIT} px at 375 × 812 (line model, ${text.length} chars)`, () => {
        expect(acceptBottom(lang, text)).toBeLessThanOrEqual(FOLD_LIMIT);
      });
    }
  }

  it("negative control: from the pre-fix letter top (510) the same button sat under the dock", () => {
    expect(acceptBottom("en", TRY.en[1], 510)).toBeGreaterThan(FOLD_LIMIT);
  });
});

/* B-OCCL-03 (7 Oct) — the ship sweep on b2c0d0f6 (sweeps/ship-b2c0d0f6):
   #/weekly 375 EN + HE and 1280 had NO data-primary-move. The base cell held
   a stored current week whose digest call failed (modules weekly-insight,
   weekly-detail, weekly-share): no accept anywhere, and with nothing stored
   the header "Create this week's story" carried no stamp either. Fix: with
   no accept rendered the ONE generate control carries ACCEPT_STAMP
   (generateIsMove) — in the header when nothing is stored, as Retell under
   the story when it is. The contract's primaryMove id is unchanged. */
describe("#/weekly — every state renders exactly one stamp (B-OCCL-03)", () => {
  const stamps = (html: string) => html.match(/data-primary-move="accept-recap-recommendation"/g) ?? [];
  const stampedTag = (html: string) => /<button[^>]*data-primary-move="accept-recap-recommendation"[^>]*>/.exec(html)?.[0] ?? "";
  const render = (lang: "en" | "he", reports: unknown[], active: null | { recommendation: string } = null) => {
    state.lang = lang;
    tab.reports = reports;
    tab.active = active;
    return renderToStaticMarkup(<WeeklyTab />);
  };
  const stored = (lang: "en" | "he", digest: unknown) => ({
    id: "2026-W40", lang, weekStart: "2026-09-27T00:00:00.000Z", generatedAt: "2026-10-01T06:00:00.000Z",
    summary: { count: 3, resolved: 2, topTrigger: "Transitions" }, milestoneWins: [], planProgress: { done: 0, total: 0 },
    insight: rcString((k) => translate(lang, k), lang, "elev.recap.insight.unavailable"),
    ...(digest ? { digest } : {}),
  });

  it("source: one literal, spread conditionally on the generate control; the gradient follows the stamp", () => {
    expect(TAB.match(/\bdata-primary-move\b(?!-)/g)).toHaveLength(1);
    expect(TAB).toMatch(/data-testid="weekly-generate"\s+\{\.\.\.\(generateIsMove \? ACCEPT_STAMP : undefined\)\}/);
    expect(TAB).toContain("const generateIsMove = !acceptRendered;");
    expect(TAB).toMatch(/style=\{generateIsMove\s+\? \{ background: "var\(--arbor-gradient-primary\)"/);
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: nothing stored → exactly one stamp, on "Create this week's story" in the header`, () => {
      const html = render(lang, []);
      expect(stamps(html)).toHaveLength(1);
      const tag = stampedTag(html);
      expect(tag).toContain('data-testid="weekly-generate"');
      expect(tag).toContain("--arbor-gradient-primary");
      expect(html).toContain(translate(lang, "wk.generate").replace(/'/g, "&#x27;"));
      expect(html).toContain('data-module="weekly-empty"');
      // The create control sits in the header, above the empty card.
      expect(html.indexOf('data-testid="weekly-generate"')).toBeLessThan(html.indexOf('data-module="weekly-empty"'));
    });

    it(`${lang}: stored week, the digest call failed (the sweep's base cell) → one stamp, on Retell`, () => {
      const html = render(lang, [stored(lang, null)]);
      expect(html).toContain('data-module="weekly-insight"');
      expect(stamps(html)).toHaveLength(1);
      expect(stampedTag(html)).toContain('data-testid="weekly-generate"');
      expect(html).toContain(translate(lang, "wk.regenerate"));
    });

    it(`${lang}: stored AI letter at card 1 (the ship sweep's base cell on 13137d1a) → one stamp, on the letter's Next; the generate control is outline and unstamped`, () => {
      const html = render(lang, [stored(lang, report(TRY[lang][0]).digest)]);
      expect(html).toContain('data-module="weekly-recap"');
      const gen = /<button[^>]*data-testid="weekly-generate"[^>]*>/.exec(html)?.[0] ?? "";
      expect(gen).not.toBe("");
      expect(gen).not.toContain("data-primary-move");
      expect(gen).not.toContain("gradient");
      expect(stamps(html)).toHaveLength(1);
      expect(stampedTag(html)).toContain('data-testid="recap-next"');
      expect(nextBottom()).toBeLessThanOrEqual(FOLD_LIMIT);
      expect(stamps(renderCard(lang, TRY[lang][0]))).toHaveLength(1);
    });

    it(`${lang}: stored fallback letter (no accept) → Retell carries the stamp`, () => {
      const html = render(lang, [stored(lang, { ...report(TRY[lang][0]).digest, generated: "fallback" })]);
      expect(stamps(html)).toHaveLength(1);
      expect(stampedTag(html)).toContain('data-testid="weekly-generate"');
    });

    it(`${lang}: step already taken from the letter → Retell carries the stamp`, () => {
      const html = render(lang, [stored(lang, report(TRY[lang][0]).digest)], { recommendation: TRY[lang][0] });
      expect(stamps(html)).toHaveLength(1);
      expect(stampedTag(html)).toContain('data-testid="weekly-generate"');
    });
  }

  /* The 375 line model for the generate control, from the same measured
     letter top (LETTER_TOP_375 = the stored-week header bottom + space-y-6).
     Nothing stored: the header gains the action row (gap-3 12 + 44).
     Stored, digest failed: the insight card (p-6 24 · label row 16 ·
     space-y-3 12 · the unavailable sentence, text-sm 20 / line over
     375 − 32 = 343 − 2·24 = 295 px at 0.5 em · p-6 24) · space-y-6 24 ·
     Retell 44. The H1 ("{first}'s week", 24 px × 1.1) is one line in the
     measured base; any extra wrapped line is added. */
  const HEADER_BOTTOM_STORED = LETTER_TOP_375 - 24;
  const titleExtra = (lang: "en" | "he") => (lines(translate(lang, "wk.title", { first: "Dylan" }), 24, 0.55) - 1) * 24 * 1.1;
  const createBottom = (lang: "en" | "he") => Math.round(HEADER_BOTTOM_STORED + titleExtra(lang) + 12 + 44);
  const retellBottom = (lang: "en" | "he") => {
    const sentence = rcString((k) => translate(lang, k), lang, "elev.recap.insight.unavailable");
    const textH = Math.ceil((sentence.length * 14 * 0.5) / 295) * 20;
    return Math.round(HEADER_BOTTOM_STORED + titleExtra(lang) + 24 + (24 + 16 + 12 + textH + 24) + 24 + 44);
  };
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: the stamped generate control's bottom ≤ ${FOLD_LIMIT} px at 375 × 812 (nothing stored · digest failed)`, () => {
      expect(createBottom(lang)).toBeLessThanOrEqual(FOLD_LIMIT);
      expect(retellBottom(lang)).toBeLessThanOrEqual(FOLD_LIMIT);
    });
  }
});
