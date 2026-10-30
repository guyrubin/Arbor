// @icon-font-ignore — data-only checkpoint identifiers and copy; no icon rendering.
import { useChildCollection } from "../../../hooks/useChildCollection";
export const STUDIO_QUEST_ID = "calm-corner-v1";
export const QUEST_STEPS = ["spot", "pillows", "lights", "pause"] as const;
export type QuestStep = typeof QUEST_STEPS[number];
export const QUEST_CHOICES = { spot: ["left", "middle", "right"], pillows: ["pillow", "blanket"], lights: ["lamp", "daylight"], pause: ["quiet", "look"] } as const;
export type QuestChoice = typeof QUEST_CHOICES[QuestStep][number];
export interface StudioQuestCheckpoint { id: string; questId: typeof STUDIO_QUEST_ID; step: QuestStep; choice: QuestChoice }
export function checkpointChoice(items: readonly unknown[], step: QuestStep): QuestChoice | undefined {
  const row = items.find(item => (item as StudioQuestCheckpoint)?.id === `${STUDIO_QUEST_ID}:${step}`) as StudioQuestCheckpoint | undefined;
  return row?.questId === STUDIO_QUEST_ID && row.step === step && (QUEST_CHOICES[step] as readonly string[]).includes(row.choice ?? "") ? row.choice : undefined;
}
export function checkpointSteps(items: readonly unknown[]): QuestStep[] {
  const out: QuestStep[] = [];
  for (const step of QUEST_STEPS) { if (!checkpointChoice(items, step)) break; out.push(step); }
  return out;
}
/** Four fixed child-owned docs. No dates, expiry, activity score or second store.
 * Default cached snapshots remain usable offline; error fallback cannot write. */
export function useStudioQuestProgress(childId: string) {
  const store = useChildCollection<StudioQuestCheckpoint>(childId, "studioQuestProgress", { trackConfirmation: true });
  const steps = checkpointSteps(store.items);
  return {
    steps, choices: Object.fromEntries(QUEST_STEPS.map(step => [step, checkpointChoice(store.items, step)])) as Partial<Record<QuestStep, QuestChoice>>,
    confirmed: store.confirmed, completed: store.confirmed && steps.length === QUEST_STEPS.length, loaded: store.loaded, isCurrent: store.isCurrent,
    async advance(choice?: QuestChoice) {
      if (!store.loaded || !store.confirmed || !store.isCurrent()) throw new Error("Quest scope or confirmation changed");
      const step = QUEST_STEPS[steps.length];
      if (!step) return;
      if (!choice || !(QUEST_CHOICES[step] as readonly string[]).includes(choice)) throw new Error("Choose an item");
      await store.upsert({ id: `${STUDIO_QUEST_ID}:${step}`, questId: STUDIO_QUEST_ID, step, choice }, { requireAcknowledgement: true });
    },
  };
}
export const studioQuestText = {
  en: { title: "A cozy corner", intro: "Make a little place of your own. You can leave and return.", steps: ["Choose a cozy spot", "Add something soft", "Choose a light", "Take a little pause"], done: "Your cozy corner is ready", ending: "You made a place of your own.", home: "My sky", saving: "Keeping your corner…", pending: "Checking that your corner was kept. You can return when connected.", error: "Your corner could not be saved. You can try again.", loading: "Opening your corner…" },
  he: { title: "פינה נעימה", intro: "ניצור מקום קטן משלך. אפשר לצאת ולחזור.", steps: ["בוחרים מקום נעים", "מוסיפים משהו רך", "בוחרים אור", "עוצרים לרגע"], done: "הפינה הנעימה שלך מוכנה", ending: "יצרת מקום קטן משלך.", home: "השמיים שלי", saving: "שומרים את הפינה…", pending: "בודקים שהפינה נשמרה. אפשר לחזור כשיש חיבור.", error: "לא הצלחנו לשמור את הפינה. אפשר לנסות שוב.", loading: "פותחים את הפינה…" },
};
export const questChoiceText: Record<"en" | "he", Record<QuestChoice, string>> = {
  en: { left: "Left corner", middle: "In the middle", right: "Right corner", pillow: "A soft pillow", blanket: "A little blanket", lamp: "A warm lamp", daylight: "Window light", quiet: "A quiet moment", look: "Look around my corner" },
  he: { left: "פינה משמאל", middle: "באמצע", right: "פינה מימין", pillow: "כרית רכה", blanket: "שמיכה קטנה", lamp: "מנורה חמימה", daylight: "אור מהחלון", quiet: "רגע שקט", look: "להביט בפינה שלי" },
};
export const studioCollectionText = {
  en: { home: "My sky", title: "My keepsakes", empty: "A place for things you make and stories you read.", books: "My books", book: "A story keepsake", unknown: "A keepsake to remember", loading: "Opening your collection…" },
  he: { home: "השמיים שלי", title: "המזכרות שלי", empty: "מקום לדברים שיצרת ולסיפורים שקראת.", books: "הספרים שלי", book: "מזכרת מסיפור", unknown: "מזכרת ששומרים", loading: "פותחים את האוסף…" },
};
