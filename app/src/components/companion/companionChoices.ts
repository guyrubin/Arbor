import type { ActionLoopEntry } from "../../actionLoop/model";
import type { ActiveTab } from "../../lib/routes";
import { companionEn, companionHe } from "../../lib/i18nCompanion";

/** Copy lives in the dictionaries (native-review packet covers it); a pair is read here. */
type CopyKey = keyof typeof companionEn & keyof typeof companionHe;
const pair = (key: CopyKey) => ({ en: companionEn[key], he: companionHe[key] });

/** A parent's still-open choice survives midnight. Completed/superseded rows
 * never become a new task, and a different topic never borrows its outcome. */
export function nextChosenAction(rows: readonly ActionLoopEntry[], topicId?: string): ActionLoopEntry | null {
  const open = rows.filter((row) => row.status === "accepted" && row.recommendation.trim());
  const linked = topicId ? open.filter((row) => (row as ActionLoopEntry & { topicId?: string }).topicId === topicId) : [];
  return [...(linked.length ? linked : open)].sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt))[0] ?? null;
}

export type TogetherCategory = "all" | "stories" | "games" | "offscreen";

export const WORLD_ART: Readonly<Record<string, string>> = {
  speech: "speech", "word-world": "reading", feelings: "feelings", mimic: "mimic",
  adventures: "adventures", memory: "memory", reading: "reading", beat: "beat", pose: "pose", pattern: "pattern",
};

/** These are parent preview destinations, never direct child-mode entrances. */
export const STORY_DOORS: readonly { id: string; tab: ActiveTab; icon: string; art: string; title: { en: string; he: string }; detail: { en: string; he: string } }[] = [
  { id: "library", tab: "stories", icon: "auto_stories", art: "/visuals/worlds/v2/tonight-story-v2-480.webp", title: pair("companion.story.library.title"), detail: pair("companion.story.library.detail") },
  { id: "bedtime", tab: "bedtime-stories", icon: "bedtime", art: "/visuals/worlds/v2/story-quest-v2-480.webp", title: pair("companion.story.bedtime.title"), detail: pair("companion.story.bedtime.detail") },
  { id: "comics", tab: "comics", icon: "menu_book", art: "/visuals/cards/web/story-david-and-goliath-480.webp", title: pair("companion.story.comics.title"), detail: pair("companion.story.comics.detail") },
  { id: "family", tab: "family", icon: "favorite", art: "/visuals/parent/v1/together-480.webp", title: pair("companion.story.family.title"), detail: pair("companion.story.family.detail") },
];

export const OFFSCREEN_IDEAS = [
  { id: "build", icon: "category", title: pair("companion.offscreen.build.title"), detail: pair("companion.offscreen.build.detail"), say: pair("companion.offscreen.build.say") },
  { id: "listen", icon: "hearing", title: pair("companion.offscreen.listen.title"), detail: pair("companion.offscreen.listen.detail"), say: pair("companion.offscreen.listen.say") },
  { id: "story", icon: "auto_stories", title: pair("companion.offscreen.story.title"), detail: pair("companion.offscreen.story.detail"), say: pair("companion.offscreen.story.say") },
] as const;
