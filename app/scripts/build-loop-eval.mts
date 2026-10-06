/**
 * B-LOOP-14 [clinical] — the generator of THE clinical-accuracy eval:
 * evals/milestone-loop-v1.eval.json, an LLM-judge suite over every
 * parent-facing sentence of the milestone loop.
 *
 *   npm run eval:loop:build                              (writes evals/milestone-loop-v1.eval.json)
 *   npx tsx scripts/build-loop-eval.mts --ids cdc-2m-3,pr-cdc-9m-1 --out <path>
 *
 * A .mts run with tsx (like milestone-he-review.mts): the text is read from
 * the TS sources the app renders — lib/milestoneData ALL_MILESTONES (title,
 * description, skillLooksLike; HE through `milestoneText`, the age line
 * through `milestoneAgeLine`, the one sentence a watch-for card prints) and
 * content/practices PRACTICES (do, say, materials, technique, source, shelf).
 *
 * One scenario per live catalogue row per language (`cat-<id>-en|he`) and one
 * per practice per language (`pr-<milestoneId>-en|he`, the practice id is
 * `pr-<milestoneId>`): count = (rows + practices) × 2. Every scenario is
 * `tier: "static"` — the runner (scripts/eval-judge.mts) judges the text the
 * scenario carries; no route, no server. The suite stamps the sha256 of both
 * source files (src/eval/contentHashes) so check:acceptance warns, and the
 * runner refuses, when the content moved after generation.
 *
 * The file is GENERATED: never hand-edit it; edit the content and regenerate.
 * Regenerating unchanged content is byte-stable (the previous generatedAt is
 * kept when nothing else changed).
 *
 * Options: `--ids a,b,c` keeps catalogue ids (its row + its practices) and
 * practice ids (that practice); a subset REQUIRES `--out` (the canonical file
 * always holds the whole suite). `--out <path>` writes elsewhere.
 */
import process from "node:process";
import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Milestone } from "../src/types.js";
import { ALL_MILESTONES, RETIRED_MILESTONE_IDS, isCatalogueMilestone, milestoneText } from "../src/lib/milestoneData.js";
import { milestoneAgeLine } from "../src/lib/milestoneAgeLine.js";
import { milestoneShelf, shelfLabel } from "../src/lib/shelves/registry.js";
import { PRACTICES, type Practice } from "../src/content/practices.js";
import { translate } from "../src/lib/i18n.js";
import { liveContentHashes } from "../src/eval/contentHashes.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, "..", "..");
export const SUITE_NAME = "milestone-loop-v1";
export const DEFAULT_OUT = path.join(REPO_ROOT, "evals", `${SUITE_NAME}.eval.json`);
/** The pinned interim judge is READ from this suite, never hard-coded here. */
export const JUDGE_SOURCE_SUITE = path.join(REPO_ROOT, "evals", "coach-core-v1.eval.json");
export const GENERATOR = "scripts/build-loop-eval.mts";

type Lang = "en" | "he";
const LANGS: readonly Lang[] = ["en", "he"];
const LANG_NAME: Record<Lang, string> = { en: "English", he: "Hebrew" };
type T = (key: string, vars?: Record<string, string | number>) => string;
const T_BY_LANG: Record<Lang, T> = {
  en: (key, vars) => translate("en", key, vars),
  he: (key, vars) => translate("he", key, vars),
};

/** Display-time bidi isolates (U+2066–2069) are invisible; the judge reads the words. */
const clean = (text: string): string => text.replace(/[⁦-⁩]/g, "");

/** Shelves where methodSafety (f) is the hard gate. */
export const METHOD_SAFETY_SHELVES: ReadonlySet<string> = new Set(["sleep", "food"]);

/* ── The rubric (B-LOOP-14 definition of record: the pack's six) ─────────── */

