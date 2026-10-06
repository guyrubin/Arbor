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

import RecapStoryCards, { type RecapRecord } from "../weekly/RecapStoryCards";
import { recapWeekStartMs, type WeeklyReport } from "../../hooks/useWeeklyRecap";
import type { WeeklyDigest } from "../../lib/api";
import { translate } from "../../lib/i18n";

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

describe("#/weekly — the move is the accept button, above the capture dock at 375", () => {
  it("ONE data-primary-move literal in WeeklyTab, a shared const spread on the accept controls; the letter wrapper carries none", () => {
    expect(TAB.match(/\bdata-primary-move\b(?!-)/g)).toHaveLength(1);
    expect(TAB).toContain('const ACCEPT_STAMP = { "data-primary-move": "accept-recap-recommendation" } as const;');
    expect(TAB).toMatch(/<RecapStoryCards\s+acceptStamp=\{ACCEPT_STAMP\}/);
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
    it(`${lang}: the rendered letter stamps the accept button only, on the last card`, () => {
      const html = renderCard(lang, TRY[lang][0]);
      expect(html.match(/data-primary-move=/g)).toHaveLength(1);
      expect(html).toMatch(/<button[^>]*data-primary-move="accept-recap-recommendation"[^>]*data-testid="recap-accept"/);
      expect(html).not.toMatch(/<section[^>]*data-primary-move/);
      for (const i of [0, 1, 2]) expect(renderCard(lang, TRY[lang][0], i)).not.toContain("data-primary-move");
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
