/**
 * B-KID-29 (KC-32, VETO truth) — Mood Mountain ends after five answers with a
 * finish screen, the pips count that climb (not the 14-scenario bank), and no
 * line promises an action that never happens ("Let's make that face together").
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { en, he } from "../../lib/i18nElevation/kidsExperience";
import { MOOD_CLIMB } from "./FeelingsLabTab";

const tab = readFileSync(path.join(__dirname, "FeelingsLabTab.tsx"), "utf8");
const kid = tab.slice(tab.indexOf("// KID-04: the KID register — Mood Mountain."));

describe("B-KID-29: Mood Mountain ends", () => {
  it("five answers, then a finish with one way on", () => {
    expect(MOOD_CLIMB).toBe(5);
    expect(kid).toContain("if (kidStep >= MOOD_CLIMB) {");
    // B-KID-74: the finish is the kid shell's GameFinish (Play again / Home).
    expect(kid).toContain("<GameFinish\n            title={t(\"elev.kids.feelings.done.title\", { name: first })}");
    expect(kid).toContain("onPlayAgain={() => setKidStep(0)}");
    expect(tab).toMatch(/const nextScenario = \(\) => \{[\s\S]*?setKidStep\(\(n\) => n \+ 1\);/);
  });
  it("the pips count the climb, not the scenario bank", () => {
    // B-KID-74: the climb is the shell's progress dots (no numerals).
    expect(kid).toContain("progress={{ index: kidStep, total: MOOD_CLIMB }}");
    expect(kid).not.toContain("total={EMOTION_SCENARIOS.length}");
  });
  it("no string promises an action that does not occur (EN + HE)", () => {
    expect(en["elev.kids.feelings.retry"]).not.toMatch(/face together|make that face/i);
    expect(he["elev.kids.feelings.retry"]).not.toContain("פרצוף");
    for (const k of ["elev.kids.feelings.done.title", "elev.kids.feelings.done.sub", "elev.kids.feelings.again"]) {
      expect(en[k], k).toBeTruthy();
      expect(he[k], k).toMatch(/[֐-׿]/);
    }
  });
  it("negative control: the pre-fix retry line promised a face", () => {
    expect("Good try — it might be {feeling}. Let's make that face together.").toMatch(/face together/);
  });
});
