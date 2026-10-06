/**
 * B-LOOP-02 — native Hebrew review of the milestone catalogue.
 *
 *   npx tsx scripts/milestone-he-review.mts export [--out <dir>]
 *   npx tsx scripts/milestone-he-review.mts import <file.csv> [--catalogue <path>] [--data <path>]
 *   npx tsx scripts/milestone-he-review.mts --help
 *
 * A .mts run with tsx (like eval-judge.mts / acceptance-eval.mts): the EN text
 * is read from lib/milestoneData.ts and the HE text from the
 * lib/i18nElevation/milestoneCatalogue.ts dictionary — the TS sources, never a
 * copy.
 *
 * EXPORT writes HE-REVIEW-<YYYY-MM-DD>.csv (UTF-8 WITH BOM so Excel opens the
 * Hebrew intact; CRLF rows; every cell quoted): one row per catalogue id —
 * id · band · shelf · EN title · HE title · EN desc · HE desc · EN looks ·
 * HE looks · reviewer_ok · reviewer_fix · reviewer_note.
 *
 * IMPORT applies `reviewer_fix` cells into milestoneCatalogue.ts BY KEY: the
 * exact existing HE value of that key is string-replaced in place (the file is
 * never regenerated); a key whose current value is not found exactly once —
 * or differs from the HE text the reviewer saw — is REFUSED. A fix that
 * carries Latin letters, a verdict/norm word (lib/milestoneHeRules) or a
 * diagnosis term (lib/clinicalScan) is refused too. It prints the keys
 * changed, and flips MILESTONE_HE_REVIEW to "native-reviewed" in
 * milestoneData.ts ONLY when every catalogue id has reviewer_ok = 1 or a
 * non-empty fix; otherwise the flag stays and the gap ids are listed.
 *
 * reviewer_fix cell: one line per corrected field, `title=…`, `desc=…`,
 * `looks=…` (or the Hebrew prefixes `כותרת=`, `תיאור=`, `איך זה נראה=`).
 *
 * PRACTICES MODE (B-LOOP-08, the practice library, content/practices.ts):
 *
 *   npx tsx scripts/milestone-he-review.mts --practices export [--out <dir>]
 *   npx tsx scripts/milestone-he-review.mts --practices import <file.csv> [--practices-file <path>]
 *
 * EXPORT writes HE-REVIEW-PRACTICES-<YYYY-MM-DD>.csv (BOM, CRLF, quoted):
 * one row per practice — id · milestoneId (`—` for a shelf-level practice) · shelf · band · EN do · HE do ·
 * EN say · HE say · reviewer_ok · reviewer_fix · reviewer_note.
 * IMPORT applies `reviewer_fix` (`do=…` / `say=…`, or `עשו=` / `אמרו=`) into
 * content/practices.ts BY ID + FIELD: inside the practice's `P("<milestoneId>"`
 * block, the `do:` / `say:` line's exact HE value is string-replaced (never
 * regenerated); a stale or non-unique value is REFUSED, and so is a fix that
 * carries Latin letters, a verdict/norm word, a diagnosis term, a practice
 * banned word (PRACTICE_BANNED) or more words than the cap (do 25, say 15).
 * Practices carry no review flag (reviewStatus stays "draft" until the
 * clinical reviewer signs); the import lists the unsigned ids.
 */
import process from "node:process";
import path from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ALL_MILESTONES, MILESTONE_AGE_BANDS, bandForAgeMonths } from "../src/lib/milestoneData.js";
import { HE_MILESTONE_TEXT } from "../src/lib/i18nElevation/milestoneCatalogue.js";
import { milestoneShelf } from "../src/lib/shelves/registry.js";
import { HE_VERDICT_WORDS } from "../src/lib/milestoneHeRules.js";
import { findClinicalDiagnosisTerm } from "../src/lib/clinicalScan.js";
import { PRACTICES, PRACTICE_BANNED } from "../src/content/practices.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_OUT_DIR = "C:/Users/dguyr/ROS/PAI/projects/arbor/execution/2026-10-06--milestone-loop";
export const DEFAULT_CATALOGUE = path.resolve(HERE, "..", "src", "lib", "i18nElevation", "milestoneCatalogue.ts");
export const DEFAULT_DATA = path.resolve(HERE, "..", "src", "lib", "milestoneData.ts");

