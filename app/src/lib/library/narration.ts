/**
 * lib/library/narration — B-BOOK-04 (+ RULINGS BR8, ruling 7): where a page's
 * narration file lives. Narration is a pre-rendered WHOLE-PAGE file that
 * already says the child's name (no stitched name clip), so it is keyed by the
 * voice target as well as the page:
 *
 *   <root>/<bookId>/<voiceKey>/<en | he-m | he-f>/<pageId>[.<choiceId>].mp3
 *
 * - root: `/audio/books` (product) or `/_dev/narration` (DEV, git-ignored).
 * - voiceKey: the hero sheet id, else the child id (whose name is spoken).
 * - choiceId: only for a page whose text carries an echo line for that path.
 * - The cover reads as pageId `cover` (title, name line, cover line).
 * - A choice card's spoken label uses pageId `<decisionPageId>-choice` and the
 *   choice id (`p5-choice.a.mp3`).
 * - A repair page plays in three parts: the before-text (`<pageId>.mp3`) on
 *   page show, each item's line when the child taps it (`<pageId>-<itemId>.mp3`),
 *   and the after-text once every item is done (`<pageId>-after.mp3`).
 * - The full list for a book: scripts/book-narration-list.mts.
 *
 * Files can be dropped in later without code changes. The reader never calls
 * a voice service: no file = silence.
 */
import type { AudioSet, BookLang, HeGender, Page } from "./types";

export const NARRATION_ROOT = "/audio/books";
export const DEV_NARRATION_ROOT = "/_dev/narration";

const SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;

export interface NarrationKey {
  bookId: string;
  pageId: string;
  lang: BookLang;
  gender: HeGender;
  choiceId?: string | null;
  /** heroSheetId ?? childId */
  voiceKey: string;
}

/** A voice folder: `en`, `he-m` or `he-f`. */
export type VoiceFolder = "en" | "he-m" | "he-f";

/** The voice folder of a language + Hebrew gender. */
export function voiceFolder(lang: BookLang, gender: HeGender): VoiceFolder {
  return lang === "he" ? (gender === "f" ? "he-f" : "he-m") : "en";
}

/** A narration file's name inside its voice folder: `<pageId>[.<choiceId>].mp3`. */
export function narrationFileName(pageId: string, choiceId?: string | null): string {
  return `${pageId}${choiceId ? `.${choiceId}` : ""}.mp3`;
}

/** The conventional path, or null when a segment is not path-safe. */
export function narrationKey(k: NarrationKey, root: string = NARRATION_ROOT): string | null {
  const segs = [k.bookId, k.voiceKey, k.pageId, ...(k.choiceId ? [k.choiceId] : [])];
  if (!segs.every((s) => SEGMENT.test(s))) return null;
  return `${root}/${k.bookId}/${k.voiceKey}/${voiceFolder(k.lang, k.gender)}/${narrationFileName(k.pageId, k.choiceId)}`;
}

/** A declared file in an AudioSet for this language / gender. */
export function declaredAudio(set: AudioSet | undefined, lang: BookLang, gender: HeGender): string | undefined {
  if (!set) return undefined;
  return lang === "he" ? set.he?.[gender] : set.en;
}

/** The file a page should play: a declared file (path variant first), else
 *  the convention under `root` (when `probe`), else none. */
export function pageNarrationSrc(
  page: Page,
  k: Omit<NarrationKey, "pageId" | "choiceId"> & { choiceId: string | null },
  opts: { probe: boolean; root: string },
): string | null {
  const pathChoice = k.choiceId && page.echo?.[k.choiceId] ? k.choiceId : null;
  const declared = declaredAudio(pathChoice ? page.audio?.paths?.[pathChoice] : undefined, k.lang, k.gender) ?? declaredAudio(page.audio, k.lang, k.gender);
  if (declared) return declared;
  return opts.probe ? narrationKey({ ...k, pageId: page.id, choiceId: pathChoice }, opts.root) : null;
}

/** The narration sets of a book, in preference order: `<root>/<book>/sets.json`
 *  = ["dylan-v3", "dylan-v2-expressive", "dylan-v2"] (written next to the
 *  sets by the audio copy step). Read once when the book opens. */
export function narrationSetsPath(bookId: string, root: string = NARRATION_ROOT): string | null {
  return SEGMENT.test(bookId) ? `${root}/${bookId}/sets.json` : null;
}

/** The preferred set from a sets.json (untrusted JSON): the first valid id,
 *  else null (the reader keeps its own default: the hero sheet id). */
export function pickNarrationSet(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null;
  for (const v of raw) if (typeof v === "string" && SEGMENT.test(v)) return v;
  return null;
}
