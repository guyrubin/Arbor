/**
 * heroJourneyRender — B-KID-23 F-1: the authored scene / choice of a hero
 * journey in the story's language, and the ONE rule that completes a model
 * render with them. Pure (shared by the reader and its tests).
 */
import type { ChildProfile, HeroBeat, HeroChoice, HeroChoiceRender, HeroJourneyRender, HeroSceneRender, HeroStorySpec } from "../types";
import { HERO_NAME_FALLBACK } from "./heroNameFallback";
import { isolate } from "./bidi";

/** B-KID-76 (a): who the authored text names as its hero — the child. */
export interface StoryHero {
  /** The child's name as stored on the profile (the first word is used). */
  name?: string;
  gender?: ChildProfile["gender"];
}

/** The child's first name, or "" for a nameless child (who keeps "the hero"). */
export function heroFirstName(hero?: StoryHero): string {
  const full = (hero?.name ?? "").trim();
  if (!full || full === HERO_NAME_FALLBACK) return "";
  return full.split(/\s+/)[0] ?? "";
}

// EN: "The hero" / "the hero" / "the hero's", and the few authored epithets
// ("the small hero", "the child hero", "the dependable little hero") — the
// epithet goes with it so the sentence reads "cheer Dana who dared".
const EN_HERO = /\b[Tt]he (?:(?:small|little|dependable|brave|child) ){0,2}hero('s)?\b/g;
// HE: "הגיבור" with its attached prefixes (ו / ש / כש / מ, then ה or ל), never
// "גיבור" (indefinite) or "הגיבורים" (plural). "הגיבור הילד" drops "הילד".
const HE_HERO = /(^|[^א-ת])(ו|ש|כש|מ|וכש)?(ה|ל)גיבור(?![א-ת])( הילד(?![א-ת]))?/g;
// B-KID-132 (a): the feminine token "הגיבורה" (the girl's text, `spineHeF` /
// `outcomeHintHeF`), with the same prefixes; "הגיבורה הילדה" drops "הילדה".
const HE_HERO_F = /(^|[^א-ת])(ו|ש|כש|מ|וכש)?(ה|ל)גיבורה(?![א-ת])( הילדה(?![א-ת]))?/g;

/** B-KID-76 (a): the authored story text names the CHILD as its hero (the
 *  model path does the same — `/generate-hero-journey` writes "Make {name}
 *  the hero, by name"). EN: every "the hero" becomes the first name (the
 *  possessive keeps its 's). HE: "הגיבור" becomes the name with its prefix
 *  letters attached ("והגיבור" → "ודנה", "לגיבור" → "לדנה"; a Latin-script
 *  name takes a hyphen, "ו-Dana"). B-KID-132 (a): a child recorded as a girl
 *  reads the feminine text where it exists (`spineHeF`, `outcomeHintHeF`,
 *  picked by `heText`), and its token "הגיבורה" becomes her name the same way;
 *  where only the masculine text exists she keeps the authored "הגיבור" — a
 *  name inside masculine verbs is a grammar error read aloud. A nameless child
 *  keeps "the hero". Text only: image prompts never pass through here
 *  (B-KID-40). */
export function nameTheHero(text: string, lang: "en" | "he", hero?: StoryHero): string {
  const name = heroFirstName(hero);
  if (!name || !text) return text;
  if (lang === "en") return text.replace(EN_HERO, (_m, poss: string | undefined) => (poss ? `${isolate(name)}'s` : name));
  const hebrewName = /^[א-ת]/.test(name);
  const withName = (_m: string, lead: string, prefix: string | undefined, article: string) => {
    const attach = `${prefix ?? ""}${article === "ל" ? "ל" : ""}`;
    return `${lead}${attach ? (hebrewName ? attach : `${attach}-`) : ""}${name}`;
  };
  const named = text.replace(HE_HERO_F, withName);
  return hero?.gender === "girl" ? named : named.replace(HE_HERO, withName);
}

/** B-KID-132 (a): the Hebrew text for this child — the feminine authored text
 *  for a child recorded as a girl when it exists, else the (masculine) text. */
function heText(masculine: string | undefined, feminine: string | undefined, hero?: StoryHero): string | undefined {
  return hero?.gender === "girl" && feminine ? feminine : masculine;
}

/** ONE authored scene for a beat, in the story's language (the authored render
 *  and a scene the model did not return both use it — B-KID-23 F-1).
 *  B-KID-45 (KB-02): with an `artTheme` (a child with a hero) the scene keeps
 *  its art — the image prompt is the story's comic theme + the beat's English
 *  spine (it names "the hero", never the child), so the reader still draws
 *  the page instead of an art-less fallback.
 *  B-KID-76 (a): the narration names the child (`hero`); the prompt does not. */
export function authoredScene(beat: HeroBeat, lang: "en" | "he", artTheme?: string, hero?: StoryHero): HeroSceneRender {
  const he = lang === "he";
  return {
    beatId: beat.id,
    title: he ? (beat.titleHe ?? beat.title) : beat.title,
    narration: nameTheHero(he ? (heText(beat.spineHe, beat.spineHeF, hero) ?? beat.spine) : beat.spine, lang, hero),
    imagePrompt: artTheme ? `${artTheme} — ${beat.spine}` : "",
  };
}

/** ONE authored Decision choice, in the story's language. */
export function authoredChoice(choice: HeroChoice, lang: "en" | "he", hero?: StoryHero): HeroChoiceRender {
  const he = lang === "he";
  return {
    id: choice.id,
    label: he ? (heText(choice.labelHe, choice.labelHeF, hero) ?? choice.label) : choice.label,
    consequence: nameTheHero(he ? (heText(choice.outcomeHintHe, choice.outcomeHintHeF, hero) ?? choice.outcomeHint) : choice.outcomeHint, lang, hero),
  };
}

/** B-KID-23 F-1: the scenes and choices a reader shows — the model's render
 *  where it has a beat / a choice, the authored one (in `lang`) where it has
 *  none. A Hebrew story never falls back to the English spine. */
export function completeRender(story: HeroStorySpec, render: HeroJourneyRender, lang: "en" | "he", hero?: StoryHero): { scenes: HeroSceneRender[]; choices: HeroChoiceRender[] } {
  const scenes = story.beats.map((b) => render.scenes.find((rs) => rs.beatId === b.id) ?? authoredScene(b, lang, undefined, hero));
  const authored = story.beats.find((b) => b.id === "decision")?.choices ?? [];
  const byId = new Map(render.choices.map((c) => [c.id, c] as const));
  const choices = authored.length ? authored.map((c) => byId.get(c.id) ?? authoredChoice(c, lang, hero)) : render.choices;
  return { scenes, choices };
}
