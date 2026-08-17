/**
 * comicCopyFirewall.test.ts — static scan: no pressure-mechanic copy in the
 * kid register, EN or HE.
 *
 * Scope:
 *  (a) every kid.* i18n key's VALUE in BOTH dictionaries (lib/i18n.ts)
 *  (b) every kid-register source file — components/kidmode/** plus the
 *      kid-register practice worlds (HeroArcade + its world components)
 *
 * Scan discipline for (b): comments are stripped (design notes legitimately
 * name the mechanics they ban), i18n-key-shaped literals and asset paths are
 * masked (a key id like "gen.adventure.fail" is not copy), and the remaining
 * source — string literals AND raw JSX text — is matched against
 * BANNED_KID_PATTERNS. The matcher itself is proven live by positive
 * controls below (and was proven against a planted violation in-session).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BANNED_KID_PATTERNS,
  CELEBRATION_WHITELIST,
  ALLOWED_EXACT,
  findBannedKidCopy,
} from "./comicCopyFirewall";
import { en, he } from "./i18n";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMPONENTS = path.join(__dirname, "..", "components");

/* ── Scope: the kid register on disk ────────────────────────────────────── */

const KIDMODE_DIR = path.join(COMPONENTS, "kidmode");
const KIDMODE_FILES = readdirSync(KIDMODE_DIR)
  .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes(".test."))
  .map((f) => path.join(KIDMODE_DIR, f));

// The practice directory holds BOTH registers. Scan the WHOLE directory and
// exclude the parent-register surfaces by NAME — an allowlist-of-parent-files
// fails SAFE: a new kid-register world lands in the scan automatically, while
// the old enumerated kid list failed OPEN (PracticeHubTab, WeeklyMissionsStrip,
// EarlyReadingTrack and JourneyTab were child-facing yet unscanned).
const PRACTICE_DIR = path.join(COMPONENTS, "practice");
const PARENT_REGISTER_PRACTICE = new Set([
  "PracticeStudioTab.tsx", // parent-register launcher (its own header says so)
  "DevelopmentCopilot.tsx", // parent clinical surface (own firewall test)
  "GoalBuilderModal.tsx", // parent goal picker (CI-28, clinical-gate copy)
  "SessionLengthChips.tsx", // parent time-budget selector (CI-31)
]);
const KID_REGISTER_WORLDS = readdirSync(PRACTICE_DIR)
  .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes(".test.") && !PARENT_REGISTER_PRACTICE.has(f))
  .map((f) => path.join(PRACTICE_DIR, f));

const SCAN_FILES = [...KIDMODE_FILES, ...KID_REGISTER_WORLDS];

/* ── Scan helpers ───────────────────────────────────────────────────────── */

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** Mask non-copy literals: i18n key ids and asset/url paths. */
function maskNonCopy(src: string): string {
  return src
    .replace(/"[a-z][\w-]*(?:\.[\w-]+)+"/g, '"I18N_KEY"') // "gen.adventure.fail"
    .replace(/"[^"\s]*\/[^"\s]*"/g, '"ASSET_PATH"'); // "/visuals/cards/…"
}

/** Mask the exact-allowed safety-promise copy (kid copy that bans a mechanic by naming it). */
function maskAllowedExact(src: string): string {
  return ALLOWED_EXACT.reduce((s, phrase) => s.split(phrase).join("ALLOWED_SAFETY_PROMISE"), src);
}

function scanFile(file: string): { file: string; hits: string[] } {
  const src = maskAllowedExact(maskNonCopy(stripComments(readFileSync(file, "utf8"))));
  const hits = BANNED_KID_PATTERNS.filter((p) => p.re.test(src)).map((p) => p.id);
  return { file: path.basename(file), hits };
}

/* ── The matcher is live: positive + negative controls ──────────────────── */

