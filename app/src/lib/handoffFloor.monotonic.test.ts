/**
 * B-ASKJB-44 round 11 — monotonicity is a test, not a promise.
 *
 * For every fixture sentence in the repo — main's clinicalScan*.test.ts
 * corpora (every string literal of three words or more), the round-10
 * acceptance table (__fixtures__/handoffFloorAcceptance.json, 292 rows, copied
 * read-only from a9b91e66), the critic's fresh sets (__fixtures__/
 * handoffFloorFreshSets.json: r9, r10, floor-probe 1-4) and every adjacent
 * pair of rows as a two-sentence note — and for five parent texts each (the
 * row's own, none, an EN and an HE hard moment, and the note itself):
 *
 *   1. untouched by both rules, the output IS main's output, byte-for-byte;
 *   2. every clause main keeps is in the output, word for word, except words
 *      inside a piece rule (b) removed;
 *   3. a rule-(b) piece is a negated-finding reassurance — not opened by a
 *      condition — with an object word that appears nowhere in the parent's
 *      text (checked here independently), or a short lead-in / attribution /
 *      frame beside it;
 *   4. every escalation command in the model's note is in the output, and every
 *      referral main recognises in a clause it keeps;
 *   5. the wrapper only deletes: every output word is a word of the note.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { REFERRAL_EN, REFERRAL_HE, withoutHandoffFindings } from "./clinicalScan";
import { explainHandoffFloor, findEscalationCommands } from "./handoffFloorWrapper";

const here = path.dirname(fileURLToPath(import.meta.url));
type Row = { id: string; note: string; parent?: string };

const acceptance: Row[] = JSON.parse(readFileSync(path.join(here, "__fixtures__", "handoffFloorAcceptance.json"), "utf8")).rows;
const fresh: Row[] = JSON.parse(readFileSync(path.join(here, "__fixtures__", "handoffFloorFreshSets.json"), "utf8")).rows;
/** Main's own floor corpora: every double-quoted literal of 3+ words in lib/clinicalScan*.test.ts. */
const mainTestFiles = readdirSync(here).filter((f) => /^clinicalScan.*\.test\.ts$/.test(f)).sort();
const mainCorpus: Row[] = mainTestFiles.flatMap((file) => {
  const source = readFileSync(path.join(here, file), "utf8");
  const literals = [...source.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`) as string);
  return [...new Set(literals)].filter((s) => s.trim().split(/\s+/).length >= 3 && !s.includes("%s")).map((note, i) => ({ id: `${file}#${i}`, note }));
});
const rows = [...acceptance, ...fresh];
const pairs: Row[] = rows.slice(1).map((row, i) => ({ id: `${rows[i].id}+${row.id}`, note: `${rows[i].note} ${row.note}`, parent: [rows[i].parent, row.parent].filter(Boolean).join("\n") }));

const HARD_MOMENT_EN = "He bit a friend at preschool when they fought over a toy\nWe separated them and he calmed after a hug";
const HARD_MOMENT_HE = "הוא נשך חבר בגן כשרבו על צעצוע\nהפרדנו ביניהם והוא נרגע אחרי חיבוק";
const parentsFor = (row: Row) => [...new Set([row.parent ?? "", "", HARD_MOMENT_EN, HARD_MOMENT_HE, row.note])];

/* The independent checks below share nothing with the wrapper's own matchers. */
const JOINERS = new Set(["and", "but", "so", "or", "though", "although", "yet", "also", "plus", "as", "since", "because", "אבל", "אך", "כי", "או"]);
const tokens = (text: string) => text.toLocaleLowerCase().split(/[^\p{L}\d'’"-]+/u).map((t) => t.replace(/^['’"-]+|['’"-]+$/gu, "").replace(/^ו(?=\p{Script=Hebrew}{2})/u, "")).filter((t) => t.length > 1 && !JOINERS.has(t));
const NEGATED_FINDING = /\b(?:no|not|n['’]t|without|free\s+(?:of|from))\b[^.;]*?\b(?:signs?|evidence|indications?|indicators?|symptoms?|red\s+flags?|traces?|hints?|difficult\p{L}*|delays?|deficits?|impairments?|concerns?|problems?|issues?)\b|(?:אין|ללא|בלי|לא\s+\p{L}+)\s+(?:\p{L}+\s+)?(?:סימנ|סימן|סממנ|עדות|עדויות|הוכח|אינדיקצי|ראי|ממצא|תסמינ|קשי|קושי|עיכוב|בעי|ליקוי|חשש)/iu;
/** Absent from the parent's text: not even the word's first letters (4 EN, 3 HE after one glued particle) occur in it. */
const absentFrom = (word: string, parentText: string) => {
  const parent = parentText.toLocaleLowerCase().replace(/[םןץףך]/gu, (c) => ({ ם: "מ", ן: "נ", ץ: "צ", ף: "פ", ך: "כ" })[c] ?? c);
  const w = word.toLocaleLowerCase().replace(/[^\p{L}]/gu, "").replace(/[םןץףך]/gu, (c) => ({ ם: "מ", ן: "נ", ץ: "צ", ף: "פ", ך: "כ" })[c] ?? c);
  if (/\p{Script=Hebrew}/u.test(w)) return [w, w.replace(/^[והבכלמש]/u, "")].every((v) => v.length < 2 || !parent.includes(v.slice(0, 3)));
  return !parent.includes(w.slice(0, 4));
};
/** A condition word the reassurance's own clause opens with: then it is a condition, never a reassurance. */
const IF_WORD = /\b(?:if|unless|in\s+case)\b|(?<!\p{L})(?:ו)?(?:אם|במידה|במקרה)(?!\p{L})/iu;
const CONDITION_WORD = /\b(?:if|unless|when|whenever|should)\b|(?<!\p{L})(?:ו)?(?:אם|במידה|כאשר|כש\p{L})/iu;
const ATTRIBUTION = /^(?:according\s+to|as\s+(?:reported|noted|described|observed)\s+by|per|לדברי|לפי|כפי\s+ש)/iu;
const referralsIn = (text: string) => [REFERRAL_EN, REFERRAL_HE].flatMap((re) => [...text.matchAll(new RegExp(re.source, `g${re.flags}`))].map((m) => m[0]));

type Stats = { runs: number; restored: number; removed: number; untouched: number };
function checkMonotone(corpus: Row[], stats: Stats): string[] {
  const failures: string[] = [];
  for (const row of corpus) {
    for (const parentText of parentsFor(row)) {
      stats.runs++;
      const opts = { parentText };
      const trace = explainHandoffFloor(row.note, opts);
      const main = withoutHandoffFindings(row.note, opts);
      const out = trace.output;
      const fail = (why: string) => failures.push(`${row.id} | parent=${JSON.stringify(parentText.slice(0, 40))} | ${why}\n    note: ${row.note}\n    main: ${main}\n    out:  ${out}`);
      const restored = trace.clauses.some((c) => c.restored);
      if (restored) stats.restored++;
      if (trace.removedPieces.length) stats.removed++;
      // 1. untouched → byte-identical to main
      if (!restored && !trace.removedPieces.length) {
        stats.untouched++;
        if (out !== main) fail("untouched by both rules but differs from main");
      }
      // 2. every clause main keeps survives, word for word, outside rule-(b) pieces
      const outWords = new Set(tokens(out));
      const removedWords = new Set(trace.removedPieces.flatMap((p) => tokens(p.text)));
      for (const clause of trace.clauses.filter((c) => c.main === "kept")) {
        const lost = tokens(clause.text).filter((t) => !outWords.has(t) && !removedWords.has(t));
        if (lost.length) fail(`a clause main keeps lost ${JSON.stringify(lost)}: ${clause.text}`);
      }
      // 3. rule-(b) pieces: a reassurance whose object the parent never said, or the filler beside it
      for (const piece of trace.removedPieces) {
        if (piece.kind === "reassurance") {
          if (!NEGATED_FINDING.test(piece.text)) fail(`removed piece is not a negated finding: ${piece.text}`);
          const head = piece.text.search(NEGATED_FINDING);
          if (IF_WORD.test(piece.text.slice(0, Math.max(0, head)))) fail(`removed a condition as a reassurance: ${piece.text}`);
          const r = trace.removedReassurances.find((x) => x.text === piece.text);
          if (!r || !r.absentWords.some((w) => absentFrom(w, parentText))) fail(`removed reassurance whose object the parent's text contains: ${piece.text}`);
        } else {
          const words = piece.text.split(/\s+/).length;
          if (findEscalationCommands(piece.text).length || referralsIn(piece.text).length) fail(`filler removal took an escalation: ${piece.text}`);
          if (!ATTRIBUTION.test(piece.text) && (words > 8 || CONDITION_WORD.test(piece.text))) fail(`filler removal took a clause: ${piece.text}`);
        }
      }
      // 4. every escalation command, and every referral in a clause main keeps, reaches the output
      const lowerOut = out.toLocaleLowerCase();
      for (const command of findEscalationCommands(row.note)) if (!lowerOut.includes(command.text.toLocaleLowerCase())) fail(`escalation command lost: ${command.text}`);
      for (const clause of trace.clauses.filter((c) => c.main === "kept")) {
        for (const referral of referralsIn(clause.text)) if (!lowerOut.includes(referral.toLocaleLowerCase())) fail(`referral main keeps lost: ${referral}`);
      }
      // 5. the wrapper only deletes
      const noteWords = new Set(tokens(row.note));
      const invented = tokens(out).filter((t) => !noteWords.has(t));
      if (invented.length) fail(`output words not in the note: ${JSON.stringify(invented)}`);
    }
  }
  return failures;
}

describe("B-ASKJB-44 · the wrapper is monotonic over main's floor (property, every corpus, EN + HE)", () => {
  it("the corpora are all present", () => {
    expect(acceptance.length).toBe(292);
    expect(fresh.length).toBe(119);
    expect(fresh.filter((r) => r.id.startsWith("r9-")).length).toBe(26);
    expect(fresh.filter((r) => r.id.startsWith("r10-")).length).toBe(28);
    expect(mainTestFiles).toEqual(expect.arrayContaining(["clinicalScan.handoffFinding.test.ts", "clinicalScan.hebrew.test.ts"]));
    expect(mainCorpus.length).toBeGreaterThan(100);
    expect(rows.some((r) => /[א-ת]/.test(r.note)) && rows.some((r) => /[a-z]/i.test(r.note))).toBe(true);
  });

  it.each([
    ["main's clinicalScan*.test.ts corpora", () => mainCorpus],
    ["the 292-row acceptance table (a9b91e66, read-only)", () => acceptance],
    ["the critic's fresh sets r9 / r10 / floor-probe 1-4", () => fresh],
    ["every adjacent pair of rows as one two-sentence note", () => pairs],
  ] as const)("%s", (_name, corpus) => {
    const stats: Stats = { runs: 0, restored: 0, removed: 0, untouched: 0 };
    const failures = checkMonotone(corpus(), stats);
    expect(failures, failures.slice(0, 20).join("\n")).toEqual([]);
    expect(stats.runs).toBeGreaterThan(0);
  }, 120_000);

  it("both rules fire on the corpora (the property is not vacuous)", () => {
    const stats: Stats = { runs: 0, restored: 0, removed: 0, untouched: 0 };
    checkMonotone(rows, stats);
    expect(stats.restored).toBeGreaterThan(50);
    expect(stats.removed).toBeGreaterThan(20);
    expect(stats.untouched).toBeGreaterThan(stats.runs / 2);
  }, 120_000);
});
