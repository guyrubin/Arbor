/* B-ASKJB-44 round 11 — the handoff floor as a MONOTONIC wrapper over the
 * live floor (CoS decision log, 28 Oct: "a monotonic wrapper over the live
 * floor replaces the rule rewrite").
 *
 * Main's module (`lib/clinicalScan` `withoutHandoffFindings`) gives every
 * clause its base verdict. This wrapper may only do two things to it:
 *
 *   (a) RESTORE an escalation line main dropped or cut. A clause that carries
 *       an escalation command (call / contact / talk with / see / consult a
 *       professional, the family, a helpline or an emergency number; EN + HE)
 *       and that main dropped comes back with its command and its condition
 *       ("If … / When … / אם … / כש …"). Only a part that STATES a finding is
 *       left out ("…, who found no signs of delay", "…, because this is a sign
 *       of X", a condition naming a diagnosis the parent never wrote). A
 *       condition fragment main split off from its command ("If … ; call …")
 *       comes back too.
 *   (b) REMOVE a negated-finding reassurance whose object the parent never
 *       said: "no signs of X", "no evidence of X", "אין סימנים ל-X", "ללא עדות
 *       ל-X", "לא נצפו / לא נמצאו …", asserted (not a condition of an
 *       escalation), where some content word of X appears nowhere in the
 *       parent's own text. Only that reassurance (with its lead-in or trailing
 *       attribution) goes; the rest of the sentence, and any escalation
 *       command in it, stays.
 *
 * Everything else is main's output byte-for-byte: a note neither rule touches
 * is returned exactly as `withoutHandoffFindings` returns it. Hence, by
 * construction, no clause main keeps is lost except a rule-(b) reassurance,
 * and every escalation command in the model's text reaches the output
 * (`handoffFloor.monotonic.test.ts` checks both over every corpus in the repo).
 *
 * Deliberately NOT caught here: invented non-reassuring details ("biting
 * Lily") — they are not reassurance, main ships them, and a model-based
 * paraphrase check is its own row.
 */
import {
  findClinicalDiagnosisTerm,
  findingsIn,
  handoffClauses,
  HANDOFF_BRIEF_UNSCRUBBED_FIELDS,
  REFERRAL_EN,
  REFERRAL_HE,
  statesUnreportedFinding,
  withoutHandoffFindings,
  type HandoffFloorOptions,
} from "./clinicalScan";
import { hasIncidentCue } from "../content/behaviorTaxonomy";

/* ── escalation commands (EN + HE) ──────────────────────────────────────── */

const PRO_EN = String.raw`(?:pediatricians?|paediatricians?|doctors?|physicians?|GPs?|nurses?|therapists?|psychologists?|psychiatrists?|counsell?ors?|specialists?|clinicians?|professionals?|health\s+visitors?|social\s+workers?|audiologists?|pathologists?|neurologists?|dentists?|SLPs?|helplines?|hotlines?|crisis\s+(?:line|team|service)s?|emergency\s+(?:services|room|department|line|number)|ambulance|poison\s+control|A&E|Dr\.?\s+\p{Lu}[\p{L}'’-]*)`;
const FAMILY_EN = String.raw`(?:family|families|parents?|guardians?|caregivers?|mom|mum|dad|mother|father|grand(?:ma|pa|mother|father|parents?))`;
const NUMBER = String.raw`(?:112|911|999|988|101|100|1201)`;
const RECIPIENT_EN = String.raw`(?:(?:${PRO_EN}|${FAMILY_EN})\b|${NUMBER}\b)`;
const VERB_EN = String.raw`(?:call|calling|phone|phoning|ring|contact|contacting|text|email|notify|notifying|inform|informing|alert|alerting|tell|telling|reach(?:ing)?\s+out|get(?:ting)?\s+in\s+touch|talk|talking|speak|speaking|chat|chatting|check(?:ing)?\s+in|follow(?:ing)?\s+up|discuss|discussing|consult|consulting|see|seeing|visit|visiting|book|booking|ask|asking|mention|mentioning|raise|raising|bring|bringing|refer|referring|let|show|showing|take|taking|involve|involving|share|sharing|loop\s+in)`;
/** A command verb, then at most four plain words (no clause punctuation), then a recipient. */
const COMMAND_EN = new RegExp(String.raw`\b${VERB_EN}\b(?:\s+[\p{L}\d'’.&-]+){0,4}?\s+${RECIPIENT_EN}`, "giu");
/** Round 12 (P1-3): the passive and the noun forms — "the nurse should be called", "a referral to a speech therapist". */
const COMMAND_EN_PASSIVE = new RegExp(String.raw`\b(?:(?:the|a|an|his|her|their|your|our)\s+)?(?:[\p{L}'’-]+\s+){0,2}?${RECIPIENT_EN}\s+(?:should|must|can|could|may|might|will|needs?\s+to|ought\s+to|has\s+to|have\s+to|is\s+to|are\s+to)\s+be\s+(?:called|contacted|phoned|rung|notified|informed|alerted|told|consulted|involved|seen|asked|updated)\b|\b(?:referrals?|evaluation|assessment|appointment|consultation|check-?up|visit)\s+(?:to|with|by|from)\s+(?:(?:a|an|the|your|his|her|their)\s+)?(?:[\p{L}'’-]+\s+){0,2}?${RECIPIENT_EN}`, "giu");
/** Escalations that name no recipient: seek/get help, go to the ER, call 112. */
const COMMAND_EN_BARE = new RegExp(String.raw`\b(?:seek|seeking|get|getting|ask(?:ing)?\s+for)\s+(?:(?:immediate|urgent|professional|medical|expert|outside|extra|more|further|specialist)\s+)*(?:help|care|advice|support|attention|evaluation|assessment|guidance)\b|\b(?:go|going|head|take\s+\p{L}+)\s+to\s+(?:the\s+)?(?:emergency|A&E|hospital)\b|\b(?:call|dial|phone|ring)\s+(?:the\s+)?(?:${NUMBER}|emergency)\b`, "giu");