describe("findBannedKidCopy — positive controls (the scanner can see violations)", () => {
  const VIOLATIONS: [string, string][] = [
    ["Keep your streak alive!", "en-streak"],
    ["You got 3 in a row!", "en-in-a-row"],
    ["Hurry! Time is running out!", "en-hurry"],
    ["Only 10 seconds left — countdown started", "en-countdown"],
    ["Don't lose your stars", "en-loss"],
    ["You failed this level", "en-fail"],
    ["Last chance to play today!", "en-last-chance"],
    ["Only 2 left!", "en-scarcity"],
    ["Only a few left!", "en-scarcity"],
    ["No time left!", "en-time-left"],
    ["Time's almost up!", "en-time-left"],
    ["Beat the clock!", "en-timer"],
    ["Race the timer before it ends!", "en-timer"],
    ["Do it before the timer runs out", "en-timer"],
    ["5...4...3...2...1", "en-countdown-digits"],
    ["3, 2, 1, go!", "en-countdown-digits"],
    ["Quickly! Tap now", "en-hurry"],
    ["Ends tonight!", "en-expiry"],
    ["Last day to play!", "en-expiry"],
    ["Don't miss out!", "en-fomo"],
    ["Come back tomorrow or your stars go away", "en-loss-threat"],
    ["Say goodbye to your stars", "en-loss-threat"],
    ["You got 5 right, everyone else got more", "en-social-compare"],
    ["Other kids finished faster", "en-social-compare"],
    ["רצף של 3 ימים", "he-streak"],
    ["ספירה לאחור התחילה", "he-countdown"],
    ["מהרו! נגמר הזמן", "he-hurry"],
    ["אתה עלול להפסיד הכל", "he-loss"],
    ["נכשלת בשלב הזה", "he-fail"],
    ["הזדמנות אחרונה לשחק", "he-last-chance"],
    ["נשארו רק 2", "he-scarcity"],
    ["מהר! עכשיו", "he-hurry"],
    ["רק היום!", "he-expiry"],
    ["אל תפספסו!", "he-fomo"],
    ["הכוכבים שלך ייעלמו מחר", "he-loss-threat"],
    ["ילדים אחרים קיבלו יותר", "he-social-compare"],
  ];

  it.each(VIOLATIONS)("flags %j (%s)", (text, expectedId) => {
    expect(findBannedKidCopy(text)).toContain(expectedId);
  });
});

describe("findBannedKidCopy — negative controls (no false positives on kid voice)", () => {
  const CLEAN = [
    "So close! Try again", // "close" must not trip the lose ban
    "Scroll down to see more worlds",
    "You're doing amazing today",
    "Pick a world and you're the star",
    "A quick game of Mind Vault",
    "Stars, never streaks", // exact-allowed safety promise
  ];

  it.each(CLEAN)("passes %j", (text) => {
    expect(findBannedKidCopy(text)).toEqual([]);
  });

  it("the exact allowance does NOT stretch to reworded streak copy", () => {
    expect(findBannedKidCopy("Stars, never streaks — keep your streak!")).toContain("en-streak");
  });
});

describe("CELEBRATION_WHITELIST — internally consistent", () => {
  it("every approved celebration phrase passes the banlist itself", () => {
    for (const phrase of CELEBRATION_WHITELIST) {
      expect(findBannedKidCopy(phrase), `whitelisted phrase trips the banlist: ${phrase}`).toEqual([]);
    }
  });

  it("covers both languages", () => {
    expect(CELEBRATION_WHITELIST.some((p) => /[֐-׿]/.test(p))).toBe(true);
    expect(CELEBRATION_WHITELIST.some((p) => /[A-Za-z]/.test(p))).toBe(true);
  });
});

/* ── (a) kid.* i18n values, both dictionaries ───────────────────────────── */

describe("kid.* i18n values carry no pressure mechanics (EN + HE)", () => {
  // "strip." is the kid-facing WeeklyMissionsStrip's namespace (its only
  // consumer) — kid-surface copy routed through a non-kid.* namespace must
  // not escape the scan.
  const kidKeys = Object.keys(en).filter((k) => k.startsWith("kid.") || k.startsWith("strip."));

  it("finds the kid namespace (sanity)", () => {
    expect(kidKeys.length).toBeGreaterThanOrEqual(20);
    expect(kidKeys.some((k) => k.startsWith("strip."))).toBe(true);
  });

  it("every kid.* value in BOTH maps is clean", () => {
    const offenders: string[] = [];
    for (const key of kidKeys) {
      for (const [lang, dict] of [["en", en], ["he", he]] as const) {
        const value = dict[key];
        if (!value) continue; // parity is enforced by kidMode.test.ts
        const hits = findBannedKidCopy(value);
        if (hits.length) offenders.push(`${lang}:${key} ("${value}") → ${hits.join(",")}`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});

/* ── (b) kid-register source files ──────────────────────────────────────── */

describe("kid-register source files carry no pressure-mechanic copy", () => {
  it("the scan scope actually exists on disk (a rename must not silently empty the scan)", () => {
    expect(KIDMODE_FILES.length).toBeGreaterThanOrEqual(8);
    expect(KID_REGISTER_WORLDS.length).toBeGreaterThanOrEqual(14);
    const names = KID_REGISTER_WORLDS.map((f) => path.basename(f));
    // Anchors: the arcade home + the child-facing files the old enumerated
    // list missed. If one moves, this fails loudly instead of silently
    // shrinking the scan.
    for (const anchor of ["HeroArcade.tsx", "PracticeHubTab.tsx", "WeeklyMissionsStrip.tsx", "EarlyReadingTrack.tsx", "JourneyTab.tsx"]) {
      expect(names, `expected ${anchor} in the kid-register scan scope`).toContain(anchor);
    }
  });

  it.each(SCAN_FILES.map((f) => [path.basename(f), f]))(
    "%s is clean of banned kid-copy patterns",
    (_name, file) => {
      const { hits } = scanFile(file as string);
      expect(hits, `${_name} trips: ${hits.join(", ")}`).toEqual([]);
    },
  );
});
