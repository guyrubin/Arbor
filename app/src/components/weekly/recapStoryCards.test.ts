import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const langState = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(langState.lang, k, v),
      uiLang: langState.lang,
    }),
  };
});
vi.mock("../../lib/analytics", () => ({ track: () => undefined }));
vi.mock("../ui/ShareButton", () => ({ default: () => null, ShareButton: () => null }));

import RecapStoryCards, { buildRecapCards, type RecapCard, type RecapRecord } from "./RecapStoryCards";
import { weeklyChipIds, isEmptyCurrentWeek } from "./weeklySelection";
import { en as rcEn, he as rcHe } from "../../lib/i18nElevation/recap";
import { recapWeekId, recapWeekStartMs, type WeeklyReport } from "../../hooks/useWeeklyRecap";
import type { WeeklyDigest } from "../../lib/api";
import { todayLiveSource } from "../../testTodaySource";

/**
 * W2 2.1/2.2/2.3 — the weekly recap ritual (masterplan 2026-08-11 §4 ·
 * Maytal Row-1 #2/#4/#6), rebuilt by B-TODAY-23 as the "What changed?"
 * four-card letter. Four layers:
 *   1. the pure card builder (ALWAYS 4 cards — New this week · What helped ·
 *      In your words · the ONE recommendation LAST) and the rendered letter
 *      (EN + HE, no delta/%/"of" totals, card 3 never on the network),
 *   2. the i18n module contract (en/he parity, namespacing, clinical
 *      firewall: counts, never trend/comparative wording or arrows),
 *   3. source structure: story cards are button+keyboard navigated (no
 *      gesture lib), reduced-motion aware, share on the final card only,
 *      instrumented; the strip carries the recap entry + counter lines;
 *      WeeklyTab renders the cards as the current week's primary view and
 *      ships the fail-closed email opt-in,
 *   4. the lib/streak resettable-value BAN: no recap/strip file may touch
 *      the `.current` member at all — totalDays is the only renderable
 *      continuity number (masterplan 2.3).
 */

const digest = (over: Partial<WeeklyDigest> = {}): WeeklyDigest => ({
  title: "Maya's week",
  subject: "Maya's week in review",
  preheader: "Three lovely moments",
  summary: "A calm, connected week with three captured moments.",
  highlights: ["You captured 3 moments.", "Two bedtime wins.", "One shared laugh at dinner."],
  watchFor: ["Transitions before kindergarten came up twice."],
  tryThisWeek: "Name the next transition 5 minutes ahead, once this week.",
  generated: "ai",
  stats: {
    weekOf: "2026-08-03",
    daysCovered: 4,
    momentsLogged: 3,
    previousWeekMoments: 999, // sentinel: must NEVER surface on a card
    resolvedCount: 2,
    topContext: "Home",
    topBehavior: "Transition refusal",
    milestonesDone: 5,
    milestonesTotal: 12,
  },
  ...over,
});

const report = (over: Partial<WeeklyDigest> = {}): WeeklyReport & { digest: WeeklyDigest } => ({
  id: "2026-W40",
  weekLabel: "Week of September 27",
  generatedAt: "2026-10-01T06:00:00.000Z",
  summary: { count: 3, resolved: 2, topTrigger: "Transitions" },
  milestoneWins: ["First steps"],
  planProgress: { done: 1, total: 4 },
  spotlight: { name: "Dr. X", concept: "Co-regulation", value: "Calm is contagious." },
  insight: "insight",
  digest: digest(over),
});

/* ── 1. the pure four-card letter (B-TODAY-23) ────────────────────────────── */

const NOW = new Date("2026-10-01T12:00:00.000Z");
const WEEK_START = recapWeekStartMs(NOW);
const H = 3_600_000;
const at = (offsetH: number) => new Date(WEEK_START + offsetH * H).toISOString();
const before = (h: number) => new Date(WEEK_START - h * H).toISOString();