const HE_INF = String.raw`ליצור\s+קשר|להזעיק|להפנות|להתקשר|לפנות|לדבר|לשוחח|להתייעץ|להיוועץ|ליידע|לעדכן|לספר|להודיע|לקבוע\s+תור|לקבוע\s+פגישה|להגיע|לגשת|להראות|לשתף|להזמין`;
const HE_IMP = String.raw`צרו\s+קשר|צור\s+קשר|צרי\s+קשר|הזעיקו|הזעק|הזעיקי|הפנו|התקשרו|התקשר|התקשרי|פנו|פנה|פני|דברו|דבר|דברי|שוחחו|שוחח|שוחחי|התייעצו|התייעץ|התייעצי|יידעו|יידע|עדכנו|עדכן|עדכני|ספרו|ספר|ספרי|הודיעו|הודע|קבעו\s+תור|גשו|הזמינו|שתפו|הראו`;
const HE_RECIPIENT = String.raw`(?:רופא\p{L}*|איש\s+מקצוע|אשת\s+מקצוע|אנשי\s+מקצוע|גורם\s+מקצועי|גורמי\s+מקצוע|מטפל\p{L}*|פסיכולוג\p{L}*|פסיכיאטר\p{L}*|יועצ\p{L}*|יועץ|אחות|אחיות|קלינאי\p{L}*|מרפא\p{L}*|נוירולוג\p{L}*|הורים|הורה|משפחה|אמא|אבא|מוקד\p{L}*|קו\s+חם|קו\s+סיוע|ער"ן|מד"א|חירום|מיון|טיפת\s+חלב|ד"ר|דוקטור|${NUMBER})`;
const HE_COMMAND = new RegExp(String.raw`(?<!\p{L})(?<pre>ו|ש)?(?:${HE_INF}|${HE_IMP})(?!\p{L})(?:\s+[^\s,;:.!?—–]+){0,3}?\s+(?:(?:עם|את|אל|אצל)\s+)?(?:ו)?(?:ל|ה|לה|ב|מ)?${HE_RECIPIENT}`, "gu");
/** A modal plus "call / turn to / consult" with no recipient: "יש להתקשר מיד", "מומלץ להתייעץ". */
const HE_COMMAND_BARE = /(?<!\p{L})(?<pre>ו)?(?:יש|כדאי|מומלץ|חשוב|צריך|רצוי|נא|אפשר|ניתן)(?:\s+(?:מאוד|מיד|מייד|גם|לכם|לך))?\s+(?:להתקשר|לפנות|להתייעץ|לשוחח|לדבר|ליצור\s+קשר|להזעיק\s+עזרה|להפנות|לבקש\s+עזרה|לקבל\s+(?:עזרה|ייעוץ|הכוונה|תמיכה))(?!\p{L})|(?<!\p{L})(?:להפנות|הפנו|להזעיק|הזעיקו)\s+(?:את\s+\S+\s+)?(?:ל)?(?:הערכה|אבחון|בדיקה|ייעוץ|טיפול|עזרה|אמבולנס)(?!\p{L})|(?<!\p{L})(?:לבקש|לקבל|בקשו|קבלו)\s+(?:עזרה|ייעוץ|הכוונה|תמיכה)\s+(?:מקצועית|מקצועי|רפואית|רפואי)(?!\p{L})/gu;
/** "פנו ההורים לרופאה" / "התקשרו אלינו מהגן": a plural past (verb-first), not a command. */
const HE_NARRATIVE_AFTER = /^(?:ההורים|הם|הן|היא|הוא|אלינו|אליי|אלי|אליה|אליו|אליהם|מהגן|מהבית|אתמול)(?!\p{L})/u;
const HE_PAST_TIME = /(?<!\p{L})(?:אתמול|שלשום|שעבר|בעבר)(?!\p{L})/u;
/** "he gets to tell his parents", "we call him in", "told us to call": a statement, not a command. */
const EN_NARRATIVE_BEFORE = /\b(?:gets?|got|getting|likes?|liked|loves?|loved|wants?|wanted|tries|tried|used|goes|went|came|comes|started|starts|begins?|began|had|is\s+able|was\s+able|decided|agreed|refused|refuses|forgot|remembered|asked|told)\s+(?:\p{L}+\s+){0,2}?to\s+$|\b(?:he|she|they|we|i|it|who)\s+(?:also\s+|often\s+|usually\s+|sometimes\s+|always\s+|never\s+|then\s+|just\s+)?$/iu;

export type EscalationCommand = { text: string; index: number };

/** Every escalation command in the text (verb through recipient), in order. */
export function findEscalationCommands(text: string): EscalationCommand[] {
  const out: EscalationCommand[] = [];
  for (const re of [COMMAND_EN, COMMAND_EN_PASSIVE, COMMAND_EN_BARE, HE_COMMAND, HE_COMMAND_BARE]) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const index = m.index ?? 0;
      if ((re === COMMAND_EN || re === COMMAND_EN_BARE || re === COMMAND_EN_PASSIVE) && EN_NARRATIVE_BEFORE.test(text.slice(Math.max(0, index - 48), index))) continue;
      if (re === HE_COMMAND) {
        const rest = text.slice(index + m[0].split(/\s+/)[0].length).trimStart();
        const lineStart = text.lastIndexOf("\n", index) + 1;
        if (HE_NARRATIVE_AFTER.test(rest) || HE_PAST_TIME.test(text.slice(lineStart, index))) continue;
      }
      const pre = m.groups?.pre ?? "";
      const found = { text: m[0].slice(pre.length), index: index + pre.length };
      if (!out.some((c) => c.index === found.index && c.text === found.text)) out.push(found);
    }
  }
  return out.sort((a, b) => a.index - b.index);
}
const hasCommand = (text: string) => findEscalationCommands(text).length > 0;

/** Main's own referral words (lib/clinicalScan): a line main treats as a safety message is never cut into here either. */
const MAIN_REFERRAL = [new RegExp(REFERRAL_EN.source, `g${REFERRAL_EN.flags}`), new RegExp(REFERRAL_HE.source, `g${REFERRAL_HE.flags}`)];
/** Escalation commands plus main's referral words: what rule (b) never removes and what keeps a condition a condition. */
export function findEscalationSpans(text: string): EscalationCommand[] {
  const out = findEscalationCommands(text);
  for (const re of MAIN_REFERRAL) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) out.push({ text: m[0], index: m.index ?? 0 });
  }
  return out.sort((a, b) => a.index - b.index);
}
const carriesEscalation = (text: string) => findEscalationSpans(text).length > 0;

/* ── conditions ──────────────────────────────────────────────────────────── */

/** Always a condition. */
const CONDITION_ALWAYS = /\b(?:if|unless|in\s+case|in\s+the\s+event|as\s+long\s+as|until|till|should\s+(?:he|she|they|it|there|the\s+\p{L}+))\b|(?<!\p{L})(?:ו)?(?:אם|במידה|במקרה|בכל\s+מקרה|עד\s+ש|עד\s+אשר|כל\s+עוד)(?!\p{L})/iu;
/** "when / once / כש / כאשר …": a condition inside an escalation line, unless narrated in the past. */
const CONDITION_WHEN = /\b(?:when|whenever|once|as\s+soon\s+as|any\s+time|each\s+time|every\s+time|where|wherever)\b|(?<!\p{L})(?:ו)?(?:כש(?=\p{L})|כאשר(?!\p{L})|בכל\s+פעם|ברגע\s+ש|בזמן\s+ש)/iu;
/** "after / within / כעבור / אחרי …" makes a condition only with a linked absence ("after 20 minutes WITH no
 *  signs", "אחרי 20 דקות שאין", "כעבור 20 דקות ללא"); "after two weeks there are no signs of X" asserts X. */
const CONDITION_TIME = /\b(?:after|within|over|by)\b|(?<!\p{L})(?:ו)?(?:אחרי|לאחר|כעבור|תוך)(?!\p{L})/iu;
const LINKED_ABSENCE = /\b(?:with|without)\b|(?<!\p{L})(?:ללא|בלי)(?!\p{L})|(?<!\p{L})ש(?:אין|לא)(?!\p{L})/iu;
/** "With no signs of calming after 20 minutes, call …": an absolute phrase ahead of the command. */
const ABSOLUTE_START = /^\s*(?:with|without)\b|^\s*(?:ללא|בלי)(?!\p{L})/iu;
const PAST = /\b(?:was|were|did|had|found|saw|showed|tested|assessed|checked|examined|evaluated|screened|said|told|ruled|went|came|got|seemed|appeared|visited|met|played|cried|bit|hit|calmed|settled|ago|yesterday|earlier|last\s+(?:week|month|year|time|visit))\b|(?<!\p{L})(?:ו|ש|כש)?(?:היה|הייתה|היו|בדק|בדקה|בדקו|נבדק|נבדקה|נבדקו|ראה|ראתה|מצא|מצאה|מצאו|אמר|אמרה|אמרו|הראה|הראתה|ביקר|ביקרה|נפגש|נפגשה|נפגשו|בכה|בכתה|נרגע|נרגעה|שעבר|אתמול|שלשום|בעבר)(?!\p{L})/iu;
const isConditionText = (text: string, escalation: boolean, beforeCommand = false) =>
  CONDITION_ALWAYS.test(text) || (escalation && !PAST.test(text) && (CONDITION_WHEN.test(text)
    || (CONDITION_TIME.test(text) && LINKED_ABSENCE.test(text)) || (beforeCommand && ABSOLUTE_START.test(text))));
