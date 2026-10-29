/**
 * B-BOOK-33: the manuscript gate for one book, in two halves (kid-books-
 * standard §3). Calls no model: the critic is run by a person or an agent
 * outside CI, on the prompts this writes.
 *
 *   npx tsx scripts/manuscript-critic.mts <bookId>                 lint only (exit 1 on any hit)
 *   npx tsx scripts/manuscript-critic.mts <bookId> --prompts <dir> lint + one critic prompt per read path
 *   npx tsx scripts/manuscript-critic.mts <bookId> --report <file> lint + check a returned report:
 *       every path scored, every criterion 0–2 with a quote really in that path's
 *       text, then the §3 pass bar (exit 1 when the report is unusable or fails)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getLibraryBook, DEFAULT_REVIEW_BOOK } from "../src/lib/library/books/index.ts";
import { lintManuscript } from "../src/lib/library/manuscriptLint.ts";
import { criticPrompt, criticVerdict, manuscriptPaths, type CriticReport } from "../src/lib/library/manuscriptCritic.ts";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const bookId = args[0] && !args[0].startsWith("--") ? args[0] : DEFAULT_REVIEW_BOOK;
const book = getLibraryBook(bookId);
if (!book) throw new Error(`no book ${bookId}`);

let failed = false;
const hits = lintManuscript(book);
console.log(`# ${book.id}: manuscript lint — ${hits.length ? `${hits.length} automatic fail(s)` : "clean"}`);
for (const h of hits) console.log(`- ${h.rule} · ${h.pageId} · ${h.lang}${h.detail ? ` · ${h.detail}` : ""}: ${h.text}`);
if (hits.length) failed = true;

const promptsDir = flag("--prompts");
if (promptsDir) {
  mkdirSync(promptsDir, { recursive: true });
  for (const p of manuscriptPaths(book)) {
    const file = path.join(promptsDir, `${book.id}.${p.choiceId}.critic.md`);
    writeFileSync(file, criticPrompt(book, p.choiceId) + "\n");
    console.log(`prompt: ${file}`);
  }
}

const reportFile = flag("--report");
if (reportFile) {
  const report = JSON.parse(readFileSync(reportFile, "utf8")) as CriticReport;
  const v = criticVerdict(book, report);
  console.log(`# critic report (${report.critic || "unnamed"}): ${v.pass ? "PASS" : "FAIL"}`);
  for (const [id, t] of Object.entries(v.totals)) console.log(`- path ${id}: rubric ${t.rubric}/28, depth ${t.depth}/12`);
  for (const r of v.reasons) console.log(`- ${r}`);
  if (!v.pass) failed = true;
}
process.exit(failed ? 1 : 0);
