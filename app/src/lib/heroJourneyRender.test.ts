/**
 * B-KID-23 F-1 — a missing scene never falls back to English in a Hebrew story.
 * Fable saw "The Call / The hero is a small shepherd…" inside the Hebrew reader
 * for david-and-goliath when the model render lacked that beat: the reader
 * filled it with the English title + spine. It now fills it (and a missing
 * Decision choice) from the authored story in the render's language.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { authoredChoice, authoredScene, completeRender } from "./heroJourneyRender";
import { getStorySpec } from "./heroJourneys";
import type { HeroJourneyRender } from "../types";

const david = getStorySpec("david-and-goliath")!;
const HEBREW = /[א-ת]/;
const LATIN = /[A-Za-z]/;

/** A Hebrew model render that dropped the call + victory beats and choice b. */
const partialHe: HeroJourneyRender = {
  storyId: david.id,
  title: "דוד וגוליית",
  scenes: david.beats
    .filter((b) => b.id !== "call" && b.id !== "victory")
    .map((b) => ({ beatId: b.id, title: "כותרת מהמודל", narration: "טקסט מהמודל.", imagePrompt: "p" })),
  choices: [
    { id: "a", label: "ללכת מהמודל", consequence: "תוצאה מהמודל." },
    { id: "c", label: "לעמוד מהמודל", consequence: "תוצאה מהמודל." },
  ],
  reflection: { practiced: [], questions: [] },
};

describe("B-KID-23 F-1: the reader completes a partial render in the story's language", () => {
  it("Hebrew: a missing beat is the authored HEBREW title + text, never the English spine", () => {
    const { scenes } = completeRender(david, partialHe, "he");
    expect(scenes.map((s) => s.beatId)).toEqual(david.beats.map((b) => b.id));
    const call = scenes.find((s) => s.beatId === "call")!;
    expect(call.title).toBe(david.beats[0].titleHe);
    expect(call.narration).toBe(david.beats[0].spineHe);
    for (const s of scenes) {
      expect(HEBREW.test(s.title) && !LATIN.test(s.title), s.beatId).toBe(true);
      expect(HEBREW.test(s.narration) && !LATIN.test(s.narration), s.beatId).toBe(true);
    }
    // the model's own beats are kept
    expect(scenes.find((s) => s.beatId === "fear")!.narration).toBe("טקסט מהמודל.");
  });
  it("Hebrew: a missing Decision choice is the authored Hebrew one; the model's choices are kept, in authored order", () => {
    const { choices } = completeRender(david, partialHe, "he");
    expect(choices.map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(choices[0].label).toBe("ללכת מהמודל");
    expect(choices[1]).toEqual(authoredChoice(david.beats[3].choices![1], "he"));
    expect(HEBREW.test(choices[1].label) && !LATIN.test(choices[1].consequence)).toBe(true);
  });
  it("a render with NO choices still offers the three authored choices (the Decision page never dead-ends)", () => {
    const { choices } = completeRender(david, { ...partialHe, choices: [] }, "he");
    expect(choices).toHaveLength(3);
  });
  it("English: a missing beat is the English authored scene", () => {
    const { scenes } = completeRender(david, { ...partialHe, scenes: [] }, "en");
    expect(scenes[0]).toEqual({ beatId: "call", title: "The Call", narration: david.beats[0].spine, imagePrompt: "" });
  });
  it("NEGATIVE CONTROL: the pre-fix fill (title + spine) put English inside the Hebrew reader", () => {
    const b = david.beats[0];
    const preFix = { beatId: b.id, title: b.title, narration: b.spine, imagePrompt: "" };
    expect(LATIN.test(preFix.narration)).toBe(true);
    expect(authoredScene(b, "he")).not.toEqual(preFix);
  });
  it("the reader uses the one helper for scenes, the chosen consequence and the Decision list", () => {
    const tab = readFileSync(path.resolve(__dirname, "..", "components", "tabs", "HeroJourneyTab.tsx"), "utf8");
    expect(tab).toContain('completeRender(activeStory, render, aiLang === "he" ? "he" : "en")');
    expect(tab).toContain("const chosen = choices.find((c) => c.id === choiceId);");
    expect(tab).not.toContain("narration: b.spine");
    expect(tab).not.toContain("render?.choices.map(");
    expect(tab).toContain("scenes: story.beats.map((beat) => authoredScene(beat, lang)),");
  });
});
