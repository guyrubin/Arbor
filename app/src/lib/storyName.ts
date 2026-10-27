/**
 * storyName — B-KID-168: the child's name in a story's own language.
 *
 * A Hebrew profile name inside an English story is unreadable to an English
 * reader (25 Oct iPhone input, Noah's Ark). The parent may type the name in
 * English letters (`ChildProfile.nameLatin`); English stories, their choices
 * and their narration use it, and Hebrew stories and every other surface keep
 * the profile name. Parent-entered only: no model or rule ever transliterates
 * a child's name, and an empty field keeps today's behaviour.
 */

export interface NamedChild {
  name?: string | null;
  nameLatin?: string | null;
}

/** The longest name in English letters the profile keeps. */
export const NAME_LATIN_MAX = 40;

/** The full name a story in `lang` uses: the name in English letters for an
 *  English story when the parent saved one, otherwise the profile name. */
export function storyName(child: NamedChild | null | undefined, lang: string): string {
  const latin = child?.nameLatin?.trim();
  return lang === "en" && latin ? latin : (child?.name ?? "").trim();
}

/** The value the profile stores: trimmed, inner spaces collapsed, capped;
 *  "" clears the field. */
export function cleanNameLatin(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim().slice(0, NAME_LATIN_MAX).trim();
}

/** The profile drawer offers the field when the name has a letter outside
 *  the Latin script (Hebrew, Arabic, Cyrillic…), or a value is already saved. */
export function offersNameLatin(name: string | null | undefined, saved?: string | null): boolean {
  return Boolean(saved?.trim()) || /(?=\p{L})\P{Script=Latin}/u.test(name ?? "");
}
