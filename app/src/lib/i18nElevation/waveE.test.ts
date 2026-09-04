/**
 * waveE.test.ts — Wave E copy + wiring guard (ENG-13 / ENG-14 / ENG-16).
 *
 * Two jobs:
 *  1. The copy firewall. Every Wave-E string is about a COUNT of things the
 *     parent noticed. Not one may become a score, a percentage, a target, a
 *     delta, or a streak — the ENG-13 guard in the backlog names the streak
 *     ban explicitly ("streak|in a row|don't break").
 *  2. The mounts. This wave's failure mode in this codebase is capability
 *     BUILT and never MOUNTED, so the surfaces are pinned by source scan —
 *     normalised for CRLF, guarded with toBeTruthy(), and each carrying a
 *     negative control in the pre-change shape (a scan that returns an empty
 *     string passes vacuously).
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { en, he } from "./waveE";
import { elevationEn, elevationHe } from "./index";
import { FIRST_KINDS } from "../firsts";
import { MONTH_CARD_IDS } from "../keepsakeMonth";

const read = (rel: string) =>
  fs
    .readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("registration — an unregistered module is invisible to the app", () => {
  it("every key reaches the merged Elevation dictionaries, EN and HE", () => {
    expect(Object.keys(en).length).toBeGreaterThan(0);
    for (const key of Object.keys(en)) {
      expect(elevationEn[key]).toBeTruthy();
      expect(elevationHe[key]).toBeTruthy();
    }
  });

  it("EN and HE cover exactly the same keys", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
  });

  it("every key is namespaced elev.* (a bare key would silently lose the merge)", () => {
    for (const key of Object.keys(en)) expect(key.startsWith("elev.")).toBe(true);
  });

  it("every kind the code can ask for actually has copy", () => {
    for (const kind of FIRST_KINDS) {
      expect(en[`elev.firsts.${kind}.title`]).toBeTruthy();
      expect(en[`elev.firsts.${kind}.sub`]).toBeTruthy();
      expect(he[`elev.firsts.${kind}.title`]).toBeTruthy();
    }
    for (const id of MONTH_CARD_IDS) {
      expect(en[`elev.keepsake.month.card.${id}`]).toBeTruthy();
      expect(he[`elev.keepsake.month.card.${id}`]).toBeTruthy();
    }
  });
});

describe("clinical firewall — counts, never verdicts", () => {
  const BANNED_EN = [
    "%",
    "percent",
    "score",
    "streak",
    "in a row",
    "don't break",
    "keep it up",
    "on track",
    "behind",
    "ahead of",
    "should be",
    "normal for",
    "delay",
    "risk",
    "improve",
    "better than",
    "out of",
  ];

  it("no English string carries a score, a target or a streak", () => {
    for (const [key, value] of Object.entries(en)) {
      const lower = value.toLowerCase();
      for (const banned of BANNED_EN) {
        expect(`${key}: ${lower}`).not.toContain(banned);
      }
    }
  });

  it("no Hebrew string carries a percentage, a score word or a streak word", () => {
    const BANNED_HE = ["%", "ציון", "אחוז", "רצף", "ברצף", "פיגור", "סיכון", "אמור להיות"];
    for (const [key, value] of Object.entries(he)) {
      for (const banned of BANNED_HE) {
        expect(`${key}: ${value}`).not.toContain(banned);
      }
    }
  });

  it("no string implies a denominator — a count is never 'of' anything", () => {
    for (const value of Object.values(en)) {
      expect(value).not.toMatch(/\{count\}\s*(of|\/)\s*\d|\bof\s*\{total\}/i);
    }
  });

  it("NEGATIVE CONTROL: the scanner really would catch a bad string", () => {
    const bad = { "elev.knows.title": "Arbor knows 3 of 20 things — 15% complete" };
    const hits = Object.values(bad).filter((v) =>
      BANNED_EN.some((b) => v.toLowerCase().includes(b)),
    );
    expect(hits).toHaveLength(1);
  });
});

describe("mounts — capability built AND wired", () => {
  const childMemory = read("components/sections/ChildMemory.tsx");
  const knowsTile = read("components/sections/ArborKnowsTile.tsx");
  const firstsCard = read("components/sections/FirstsMoment.tsx");
  const monthCard = read("components/weekly/MonthKeepsake.tsx");
  const bedtime = read("components/tabs/BedtimeStoriesTab.tsx");
  const journal = read("components/journal/JournalEntrySheet.tsx");

  it("the scanned files are real (a vacuous scan is not a pass)", () => {
    for (const src of [childMemory, knowsTile, firstsCard, monthCard, bedtime, journal]) {
      expect(src).toBeTruthy();
      expect(src.length).toBeGreaterThan(300);
    }
  });

  it("ENG-13/14: ChildMemory mounts the firsts card, the knows tile and the month keepsake", () => {
    expect(childMemory).toContain("<FirstsMoment />");
    expect(childMemory).toContain("<ArborKnowsTile />");
    expect(childMemory).toContain("<MonthKeepsake />");
    // Imported, not just referenced in prose.
    expect(childMemory).toMatch(/import ArborKnowsTile from "\.\/ArborKnowsTile"/);
    expect(childMemory).toMatch(/import FirstsMoment from "\.\/FirstsMoment"/);
    expect(childMemory).toMatch(/import MonthKeepsake from "\.\.\/weekly\/MonthKeepsake"/);
  });

  it("ENG-14: the tile renders a count and NEVER a ring, bar or denominator", () => {
    expect(knowsTile).toContain("arborKnows(");
    expect(knowsTile).toContain("countProfileFacts(");
    // Negative controls: the shapes a progress ring would need.
    expect(knowsTile).not.toMatch(/progress|circumference|strokeDasharray|width:\s*`?\$\{.*%/i);
    expect(knowsTile).not.toMatch(/\/\s*(TOTAL|MAX|target)/);
  });

  it("ENG-13: the card is dismissible at 44px and persists so it cannot repeat", () => {
    expect(firstsCard).toContain("firstsStorageKey(childId)");
    expect(firstsCard).toContain("mergeFirsts(");
    expect(firstsCard).toMatch(/width:\s*44,\s*height:\s*44/);
    // No confetti anywhere — a calm card has no caps to breach.
    expect(firstsCard).not.toContain("canvas-confetti");
    expect(firstsCard).not.toContain("celebrate(");
  });

  it("ENG-14: the month card offers once and cannot see a second month", () => {
    expect(monthCard).toContain("shouldOfferMonthKeepsake(");
    expect(monthCard).toContain("monthKeepsakeStorageKey(childId)");
    // Negative control: no comparison against a previous keepsake anywhere.
    expect(monthCard).not.toMatch(/previousKeepsake|lastMonthCount|delta|vsLastMonth/);
  });

  it("ENG-16: a journal moment can be kept, in the parent's OWN words only", () => {
    expect(journal).toContain('surface="journal_moment"');
    // Parent-owned rows only — an Arbor- or child-authored row is a record.
    expect(journal).toMatch(/prov === "manual" && \(\s*<ShareButton/);
    // The answer_card fallback caption reads "What Arbor told me about
    // {name}" — on the parent's own sentence that is a false attribution, so
    // an explicit caption key is mandatory here.
    expect(journal).toContain('captionKey="elev.share.caption.journal"');
    const opts = journal.match(/getCardOpts=\{\(\): ShareCardOpts => \(\{[^}]*\}\)\}/)?.[0];
    expect(opts).toBeTruthy();
    expect(opts).toContain("question: title");
    expect(opts).toContain("takeaway: detail");
    // Nothing Arbor derived, and no photo, may reach the card.
    expect(opts).not.toMatch(/domainLabel|provLabel|photo|when/);
  });

  it("ENG-16: the bedtime story finally has a share, and it shares the COVER only", () => {
    expect(bedtime).toContain("<ShareButton");
    expect(bedtime).toContain('artifact="story"');
    expect(bedtime).toContain('surface="bedtime_story"');
    const opts = bedtime.match(/getCardOpts=\{\(\): ShareCardOpts => \(\{[^}]*\}\)\}/)?.[0];
    expect(opts).toBeTruthy();
    expect(opts).toContain("title: story.title");
    // The story body, the goodnight questions and the parent-only summary must
    // never reach a shareable image.
    expect(opts).not.toMatch(/pages|summary|discussionQuestions|body/);
  });
});
