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
import { authoredChoice, authoredScene, completeRender, nameTheHero } from "./heroJourneyRender";
import { getStorySpec } from "./heroJourneys";
import type { HeroBeat, HeroChoice, HeroJourneyRender } from "../types";

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
    // B-KID-120 re-pin: the gap-fill language is the render's own (renderLang).
    expect(tab).toContain('completeRender(activeStory, render, renderLang, storyHero)');
    expect(tab).toContain("const chosen = choices.find((c) => c.id === choiceId);");
    expect(tab).not.toContain("narration: b.spine");
    expect(tab).not.toContain("render?.choices.map(");
    expect(tab).toContain("scenes: story.beats.map((beat) => authoredScene(beat, lang, artTheme, hero)),");
  });
});

describe("B-KID-45 (KB-02): the authored fallback keeps its art", () => {
  it("with an art theme every beat has an image prompt: the theme + the beat's spine, never a child's name", () => {
    for (const b of david.beats) {
      const scene = authoredScene(b, "he", "a small hero before a giant");
      expect(scene.imagePrompt).toBe(`a small hero before a giant — ${b.spine}`);
      expect(scene.narration).toBe(b.spineHe); // the words stay Hebrew
    }
  });
  it("without one (no hero) the scene stays art-less, as before", () => {
    expect(authoredScene(david.beats[0], "en").imagePrompt).toBe("");
  });
});

