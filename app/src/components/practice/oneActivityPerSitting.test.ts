/**
 * B-KID-51 (KC-08) — one kid activity count per FINISHED SITTING, every game
 * (the per-world fix before the GameShell's finish() absorbs it, B-KID-74).
 * Before: Pattern counted 6 per sitting (one per pick), Beat Keeper and Hero
 * Pose one per round, Mood Mountain one per RIGHT naming (a wrong-answer climb
 * counted 0), Mimic 0, Sound Lab one per recording. The exit recap read those
 * counts as "what happened".
 * Static source pins (no jsdom here): each call is guarded by the sitting's end.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (f: string) => readFileSync(path.join(__dirname, f), "utf8");
const live = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const calls = (src: string) => (live(src).match(/noteKidActivity\(\)/g) ?? []).length;

const SITES: [file: string, guard: string][] = [
  ["PatternPowerWorld.tsx", "if (idx + 1 >= puzzles.length) noteKidActivity();"],
  ["BeatKeeperWorld.tsx", "if (roundIdx + 1 >= rounds.length) noteKidActivity();"],
  ["HeroPoseWorld.tsx", "if (idx + 1 >= poses.length) noteKidActivity();"],
  ["FeelingsLabTab.tsx", "if (kidStep + 1 === MOOD_CLIMB) noteKidActivity();"],
  ["SpeechCoachTab.tsx", "if (kidMode && !sittingCounted.current) { sittingCounted.current = true; noteKidActivity(); }"],
  ["MimicStudioTab.tsx", "if (!sittingCounted.current) { sittingCounted.current = true; noteKidActivity(); }"],
];

describe("B-KID-51: each game counts once, at the end of its sitting", () => {
  it.each(SITES)("%s — exactly one guarded call", (file, guard) => {
    const src = read(file);
    expect(calls(src), file).toBe(1);
    expect(live(src)).toContain(guard);
  });
  it("Mood Mountain no longer counts on the right naming (a wrong-answer climb counts 1)", () => {
    expect(live(read("FeelingsLabTab.tsx"))).not.toContain("if (id === scenario.answer) noteKidActivity();");
  });
  it("Mind Vault keeps its one count per solved board (a board is the sitting)", () => {
    expect(calls(read("MemoryMatch.tsx"))).toBe(1);
  });
  it("NEGATIVE CONTROL: an unguarded per-pick call is what the guard rejects", () => {
    const preFix = "const choose = () => {\n  noteKidActivity();\n};";
    expect(calls(preFix)).toBe(1);
    expect(live(preFix)).not.toContain(SITES[0][1]);
  });
});
