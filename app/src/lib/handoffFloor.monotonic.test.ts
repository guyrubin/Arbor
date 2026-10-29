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
 *      condition — holding only a lead-in, the negated finding, its object
 *      (this test's own object boundary) and a short context frame, with an
 *      object word that appears nowhere in the parent's text (checked here
 *      independently); a piece carrying another verb, subject or event — any
 *      hard-moment word main's incident cues know — fails (round 12, P1-2); or
 *      a short lead-in / attribution / frame beside it, with no event either;
 *   4. every escalation command in the model's note is in the output, and every
 *      referral main recognises in a clause it keeps;
 *   5. the wrapper only deletes: every output word is a word of the note;
 *   6. a critic row's required text (`must`, fresh sets r11/r12) that main
 *      keeps, the wrapper keeps;
 *   7. every restored piece carries a non-negated escalation command whose
 *      recipient is a professional, a helpline or the family (round 13).
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { REFERRAL_EN, REFERRAL_HE, withoutHandoffFindings } from "./clinicalScan";
import { explainHandoffFloor, findEscalationCommands } from "./handoffFloorWrapper";
import { hasIncidentCue } from "../content/behaviorTaxonomy";

const here = path.dirname(fileURLToPath(import.meta.url));
type Row = { id: string; note: string; parent?: string; must?: string };

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
/** Joining words the wrapper may drop when the part they joined goes (and a glued "ו" / "ש" of the next word). */
const JOINERS = new Set(["and", "but", "so", "or", "though", "although", "even", "yet", "also", "plus", "as", "since", "because", "while", "whereas",
  "אבל", "אך", "כי", "או", "אולם", "למרות", "בעוד", "מאחר", "אף"]);
