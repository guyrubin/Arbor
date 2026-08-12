/**
 * AR-UI clinical-firewall guard — the Today "developing picture" narrative.
 *
 * Standing constraint (docs/ARBOR-IA-WIREFRAME-MASTERPLAN-2026-07-03.md §2,
 * restated in docs/ARBOR-UI-MASTERPLAN-2026-08-11.md §1): child-data PARENT
 * surfaces carry COUNTS and observational language only — no trend deltas, no
 * grading, no verdicts. Masterplan 1.1 puts it as "EVENT language only — never
 * comparative" for the continuity surfaces.
 *
 * History: ProgressNarrative's "What changed" cell closed with
 *   "{thisWeek} moments this week vs {lastWeek} last week."
 * (today.narrative.weekCompare, EN + HE). Two week counts side by side ARE a
 * trend delta, and this cell is titled "What changed for <name>" — so it read
 * as a comparison of the CHILD, sitting directly beneath a since-visit strip
 * that is scrupulously event-only. It was replaced by a single current-week
 * count (today.narrative.weekCount) that keeps the parent's capture momentum
 * without a prior window to measure the child against.
 *
 * This is a Screening.firewall.test.ts-style SOURCE + DICTIONARY scan: it fails
 * the build if comparative phrasing returns to this surface in either language,
 * or if a prior-window count is interpolated into rendered copy again. The
 * negative-control half feeds the scanners the VERBATIM pre-fix strings, so the
 * guard can never rot into a vacuous pass.
 *
 * Deliberately NOT banned: the word "week" itself (a single current-week count
 * is the point), and the `momentsLastWeek` PROP, which is retained (deprecated,
 * unread) only so the OverviewTab call site keeps compiling.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { en, he } from "../../lib/i18n";

const here = path.dirname(fileURLToPath(import.meta.url));
const rawSrc = readFileSync(path.join(here, "ProgressNarrative.tsx"), "utf8");
/** Comments explain the ban, so they legitimately quote the banned words. Only
 *  code + string literals are scanned. */
const src = rawSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* ── Banned comparative phrasing (copy, both languages) ───────────────────── */
const COMPARATIVE: { name: string; re: RegExp }[] = [
  { name: "EN 'vs'", re: /\bvs\.?\b/i },
  { name: "EN 'than last'", re: /\bthan\s+last\b/i },
  { name: "EN 'more than' / 'less than' / 'fewer than'", re: /\b(?:more|less|fewer)\s+than\b/i },
  { name: "EN 'compare(d)'", re: /\bcompar(?:e|ed|ison)\b/i },
  { name: "EN prior-window reference ('last week' / 'the week before')", re: /\blast\s+week\b|\bweek\s+before\b/i },
  { name: "HE 'לעומת' (vs)", re: /לעומת/ },
  { name: "HE 'יותר מ' (more than)", re: /יותר\s+מ/ },
  { name: "HE 'שבוע שעבר' (last week)", re: /שבוע\s+שעבר/ },
];

/* ── Banned MECHANISM in the component (a prior-window count reaching copy) ── */
const M1_LASTWEEK_ARG = /\blastWeek\s*:/;
const M2_PREV_COUNT_IN_TEMPLATE = /t\(\s*["'][^"']*["'][^)]*momentsLastWeek/;

const firstHit = (text: string) => COMPARATIVE.find(({ re }) => re.test(text))?.name ?? null;

/* ── Negative controls: verbatim pre-fix fixtures ─────────────────────────── */
const OLD_EN_VALUE = "{thisWeek} moments this week vs {lastWeek} last week.";
const OLD_HE_VALUE = "{thisWeek} רגעים השבוע לעומת {lastWeek} בשבוע שעבר.";
const OLD_SRC_LINE =
  'const weekCompare = t("today.narrative.weekCompare", { thisWeek: recentBehaviors.length, lastWeek: momentsLastWeek });';
const OLD_RENDER_LINE =
  "<NarrativeCell icon=\"moving\" title={copy.changed} body={hasEvidence ? `${copy.changedBody} ${weekCompare}` : copy.noChange} />";

describe("firewall guard — the scanners still catch the OLD comparative", () => {
  it("catches the EN week-vs-week value", () => {
    expect(firstHit(OLD_EN_VALUE)).toBe("EN 'vs'");
    // and it is caught by the prior-window rule too, not by 'vs' alone
    expect(/\blast\s+week\b/i.test(OLD_EN_VALUE)).toBe(true);
  });

  it("catches the HE week-vs-week value", () => {
    expect(firstHit(OLD_HE_VALUE)).toBe("HE 'לעומת' (vs)");
    expect(/שבוע\s+שעבר/.test(OLD_HE_VALUE)).toBe(true);
  });

  it("catches the component line that fed last week's count into the template", () => {
    expect(M1_LASTWEEK_ARG.test(OLD_SRC_LINE)).toBe(true);
    expect(M2_PREV_COUNT_IN_TEMPLATE.test(OLD_SRC_LINE)).toBe(true);
  });

  it("the mechanism regexes do NOT fire on the retained (unread) prop declaration", () => {
    expect(M1_LASTWEEK_ARG.test("momentsLastWeek?: number;")).toBe(false);
    expect(M2_PREV_COUNT_IN_TEMPLATE.test("momentsLastWeek?: number;")).toBe(false);
  });

  it("the old render line is exactly what the current source no longer contains", () => {
    expect(src).not.toContain(OLD_RENDER_LINE);
    expect(src).not.toContain("weekCompare");
  });
});

describe("firewall guard — ProgressNarrative source is comparison-free", () => {
  it("interpolates no prior-window count into rendered copy", () => {
    expect(src).not.toMatch(M1_LASTWEEK_ARG);
    expect(src).not.toMatch(M2_PREV_COUNT_IN_TEMPLATE);
  });

  it("carries no comparative phrasing in its own literals", () => {
    expect(firstHit(src), "comparative phrasing in ProgressNarrative.tsx").toBeNull();
  });

  it("still renders the non-comparative current-week count (momentum kept)", () => {
    expect(src).toContain("today.narrative.weekCount");
    expect(src).toContain("${copy.changedBody} ${weekCount}");
  });
});

describe("firewall guard — today.narrative.* copy is comparison-free in BOTH languages", () => {
  const dicts: [string, Record<string, string>][] = [
    ["en", en as Record<string, string>],
    ["he", he as Record<string, string>],
  ];

  for (const [lang, dict] of dicts) {
    it(`${lang}: no today.narrative.* value carries a comparative`, () => {
      const keys = Object.keys(dict).filter((k) => k.startsWith("today.narrative."));
      expect(keys.length, `${lang} has no today.narrative.* keys`).toBeGreaterThan(0);
      for (const k of keys) {
        expect(firstHit(dict[k]), `${lang} ${k} = "${dict[k]}"`).toBeNull();
      }
    });

    it(`${lang}: the week sentence exists and carries ONE count placeholder`, () => {
      const value = dict["today.narrative.weekCount"];
      expect(value, `${lang} missing today.narrative.weekCount`).toBeTruthy();
      expect(value).toContain("{moments}");
      expect(value).not.toContain("{lastWeek}");
      expect(value).not.toContain("{thisWeek}");
      expect(dict["today.narrative.weekCompare"], "retired comparative key is back").toBeUndefined();
    });
  }
});
