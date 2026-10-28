/**
 * B-SHELL-44 — the ONE language and focus vocabulary Add child and Edit child
 * share. Add child always stored the six language choices as these English
 * tokens and the seven focus choices as the area name in the parent's UI
 * language (`challenges`); Edit child exposed comma/newline text fields, so
 * the same child read through two different contracts.
 *
 * Values are matched through every alias a stored row can carry (the English
 * token, the EN and HE labels, an ISO code an older client wrote), and a
 * toggle only ever removes the aliases of the choice it names or appends the
 * stored form. Anything else on the record (a custom language, a line the
 * parent wrote) is never rewritten, reordered or dropped. Pure: no React.
 */
import { en, he } from "./i18n";

/** Add child's six language choices, in the stored (English token) form. */
export const CHILD_LANGUAGES = ["Hebrew", "English", "Arabic", "Russian", "French", "Other"] as const;
export type ChildLanguage = (typeof CHILD_LANGUAGES)[number];

const LANGUAGE_CODES: Record<ChildLanguage, readonly string[]> = {
  Hebrew: ["he", "heb", "iw", "he-IL"],
  English: ["en", "eng", "en-US", "en-GB"],
  Arabic: ["ar", "ara"],
  Russian: ["ru", "rus"],
  French: ["fr", "fra"],
  Other: [],
};

/** The i18n key of a language choice's label ("ob.lang.hebrew"). */
export const languageLabelKey = (language: ChildLanguage): string => `ob.lang.${language.toLowerCase()}`;

/** Every stored form that means this language choice. */
export const languageAliases = (language: ChildLanguage): string[] => {
  const key = languageLabelKey(language);
  return [language, en[key], he[key], ...LANGUAGE_CODES[language]].filter(Boolean);
};

/** Add child's seven focus areas: the stable id and the label keys (the
 *  component layer adds the icons). Stored as `t(nameKey)` in `challenges`. */
export const CHILD_FOCUS_AREAS = [
  { id: "feelings", nameKey: "ob.step.domains.feelings", subKey: "ob.step.domains.feelings.sub" },
  { id: "language", nameKey: "ob.step.domains.language", subKey: "ob.step.domains.language.sub" },
  { id: "social", nameKey: "ob.step.domains.social", subKey: "ob.step.domains.social.sub" },
  { id: "sleep", nameKey: "ob.step.domains.sleep", subKey: "ob.step.domains.sleep.sub" },
  { id: "focus", nameKey: "ob.step.domains.focus", subKey: "ob.step.domains.focus.sub" },
  { id: "behavior", nameKey: "ob.step.domains.behavior", subKey: "ob.step.domains.behavior.sub" },
  { id: "eating", nameKey: "ob.step.domains.eating", subKey: "ob.step.domains.eating.sub" },
] as const;

/** A focus line saved in either shipped language reads as the same choice. */
export const focusAliases = (nameKey: string): string[] => [en[nameKey], he[nameKey]].filter(Boolean);

const same = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/** True when any stored item is one of the choice's aliases. */
export function hasChoice(items: readonly string[], aliases: readonly string[]): boolean {
  return items.some((item) => aliases.some((alias) => same(item, alias)));
}

/** Toggle a choice: remove every alias of it when chosen, else append its
 *  stored form. Other items keep their exact text and order. */
export function toggleChoice(items: readonly string[], aliases: readonly string[], stored: string): string[] {
  const chosen = hasChoice(items, aliases);
  return chosen
    ? items.filter((item) => !aliases.some((alias) => same(item, alias)))
    : [...items, stored.trim()];
}

/** Stored languages that match none of the six choices (kept, shown as their own words). */
export const customLanguages = (items: readonly string[]): string[] =>
  items.filter((item) => item.trim() && !CHILD_LANGUAGES.some((language) => hasChoice([item], languageAliases(language))));

/** True when a `challenges` line is one of the seven focus choices (any shipped language). */
export const isFocusChoice = (item: string): boolean =>
  CHILD_FOCUS_AREAS.some((area) => hasChoice([item], focusAliases(area.nameKey)));

const lines = (text: string) => text.split("\n").map((line) => line.trim()).filter(Boolean);

/** The parent's own `challenges` lines (not a focus choice), as the textarea shows them. */
export const otherChallengesText = (items: readonly string[]): string => items.filter((item) => !isFocusChoice(item)).join("\n");

/**
 * The `challenges` array Edit child saves. The focus chips edit `items` in
 * place; the textarea holds only the parent's other lines. When the parent
 * did not touch the textarea the items are saved as they stand, so an
 * unchanged record keeps its exact order (and its facts-as-of date).
 */
export function challengesToSave(items: readonly string[], otherText: string, otherTextAtOpen: string): string[] {
  const kept = items.map((item) => item.trim()).filter(Boolean);
  if (otherText === otherTextAtOpen) return kept;
  return [...kept.filter(isFocusChoice), ...lines(otherText)];
}