const tokens = (text: string) => text.toLocaleLowerCase().split(/[^\p{L}\d'’"-]+/u).map((t) => t.replace(/^['’"-]+|['’"-]+$/gu, "").replace(/^[וש](?=\p{Script=Hebrew}{2})/u, "")).filter((t) => t.length > 1 && !JOINERS.has(t));
const NEGATED_FINDING = /\b(?:no|not|n['’]t|without|free\s+(?:of|from))\b[^.;]*?\b(?:signs?|evidence|indications?|indicators?|symptoms?|red\s+flags?|traces?|hints?|difficult\p{L}*|delays?|deficits?|impairments?|concerns?|problems?|issues?)\b|(?:אין|ללא|בלי|לא\s+\p{L}+)\s+(?:\p{L}+\s+)?(?:סימנ|סימן|סממנ|עדות|עדויות|הוכח|אינדיקצי|ראי|ממצא|תסמינ|קשי|קושי|עיכוב|בעי|ליקוי|חשש)/iu;
/** Absent from the parent's text: not even the word's first letters (4 EN, 3 HE after one glued particle) occur in it. */
/** Round 13 (P2): or every use of it in the parent's text qualifies a thing ("no problem with the new car seat"). */
const TEST_THINGS = /^(?:chart|seat|car|board|toy|toys|game|book|app|timer|schedule|sticker|stickers|לוח|ה?כיסא|ה?רכב|ב?רכב|מושב|משחק|צעצוע|ספר|מדבקות)$/u;
const onlyAboutThings = (word: string, parentText: string) => {
  const key = word.toLocaleLowerCase().replace(/^[והבכלמש]{1,2}(?=\p{Script=Hebrew}{3})/u, "").slice(0, /\p{Script=Hebrew}/u.test(word) ? 3 : 4);
  const tokens = parentText.toLocaleLowerCase().split(/[^\p{L}'’-]+/u).filter(Boolean);
  const uses = tokens.map((t, i) => (t.includes(key) ? i : -1)).filter((i) => i >= 0);
  return uses.length > 0 && uses.every((i) => TEST_THINGS.test(tokens[i + 1] ?? "") || TEST_THINGS.test(tokens[i - 1] ?? "") || tokens.slice(i + 1, i + 7).some((t) => TEST_THINGS.test(t)));
};
const absentFrom = (word: string, parentText: string) => onlyAboutThings(word, parentText) || absentByLetters(word, parentText);
const absentByLetters = (word: string, parentText: string) => {
  const parent = parentText.toLocaleLowerCase().replace(/[םןץףך]/gu, (c) => ({ ם: "מ", ן: "נ", ץ: "צ", ף: "פ", ך: "כ" })[c] ?? c);
  const w = word.toLocaleLowerCase().replace(/[^\p{L}]/gu, "").replace(/[םןץףך]/gu, (c) => ({ ם: "מ", ן: "נ", ץ: "צ", ף: "פ", ך: "כ" })[c] ?? c);
  if (/\p{Script=Hebrew}/u.test(w)) return [w, w.replace(/^[והבכלמש]/u, "")].every((v) => v.length < 2 || !parent.includes(v.slice(0, 3)));
  return !parent.includes(w.slice(0, 4));
};
/** A condition word the reassurance's own clause opens with: then it is a condition, never a reassurance. */
const IF_WORD = /\b(?:if|unless|in\s+case)\b|(?<!\p{L})(?:ו)?(?:אם|במידה|במקרה)(?!\p{L})/iu;
const CONDITION_WORD = /\b(?:if|unless|when|whenever|should)\b|(?<!\p{L})(?:ו)?(?:אם|במידה|כאשר|כש\p{L})/iu;
const ATTRIBUTION = /^(?:according\s+to|as\s+(?:reported|noted|described|observed)\s+by|per|לדברי|לפי|כפי\s+ש)/iu;
/* Round 12 (P1-2): what a removed reassurance may hold, by this test's own boundaries. */
/** The object ends at clause punctuation, a subordinator, a subject pronoun or a frame preposition. */
const OBJECT_END = /[,;:.!?—–()]|\b(?:before|after|when|whenever|while|since|because|as|until|though|although|but|so|then|who|which|that|he|she|they|we|i|you|it|according|at|in|during|on|for|with|this|today|yesterday|and|or|nor|plus)\b|(?<!\p{L})(?:לפני|אחרי|לאחר|בזמן|כש\p{L}*|כאשר|מאז|למרות|אבל|אך|כי|ש?הוא|ש?היא|ש?הם|ש?הן|אני|אנחנו|לדברי|לפי|ב\p{L}+|או)(?!\p{L})|(?<!\p{L})ו(?=\p{L}{2})/iu;
/* Round 13 (P1-C): the object ends at and / or / ו / או too; a further item joined there may only be
   another state (a list), never an act, a verb or a subject. This test's own act list, not the wrapper's. */
const LIST_ITEM_JOIN = /^\s*(?:(?:and|or|nor|plus)\s+|או\s+|ו(?=\p{L}{2}))/iu;
const ACT_EN = /\b(?:hit|hits|hitting|push\p{L}*|shov\p{L}*|kick\p{L}*|throw\p{L}*|threw|bite|bites|biting|bit|bitten|scratch\p{L}*|slap\p{L}*|punch\p{L}*|pinch\p{L}*|spit\p{L}*|spat|hurt\p{L}*)\b/iu;
const ACT_HE = /(?:הרביצ|הרביץ|מכות|מכה|היכה|הכה|נשך|נשכה|נשיכ|נושך|דחף|דחפה|דחיפ|בעט|בעטה|בעיט|זרק|זרקה|זריק|שרט|צבט|ירק)/u;
const VERB_EN = /\b\p{L}{3,}ed\b|\b(?:is|was|were|are|has|had|did|does|went|came|got|took|made|plays?|played)\b/iu;
const REPORTING_ED = new Set("reported noted observed described explained confirmed mentioned shared noticed added agreed showed showing displayed exhibited presented demonstrated seemed appeared believed".split(" "));
const FRAME_NOUNS = /\b(?:morning|mornings|evening|evenings|during|nothing|something|anything|everything|setting|building|spring|bedtime|weekend)\b/giu;
const PRONOUN_EN = /\b(?:he|she|they|we|i|you|it|who)\b/iu;
const PRONOUN_HE = /(?<!\p{L})(?:ו|ש|כש)?(?:הוא|היא|הם|הן|אני|אנחנו)(?!\p{L})/u;
const GLUED_CLAUSE_HE = /(?<!\p{L})(?:ש|כש)(?!(?:בוע|בועות|עה|עות|ינה|לו|לה|להם|להן|לנו|תי|ני|לוש|ום|גרה|יחה|מיעה|פה|יפור)(?!\p{L}))\p{L}{2,}/u;
const words = (text: string) => text.trim().split(/\s+/u).filter(Boolean);
/** Why a removed reassurance holds more than lead-in + negated finding + object + frame, or null. */
function extraClauseIn(piece: string): string | null {
  const m = NEGATED_FINDING.exec(piece);
  if (!m) return "no negated finding";
  const lead = piece.slice(0, m.index);
  const afterHead = piece.slice(m.index + m[0].length).replace(/^\p{L}*/u, "").replace(/^\s*(?:of|for|that|של|על)\s+/iu, "");
  const objectEnd = afterHead.search(OBJECT_END);
  let object = objectEnd < 0 ? afterHead : afterHead.slice(0, objectEnd);
  let rest = objectEnd < 0 ? "" : afterHead.slice(objectEnd);
  while (LIST_ITEM_JOIN.test(rest)) {
    const item = rest.replace(LIST_ITEM_JOIN, "");
    const next = item.slice(1).search(OBJECT_END);
    const end = next < 0 ? item.length : next + 1;
    const joined = item.slice(0, end);
    if (ACT_EN.test(joined) || ACT_HE.test(joined) || PRONOUN_EN.test(joined) || PRONOUN_HE.test(joined) || VERB_EN.test(joined)) return `a clause joined to the object: ${joined}`;
    object += ` ${joined}`;
    rest = item.slice(end);
  }
  if (ACT_EN.test(object) || ACT_HE.test(object) || PRONOUN_EN.test(object) || PRONOUN_HE.test(object)) return `an act or a subject inside the object: ${object}`;
  if (hasIncidentCue(lead)) return `an event before the reassurance: ${lead}`;
  if (hasIncidentCue(rest)) return `an event after the reassurance: ${rest}`;
  if (/\p{Script=Hebrew}/u.test(piece)) {
    if (words(lead).length > 6) return `a long lead-in: ${lead}`;
    if (/\S\s+ו\s*$/u.test(lead) || /\S\s+\S+\s+ו\s*$/u.test(lead)) return `a clause joined before the reassurance: ${lead}`;
    if (PRONOUN_HE.test(rest) || GLUED_CLAUSE_HE.test(rest.replace(/^(?:ש|כש)?(?:אין|לא)\b/u, ""))) return `a clause after the reassurance: ${rest}`;
  } else {
    if (words(lead).length > 8) return `a long lead-in: ${lead}`;
    if (words(lead).slice(1).some((w) => /^(?:and|but|so|then)$/iu.test(w))) return `a clause joined before the reassurance: ${lead}`;
    if (words(lead).some((w) => /\p{L}{3,}(?:ed|ing)$/iu.test(w) && !REPORTING_ED.has(w.toLocaleLowerCase()))) return `a verb before the reassurance: ${lead}`;
    const frame = rest.replace(FRAME_NOUNS, " ");
    if (PRONOUN_EN.test(frame) || /\b\p{L}{3,}(?:ed|ing)\b|\b(?:is|was|were|are|has|had|did|does|went|came|got|took|made|bit|hit|threw|ran|fell)\b/iu.test(frame)) return `a clause after the reassurance: ${rest}`;
  }
  if (words(rest).length > 7) return `a long tail: ${rest}`;
  return null;
}
/* Round 13 (P1-C): a restored piece must carry a non-negated escalation command whose recipient is a
   professional, a helpline or the family (this test's own lists). A restored condition fragment needs one
   beside it in the output. */
const RECIPIENT_TEST = /\bdr\.?\s+\p{Lu}|\b(?:pediatricians?|paediatricians?|doctors?|gps?|nurses?|therapists?|psychologists?|psychiatrists?|counsell?ors?|specialists?|clinicians?|professionals?|helplines?|hotlines?|emergency|ambulance|hospital|medical|family|families|parents?|mother|father|mom|mum|dad|grand\p{L}+|guardians?|caregivers?)\b|\b(?:112|911|999|988|101)\b|(?:רופא|אחות|אחיות|פסיכולוג|פסיכיאטר|מטפל|קלינאי|מקצוע|יועצ|יועץ|הורים|הורה|משפחה|אמא|אבא|ד"ר|מוקד|חירום|מד"א|ער"ן|מיון|טיפת\s+חלב|112|101)/iu;
const ACTION_TEST = /\b(?:call|calling|phone|ring|contact|text|email|notify|inform|alert|tell|let|reach\s+out|get\s+in\s+touch|get|talk|speak|chat|consult|see|book|visit|refer|referral|seek|ask|mention|discuss|check\s+in|follow\s+up|loop\s+in|involve|share|show|take|suggest)\b|\b(?:should|must|can|could|needs?\s+to|ought\s+to)\s+be\s+(?:called|contacted|phoned|notified|informed|alerted|told|consulted|seen)\b|(?:להתקשר|התקשרו|התקשר|לפנות|פנו|פנה|פני|צרו\s+קשר|ליצור\s+קשר|לעדכן|עדכנו|עדכן|לספר|ספרו|להודיע|הודיעו|לדבר|דברו|לשוחח|שוחחו|להתייעץ|התייעצו|להזעיק|הזעיקו|להפנות|הפנו|לקבוע\s+תור|קבעו\s+תור|ליידע|יידעו|לשתף|שתפו|להראות|הראו|להגיע|לגשת|גשו|לבקש|הציעו)/giu;
const NEGATION_BEFORE = /(?:\b(?:no\s+need\s+to|not|never|need\s+not|needn['’]t|don['’]t|doesn['’]t)|אין\s+צורך|לא\s+צריכ?\p{L}*|(?<!\p{L})(?:אין|לא|אל))\s+(?:[^\s,;:.!?]+\s+)?$/iu;
const NEGATION_AFTER = /^\s*(?:\S+\s+){0,4}?(?:is|are)\s+(?:not\s+|un)(?:needed|necessary|required)/iu;
/** "should be called by their first names / Sound Orbit": named, not called. */
const NAMING_AFTER = /^\s*(?:by\s+(?:(?:their|his|her|the)\s+)?(?:first\s+|last\s+|full\s+)?names?\b|as\s+|\p{Lu})/u;
const hasEscalation = (text: string) => {
  if (!RECIPIENT_TEST.test(text)) return false;
  const masked = text.replace(T_ENCOURAGING, (e) => " ".repeat(e.length)); // "do not wait: call …" is no negation
  return [...masked.matchAll(ACTION_TEST)].some((m) => {
    const at = m.index ?? 0;
    const after = masked.slice(at + m[0].length, at + m[0].length + 60);
    return !NEGATION_BEFORE.test(masked.slice(Math.max(0, at - 30), at)) && !NEGATION_AFTER.test(after) && !(/called$/iu.test(m[0]) && NAMING_AFTER.test(after));
  });
};
const RELAY_START = /^(?:please\s+)?(?:tell|let|inform|notify|update|mention|share)\b|^(?:ספרו|ספר|לספר|עדכנו|עדכן|לעדכן|יידעו|ליידע|הודיעו|להודיע|שתפו|לשתף)(?!\p{L})/iu;
const BARE_RELAY = /^(?:please\s+)?(?:tell|let|inform|notify|update)\s+(?:\S+\s+){0,3}?(?:family|parents?|mother|father|mom|mum|dad)(?:\s+know)?[.!]?$|^(?:ספרו|עדכנו|יידעו|הודיעו)\s+(?:את\s+)?\S+[.!]?$/iu;
/* Round 14 (P1-C): a restored piece holds no negation or discouraging word anywhere outside its condition
   and the negated finding that condition names; only the encouraging forms are exempt. This test's own lists. */
const T_DISCOURAGING = /\b(?:not|no|never|none|nor|hold\s+off|avoid\p{L}*|premature\p{L}*|unnecessar\p{L}*|needless\p{L}*|pointless\p{L}*|refrain\p{L}*|rather\s+than|instead\s+of|too\s+early)\b|n['’]t\b|(?<!\p{L})(?:ו|ש|כש|ה)?(?:אין|לא|אל|מיותר\p{L}*|להימנע|במקום\s+ל\p{L}+|מוקדם\s+מדי|עדיף\s+לחכות)(?!\p{L})/iu;
const T_ENCOURAGING = /\b(?:(?:do|does|should|must|will)\s+not|don['’]t|shouldn['’]t|never|not)\s+(?:hesitate|wait|delay)\b|\bwithout\s+(?:delay|waiting)\b|(?<!\p{L})(?:אל\s+(?:תהסס\p{L}*|תחכ\p{L}*)|(?:אין|לא)\s+(?:לחכות|להסס)|(?:בלי|ללא)\s+(?:לחכות|דיחוי))(?!\p{L})/giu;
const T_CONDITION_SPAN = /\b(?:if|when|whenever|where|unless|should|in\s+case|once|until|as\s+long\s+as)\b[^,;:—–]*|(?<!\p{L})(?:ו)?(?:אם|כש|כאשר|במידה|במקרה|בכל\s+פעם|ברגע\s+ש|עד\s+ש)[^,;:—–]*/giu;
const T_CONDITION_NEGATION = /\b(?:no|without|not|n['’]t)\s+(?:\p{L}+\s+){0,3}?(?:signs?|evidence|improvement|progress|change|calm\p{L}*|settl\p{L}*|better)\b|(?<!\p{L})(?:ו|ש|כש)?(?:אין|ללא|בלי|לא)\s+(?:שום\s+)?(?:סימנ\p{L}*|סימן|עדות|שיפור|התקדמות|רגיעה|נרגע\p{L}*)/giu;
const discouragingIn = (text: string) => {
  const masked = text.replace(T_ENCOURAGING, " ").replace(T_CONDITION_SPAN, " ").replace(T_CONDITION_NEGATION, " ");
  return T_DISCOURAGING.exec(masked)?.[0] ?? null;
};
const CONDITION_FRAGMENT = /^\s*(?:if|when|whenever|where|should|unless|in\s+case)\b|^\s*(?:ו)?(?:אם|כש|כאשר|במידה|במקרה)/iu;
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
          const extra = extraClauseIn(piece.text);
          if (extra) fail(`removed reassurance carries ${extra} — piece: ${piece.text}`);
          const r = trace.removedReassurances.find((x) => x.text === piece.text);
          if (!r || !r.absentWords.some((w) => absentFrom(w, parentText))) fail(`removed reassurance whose object the parent's text contains: ${piece.text}`);
        } else {
          const count = words(piece.text).length;
          if (findEscalationCommands(piece.text).length || referralsIn(piece.text).length) fail(`filler removal took an escalation: ${piece.text}`);
          if (!ATTRIBUTION.test(piece.text) && (count > 8 || CONDITION_WORD.test(piece.text))) fail(`filler removal took a clause: ${piece.text}`);
          if (hasIncidentCue(piece.text)) fail(`filler removal took an event: ${piece.text}`);
        }
      }
      // 4. every escalation command, and every referral in a clause main keeps, reaches the output
      const lowerOut = out.toLocaleLowerCase();
      for (const command of findEscalationCommands(row.note)) {
        if (lowerOut.includes(command.text.toLocaleLowerCase())) continue;
        // round 13 (P2): a relay whose only message is the invented finding stays dropped, as on main
        const clause = trace.clauses.find((c) => c.text.includes(command.text));
        const message = clause ? clause.text.slice(clause.text.indexOf(command.text) + command.text.length) : "";
        if (RELAY_START.test(command.text) && clause?.main === "dropped" && NEGATED_FINDING.test(message)) continue;
        fail(`escalation command lost: ${command.text}`);
      }
      for (const clause of trace.clauses.filter((c) => c.main === "kept")) {
        for (const referral of referralsIn(clause.text)) if (!lowerOut.includes(referral.toLocaleLowerCase())) fail(`referral main keeps lost: ${referral}`);
      }
      // 7. every restored piece is an escalation: a non-negated command with a recipient (round 13, P1-C)
      for (const clause of trace.clauses.filter((c) => c.restored && c.out.trim())) {
        if (!hasEscalation(clause.out) && !(CONDITION_FRAGMENT.test(clause.out) && hasEscalation(out))) fail(`restored a piece with no escalation command: ${clause.out}`);
        const discouraging = discouragingIn(clause.out);
        if (discouraging) fail(`restored a piece with a discouraging word ("${discouraging}"): ${clause.out}`);
        // round 13 (P2): a bare relay ("Please tell the family.") has nothing to pass on
        if (BARE_RELAY.test(clause.out.trim())) fail(`restored a relay with nothing to relay: ${clause.out}`);
      }
      // 6. a critic row's required text that main keeps, the wrapper keeps
      if (row.must && main.toLocaleLowerCase().includes(row.must.toLocaleLowerCase()) && !lowerOut.includes(row.must.toLocaleLowerCase())) fail(`required text main keeps is lost: ${row.must}`);
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
    expect(fresh.length).toBe(270);
    expect(fresh.filter((r) => r.id.startsWith("r13-")).length).toBe(45);
    expect(fresh.filter((r) => r.id.startsWith("r11-")).length).toBe(62);
    expect(fresh.filter((r) => r.id.startsWith("r12-")).length).toBe(44);
    expect(fresh.filter((r) => r.id.startsWith("r9-")).length).toBe(26);
    expect(fresh.filter((r) => r.id.startsWith("r10-")).length).toBe(28);
    expect(mainTestFiles).toEqual(expect.arrayContaining(["clinicalScan.handoffFinding.test.ts", "clinicalScan.hebrew.test.ts"]));
    expect(mainCorpus.length).toBeGreaterThan(100);
    expect(rows.some((r) => /[א-ת]/.test(r.note)) && rows.some((r) => /[a-z]/i.test(r.note))).toBe(true);
  });

  it.each([
    ["main's clinicalScan*.test.ts corpora", () => mainCorpus],
    ["the 292-row acceptance table (a9b91e66, read-only)", () => acceptance],
    ["the critic's fresh sets r9 / r10 / r11 / r12 / r13 / floor-probe 1-4", () => fresh],
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
