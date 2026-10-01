/**
 * B-PLAY-04 (+ B-SHELL-19 shares this file) — hub pulses are counts, never
 * pressure or verdicts.
 *
 * The Practice pulse was a static standing line; it now counts the rounds the
 * child played this week (practice/practiceWeekCount, one counter shared with
 * lane-X B-KID-07). The practice cue said "keeps the momentum going" — pressure
 * copy (law 3) — and now says "whenever it fits".
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { en, he } from "./i18n";
import { elevationEn, elevationHe } from "./i18nElevation/index";
import { practiceRoundsSince, PRACTICE_WEEK_MS } from "../practice/practiceWeekCount";

const here = path.dirname(fileURLToPath(import.meta.url));
const pulseSrc = readFileSync(path.join(here, "pulse.ts"), "utf8");

describe("B-PLAY-04 · the Practice pulse counts rounds played this week", () => {
  const NOW = Date.parse("2026-10-01T18:00:00Z");
  const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

  it("3 practice events this week → 3; mood check-ins and older rows do not count", () => {
    const events = [
      { timestamp: ago(1), kind: "calm" },
      { timestamp: ago(30), kind: "emotion-id" },
      { timestamp: ago(100), kind: "pattern" },
      { timestamp: ago(2), kind: "mood-checkin" },
      { timestamp: new Date(NOW - PRACTICE_WEEK_MS - 1000).toISOString(), kind: "calm" },
    ];
    expect(practiceRoundsSince(events, NOW)).toBe(3);
    expect(practiceRoundsSince([], NOW)).toBe(0);
  });

  it("n > 0 renders the count-only key (plural forms); 0 keeps the standing line", () => {
    expect(pulseSrc).toContain('pickCountKey("elev.pulse.practice.rounds", practice7d)');
    expect(pulseSrc).toContain(': { key: "elev.pulse.practice.empty" };');
    expect(elevationEn["elev.pulse.practice.rounds"]).toBe("{count} rounds played this week");
    expect(elevationEn["elev.pulse.practice.roundsOne"]).toBe("1 round played this week");
    expect(elevationHe["elev.pulse.practice.rounds"]).toContain("{count}");
    expect(elevationHe["elev.pulse.practice.roundsOne"]).toBeTruthy();
  });

  it("every pulse count key is count-only: no %, score, streak or denominator param", () => {
    const keys = [...pulseSrc.matchAll(/key: (?:pickCountKey\()?"(elev\.pulse\.[a-z.]+)"/gi)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(8);
    for (const k of keys) {
      for (const dict of [elevationEn, elevationHe]) {
        const v = dict[k] ?? "";
        expect(v, k).not.toMatch(/%|score|streak|ציון|רצף/i);
      }
    }
  });
});

describe("firewall copy · pressure words (B-PLAY-04)", () => {
  // Scope: "momentum" (this item). NOTE: prac.mimic.packWin.sub still says "come
  // back tomorrow" (law 3) — filed to the framer, not widened here.
  const PRESSURE_EN = [/momentum/i];
  const PRESSURE_HE = [/מומנטום/];

  it("negative control: the pre-fix cue trips the scan", () => {
    expect(PRESSURE_EN.some((re) => re.test("Two minutes of playful practice today keeps the momentum going."))).toBe(true);
    expect(PRESSURE_HE.some((re) => re.test("שתי דקות של תרגול שובב היום שומרות על המומנטום."))).toBe(true);
  });

  it("no 'momentum' / 'מומנטום' anywhere in the src dictionaries", () => {
    for (const dict of [en, elevationEn]) for (const [k, v] of Object.entries(dict)) for (const re of PRESSURE_EN) expect(`${k}: ${v}`).not.toMatch(re);
    for (const dict of [he, elevationHe]) for (const [k, v] of Object.entries(dict)) for (const re of PRESSURE_HE) expect(`${k}: ${v}`).not.toMatch(re);
  });

  it("the practice cue body is the non-pressure line in both locales", () => {
    expect(en["nudge.practice.body"]).toBe("Two minutes of play together, whenever it fits.");
    expect(he["nudge.practice.body"]).toBe("שתי דקות של משחק ביחד, מתי שנוח לכם.");
  });
});
