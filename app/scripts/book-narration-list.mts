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
import { narrationKey, DEV_NARRATION_ROOT, NARRATION_ROOT } from "../src/lib/library/narration.ts";
import type { BookLang, HeGender, Page } from "../src/lib/library/types.ts";

const bookId = process.argv[2] ?? DEFAULT_REVIEW_BOOK;
const voiceKey = process.argv[3] ?? "dylan-v2";
const book = getLibraryBook(bookId);
if (!book) throw new Error(`no book ${bookId}`);

type Voice = { lang: BookLang; gender: HeGender; label: string };
const VOICES: Voice[] = [
  { lang: "en", gender: "m", label: "EN" },
  { lang: "he", gender: "m", label: "HE-m (boy)" },
  { lang: "he", gender: "f", label: "HE-f (girl)" },
];

const pick = (l: { en: string; he: { m: string; f: string } }, v: Voice) => (v.lang === "he" ? l.he[v.gender] : l.en);
const label = (l: { en: string; he: string }, v: Voice) => (v.lang === "he" ? l.he : l.en);
const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" ");

interface Row {
  file: string;
  when: string;
  text: string;
}

function rows(v: Voice): Row[] {
  const out: Row[] = [];
  const key = (pageId: string, choiceId?: string) => narrationKey({ bookId: book!.id, voiceKey, lang: v.lang, gender: v.gender, pageId, choiceId }, DEV_NARRATION_ROOT)!.split("/").pop()!;
  out.push({ file: key("cover"), when: "cover shown", text: join(`${label(book!.title, v)}.`, book!.coverNameLine ? `${label(book!.coverNameLine, v)}.` : undefined, label(book!.coverLine, v)) });
  const pages: Page[] = [...book!.pages.slice(0, book!.pages.findIndex((p) => p.id === book!.decision.pageId) + 1)];
  const after = book!.pages.slice(book!.pages.findIndex((p) => p.id === book!.rejoinPageId));
  const add = (p: Page, when: string) => {
    if (p.echo) {
      for (const c of book!.decision.choices) {
        const echo = p.echo[c.id];
        out.push({ file: key(p.id, c.id), when: `${when}, path ${c.id} (${c.type})`, text: join(pick(p.text, v), echo ? pick(echo, v) : undefined, p.closing ? pick(p.closing, v) : undefined) });
      }
      return;
    }
    if (p.repair) {
      out.push({ file: key(p.id), when: `${when}: page shown (before the taps)`, text: pick(p.text, v) });
      for (const it of p.repair.items) if (it.line) out.push({ file: key(`${p.id}-${it.id}`), when: `${when}: tap on ${it.id}`, text: pick(it.line, v) });
      out.push({ file: key(`${p.id}-after`), when: `${when}: every item done`, text: pick(p.repair.textAfter, v) });
      return;
    }
    out.push({ file: key(p.id), when, text: join(pick(p.text, v), p.closing ? pick(p.closing, v) : undefined) });
  };
  for (const p of pages) add(p, p.id);
  for (const c of book!.decision.choices) out.push({ file: key(`${book!.decision.pageId}-choice`, c.id), when: `choice card ${c.id} (${c.type}) tapped`, text: label(c.label, v) });
  for (const c of book!.decision.choices) for (const p of c.branch) add(p, `${p.id} (path ${c.id})`);
  for (const p of after) add(p, p.id);
  return out;
}

const lines: string[] = [];
lines.push(`---`, `type: brief`, `title: Narration files for "${book.title.en}" (${book.id})`, `generated: by app/scripts/book-narration-list.mts from the book data — do not hand-edit; re-run after any text change`, `---`, ``);
lines.push(`# Narration files — ${book.title.en}`, ``);
lines.push(`**Path convention** (lib/library/narration.ts):`, ``);
lines.push("```", `${DEV_NARRATION_ROOT}/${book.id}/${voiceKey}/<en | he-m | he-f>/<file>     (DEV review, git-ignored: public/_dev/narration/...)`, `${NARRATION_ROOT}/${book.id}/<voiceKey>/<en | he-m | he-f>/<file>          (product)`, "```", ``);
lines.push(`- \`voiceKey\` = the hero sheet id (\`${voiceKey}\`), else the child id — the files say the child's name.`);
lines.push(`- Format: **MP3**. One whole-page render per file; no stitching (RULINGS BR8). \`{name}\` = the child's display name, spoken.`);
lines.push(`- The reader plays a file only if it exists; a missing file = silence (never TTS). Hebrew: native review owed; never speak a divine name other than as written.`);
lines.push(`- Repair pages are split as the reader plays them: before-text on page show → each item's line on its tap (any order) → after-text when all are done.`);
lines.push(`- Echo pages (rejoin, ending) have one file per path: page text + that path's echo (+ the closing frame line on the last page).`);
lines.push(`- Pages with an after-narration overlay (p9's dust cloud on "BOOM") reveal it 1.2 s after the file ends; report the BOOM timestamp per file and it can be set as \`revealAt\` instead.`, ``);
for (const v of VOICES) {
  const r = rows(v);
  lines.push(`## ${v.label} — folder \`${v.lang === "he" ? `he-${v.gender}` : "en"}/\` (${r.length} files)`, ``);
  lines.push(`| File | Plays when | Exact text |`, `|---|---|---|`);
  for (const row of r) lines.push(`| \`${row.file}\` | ${row.when} | ${row.text.replace(/\|/g, "\\|")} |`);
  lines.push(``);
}
process.stdout.write(lines.join("\n"));