export const COLUMNS = ["id", "band", "shelf", "en_title", "he_title", "en_desc", "he_desc", "en_looks", "he_looks", "reviewer_ok", "reviewer_fix", "reviewer_note"] as const;
export const BOM = "\uFEFF";
const FIELDS = ["title", "desc", "looks"] as const;
type Field = (typeof FIELDS)[number];
const FIX_PREFIX: Record<string, Field> = { title: "title", desc: "desc", looks: "looks", "כותרת": "title", "תיאור": "desc", "איך זה נראה": "looks" };
const FLAG_AI = 'export const MILESTONE_HE_REVIEW: "ai-first-pass" | "native-reviewed" = "ai-first-pass";';
const FLAG_NATIVE = 'export const MILESTONE_HE_REVIEW: "ai-first-pass" | "native-reviewed" = "native-reviewed";';

/* ── CSV ───────────────────────────────────────────────────────────────── */

const quote = (cell: string): string => `"${cell.replace(/"/g, '""')}"`;

/** RFC 4180 parse (quoted cells may hold commas, quotes and newlines); a leading BOM is dropped. */
export function parseCsv(text: string): string[][] {
  const src = text.startsWith(BOM) ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(cell); cell = "";
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

/* ── EXPORT ────────────────────────────────────────────────────────────── */

export type ReviewRow = Record<(typeof COLUMNS)[number], string>;

/** One row per catalogue id, EN from milestoneData, HE from the dictionary. */
export function buildReviewRows(): ReviewRow[] {
  return ALL_MILESTONES.map((m) => {
    const he = HE_MILESTONE_TEXT[m.id];
    if (!he) throw new Error(`catalogue id ${m.id} has no Hebrew row in milestoneCatalogue.ts`);
    const band = typeof m.ageMonths === "number" ? bandForAgeMonths(m.ageMonths).label : m.ageGroup;
    return {
      id: m.id, band, shelf: milestoneShelf(m),
      en_title: m.title, he_title: he[0],
      en_desc: m.description, he_desc: he[1],
      en_looks: m.skillLooksLike ?? m.description, he_looks: he[2],
      reviewer_ok: "", reviewer_fix: "", reviewer_note: "",
    };
  });
}

/** The CSV text: BOM + header + one quoted row per id, CRLF line ends (Excel). */
export function buildExportCsv(rows: ReviewRow[] = buildReviewRows()): string {
  const lines = [COLUMNS.map((c) => quote(c)).join(","), ...rows.map((r) => COLUMNS.map((c) => quote(r[c])).join(","))];
  return BOM + lines.join("\r\n") + "\r\n";
}

export const exportFileName = (now: Date = new Date()): string => `HE-REVIEW-${now.toISOString().slice(0, 10)}.csv`;

export function runExport(outDir: string = DEFAULT_OUT_DIR, now: Date = new Date()): { file: string; rows: number } {
  mkdirSync(outDir, { recursive: true });
  const rows = buildReviewRows();
  const file = path.join(outDir, exportFileName(now));
  writeFileSync(file, buildExportCsv(rows), "utf8");
  return { file, rows: rows.length };
}

/* ── IMPORT ────────────────────────────────────────────────────────────── */

/** Parse a reviewer_fix cell into field → new text. Throws on a line with no known prefix. */
export function parseFix(cell: string): Partial<Record<Field, string>> {
  const out: Partial<Record<Field, string>> = {};
  for (const raw of cell.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const eq = line.indexOf("=");
    const field = eq > 0 ? FIX_PREFIX[line.slice(0, eq).trim()] : undefined;
    if (!field) throw new Error(`reviewer_fix line has no title= / desc= / looks= prefix: "${line}"`);
    out[field] = line.slice(eq + 1).trim();
  }
  return out;
}

/** Why a Hebrew fix may not enter the catalogue, or null. */
export function fixProblem(text: string): string | null {
  if (!text) return "empty";
  if (/[A-Za-z]/.test(text)) return "Latin letters";
  const verdict = HE_VERDICT_WORDS.find((w) => text.includes(w));
  if (verdict) return `verdict/norm word "${verdict}"`;
  const term = findClinicalDiagnosisTerm(text);
  if (term) return `diagnosis term "${term}"`;
  return null;
}

export interface ImportResult {
  changed: string[];
  refused: string[];
  gaps: string[];
  flag: "ai-first-pass" | "native-reviewed";
}

export function runImport(csvText: string, opts: { catalogue?: string; data?: string } = {}): ImportResult {
  const cataloguePath = opts.catalogue ?? DEFAULT_CATALOGUE;
  const dataPath = opts.data ?? DEFAULT_DATA;
  const [header, ...body] = parseCsv(csvText);
  const col = (name: (typeof COLUMNS)[number]) => {
    const i = header?.indexOf(name) ?? -1;
    if (i < 0) throw new Error(`CSV has no "${name}" column`);
    return i;
  };
  const idx = { id: col("id"), ok: col("reviewer_ok"), fix: col("reviewer_fix"), he: [col("he_title"), col("he_desc"), col("he_looks")] };

  const rawCatalogue = readFileSync(cataloguePath, "utf8");
  const crlf = rawCatalogue.includes("\r\n");
  const lines = rawCatalogue.replace(/\r\n/g, "\n").split("\n");
  const changed: string[] = [];
  const refused: string[] = [];
  const signed = new Set<string>();

  for (const row of body) {
    const id = row[idx.id]?.trim();
    if (!id) continue;
    const ok = row[idx.ok]?.trim() === "1";
    const fixCell = row[idx.fix] ?? "";
    let fix: Partial<Record<Field, string>> = {};
    try {
      fix = parseFix(fixCell);
    } catch (e) {
      refused.push(`${id}: ${(e as Error).message}`);
      continue;
    }
    const lineNo = lines.findIndex((l) => l.startsWith(`  ${JSON.stringify(id)}: [`));
    let rowRefused = false;
    for (const field of FIELDS) {
      const next = fix[field];
      if (next === undefined) continue;
      const key = `ms.item.${id}.${field}`;
      const problem = fixProblem(next);
      if (problem) { refused.push(`${key}: ${problem}`); rowRefused = true; continue; }
      if (lineNo < 0) { refused.push(`${key}: no dictionary row for ${id}`); rowRefused = true; continue; }
      const seen = row[idx.he[FIELDS.indexOf(field)]] ?? "";
      const current = JSON.stringify(seen);
      const occurrences = lines[lineNo].split(current).length - 1;
      if (occurrences !== 1) { refused.push(`${key}: the current value is not the text the reviewer saw (or not unique) — re-export`); rowRefused = true; continue; }
      if (next === seen) continue;
      lines[lineNo] = lines[lineNo].replace(current, () => JSON.stringify(next));
      changed.push(key);
    }
    if (!rowRefused && (ok || Object.keys(fix).length > 0)) signed.add(id);
  }

  if (changed.length > 0) {
    const out = lines.join("\n");
    writeFileSync(cataloguePath, crlf ? out.replace(/\n/g, "\r\n") : out, "utf8");
  }

  const gaps = ALL_MILESTONES.map((m) => m.id).filter((id) => !signed.has(id));
  let flag: ImportResult["flag"] = "ai-first-pass";
  const data = readFileSync(dataPath, "utf8");
  if (gaps.length === 0 && refused.length === 0) {
    if (data.includes(FLAG_AI)) writeFileSync(dataPath, data.replace(FLAG_AI, FLAG_NATIVE), "utf8");
    else if (!data.includes(FLAG_NATIVE)) throw new Error("MILESTONE_HE_REVIEW declaration not found in milestoneData.ts");
    flag = "native-reviewed";
  } else if (data.includes(FLAG_NATIVE)) {
    flag = "native-reviewed";
  }
  return { changed, refused, gaps, flag };
}

/* ── PRACTICES (B-LOOP-08) ─────────────────────────────────────────────── */

export const DEFAULT_PRACTICES = path.resolve(HERE, "..", "src", "content", "practices.ts");
/** B-LOOP-08 follow-up: the milestoneId cell of a shelf-level practice (milestoneId null). */
export const SHELF_LEVEL_MARK = "—";
export const PRACTICE_COLUMNS = ["id", "milestoneId", "shelf", "band", "en_do", "he_do", "en_say", "he_say", "reviewer_ok", "reviewer_fix", "reviewer_note"] as const;
export type PracticeReviewRow = Record<(typeof PRACTICE_COLUMNS)[number], string>;
const PRACTICE_FIELDS = ["do", "say"] as const;
type PracticeField = (typeof PRACTICE_FIELDS)[number];
const PRACTICE_FIX_PREFIX: Record<string, PracticeField> = { do: "do", say: "say", "עשו": "do", "אמרו": "say" };
const PRACTICE_WORD_CAP: Record<PracticeField, number> = { do: 25, say: 15 };

/** One row per practice, in library order; the text is the TS source's own. */
export function buildPracticeReviewRows(): PracticeReviewRow[] {
  return PRACTICES.map((p) => ({
    id: p.id, milestoneId: p.milestoneId ?? SHELF_LEVEL_MARK, shelf: p.shelf, band: bandForAgeMonths(p.ageMonths).label,
    en_do: p.do.en, he_do: p.do.he, en_say: p.say.en, he_say: p.say.he,
    reviewer_ok: "", reviewer_fix: "", reviewer_note: "",
  }));
}

export function buildPracticeExportCsv(rows: PracticeReviewRow[] = buildPracticeReviewRows()): string {
  const lines = [PRACTICE_COLUMNS.map((c) => quote(c)).join(","), ...rows.map((r) => PRACTICE_COLUMNS.map((c) => quote(r[c])).join(","))];
  return BOM + lines.join("\r\n") + "\r\n";
}

export const practicesExportFileName = (now: Date = new Date()): string => `HE-REVIEW-PRACTICES-${now.toISOString().slice(0, 10)}.csv`;

export function runPracticesExport(outDir: string = DEFAULT_OUT_DIR, now: Date = new Date()): { file: string; rows: number } {
  mkdirSync(outDir, { recursive: true });
  const rows = buildPracticeReviewRows();
  const file = path.join(outDir, practicesExportFileName(now));
  writeFileSync(file, buildPracticeExportCsv(rows), "utf8");
  return { file, rows: rows.length };
}

/** Parse a practice reviewer_fix cell (`do=` / `say=` / `עשו=` / `אמרו=`). */
export function parsePracticeFix(cell: string): Partial<Record<PracticeField, string>> {
  const out: Partial<Record<PracticeField, string>> = {};
  for (const raw of cell.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const eq = line.indexOf("=");
    const field = eq > 0 ? PRACTICE_FIX_PREFIX[line.slice(0, eq).trim()] : undefined;
    if (!field) throw new Error(`reviewer_fix line has no do= / say= prefix: "${line}"`);
    out[field] = line.slice(eq + 1).trim();
  }
  return out;
}

/** Why a Hebrew practice fix may not enter the library, or null. */
export function practiceFixProblem(text: string, field: PracticeField): string | null {
  const base = fixProblem(text);
  if (base) return base;
  const banned = PRACTICE_BANNED.he.find((w) => text.includes(w));
  if (banned) return `practice banned word "${banned}"`;
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words > PRACTICE_WORD_CAP[field]) return `${words} words (cap ${PRACTICE_WORD_CAP[field]})`;
  return null;
}