const record = (over: Partial<RecapRecord> = {}): RecapRecord => ({
  weekStartMs: WEEK_START,
  behaviorLogs: [
    { id: "m1", timestamp: at(2), trigger: "said butterfly at the window" },
    { id: "m2", timestamp: at(5), trigger: "built a tower with her brother" },
    { id: "m3", timestamp: at(9), notes: "fell asleep singing" },
    { id: "old", timestamp: before(2), trigger: "LAST WEEK TEXT" },
  ],
  playLogs: [{ id: "p1", timestamp: at(3), title: "Bubble chase" }],
  milestones: [
    { title: "Stacks two blocks", checked: true, observationUpdatedAt: at(4) },
    { title: "Old milestone", checked: true, observationUpdatedAt: before(30) },
  ],
  actionLoop: [
    { id: "a1", recommendation: "Name the next transition", status: "completed", acceptedAt: at(1), outcomeAt: at(6), outcome: "helped" },
    { id: "a2", recommendation: "Name the next transition", status: "completed", acceptedAt: at(10), outcomeAt: at(12), outcome: "helped" },
    { id: "a3", recommendation: "Name the next transition", status: "completed", acceptedAt: at(20), outcomeAt: at(22), outcome: "not_today" },
    { id: "a4", recommendation: "Offer two choices", status: "completed", acceptedAt: at(13), outcomeAt: at(14), outcome: "somewhat" },
    { id: "a0", recommendation: "Last week's step", status: "completed", acceptedAt: before(10), outcomeAt: before(9), outcome: "helped" },
  ],
  approvedFacts: [{ createdAt: at(7) }, { createdAt: at(8) }, { createdAt: before(40) }],
  keptIdeas: [{ createdAt: at(11) }],
  firstsState: { seen: ["first_milestone"] },
  milestoneCount: 2,
  promptKey: "elev.prompt.toddler.1",
  ...over,
});

describe("recapWeekStartMs — the report id's own calendar week", () => {
  it("the start is inside the week and the instant before it is not", () => {
    expect(recapWeekId(new Date(WEEK_START))).toBe(recapWeekId(NOW));
    expect(recapWeekId(new Date(WEEK_START - 1))).not.toBe(recapWeekId(NOW));
    expect(NOW.getTime() - WEEK_START).toBeLessThanOrEqual(7 * 24 * H);
  });
});

describe("buildRecapCards — always four cards, the last is the recommendation", () => {
  it("New this week · What helped · In your words · One thing for next week", () => {
    const cards = buildRecapCards(report(), record());
    expect(cards.map((c) => c.kind)).toEqual(["new", "helped", "words", "recommendation"]);
    // …and still four on an empty week.
    const empty = buildRecapCards(report(), record({ behaviorLogs: [], playLogs: [], milestones: [], actionLoop: [], approvedFacts: [], keptIdeas: [] }));
    expect(empty.map((c) => c.kind)).toEqual(["new", "helped", "words", "recommendation"]);
  });

  it("the LAST card is the recommendation, and it is the ONLY one", () => {
    const cards = buildRecapCards(report(), record());
    expect(cards.filter((c) => c.kind === "recommendation")).toHaveLength(1);
    const rec = cards[3] as Extract<RecapCard, { kind: "recommendation" }>;
    expect(rec.text).toBe(report().digest.tryThisWeek);
  });

  it("card 1 = composeWhatChanged over the week: milestone by title, facts, kept ideas, moments — no steps", () => {
    const c = buildRecapCards(report(), record())[0] as Extract<RecapCard, { kind: "new" }>;
    expect(c.lines.map((l) => l.kind)).toEqual(["milestone", "facts", "ideas", "moments"]);
    expect(c.lines[0]).toMatchObject({ title: "Stacks two blocks" });
    expect(c.lines[1]).toMatchObject({ count: 2 });
    expect(c.lines[2]).toMatchObject({ count: 1 });
    // ONE moment definition: 3 logs + 1 play this week; last week's log is out.
    expect(c.lines[3]).toMatchObject({ count: 4 });
  });

  it("card 2 groups the parent's own step reports by step, newest first; last week is out", () => {
    const c = buildRecapCards(report(), record())[1] as Extract<RecapCard, { kind: "helped" }>;
    expect(c.steps).toEqual([
      { step: "Name the next transition", helped: 2, somewhat: 0, notToday: 1 },
      { step: "Offer two choices", helped: 0, somewhat: 1, notToday: 0 },
    ]);
  });

  it("card 3 quotes up to 3 of the parent's own texts this week; < 3 moments → one prompt question", () => {
    const c = buildRecapCards(report(), record())[2] as Extract<RecapCard, { kind: "words" }>;
    expect(c.quotes).toEqual(["fell asleep singing", "built a tower with her brother", "said butterfly at the window"]);
    expect(c.promptKey).toBeNull();
    expect(JSON.stringify(c)).not.toContain("LAST WEEK TEXT");
    const quiet = buildRecapCards(report(), record({ behaviorLogs: record().behaviorLogs.slice(0, 2) }))[2] as Extract<RecapCard, { kind: "words" }>;
    expect(quiet.quotes).toEqual([]);
    expect(quiet.promptKey).toBe("elev.prompt.toddler.1");
  });

  it("the digest's model paragraph, chips, highlights and watchFor never reach a card", () => {
    const cards = JSON.stringify(buildRecapCards(report(), record()));
    expect(cards).not.toContain("999"); // previousWeekMoments sentinel
    expect(cards).not.toContain(digest().summary);
    expect(cards).not.toContain("Transitions before kindergarten");
    expect(cards).not.toContain("Two bedtime wins");
  });
});

