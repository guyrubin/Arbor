import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * B-TODAY-21 — the ONE "What changed since you left" card on Today
 * (ported from sinceLastVisit.test.ts). Three layers:
 *   1. the pure composer (composeWhatChanged): ≤4 EVENT lines in the item's
 *      order — a first · a milestone noticed by title · a step outcome · facts
 *      the parent approved · moments kept with the latest quoted — strictly
 *      newer than the previous visit, plus the Rule-A `noticed` fold;
 *   2. the rendered card (EN + HE): one card, event-only language, bidi-
 *      isolated counts in Hebrew, days together = totalDays only (no streak
 *      walk), hidden when there is nothing to say;
 *   3. OverviewTab wiring: one mount, returning parents only, never on day-0,
 *      the three retired mounts gone, evidence taps keep requestJournalFocus.
 */

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  behaviorLogs: [] as Array<{ id: string; timestamp: string }>,
  playLogs: [] as Array<{ id: string; timestamp: string }>,
  tracked: [] as Array<[string, unknown]>,
}));
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
    behaviorLogs: state.behaviorLogs,
    playLogs: state.playLogs,
    childProfile: { id: "c1", name: "Maya Cohen" },
    setActiveTab: () => undefined,
  }),
}));
vi.mock("../../lib/analytics", () => ({
  track: (name: string, meta: unknown) => {
    state.tracked.push([name, meta]);
  },
}));

import WhatChanged from "./WhatChanged";
import { composeWhatChanged, WHAT_CHANGED_MAX_LINES, WHAT_CHANGED_QUOTE_MAX, type WhatChangedLine } from "./whatChangedEvents";

