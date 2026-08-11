import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { buildRecapCards, type RecapCard } from "./RecapStoryCards";
import { en as rcEn, he as rcHe } from "../../lib/i18nElevation/recap";
import type { WeeklyReport } from "../../hooks/useWeeklyRecap";
import type { WeeklyDigest } from "../../lib/api";

/**
 * W2 2.1/2.2/2.3 — the weekly recap ritual (masterplan 2026-08-11 §4 ·
 * Maytal Row-1 #2/#4/#6). Four layers:
 *   1. the pure card builder (3–5 cards, LAST card = exactly ONE
 *      recommendation, evidence card = counts only and never the previous
 *      week's count),
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
  id: "2026-W33",
  weekLabel: "Week of August 11",
  generatedAt: "2026-08-11T06:00:00.000Z",
  summary: { count: 3, resolved: 2, topTrigger: "Transitions" },
  milestoneWins: ["First steps"],
  planProgress: { done: 1, total: 4 },
  spotlight: { name: "Dr. X", concept: "Co-regulation", value: "Calm is contagious." },
  insight: "insight",
  digest: digest(over),
});

/* ── 1. the pure card builder ─────────────────────────────────────────────── */

describe("buildRecapCards — story-card shape", () => {
  it("builds 3–5 cards, one stat/insight per card", () => {
    const cards = buildRecapCards(report());
    expect(cards.length).toBeGreaterThanOrEqual(3);
    expect(cards.length).toBeLessThanOrEqual(5);
    expect(cards.map((c) => c.kind)).toEqual(["wentwell", "evidence", "summary", "recommendation"]);
  });

  it("the LAST card is the recommendation, and it is the ONLY one (plan rule 2.1)", () => {
    const cards = buildRecapCards(report());
    expect(cards[cards.length - 1].kind).toBe("recommendation");
    expect(cards.filter((c) => c.kind === "recommendation")).toHaveLength(1);
    const rec = cards[cards.length - 1] as Extract<RecapCard, { kind: "recommendation" }>;
    expect(rec.text).toBe(report().digest.tryThisWeek);
  });

  it("evidence card carries COUNT CHIPS ONLY and never the previous week's count", () => {
    const cards = buildRecapCards(report());
    const ev = cards.find((c) => c.kind === "evidence") as Extract<RecapCard, { kind: "evidence" }>;
    expect(ev.chips.length).toBeGreaterThan(0);
    for (const chip of ev.chips) {
      expect(["moments", "days", "resolved", "milestones"]).toContain(chip.key);
      expect(chip.n).not.toBe(999); // previousWeekMoments sentinel
    }
    // The whole card set never leaks the prior-week count (a side-by-side
    // week count is a trend by inspection).
    expect(JSON.stringify(cards)).not.toContain("999");
  });

  it("a quiet week still yields a truthful evidence chip (0 moments, no fabrication)", () => {
    const r = report({
      stats: { ...digest().stats, momentsLogged: 0, daysCovered: 0, resolvedCount: 0, milestonesDone: 0 },
    });
    const ev = buildRecapCards(r).find((c) => c.kind === "evidence") as Extract<RecapCard, { kind: "evidence" }>;
    expect(ev.chips).toEqual([{ key: "moments", n: 0 }]);
  });

  it("summary card is the 3-block shape; empty watchFor stays empty (neutral, no invented concern)", () => {
    const r = report({ watchFor: [] });
    const sum = buildRecapCards(r).find((c) => c.kind === "summary") as Extract<RecapCard, { kind: "summary" }>;
    expect(sum.progress.length).toBeGreaterThan(0);
    expect(sum.keep.length).toBeGreaterThan(0);
    expect(sum.attention).toEqual([]);
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

  it("the mockup voice ships: what-went-well hero, three-block titles, ready line", () => {
    expect(rcHe["elev.recap.wentwell.title"]).toContain("מה הלך טוב");
    expect(rcHe["elev.recap.block.progress"]).toBe("התקדמות");
    expect(rcHe["elev.recap.block.keep"]).toBe("מומלץ להמשיך");
    // "לשים לב" translated to the conversation framing, never warning language.
    expect(rcHe["elev.recap.block.attention"]).toContain("שווה שיחה");
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

describe("Since-strip integration — recap entry line + continuity counter", () => {
  const code = stripComments(read("components/overview/SinceLastVisit.tsx"));

  it("mounts useWeeklyRecap (the app-open auto-generate mount)", () => {
    expect(code).toContain("useWeeklyRecap()");
  });

  it("the unopened-recap entry line deep-links to the weekly recap", () => {
    expect(code).toContain('rc("elev.recap.ready"');
    expect(code).toContain('setActiveTab("weekly")');
    expect(code).toContain('track("recap_ready_tap"');
    expect(code).toMatch(/recapUnopened/);
  });

  it("the footer counter renders totalDays (cumulative) from computeStreak", () => {
    expect(code).toMatch(/computeStreak\(.*\)\.totalDays/);
    expect(code).toContain('rc("elev.recap.days"');
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
});

/* ── 4. the lib/streak resettable-value ban (masterplan 2.3) ──────────────── */

describe("streak ban — no strip/recap file touches the resettable member", () => {
  // Raw sources INCLUDING comments: the banned token must not exist at all,
  // which also forbids useRef in these files (mount effects/state instead).
  const FILES = [
    "components/overview/SinceLastVisit.tsx",
    "components/overview/sinceVisitEvents.ts",
    "components/weekly/RecapStoryCards.tsx",
    "components/weekly/recapStrings.ts",
    "components/weekly/recapEmail.ts",
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
