/**
 * B-VOICE-03 (agent half) — before a visit, the parent says out loud what
 * worries them and what they want to leave with; this turns those spoken words
 * into the numbered "Questions I want to ask" the packet already carries
 * (consult/packet section `questions`, fed by the `apptQuestions` collection).
 *
 * DETERMINISTIC and in the parent's own words: a question the parent asked is
 * kept as they said it (a missing "?" is added), and a worry they voiced
 * ("I'm worried that…", "אני דואגת ש…") is kept verbatim for them to edit into
 * a question. Nothing is invented, inferred or rephrased here — rephrasing a
 * worry into a question is the model's job, behind a new rehearsal prompt and
 * its live eval (Guy's half). Spoken transcripts often carry no punctuation, so
 * a run-on is also cut at each question opener once the current question has
 * a few words. The visit page shows the result for editing, and only the
 * parent's Confirm writes it (components/sections/Appointments).
 *
 * Pure: no React, no I/O. EN + HE.
 */

/** The packet's own cap on prepared questions (consult/packet `questions.slice(0, 10)`). */
export const REHEARSAL_MAX_QUESTIONS = 10;
const MAX_LEN = 200;
/** A run-on is cut at an opener only once the question so far has this many words. */
const MIN_WORDS_BEFORE_CUT = 3;

const EN_OPENERS = ["what", "how", "why", "when", "where", "who", "which", "should", "can", "could", "would", "will", "is", "are", "does", "do", "did", "may", "might"];
const HE_OPENERS = ["מה", "איך", "למה", "מדוע", "מתי", "איפה", "מי", "האם", "כמה", "אפשר", "כדאי", "צריך", "צריכה", "צריכים"];
/** Where a voiced worry STARTS (the parent speaking about themselves). */
const WORRY_START = /^(?:i(?:[’']?m| am) (?:a bit |really |so |very )?(?:worried|concerned|not sure|scared)|i worry|we(?:[’']re| are) (?:a bit |really |so |very )?(?:worried|concerned|not sure)|we worry|it worries (?:me|us)|what worries (?:me|us)|my (?:big |biggest )?(?:worry|concern) is|ו?אני (?:קצת |מאוד |כל כך )?(?:דואג|דואגת|מודאג|מודאגת|חושש|חוששת|לא בטוח|לא בטוחה)|ו?אנחנו (?:דואגים|מודאגים|חוששים|לא בטוחים)|מדאיג אותי|מדאיג אותנו|מה שמדאיג אותי)/i;
/** A worry the parent voiced (kept verbatim for them to edit into a question). */
const WORRY = new RegExp(`${WORRY_START.source.slice(0, -1)}|worried (?:about|that))`, "i");

