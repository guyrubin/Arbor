/**
 * lib/library/narrationTts — K2 block 2a: what the narration voice is ASKED to
 * read, per file (books standard §6; the proof's style.py and he-tts-text-v2).
 *
 * - The words: EN = the display text; HE = the book's FULLY POINTED TTS text
 *   (books/<book>.tts.ts), HE-f with its own frame lines. `{name}` stays a token
 *   here; the child's name is filled in server side from the child record
 *   (server/bookNarration.ts), never from a request.
 * - The style prompt: one warm narrator; the sound words ONLY of this page (a
 *   prompt that listed the whole book's made the voice speak a sound that was
 *   not on the page); Hebrew follows the nikud; the page's emotional shape.
 * - Direction markers between sentences (never inside words): `{shout}` before
 *   the giant's line, `{p:NNN}` pauses -> Gemini-TTS tags.
 * Shared by the render brief (scripts/book-narration-list.mts --json) and the
 * server's narration route. Pure.
 */
import { bookNarrationFiles, isNameBearing, type NarrationFile, type VoiceFolder } from "./narrationFiles";
import type { Book } from "./types";
import { fiveSmoothStonesTts } from "./books/fiveSmoothStones.tts";

export interface BookTts {
  /** Fully pointed Hebrew, by file stem (`p8.b`, `p7b-helmet`), per grammatical gender. */
  he: { m: Readonly<Record<string, string>>; f: Readonly<Record<string, string>> };
  /** Deliberate respellings for audio, display -> TTS. */
  respell: Readonly<Record<string, string>>;
  /** The page's emotional shape, by page id (`p10` covers `p10.a`). */
  pageNotes: Readonly<Record<string, string>>;
}

export const BOOK_TTS: Readonly<Record<string, BookTts>> = {
  "five-smooth-stones": fiveSmoothStonesTts,
};
export const bookTtsOf = (book: Book): BookTts | null => (Object.prototype.hasOwnProperty.call(BOOK_TTS, book.id) ? BOOK_TTS[book.id] : null);

/** One narrator in both languages (books decision G13); the server's env may override the models. */
export const NARRATION_VOICE = {
  voice: "Sulafat",
  en: { model: "gemini-2.5-pro-tts", languageCode: "en-US" },
  he: { model: "gemini-3.1-flash-tts-preview", languageCode: "he-IL" },
} as const;

const nfc = (s: string) => s.normalize("NFC");

const BASE =
  "A warm grandparent reading a bedtime picture book aloud to a five-year-old on their lap: smiling, intimate, a natural " +
  "read-aloud pace that flows (unhurried, but not slow), never theatrical-adult. Quiet, important lines drop to a soft hush. " +
  "Read ONLY the given text, exactly, and add no words or sounds of your own.";
const HE_EXTRA =
  " Speak natural Israeli Hebrew with an Israeli accent, following the vowel points (nikud) exactly. Biblical quotations: " +
  "a touch slower and more solemn, then back to the warm storytelling voice.";
const SOUNDS: readonly [RegExp, string][] = [
  [new RegExp(nfc("Whirr|ווּשׁ")), "the sling sound '{m}' winds up, round and round, building"],
  [new RegExp(nfc("CLACK|טַק")), "'{m}' is a crisp, happy knock"],
  [new RegExp(nfc("CLANK|קְלַנְק")), "'{m}' is a funny, clumsy metal clatter"],
  [new RegExp(nfc("BOOM|בּוּם")), "'{m}' is deep and round, then stillness"],
  [new RegExp(nfc("GIVE ME A MAN|תְּנוּ־לִי אִישׁ")), "the giant's '{m}' is boomed out big and deep, but playful, never frightening"],
  [new RegExp(nfc("Baa|מֶההה")), "'{m}' is a soft, sleepy sheep sound"],
];

/** The style prompt of one file: the base voice, this page's sound words only,
 *  Hebrew's nikud rule, the page's note. */
export function stylePrompt(lang: "en" | "he", text: string, stem: string, notes: Readonly<Record<string, string>> = {}): string {
  let p = BASE;
  const found: string[] = [];
  for (const [re, how] of SOUNDS) {
    const m = re.exec(nfc(text));
    if (m) found.push(how.replace("{m}", m[0]));
  }
  if (found.length) p += ` On this page: ${found.join("; ")}.`;
  if (lang === "he") p += HE_EXTRA;
  const page = stem.split(".")[0];
  const note = Object.prototype.hasOwnProperty.call(notes, page) ? notes[page] : "";
  return note ? `${p} ${note}` : p;
}