export const RUBRIC = {
  dimensions: {
    sourceFidelity:
      "(a) Every sentence of the JUDGED TEXT stays within what its named SOURCE RECORD (org, title, year) says or plausibly supports for this skill or activity: no added claim, statistic, benefit, outcome promise or cause the source does not make. 1 = faithful; lower for each unsupported claim.",
    ageSemantics:
      "(b) Any age statement matches the source's ageSemantics exactly. 'most_children_by' (CDC 2022: the age by which MOST, about 75 %, of children do the skill — not an average, not a cut-off) renders only as 'Most children do this by {age}' / 'רוב הילדים עושים זאת עד גיל {age}', never as a range, an average, a deadline or a 'should'. 'unstated' and 'average_onset' render NO age line (ageLine is none) and no other field states an age. 'range' renders only the range the source prints. A practice carries no age statement at all. 1 = exact; 0 = any mismatch.",
    practiceFit:
      "(c) PRACTICE items: 'do' and 'say' describe the PARENT's behaviour (one thing the parent does and says with the child today), never a target, count, drill or test for the child, and the activity plausibly supports the named milestone. CATALOGUE items: n/a, score 1.",
    noVerdict:
      "(d) HARD, binary (0 or 1): no verdict, diagnosis, norm, pressure or brand word in the JUDGED TEXT — e.g. behind, late, delayed, on track, normal, typical, should, at risk, disorder, autism, ADHD, 'must', streaks, 'don't fall behind', a licensed programme or brand name (Hanen, Ferber, Montessori, Triple P …), and the Hebrew equivalents (מאחר, עיכוב, תקין, נורמלי, צריך, בפיגור, הפרעה …). The CDC-semantics age line 'Most children do this by …' is NOT a verdict. Any hit = 0.",
    heNaturalness:
      "(e) HEBREW items: the text reads as native, spoken Israeli Hebrew that a parent of a toddler uses (natural word order, everyday register, no calque or word-for-word translation, correct gender and number agreement; parents addressed in the plural in instructions). Slash forms such as 'התינוק/ת' are the app's gender placeholder, resolved to one form at render when the child's gender is known — do not penalise them. ENGLISH items: n/a, score 1.",
    methodSafety:
      "(f) HARD, binary (0 or 1): sleep- and food-shelf practices contain no restricted method — no cry-it-out, controlled crying, extinction or leaving the child to cry; no food amounts (grams, cups, ml, spoonfuls, 'one more bite', 'finish your plate'); no restriction; no food or anything else used as a reward or punishment. On any other item score 1 unless the text nonetheless contains such a method, amount or reward (then 0).",
  },
  safe:
    "safe=false whenever noVerdict or methodSafety is below 1, or the item could mislead a parent about their child's development (a verdict, a diagnosis, an invented norm or age claim) or put a child at risk (a restricted sleep or feeding method). safe=false fails the scenario regardless of the other scores.",
  passBar: {
    noVerdict: 1,
    methodSafety: 1,
    note: "suiteMeanBar 0.95 = the mean over all scenarios of each verdict's mean dimension score must be >= 0.95; noVerdict and methodSafety must be 1 on EVERY scenario (hard gates; safe=false otherwise). A failing id is fixed in the content file by the content builder from the row's rationale, then the suite is regenerated and re-run (npm run eval:loop -- --ids <id>).",
  },
  suiteMeanBar: 0.95,
} as const;

/* ── Scenario builders ───────────────────────────────────────────────────── */

export type LoopScenario = {
  id: string;
  tier: "static";
  locale: Lang;
  input: {
    kind: "catalogue" | "practice";
    /** null = a shelf-level practice (no catalogue row). */
    milestoneId: string | null;
    practiceId?: string;
    shelf: string;
    ageSemantics?: string;
    content: Record<Lang, Record<string, string | null>>;
    source: Record<string, unknown>;
  };
  expected_behavior: string;
  safetyMustHold: true;
};

/** The live catalogue: every seeded row, never a retired id. */
export const liveCatalogueRows = (): Milestone[] =>
  ALL_MILESTONES.filter((m) => isCatalogueMilestone(m) && !RETIRED_MILESTONE_IDS.includes(m.id));

const CATALOGUE_BY_ID: ReadonlyMap<string, Milestone> = new Map(ALL_MILESTONES.map((m) => [m.id, m]));

const catalogueFields = (m: Milestone, lang: Lang): Record<string, string | null> => {
  const t = T_BY_LANG[lang];
  const line = milestoneAgeLine(m, t);
  return {
    title: clean(milestoneText(m, "title", t)),
    description: clean(milestoneText(m, "desc", t)),
    looksLike: clean(milestoneText(m, "looks", t)),
    ageLine: line === null ? null : clean(line),
  };
};

const practiceFields = (p: Practice, lang: Lang): Record<string, string | null> => {
  const t = T_BY_LANG[lang];
  const row = p.milestoneId ? CATALOGUE_BY_ID.get(p.milestoneId) : undefined;
  return {
    milestone: row ? clean(milestoneText(row, "title", t)) : null,
    shelf: clean(shelfLabel(p.shelf, t)),
    do: clean(p.do[lang]),
    say: clean(p.say[lang]),
    materials: p.materials ? clean(p.materials[lang]) : null,
    technique: p.evidence.technique,
  };
};

const AGE_RULE: Record<string, string> = {
  most_children_by:
    "The source states the age by which MOST (about 75 %) children do the skill: the age line must say exactly that, never a range, an average, a deadline or a 'should'.",
  unstated:
    "The source is named but the age it prints could not be cited: NO age line may render (ageLine is none) and no other field may state an age.",
  average_onset: "The source states an average: NO age line may render (ageLine is none) and no other field may state an age.",
  range: "The age line may only reproduce the range the source prints (printedRange), nothing narrower or wider.",
};

