/**
 * lib/library/narrationFiles — K2 block 1: the ONE list of narration files a
 * book expects per voice folder, with the exact text of each (the render
 * brief, scripts/book-narration-list.mts, prints it), and which of them say
 * the child's name.
 *
 * - NAME-BEARING: the file's text carries the name token (bookText
 *   NAME_TOKEN). It is rendered per child and lives ONLY in the child's
 *   private files (Storage, read by lib/bookAssets) — never in git, never on a
 *   public path (bookRelease.guard).
 * - NAME-FREE: every other file. One render serves every child: the book's
 *   SHARED set, in git under `public/audio/books/<bookId>/<setId>/<folder>/`
 *   (SHARED_NARRATION_SETS). A he-f file whose text equals the he-m text is
 *   read from he-m (in CAST mode the two genders differ only on name-bearing
 *   lines), so the shared set ships he-f files only where the words differ.
 * - A page whose art states listen for narration cues has a cue sidecar
 *   `<stem>.cues.json` next to each of its files; it follows its audio file.
 *
 * Pure: no imports beyond the library's own data rules.
 */
import { labelFor, lineFor, NAME_TOKEN } from "./bookText";
import { NARRATION_ROOT, narrationFileName, type VoiceFolder } from "./narration";
import type { Book, BookLang, HeGender, Page } from "./types";

export type { VoiceFolder };
export const VOICE_FOLDERS: readonly VoiceFolder[] = ["en", "he-m", "he-f"];

/** The shared (name-free, every-child) narration set of a book, by book id. */
export const SHARED_NARRATION_SETS: Readonly<Record<string, string>> = {
  "five-smooth-stones": "shared-v3",
};

export interface NarrationFile {
  /** The file name inside its voice folder (`p8.b.mp3`). */
  file: string;
  /** When the reader plays it (the render brief's column). */
  when: string;
  /** The exact words, with the name token unfilled. */
  text: string;
  /** The page's art states read a cue sidecar `<stem>.cues.json` for it. */
  cues: boolean;
}

const voiceOf = (folder: VoiceFolder): { lang: BookLang; gender: HeGender } =>
  folder === "en" ? { lang: "en", gender: "m" } : { lang: "he", gender: folder === "he-f" ? "f" : "m" };
const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" ");
const hasCues = (p: Page) => !!p.artStates?.some((s) => s.cueKey);

/** Every narration file of a book for one voice folder, in reading order. */
export function bookNarrationFiles(book: Book, folder: VoiceFolder): NarrationFile[] {
  const { lang, gender } = voiceOf(folder);
  const line = (l: Page["text"]) => lineFor(l, lang, gender);
  const out: NarrationFile[] = [];
  const push = (pageId: string, when: string, text: string, opts: { choiceId?: string; cues?: boolean } = {}) =>
    out.push({ file: narrationFileName(pageId, opts.choiceId), when, text, cues: !!opts.cues });
  push("cover", "the child taps the cover picture (never on its own)", join(`${labelFor(book.title, lang)}.`, book.coverNameLine ? `${labelFor(book.coverNameLine, lang)}.` : undefined, labelFor(book.coverLine, lang)));
  const decisionAt = book.pages.findIndex((p) => p.id === book.decision.pageId);
  const before = book.pages.slice(0, decisionAt + 1);
  const after = book.pages.slice(book.pages.findIndex((p) => p.id === book.rejoinPageId));
  const add = (p: Page, when: string) => {
    if (p.echo) {
      for (const c of book.decision.choices) {
        const echo = p.echo[c.id];
        push(p.id, `${when}, path ${c.id} (${c.type})`, join(line(p.text), echo ? line(echo) : undefined, p.closing ? line(p.closing) : undefined), { choiceId: c.id, cues: hasCues(p) });
      }
      return;
    }
    if (p.repair) {
      const r = p.repair;
      push(p.id, `${when}: page shown (before the taps)`, line(p.text));
      push(`${p.id}-prompt`, `${when}: once the before-text has finished (the hint)`, labelFor(r.promptLabel, lang));
      r.items.forEach((it, n) => {
        if (it.line) push(`${p.id}-${it.id}`, `${when}: tap on ${it.id}${r.ordered ? ` (tap ${["one", "two", "three", "four", "five"][n] ?? "next"} of the fixed order)` : ""}`, line(it.line));
      });
      push(`${p.id}-after`, `${when}: every item done`, line(r.textAfter));
      return;
    }
    push(p.id, when, join(line(p.text), p.closing ? line(p.closing) : undefined), { cues: hasCues(p) });
  };
  for (const p of before) add(p, p.id);
  for (const c of book.decision.choices) push(`${book.decision.pageId}-choice`, `choice card ${c.id} (${c.type}) tapped`, labelFor(c.label, lang), { choiceId: c.id });
  for (const c of book.decision.choices) for (const p of c.branch) add(p, `${p.id} (path ${c.id})`);
  for (const p of after) add(p, p.id);
  return out;
}

/** Does this file say the child's name? */
export const isNameBearing = (f: Pick<NarrationFile, "text">): boolean => NAME_TOKEN.test(f.text);

/** `p9.mp3` → `p9.cues.json`. */
export const cueFileOf = (file: string): string => file.replace(/\.(mp3|wav)$/, "") + ".cues.json";

/** The file names (audio + cue sidecars) that must never leave the child's
 *  private files, for one voice folder. */
export function nameBearingFiles(book: Book, folder: VoiceFolder): string[] {
  return bookNarrationFiles(book, folder)
    .filter(isNameBearing)
    .flatMap((f) => [f.file, ...(f.cues ? [cueFileOf(f.file)] : [])]);
}

/** The files the book's shared set SHIPS, per voice folder: every name-free
 *  file of en and he-m, and of he-f only those whose words differ from he-m. */
export function sharedNarrationShipped(book: Book): Record<VoiceFolder, string[]> {
  const heM = new Map(bookNarrationFiles(book, "he-m").map((f) => [f.file, f.text]));
  const out = {} as Record<VoiceFolder, string[]>;
  for (const folder of VOICE_FOLDERS) {
    out[folder] = bookNarrationFiles(book, folder)
      .filter((f) => !isNameBearing(f) && (folder !== "he-f" || heM.get(f.file) !== f.text))
      .flatMap((f) => [f.file, ...(f.cues ? [cueFileOf(f.file)] : [])]);
  }
  return out;
}

/** The shared files one voice folder may use: file name → public URL (a he-f
 *  file with the he-m words is read from he-m). Empty when the book has no
 *  shared set. A name-bearing file is never in it. */
export function sharedNarrationUrls(book: Book, folder: VoiceFolder): Record<string, string> {
  const setId = Object.prototype.hasOwnProperty.call(SHARED_NARRATION_SETS, book.id) ? SHARED_NARRATION_SETS[book.id] : null;
  if (!setId) return {};
  const shipped = sharedNarrationShipped(book);
  const own = new Set(shipped[folder]);
  const base = (from: VoiceFolder) => `${NARRATION_ROOT}/${book.id}/${setId}/${from}/`;
  const out: Record<string, string> = {};
  for (const f of bookNarrationFiles(book, folder)) {
    if (isNameBearing(f)) continue;
    const from: VoiceFolder = folder === "he-f" && !own.has(f.file) ? "he-m" : folder;
    for (const name of [f.file, ...(f.cues ? [cueFileOf(f.file)] : [])]) out[name] = base(from) + name;
  }
  return out;
}
