/**
 * lib/library/bookText — B-BOOK-03: the words of a book page for one child,
 * pure. Picks the language and the Hebrew gender, fills the name token
 * (`{name}`; the older `{hero}` too) with the child's first name as an
 * isolated run (bidi: a Latin name inside Hebrew text and a Hebrew name inside
 * English text keep the sentence's word order), and lists the paragraphs a
 * page shows (text · repair lines in tap order · after-text · echo · closing).
 * DISPLAY-TIME ONLY: the filled strings are never stored.
 */
import { isolate } from "../bidi";
import { heroFirstName } from "../heroJourneyRender";
import type { BookLabel, BookLang, BookLine, BookReaderChild, HeGender, Page } from "./types";

/** The child's-name tokens a book text may carry. */
export const NAME_TOKEN = /\{(?:name|hero)\}/;
const NAME_TOKEN_G = /\{(?:name|hero)\}/g;

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

/** Split a line at the name token: the name parts are rendered inside <bdi>. */
export function heroParts(text: string, name: string): TextPart[] {
  const out: TextPart[] = [];
  const chunks = text.split(NAME_TOKEN_G);
  chunks.forEach((chunk, i) => {
    if (chunk) out.push({ hero: false, text: chunk });
    if (i < chunks.length - 1) out.push({ hero: true, text: name });
  });
  return out;
}

/** A plain string with the name isolated by FSI/PDI when its script is the
 *  foreign one in `lang` (aria labels, measurements). */
export function fillHero(text: string, name: string, lang: BookLang): string {
  return text.replace(NAME_TOKEN_G, () => isolate(name, lang));
}

/** The paragraphs a page shows, raw (with the name token), in order. A repair
 *  page shows its before-text, then each done item's line in the order the
 *  child tapped them, and once every item is done the after-text; the echo
 *  line is the committed choice's. */
export function pageParagraphs(
  page: Page,
  opts: { lang: BookLang; gender: HeGender; choiceId: string | null; repaired: readonly string[] | boolean },
): string[] {
  const { lang, gender, choiceId } = opts;
  const items = page.repair?.items ?? [];
  const done: string[] = opts.repaired === true ? items.map((it) => it.id) : opts.repaired === false ? [] : opts.repaired.filter((id) => items.some((it) => it.id === id));
  const out = [lineFor(page.text, lang, gender)];
  const tapLines = done.map((id) => items.find((it) => it.id === id)?.line).filter((l): l is BookLine => !!l).map((l) => lineFor(l, lang, gender));
  if (tapLines.length) out.push(tapLines.join(" "));
  if (page.repair && items.length > 0 && done.length === items.length) out.push(lineFor(page.repair.textAfter, lang, gender));
  const echo = choiceId ? page.echo?.[choiceId] : undefined;
  if (echo) out.push(lineFor(echo, lang, gender));
  if (page.closing) out.push(lineFor(page.closing, lang, gender));
  return out;
}

/** Characters per paragraph once the name is filled in (layout estimates). */
export function paragraphChars(paras: readonly string[], name: string): number[] {
  // Combining marks (Hebrew nikud) take no width of their own.
  return paras.map((p) => p.replace(NAME_TOKEN_G, name).replace(/\p{M}/gu, "").length);
}
