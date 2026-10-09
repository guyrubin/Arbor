/**
 * cosmeticsFirewall.test.ts — kid progression stays EARNED-ONLY.
 *
 * Three contracts, all statically enforced on every test run:
 *  1. No purchase / trade-economy / expiry / random-drop vocabulary anywhere
 *     in the kid surfaces (components/kidmode/**, src/playbank/**,
 *     components/practice/**). Patterns are economy-specific on purpose:
 *     playbank activity copy legitimately says "roll the ball", "a stack of
 *     coins", "trade roles" — physical play, not an economy. What is banned
 *     is the ECONOMY framing: buy/price/purchase, unlock-with-currency,
 *     spend-currency, gacha/loot/mystery-box, roll-for-reward, random drops,
 *     expiring rewards.
 *  2. The KidDashboard star total stays MONOTONIC: derived only from saved
 *     play-log lengths (+ completed missions), anchored to the exact useMemo.
 *     Any rewrite of that derivation must consciously update this test.
 *  3. Egress stays parent-mediated: no kid-surface file imports firebase
 *     directly or calls a Firestore write helper. (Writes go through the
 *     usePracticeData hook's upsert, which is the mediated path.)
 *
 * The scanner was proven live against planted violations in-session; the
 * positive-control table below keeps the patterns themselves honest forever.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..");

/* ── Scope ──────────────────────────────────────────────────────────────── */

const SCAN_DIRS = [
  path.join(SRC, "components", "kidmode"),
  path.join(SRC, "playbank"),
  path.join(SRC, "components", "practice"),
];

// Child-facing primitives that live OUTSIDE the kid directories: PlayKit is
// the self-declared "child-facing primitive set for Practice Studio", and the
// mascot/avatar components render inside kid surfaces. A purchasable-cosmetic
// string planted here would previously have passed CI.
const EXTRA_SCAN_FILES = [
  path.join(SRC, "components", "ui", "playkit.tsx"),
  path.join(SRC, "components", "ui", "ArborMascot.tsx"),
  path.join(SRC, "components", "ui", "HeroAvatar.tsx"),
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.includes(".test.")) out.push(full);
  }
  return out;
}

const SCAN_FILES = [...SCAN_DIRS.flatMap((d) => walk(d)), ...EXTRA_SCAN_FILES];

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/**
 * Vetted pretend-play copy that names real-world economy words. These are
 * parent-run imaginative-play instructions (a pretend café with paper menus),
 * not an in-app economy. EXACT match only — any new or reworded economy copy
 * trips the scan and must be reviewed here consciously.
 */
const VETTED_PRETEND_PLAY: string[] = [
  "Add prices, fancy names, or a daily special.", // playbank/content.ts — pretend-restaurant activity
];

function maskVetted(src: string): string {
  return VETTED_PRETEND_PLAY.reduce((s, phrase) => s.split(phrase).join("VETTED_PRETEND_PLAY"), src);
}

/* ── 1. Economy vocabulary ban ──────────────────────────────────────────── */

interface EconomyPattern {
  id: string;
  re: RegExp;
}

const ECONOMY_PATTERNS: EconomyPattern[] = [
  { id: "price", re: /\bprices?\b|\bpriced\b|\bpricing\b/i },
  { id: "buy", re: /\bbuy(?:s|ing)?\b|\bbought\b/i },
  { id: "purchase", re: /\bpurchas(?:e|es|ed|ing|able)\b/i },
  { id: "gacha", re: /\bgachas?\b/i },
  { id: "loot", re: /\bloot\b/i },
  { id: "expiry", re: /\bexpir(?:e|es|ed|ing|y|ation)\b/i },
  // Optional quantity/quantifier gap ("Unlock with 100 stars", "Spend 50 of
  // your stars") — the bare-noun-only forms missed the dominant real-world
  // purchase phrasing.
  { id: "unlock-with-currency", re: /unlock(?:ed|s)? (?:it |this )?(?:with|using|for) (?:\d+ |a few |some |more )?(?:of your )?(?:coins?|gems?|stars?|tokens?|points?)/i },
  { id: "spend-currency", re: /spend (?:your |\d+ |a few |some )*(?:of your )?(?:coins?|gems?|stars?|tokens?|points?)/i },
  // Cost phrasing had no pattern at all ("This cape costs 30 stars").
  { id: "costs-currency", re: /\bcosts? (?:\d+ |a few |some )?(?:coins?|gems?|stars?|tokens?|points?)\b/i },
  // "Get it for 50 stars" — acquisition-for-currency phrasing.
  { id: "get-for-currency", re: /\b(?:get|grab|claim) (?:it|this|one|them)? ?for (?:\d+ |a few |some )?(?:coins?|gems?|stars?|tokens?|points?)\b/i },
  { id: "currency-shop", re: /\b(?:coin|gem|star|token) shop\b|\bstore credits?\b/i },
  { id: "roll-for-reward", re: /\broll(?:s|ed|ing)? for (?:a |the )?(?:prize|reward|loot|rare|drop)/i },
  { id: "mystery-box", re: /\bmystery (?:box|chest)\b/i },
  { id: "trade-currency", re: /\btrade (?:coins?|gems?|stars?|tokens?)\b/i },
  { id: "random-drop", re: /\brandom (?:drop|reward|prize|loot)\b/i },
  // Hebrew economy framing (playbank copy is EN today; this guards the future)
  { id: "he-buy", re: /לקנות|קנייה|רכישה/ },
  { id: "he-currency-unlock", re: /מטבעות כדי|לשלם/ },
];

