/**
 * lib/library/bookText — B-BOOK-03: the words of a book page for one child,
 * pure. Picks the language and the Hebrew gender, fills `{hero}` with the
 * child's first name as an isolated run (bidi: a Latin name inside Hebrew text
 * and a Hebrew name inside English text keep the sentence's word order), and
 * lists the paragraphs a page shows (text · after-tap text · echo · closing).
 * DISPLAY-TIME ONLY: the filled strings are never stored.
 */
import { isolate } from "../bidi";
import { heroFirstName } from "../heroJourneyRender";
import type { BookLabel, BookLang, BookLine, BookReaderChild, HeGender, Page } from "./types";

export const HERO_TOKEN = "{hero}";

/** The Hebrew grammatical gender for this child: feminine for a child recorded
 *  as a girl, otherwise the (masculine) default — the rule the story reader
 *  already uses (lib/heroJourneyRender heText). */
export function heGender(gender: BookReaderChild["gender"]): HeGender {
  return gender === "girl" ? "f" : "m";
}

export function lineFor(line: BookLine, lang: BookLang, gender: HeGender): string {
  return lang === "he" ? line.he[gender] : line.en;
}

export function labelFor(label: BookLabel, lang: BookLang): string {
  return lang === "he" ? label.he : label.en;
}

/** The child's display name (first word of the profile name), or "". */
export function heroDisplayName(child: Pick<BookReaderChild, "name" | "gender">): string {
  return heroFirstName({ name: child.name, gender: child.gender });
}

export interface TextPart {
  hero: boolean;
  text: string;
}

/** Split a line at `{hero}`: the name parts are rendered inside <bdi>. */
export function heroParts(text: string, name: string): TextPart[] {
  const out: TextPart[] = [];
  const chunks = text.split(HERO_TOKEN);
  chunks.forEach((chunk, i) => {
    if (chunk) out.push({ hero: false, text: chunk });
    if (i < chunks.length - 1) out.push({ hero: true, text: name });
  });
  return out;
}

/** A plain string with the name isolated by FSI/PDI when its script is the
 *  foreign one in `lang` (aria labels, measurements). */
export function fillHero(text: string, name: string, lang: BookLang): string {
  return text.split(HERO_TOKEN).join(isolate(name, lang));
}

/** The paragraphs a page shows, raw (with `{hero}`), in order. The action
 *  page shows its before-text, and once the tap is done the after-text too;
 *  the echo line is the committed choice's. */
export function pageParagraphs(
  page: Page,
  opts: { lang: BookLang; gender: HeGender; choiceId: string | null; tapped: boolean },
): string[] {
  const { lang, gender, choiceId, tapped } = opts;
  const out = [lineFor(page.text, lang, gender)];
  if (page.actionTap && tapped) out.push(lineFor(page.actionTap.textAfter, lang, gender));
  const echo = choiceId ? page.echo?.[choiceId] : undefined;
  if (echo) out.push(lineFor(echo, lang, gender));
  if (page.closing) out.push(lineFor(page.closing, lang, gender));
  return out;
}

/** Characters per paragraph once the name is filled in (layout estimates). */
export function paragraphChars(paras: readonly string[], name: string): number[] {
  // Combining marks (Hebrew nikud) take no width of their own.
  return paras.map((p) => p.split(HERO_TOKEN).join(name).replace(/\p{M}/gu, "").length);
}