/** A chunk that continues a condition list: "…, or there are no signs…", "…, או שאין…". */
const OR_START = /^(?:or|either|או)(?!\p{L})/iu;
/** A chunk that asserts on its own: "…, but / though / as / since / because / and …", "…, אבל / כי / ו…". */
const ASSERTIVE_START = /^(?:and|but|though|although|as|since|because|so|yet|while|whereas|which|who|whom|that|where|even|still|also|however|plus)\b|^(?:ו(?!\p{L})|ו(?=\p{L})|אבל|אך|כי|מאחר|למרות|בעוד|אולם|ש(?=\p{L}))/iu;

/* ── negated-finding reassurances (rule b) ───────────────────────────────── */

const SIGN_EN = String.raw`(?:signs?|evidence|indications?|indicators?|symptoms?|red\s+flags?|traces?|hints?)`;
const QUAL_EN = String.raw`(?:(?:clear|obvious|apparent|real|significant|further|current|visible|noticeable|genuine|meaningful|major|particular|specific|any|definite|concerning|worrying|early|other|such)\s+){0,2}`;
/** Each pattern's match ends where the object X begins (sign heads) or IS X (found heads, group 1). */
const REASSURE_SIGN_EN = [
  new RegExp(String.raw`\bno\s+${QUAL_EN}${SIGN_EN}\s+(?:of|that|for)\b`, "giu"),
  new RegExp(String.raw`\b(?:not|n['’]t)\s+(?:(?:show|display|exhibit|have|find|see|notice|observe|present|demonstrate|detect|identify|be|appear\s+to\s+have)(?:s|ed|ing)?\s+)?(?:any\s+|a\s+single\s+)?${QUAL_EN}${SIGN_EN}\s+(?:of|that|for)\b`, "giu"),
  new RegExp(String.raw`\b(?:without|free\s+(?:of|from))\s+(?:any\s+)?${QUAL_EN}${SIGN_EN}\s+of\b`, "giu"),
];
const REASSURE_FOUND_EN = new RegExp(String.raw`\bno\s+((?:[\p{L}-]+[\s,]+){0,4}?(?:difficult(?:y|ies)|delays?|deficits?|impairments?|concerns?|problems?|issues?))\s+(?:were|was|have\s+been|has\s+been|are|is)\s+(?:noted|observed|found|identified|detected|seen|present|evident|apparent|reported)\b`, "giu");
const HE_NEG = String.raw`אין|ללא|בלי|לא\s+נצפו|לא\s+נצפה|לא\s+נצפתה|לא\s+נמצאו|לא\s+נמצא|לא\s+נמצאה|לא\s+נראו|לא\s+נראים|לא\s+נראה|לא\s+נראית|לא\s+זוהו|לא\s+זוהה|לא\s+קיימים|לא\s+קיימת|לא\s+מראה|לא\s+מראים|לא\s+הראה|לא\s+הראתה|לא\s+הראו|אינו\s+מראה|אינה\s+מראה|לא\s+היו|לא\s+הייתה|לא\s+היה`;
const HE_SIGN = String.raw`סימנים|סימן|סממנים|סממן|עדות|עדויות|הוכחה|הוכחות|אינדיקציה|אינדיקציות|ראיה|ראיות|ממצאים|ממצא|תסמינים|תסמין`;
const REASSURE_SIGN_HE = new RegExp(String.raw`(?<!\p{L})(?:ו|ש|כש)?(?:${HE_NEG})\s+(?:שום\s+|כל\s+)?(?:${HE_SIGN})(?!\p{L})(?:\s+(?:של|על))?`, "gu");
const REASSURE_FOUND_HE = new RegExp(String.raw`(?<!\p{L})(?:ו|ש|כש)?(?:לא\s+נצפו|לא\s+נצפה|לא\s+נמצאו|לא\s+נמצא|לא\s+זוהו|לא\s+זוהה|לא\s+נראו)\s+(?:שום\s+)?((?:קשיים|קושי|עיכוב|עיכובים|בעיות|בעיה|ליקוי|ליקויים|חשש|חששות)(?!\p{L})(?:\s+[^\s,;:.!?—–]+){0,3})`, "gu");

type Reassurance = { index: number; end: number; object: string; objectEnd: number };
/** Where the object stops: a clause boundary or a word that starts a new clause or a time/context frame. */
const OBJECT_STOP = /[,;:.!?—–()]|\s-\s|\b(?:when|whenever|while|since|because|as|after|before|during|despite|unless|if|until|which|who|that|so|but|though|although|according|per|yet|even|today|yesterday|lately|recently|anymore|now|so\s+far|he|she|they|we|i|you|and|or|nor|plus)\b|(?<!\p{L})(?:כש\p{L}*|כאשר|מאז|אחרי|לאחר|לפני|במהלך|בזמן|למרות|כי|אבל|אך|לדברי|לפי|אם|עד|בעוד|מאחר|כפי|היום|כרגע|הוא|היא|הם|הן|אני|אנחנו|והוא|והיא|והם|או)(?!\p{L})|(?<!\p{L})ו(?=\p{L}{2})/iu;

function reassurancesIn(text: string): Reassurance[] {
  const out: Reassurance[] = [];
  const signHead = (i: number, end: number) => {
    const rest = text.slice(end);
    const stop = rest.search(OBJECT_STOP);
    const raw = stop < 0 ? rest : rest.slice(0, stop);
    out.push({ index: i, end, object: raw.trim(), objectEnd: end + raw.trimEnd().length });
  };
  for (const re of [...REASSURE_SIGN_EN, REASSURE_SIGN_HE]) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) signHead(m.index ?? 0, (m.index ?? 0) + m[0].length);
  }
  for (const re of [REASSURE_FOUND_EN, REASSURE_FOUND_HE]) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const i = m.index ?? 0;
      const raw = m[1] ?? "";
      const stop = raw.search(OBJECT_STOP);
      out.push({ index: i, end: i + m[0].length, object: (stop < 0 ? raw : raw.slice(0, stop)).trim(), objectEnd: i + m[0].length });
    }
  }
  // One reassurance per start (the sign heads can overlap: "does not show any signs of").
  out.sort((a, b) => a.index - b.index || b.end - a.end);
  return out.filter((r, i) => i === 0 || r.index >= out[i - 1].end);
}

/* ── "the parent said X" ─────────────────────────────────────────────────── */

const STOP_EN = new Set(("a an the any his her their its my our your of in at on for with to or and nor real clear obvious significant further current particular "
  + "genuine noticeable visible meaningful serious major apparent specific such this that these those being he she him them it is are was were be there so far "
  + "some much many more other own very new "
  // context, never the finding itself
  + "home school preschool kindergarten daycare nursery class classroom drop-off dropoff drop pickup pick-up context setting settings play playtime today "
  + "week weeks day days morning mornings evening evenings night nights time times moment moments situation situations area areas group groups activity "
  + "activities now currently point stage age").split(/\s+/));
