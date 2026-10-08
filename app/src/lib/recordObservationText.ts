import type { Observation } from "./observations";
import type { Milestone } from "../types";
import { behaviorTypeLabel } from "../content/behaviorTaxonomy";
import { milestoneText } from "./milestoneData";
import { languageName } from "./languageName";
import { PRACTICES } from "../content/practices";
import { practiceTryTitle } from "./journal/shelfView";

type T = (key: string, vars?: Record<string, string | number>) => string;
const practicesById = new Map(PRACTICES.map((practice) => [practice.id, practice]));

/** Display saved evidence without interpreting ability. Unknown activity ids
 * stay private; known practices use the same localized title as Journal. */
export function recordObservationText(observation: Observation, context: {
  t: T; locale: "en" | "he"; childName: string; gender?: string | null;
  milestone?: Milestone; parentNote?: string;
}): { text: string; ownWords: boolean } {
  const { t, locale, childName, gender, milestone, parentNote } = context;
  const value = observation.value;
  switch (value.type) {
    case "moment": return parentNote?.trim()
      ? { text: parentNote.trim(), ownWords: true }
      : { text: behaviorTypeLabel(value.behaviorType, t), ownWords: false };
    case "milestone": return { text: milestone ? milestoneText(milestone, "title", t, { gender: gender ?? null }) : value.title, ownWords: false };
    case "keepsake": return { text: value.note, ownWords: true };
    case "measurement": return { text: t("elev.growth.record.item.measurement"), ownWords: false };
    case "word": return { text: t("elev.growth.record.item.word", { phrase: value.phrase, language: languageName(value.language, t) }), ownWords: false };
    case "goal_note": return { text: value.text, ownWords: true };
    case "check": return { text: t("elev.growth.record.item.check"), ownWords: false };
    case "play": return { text: value.title, ownWords: false };
    case "practice": {
      const practice = value.activity.startsWith("practice:") ? practicesById.get(value.activity.slice(9)) : undefined;
      return { text: practice ? practiceTryTitle(practice, locale, childName, gender)
        : t(value.activity.startsWith("speech:") ? "elev.growth.record.item.speech"
          : value.activity.startsWith("mimic:") ? "elev.growth.record.item.mimic"
            : value.activity.startsWith("adventure:") ? "elev.growth.record.item.story"
              : "elev.growth.record.item.practice"), ownWords: false };
    }
    case "fact": return { text: value.fact, ownWords: false };
  }
}
