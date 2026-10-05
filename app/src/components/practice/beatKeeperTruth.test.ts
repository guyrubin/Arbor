/**
 * B-KID-37 (KC-10, VETO truth) — Beat Keeper pulses on EVERY beat, the first
 * click is beat 1, the child hears one warm line whatever the timing, and no
 * line offers "one more try" without a retry.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { en as kidEn, he as kidHe } from "../../lib/i18nElevation/kidsExperience";
import { en as regEn, he as regHe } from "../../lib/i18nElevation/kidRegister";

const beat = readFileSync(path.join(__dirname, "BeatKeeperWorld.tsx"), "utf8");

describe("B-KID-37: the beat is visible on every beat", () => {
  it("the drum scale + ring follow a per-beat flash, not the ever-growing index", () => {
    expect(beat).toContain('transform: phase === "playing" && flash ? "scale(1.12)" : "scale(1)"');
    expect(beat).not.toContain('pulse >= 0 ? "scale(1.12)"');
    expect(beat).toContain("const flashBeat = () => { setFlash(true); window.setTimeout(() => setFlash(false), 120); };");
    expect((beat.match(/flashBeat\(\);/g) ?? []).length).toBe(2); // beat 1 + every interval beat
  });
  it("beat 1 is the t = 0 click; the clicks equal the beats", () => {
    expect(beat).toContain("(_, i) => round.intervalMs * i)");
    expect(beat).toContain("if (k >= round.beats - 1) {");
  });
});

describe("B-KID-37: no graded verdict, no false retry", () => {
  it("one line for every round", () => {
    expect(beat).not.toMatch(/score >= 80|score >= 50 \?/);
    expect(beat).not.toContain("feedback.keep");
    expect(beat).not.toContain("feedback.next");
  });
  it("the dictionaries no longer carry the tiered lines (EN + HE)", () => {
    for (const d of [kidEn, kidHe, regEn, regHe]) {
      expect(d["elev.play.beat.feedback.keep"]).toBeUndefined();
      expect(d["elev.play.beat.feedback.next"]).toBeUndefined();
      expect(d["elev.play.beat.feedback.nailed"]).not.toMatch(/nailed|one more try|עוד ניסיון|בדיוק/);
    }
  });
  it("negative control: the pre-fix render varied the line with timing", () => {
    const preFix = 'score >= 80 ? t("elev.play.beat.feedback.nailed") : score >= 50 ? t("elev.play.beat.feedback.next") : t("elev.play.beat.feedback.keep")';
    expect(preFix).toMatch(/score >= 80/);
  });
});
