/**
 * lib/library/manuscriptCritic — B-BOOK-33: the critic half of the
 * manuscript gate (kid-books-standard §3). The lint (manuscriptLint) rejects
 * what a script can see; an independent critic scores each READ PATH on the
 * rubric C1–C14 and the depth rubric D1–D6, quoting one line as evidence per
 * criterion. This module makes that report checkable:
 *
 *  - manuscriptPaths: each path's text page by page, as the child meets it
 *    (the path's own echo lines, frame lines, repair lines; EN, HE-m, HE-f);
 *  - criticPrompt: the per-path brief the critic is given (the rubric, the
 *    automatic fails, the path's text, the parent panel, the report shape);
 *  - validateCriticReport: every path scored, every criterion 0–2 with a
 *    quote that is really in THAT path's text (or the parent panel /
 *    source note for the parent-layer and fidelity criteria) — a quote the
 *    book does not contain is a finding, not evidence;
 *  - criticVerdict: the §3 pass bar on the lowest path.
 *
 * It calls nothing: scripts/manuscript-critic.mts writes the prompts and
 * checks a returned report; the critic itself is run by a person or an
 * agent outside CI. Pure.
 */
import { readPath } from "./bookFlow";
import { bookChoices } from "./bookShape";
import { pageLines } from "./manuscriptLint";
import type { Book, BookLine } from "./types";

export const RUBRIC = {
  C1: "Archetypal problem — 2 = one the child lives, stated by page 3",
  C2: "Stakes before the choice — 2 = a causal refrain states the rule, and who depends on it is in the picture",
  C3: "Real choice — 2 = 3 (or 2) different acts, typed HARD / EASY / THIRD, each with a cost; the EASY one attractive",
  C4: "Consequence follows choice — 2 = text and picture differ on the first branch page; the cost is a visible event",
  C5: "Repair by the hero — 2 = the repair is the child's own effort, per item, cannot fail, takes longer than HARD; the cost lands on the hero, never on others' faces",
  C6: "Rejoin carries memory — 2 = an echo line per path on the rejoin page and the last page; equal warmth, unequal memory; the EASY echo looks forward",
  C7: "Hero agency — 2 = an active verb on every page; the decisive act of the hero's thread is the hero's",
  C8: "Show, don't tell — 2 = no virtue nouns; at least one picture-only fact per page; Bun mirrors silently",
  C9: "Read-aloud craft — 2 = refrains + sound words; a hook on every page but the last; TTS-safe (no parentheses, no dash asides, one speaker per sentence)",
  C10: "Age fit — 2 = every cap met; the consequence within 1 page (3–4) / 2 pages (5–7)",
  C11: "Ending — 2 = rest / order / a kept promise; refrain transformed; calm; no question, no jump button",
  C12: "Parent layer — 2 = the parent panel parts present; no verdict on the child",
  C13: "Source fidelity — 2 = scored under BR12; the figure named and doing the canonical acts; additions listed; violence stopped before",
  C14: "Knowledge carried — 2 = the knowledge sentence is enacted by the choice and its consequence, said plainly only to the parent",
} as const;
export const DEPTH = {
  D1: "Story — 2 = at least 3 lens ideas enacted, a voluntary step as its own beat, a return that changes the community",
  D2: "Words — 2 = at least 3 ideas in refrains or canonical lines; zero virtue nouns",
  D3: "Scenes — 2 = at least 3 ideas the words never say",
  D4: "Message — 2 = one sentence enacted, never stated; plain to the parent with one thing to do tomorrow",
  D5: "Never preaches — 2 = no moral stated, no lesson voiced by the narrator",
  D6: "Faithful — 2 = every quote exact, BR12, every change disclosed",
} as const;
export type RubricId = keyof typeof RUBRIC;
export type DepthId = keyof typeof DEPTH;
export const RUBRIC_IDS = Object.keys(RUBRIC) as RubricId[];
export const DEPTH_IDS = Object.keys(DEPTH) as DepthId[];
/** §3 pass bar: these criteria must score 2 on every path. */
export const MUST_SCORE_TWO: readonly RubricId[] = ["C3", "C4", "C5", "C7", "C13"];
/** Criteria whose evidence lives in the parent panel or the source note. */
const PARENT_EVIDENCE: ReadonlySet<string> = new Set(["C12", "C13", "C14", "D4", "D6"]);

