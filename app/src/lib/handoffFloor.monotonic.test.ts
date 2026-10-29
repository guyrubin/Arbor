/**
 * B-ASKJB-44 round 11 — monotonicity is a test, not a promise.
 *
 * For every fixture sentence in the repo — main's clinicalScan*.test.ts
 * corpora (every string literal of three words or more), the round-10
 * acceptance table (__fixtures__/handoffFloorAcceptance.json, 292 rows, copied
 * read-only from a9b91e66), the critic's fresh sets (__fixtures__/
 * handoffFloorFreshSets.json: r9-r16, floor-probe 1-4) and every adjacent
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
 *      recipient is a professional, a helpline or the family (round 13), no
 *      discouraging word (round 14), a governing condition (round 15) that
 *      qualifies — it names a harm or a hard moment, or its negated finding
 *      negates a change, never an unspoken reassurance — and no deferral
 *      (round 16); a negated list is masked whole, a vital sign's absence
 *      qualifies, and timing is an allow-list: no time phrase but an
 *      immediate one outside the hard-moment condition (round 17).
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
const RECIPIENT_TEST = /\bdr\.?\s+\p{Lu}|\b(?:pediatricians?|paediatricians?|doctors?|gps?|nurses?|therapists?|psychologists?|psychiatrists?|counsell?ors?|specialists?|clinicians?|professionals?|helplines?|hotlines?|emergency|ambulance|hospital|medical|family|families|parents?|mother|father|mom|mum|dad|grand\p{L}+|guardians?|caregivers?)\b|\b(?:112|911|999|988|101)\b|(?:רופא|אחות|אחיות|פסיכולוג|פסיכיאטר|מטפל|קלינאי|מקצוע|יועצ|יועץ|הורים|הורה|משפחה|אמא|אבא|ד"ר|מוקד|חירום|מד"א|ער"ן|מיון|אמבולנס|טיפת\s+חלב|112|101)/iu;
const ACTION_TEST = /\b(?:call|calling|phone|ring|contact|text|email|notify|inform|alert|tell|let|reach\s+out|get\s+in\s+touch|get|talk|speak|chat|consult|see|book|visit|refer|referral|seek|ask|mention|discuss|check\s+in|follow\s+up|loop\s+in|involve|share|show|take|suggest)\b|\b(?:should|must|can|could|needs?\s+to|ought\s+to)\s+be\s+(?:called|contacted|phoned|notified|informed|alerted|told|consulted|seen)\b|(?:להתקשר|התקשרו|התקשר|לפנות|פנו|פנה|פני|צרו\s+קשר|ליצור\s+קשר|לעדכן|עדכנו|עדכן|לספר|ספרו|להודיע|הודיעו|לדבר|דברו|לשוחח|שוחחו|להתייעץ|התייעצו|להזעיק|הזעיקו|להפנות|הפנו|לקבוע\s+תור|קבעו\s+תור|ליידע|יידעו|לשתף|שתפו|להראות|הראו|להגיע|לגשת|גשו|לבקש|הציעו|להזמין|הזמינו)/giu;
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
const T_ENCOURAGING = /\b(?:(?:do|does|should|must|will)\s+not|don['’]t|shouldn['’]t|never|not)\s+(?:hesitate|wait|delay|put\s+off)\b|\bwithout\s+(?:delay|waiting)\b|\bnot\s+(?:just|only)\b|\bno\s+matter\b|(?<!\p{L})(?:אל\s+(?:תהסס\p{L}*|תחכ\p{L}*|תדח\p{L}*)|(?:אין|לא)\s+(?:לחכות|להסס|להתעכב)|(?:בלי|ללא)\s+(?:לחכות|דיחוי)|ו?לא\s+רק|לא\s+משנה)(?!\p{L})/giu;
const T_CONDITION_SPAN = /\b(?:if|when|whenever|where|unless|should|in\s+case|once|until|as\s+long\s+as)\b[^,;:—–]*|(?<!\p{L})(?:ו)?(?:אם|כש|כאשר|במידה|במקרה|בכל\s+פעם|ברגע\s+ש|עד\s+ש)[^,;:—–]*/giu;
const T_CONDITION_NEGATION = /\b(?:no|without|not|n['’]t)\s+(?:\p{L}+\s+){0,3}?(?:signs?|evidence|improvement|progress|change|calm\p{L}*|settl\p{L}*|better|stop\p{L}*|respon\p{L}*|breath\p{L}*)\b|(?<!\p{L})(?:ו|ש|כש)?(?:אין|ללא|בלי|לא)\s+(?:שום\s+)?(?:סימנ\p{L}*|סימן|עדות|שיפור|התקדמות|רגיעה|נרגע\p{L}*|נפסק\p{L}*|מפסיק\p{L}*|תגובה|מגיב\p{L}*|נושם\p{L}*)/giu;
const discouragingIn = (text: string) => {
  // round 17: a negated deferral ("today, not next week", "ולא בשבוע הבא") encourages
  const masked = text.replace(T_NEGATED_TIMING, (m) => (T_TIME.test(m) ? " ".repeat(m.length) : m))
    .replace(T_ENCOURAGING, " ").replace(T_CONDITION_SPAN, " ").replace(T_CONDITION_NEGATION, " ");
  return T_DISCOURAGING.exec(masked)?.[0] ?? null;
};
/* Round 15 (P1-C): main's own escalation line is a condition plus a referral. Every restored piece carries a
   governing condition, and a command main dropped must come back only when a condition governs it in the note
   (in its own chunk, a leading chunk, or the start of the next), not narrated in the past, naming no finding
   label, with no discouraging word. This test's own lists. */
const T_GOVERNING = /\b(?:if|unless|in\s+case|in\s+the\s+event|any\s+time|each\s+time|every\s+time|should\s+(?:he|she|they|there|it|the\s+\p{L}+)|when|whenever|where|wherever|as\s+soon\s+as|until|once\s+(?:he|she|they|there|it))\b|(?<!\p{L})(?:ו)?(?:אם|במידה|במקרה|כאשר|בכל\s+פעם)(?!\p{L})|(?<!\p{L})(?:ו)?(?:כש|(?:ברגע|במקום|עד|בזמן|במקרה|בכל\s+מקרה|בכל\s+פעם)\s+ש)(?=\p{L})|\b(?:after|within)\b[^,;:]*\b(?:with\s+no|without)\b|(?<!\p{L})(?:אחרי|כעבור|תוך)(?!\p{L})[^,;:]*(?:ללא|בלי|שאין)|^\s*(?:with\s+no|without)\b|^\s*(?:ללא|בלי)(?!\p{L})/iu;
const T_PAST = /\b(?:was|were|did|had|found|tested|assessed|checked|last\s+(?:week|month|year|visit))\b|(?<!\p{L})(?:ו|ש|כש)?(?:בדקה|בדק|נבדק|נבדקה|מצאה|מצא|הראה|הראתה|שעבר)(?!\p{L})/iu;
const T_LABEL = /\b(?:problems?|difficult\p{L}*|delays?|deficits?|impairments?|disorders?|issues?)\b|(?<!\p{L})[ובהלמש]{0,2}(?:בעי\p{L}*|קשי\p{L}*|קושי|עיכוב\p{L}*|ליקוי\p{L}*|לקות|הפרע\p{L}*)(?!\p{L})/iu;
const T_CHUNK = /[,;:—–]|\s-\s/u;
const T_ASSERTING = /^\s*(?:and|but|though|although|as|since|because|so|yet|while|whereas|which|who|that|plus)\b|^\s*(?:ו(?=\p{L})|אבל|אך|כי|מאחר|למרות|בעוד|אולם)/iu;
/** The governing condition of the command in this clause, or null. */
function governingCondition(clause: string, command: string): string | null {
  // the sentence that holds the command (a title's full stop does not end it), then its chunks
  const sentence = clause.split(/(?<=(?<!\b(?:Dr|Mr|Mrs|Ms|Prof|St))[.!?])\s+|;\s*|\n/u).find((t) => t.includes(command)) ?? clause;
  const chunks = sentence.split(T_CHUNK);
  const k = chunks.findIndex((c) => c.includes(command));
  if (k < 0) return null;
  const candidates = [...chunks.slice(0, k + 1), (chunks[k + 1] ?? "").trim().split(/\s+/u).slice(0, 4).join(" ")];
  const g = candidates.findIndex((c) => T_GOVERNING.test(c));
  // round 16: the whole condition, from its governing chunk to the command's chunk (or the next chunk); a
  // condition two chunks back behind an asserting "and …" / "ו…" chunk is read as main reads it (P2: R02/HR02)
  if (g >= 0 && g < k && chunks.slice(g + 1, k).some((c) => T_ASSERTING.test(c))) return null;
  return g < 0 ? null : g < k ? chunks.slice(g, k).join(",") : g === k ? chunks[k] : chunks[k + 1];
}
/* Round 16 (P1-C): a governing condition qualifies only when it names a harm or a hard moment (this test's own
   list, or main's incident cues), or every negated finding in it negates a change ("no signs of calming");
   "If there are no signs of anxiety" governs nothing. This test's own lists.
   Round 17 (P1-C): a negated finding's list is masked whole ("no signs of biting or hitting", "בכי או צרחות"),
   a vital sign's absence qualifies ("no signs of normal breathing"), and timing is an allow-list: outside its
   hard-moment condition a restored piece carries no time phrase but an immediate one. */
const T_CHANGE = /\b(?:calm\p{L}*|settl\p{L}*|improv\p{L}*|better|progress\p{L}*|stop\p{L}*|eas(?:e|es|ed|ing)|respon\p{L}*|chang\p{L}*|recover\p{L}*|let\s+up)\b|(?<!\p{L})[ולשה]?(?:רגיע\p{L}*|נרגע\p{L}*|הרגע\p{L}*|שיפור|השתפר\p{L}*|מפסיק\p{L}*|הפסק\p{L}*|נפסק\p{L}*|נעצר\p{L}*|פוסק\p{L}*|התקדמות|הקלה|שינוי|תגוב\p{L}*)(?!\p{L})/iu;
const T_VITAL = /\b(?:breath\p{L}*|conscious\p{L}*|responsive\p{L}*|pulse|heartbeat|awake)\b|(?<!\p{L})[ולשהב]?(?:נשימה|נושם|נושמת|הכרה|דופק|מגיב|מגיבה)(?!\p{L})/iu;
const T_HARM = /\b(?:hurt\p{L}*|harm\p{L}*|injur\p{L}*|danger\p{L}*|unsafe|bleed\p{L}*|bit|bites?|biting|hit|hits|hitting|kick\p{L}*|throw\p{L}*|threw|scream\p{L}*|cr(?:y|ies|ied|ying)|tantrum\p{L}*|meltdown\p{L}*|suicid\p{L}*|chok\p{L}*|breath\p{L}*|fever\p{L}*|seizure\p{L}*|faint\p{L}*|vomit\p{L}*|r[au]ns?\s+(?:away|off))\b|(?<!\p{L})[ושכה]{0,2}(?:פוגע\p{L}*|נפגע\p{L}*|פגיע\p{L}*|מרביץ\p{L}*|הרביץ\p{L}*|נשך\p{L}*|נושך\p{L}*|בועט\p{L}*|בעט\p{L}*|דוחף\p{L}*|זורק\p{L}*|צורח\p{L}*|צרח\p{L}*|בורח\p{L}*|ברח\p{L}*|בוכה|בכי|בכה|סכנה|מסוכן\p{L}*|התקף\p{L}*|חום|נשימה|מקיא\p{L}*|התעלפ\p{L}*|להרביץ|לנשוך|לבעוט|לדחוף|לזרוק|לצרוח|לברוח|לבכות|להכות|לפגוע|נשיכ\p{L}*|הרבצ\p{L}*|מכות|בעיט\p{L}*|דחיפ\p{L}*)(?!\p{L})/iu;
const T_DISTRESS = /\b(?:upset|distress\p{L}*|agitat\p{L}*|overwhelm\p{L}*|panic\p{L}*|scared|afraid|frightened|anxious|terrified|inconsolable)\b|(?<!\p{L})(?:ו|ש|כש|ה)?(?:נסער\p{L}*|מתוסכל\p{L}*|כועס\p{L}*|מפוחד\p{L}*|מבוהל\p{L}*|נבהל\p{L}*|לחוץ|לחוצה|מוצף|מוצפת|פאניקה|בהלה)(?!\p{L})/iu;
const T_LIST_JOIN = /^\s*,\s*(?:(?:and|or|nor)\s+|או\s+)?|^\s+(?:(?:and|or|nor|plus)\s+|או\s+|ו(?=\p{L}{2}))/iu;
/** Each negated finding in the text with its object and the rest of its list (this test's own boundary), as [start, end). */
const negatedObjects = (text: string) => [...text.matchAll(new RegExp(NEGATED_FINDING.source, "giu"))].map((m) => {
  const start = m.index ?? 0;
  const tail = text.slice(start + m[0].length);
  const afterHead = tail.replace(/^\p{L}*/u, "").replace(/^\s*(?:of|for|that|של|על)\s+/iu, "").replace(/^\s*(?:(?:that\s+)?(?:he|she|they|it)\s+|(?:ש|כש)?(?:הוא|היא|הם|הן)\s+)/iu, "");
  // the object keeps at least its first word ("של בכי": "ב…" is no frame here)
  const first = /^\s*[^\s,;:.!?—–()]+/u.exec(afterHead)?.[0] ?? "";
  const stop = afterHead.slice(first.length).search(OBJECT_END);
  let end = start + m[0].length + (tail.length - afterHead.length) + first.length + (stop < 0 ? afterHead.length - first.length : stop);
  while (end > start && /\s/u.test(text[end - 1])) end--;
  // a list continues it: "biting or hitting", "hitting, biting or kicking", "בכי או צרחות", "מרביץ או נושך"
  for (;;) {
    const join = T_LIST_JOIN.exec(text.slice(end));
    if (!join) break;
    const item = text.slice(end + join[0].length);
    const itemFirst = /^[^\s,;:.!?—–()]+/u.exec(item)?.[0] ?? "";
    const next = item.slice(itemFirst.length).search(OBJECT_END);
    const piece = item.slice(0, itemFirst.length + (next < 0 ? item.length - itemFirst.length : next)).trimEnd();
    if (!piece || PRONOUN_EN.test(piece) || PRONOUN_HE.test(piece) || piece.search(ACTION_TEST) >= 0 || T_GOVERNING.test(piece) || words(piece).length > 4) break;
    if (join[0].trim().startsWith(",") && !(T_HARM.test(piece) || hasIncidentCue(piece) || T_CHANGE.test(piece))) break;
    end += join[0].length + piece.length;
  }
  return { start, end, text: text.slice(start, end) };
});
const blankSpans = (text: string, spans: { start: number; end: number }[]) => spans.reduce((t, o) => t.slice(0, o.start) + " ".repeat(o.end - o.start) + t.slice(o.end), text);
/** What the condition asserts: a harm, an incident (main's cues) or a distress state outside every negated finding. */
const assertsMoment = (condition: string) => {
  const asserted = blankSpans(condition, negatedObjects(condition));
  return T_HARM.test(asserted) || hasIncidentCue(asserted) || T_DISTRESS.test(asserted);
};
/** A harm or a hard moment the condition asserts, or only negated changes and vital signs. */
const qualifies = (condition: string) => {
  const found = negatedObjects(condition);
  const asserted = blankSpans(condition, found);
  return T_HARM.test(asserted) || hasIncidentCue(asserted) || found.every((o) => T_CHANGE.test(o.text) || T_VITAL.test(o.text));
};
/** A condition about the hard moment itself: qualifying, and naming a moment or a negated change / vital sign. */
const moment = (condition: string) => qualifies(condition) && (assertsMoment(condition) || condition.search(T_CONDITION_NEGATION) >= 0
  || negatedObjects(condition).some((o) => T_CHANGE.test(o.text) || T_VITAL.test(o.text)));
type Run = { start: number; end: number; text: string; parts?: Run[] };
const SENTENCE_SPLIT = /(?<=(?<!\b(?:Dr|Mr|Mrs|Ms|Prof|St))[.!?])\s+|;\s*|\n/u;
const piecesOf = (text: string, sep: RegExp): Run[] => {
  const out: Run[] = [];
  let at = 0;
  for (const m of text.matchAll(new RegExp(sep.source, `g${sep.flags}`))) {
    out.push({ start: at, end: m.index ?? 0, text: text.slice(at, m.index) });
    at = (m.index ?? 0) + m[0].length;
  }
  out.push({ start: at, end: text.length, text: text.slice(at) });
  return out;
};
/** Every governing condition in a piece: from its condition word through the chunks after it with no action,
 *  until it names the moment ("Call the family when, after 20 minutes, there are no signs of calming"). */
function conditionRuns(piece: string): Run[] {
  return piecesOf(piece, SENTENCE_SPLIT).flatMap((sentence) => {
    const chunks = piecesOf(sentence.text, T_CHUNK);
    return chunks.flatMap((chunk, i) => {
      // "with no …" / "ללא …" governs only at the start of a sentence, not "…, without delay"
      const g = T_GOVERNING.exec(i === 0 ? chunk.text : `· ${chunk.text}`);
      if (!g) return [];
      const offset = i === 0 ? g.index : Math.max(0, g.index - 2);
      let j = i;
      let text = chunk.text.slice(offset);
      const parts: Run[] = [{ start: sentence.start + chunk.start + offset, end: sentence.start + chunk.end, text }];
      // past the moment only a monitoring duration still belongs to it ("…, after two weeks, …")
      while (j + 1 < chunks.length && chunks[j + 1].text.search(ACTION_TEST) < 0 && (!moment(text) || onlyDuration(chunks[j + 1].text))) {
        const next = chunks[++j];
        text += `,${next.text}`;
        parts.push({ start: sentence.start + next.start, end: sentence.start + next.end, text: next.text });
      }
      return [{ start: parts[0].start, end: sentence.start + chunks[j].end, text, parts }];
    });
  });
}
const T_IMMEDIATE = /\b(?:right\s+now|now|right\s+away|straight\s+away|at\s+once|immediately|today|as\s+soon\s+as\s+possible|asap|without\s+(?:delay|waiting)|urgently|no\s+matter\s+(?:the\s+time|how\s+late(?:\s+it\s+is)?|what\s+time)|(?:at\s+)?any\s+(?:time|hour)|day\s+or\s+night)\b|(?<!\p{L})ו?(?:מיד|מייד|מיידית|עכשיו|היום|בהקדם(?:\s+האפשרי)?|(?:ללא|בלי)\s+דיחוי|בכל\s+(?:שעה|זמן)|לא\s+משנה\s+(?:מה\s+)?השעה)(?!\p{L})/giu;
const T_TIME = /\b(?:tomorrow|tonight|morning|afternoon|evening|night|noon|lunch(?:time)?|days?|weeks?|weekends?|fortnight|months?|years?|hours?|minutes?|spring|summer|autumn|winter|holidays?|vacations?|breaks?|terms?|semesters?|next|later|eventually|soon|sometime|upcoming|wait\p{L}*|before|after|until|till|once|end(?:s|ing)?|start(?:s|ing)?)\b|\b(?:at|during|until|till|before|after|for|by|on)\s+(?:(?:the|a|an|his|her|their|our|your|next|upcoming|regular|routine|annual|end-of-\p{L}+|parent-teacher|parent|parents['’]?)\s+){0,3}(?:meetings?|conferences?|evenings?|visits?|appointments?|check-?ups?|reviews?|pick-?ups?|drop-?offs?)\b|\bin\s+(?:a|an|one|two|three|\d+|a\s+few|a\s+couple\s+of)\s+\p{L}+|(?<!\p{L})[ובלמהכש]{0,3}(?:יום|ימים|יומיים|שבוע\p{L}*|חודש\p{L}*|שנה|שנים|שנתיים|שעה|שעות|שעתיים|דקות|בוקר|ערב|לילה|צהריים|מחר|סוף|קיץ|חורף|חג|חגים|חופש\p{L}*|פגרה|הבא|הבאה|הקרוב\p{L}*|המשך|אחרי|לאחר|לפני|עד|בעוד|מתישהו|חכו|לחכות|להמתין|המתינו|לדחות|מסתיימ\p{L}*|נגמר\p{L}*|לקראת)(?!\p{L})|(?<!\p{L})(?:ב|ל)(?:פגיש\p{L}*|אסיפ\p{L}*|אספ\p{L}*|ביקור\p{L}*|איסוף)(?!\p{L})/iu;
const T_NEGATED_TIMING = /\b(?:not|rather\s+than|instead\s+of|(?:do\s+not|don['’]t|never)\s+wait|without\s+waiting)\b[^,;:.!?—–\n]*?(?=\s+but\b|[,;:.!?—–\n]|$)|(?<!\p{L})ו?(?:לא|אל\s+תחכו|בלי\s+לחכות|במקום)(?!\p{L})[^,;:.!?—–\n]*?(?=\s+אלא(?!\p{L})|[,;:.!?—–\n]|$)/giu;
/** A monitoring duration is part of a condition; this test's own list. */
const T_DURATION = /\b(?:after|within|over|for|by)\s+(?:(?:a|an|one|two|three|five|ten|twenty|\d+|a\s+few|several)\s+)?(?:minutes?|hours?|days?|weeks?|months?)\b|\bby\s+(?:lunch(?:time)?|noon|bedtime)\b|(?<!\p{L})ו?(?:אחרי|לאחר|תוך|כעבור|במשך|עד)\s+(?:\S+\s+)?(?:דקות|דקה|שעה|שעות|שעתיים|יום|ימים|יומיים|שבוע\p{L}*|חודש\p{L}*|הצהריים)(?!\p{L})/giu;
const onlyDuration = (text: string) => !T_TIME.test(text.replace(T_DURATION, (m) => " ".repeat(m.length)));
/** A visit with a professional is the escalation's object, not its timing. */
const T_VISIT_PRO = /\b(?:visits?|appointments?|check-?ups?|consultations?|evaluations?|assessments?)\s+(?:to|with|at)\s+(?:\S+\s+){0,2}?(?:pediatrician|paediatrician|doctor|gp|nurse|therapist|psychologist|psychiatrist|specialist|clinician|professional|dr\.?\s*\p{Lu}\p{L}*)|(?:ביקור|תור|פגישה|בדיקה|הערכה|אבחון|ייעוץ)\s+(?:(?:אצל|עם)\s+)?(?:ה|ל)?(?:רופא|אחות|פסיכולוג|מטפל|קלינאי|יועצ|איש\s+מקצוע|ד"ר)/giu;
/** A non-immediate time phrase outside the piece's hard-moment conditions, its actions and its negated deferrals. */
function timingIn(text: string): string | null {
  // a hard-moment condition is no timing: its first chunk, and each further chunk of it that holds no calendar time
  const spans: { start: number; end: number }[] = conditionRuns(text).filter((r) => moment(r.text))
    .flatMap((r) => (r.parts ?? [r]).filter((part, i) => i === 0 || onlyDuration(part.text)));
  for (const re of [ACTION_TEST, T_VISIT_PRO]) for (const m of text.matchAll(re)) spans.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  const masked = blankSpans(text, spans).replace(T_NEGATED_TIMING, (m) => (T_TIME.test(m) ? " ".repeat(m.length) : m))
    .replace(T_IMMEDIATE, (m) => " ".repeat(m.length)).replace(T_ENCOURAGING, (m) => " ".repeat(m.length));
  return T_TIME.exec(masked)?.[0] ?? null;
}
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
        // a command split by main's own clause unit ("Talk with Dr. | Levi") is read in the whole note
        const clause = trace.clauses.find((c) => c.text.includes(command.text))
          ?? { text: row.note, main: trace.clauses.some((c) => c.main === "dropped") ? "dropped" as const : "kept" as const, restored: false, out: "" };
        const message = clause ? clause.text.slice(clause.text.indexOf(command.text) + command.text.length) : "";
        if (RELAY_START.test(command.text) && clause?.main === "dropped" && NEGATED_FINDING.test(message)) continue;
        // round 15: in a line main dropped, only a governed escalation must come back
        if (clause?.main === "dropped") {
          const condition = governingCondition(clause.text, command.text);
          if (!condition || T_PAST.test(condition) || T_LABEL.test(condition) || discouragingIn(clause.text)) continue;
          // round 16: nor one whose condition is only an unspoken reassurance, or that defers the contact
          if (!qualifies(condition) || timingIn(clause.text)) continue;
        }
        fail(`escalation command lost: ${command.text}`);
      }
      for (const clause of trace.clauses.filter((c) => c.main === "kept")) {
        for (const referral of referralsIn(clause.text)) if (!lowerOut.includes(referral.toLocaleLowerCase())) fail(`referral main keeps lost: ${referral}`);
      }
      // 7. every restored piece is an escalation: a non-negated command with a recipient (round 13, P1-C)
      for (const clause of trace.clauses.filter((c) => c.restored && c.out.trim())) {
        if (!hasEscalation(clause.out) && !(CONDITION_FRAGMENT.test(clause.out) && hasEscalation(out))) fail(`restored a piece with no escalation command: ${clause.out}`);
        const runs = conditionRuns(clause.out);
        if (!runs.length) fail(`restored a piece no condition governs: ${clause.out}`);
        else if (!runs.some((r) => qualifies(r.text))) fail(`restored a piece whose condition is only an unspoken reassurance ("${runs[0].text.trim()}"): ${clause.out}`);
        const deferral = timingIn(clause.out);
        if (deferral) fail(`restored a piece that defers the contact ("${deferral}"): ${clause.out}`);
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
    expect(fresh.length).toBe(455);
    expect(fresh.filter((r) => r.id.startsWith("r16-")).length).toBe(103);
    expect(fresh.filter((r) => r.id.startsWith("r15-")).length).toBe(46);
    expect(fresh.filter((r) => r.id.startsWith("r14-")).length).toBe(36);
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
    ["the critic's fresh sets r9 / r10 / r11 / r12 / r13 / r14 / r15 / r16 / floor-probe 1-4", () => fresh],
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