export interface PracticesImportResult {
  changed: string[];
  refused: string[];
  gaps: string[];
}

export function runPracticesImport(csvText: string, opts: { practices?: string } = {}): PracticesImportResult {
  const file = opts.practices ?? DEFAULT_PRACTICES;
  const [header, ...body] = parseCsv(csvText);
  const col = (name: (typeof PRACTICE_COLUMNS)[number]) => {
    const i = header?.indexOf(name) ?? -1;
    if (i < 0) throw new Error(`CSV has no "${name}" column`);
    return i;
  };
  const idx = { id: col("id"), milestoneId: col("milestoneId"), ok: col("reviewer_ok"), fix: col("reviewer_fix"), he: { do: col("he_do"), say: col("he_say") } };

  const raw = readFileSync(file, "utf8");
  const crlf = raw.includes("\r\n");
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const changed: string[] = [];
  const refused: string[] = [];
  const signed = new Set<string>();

  /** The line index of `field:` inside the practice block (`P("<milestoneId>"`, or
   *  `SP("<practiceId>"` for a shelf-level practice), or -1. */
  const fieldLine = (opener: string, field: PracticeField): number => {
    const start = lines.findIndex((l) => l.startsWith(opener));
    if (start < 0) return -1;
    for (let i = start + 1; i < lines.length; i += 1) {
      if (lines[i].startsWith("  P(") || lines[i].startsWith("  SP(") || lines[i].startsWith("];")) return -1;
      if (lines[i].startsWith(`    ${field}: L(`)) return i;
    }
    return -1;
  };

  for (const row of body) {
    const id = row[idx.id]?.trim();
    if (!id) continue;
    const milestoneId = row[idx.milestoneId]?.trim() ?? "";
    const shelfLevel = milestoneId === SHELF_LEVEL_MARK;
    if (shelfLevel ? !/^pr-[a-z]+-\d{2}$/.test(id) : id !== `pr-${milestoneId}`) { refused.push(`${id}: id and milestoneId disagree — re-export`); continue; }
    const opener = shelfLevel ? `  SP(${JSON.stringify(id)},` : `  P(${JSON.stringify(milestoneId)},`;
    const ok = row[idx.ok]?.trim() === "1";
    let fix: Partial<Record<PracticeField, string>> = {};
    try {
      fix = parsePracticeFix(row[idx.fix] ?? "");
    } catch (e) {
      refused.push(`${id}: ${(e as Error).message}`);
      continue;
    }
    let rowRefused = false;
    for (const field of PRACTICE_FIELDS) {
      const next = fix[field];
      if (next === undefined) continue;
      const key = `${id}.${field}.he`;
      const problem = practiceFixProblem(next, field);
      if (problem) { refused.push(`${key}: ${problem}`); rowRefused = true; continue; }
      const lineNo = fieldLine(opener, field);
      if (lineNo < 0) { refused.push(`${key}: no ${field}: line for ${id}`); rowRefused = true; continue; }
      const current = JSON.stringify(row[idx.he[field]] ?? "");
      if (lines[lineNo].split(current).length - 1 !== 1) { refused.push(`${key}: the current value is not the text the reviewer saw (or not unique) — re-export`); rowRefused = true; continue; }
      if (JSON.stringify(next) === current) continue;
      lines[lineNo] = lines[lineNo].replace(current, () => JSON.stringify(next));
      changed.push(key);
    }
    if (!rowRefused && (ok || Object.keys(fix).length > 0)) signed.add(id);
  }

  if (changed.length > 0) {
    const out = lines.join("\n");
    writeFileSync(file, crlf ? out.replace(/\n/g, "\r\n") : out, "utf8");
  }
  const gaps = PRACTICES.map((p) => p.id).filter((id) => !signed.has(id));
  return { changed, refused, gaps };
}

