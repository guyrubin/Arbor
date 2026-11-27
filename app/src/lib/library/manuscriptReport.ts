/**
 * lib/library/manuscriptReport — B-BOOK-33: the quoted per-path critic
 * report, built deterministically from the book's own text (no model call).
 * For one canonical book and each of its read paths it lists:
 *
 *  - AUTOMATIC findings: every manuscriptLint hit that falls on that path,
 *    with the exact line (or sentence) that triggered it, quoted;
 *  - NEEDS HUMAN REVIEW: every rubric (C1–C14) and depth (D1–D6) criterion,
 *    and every §3 automatic fail a script cannot see, each with the quoted
 *    passage of THIS path a reviewer judges it on. These are never scored
 *    here and never marked passed: the status is fixed.
 *
 * Narrative depth is preserved by construction: the lint holds only the
 * standard's ceilings, required parts and banned elements
 * (manuscriptLint.AUTOMATIC_RULES); nothing here scores length, rewards a
 * cut or asks for a flatter page. The depth inventory below is facts for the
 * reviewer, not a score.
 *
 * Pure: the caller passes the plate briefs (scripts/manuscript-report.mts
 * reads the art-round captions); renderManuscriptReport is plain Markdown.
 */
import { allBookPages, bookChoices, decisionOf, rejoinPageIdOf } from "./bookShape";
import { DEPTH, DEPTH_IDS, manuscriptPaths, RUBRIC, RUBRIC_IDS, type ManuscriptPath } from "./manuscriptCritic";
import { AUTOMATIC_RULES, bookMode, sentenceWords, bookPictureBriefs, bookSentences, lintManuscript, manuscriptBand, type ManuscriptLintOptions } from "./manuscriptLint";
import type { LintHit } from "./plans/planLint";
import { words } from "./plans/planLint";
import type { Book, Page } from "./types";

export const HUMAN_REVIEW = "needs human review" as const;

/** §3 automatic fails no script can decide (they are judgement, not keywords). */
export const HUMAN_AUTOMATIC_FAILS = {
  H1: "a page without the hero as an active subject (COMPANION; CAST: the figure)",
  H2: "an unsafe cost or canonical violence depicted",
  H3: "a public figure named",
  H4: "the hero replaces an ADULT figure",
  H5: "a theology lesson",
  H6: "a canonical outcome altered",
  H7: "HE not marked review-owed (native read: B-BOOK-34)",
} as const;
export type HumanFailId = keyof typeof HUMAN_AUTOMATIC_FAILS;

export interface QuotedLine {
  pageId: string;
  lang: "en" | "he-m" | "he-f" | "parent" | "picture";
  quote: string;
}
export interface AutomaticFinding {
  rule: string;
  clause: string;
  pageId: string;
  lang: string;
  detail?: string;
  quote: string;
}
export interface HumanItem {
  id: string;
  criterion: string;
  status: typeof HUMAN_REVIEW;
  passages: QuotedLine[];
}
export interface PathReport {
  choiceId: string;
  type: string;
  label: string;
  automatic: AutomaticFinding[];
  human: HumanItem[];
  /** Facts for the reviewer, never a score. */
  inventory: { pages: number; enWords: number; refrains: string[]; quotedLines: number; echoLines: number; repairTaps: number };
}
export interface BookReport {
  bookId: string;
  title: string;
  mode: string;
  band: string;
  /** Hits on no single path (the title, a plate brief, a structural rule). */
  bookWide: AutomaticFinding[];
  paths: PathReport[];
}

const finding = (h: LintHit): AutomaticFinding => ({
  rule: h.rule,
  clause: (AUTOMATIC_RULES as Record<string, { clause: string }>)[h.rule]?.clause ?? "",
  pageId: h.pageId,
  lang: h.lang,
  ...(h.detail ? { detail: h.detail } : {}),
  quote: h.text,
});

/** The page ids (and choice keys) a lint hit belongs to on one path. */
function hitOnPath(book: Book, path: ManuscriptPath, h: LintHit): boolean {
  const ids = new Set(path.pages.map((p) => p.pageId));
  const decision = decisionOf(book);
  if (ids.has(h.pageId)) return true;
  if (decision && h.pageId === `${decision.pageId}-choice-${path.choiceId}`) return true;
  if (h.pageId === path.choiceId) return true;
  if (h.pageId.includes("|")) return h.pageId.split("|").some((id) => ids.has(id));
  return false;
}