describe("economy patterns — positive controls (the scanner can see violations)", () => {
  const VIOLATIONS: [string, string][] = [
    ["Buy more coins to continue", "buy"],
    ["Special price today only", "price"],
    ["Purchase this outfit", "purchase"],
    ["Unlock with coins", "unlock-with-currency"],
    ["Unlock with 100 stars", "unlock-with-currency"],
    ["Spend your stars in the shop", "spend-currency"],
    ["Spend 50 stars to get it", "spend-currency"],
    ["This cape costs 30 stars", "costs-currency"],
    ["Get it for 50 stars", "get-for-currency"],
    ["Visit the coin shop", "currency-shop"],
    ["Gacha time!", "gacha"],
    ["Open the loot box", "loot"],
    ["Roll for a prize", "roll-for-reward"],
    ["A mystery box appeared", "mystery-box"],
    ["Trade coins with friends", "trade-currency"],
    ["Random drop unlocked", "random-drop"],
    ["Your reward expires tomorrow", "expiry"],
    ["אפשר לקנות עוד", "he-buy"],
  ];

  it.each(VIOLATIONS)("flags %j (%s)", (text, expectedId) => {
    const hits = ECONOMY_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.id);
    expect(hits).toContain(expectedId);
  });
});

describe("economy patterns — negative controls (physical play stays legal)", () => {
  const REAL_PLAYBANK_COPY = [
    "Roll the ball to them and say 'your turn'.",
    "a small stack of coins", // real coins in a fine-motor activity
    "Trade roles and let them quiz you.",
    "Do a slow countdown from five as it ends.",
    "Count how many catches you make in a row without a drop.",
  ];

  it.each(REAL_PLAYBANK_COPY)("passes %j", (text) => {
    const hits = ECONOMY_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.id);
    expect(hits).toEqual([]);
  });
});

describe("no economy vocabulary in kid surfaces (kidmode + playbank + practice)", () => {
  it("the scan scope actually exists (a move must not silently empty the scan)", () => {
    expect(SCAN_FILES.length).toBeGreaterThanOrEqual(30);
    const names = SCAN_FILES.map((f) => path.basename(f));
    for (const anchor of ["KidDashboard.tsx", "content.ts", "HeroArcade.tsx", "playkit.tsx", "ArborMascot.tsx", "HeroAvatar.tsx"]) {
      expect(names, `expected ${anchor} in scan scope`).toContain(anchor);
    }
  });

  it.each(SCAN_FILES.map((f) => [path.relative(SRC, f), f]))(
    "%s is free of purchase/expiry/random-drop vocabulary",
    (_rel, file) => {
      const src = maskVetted(stripComments(readFileSync(file as string, "utf8")));
      const hits = ECONOMY_PATTERNS.filter((p) => p.re.test(src)).map((p) => p.id);
      expect(hits, `${_rel} trips: ${hits.join(", ")}`).toEqual([]);
    },
  );
});

/* ── 2. No star count on the kid home ──────────────────────────────────── */

// B-BOOK-26 (T7, 9 Oct): the lifetime star chip was a number shown to the
// child. It is gone from the kid home; the monotonic-derivation anchor that
// guarded it retires with it.
describe("KidDashboard shows the child no count", () => {
  const dashPath = path.join(SRC, "components", "kidmode", "KidDashboard.tsx");
  const src = stripComments(readFileSync(dashPath, "utf8"));

  it("has no star meter, star total or kid.stars copy", () => {
    expect(src).not.toMatch(/StarMeter|const stars\b|kid\.stars/);
  });

  it("keeps no local persistence of any total", () => {
    expect(src).not.toMatch(/localStorage|sessionStorage/);
  });
});

/* ── 3. Egress stays parent-mediated ────────────────────────────────────── */

describe("no kid-surface file talks to firebase directly", () => {
  const WRITE_HELPERS = /\b(?:addDoc|setDoc|updateDoc|deleteDoc|writeBatch|runTransaction)\s*\(/;

  it.each(SCAN_FILES.map((f) => [path.relative(SRC, f), f]))(
    "%s has no direct firebase import and no Firestore write-helper call",
    (_rel, file) => {
      const src = stripComments(readFileSync(file as string, "utf8"));
      expect(src, `${_rel} imports firebase directly`).not.toMatch(/from\s+["']firebase/);
      expect(src, `${_rel} calls a Firestore write helper directly`).not.toMatch(WRITE_HELPERS);
    },
  );
});