export const AUTOMATIC_FAILS = [
  "preaching (a virtue word or a stated moral)",
  "two branches' first pages share text or picture state",
  "a page without the hero as an active subject (COMPANION; CAST: the figure)",
  "shame (a scold that stands, a crying or ashamed hero, a narrator verdict, a branch that ends the book)",
  "an unsafe cost or canonical violence depicted",
  "a public figure named",
  "over a word cap",
  "a dead-end branch or a repair with a second choice",
  "HE parity broken or HE not marked review-owed",
  "a model call needed to read",
  "a score shown to the child",
  "the hero replaces an ADULT figure",
  "God depicted or a theology lesson",
  "a canonical outcome altered",
] as const;

export interface PathPage {
  pageId: string;
  lines: { en: string; heM: string; heF: string }[];
}
export interface ManuscriptPath {
  choiceId: string;
  type: string;
  label: { en: string; he: string };
  pages: PathPage[];
}

const flat = (l: BookLine) => ({ en: l.en, heM: l.he.m, heF: l.he.f });

/** Each read path, page by page, with only that path's echo lines. */
export function manuscriptPaths(book: Book): ManuscriptPath[] {
  return bookChoices(book).map((c) => ({
    choiceId: c.id,
    type: c.type,
    label: c.label,
    pages: [book.cover, ...readPath(book, c.id)].map((p) => ({
      pageId: p.id,
      lines: [
        ...(p.id === "cover" ? [{ en: book.coverLine.en, heM: book.coverLine.he, heF: book.coverLine.he }] : []),
        ...pageLines(p).filter((l) => l.role !== "echo" || l.key === c.id).map((l) => flat(l.line)),
      ],
    })),
  }));
}

/** The parent panel and source note, as quotable lines. */
function parentLines(book: Book): string[] {
  const pp = book.parent as unknown as Record<string, unknown>;
  const out: string[] = [book.knowledge, book.sourceRef, book.childRole, ...book.additions];
  for (const v of Object.values(pp)) {
    if (!v || typeof v !== "object") continue;
    const o = v as { en?: unknown; he?: unknown };
    if (typeof o.en === "string") out.push(o.en);
    if (typeof o.he === "string") out.push(o.he);
    else if (o.he && typeof o.he === "object") for (const h of Object.values(o.he as Record<string, unknown>)) if (typeof h === "string") out.push(h);
  }
  return out;
}

