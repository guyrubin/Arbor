import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { en as kidEn, he as kidHe } from "../../lib/i18nElevation/kidRegister";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(srcRoot, rel), "utf8").replace(/\r\n/g, "\n");
const feelings = read("components/practice/FeelingsLabTab.tsx");
const mimic = read("components/practice/MimicStudioTab.tsx");
const beat = read("components/practice/BeatKeeperWorld.tsx");
const kidCopy = read("lib/i18nElevation/kidRegister.ts");

const kidFeelings = feelings.slice(feelings.lastIndexOf("// KID-04: the KID register"));

describe("W3 child interaction hierarchy", () => {
  it("Mood Mountain gives a child the scenario, read-aloud, and choices before the separate self-check", () => {
    const scenario = kidFeelings.indexOf("scenario.emoji");
    const listen = kidFeelings.indexOf("<SpeakButton");
    const choices = kidFeelings.indexOf("{emotionTiles}");
    // 22 Sep 2026: the kid self-check copy moved to the kids register key.
    const selfCheck = kidFeelings.indexOf('t("elev.kids.feelings.selfCheck"');
    for (const at of [scenario, listen, choices, selfCheck]) expect(at).toBeGreaterThan(-1);
    expect(scenario).toBeLessThan(listen);
    expect(listen).toBeLessThan(choices);
    expect(choices).toBeLessThan(selfCheck);
    expect(kidFeelings).toContain("onClick={() => feel(e.id)}");
    expect(feelings).toContain('record("emotion-why", true, `self:${id}`)');
    expect(feelings).toContain('record("emotion-id", id === scenario.answer, scenario.id)');
  });

  it("Mimic keeps its camera lifecycle and rating storage while every touched child label comes from the kid dictionary", () => {
    for (const key of [
      "elev.play.mimic.mirrorOn",
      "elev.play.mimic.mirrorOff",
      "elev.play.mimic.tried",
      "elev.play.mimic.close",
      "elev.play.mimic.nailed",
      "elev.play.mimic.packComplete.title",
      "elev.play.mimic.playPack",
    ]) expect(mimic).toMatch(new RegExp(`t\\("${key}"(?:,|\\))`));
    expect(mimic).toContain('resolveMediaPermission("camera", navigator)');
    expect(mimic).toContain("useEffect(() => () => stopMirror(), [])");
    expect(mimic).toContain("void data.mimic.upsert(session)");
    expect(mimic).toContain("completedNow && !celebratedPacks.has(pack.id)");
  });

  it("Beat Keeper says finished rather than scored without changing round logging or replay", () => {
    expect(kidEn["elev.play.beat.scoredAria"]).toBe("Round finished");
    expect(beat).toContain('t("elev.play.beat.scoredAria")');
    expect(beat).toContain('log("rhythm", "emotional", { correct: s >= 50, score: s');
    expect(beat).toContain("noteKidActivity()");
    expect(beat).toContain("scoreBeatTaps(expRef.current, tapsRef.current)");
  });

  /* CONTRACT CHANGED, 22 Sep 2026 (M1 round 3). This test used to require these
     four HE values to be byte-identical to EN and carry a per-line `// GD-6`
     marker. Its INTENT — never present unreviewed copy as approved — stands; its
     mechanism does not. Holding the EN string shipped an English kid experience
     to an IL-first product: rendered evidence in CRITIC-M1-round2.md (E7/E9)
     showed the arcade H1 and Mood Mountain's speech bubble in English under a
     Hebrew UI. The values are Hebrew now, and the debt is recorded where it
     stays visible for the whole file instead of on lines that get translated
     away. kidRegisterScan.test.ts enforces the other half: a Hebrew line must
     LOSE its `// GD-6`, so the marker keeps meaning "a reviewer owes this one". */
  it("records native Hebrew review debt instead of presenting copy as approved", () => {
    const HEBREW = /[֐-׿]/;
    for (const key of [
      "elev.play.mimic.mirrorOn",
      "elev.play.mimic.packComplete.title",
      "elev.play.beat.scoredAria",
      "elev.play.beat.feedback.nailed",
    ]) {
      expect(kidEn[key], key).toBeTruthy();
      expect(HEBREW.test(kidHe[key]), `${key} must be Hebrew: ${kidHe[key]}`).toBe(true);
      // Translated → the per-line debt marker is gone.
      expect(kidCopy).not.toMatch(new RegExp(`"${key}": .*// GD-6`));
    }
    // …and the file still says, in one place, that this is a FIRST PASS and the
    // native editorial gate is open.
    expect(kidCopy).toContain("THIS IS A FIRST PASS");
    expect(kidCopy).toMatch(/GD-6\/GD-7 native editorial sign-off is/);
    // The lines that are still English keep their own marker.
    expect(kidCopy).toMatch(/"elev\.play\.soundlab\.title": "Sound Lab", \/\/ GD-6/);
  });
});