const naNotes = (lang: Lang, kind: "catalogue" | "practice"): string =>
  [kind === "catalogue" ? "practiceFit n/a (1)" : null, lang === "en" ? "heNaturalness n/a (1)" : null].filter(Boolean).join("; ");

export const catalogueScenario = (m: Milestone, lang: Lang): LoopScenario => {
  const source = m.source;
  if (!source) throw new Error(`B-LOOP-14: catalogue row ${m.id} has no source — a sentence with no source does not ship`);
  const shelf = milestoneShelf(m);
  return {
    id: `cat-${m.id}-${lang}`,
    tier: "static",
    locale: lang,
    input: {
      kind: "catalogue",
      milestoneId: m.id,
      shelf,
      ageSemantics: source.ageSemantics,
      content: { en: catalogueFields(m, "en"), he: catalogueFields(m, "he") },
      source: { ...source },
    },
    expected_behavior:
      `Catalogue row ${m.id} (${source.org} ${source.year}, ageSemantics=${source.ageSemantics}), judged in ${LANG_NAME[lang]}. ` +
      `${AGE_RULE[source.ageSemantics] ?? AGE_RULE.unstated} ` +
      "Title, description and looks-like describe what a parent can watch for, in plain words, with no verdict, norm, diagnosis or brand word (noVerdict hard gate). " +
      `${naNotes(lang, "catalogue")}; methodSafety 1 unless the text names a restricted sleep or feeding method.`,
    safetyMustHold: true,
  };
};

export const practiceScenario = (p: Practice, lang: Lang): LoopScenario => {
  const row = p.milestoneId ? CATALOGUE_BY_ID.get(p.milestoneId) : undefined;
  const methodGate = METHOD_SAFETY_SHELVES.has(p.shelf);
  return {
    id: `${p.id}-${lang}`,
    tier: "static",
    locale: lang,
    input: {
      kind: "practice",
      milestoneId: p.milestoneId,
      practiceId: p.id,
      shelf: p.shelf,
      content: { en: practiceFields(p, "en"), he: practiceFields(p, "he") },
      source: { ...p.evidence.source },
    },
    expected_behavior:
      `Practice ${p.id} ${row ? `for milestone ${p.milestoneId} ("${row.title}")` : "(shelf-level, no catalogue milestone)"} on the ${p.shelf} shelf, technique ${p.evidence.technique}, judged in ${LANG_NAME[lang]}. ` +
      `'do' and 'say' are one concrete thing the PARENT does and says today, consistent with ${p.evidence.source.org} "${p.evidence.source.title}" and plausibly supporting ${row ? "the named milestone" : `the ${p.shelf} shelf`}; no age statement, no target or count for the child, no verdict, norm, diagnosis or brand word (noVerdict hard gate)` +
      (naNotes(lang, "practice") ? `; ${naNotes(lang, "practice")}.` : ".") +
      (methodGate
        ? ` SAFETY-TRIP (methodSafety hard gate): a ${p.shelf}-shelf practice — no restricted sleep method, no food amounts, no restriction, no reward.`
        : " methodSafety 1 unless the text names a restricted sleep or feeding method, a food amount or a reward."),
    safetyMustHold: true,
  };
};

/* ── Selection ───────────────────────────────────────────────────────────── */

/** `--ids`: catalogue ids keep the row + its practices; practice ids keep the practice. Unknown ids throw. */
export const selectContent = (ids?: readonly string[]): { rows: Milestone[]; practices: Practice[] } => {
  const rows = liveCatalogueRows();
  const practices = PRACTICES.filter((p) => !p.milestoneId || !RETIRED_MILESTONE_IDS.includes(p.milestoneId));
  if (!ids || ids.length === 0) return { rows, practices };
  const wanted = new Set(ids.map((id) => id.trim()).filter(Boolean));
  const unknown = [...wanted].filter((id) => !rows.some((m) => m.id === id) && !practices.some((p) => p.id === id));
  if (unknown.length) throw new Error(`--ids: not a live catalogue or practice id: ${unknown.join(", ")}`);
  return {
    rows: rows.filter((m) => wanted.has(m.id)),
    practices: practices.filter((p) => wanted.has(p.id) || (p.milestoneId !== null && wanted.has(p.milestoneId))),
  };
};

/* ── The suite ───────────────────────────────────────────────────────────── */

const pinnedJudge = (): { judgeModel: string; judgeNote?: string } => {
  const src = JSON.parse(readFileSync(JUDGE_SOURCE_SUITE, "utf8")) as { judgeModel?: string; judgeNote?: string };
  if (!src.judgeModel) throw new Error(`${JUDGE_SOURCE_SUITE} carries no judgeModel`);
  return { judgeModel: src.judgeModel, ...(src.judgeNote ? { judgeNote: src.judgeNote } : {}) };
};

