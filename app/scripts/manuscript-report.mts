/**
 * B-BOOK-33: the quoted per-path critic report for EVERY canonical book in
 * the registry (lib/library/books allBooks(): real + fixture), deterministic
 * and offline — no model call, no network. Per book and per read path it
 * quotes the exact lines behind each automatic finding, and lists every
 * judgement criterion (C1–C14, D1–D6, the §3 fails a script cannot see) as
 * "needs human review" with the passage to judge. Plate briefs are the
 * registry's picture names plus the art-round captions in
 * scripts/dev-book-placeholders.py.
 *
 *   npx tsx scripts/manuscript-report.mts                 all books, Markdown to stdout
 *   npx tsx scripts/manuscript-report.mts --out <dir>     one <bookId>.manuscript-report.md (+ .json) per book
 *   npx tsx scripts/manuscript-report.mts --book <id>     one book
 *   npx tsx scripts/manuscript-report.mts --strict        exit 1 on any automatic finding
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allBooks } from "../src/lib/library/books/index.ts";
import { manuscriptReport, parsePlaceholderCaptions, renderManuscriptReport } from "../src/lib/library/manuscriptReport.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = flag("--book");
const outDir = flag("--out");
const captions = parsePlaceholderCaptions(readFileSync(path.join(here, "dev-book-placeholders.py"), "utf8"));

const books = allBooks().filter((b) => !only || b.id === only);
if (only && !books.length) throw new Error(`no canonical book ${only} in the registry`);
let findings = 0;
for (const book of books) {
  const report = manuscriptReport(book, { plateBriefs: captions[book.id] ?? {} });
  findings += report.bookWide.length + report.paths.reduce((n, p) => n + p.automatic.length, 0);
  const md = renderManuscriptReport(report);
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, `${book.id}.manuscript-report.md`), md);
    writeFileSync(path.join(outDir, `${book.id}.manuscript-report.json`), JSON.stringify(report, null, 2) + "\n");
    console.log(`${book.id}: ${path.join(outDir, `${book.id}.manuscript-report.md`)}`);
  } else {
    process.stdout.write(md + "\n");
  }
}
process.exit(args.includes("--strict") && findings ? 1 : 0);