const T0 = Date.parse("2026-09-28T20:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();
const PREV = iso(T0);
const H = 3_600_000;

const beh = (id: string, atMs: number, trigger = "") => ({ id, timestamp: iso(atMs), trigger });
const play = (id: string, atMs: number, title = "") => ({ id, timestamp: iso(atMs), title });
const ms = (title: string, checked: boolean, atMs?: number) => ({
  title,
  checked,
  observationUpdatedAt: atMs === undefined ? undefined : iso(atMs),
});
const step = (id: string, outcomeAtMs: number, outcome: "helped" | "somewhat" | "not_today", recommendation = "Name the feeling first") => ({
  id,
  recommendation,
  status: "completed" as const,
  acceptedAt: iso(outcomeAtMs - H),
  outcomeAt: iso(outcomeAtMs),
  outcome,
});

const BASE = {
  previousVisitAt: PREV as string | null,
  behaviorLogs: [] as ReturnType<typeof beh>[],
  playLogs: [] as ReturnType<typeof play>[],
  milestones: [] as ReturnType<typeof ms>[],
  actionLoop: [] as ReturnType<typeof step>[],
  approvedFactsSince: 0,
  firstsState: { seen: ["first_milestone" as const] },
  firstsCounts: { milestoneCount: 5 },
};

/* ── 1. the composer ──────────────────────────────────────────────────────── */

describe("composeWhatChanged — events strictly after the previous visit", () => {
  it("no previous visit (first visit / day-0) → no lines", () => {
    const r = composeWhatChanged({ ...BASE, previousVisitAt: null, behaviorLogs: [beh("a", T0 + H)] });
    expect(r).toEqual({ lines: [], hiddenCount: 0 });
  });

  it("nothing new since the visit → no lines (the card hides)", () => {
    const r = composeWhatChanged({
      ...BASE,
      behaviorLogs: [beh("old", T0 - H), beh("boundary", T0)],
      milestones: [ms("Old", true, T0 - H)],
      actionLoop: [step("s0", T0 - 1, "helped")],
    });
    expect(r.lines).toEqual([]);
  });

  it("the five event kinds come in the item's order: first · milestone · step · facts · moments", () => {
    const r = composeWhatChanged({
      ...BASE,
      maxLines: 99,
      firstsState: { seen: [] },
      firstsCounts: { milestoneCount: 2 },
      milestones: [ms("Waves bye-bye", true, T0 + 2 * H), ms("Stacks two blocks", true, T0 + 3 * H)],
      actionLoop: [step("s1", T0 + 4 * H, "helped")],
      approvedFactsSince: 2,
      behaviorLogs: [beh("m1", T0 + 5 * H, "said butterfly")],
    });
    expect(r.lines.map((l) => l.kind)).toEqual(["first", "milestone", "step", "facts", "moments"]);
  });

  it("caps at 4 lines and reports the hidden EVENTS for '+N more in Journal'", () => {
    const r = composeWhatChanged({
      ...BASE,
      milestones: [ms("A", true, T0 + 1), ms("B", true, T0 + 2)],
      actionLoop: [step("s1", T0 + 3, "helped")],
      approvedFactsSince: 1,
      behaviorLogs: [beh("m1", T0 + 4), beh("m2", T0 + 5)],
      playLogs: [play("p1", T0 + 6)],
    });
    expect(WHAT_CHANGED_MAX_LINES).toBe(4);
    expect(r.lines).toHaveLength(4);
    expect(r.lines.map((l) => l.kind)).toEqual(["milestone", "milestone", "step", "facts"]);
    // moments (2 logs + 1 play = 3 events) did not fit.
    expect(r.hiddenCount).toBe(3);
  });

  it("a milestone is named by its title — never 'of total' (no total is even an input)", () => {
    const r = composeWhatChanged({ ...BASE, milestones: [ms("First steps", true, T0 + H), ms("Unchecked", false, T0 + H)] });
    expect(r.lines).toEqual([{ kind: "milestone", title: "First steps", at: T0 + H }]);
  });

  it("a step line is the parent's own outcome report, deep-linked to its journal row", () => {
    const r = composeWhatChanged({
      ...BASE,
      actionLoop: [
        step("s1", T0 + H, "somewhat", "Offer two choices"),
        { ...step("s2", T0 + 2 * H, "helped"), status: "accepted" as const, outcome: undefined, outcomeAt: undefined },
        // TJB-05's firewall carried forward: a step set aside is not news.
        step("s3", T0 + 3 * H, "not_today"),
      ],
    });
    expect(r.lines).toEqual([{ kind: "step", step: "Offer two choices", outcome: "somewhat", focusId: "action-s1", at: T0 + H }]);
  });

  it("ONE moment definition: behaviour logs + plays since the visit, the latest quoted and tappable", () => {
    const r = composeWhatChanged({
      ...BASE,
      behaviorLogs: [beh("m1", T0 + H, "said butterfly"), beh("old", T0 - H, "old one")],
      playLogs: [play("p1", T0 + 3 * H, "Bubble chase")],
    });
    expect(r.lines).toEqual([{ kind: "moments", count: 2, quote: "Bubble chase", focusId: "play-p1" }]);
  });

  it("the quote is clipped to one line", () => {
    const long = "x".repeat(WHAT_CHANGED_QUOTE_MAX + 40);
    const r = composeWhatChanged({ ...BASE, behaviorLogs: [beh("m1", T0 + H, long)] });
    const line = r.lines[0] as Extract<WhatChangedLine, { kind: "moments" }>;
    expect(line.quote.length).toBeLessThanOrEqual(WHAT_CHANGED_QUOTE_MAX);
    expect(line.quote.endsWith("…")).toBe(true);
  });

  it("a first absorbs its own milestone (one event, one line); a seen first is a plain milestone line", () => {
    const first = composeWhatChanged({
      ...BASE,
      firstsState: { seen: [] },
      firstsCounts: { milestoneCount: 1 },
      milestones: [ms("Points at a dog", true, T0 + H)],
    });
    expect(first.lines).toEqual([{ kind: "first", first: "first_milestone", title: "Points at a dog" }]);
    const seen = composeWhatChanged({ ...BASE, firstsCounts: { milestoneCount: 1 }, milestones: [ms("Points at a dog", true, T0 + H)] });
    expect(seen.lines.map((l) => l.kind)).toEqual(["milestone"]);
  });

  it("facts: the count of facts the parent approved since the visit, nothing when zero", () => {
    expect(composeWhatChanged({ ...BASE, approvedFactsSince: 3 }).lines).toEqual([{ kind: "facts", count: 3 }]);
    expect(composeWhatChanged({ ...BASE, approvedFactsSince: 0 }).lines).toEqual([]);
  });

  it("Rule-A fold (law 6): the watch signal always lands inside the 4 lines", () => {
    const r = composeWhatChanged({
      ...BASE,
      includeNoticed: true,
      milestones: [ms("A", true, T0 + 1), ms("B", true, T0 + 2)],
      actionLoop: [step("s1", T0 + 3, "helped")],
      approvedFactsSince: 1,
      behaviorLogs: [beh("m1", T0 + 4)],
    });
    expect(r.lines).toHaveLength(4);
    expect(r.lines.some((l) => l.kind === "noticed")).toBe(true);
  });
});

/* ── 2. the rendered card ─────────────────────────────────────────────────── */

const RECAP_NONE = { currentReport: null, recapUnopened: false, currentId: "2026-W40" } as unknown as Parameters<typeof WhatChanged>[0]["recap"];
const RECAP_READY = { currentReport: { id: "r" }, recapUnopened: true, currentId: "2026-W40" } as unknown as Parameters<typeof WhatChanged>[0]["recap"];

const ALL_KINDS: WhatChangedLine[] = [
  { kind: "first", first: "first_milestone", title: "Points at a dog" },
  { kind: "step", step: "Name the feeling first", outcome: "helped", focusId: "action-s1", at: T0 },
  { kind: "facts", count: 3, },
  { kind: "moments", count: 4, quote: "said butterfly", focusId: "moment-m1" },
];

function render(lines: WhatChangedLine[], lang: "en" | "he", opts: { recap?: boolean; hidden?: number; daysNeeded?: number } = {}) {
  state.lang = lang;
  return renderToStaticMarkup(
    React.createElement(WhatChanged, {
      lines,
      hiddenCount: opts.hidden ?? 0,
      recap: opts.recap ? RECAP_READY : RECAP_NONE,
      rhythmDaysNeeded: opts.daysNeeded,
      onLineTap: () => undefined,
      onMore: () => undefined,
    }),
  );
}

describe("WhatChanged — one card, event lines, both locales", () => {
  state.behaviorLogs = [beh("a", T0 - 48 * H), beh("b", T0 - 24 * H), beh("c", T0)];

  it("EN: one card with the title, the four lines, the quote and days together", () => {
    const html = render(ALL_KINDS, "en", { daysNeeded: 2 });
    expect(html.match(/data-testid="what-changed"/g)).toHaveLength(1);
    expect(html).toContain("What changed since you left");
    expect(html.match(/data-testid="what-changed-line"/g)).toHaveLength(4);
    expect(html).toContain("You noticed something new");
    expect(html).toContain("it helped");
    expect(html).toContain("3 new things you approved about Maya");
    expect(html).toContain("4 moments kept");
    expect(html).toContain("said butterfly");
    expect(html).toContain("3 days of moments together");
    expect(html).toContain('data-testid="today-coldstart-line"');
  });

  it("HE: counts are bidi-isolated (FSI…PDI) and the Hebrew copy renders", () => {
    const html = render(ALL_KINDS, "he", { hidden: 2 });
    expect(html).toContain("מה חדש מאז שהייתם כאן");
    expect(html).toContain("⁨3⁩ דברים חדשים שאישרתם על ⁨Maya⁩");
    expect(html).toContain("⁨4⁩ רגעים נשמרו");
    expect(html).toContain("עוד ⁨2⁩ ביומן");
    expect(html).toContain("⁨3⁩ ימים של רגעים יחד");
    // the Latin step inside a Hebrew line is isolated too
    expect(html).toContain("⁨Name the feeling first⁩");
    expect(html, "no double isolation").not.toContain("⁨⁨");
  });

  it("the recap-ready line rides at the top of the card when the week is unopened", () => {
    const html = render([], "en", { recap: true });
    expect(html).toContain('data-testid="what-changed-recap"');
    expect(html).toContain("Your week with Maya is ready");
  });

  it("hidden when there are no events and no recap line", () => {
    expect(render([], "en")).toBe("");
    expect(render([], "he")).toBe("");
  });

  it("every line is a ≥44 px tap", () => {
    const html = render(ALL_KINDS, "en");
    const buttons = html.match(/<button[^>]*data-testid="what-changed-line"[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(4);
    for (const b of buttons) expect(b).toMatch(/min-h-11/);
  });

  it("the watch-signal line is neutral ink (no verdict colour)", () => {
    const html = render([{ kind: "noticed" }], "en");
    expect(html).toContain("Arbor noticed something");
    expect(html).not.toMatch(/--arbor-(peach|coral|red|amber)/);
  });
});

/* ── 3. source-level wiring ───────────────────────────────────────────────── */

const SRC_ROOT = path.resolve(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("OverviewTab wiring — ONE What-changed card", () => {
  const overview = stripComments(read("components/tabs/OverviewTab.tsx"));
  const card = stripComments(read("components/overview/WhatChanged.tsx"));

  it("one mount, inside its data-module stamp, after the primary-action slot", () => {
    expect(overview.match(/<WhatChanged\b/g)).toHaveLength(1);
    expect(overview).toMatch(/showChanged\s*&&\s*\(\s*<div data-module="today-changed"[^>]*>\s*<WhatChanged/);
    expect(overview.indexOf("<WhatChanged")).toBeGreaterThan(overview.indexOf("<TodayActionLoop"));
  });

  it("the four restatements are gone: SinceLastVisit, ProgressNarrative, the dev-map count card", () => {
    expect(overview).not.toMatch(/<SinceLastVisit\b|<ProgressNarrative\b/);
    expect(overview).not.toContain("devscore.noticed");
    expect(overview).not.toContain("devscore.stat.");
    expect(overview).not.toContain("useDevScore");
    expect(overview).not.toContain("today.intent.memoryLine");
    expect(fs.existsSync(path.join(SRC_ROOT, "components/overview/SinceLastVisit.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(SRC_ROOT, "components/overview/ProgressNarrative.tsx"))).toBe(false);
  });

  it("returning parents only, never on day-0", () => {
    expect(overview).toMatch(/previousVisitAt:\s*isReturning\s*&&\s*!dayZero\s*\?\s*previousVisitAt\s*:\s*null/);
    expect(overview).toMatch(/changedWould\s*=\s*!dayZero\s*&&\s*isReturning/);
    expect(overview).toMatch(/changed:\s*changedWould/);
  });

  it("evidence taps keep the requestJournalFocus seam", () => {
    expect(overview).toMatch(/requestJournalFocus\(line\.focusId\)/);
  });

  it("Rule-A fold: the watch signal folds into the card when Today is full", () => {
    expect(overview).toMatch(/foldNoticed\s*=\s*modulePlan\.demoted\.includes\("noticed"\)/);
    expect(overview).toMatch(/foldNoticed\s*\?\s*composeChanged\(true\)/);
  });

  it("days together = totalDays only (no streak walk), KPI names kept", () => {
    expect(card).toMatch(/computeStreak\([^)]*\)\)\.totalDays/);
    expect(card).not.toMatch(/\.(current|longest|currentStreak|walk)\b/);
    expect(card).toContain('track("sincevisit_shown"');
    expect(card).toContain('track("sincevisit_row_tap"');
  });
});