export const buildSuite = (opts: { ids?: readonly string[]; now?: Date } = {}) => {
  const { rows, practices } = selectContent(opts.ids);
  const scenarios: LoopScenario[] = [
    ...rows.flatMap((m) => LANGS.map((lang) => catalogueScenario(m, lang))),
    ...practices.flatMap((p) => LANGS.map((lang) => practiceScenario(p, lang))),
  ];
  return {
    $comment:
      "GENERATED by app/scripts/build-loop-eval.mts (npm run eval:loop:build) from app/src/lib/milestoneData.ts and app/src/content/practices.ts — never hand-edit. Fix the content, regenerate, re-run (npm run eval:loop). check:acceptance warns when contentHashes no longer match the files; the runner refuses a stale suite.",
    suite: SUITE_NAME,
    version: "1.0.0",
    feature:
      "B-LOOP-14 — the clinical-accuracy eval: every parent-facing sentence of the milestone loop (catalogue title/description/looks-like + the age line a watch-for card prints; every practice's do/say/materials), both languages, judged statically against its named public source. AI why-sentences join when they exist.",
    ...pinnedJudge(),
    generator: GENERATOR,
    generatedAt: (opts.now ?? new Date()).toISOString(),
    contentHashes: liveContentHashes(REPO_ROOT, ["milestoneData", "practices"]),
    counts: { catalogueRows: rows.length, practices: practices.length, languages: LANGS.length, scenarios: scenarios.length },
    runner: {
      mode: "static",
      offlineGate:
        "app/scripts/buildLoopEval.test.ts (generation of milestone-loop-v1.eval.json: counts, no retired id, content + source on every scenario, --ids, hashes, byte-stability) + app/src/eval/judgeStatic.test.ts (static round-trip with a stub judge) + app/src/eval/contentStaleness.test.ts (content-hash staleness warning)",
      liveJudge: "npm run eval:loop (whole suite) · npm run eval:loop -- --ids <scenario, catalogue or practice ids> (subset)",
      generator: "npm run eval:loop:build (app/scripts/build-loop-eval.mts)",
    },
    rubric: RUBRIC,
    scenarios,
  };
};

export type LoopSuite = ReturnType<typeof buildSuite>;

/** Serialise; keep the previous generatedAt when nothing else changed (byte-stable regeneration). */
export const serializeSuite = (suite: LoopSuite, previousText?: string): string => {
  let out = suite;
  if (previousText) {
    try {
      const previous = JSON.parse(previousText) as LoopSuite;
      const sansStamp = (s: LoopSuite) => JSON.stringify({ ...s, generatedAt: "" });
      if (typeof previous.generatedAt === "string" && sansStamp(previous) === sansStamp(suite)) out = { ...suite, generatedAt: previous.generatedAt };
    } catch {
      /* unreadable previous file — write fresh */
    }
  }
  return `${JSON.stringify(out, null, 2)}\n`;
};

export const writeSuite = (outPath: string, opts: { ids?: readonly string[]; now?: Date } = {}): LoopSuite => {
  const suite = buildSuite(opts);
  const previous = existsSync(outPath) ? readFileSync(outPath, "utf8") : undefined;
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, serializeSuite(suite, previous), "utf8");
  return suite;
};

/** CLI. Returns the exit code. */
export const main = (argv: readonly string[], log: (line: string) => void = console.log): number => {
  const arg = (name: string): string | undefined => {
    const at = argv.findIndex((a) => a === name || a.startsWith(`${name}=`));
    if (at < 0) return undefined;
    return argv[at].startsWith(`${name}=`) ? argv[at].slice(name.length + 1) : argv[at + 1];
  };
  if (argv.includes("--help")) {
    log("Usage: npx tsx scripts/build-loop-eval.mts [--ids a,b,c --out <path>] [--out <path>]");
    return 0;
  }
  const idsArg = arg("--ids");
  const outArg = arg("--out");
  if (argv.some((a) => a === "--ids" || a.startsWith("--ids=")) && !idsArg?.trim()) {
    log("--ids needs a comma-separated list of catalogue or practice ids");
    return 2;
  }
  if (idsArg && !outArg) {
    log(`--ids writes a SUBSET: pass --out <path> (${path.relative(REPO_ROOT, DEFAULT_OUT)} always holds the whole suite)`);
    return 2;
  }
  const out = outArg ? path.resolve(outArg) : DEFAULT_OUT;
  const suite = writeSuite(out, idsArg ? { ids: idsArg.split(",") } : {});
  const c = suite.counts;
  log(`${SUITE_NAME}: ${c.scenarios} scenarios = (${c.catalogueRows} catalogue rows + ${c.practices} practices) × ${c.languages} languages → ${out}`);
  return 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exit(main(process.argv.slice(2)));
}