const finalForms: Record<string, string> = { "ם": "מ", "ן": "נ", "ץ": "צ", "ף": "פ", "ך": "כ" };
const heNorm = (w: string) => w.replace(/[םןץףך]/gu, (c) => finalForms[c] ?? c).replace(/["'״׳]/gu, "");
const STOP_HE = new Set(("של את עם או גם כל שום זה זו הזה הזו זאת כרגע היום ממש בכלל שלו שלה שלהם שלהן אצלו אצלה בו בה לו לה הוא היא הם הן "
  + "משמעותיים משמעותי משמעותית משמעותיות ממשי ממשיים ממשית ברור ברורים ברורה מיוחד מיוחדים מיוחדת כלשהו כלשהם כלשהי כלשהן נוספים נוסף "
  // context words (matched after particle stripping)
  + "בית גן כיתה הקשר בוקר בקרים ערב לילה פרידה משחק יום ימים שבוע שבועות זמן מצב שלב גיל").split(/\s+/).map(heNorm));
const HE_PARTICLES = /^(?:ו|ה|ב|כ|ל|מ|ש)/u;
const isHebrew = (w: string) => /\p{Script=Hebrew}/u.test(w);
/** Every reading of a word without its glued particles (Hebrew) or inflection (English). */
function wordVariants(word: string): string[] {
  const w = word.toLocaleLowerCase().replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, "");
  if (!w) return [];
  if (isHebrew(w)) {
    const out = new Set<string>();
    let cur = heNorm(w);
    out.add(cur);
    for (let i = 0; i < 3 && cur.length > 2 && HE_PARTICLES.test(cur); i++) { cur = cur.slice(1); out.add(cur); }
    for (const v of [...out]) if (v.length > 3 && /^[נתיא]/u.test(v)) out.add(v.slice(1));
    return [...out];
  }
  const base = w.replace(/['’]s$/u, "");
  const stem = base.replace(/(?:ies|ied)$/u, "y").replace(/(?:ing|ed|es|s|ly)$/u, "");
  return [...new Set([base, stem.length >= 3 ? stem : base])];
}
const contentWords = (object: string): string[] =>
  object.split(/[\s,/]+/u).filter((w) => {
    const vs = wordVariants(w);
    if (!vs.length) return false;
    return !vs.some((v) => (isHebrew(v) ? STOP_HE.has(v) : STOP_EN.has(v))) && /\p{L}/u.test(vs[0]);
  });
/** The crude, independent presence test: some reading's first letters (4 EN / 3 HE) occur anywhere in the parent's text. */
export const wordInParentText = (word: string, parentText: string): boolean => {
  const parent = heNorm(parentText.toLocaleLowerCase());
  return wordVariants(word).some((v) => {
    const key = v.slice(0, isHebrew(v) ? 3 : 4);
    return key.length >= (isHebrew(v) ? 2 : 3) && parent.includes(key);
  });
};
/** The object's content words the parent's text never contains (empty = the parent said X, or X has no content). */
/** Round 12: the parent's own word for the same finding counts ("no sleep problems" says "sleep difficulties"). */
const SYNONYM_CLASSES: readonly (readonly string[])[] = [
  ["difficult", "probl", "issue", "troubl", "struggl"], // stems: a word starting with one belongs to the class
  ["קושי", "קשיי", "קשיים", "קשה", "בעיה", "בעיות", "בעיית"],
];
const synonymInParent = (word: string, parentText: string) =>
  SYNONYM_CLASSES.some((members) => wordVariants(word).some((v) => members.some((m) => v.startsWith(heNorm(m))))
    && members.some((m) => heNorm(parentText.toLocaleLowerCase()).includes(heNorm(m))));
export function objectWordsAbsentFromParent(object: string, parentText: string): string[] {
  return contentWords(object).filter((w) => !wordInParentText(w, parentText) && !synonymInParent(w, parentText));
}

/* ── clause anatomy ─────────────────────────────────────────────────────── */

const SEPARATOR = /,\s*|\s*[—–]\s*|:\s+|\s+-\s+/gu;
type Chunk = { start: number; end: number };
/** A clause body split at commas, dashes and colons (offsets into the body). */
function chunksOf(body: string): Chunk[] {
  const out: Chunk[] = [];
  let at = 0;
  SEPARATOR.lastIndex = 0;
  for (const m of body.matchAll(SEPARATOR)) {
    const i = m.index ?? 0;
    if (i > at) out.push({ start: at, end: i });
    at = i + m[0].length;
  }
  if (at < body.length) out.push({ start: at, end: body.length });
  return out;
}
/** A clause that ends on a title's full stop continues in the next one. */
const ABBREVIATION_END = /\b(?:Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St)\.\s*$/u;
const splitTail = (segment: string) => {
  const m = segment.match(/[.!?;。]*\s*$/u);
  const cut = segment.length - (m ? m[0].length : 0);
  return { body: segment.slice(0, cut), tail: segment.slice(cut) };
};
/* Round 12 (P1-1): a reassurance is removed only when its comma chunk holds
 * nothing else — a lead-in ("Mom reports", "His teacher said there were",
 * "אמא מספרת ש"), the negated finding, its object and a context frame ("at
 * drop-off", "since the new routine", "מאז השגרה החדשה"). Another clause in
 * the chunk (a verb, a subject, or any hard-moment word main's own incident
 * cues know, content/behaviorTaxonomy hasIncidentCue) keeps main's verdict
 * for the whole sentence: "Mom reports no signs of tiredness after he bit Noa
 * at lunch" stays exactly as main keeps it. */
const LEAD_CONNECTOR_EN = String.raw`(?:and|but|or|though|although|as|since|because|while|whereas|so|yet|plus|also|however|still|with)`;
const LEAD_ATTRIBUTION_EN = String.raw`(?:according\s+to|per|as\s+(?:reported|noted|described|observed)\s+by)\s+(?:[\p{L}'’.-]+\s+){1,3}?`;
const LEAD_RELAY_EN = String.raw`(?:please\s+)?(?:tell|let|inform|remind|note|mention\s+to)\s+(?:[\p{L}'’.-]+\s+){0,3}?(?:know\s+)?`;
const LEAD_SUBJECT_EN = String.raw`(?:[\p{L}'’.-]+\s+){1,3}?`;
const LEAD_VERB_EN = String.raw`(?:reports?|reported|says?|said|notes?|noted|tells?|told|mentions?|mentioned|shares?|shared|observes?|observed|notices?|noticed|describes?|described|writes?|wrote|explains?|explained|confirms?|confirmed|adds?|added|agrees?|agreed|finds?|found|sees?|saw|thinks?|thought|feels?|felt|believes?|believed)`;
const SHOW_VERB_EN = String.raw`(?:(?:also|still|clearly|currently|now|really)\s+)?(?:shows?|showed|showing|has|had|have|displays?|displayed|exhibits?|exhibited|presents?|presented|demonstrates?|demonstrated|gives?|gave|is|are|was|were|does|did|do|seems?|seemed|appears?|appeared)(?:\s+(?:to\s+(?:be|have)|showing|having))?`;
const THERE_EN = String.raw`there\s+(?:is|are|was|were|has\s+been|have\s+been|seems?\s+to\s+be|appears?\s+to\s+be|remains?)\s+(?:(?:still|also|really|clearly)\s+)?`;
const LEAD_OK_EN = new RegExp(String.raw`^(?:${LEAD_CONNECTOR_EN}\s+)?(?:${LEAD_ATTRIBUTION_EN})?(?:${LEAD_RELAY_EN}(?:that\s+)?)?(?:${LEAD_SUBJECT_EN}${LEAD_VERB_EN}\s+(?:that\s+)?)?(?:${THERE_EN}|${LEAD_SUBJECT_EN}${SHOW_VERB_EN}\s+)?(?:with\s+)?$`, "iu");
/** Verbs a lead-in may carry; any other -ed / -ing word in it is a clause of its own. */
const LEAD_VERB_WORDS = new Set(("reported noted observed described explained confirmed mentioned shared noticed added agreed showed showing displayed exhibited "
  + "presented demonstrated seemed appeared believed having").split(" "));
const HE_LEAD_VERB = String.raw`(?:מספר|מספרת|מספרים|מספרות|סיפר|סיפרה|סיפרו|אומר|אומרת|אומרים|אומרות|אמר|אמרה|אמרו|מציין|מציינת|מציינים|ציין|ציינה|ציינו|מדווח|מדווחת|מדווחים|דיווח|דיווחה|דיווחו|ראה|ראתה|ראו|רואה|רואים|מצא|מצאה|מצאו|כותב|כותבת|כתב|כתבה|כתבו|חושב|חושבת|חושבים|ספרו|ספר|ספרי|אמרו|ציינו|נראה|ניכר|יש\s+לציין|חשוב\s+לציין)`;
const LEAD_OK_HE = new RegExp(String.raw`^(?:(?:ו|אבל|אך|או|כי)\s+)?(?:(?:לדברי|לפי)\S*(?:\s+\S+){0,2}\s+)?(?:(?:\S+\s+){0,3}?${HE_LEAD_VERB}(?:\s+(?:ל|ל?ה)\S+){0,2}\s+)?$`, "u");
/** A subject alone ("הדיבור שלה", "He") is a lead-in only before a verbal head ("לא מראה", "does not show"). */
const LEAD_SUBJECT_ONLY = /^(?:[\p{L}'’".-]+\s+){1,3}$/u;
/** After the object: only a context frame — no subject, no verb, no new clause. */
const TAIL_CLAUSE_EN = /\b(?:he|she|they|we|i|you|it|who|which|that)\b|\b\p{L}{3,}(?:ed|ing)\b|\b(?:is|was|were|are|has|had|did|does|went|came|got|took|made|gave|ran|fell|ate|slept|woke|sat|stood|left|said|told|saw|found|bit|hit|threw|kept|lost|broke)\b/iu;
const TAIL_CLAUSE_HE = /(?<!\p{L})(?:ו|ש|כש)?(?:הוא|היא|הם|הן|אני|אנחנו|אתה|את|אתם)(?!\p{L})|(?<!\p{L})(?:ש|כש)(?!(?:בוע|בועות|עה|עות|ינה|לו|לה|להם|להן|לנו|תי|ני|לוש|ום|גרה|יחה|מיעה|פה|יפור)(?!\p{L}))\p{L}{2,}/u;
/* Round 13 (P1-A): the object ends at "and / or / ו / או", so what follows is tested as a clause of its
 * own; inside the object a hard-moment act (hit, bite, push …, הרביץ, נשך, דחף …) or a subject + verb is
 * never part of a reassurance. A negated state ("no signs of anxiety") is the reassurance itself. */
const OBJECT_ACT_EN = /\b(?:hit|hits|hitting|push\p{L}*|shov\p{L}*|kick\p{L}*|throw\p{L}*|threw|thrown|bite|bites|biting|bitten|bit|scratch\p{L}*|slap\p{L}*|punch\p{L}*|pinch\p{L}*|spit\p{L}*|spat|hurt\p{L}*|grabb\p{L}*|fight\p{L}*|fought)\b/iu;
const OBJECT_ACT_HE = /(?<!\p{L})(?:[ובהלמשכ]|וה|ול|ומ|וב)?(?:הרביצ\p{L}*|הרביץ|מרביצ\p{L}*|מכות|מכה|היכה|הכה|הכתה|נשיכ\p{L}*|נשך|נשכה|נושך|נושכת|דחף|דחפה|דוחף|דוחפת|דחיפ\p{L}*|בעט|בעטה|בועט|בועטת|בעיט\p{L}*|זרק|זרקה|זורק|זורקת|זריק\p{L}*|שרט|שרטה|שריט\p{L}*|צבט|צבטה|צביט\p{L}*|סטר|סטיר\p{L}*|ירק|ירקה|יריק\p{L}*|פגע|פגעה|פוגע|פוגעת)(?!\p{L})/u;
const LIST_JOIN = /^(?:(?:and|or|nor|plus)\s+|או\s+|ו(?=\p{L}{2}))/iu;
/** A state or finding noun: what a reassurance's object list is made of ("anxiety or distress", "קשב או ויסות"). */
const STATE_NOUN = /\b(?:anxi\p{L}*|distress|fear\p{L}*|worr\p{L}*|stress|tired\p{L}*|fatigue|difficult\p{L}*|delay\p{L}*|deficit\p{L}*|impairment\p{L}*|disorder\p{L}*|problem\p{L}*|issue\p{L}*|concern\p{L}*|regulation|dysregulation|attention|focus|overload|overwhelm\p{L}*|frustration|anger|sadness|withdrawal|hunger|pain|illness|fever|cold|infection|sensitivit\p{L}*|discomfort|upset)\b|(?<!\p{L})(?:[ובהלמש]{0,2})(?:חרד\p{L}*|מצוק\p{L}*|פחד\p{L}*|דאג\p{L}*|לחץ|עייפות|קושי|קשיי\p{L}*|קשיים|עיכוב\p{L}*|ליקוי\p{L}*|הפרע\p{L}*|בעי\p{L}*|ויסות|קשב|ריכוז|עומס|תסכול|כעס|עצב|רעב|כאב|חום|מחלה|דלקת\p{L}*)(?!\p{L})/iu;
const OBJECT_CLAUSE = /\b(?:he|she|they|we|i|you|who)\b|\b(?:is|was|were|are|has|had|did|does|went|came|got|took|made)\b|(?<!\p{L})(?:ו|ש|כש)?(?:הוא|היא|הם|הן|אני|אנחנו)(?!\p{L})/iu;
/** Nouns that only look like verbs in a frame ("this morning", "since the spring"). */
const TAIL_NOUNS_EN = /\b(?:morning|mornings|evening|evenings|during|nothing|something|anything|everything|setting|settings|building|spring|ceiling|bedtime|weekend|weekends)\b/giu;
const HE_GLUED_VAV_HEAD = /^ו/u;
/** True when the chunk is the reassurance and nothing else (see above). */
function onlyReassurance(chunkText: string, head: number, headEnd: number, objectEnd: number): boolean {
  const pre = chunkText.slice(0, head).trim();
  let object = chunkText.slice(headEnd, objectEnd);
  let post = chunkText.slice(objectEnd).trim();
  // "… or regulation difficulties", "… או ויסות": a further state in the same list belongs to the object;
  // anything else after "and / or / ו / או" is a clause of its own and keeps main's whole sentence.
  while (LIST_JOIN.test(post)) {
    const item = post.replace(LIST_JOIN, "");
    const next = item.slice(1).search(OBJECT_STOP); // the item's own first letter never ends it ("או ויסות")
    const stop = next < 0 ? -1 : next + 1;
    const piece = stop < 0 ? item : item.slice(0, stop);
    if (!STATE_NOUN.test(piece) || OBJECT_ACT_EN.test(piece) || OBJECT_ACT_HE.test(piece) || OBJECT_CLAUSE.test(piece) || /\p{L}{3,}ed\b/iu.test(piece)) return false;
    object += ` ${piece}`;
    post = (stop < 0 ? "" : item.slice(stop)).trim();
  }
  const headText = chunkText.slice(head);
  if (hasIncidentCue(pre) || hasIncidentCue(post)) return false;
  // Round 13 (P1-A): the object itself carries no act and no clause ("no signs of distress and bit a classmate").
  if (OBJECT_ACT_EN.test(object) || OBJECT_ACT_HE.test(object) || OBJECT_CLAUSE.test(object)) return false;
  if (post.split(/\s+/u).filter(Boolean).length > 6) return false;
  if (TAIL_CLAUSE_EN.test(post.replace(TAIL_NOUNS_EN, " ")) || TAIL_CLAUSE_HE.test(post)) return false;
  if (!pre) return true;
  if (isHebrew(pre) || isHebrew(headText.slice(0, 8))) {
    if (LEAD_OK_HE.test(`${pre} `)) return true;
    // a bare subject before a verbal head, never after a glued "and" (that is a clause of its own)
    return !HE_GLUED_VAV_HEAD.test(headText) && LEAD_SUBJECT_ONLY.test(`${pre} `) && /^(?:לא|אינו|אינה|אינם)\s/u.test(headText);
  }
  if (!LEAD_OK_EN.test(`${pre} `)) return false;
  return pre.toLocaleLowerCase().split(/\s+/u).every((w) => !/\p{L}{3,}(?:ed|ing)$/u.test(w) || LEAD_VERB_WORDS.has(w));
}
/** Text that carries nothing once its reassurance is gone: an attribution, a reporter lead-in, a short frame. */
const ATTRIBUTION = /^(?:according\s+to|as\s+(?:reported|noted|described|observed)\s+by|per)\s+\S+(?:\s+\S+){0,3}$|^(?:לדברי|לפי)\S*(?:\s+\S+){0,3}$|^כפי\s+ש\S+(?:\s+\S+){0,3}$/iu;
const LEAD_IN = /^(?:\S+\s+){0,4}?(?:reports?|reported|says?|said|notes?|noted|tells?|told|mentions?|mentioned|shares?|shared|observes?|observed|notices?|noticed|describes?|described|writes?|wrote|explains?|explained|confirms?|confirmed|adds?|added|agrees?|agreed|finds?|found|sees|saw)(?:\s+that)?$|^(?:\S+\s+){0,3}?(?:מספר|מספרת|מספרים|מספרות|סיפר|סיפרה|סיפרו|אומר|אומרת|אומרים|אמר|אמרה|אמרו|מציין|מציינת|מציינים|ציין|ציינה|ציינו|מדווח|מדווחת|מדווחים|דיווח|דיווחה|דיווחו|ראה|ראתה|ראו|מצא|מצאה|מצאו|כותב|כותבת|כתב|כתבה)(?:\s+(?:ש|כי))?$/iu;
const FRAME = /^(?:in|at|on|during|after|before|since|for|within|from|across|around|throughout|overall|so\s+far|today|currently|also|otherwise|generally|notably|importantly|however|still|again|additionally|moreover)\b(?:\s+\S+){0,5}$|^(?:במהלך|בזמן|בתחום|בבית|בגן|בכיתה|בהקשר|אחרי|לאחר|לפני|מאז|כרגע|בינתיים|בנוסף|עם\s+זאת|כמו\s+כן|חשוב\s+לציין|בסך\s+הכל|באופן\s+כללי)(?!\p{L})(?:\s+\S+){0,4}$/iu;
const PROTECTED_CONDITION = /\b(?:if|unless|when|whenever|once|should|in\s+case|until)\b|(?<!\p{L})(?:ו)?(?:אם|במידה|במקרה|כאשר|כש(?=\p{L})|עד\s+ש)/iu;
const isFiller = (text: string) => {
  const t = text.trim().replace(/^[,;:—–-]\s*/u, "").replace(/[\s,;:—–-]+$/u, "");
  if (t === "") return true;
  if (ATTRIBUTION.test(t)) return true;
  if (carriesEscalation(t) || PROTECTED_CONDITION.test(t)) return false;
  return LEAD_IN.test(t) || FRAME.test(t) || !/\s/u.test(t);
};

/** A chunk is conditional when a condition word comes before `at` inside it, or it continues a condition. */
function conditionalFlags(body: string, chunks: Chunk[], escalation: boolean): boolean[] {
  const flags: boolean[] = [];
  let open = false; // the previous chunk leaves a condition open
  const firstCommand = chunks.findIndex((c) => carriesEscalation(body.slice(c.start, c.end)));
  for (let k = 0; k < chunks.length; k++) {
    const text = body.slice(chunks[k].start, chunks[k].end).trim();
    const commands = findEscalationSpans(text);
    const own = isConditionText(text, escalation, firstCommand >= 0 && k < firstCommand);
    // "…, or there are no signs …" continues the condition list; "…, or tell the teacher that …" is a new instruction.
    const orInstruction = /^(?:or|או)\s+(?:\S+\s+)?(?:call|contact|tell|talk|speak|see|ask|let|ספרו|התקשרו|פנו|דברו|שוחחו|עדכנו|יידעו|הודיעו)(?!\p{L})/iu.test(text);
    const startsOr = OR_START.test(text) && !commands.length && !orInstruction;
    const continues = open && !ASSERTIVE_START.test(text) && !OR_START.test(text) && !commands.length;
    const conditional = own || (open && startsOr) || continues;
    flags.push(conditional);
    if (commands.length) {
      // A command chunk opens a condition only when a condition word follows the command inside it.
      const last = commands[commands.length - 1];
      open = isConditionText(text.slice(last.index + last.text.length), escalation);
    } else {
      open = conditional;
    }
  }
  return flags;
}
/** True when a condition governs the reassurance ending at `end` (chunk-relative): judged on the text up to and including it. */
const conditionBefore = (chunkText: string, end: number, escalation: boolean, beforeCommand: boolean) => isConditionText(chunkText.slice(0, end), escalation, beforeCommand);

/* ── rule (a): restore an escalation line main dropped ───────────────────── */

/** A positive diagnostic assertion: "…, because this is a sign of X". */
const DIAGNOSTIC_SIGN = /\b(?:is|are|was|could\s+be|may\s+be|might\s+be|can\s+be|seems?\s+to\s+be|looks?\s+like)\s+(?:a\s+|an\s+)?(?:\p{L}+\s+)?(?:sign|signs|symptom|symptoms|indication|indicator|red\s+flag|marker)\s+of\b|\b(?:suggests?|suggesting|indicates?|indicating|points?\s+to|consistent\s+with|typical\s+of|characteristic\s+of)\b|(?<!\p{L})(?:זה|זהו|זו|זוהי|הם|הן|היא|הוא)?\s*(?:סימן|תסמין|אינדיקציה)\s+(?:ל|של)|(?<!\p{L})(?:מעיד|מעידה|מעידים|מצביע|מצביעה|מצביעים)\s+על|(?<!\p{L})אופייני\p{L}*\s+ל/iu;
const CUT_WORD = /\s(?:about|because|since|as|so|who|which|that|while|though|although|but|and|where|whom|with|without)\b|\s(?=there\s+(?:is|are|was|were)\b)|\s(?=(?:he|she|they|it|his|her)\s+(?:\p{L}+\s+)?(?:shows?|showed|has|had|is|was|does|did|displays?|seems?|appears?|found|finds)\b)|(?<!\p{L})(?=ש\p{L})|\s(?=(?:כי|אבל|אך|מאחר|למרות)(?!\p{L}))|\s(?=ו\p{L})/giu;

/** States a finding (main's own detector, or a diagnostic sign) — the part of an escalation line rule (a) leaves out. */
const statesFinding = (text: string, opts: HandoffFloorOptions) => statesUnreportedFinding(text, opts) || DIAGNOSTIC_SIGN.test(text);
/** A clinical label in a condition that the parent never wrote: a stated finding, so it stays out of a restored line. */
const unreportedDiagnosis = (text: string, opts: HandoffFloorOptions) => {
  const parent = opts.parentText ?? "";
  const term = findClinicalDiagnosisTerm(text);
  if (term && !parent.toLocaleLowerCase().includes(term.toLocaleLowerCase())) return true;
  // Round 12 (P2): a label from the floor's finding list with its qualifier ("articulation problems",
  // "בעיית ההגייה") the parent never wrote is a stated finding as well.
  return findingLabels(text).some((label) => objectWordsAbsentFromParent(label, parent).length > 0);
};
/** The floor's finding nouns (main's NOUN_EN / HANDOFF_FINDING_TERMS_HE classes) as labels with their qualifiers. */
const LABEL_NOUN_EN = /\b(?:problems?|difficult(?:y|ies)|delays?|deficits?|impairments?|disorders?|issues?)\b/giu;
const LABEL_NOUN_HE = /(?<!\p{L})(?:[ובהלמש]{0,2})(?:בעיית|בעיות|בעיה|קשיי|קשיים|קושי|עיכוב|עיכובים|ליקוי|ליקויים|לקות|הפרעת|הפרעה|הפרעות)(?!\p{L})(?:\s+[^\s,;:.!?—–]+){0,2}/gu;
function findingLabels(text: string): string[] {
  const labels: string[] = [];
  LABEL_NOUN_EN.lastIndex = 0;
  for (const m of text.matchAll(LABEL_NOUN_EN)) {
    const before = text.slice(0, m.index ?? 0).match(/(?:[\p{L}'’-]+\s+){0,2}$/u)?.[0] ?? "";
    labels.push(`${before}${m[0]}`);
  }
  LABEL_NOUN_HE.lastIndex = 0;
  for (const m of text.matchAll(LABEL_NOUN_HE)) labels.push(m[0]);
  return labels;
}

/** Inside one chunk: cut the text after the command at the last cut word before a stated finding. */
type Span = { index: number; end: number };
const DANGLING = /(?:[\s,;:—–-]+(?:when|whenever|if|as|and|but|so|that|because|with|without|about|while|once|after|since|or|then|who|which|where|כש|כאשר|אם|ו|כי|אבל|אך|ש))+[\s,;:—–-]*$/iu;
function truncateAfterCommand(text: string, escalation: boolean, findings: Span[]): string {
  const commands = findEscalationSpans(text);
  if (!commands.length) return text;
  const last = commands[commands.length - 1];
  const commandEnd = last.index + last.text.length;
  const after = findings.filter((f) => f.index >= commandEnd).sort((a, b) => a.index - b.index);
  if (!after.length) return text;
  const head = after[0].index;
  const between = text.slice(commandEnd, head);
  if (isConditionText(text.slice(commandEnd, after[0].end), escalation)) return text; // the finding is the command's condition
  let cut = -1;
  CUT_WORD.lastIndex = 0;
  // Scan through the finding (a cut word may look ahead into it) but cut only before it.
  for (const m of text.slice(commandEnd, after[0].end).matchAll(CUT_WORD)) if ((m.index ?? 0) <= between.length) cut = commandEnd + (m.index ?? 0);
  if (cut < 0) return text;
  // A condition word left hanging by the cut goes with it ("Call the family when [he was observed …]").
  return text.slice(0, cut).replace(DANGLING, "").replace(/[\s,;:—–-]+$/u, "");
}

function restoreEscalation(segment: string, opts: HandoffFloorOptions): string | null {
  const { body, tail } = splitTail(segment);
  const chunks = chunksOf(body);
  const flags = conditionalFlags(body, chunks, true);
  const keep: KeptPart[] = [];
  let removedLast = false;
  let afterRemoved = false;
  for (let k = 0; k < chunks.length; k++) {
    const text = body.slice(chunks[k].start, chunks[k].end);
    const sep = k === 0 ? "" : body.slice(chunks[k - 1].end, chunks[k].start);
    if (carriesEscalation(text)) {
      const sign = DIAGNOSTIC_SIGN.exec(text);
      const spans: Span[] = [...findingsIn(text).map((f) => ({ index: f.index, end: f.index + f.phrase.length })), ...(sign ? [{ index: sign.index, end: sign.index + sign[0].length }] : [])];
      const own = truncateAfterCommand(text, true, spans);
      keep.push({ text: own, sep, afterRemoved }); removedLast = own !== text; afterRemoved = removedLast;
    } else if (flags[k] ? unreportedDiagnosis(text, opts) : statesFinding(text, opts)) {
      removedLast = true; afterRemoved = true;
    } else {
      keep.push({ text, sep, afterRemoved }); removedLast = false; afterRemoved = false;
    }
  }
  if (!keep.some((p) => hasCommand(p.text))) return null;
  return assemble(keep, tail, removedLast);
}

type KeptPart = { text: string; sep: string; afterRemoved: boolean };
/** A conjunction that only joined the removed part: "…, and she can call" → "…, she can call". */
const JOINING = /^(?:and|but|so|though|although|even\s+though|yet|also|plus|as|since|because|while|whereas)\s+|^(?:אבל|אך|כי|אולם)\s+|^(?:למרות|בעוד|מאחר|אף\s+על\s+פי|אף)\s+ש(?=\p{L})|^ו(?=(?:הוא|היא|הם|הן|אני|אנחנו|אפשר|יש|כדאי|מומלץ|חשוב)(?!\p{L}))/iu;
const LEADING_OR = /^(?:or|או)\s+/iu;
/** Join kept chunks; a removed lead gives its capital back, a removed tail its full stop. */
function assemble(parts: KeptPart[], tail: string, removedLast: boolean): string {
  const texts = parts.map((p, i) => {
    let t = p.text.trim();
    if (p.afterRemoved) t = t.replace(JOINING, "");
    if (i === 0 && p.afterRemoved) {
      t = t.replace(LEADING_OR, "");
      if (/^\p{Ll}/u.test(t)) t = t[0].toLocaleUpperCase() + t.slice(1);
    }
    return t;
  });
  const text = texts.map((t, i) => (i === 0 ? t : `${parts[i].sep.trim() ? parts[i].sep : ", "}${t}`)).join("");
  const punct = tail.match(/^[.!?;。]*/u)?.[0] ?? "";
  const space = tail.slice(punct.length);
  const end = removedLast && (punct === "" || punct === ";") ? "." : punct;
  return `${text.replace(/[\s,;:—–-]+$/u, "")}${end}${space}`;
}

/* ── rule (b): remove an asserted reassurance the parent never said ─────── */

export type RemovedReassurance = { text: string; object: string; absentWords: string[] };
/** Everything rule (b) took out: the reassurance itself, or a lead-in / attribution / frame left empty beside it. */
export type RemovedPiece = { text: string; kind: "reassurance" | "filler" };

function removeReassurances(segment: string, opts: HandoffFloorOptions, removed: RemovedReassurance[], pieces: RemovedPiece[]): string {
  const parent = opts.parentText ?? "";
  const { body, tail } = splitTail(segment);
  const escalation = carriesEscalation(body);
  const chunks = chunksOf(body);
  const flags = conditionalFlags(body, chunks, escalation);
  const firstCommand = chunks.findIndex((c) => carriesEscalation(body.slice(c.start, c.end)));
  // Spans to remove, in body offsets.
  const spans: { start: number; end: number; object: string; absent: string[] }[] = [];
  for (const r of reassurancesIn(body)) {
    const k = chunks.findIndex((c) => r.index >= c.start && r.index < c.end);
    if (k < 0) continue;
    const chunk = chunks[k];
    const chunkText = body.slice(chunk.start, chunk.end);
    const rel = r.index - chunk.start;
    // A condition of an escalation (or any explicit condition) is not a reassurance.
    const commandsHere = findEscalationSpans(chunkText);
    const beforeCommand = firstCommand >= 0 && (k < firstCommand || (k === firstCommand && commandsHere.length > 0 && rel < commandsHere[0].index));
    if (flags[k] || conditionBefore(chunkText, r.end - chunk.start, escalation, beforeCommand)) continue;
    const absent = objectWordsAbsentFromParent(r.object, parent);
    if (!absent.length) continue; // the parent said X: main's verdict stands
    let start = chunk.start;
    const end = chunk.end;
    if (commandsHere.length) {
      // Never remove a command: cut only the part after it, at a cut word.
      const cutText = truncateAfterCommand(chunkText, escalation, [{ index: rel, end: r.end - chunk.start }]);
      if (cutText === chunkText) continue;
      const tail = chunkText.slice(cutText.length).replace(/^[\s,;:—–-]+/u, "");
      const offset = chunkText.length - tail.length;
      if (!onlyReassurance(tail, rel - offset, r.end - chunk.start - offset, r.objectEnd - chunk.start - offset)) return segment;
      start = chunk.start + cutText.length;
    } else if (!onlyReassurance(chunkText, rel, r.end - chunk.start, r.objectEnd - chunk.start)) {
      // Another clause shares the chunk: main's verdict stands for the whole sentence.
      return segment;
    }
    spans.push({ start, end, object: r.object, absent });
  }
  if (!spans.length) return segment;
  // Rebuild the body: drop every span; then drop filler left around it.
  type Part = { text: string; sep: string; removed: boolean };
  const parts: Part[] = [];
  const cuts = spans.sort((a, b) => a.start - b.start);
  for (let k = 0; k < chunks.length; k++) {
    const c = chunks[k];
    const sep = k === 0 ? "" : body.slice(chunks[k - 1].end, c.start);
    let bits: { start: number; end: number; removed: boolean }[] = [{ start: c.start, end: c.end, removed: false }];
    for (const s of cuts) {
      if (s.end <= c.start || s.start >= c.end) continue;
      bits = bits.flatMap((p) => {
        if (p.removed || s.end <= p.start || s.start >= p.end) return [p];
        const out = [];
        if (s.start > p.start) out.push({ start: p.start, end: s.start, removed: false });
        out.push({ start: Math.max(s.start, p.start), end: Math.min(s.end, p.end), removed: true });
        if (s.end < p.end) out.push({ start: s.end, end: p.end, removed: false });
        return out;
      });
    }
    bits.forEach((p, i) => parts.push({ text: body.slice(p.start, p.end), sep: i === 0 ? sep : " ", removed: p.removed }));
  }
  for (const s of cuts) {
    removed.push({ text: body.slice(s.start, s.end).trim(), object: s.object, absentWords: s.absent });
    pieces.push({ text: body.slice(s.start, s.end).trim(), kind: "reassurance" });
  }
  // Filler next to a removed reassurance goes with it (a lead-in before, an attribution or list tail after).
  for (let grew = true; grew;) {
    grew = false;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].removed) continue;
      const prevRemoved = i > 0 && parts[i - 1].removed;
      const nextRemoved = i + 1 < parts.length && parts[i + 1].removed;
      if ((prevRemoved || nextRemoved) && isFiller(parts[i].text)) { parts[i].removed = true; grew = true; pieces.push({ text: parts[i].text.trim(), kind: "filler" }); }
    }
  }
  const kept: KeptPart[] = [];
  parts.forEach((p, i) => {
    if (!p.removed && p.text.trim() !== "") kept.push({ text: p.text, sep: kept.length ? (p.sep.trim() ? p.sep : " ") : "", afterRemoved: i > 0 && parts[i - 1].removed });
  });
  if (!kept.length) return "";
  return assemble(kept, tail, parts[parts.length - 1].removed);
}

/* ── the wrapper ─────────────────────────────────────────────────────────── */

export type HandoffFloorTrace = {
  /** main's clause unit, its verdict, and what the wrapper made of it */
  clauses: { text: string; main: "kept" | "dropped"; restored: boolean; out: string }[];
  /** rule (b) removals with the object words the parent's text never contains */
  removedReassurances: RemovedReassurance[];
  /** every piece rule (b) took out, reassurance or the filler beside it */
  removedPieces: RemovedPiece[];
  output: string;
};

/** The wrapper with its reasons (the property test reads this). */
export function explainHandoffFloor(text: string, opts: HandoffFloorOptions = {}): HandoffFloorTrace {
  const base = withoutHandoffFindings(text, opts);
  const segments = handoffClauses(text);
  const clauses = segments.map((s) => ({ text: s, main: (statesUnreportedFinding(s, opts) ? "dropped" : "kept") as "kept" | "dropped", restored: false, out: "" }));
  // (a) restore escalation lines main dropped. Main's clause unit breaks at a
  // title's full stop ("talk with Dr. | Levi."), so clauses joined by one are
  // read as one line.
  const units: number[][] = [];
  clauses.forEach((c, i) => (i > 0 && ABBREVIATION_END.test(clauses[i - 1].text) ? units[units.length - 1].push(i) : units.push([i])));
  for (const unit of units) {
    const members = unit.map((i) => clauses[i]);
    for (const c of members) if (c.main === "kept") c.out = c.text;
    if (members.every((c) => c.main === "kept")) continue;
    const line = members.map((c) => c.text).join("");
    const restored = hasCommand(line) ? restoreEscalation(line, opts) : null;
    if (!restored) continue;
    members.forEach((c, k) => { c.restored = true; c.out = k === 0 ? restored : ""; });
  }
  // (a) a condition fragment main split from its command: "If …; call …" / "Call …; if …".
  const STARTS_WITH_CONDITION = new RegExp(String.raw`^\s*(?:${CONDITION_ALWAYS.source}|when\b|whenever\b|where\b|wherever\b|כש(?=\p{L})|כאשר(?!\p{L}))`, "iu");
  for (let i = 0; i < clauses.length; i++) {
    const c = clauses[i];
    if (c.main === "kept" || c.restored) continue;
    const { body, tail } = splitTail(c.text);
    if (!STARTS_WITH_CONDITION.test(body) || chunksOf(body).length !== 1 || unreportedDiagnosis(body, opts)) continue;
    const next = clauses[i + 1];
    const prev = clauses[i - 1];
    const leadsInto = !!next && (next.main === "kept" || next.restored) && carriesEscalation(next.out) && !/^[.!?。]/u.test(tail);
    const follows = !!prev && (prev.main === "kept" || prev.restored) && carriesEscalation(prev.out) && /;\s*$/u.test(prev.text);
    if (leadsInto || follows) { c.out = c.text; c.restored = true; }
  }
  // (b) remove asserted reassurances whose object the parent never said.
  const removedReassurances: RemovedReassurance[] = [];
  const removedPieces: RemovedPiece[] = [];
  for (const unit of units) {
    const members = unit.map((i) => clauses[i]).filter((c) => c.main === "kept" || c.restored);
    if (!members.length) continue;
    const line = members.map((c) => c.out).join("");
    const next = removeReassurances(line, opts, removedReassurances, removedPieces);
    if (next !== line) members.forEach((c, k) => { c.out = k === 0 ? next : ""; });
  }
  const changed = clauses.some((c) => c.restored) || removedReassurances.length > 0;
  const output = changed ? clauses.filter((c) => c.main === "kept" || c.restored).map((c) => c.out).join("").trim() : base;
  return { clauses, removedReassurances, removedPieces, output };
}

/** B-ASKJB-44 — main's handoff floor plus the two monotonic rules; untouched notes are main's output byte-for-byte. */
export function handoffFloor(text: string, opts: HandoffFloorOptions = {}): string {
  return explainHandoffFloor(text, opts).output;
}

/** The wrapper over a structured School Brief / handoff draft (same contract as
 *  `scrubHandoffBriefFindings`: the escalation field is never touched; emptied
 *  list items go; mutates in place; returns how many fields changed). */
export function scrubHandoffBrief(brief: Record<string, unknown>, opts: HandoffFloorOptions = {}): number {
  let changed = 0;
  for (const [key, value] of Object.entries(brief)) {
    if (HANDOFF_BRIEF_UNSCRUBBED_FIELDS.includes(key)) continue;
    if (typeof value === "string") {
      const next = handoffFloor(value, opts);
      if (next !== value) { brief[key] = next; changed++; }
    } else if (Array.isArray(value)) {
      const next = value
        .map((item) => (typeof item === "string" ? handoffFloor(item, opts) : item))
        .filter((item) => typeof item !== "string" || item.trim() !== "");
      if (next.length !== value.length || next.some((item, i) => item !== value[i])) { brief[key] = next; changed++; }
    }
  }
  return changed;
}