const PRACTICE_MODES: Record<string, (argv: string[]) => number> = {
  export: (argv) => {
    const { file, rows } = runPracticesExport(arg(argv, "--out") ?? DEFAULT_OUT_DIR);
    console.log(`wrote ${rows} practice rows → ${file}`);
    return 0;
  },
  import: (argv) => {
    const file = argv[1];
    if (!file || file.startsWith("--")) { console.error("--practices import needs a CSV file"); return 2; }
    const res = runPracticesImport(readFileSync(file, "utf8"), { practices: arg(argv, "--practices-file") });
    console.log(`fields changed: ${res.changed.length}`);
    for (const k of res.changed) console.log(`  ~ ${k}`);
    if (res.refused.length) { console.log(`refused: ${res.refused.length}`); for (const r of res.refused) console.log(`  ! ${r}`); }
    if (res.gaps.length) console.log(`not yet signed (${res.gaps.length})`);
    return res.refused.length ? 1 : 0;
  },
};

/* ── CLI ───────────────────────────────────────────────────────────────── */

const HELP = `milestone-he-review — native Hebrew review of the milestone catalogue (B-LOOP-02) and the practice library (B-LOOP-08)

  export [--out <dir>]                                  write HE-REVIEW-<date>.csv (default dir: ${DEFAULT_OUT_DIR})
  import <file.csv> [--catalogue <path>] [--data <path>] apply reviewer_fix cells; flip the flag only on a complete review
  --practices export [--out <dir>]                      write HE-REVIEW-PRACTICES-<date>.csv (one row per practice)
  --practices import <file.csv> [--practices-file <p>]  apply do= / say= fixes into content/practices.ts by id + field
`;

