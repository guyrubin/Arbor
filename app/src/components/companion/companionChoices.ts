import type { ActionLoopEntry } from "../../actionLoop/model";
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

/** v3 F-TOG-2: the five pills of Together's Shell row, read from #/practice?f=. */
export type TogetherCategory = "all" | "stories" | "games" | "routines" | "offscreen";

export const WORLD_ART: Readonly<Record<string, string>> = {
  speech: "speech", "word-world": "reading", feelings: "feelings", mimic: "mimic",
  adventures: "adventures", memory: "memory", reading: "reading", beat: "beat", pose: "pose", pattern: "pattern",
};

export const OFFSCREEN_IDEAS = [
  { id: "build", icon: "toys", title: pair("companion.offscreen.build.title"), detail: pair("companion.offscreen.build.detail"), say: pair("companion.offscreen.build.say") },
  { id: "listen", icon: "hearing", title: pair("companion.offscreen.listen.title"), detail: pair("companion.offscreen.listen.detail"), say: pair("companion.offscreen.listen.say") },
  { id: "story", icon: "auto_stories", title: pair("companion.offscreen.story.title"), detail: pair("companion.offscreen.story.detail"), say: pair("companion.offscreen.story.say") },
] as const;