const firstWord = (s: string) => (s.trim().split(/\s+/)[0] ?? "").toLowerCase().replace(/^[^\p{L}]+|[^\p{L}']+$/gu, "");
const isOpener = (w: string) => EN_OPENERS.includes(w) || HE_OPENERS.includes(w) || HE_OPENERS.some((o) => w === `ו${o}`);
const isQuestion = (s: string) => /[?؟]\s*$/.test(s) || isOpener(firstWord(s));

/** Question words that can start a new question inside a run-on. */
const EN_WH = ["what", "how", "why", "when", "where", "who", "which"];
const HE_WH = ["מה", "איך", "למה", "מדוע", "מתי", "איפה", "מי", "האם", "כמה"];
const EN_AUX = ["should", "can", "could", "would", "will", "is", "are", "was", "were", "does", "do", "did", "may", "might", "must", "has", "have"];
/** An auxiliary opens a new question only before a subject ("…take is it normal…"). */
const SUBJECTS = ["it", "he", "she", "they", "we", "there", "this", "that", "i", "you", "her", "his"];
const bareWord = (w: string) => w.toLowerCase().replace(/^[^\p{L}]+|[^\p{L}'’]+$/gu, "");

/** EN: a wh-word opens a NEW question only when the question's own auxiliary
 *  follows it ("what should we", "how long does it", "how many words should
 *  he") — a wh-word followed by its subject is a clause of the sentence it is
 *  in ("…doesn't answer when we call his name"), never a question of its own. */
function enWhOpensQuestion(words: readonly string[], i: number): boolean {
  if (!EN_WH.includes(bareWord(words[i]))) return false;
  for (let j = i + 1; j <= i + 3 && j < words.length; j++) {
    const w = bareWord(words[j]);
    if (SUBJECTS.includes(w)) return false;
    if (EN_AUX.includes(w)) return SUBJECTS.includes(bareWord(words[j + 1] ?? ""));
  }
  return false;
}

/** Cut a punctuation-free run-on (a spoken transcript) before each new
 *  question and before each voiced worry. */
function cutRunOn(chunk: string): string[] {
  const words = chunk.trim().split(/\s+/).filter(Boolean);
  const out: string[][] = [];
  let cur: string[] = [];
  words.forEach((w, i) => {
    const bare = bareWord(w);
    const next = bareWord(words[i + 1] ?? "");
    const rest = words.slice(i).join(" ").toLowerCase();
    const curIsQuestion = isOpener(firstWord(cur.join(" ")));
    // A worry starts its own line, wherever it falls ("…usually take I'm worried that…").
    const worry = cur.length >= 1 && WORRY_START.test(rest);
    const enWh = cur.length >= MIN_WORDS_BEFORE_CUT && enWhOpensQuestion(words, i);
    // HE has no auxiliary to read: a question word cuts only inside a question
    // (never inside a worry: "אני דואגת שהוא לא יודע מה לעשות").
    const heWh = HE_WH.includes(bare) && cur.length >= MIN_WORDS_BEFORE_CUT && curIsQuestion;
    const aux = EN_AUX.includes(bare) && SUBJECTS.includes(next) && cur.length >= MIN_WORDS_BEFORE_CUT + 1 && curIsQuestion;
    if (worry || enWh || heWh || aux) {
      out.push(cur);
      cur = [];
    }
    cur.push(w);
  });
  if (cur.length) out.push(cur);
  return out.map((ws) => ws.join(" "));
}

/** A closed sentence is one question, but a worry inside it still starts its own line. */
function cutAtWorry(sentence: string): string[] {
  const words = sentence.trim().split(/\s+/).filter(Boolean);
  const out: string[][] = [];
  let cur: string[] = [];
  words.forEach((w, i) => {
    if (cur.length >= 1 && WORRY_START.test(words.slice(i).join(" ").toLowerCase())) { out.push(cur); cur = []; }
    cur.push(w);
  });
  if (cur.length) out.push(cur);
  return out.map((ws) => ws.join(" "));
}

/** Spoken fillers before the words that matter ("so um what should we…"). */
const FILLERS = ["so", "um", "uh", "and", "but", "also", "okay", "ok", "well", "אז", "אה", "אמ", "אממ", "וגם", "גם"];
function withoutLeadingFiller(s: string): string {
  const words = s.split(/\s+/);
  let i = 0;
  while (i < words.length - 1 && FILLERS.includes(bareWord(words[i]))) i++;
  return words.slice(i).join(" ");
}

/** The parent's spoken rehearsal → their questions (and voiced worries), in order, deduped, capped. */
export function rehearsalQuestions(transcript: string): string[] {
  const text = (transcript ?? "").replace(/\s+/g, " ").trim();
  if (!text) return [];
  // Sentences, keeping each one's own terminator.
  const sentences = text.match(/[^.?!؟\n]+[.?!؟]*/g) ?? [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of sentences) {
    // A sentence the speaker (or the recognizer) closed is one question; only
    // an unclosed run-on is cut.
    const pieces = /[.?!؟]\s*$/.test(raw) ? cutAtWorry(raw) : cutRunOn(raw);
    for (const piece of pieces) {
      let s = withoutLeadingFiller(piece.trim().replace(/^[,;:\-–—\s]+/, "").replace(/[.\s]+$/, "").trim());
      if (!s) continue;
      // A worry is kept as the parent said it — never turned into a question
      // here, even when it opens with "what" ("what worries me is…").
      const worry = WORRY.test(s);
      const question = /[?؟]\s*$/.test(s) || (isQuestion(s) && !WORRY_START.test(s.toLowerCase()));
      if (!question && !worry) continue;
      if (question && !/[?؟]$/.test(s)) s = `${s}?`;
      s = s.slice(0, MAX_LEN).trim();
      const key = s.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
      if (out.length >= REHEARSAL_MAX_QUESTIONS) return out;
    }
  }
  return out;
}

/** Rows for a rehearsed question's field: the whole question shows (≈ 36
 *  characters a line at 390 px), one to five lines. */
export function rehearsalRows(text: string): number {
  return Math.min(5, Math.max(1, Math.ceil((text ?? "").length / 36)));
}

/** The numbered lines the visit page reviews ("1. …"), in the page's digits. */
export function numberedQuestions(questions: readonly string[]): string[] {
  return questions.map((q, i) => `${i + 1}. ${q}`);
}