const arg = (argv: string[], name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

/** Mode registry (catalogue); `--practices` dispatches to PRACTICE_MODES. */
const MODES: Record<string, (argv: string[]) => number> = {
  export: (argv) => {
    const { file, rows } = runExport(arg(argv, "--out") ?? DEFAULT_OUT_DIR);
    console.log(`wrote ${rows} rows → ${file}`);
    return 0;
  },
  import: (argv) => {
    const file = argv[1];
    if (!file || file.startsWith("--")) { console.error("import needs a CSV file"); return 2; }
    const res = runImport(readFileSync(file, "utf8"), { catalogue: arg(argv, "--catalogue"), data: arg(argv, "--data") });
    console.log(`keys changed: ${res.changed.length}`);
    for (const k of res.changed) console.log(`  ~ ${k}`);
    if (res.refused.length) { console.log(`refused: ${res.refused.length}`); for (const r of res.refused) console.log(`  ! ${r}`); }
    if (res.gaps.length) console.log(`not yet signed (${res.gaps.length}): ${res.gaps.join(", ")}`);
    console.log(`MILESTONE_HE_REVIEW = ${res.flag}`);
    return res.refused.length ? 1 : 0;
  },
};

export function main(argv: string[]): number {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) { console.log(HELP); return 0; }
  if (argv.includes("--practices")) {
    const rest = argv.filter((a) => a !== "--practices");
    const practiceMode = PRACTICE_MODES[rest[0]];
    if (!practiceMode) { console.error(`--practices needs a mode (export | import)\n\n${HELP}`); return 2; }
    return practiceMode(rest);
  }
  const mode = MODES[argv[0]];
  if (!mode) { console.error(`unknown mode "${argv[0]}"\n\n${HELP}`); return 2; }
  return mode(argv);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exit(main(process.argv.slice(2)));
}