describe("B-KID-76 (a): the authored text names the child as the hero", () => {
  const dana = { name: "Dana Cohen", gender: "boy" as const };
  it("EN: sentence-initial, mid-sentence, possessive and the authored epithets become the first name", () => {
    expect(authoredScene(david.beats[0], "en", undefined, dana).narration).toBe("Dana is a small shepherd who hears that a giant named Goliath is frightening everyone in the valley.");
    expect(authoredScene(david.beats.find((b) => b.id === "fear")!, "en", undefined, dana).narration).toBe("Dana's heart pounds — Goliath is enormous and Dana is so small. Fear says 'you can't'.");
    expect(nameTheHero("everyone watches what the small hero does next.", "en", dana)).toBe("everyone watches what Dana does next.");
    expect(nameTheHero("At dusk, the child hero notices", "en", dana)).toBe("At dusk, Dana notices");
    expect(nameTheHero("thank the dependable little hero.", "en", dana)).toBe("thank Dana.");
    // never the indefinite, the plural or another word
    expect(nameTheHero("a hero with a new name; heroes; the heroine", "en", dana)).toBe("a hero with a new name; heroes; the heroine");
  });
  it("HE: הגיבור with its prefix letters becomes the name; the indefinite and plural stay", () => {
    const he = { name: "דנה", gender: "unspecified" as const };
    expect(authoredScene(david.beats[0], "he", undefined, he).narration).toBe("דנה הוא רועה צאן קטן. הוא שומע שענק בשם גוליית מפחיד את כל מי שגר בעמק.");
    expect(nameTheHero("הלב של הגיבור דופק. והגיבור קם, כשהגיבור הולך, מריעים לגיבור הקטן שהגיבור", "he", he))
      .toBe("הלב של דנה דופק. ודנה קם, כשדנה הולך, מריעים לדנה הקטן שדנה");
    expect(nameTheHero("הגיבור הילד ושלושה חברים", "he", he)).toBe("דנה ושלושה חברים");
    expect(nameTheHero("גיבור עם שם חדש; קומיקס גיבורים; הגיבורים", "he", he)).toBe("גיבור עם שם חדש; קומיקס גיבורים; הגיבורים");
    // a Latin-script name in a Hebrew story takes a hyphen after a prefix letter
    expect(nameTheHero("והגיבור קם", "he", { name: "Dana" })).toBe("ו-Dana קם");
  });
  it("every authored Hebrew mention in a whole story is replaced (no stray הגיבור)", () => {
    const he = { name: "נועם", gender: "boy" as const };
    for (const b of david.beats) {
      const n = authoredScene(b, "he", undefined, he).narration;
      expect(n, b.id).not.toMatch(/(^|[^א-ת])[ושכמ]*[הל]גיבור(?![א-ת])/);
    }
    for (const c of david.beats[3].choices!) expect(authoredChoice(c, "he", he).consequence).not.toContain("הגיבור");
  });
  it("a nameless child keeps 'the hero' (EN + HE); a girl keeps the authored masculine Hebrew text", () => {
    expect(authoredScene(david.beats[0], "en", undefined, { name: "" }).narration).toBe(david.beats[0].spine);
    expect(authoredScene(david.beats[0], "en", undefined, { name: "your child" }).narration).toBe(david.beats[0].spine);
    expect(authoredScene(david.beats[0], "he").narration).toBe(david.beats[0].spineHe);
    expect(authoredScene(david.beats[0], "he", undefined, { name: "מיה", gender: "girl" }).narration).toBe(david.beats[0].spineHe);
    // English for a girl is named (the English text is gender-neutral)
    expect(authoredScene(david.beats[0], "en", undefined, { name: "Maya", gender: "girl" }).narration.startsWith("Maya is")).toBe(true);
  });
  it("B-KID-40 stays: the image prompt never carries the name", () => {
    for (const b of david.beats) {
      const s = authoredScene(b, "en", "a comic theme", dana);
      expect(s.imagePrompt).toBe(`a comic theme — ${b.spine}`);
      expect(s.imagePrompt).not.toContain("Dana");
    }
  });
  it("the model's own beats are never rewritten; only the authored fill is named", () => {
    const { scenes, choices } = completeRender(david, partialHe, "he", { name: "דנה" });
    expect(scenes.find((s) => s.beatId === "fear")!.narration).toBe("טקסט מהמודל.");
    expect(scenes.find((s) => s.beatId === "call")!.narration.startsWith("דנה")).toBe(true);
    expect(choices[1].consequence.startsWith("דנה")).toBe(true);
  });
  it("NEGATIVE CONTROL: the pre-fix render said 'The hero is a small shepherd' to a named child", () => {
    expect(david.beats[0].spine.startsWith("The hero is")).toBe(true);
    expect(authoredScene(david.beats[0], "en", undefined, dana).narration.startsWith("The hero")).toBe(false);
  });
  it("B-KID-132 (a) — EN / HE boy / HE girl: a girl reads the feminine text, named; a boy the masculine, named", () => {
    const beat: HeroBeat = {
      id: "fear", title: "The Fear", titleHe: "הפחד",
      spine: "The hero's heart goes thump-thump. Bun hides in the hero's coat.",
      spineHe: "הלב של הגיבור עושה בום־בום. ארנבוני מתחבא במעיל של הגיבור, והגיבור נושם.",
      spineHeF: "הלב של הגיבורה עושה בום־בום. ארנבוני מתחבא במעיל של הגיבורה, והגיבורה נושמת.",
    };
    const choice: HeroChoice = {
      id: "a", label: "Breathe", labelHe: "לנשום", labelHeF: "לנשום עמוק",
      outcomeHint: "The hero breathes.", outcomeHintHe: "הגיבור נושם לאט.", outcomeHintHeF: "הגיבורה נושמת לאט.", metricDeltas: {},
    };
    const maya = { name: "מאיה", gender: "girl" as const };
    const noam = { name: "נועם", gender: "boy" as const };
    expect(authoredScene(beat, "en", undefined, { name: "Maya", gender: "girl" }).narration).toBe("Maya's heart goes thump-thump. Bun hides in Maya's coat.");
    expect(authoredScene(beat, "he", undefined, noam).narration).toBe("הלב של נועם עושה בום־בום. ארנבוני מתחבא במעיל של נועם, ונועם נושם.");
    expect(authoredScene(beat, "he", undefined, maya).narration).toBe("הלב של מאיה עושה בום־בום. ארנבוני מתחבא במעיל של מאיה, ומאיה נושמת.");
    expect(authoredChoice(choice, "he", maya)).toEqual({ id: "a", label: "לנשום עמוק", consequence: "מאיה נושמת לאט." });
    expect(authoredChoice(choice, "he", noam)).toEqual({ id: "a", label: "לנשום", consequence: "נועם נושם לאט." });
    expect(authoredChoice(choice, "en", maya).label).toBe("Breathe");
    // a nameless girl reads the feminine text with its own token; unspecified gender reads the masculine
    expect(authoredScene(beat, "he", undefined, { name: "", gender: "girl" }).narration).toBe(beat.spineHeF);
    expect(authoredScene(beat, "he", undefined, { name: "דנה" }).narration).toContain("ודנה נושם");
    // a girl without feminine text keeps the authored masculine text, un-named (never a name in masculine verbs)
    const mascOnly: HeroBeat = { id: beat.id, title: beat.title, titleHe: beat.titleHe, spine: beat.spine, spineHe: beat.spineHe };
    expect(authoredScene(mascOnly, "he", undefined, maya).narration).toBe(beat.spineHe);
  });
  it("B-KID-132 (a): הגיבורה takes the same prefixes as הגיבור; the indefinite and plural stay", () => {
    const maya = { name: "מאיה", gender: "girl" as const };
    expect(nameTheHero("והגיבורה קמה, כשהגיבורה הולכת, מריעים לגיבורה שהגיבורה מהגיבורה", "he", maya))
      .toBe("ומאיה קמה, כשמאיה הולכת, מריעים למאיה שמאיה ממאיה");
    expect(nameTheHero("הגיבורה הילדה ושתי חברות", "he", maya)).toBe("מאיה ושתי חברות");
    expect(nameTheHero("גיבורה אמיצה; הגיבורות", "he", maya)).toBe("גיבורה אמיצה; הגיבורות");
    expect(nameTheHero("והגיבורה קמה", "he", { name: "Maya", gender: "girl" })).toBe("ו-Maya קמה");
    // the masculine token is never named for a girl
    expect(nameTheHero("הגיבור קם", "he", maya)).toBe("הגיבור קם");
  });
  it("the reader passes the child (name + gender) to the authored fallback", () => {
    const tab = readFileSync(path.resolve(__dirname, "..", "components", "tabs", "HeroJourneyTab.tsx"), "utf8");
    expect(tab).toContain("({ name: childProfile.name, gender: childProfile.gender })");
    expect(tab).toMatch(/authoredJourneyRender\(story, storyLang, [^\n]*, storyHero\)/); // B-KID-121 re-pin
  });
});
