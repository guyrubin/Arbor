/**
 * heroJourneyRender — B-KID-23 F-1: the authored scene / choice of a hero
 * journey in the story's language, and the ONE rule that completes a model
 * render with them. Pure (shared by the reader and its tests).
 */
import type { HeroBeat, HeroChoice, HeroChoiceRender, HeroJourneyRender, HeroSceneRender, HeroStorySpec } from "../types";

/** ONE authored scene for a beat, in the story's language (the authored render
 *  and a scene the model did not return both use it — B-KID-23 F-1).
 *  B-KID-45 (KB-02): with an `artTheme` (a child with a hero) the scene keeps
 *  its art — the image prompt is the story's comic theme + the beat's English
 *  spine (it names "the hero", never the child), so the reader still draws
 *  the page instead of an art-less fallback. */
export function authoredScene(beat: HeroBeat, lang: "en" | "he", artTheme?: string): HeroSceneRender {
  const he = lang === "he";
  return {
    beatId: beat.id,
    title: he ? (beat.titleHe ?? beat.title) : beat.title,
    narration: he ? (beat.spineHe ?? beat.spine) : beat.spine,
    imagePrompt: artTheme ? `${artTheme} — ${beat.spine}` : "",
  };
}

/** ONE authored Decision choice, in the story's language. */
export function authoredChoice(choice: HeroChoice, lang: "en" | "he"): HeroChoiceRender {
  const he = lang === "he";
  return {
    id: choice.id,
    label: he ? (choice.labelHe ?? choice.label) : choice.label,
    consequence: he ? (choice.outcomeHintHe ?? choice.outcomeHint) : choice.outcomeHint,
  };
}

/** B-KID-23 F-1: the scenes and choices a reader shows — the model's render
 *  where it has a beat / a choice, the authored one (in `lang`) where it has
 *  none. A Hebrew story never falls back to the English spine. */
export function completeRender(story: HeroStorySpec, render: HeroJourneyRender, lang: "en" | "he"): { scenes: HeroSceneRender[]; choices: HeroChoiceRender[] } {
  const scenes = story.beats.map((b) => render.scenes.find((rs) => rs.beatId === b.id) ?? authoredScene(b, lang));
  const authored = story.beats.find((b) => b.id === "decision")?.choices ?? [];
  const byId = new Map(render.choices.map((c) => [c.id, c] as const));
  const choices = authored.length ? authored.map((c) => byId.get(c.id) ?? authoredChoice(c, lang)) : render.choices;
  return { scenes, choices };
}