/* ── 1b. the rendered letter (EN + HE) and the network seal on card 3 ────── */

const renderCard = (index: number, lang: "en" | "he", rec: RecapRecord = record()) => {
  langState.lang = lang;
  return renderToStaticMarkup(
    React.createElement(RecapStoryCards, {
      report: report(),
      record: rec,
      childName: "Maya Cohen",
      canAccept: true,
      accepted: false,
      onAccept: () => undefined,
      onCapture: () => undefined,
      initialIndex: index,
    }),
  );
};
const visible = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
/** The acceptance vocabulary, shared with whatChanged.firewall.test.ts. */
const LETTER_BANNED = /\bof\s+\{?total\}?|\bvs\.?(?=\s|$)|%|\bmore\s+than\b|\bfewer\b|\bup\b|\bdown\b|מתוך|יותר|פחות|\d+\s*\/\s*\d+/i;

describe("RecapStoryCards — the rendered letter", () => {
  it("EN: card 1 lists the week's events as counts and titles", () => {
    const html = renderCard(0, "en");
    expect(html).toContain("New this week");
    expect(html).toContain("Noticed: Stacks two blocks");
    expect(html).toContain("2 new things you approved about Maya");
    expect(html).toContain("1 idea you kept");
    expect(html).toContain("4 moments kept");
    // the quote is card 3's, not card 1's
    expect(html).not.toContain("fell asleep singing");
  });

  it("EN: card 2's subject is the step, never the child", () => {
    const html = renderCard(1, "en");
    expect(html).toContain("Name the next transition");
    expect(html).toContain("helped 2 · not today 1");
    expect(html).toContain("helped a little 1");
    expect(visible(html)).not.toMatch(/\bMaya\b/);
  });

  it("HE: counts are bidi-isolated and the letter is Hebrew", () => {
    const one = renderCard(0, "he");
    expect(one).toContain("חדש השבוע");
    expect(one).toContain("⁨4⁩ רגעים נשמרו");
    const two = renderCard(1, "he");
    expect(two).toContain("עזר ⁨2⁩ · לא היום ⁨1⁩");
  });

  it("card 3 renders the parent's words quoted, dir=auto; the fallback is one question + a 44 px capture move", () => {
    const words = renderCard(2, "en");
    expect(words).toContain("In your words");
    expect(words).toMatch(/<blockquote dir="auto"[^>]*>“fell asleep singing”/);
    const quiet = renderCard(2, "he", record({ behaviorLogs: [] }));
    expect(quiet).toContain('data-testid="recap-words-capture"');
    expect(quiet).toContain("min-h-[44px]");
    expect(quiet).toContain("שאלה לשבוע הזה");
  });

  it("card 4 is the recommendation, the only card with the accept move and the share", () => {
    const html = renderCard(3, "en");
    expect(html).toContain(report().digest.tryThisWeek);
    for (const i of [0, 1, 2]) expect(renderCard(i, "en")).not.toContain("recap-move-note");
  });

  it("no delta, %, 'of' total or denominator on any card, EN + HE", () => {
    for (const lang of ["en", "he"] as const) {
      for (const i of [0, 1, 2, 3]) {
        const text = visible(renderCard(i, lang));
        expect(text.match(LETTER_BANNED)?.[0] ?? null, `${lang} card ${i + 1}: ${text}`).toBeNull();
      }
    }
  });

  it("card 3 is never sent to the network (spied fetch stays silent while every card renders)", () => {
    const spy = vi.fn(() => Promise.reject(new Error("network")));
    const real = globalThis.fetch;
    globalThis.fetch = spy as unknown as typeof fetch;
    try {
      for (const i of [0, 1, 2, 3]) renderCard(i, "en");
      buildRecapCards(report(), record());
    } finally {
      globalThis.fetch = real;
    }
    expect(spy).not.toHaveBeenCalled();
    // …and no request seam is reachable from the letter or its record.
    const letter = stripComments(read("components/weekly/RecapStoryCards.tsx"));
    expect(letter).not.toMatch(/\bfetch\(|\bapi\.|\bpost\(/);
    const weekly = stripComments(read("components/tabs/WeeklyTab.tsx"));
    expect(weekly).not.toMatch(/api\.[a-zA-Z]+\([^)]*recapRecord/);
  });
});

/* ── 2. i18n module contract + clinical firewall ──────────────────────────── */

// EVENT/count language only (same banned classes the since-strip pins). The
// `u` flag keeps the emoji class from matching lone surrogate halves.
const BANNED_EN = /\bmore than\b|\bless than\b|\bfaster\b|\bslower\b|\bimproved\b|\bdeclined\b|\bbehind\b|\bahead of\b|\btrend\b|[↑↓📈📉]|\d+\s*%/iu;
const BANNED_HE = /יותר מ|פחות מ|מהר יותר|לאט יותר|שיפור|ירידה|מגמה|בפיגור/;
// The recap is also streak-free: no resettable-run wording anywhere.
const BANNED_STREAK = /\bstreak\b|\bin a row\b|ברצף|רצף של/i;

describe("i18nElevation/recap — en/he records", () => {
  it("keys are namespaced, parity holds, and no value is empty", () => {
    expect(Object.keys(rcEn).sort()).toEqual(Object.keys(rcHe).sort());
    for (const [k, v] of [...Object.entries(rcEn), ...Object.entries(rcHe)]) {
      expect(k.startsWith("elev.recap."), `${k} must be namespaced elev.recap.*`).toBe(true);
      expect(v.trim().length, `${k} is empty`).toBeGreaterThan(0);
    }
  });

  it("both records interpolate the same {var} tokens per key", () => {
    const vars = (s: string) => (s.match(/\{[a-z]+\}/gi) ?? []).sort();
    for (const k of Object.keys(rcEn)) {
      expect(vars(rcHe[k]), `{var} mismatch on ${k}`).toEqual(vars(rcEn[k]));
    }
  });

  it("clinical firewall: counts only — no comparative/trend wording, arrows, %, or streaks", () => {
    for (const [k, v] of Object.entries(rcEn)) {
      expect(v, `en ${k} carries trend wording`).not.toMatch(BANNED_EN);
      expect(v, `en ${k} carries streak wording`).not.toMatch(BANNED_STREAK);
    }
    for (const [k, v] of Object.entries(rcHe)) {
      expect(v, `he ${k} carries trend wording`).not.toMatch(BANNED_HE);
      expect(v, `he ${k} carries streak wording`).not.toMatch(BANNED_STREAK);
    }
  });

  it("the letter's voice ships: four card eyebrows EN + HE, ready line", () => {
    expect(rcEn["elev.recap.new.eyebrow"]).toBe("New this week");
    expect(rcHe["elev.recap.helped.eyebrow"]).toBe("מה עזר");
    expect(rcHe["elev.recap.words.eyebrow"]).toBe("במילים שלכם");
    expect(rcEn["elev.recap.try.eyebrow"]).toBeTruthy();
    // B-TODAY-23 retired the model-paragraph / chips / three-block cards.
    for (const k of ["elev.recap.wentwell.title", "elev.recap.block.attention", "elev.recap.chip.days"]) expect(rcEn[k]).toBeUndefined();
    expect(rcEn["elev.recap.ready"]).toContain("{name}");
    expect(rcEn["elev.recap.days"]).toContain("days of moments together");
  });
});

/* ── 3. source-level structure (house pattern: node env, source scans) ────── */

const SRC_ROOT = path.resolve(__dirname, "..", "..");
const read = (rel: string): string => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
const stripComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("RecapStoryCards — swipe affordance without a gesture lib", () => {
  const raw = read("components/weekly/RecapStoryCards.tsx");
  const code = stripComments(raw);

  it("buttons + keyboard + reduced-motion path; no gesture library", () => {
    expect(code).toContain("ArrowRight");
    expect(code).toContain("ArrowLeft");
    expect(code).toContain("useReducedMotion");
    expect(raw).not.toMatch(/use-gesture|react-swipeable|swiper|hammerjs/i);
  });

  it("parent-mediated ShareButton renders on the FINAL card only (one mount, recommendation branch)", () => {
    expect(code.match(/<ShareButton/g) ?? []).toHaveLength(1);
    const recBranch = code.slice(code.indexOf('card.kind === "recommendation" && ('));
    expect(recBranch).toContain("<ShareButton");
  });

  it("instruments the ritual: recap_opened, recap_card_view {i}, recap_try_accept", () => {
    expect(code).toContain('track("recap_opened"');
    expect(code).toContain('track("recap_card_view", { i: index })');
    expect(code).toContain('track("recap_try_accept"');
  });

  it("no comparative/trend wording in the component source (firewall)", () => {
    expect(code).not.toMatch(BANNED_EN);
    expect(code).not.toMatch(BANNED_HE);
  });
});

// B-TODAY-21: the since-strip folded into the ONE "What changed since you
// left" card, which now carries the recap entry line and the counter.
describe("What-changed integration — recap entry line + continuity counter", () => {
  const code = stripComments(read("components/overview/WhatChanged.tsx"));

  it("reads the app-open auto-generate mount, which Today owns since B-TODAY-08", () => {
    // OverviewTab mounts useWeeklyRecap() once and passes it to the strip.
    expect(stripComments(todayLiveSource())).toContain("useWeeklyRecap()");
    expect(code).toContain("recap: ReturnType<typeof useWeeklyRecap>;");
    expect(code).not.toContain("useWeeklyRecap()");
  });

  it("the unopened-recap entry line deep-links to the weekly recap", () => {
    expect(code).toContain('t("elev.recap.ready"');
    expect(code).toContain('setActiveTab("weekly")');
    expect(code).toContain('track("recap_ready_tap"');
    expect(code).toMatch(/recapUnopened/);
  });

  it("the footer counter renders totalDays (cumulative) from computeStreak", () => {
    expect(code).toMatch(/computeStreak\(.*\)\.totalDays/);
    expect(code).toContain('t("elev.recap.days"');
  });
});

describe("WeeklyTab integration — recap as the current week's primary view + email opt-in", () => {
  const code = stripComments(read("components/tabs/WeeklyTab.tsx"));

  it("renders RecapStoryCards for the current week's digest", () => {
    expect(code).toContain("<RecapStoryCards");
    expect(code).toMatch(/selected\.id === currentId/);
  });

  it("generation state lives in the hoisted hook, not the tab", () => {
    expect(code).toContain("useWeeklyRecap()");
    expect(code).not.toContain('useChildCollection<WeeklyReport>');
    expect(code).not.toContain("api.digest(");
  });

  it("email opt-in is real, the channel is fail-closed (honest coming-soon copy)", () => {
    expect(code).toContain("readEmailOptIn");
    expect(code).toContain("writeEmailOptIn");
    expect(code).toContain("fetchDigestEmailStatus");
    expect(code).toContain('rc("elev.recap.email.soon")');
    expect(code).toContain('track("recap_email_optin"');
  });

  it("F-06: the tab lands on the CURRENT week, never a stale reports[0]", () => {
    expect(code).toContain("setSelectedId(currentId)");
    expect(code).not.toContain("reports[0]?.id");
    // No fallback to a past week when the selection has no stored report.
    expect(code).not.toMatch(/\|\|\s*reports\[0\]/);
  });

  it("F-06: chips come from weeklyChipIds (current week leads) + honest empty state", () => {
    expect(code).toContain("weeklyChipIds(");
    expect(code).toContain("isEmptyCurrentWeek(");
    // ENG-07 retired `wk.emptyThisWeek` (it promised a report that "will build
    // itself"); the honest replacement key carries the same empty state.
    expect(code).toContain('t("elev.wk.emptyThisWeek")');
  });

  it("F-06: the raw week id (a storage key) never renders in the header subtitle", () => {
    expect(code).not.toContain("${labelFor(selected)} · ${selected.id}");
    expect(code).not.toContain("${currentLabel} · ${currentId}");
  });
});

/* ── 3b. F-06 pure landing/chip logic (weeklySelection.ts) ────────────────── */

describe("weeklySelection — the weekly tab never lands in the past", () => {
  // The F-06 repro: two stored June weeks, live week = late August.
  const stored = ["2026-W25", "2026-W24"];
  const CURRENT = "2026-W35";

  it("stored June weeks + current W35 → landing is W35, empty state, chip[0] = current", () => {
    // Landing: WeeklyTab defaults selection to currentId (pinned by the
    // source scan above); with nothing stored for it, the week is empty.
    expect(isEmptyCurrentWeek(null, CURRENT, stored.includes(CURRENT))).toBe(true);
    expect(isEmptyCurrentWeek(CURRENT, CURRENT, stored.includes(CURRENT))).toBe(true);
    expect(weeklyChipIds(stored, CURRENT)).toEqual(["2026-W35", "2026-W25", "2026-W24"]);
  });

  it("a stored current week gets no synthetic duplicate and no empty state", () => {
    expect(weeklyChipIds([CURRENT, ...stored], CURRENT)).toEqual([CURRENT, ...stored]);
    expect(isEmptyCurrentWeek(CURRENT, CURRENT, true)).toBe(false);
  });

  it("selecting a history week never triggers the current-week empty state", () => {
    expect(isEmptyCurrentWeek("2026-W25", CURRENT, false)).toBe(false);
  });
});

/* ── 4. the lib/streak resettable-value ban (masterplan 2.3) ──────────────── */

describe("streak ban — no strip/recap file touches the resettable member", () => {
  // Raw sources INCLUDING comments: the banned token must not exist at all,
  // which also forbids useRef in these files (mount effects/state instead).
  const FILES = [
    "components/overview/WhatChanged.tsx",
    "components/overview/whatChangedEvents.ts",
    "components/overview/sinceVisitEvents.ts",
    "components/weekly/RecapStoryCards.tsx",
    "components/weekly/recapStrings.ts",
    "components/weekly/recapEmail.ts",
    "components/weekly/weeklySelection.ts",
    "components/tabs/WeeklyTab.tsx",
    "hooks/useWeeklyRecap.ts",
    "lib/i18nElevation/recap.ts",
  ];

  for (const rel of FILES) {
    it(`${rel} never reads \`.current\``, () => {
      expect(read(rel)).not.toMatch(/\.current\b/);
    });
  }
});

/**
 * B-TODAY-03 — the server answers `watchFor: []` on every digest. Since
 * B-TODAY-23 no card renders the digest's watchFor at all (the three-block
 * summary card is gone), so no attention item can appear in EN or HE.
 */
describe("B-TODAY-03 · the recap shows no attention items", () => {
  it("even a digest that carries watchFor puts none of it on a card", () => {
    const cards = JSON.stringify(buildRecapCards(report({ watchFor: ["Bedtime came up twice."] }), record()));
    expect(cards).not.toContain("Bedtime came up twice.");
    expect(cards).not.toContain("attention");
  });
});
