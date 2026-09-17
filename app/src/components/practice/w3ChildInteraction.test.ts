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
    const selfCheck = kidFeelings.indexOf('t("elev.play.feelings.selfCheck"');
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

  it("records native Hebrew review debt instead of presenting machine copy as approved", () => {
    for (const key of [
      "elev.play.mimic.mirrorOn",
      "elev.play.mimic.packComplete.title",
      "elev.play.beat.scoredAria",
      "elev.play.beat.feedback.nailed",
    ]) {
      expect(kidEn[key], key).toBeTruthy();
      expect(kidHe[key], key).toBe(kidEn[key]);
      expect(kidCopy).toMatch(new RegExp(`"${key}": .*// GD-6`));
    }
  });
});
