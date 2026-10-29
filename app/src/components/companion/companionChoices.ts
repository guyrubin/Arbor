import { isObservationAction, type ActionLoopEntry } from "../../actionLoop/model";
import type { ActiveTab } from "../../lib/routes";
import { companionEn, companionHe } from "../../lib/i18nCompanion";

/** Copy lives in the dictionaries (native-review packet covers it); a pair is read here. */
type CopyKey = keyof typeof companionEn & keyof typeof companionHe;
const pair = (key: CopyKey) => ({ en: companionEn[key], he: companionHe[key] });

/** A parent's still-open choice survives midnight. Completed/superseded rows
 * never become a new task, and a different topic never borrows its outcome. */
export function nextChosenAction(rows: readonly ActionLoopEntry[], topicId?: string): ActionLoopEntry | null {
  const open = rows.filter((row) => row.status === "accepted" && !row.outcome && row.recommendation.trim());
  const linked = topicId ? open.filter((row) => (row as ActionLoopEntry & { topicId?: string }).topicId === topicId) : [];
  return [...(linked.length ? linked : open)].sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt))[0] ?? null;
}

/** B-TODAY-37: "Record a moment" on an older observation question links
 * `#/overview?observe=<id>`. Now answers THAT question with its own form
 * (the same saveTodayObservation seam) only while it is still open; anything
 * else (answered, superseded, a non-observation step, an unknown id) is
 * ignored and Now keeps its own choice. */
export function requestedObservation(rows: readonly ActionLoopEntry[], id: string | null | undefined): ActionLoopEntry | null {
  if (!id) return null;
  const row = rows.find((entry) => entry.id === id);
  return row && row.status === "accepted" && !row.outcome && row.recommendation.trim() && isObservationAction(row) ? row : null;
}

/** v4: Together is three filters — Routines (Today's rhythm), Play (the games
 *  and the away-from-the-screen ideas) and Stories. `games` is Play's id: it
 *  is what #/practice?f=games has always meant, and Play exists at every age
 *  (under three, or with no world that fits, it holds only the away ideas). */
export type TogetherCategory = "routines" | "games" | "stories";
/** The former filter ids still arrive by link, bookmark and stored choice:
 *  "all" (the old whole catalogue) lands on Routines, the default; "offscreen"
 *  (Away from the screen) lands on Play, where the away ideas now live. */
export type TogetherFilterParam = TogetherCategory | "all" | "offscreen";

/** B-BOOK-31 / B-KID-143: each world's card is its painted world (the hero-free
 *  `/visuals/worlds/v2/` set the storybook theme already uses), never a
 *  `/visuals/cards/` game card: those paint the reference family's child, and
 *  this page is every family's. */
export const WORLD_ART: Readonly<Record<string, string>> = {
  speech: "sound-lab", "word-world": "spell-forge", feelings: "mood-mountain", mimic: "mimic-studio",
  adventures: "story-quest", memory: "mind-vault", reading: "spell-forge", beat: "beat-keeper", pose: "hero-pose", pattern: "pattern-power",
};
/** The world card's two web sizes (480 and the large derivative). */
export const worldArtSrc = (worldId: string): { src480: string; src: string } => ({
  src480: `/visuals/worlds/v2/${WORLD_ART[worldId]}-v2-480.webp`,
  src: `/visuals/worlds/v2/${WORLD_ART[worldId]}-v2.webp`,
});

/** These are parent preview destinations, never direct child-mode entrances. */
export const STORY_DOORS: readonly { id: string; tab: ActiveTab; icon: string; art: string; title: { en: string; he: string }; detail: { en: string; he: string } }[] = [
  { id: "library", tab: "stories", icon: "auto_stories", art: "/visuals/worlds/v2/tonight-story-v2-480.webp", title: pair("companion.story.library.title"), detail: pair("companion.story.library.detail") },
  { id: "bedtime", tab: "bedtime-stories", icon: "bedtime", art: "/visuals/worlds/v2/story-quest-v2-480.webp", title: pair("companion.story.bedtime.title"), detail: pair("companion.story.bedtime.detail") },
  // B-BOOK-31: a hero-free story plate (the David cover paints the reference family's child).
  { id: "comics", tab: "comics", icon: "menu_book", art: "/visuals/stories/v1/little-bridge-builders-v1-480.webp", title: pair("companion.story.comics.title"), detail: pair("companion.story.comics.detail") },
  { id: "family", tab: "family", icon: "favorite", art: "/visuals/parent/v1/together-480.webp", title: pair("companion.story.family.title"), detail: pair("companion.story.family.detail") },
];

export const OFFSCREEN_IDEAS = [
  { id: "build", icon: "category", title: pair("companion.offscreen.build.title"), detail: pair("companion.offscreen.build.detail"), say: pair("companion.offscreen.build.say") },
  { id: "listen", icon: "hearing", title: pair("companion.offscreen.listen.title"), detail: pair("companion.offscreen.listen.detail"), say: pair("companion.offscreen.listen.say") },
  { id: "story", icon: "auto_stories", title: pair("companion.offscreen.story.title"), detail: pair("companion.offscreen.story.detail"), say: pair("companion.offscreen.story.say") },
] as const;