/** Sentences said twice or more on one path (a refrain), EN. */
function refrains(path: ManuscriptPath): string[] {
  const seen = new Map<string, number>();
  for (const p of path.pages) for (const l of p.lines) for (const s of bookSentences(l.en)) {
    const k = s.replace(/["“”]/g, "").trim();
    if (sentenceWords(k) >= 2) seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  return [...seen].filter(([, n]) => n > 1).map(([s]) => s).sort();
}

const VIOLENCE = /\b(sword|spear|kill|killed|dead|blood|hit|hits|strike|strikes|fall|falls|fell|head|cut|fight|grabs|swing|boom)\b/i;
const THEOLOGY = /\b(god|lord|pray|prays|bless|blessing|altar|heaven)\b|אלוהים|ה'|מזבח|מתפלל/i;

/** The deterministic report of one book: per path, quoted findings and quoted review passages. */
export function manuscriptReport(book: Book, opts: ManuscriptLintOptions = {}): BookReport {
  const briefs = { ...bookPictureBriefs(book), ...(opts.plateBriefs ?? {}) };
  const hits = lintManuscript(book, { ...opts, plateBriefs: briefs });
  const paths = manuscriptPaths(book);
  const choices = bookChoices(book);
  const decision = decisionOf(book);
  const rejoin = rejoinPageIdOf(book);
  const last = book.pages[book.pages.length - 1]?.id;
  const pp = book.parent;
  const pageById = new Map(allBookPages(book).map((p) => [p.id, p]));
  const parentQ = (...ls: (string | undefined)[]): QuotedLine[] => ls.filter((l): l is string => !!l && !!l.trim()).map((quote) => ({ pageId: "parent", lang: "parent" as const, quote }));

  const bookWide = hits.filter((h) => !paths.some((p) => hitOnPath(book, p, h))).map(finding);

  const report: BookReport = {
    bookId: book.id,
    title: book.title.en,
    mode: bookMode(book),
    band: manuscriptBand(book),
    bookWide,
    paths: paths.map((path) => {
      const choice = choices.find((c) => c.id === path.choiceId)!;
      const branchIds = new Set(choice.branch.map((p) => p.id));
      const pageEn = (pred: (id: string, i: number) => boolean): QuotedLine[] =>
        path.pages.flatMap((p, i) => (pred(p.pageId, i) ? p.lines.map((l) => ({ pageId: p.pageId, lang: "en" as const, quote: l.en })) : []));
      const pageAll = (pred: (id: string) => boolean): QuotedLine[] =>
        path.pages.flatMap((p) => (pred(p.pageId) ? p.lines.flatMap((l) => [{ pageId: p.pageId, lang: "en" as const, quote: l.en }, { pageId: p.pageId, lang: "he-m" as const, quote: l.heM }, { pageId: p.pageId, lang: "he-f" as const, quote: l.heF }]) : []));
      const sentencesWhere = (re: RegExp): QuotedLine[] =>
        path.pages.flatMap((p) => p.lines.flatMap((l) => [...bookSentences(l.en).filter((s) => re.test(s)).map((quote) => ({ pageId: p.pageId, lang: "en" as const, quote })), ...(re.test(l.heM) ? [{ pageId: p.pageId, lang: "he-m" as const, quote: l.heM }] : [])]));
      const firstSentences = path.pages.flatMap((p) => (p.pageId === "cover" ? [] : p.lines.slice(0, 1).map((l) => ({ pageId: p.pageId, lang: "en" as const, quote: bookSentences(l.en)[0] ?? l.en }))));
      const lastSentences = path.pages.flatMap((p) => (p.pageId === "cover" ? [] : p.lines.slice(0, 1).map((l) => { const s = bookSentences(l.en); return { pageId: p.pageId, lang: "en" as const, quote: s[s.length - 1] ?? l.en }; })));
      const quoted = sentencesWhere(/["“”]/);
      const decisionIdx = path.pages.findIndex((p) => p.pageId === decision?.pageId);
      const labels: QuotedLine[] = choices.map((c) => ({ pageId: `${decision?.pageId}-choice-${c.id}`, lang: "en" as const, quote: `${c.type.toUpperCase()}: ${c.label.en}` }));
      const pathPages = path.pages.map((p) => pageById.get(p.pageId)).filter((p): p is Page => !!p);
      const platesOnPath = new Set(pathPages.flatMap((p) => [p.plateId, ...(p.artStates ?? []).flatMap((s) => (s.plateId ? [s.plateId] : []))]));
      const pictures: QuotedLine[] = Object.entries(briefs)
        .filter(([k]) => (k.includes(":") ? path.pages.some((p) => k.startsWith(`${p.pageId}:`)) : platesOnPath.has(k)))
        .map(([k, v]) => ({ pageId: k.includes(":") ? k.split(":")[0] : `plate ${k}`, lang: "picture" as const, quote: v }));
      const branchPages = pageAll((id) => branchIds.has(id));
      const echoLines = path.pages.filter((p) => p.pageId === rejoin || p.pageId === last).flatMap((p) => {
        const page = book.pages.find((q) => q.id === p.pageId);
        const e = page?.echo?.[path.choiceId];
        return e ? [{ pageId: p.pageId, lang: "en" as const, quote: e.en }, { pageId: p.pageId, lang: "he-m" as const, quote: e.he.m }] : [];
      });
      const repairLines = choice.branch.flatMap((p) => (p.repair ? [
        { pageId: p.id, lang: "en" as const, quote: p.repair.promptLabel.en },
        ...p.repair.items.flatMap((it) => (it.line ? [{ pageId: p.id, lang: "en" as const, quote: it.line.en }] : it.label ? [{ pageId: p.id, lang: "en" as const, quote: it.label.en }] : [])),
        { pageId: p.id, lang: "en" as const, quote: p.repair.textAfter.en },
      ] : []));

      const rubricPassages: Record<string, QuotedLine[]> = {
        C1: pageEn((_, i) => i <= 3),
        C2: pageEn((_, i) => decisionIdx >= 0 && i >= decisionIdx - 1 && i <= decisionIdx),
        C3: [...labels, ...pageEn((id) => id === decision?.pageId)],
        C4: branchPages.slice(0, 3),
        C5: repairLines.length ? repairLines : branchPages.filter((l) => l.lang === "en"),
        C6: echoLines,
        C7: firstSentences,
        C8: [...pageEn((id) => id !== "cover"), ...pictures],
        C9: [...refrains(path).map((quote) => ({ pageId: "path", lang: "en" as const, quote })), ...lastSentences],
        C10: pageEn((id) => id !== "cover"),
        C11: pageAll((id) => id === last),
        C12: parentQ(pp.knows?.en, pp.builds?.en, pp.whyNow?.en, pp.why?.en, pp.tomorrow?.en, pp.askAfter.en, pp.askAfterOptional?.en, pp.together?.en),
        C13: parentQ(book.sourceRef, book.childRole, ...book.additions, pp.sourceNote.en),
        C14: [...parentQ(book.knowledge), ...branchPages.filter((l) => l.lang === "en")],
      };
      const depthPassages: Record<string, QuotedLine[]> = {
        D1: [...branchPages.filter((l) => l.lang === "en"), ...pageEn((id) => id === rejoin || id === last)],
        D2: [...refrains(path).map((quote) => ({ pageId: "path", lang: "en" as const, quote })), ...quoted],
        D3: pictures,
        D4: parentQ(book.knowledge, pp.tomorrow?.en ?? pp.why?.en),
        D5: lastSentences,
        D6: [...quoted, ...parentQ(pp.sourceNote.en, ...book.additions)],
      };
      const failPassages: Record<HumanFailId, QuotedLine[]> = {
        H1: firstSentences,
        H2: sentencesWhere(VIOLENCE),
        H3: parentQ(book.sourceRef, ...book.additions),
        H4: [...parentQ(book.childRole), ...branchPages.filter((l) => l.lang === "en")],
        H5: sentencesWhere(THEOLOGY),
        H6: [...pageEn((id) => id === last), ...parentQ(book.sourceRef, pp.sourceNote.en)],
        H7: pageAll((id) => id !== "cover").filter((l) => l.lang !== "en"),
      };
      const human: HumanItem[] = [
        ...RUBRIC_IDS.map((id) => ({ id, criterion: RUBRIC[id], status: HUMAN_REVIEW, passages: rubricPassages[id] ?? [] })),
        ...DEPTH_IDS.map((id) => ({ id, criterion: DEPTH[id], status: HUMAN_REVIEW, passages: depthPassages[id] ?? [] })),
        ...(Object.keys(HUMAN_AUTOMATIC_FAILS) as HumanFailId[]).map((id) => ({ id, criterion: `automatic fail (human): ${HUMAN_AUTOMATIC_FAILS[id]}`, status: HUMAN_REVIEW, passages: failPassages[id] })),
      ].map((h) => ({ ...h, passages: dedupe(h.passages) })).map((h) => ({ ...h, passages: h.passages.length ? h.passages : [{ pageId: "path", lang: "en" as const, quote: "(nothing on this path to quote — the reviewer decides whether that is itself the finding)" }] }));

      return {
        choiceId: path.choiceId,
        type: path.type,
        label: path.label.en,
        automatic: hits.filter((h) => hitOnPath(book, path, h)).map(finding),
        human,
        inventory: {
          pages: path.pages.length - 1,
          enWords: path.pages.reduce((n, p) => n + p.lines.reduce((m, l) => m + words(l.en), 0), 0),
          refrains: refrains(path),
          quotedLines: quoted.length,
          echoLines: echoLines.filter((l) => l.lang === "en").length,
          repairTaps: choice.branch.reduce((n, p) => n + (p.repair?.items.length ?? 0), 0),
        },
      };
    }),
  };
  return report;
}

const dedupe = (ls: QuotedLine[]): QuotedLine[] => {
  const seen = new Set<string>();
  return ls.filter((l) => { const k = `${l.pageId}|${l.lang}|${l.quote}`; if (seen.has(k) || !l.quote.trim()) return false; seen.add(k); return true; });
};

const q = (s: string) => `> ${s.replace(/\n/g, " ")}`;

/** The report as Markdown, one section per path. */
export function renderManuscriptReport(r: BookReport): string {
  const out: string[] = [
    `# Manuscript report — "${r.title}" (${r.bookId})`,
    "",
    `Mode ${r.mode} · band ${r.band} · ${r.paths.length} read paths · generated from the registry text; no model was called.`,
    "",
    "Depth: the automatic rules are the standard's ceilings, required parts and banned elements only. None rewards cutting text; no length, readability or flatness score exists. Depth (D1–D6) and every judgement criterion below is for a human reviewer and is never marked passed here.",
    "",
    `## Book-wide automatic findings (${r.bookWide.length})`,
    ...(r.bookWide.length ? r.bookWide.flatMap((f) => [`- **${f.rule}** (${f.clause}) · ${f.pageId} · ${f.lang}${f.detail ? ` · ${f.detail}` : ""}`, `  ${q(f.quote)}`]) : ["- none"]),
  ];
  for (const p of r.paths) {
    out.push(
      "",
      `## Path ${p.choiceId} — ${p.type.toUpperCase()}: "${p.label}"`,
      "",
      `Inventory (facts, not a score): ${p.inventory.pages} pages · ${p.inventory.enWords} EN words · ${p.inventory.quotedLines} quoted sentences · ${p.inventory.echoLines} echo lines · ${p.inventory.repairTaps} repair taps · refrains: ${p.inventory.refrains.length ? p.inventory.refrains.map((s) => `"${s}"`).join(", ") : "none"}`,
      "",
      `### Automatic findings (${p.automatic.length})`,
      ...(p.automatic.length ? p.automatic.flatMap((f) => [`- **${f.rule}** (${f.clause}) · ${f.pageId} · ${f.lang}${f.detail ? ` · ${f.detail}` : ""}`, `  ${q(f.quote)}`]) : ["- none"]),
      "",
      "### Needs human review",
    );
    for (const h of p.human) {
      out.push(`- **${h.id}** — ${h.criterion} — _${h.status}_`);
      for (const l of h.passages) out.push(`  - ${l.pageId} · ${l.lang}: “${l.quote}”`);
    }
  }
  return out.join("\n") + "\n";
}

/** The art-round plate captions (scripts/dev-book-placeholders.py PLATES),
 *  per book: the only plate-brief text a canonical book has in the repo. */
export function parsePlaceholderCaptions(pySource: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  const block = pySource.match(/^PLATES = \{([\s\S]*?)^\}/m)?.[1] ?? "";
  let current: string | null = null;
  for (const line of block.split("\n")) {
    const book = line.match(/^\s{4}"([a-z0-9-]+)":\s*\{\s*$/);
    if (book) { current = book[1]; out[current] = {}; continue; }
    const plate = line.match(/^\s{8}"([A-Za-z0-9-]+)":\s*\(\s*"[a-z]+",\s*"([^"]*)"\s*\)/);
    if (plate && current) out[current][plate[1]] = plate[2];
  }
  return out;
}