/** Direction markers between words (the words never change). */
const RULES: readonly [RegExp, string][] = [
  [new RegExp(nfc('\\s*("GIVE ME A MAN!"|"תְּנוּ־לִי אִישׁ)'), "g"), " {shout} $1"],
  [new RegExp(nfc('(MAN!"|יָחַד!"|אִישׁ!")\\s+'), "g"), "$1 {p:700} "],
  [new RegExp(nfc("\\s+(Even the king\\.|אפילו המלך\\.|אֲפִילוּ הַמֶּלֶךְ\\.)"), "g"), " {p:500} $1"],
  [new RegExp(nfc("\\s*(CLANK!|קְלַנְק!)\\s*"), "g"), " {p:300} $1 {p:300} "],
  [new RegExp(nfc("(…)\\s+(CLACK!|טַק!)"), "g"), "$1 {p:400} $2"],
  [new RegExp(nfc("\\s+(The stone flew\\.|האבן עפה\\.|הָאֶבֶן עָפָה\\.)"), "g"), " {p:500} $1"],
  [new RegExp(nfc("\\s+(The giant fell\\.|הענק נפל\\.|הָעֲנָק נָפַל\\.)"), "g"), " {p:600} $1"],
  [new RegExp(nfc("\\s+(BOOM\\.|בּוּם\\.)"), "g"), " {p:700} $1"],
];

export function direct(text: string): string {
  let t = nfc(text);
  for (const [re, rep] of RULES) t = t.replace(re, rep);
  return t.replace(/\s+/g, " ").trim();
}

const MARK = /\s*\{(shout|p:\d+)\}\s*/g;

/** The exact words (markers removed). */
export const plainOf = (directed: string): string => directed.replace(MARK, " ").replace(/\s+/g, " ").trim();

/** Markers -> Gemini-TTS tags: [shouting], [short / medium / long pause]. */
export function geminiText(directed: string): string {
  return directed
    .replace(MARK, (_m, k: string) => {
      if (k === "shout") return " [shouting] ";
      const ms = Number(k.slice(2));
      return ms < 500 ? " [short pause] " : ms < 900 ? " [medium pause] " : " [long pause] ";
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** Hebrew points (nikud and cantillation), not the maqaf. */
const NIKUD = /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g;
const HAS_NIKUD = /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/;
export const stripNikud = (s: string): string => nfc(s).replace(NIKUD, "");

/** The pointed TTS text against the display text: the letters equal after
 *  stripping the points (modulo the respellings), and every display word the
 *  manuscript already points is byte-identical. Empty = OK. */
export function checkPointed(display: string, pointed: string, respell: Readonly<Record<string, string>> = {}): string[] {
  let d = nfc(display);
  for (const [a, b] of Object.entries(respell)) d = d.split(nfc(a)).join(stripNikud(b));
  const problems: string[] = [];
  if (stripNikud(d) !== stripNikud(pointed)) problems.push("letters differ");
  for (const w of nfc(display).match(/[\u05D0-\u05EA\u0591-\u05C7\u05BE]+/g) ?? []) {
    if (HAS_NIKUD.test(w) && !nfc(pointed).includes(w)) problems.push(`a manuscript-pointed word changed: ${w}`);
  }
  return problems;
}

export interface NarrationTtsRow extends NarrationFile {
  folder: VoiceFolder;
  /** The words the voice reads ({name} still a token): EN = the display text, HE = fully pointed. */
  ttsText: string;
  /** The style prompt (input.prompt). */
  style: string;
  /** The text with Gemini-TTS tags ({name} still a token). */
  tagged: string;
  nameBearing: boolean;
}

/** Every file of one voice folder with its TTS input; null fields never: a
 *  Hebrew file without pointed text falls back to the display text. */
export function narrationTtsRows(book: Book, folder: VoiceFolder): NarrationTtsRow[] {
  const tts = bookTtsOf(book);
  const he = folder === "en" ? null : folder === "he-f" ? tts?.he.f : tts?.he.m;
  return bookNarrationFiles(book, folder).map((f) => {
    const stem = f.file.replace(/\.mp3$/, "");
    const words = he && Object.prototype.hasOwnProperty.call(he, stem) ? he[stem] : f.text;
    return {
      ...f,
      folder,
      ttsText: words,
      style: stylePrompt(folder === "en" ? "en" : "he", words, stem, tts?.pageNotes),
      tagged: geminiText(direct(words)),
      nameBearing: isNameBearing(f),
    };
  });
}

/** The TTS request of one file for one child (the name filled in), or null. */
export function narrationTtsRequest(book: Book, folder: VoiceFolder, file: string, firstName: string): { text: string; prompt: string; languageCode: string; lang: "en" | "he" } | null {
  const row = narrationTtsRows(book, folder).find((r) => r.file === file);
  if (!row) return null;
  const lang = folder === "en" ? "en" : "he";
  return {
    text: row.tagged.split("{name}").join(firstName),
    prompt: row.style,
    languageCode: NARRATION_VOICE[lang].languageCode,
    lang,
  };
}

/** The render brief as data (scripts/book-narration-list.mts --json). */
export function narrationJson(book: Book): { bookId: string; voice: typeof NARRATION_VOICE; folders: Record<VoiceFolder, NarrationTtsRow[]> } {
  return {
    bookId: book.id,
    voice: NARRATION_VOICE,
    folders: { en: narrationTtsRows(book, "en"), "he-m": narrationTtsRows(book, "he-m"), "he-f": narrationTtsRows(book, "he-f") },
  };
}
