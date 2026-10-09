/**
 * B-BOOK-09: the complete list of narration files a book expects, with the
 * exact text of each, in the reader's own path convention (lib/library/
 * narration.ts) — the brief for the audio render. Markdown to stdout.
 *
 *   npx tsx scripts/book-narration-list.mts [bookId] [voiceKey] > NARRATION-FILES.md
 *
 * Whole-page renders (RULINGS BR8): the child's name is spoken inside the file
 * ({name} below = the child's display name). A repair page is split the way
 * the reader plays it: before-text on page show, each item's line on its tap,
 * the after-text when every item is done. Choice cards: the label on the first
 * tap. Echo pages: one file per path (the page text + that path's echo [+ the
 * closing frame line]).
 */
import { getLibraryBook, DEFAULT_REVIEW_BOOK } from "../src/lib/library/books/index.ts";
import { DEV_NARRATION_ROOT, NARRATION_ROOT } from "../src/lib/library/narration.ts";
import { bookNarrationFiles, type VoiceFolder } from "../src/lib/library/narrationFiles.ts";

const bookId = process.argv[2] ?? DEFAULT_REVIEW_BOOK;
const voiceKey = process.argv[3] ?? "dylan-v2";
const book = getLibraryBook(bookId);
if (!book) throw new Error(`no book ${bookId}`);

// The file list itself (names, texts, play moments) is lib/library/narrationFiles.ts.
const VOICES: { folder: VoiceFolder; label: string }[] = [
  { folder: "en", label: "EN" },
  { folder: "he-m", label: "HE-m (boy)" },
  { folder: "he-f", label: "HE-f (girl)" },
];

const lines: string[] = [];
lines.push(`---`, `type: brief`, `title: Narration files for "${book.title.en}" (${book.id})`, `generated: by app/scripts/book-narration-list.mts from the book data — do not hand-edit; re-run after any text change`, `---`, ``);
lines.push(`# Narration files — ${book.title.en}`, ``);
lines.push(`**Path convention** (lib/library/narration.ts):`, ``);
lines.push("```", `${DEV_NARRATION_ROOT}/${book.id}/${voiceKey}/<en | he-m | he-f>/<file>     (DEV review, git-ignored: public/_dev/narration/...)`, `${NARRATION_ROOT}/${book.id}/<voiceKey>/<en | he-m | he-f>/<file>          (product)`, "```", ``);
lines.push(`- \`voiceKey\` = the hero sheet id (\`${voiceKey}\`), else the child id — the files say the child's name.`);
lines.push(`- Format: **MP3**. One whole-page render per file; no stitching (RULINGS BR8). \`{name}\` = the child's display name, spoken.`);
lines.push(`- The reader plays a file only if it exists; a missing file = silence (never TTS). Hebrew: native review owed; never speak a divine name other than as written.`);
lines.push(`- Repair pages are split as the reader plays them: before-text on page show → each item's line on its tap (in the fixed order where the book sets one) → after-text when all are done.`);
lines.push(`- Echo pages (rejoin, ending) have one file per path: page text + that path's echo (+ the closing frame line on the last page).`);
lines.push(`- Not played by the reader (safe to delete): \`p7b-item.<id>.mp3\` (duplicates of \`p7b-<id>.mp3\`).`);
lines.push(`- **Picture-state cues (p9):** the reader shows the stone in flight at "The stone flew" / "האבן עפה" and the dust at "BOOM" / "בּוּם". Per voice, put a sidecar next to the file: \`p9.cues.json\` = \`{"flight": <ms>, "boom": <ms>}\` (the onset of each phrase, ms from the file's start; same folder as \`p9.mp3\`). Without it the reader uses 0.80 and 0.93 of the file's duration; the quiet picture comes when the file ends. No extra audio file.`);
lines.push(`- **Narration sets:** a set is a folder (\`voiceKey\`); the DEV review URL \`&voice=<setId>\` reads another set (e.g. \`dylan-v2-expressive\`) without replacing files. A set may deliver \`.wav\` instead of \`.mp3\` (the reader tries .mp3, then .wav; cue sidecars keep the \`.cues.json\` name).`, ``);
for (const v of VOICES) {
  const r = bookNarrationFiles(book, v.folder);
  lines.push(`## ${v.label} — folder \`${v.folder}/\` (${r.length} files)`, ``);
  lines.push(`| File | Plays when | Exact text |`, `|---|---|---|`);
  for (const row of r) lines.push(`| \`${row.file}\` | ${row.when} | ${row.text.replace(/\|/g, "\\|")} |`);
  lines.push(``);
}
process.stdout.write(lines.join("\n"));