const norm = (t: string) => t.normalize("NFC").replace(/[֑-ׇ]/g, "").replace(/[“”„«»]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();

/** Where a criterion's quote may come from on one path. */
function corpus(book: Book, path: ManuscriptPath, id: string): string[] {
  const text = path.pages.flatMap((p) => p.lines.flatMap((l) => [l.en, l.heM, l.heF]));
  const labels = bookChoices(book).flatMap((c) => [c.label.en, c.label.he]);
  return [...text, ...labels, book.title.en, book.title.he, ...(PARENT_EVIDENCE.has(id) ? parentLines(book) : [])].map(norm);
}

/** The brief one critic run is given for one path. */
export function criticPrompt(book: Book, choiceId: string): string {
  const path = manuscriptPaths(book).find((p) => p.choiceId === choiceId);
  if (!path) throw new Error(`no path ${choiceId} in ${book.id}`);
  const pages = path.pages.map((p) => [`### ${p.pageId}`, ...p.lines.map((l) => `EN: ${l.en}\nHE-m: ${l.heM}\nHE-f: ${l.heF}`)].join("\n")).join("\n\n");
  return [
    `# Manuscript critic — "${book.title.en}" (${book.id}), path ${path.choiceId} (${path.type.toUpperCase()}: "${path.label.en}")`,
    "",
    "You are an independent critic of a children's picture book (Arbor kid-books standard §3). Score THIS read path only. You never rewrite the book.",
    "For every criterion give a score 0, 1 or 2 and quote ONE line from this path's text (or, for C12, C13, C14, D4 and D6, from the parent panel or the source note) EXACTLY as written, as your evidence. A quote that is not in the text will be rejected.",
    "",
    "## Rubric (2 = the bar)",
    ...RUBRIC_IDS.map((id) => `- ${id} ${RUBRIC[id]}`),
    "",
    "## Depth rubric",
    ...DEPTH_IDS.map((id) => `- ${id} ${DEPTH[id]}`),
    "",
    "## Automatic fails (list any you find; one is enough to fail the book)",
    ...AUTOMATIC_FAILS.map((f) => `- ${f}`),
    "",
    `## The knowledge sentence\n${book.knowledge}`,
    `## Source\n${book.sourceRef} — ${book.childRole}`,
    "",
    "## The path, page by page",
    pages,
    "",
    "## The parent panel and source note",
    ...parentLines(book).map((l) => `- ${l}`),
    "",
    "## Your report (JSON only)",
    '{ "choiceId": "' + path.choiceId + '", "scores": { "C1": { "score": 0, "quote": "" }, … "C14": { … } }, "depth": { "D1": { "score": 0, "quote": "" }, … "D6": { … } }, "autoFails": [], "notes": "" }',
  ].join("\n");
}

export interface Scored {
  score: number;
  quote: string;
}
export interface CriticPathReport {
  choiceId: string;
  scores: Partial<Record<RubricId, Scored>>;
  depth: Partial<Record<DepthId, Scored>>;
  autoFails: string[];
  notes?: string;
}
export interface CriticReport {
  bookId: string;
  /** Who scored it (a person or an agent run); never assumed. */
  critic: string;
  paths: CriticPathReport[];
}

/** What makes a report unusable as evidence (empty = every score is quoted from its own path). */
export function validateCriticReport(book: Book, report: CriticReport): string[] {
  const out: string[] = [];
  if (report.bookId !== book.id) out.push(`the report is for ${report.bookId}, not ${book.id}`);
  if (!report.critic || !report.critic.trim()) out.push("the report names no critic");
  const paths = manuscriptPaths(book);
  for (const path of paths) {
    const r = report.paths.find((p) => p.choiceId === path.choiceId);
    if (!r) {
      out.push(`path ${path.choiceId}: not scored`);
      continue;
    }
    const check = (id: string, s: Scored | undefined) => {
      if (!s) return out.push(`path ${path.choiceId} ${id}: no score`);
      if (![0, 1, 2].includes(s.score)) out.push(`path ${path.choiceId} ${id}: score ${s.score} is not 0, 1 or 2`);
      const q = typeof s.quote === "string" ? norm(s.quote) : "";
      if (q.length < 3) out.push(`path ${path.choiceId} ${id}: no quoted evidence`);
      else if (!corpus(book, path, id).some((line) => line.includes(q))) out.push(`path ${path.choiceId} ${id}: the quote is not in this path's text ("${s.quote}")`);
    };
    for (const id of RUBRIC_IDS) check(id, r.scores[id]);
    for (const id of DEPTH_IDS) check(id, r.depth[id]);
    if (!Array.isArray(r.autoFails)) out.push(`path ${path.choiceId}: autoFails is not a list`);
  }
  for (const r of report.paths) if (!paths.some((p) => p.choiceId === r.choiceId)) out.push(`path ${r.choiceId}: not a path of ${book.id}`);
  return out;
}

export interface CriticVerdict {
  pass: boolean;
  /** Rubric total per path (out of 28) and depth per path (out of 12). */
  totals: Record<string, { rubric: number; depth: number }>;
  reasons: string[];
}

/** §3 pass bar: no automatic fail, ≥ 23/28 on every path, no criterion at 0,
 *  C3 C4 C5 C7 C13 = 2, depth ≥ 11/12 on the lowest path. A report that does
 *  not validate never passes. */
export function criticVerdict(book: Book, report: CriticReport): CriticVerdict {
  const reasons = [...validateCriticReport(book, report)];
  const totals: CriticVerdict["totals"] = {};
  for (const r of report.paths) {
    const rubric = RUBRIC_IDS.reduce((n, id) => n + (r.scores[id]?.score ?? 0), 0);
    const depth = DEPTH_IDS.reduce((n, id) => n + (r.depth[id]?.score ?? 0), 0);
    totals[r.choiceId] = { rubric, depth };
    if (r.autoFails?.length) reasons.push(`path ${r.choiceId}: automatic fail — ${r.autoFails.join("; ")}`);
    if (rubric < 23) reasons.push(`path ${r.choiceId}: ${rubric}/28 < 23`);
    for (const id of RUBRIC_IDS) if (r.scores[id]?.score === 0) reasons.push(`path ${r.choiceId}: ${id} at 0`);
    for (const id of MUST_SCORE_TWO) if (r.scores[id] && r.scores[id]!.score !== 2) reasons.push(`path ${r.choiceId}: ${id} must be 2`);
  }
  const depths = Object.values(totals).map((t) => t.depth);
  if (depths.length && Math.min(...depths) < 11) reasons.push(`depth ${Math.min(...depths)}/12 on the lowest path < 11`);
  return { pass: reasons.length === 0, totals, reasons };
}
