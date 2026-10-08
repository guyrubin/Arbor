import type { ActionLoopEntry } from "../../actionLoop/model";
import type { ActiveTab } from "../../lib/routes";

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
  { id: "library", tab: "stories", icon: "auto_stories", art: "/visuals/worlds/v2/tonight-story-v2-480.webp", title: { en: "A story to settle into", he: "סיפור שאפשר להיכנס אליו" }, detail: { en: "Browse the story library and choose before you begin.", he: "מגלים את הספרייה ובוחרים סיפור לפני שמתחילים." } },
  { id: "bedtime", tab: "bedtime-stories", icon: "bedtime", art: "/visuals/worlds/v2/story-quest-v2-480.webp", title: { en: "A story of your own", he: "סיפור משלכם" }, detail: { en: "Create and preview a bedtime story together.", he: "יוצרים סיפור לפני השינה, וקוראים אותו קודם." } },
  { id: "comics", tab: "comics", icon: "menu_book", art: "/visuals/cards/story-david-and-goliath.png", title: { en: "Stories in pictures", he: "סיפורים בתמונות" }, detail: { en: "Explore illustrated stories, one scene at a time.", he: "מגלים סיפורים מאוירים, תמונה אחר תמונה." } },
  { id: "family", tab: "family", icon: "favorite", art: "/visuals/companion/together-table.webp", title: { en: "Make it a family ritual", he: "רגע שחוזרים אליו כמשפחה" }, detail: { en: "Small shared traditions you can make your own.", he: "רעיונות לרגעים קבועים שאפשר להפוך לשלכם." } },
];

export const OFFSCREEN_IDEAS = [
  { id: "build", icon: "category", title: { en: "You start. I join.", he: "אתם מתחילים. אני מצטרף." }, detail: { en: "Let your child choose what to build from cushions, blocks or paper. Add one piece only when invited. Follow their idea, even when the plan changes.", he: "נותנים לילד לבחור מה לבנות מכריות, קוביות או נייר. מוסיפים חלק כשמוזמנים. הולכים עם הרעיון שלו, גם כשהתוכנית משתנה." }, say: { en: "What could I add to your idea?", he: "מה אפשר להוסיף לרעיון שלך?" } },
  { id: "listen", icon: "hearing", title: { en: "A little listening walk", he: "טיול קטן של הקשבה" }, detail: { en: "At home or outside, take turns noticing a sound. Wonder together what made it. There is no list to finish and no right answer to collect.", he: "בבית או בחוץ, כל אחד בתורו שם לב לצליל. חושבים יחד מאיפה הוא בא. אין רשימה לסיים או תשובה שצריך למצוא." }, say: { en: "I heard something. Did you hear it too?", he: "שמעתי משהו. גם אתם שמעתם?" } },
  { id: "story", icon: "auto_stories", title: { en: "A story that takes turns", he: "סיפור שעובר בינינו" }, detail: { en: "One person begins a story with one sentence. The other adds what happens next. Let it be silly, surprising or very short.", he: "אחד מתחיל סיפור במשפט. השני מוסיף מה קורה אחר כך. הסיפור יכול להיות מצחיק, מפתיע או ממש קצר." }, say: { en: "And then, something unexpected happened…", he: "ואז קרה משהו שאף אחד לא ציפה לו…" } },
] as const;
