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
const WORRY_START = /^(?:i(?:[’']?m| am) (?:a bit |really |so |very )?(?:worried|concerned|not sure|scared)|i worry|we(?:[’']re| are) (?:a bit |really |so |very )?(?:worried|concerned|not sure)|we worry|it worries (?:me|us)|what worries (?:me|us)|(?:my|our) (?:big |biggest |main )?(?:worry|concern)(?: right now| now)? is|ו?אני (?:קצת |מאוד |כל כך )?(?:דואג|דואגת|מודאג|מודאגת|חושש|חוששת|לא בטוח|לא בטוחה)|ו?אנחנו (?:דואגים|מודאגים|חוששים|לא בטוחים)|מדאיג אותי|מדאיג אותנו|מה שמדאיג אותי)/i;
/** A worry the parent voiced (kept verbatim for them to edit into a question). */
const WORRY = new RegExp(`${WORRY_START.source.slice(0, -1)}|worried (?:about|that))`, "i");

const firstWord = (s: string) => (s.trim().split(/\s+/)[0] ?? "").toLowerCase().replace(/^[^\p{L}]+|[^\p{L}']+$/gu, "");
const isOpener = (w: string) => EN_OPENERS.includes(w) || HE_OPENERS.includes(w) || HE_OPENERS.some((o) => w === `ו${o}`);
const isQuestion = (s: string) => /[?؟]\s*$/.test(s) || isOpener(firstWord(s));

/** Question words that can start a new question inside a run-on. */
const EN_WH = ["what", "how", "why", "when", "where", "who", "which"];
const HE_WH = ["מה", "איך", "למה", "מדוע", "מתי", "איפה", "מי", "האם", "כמה"];
const EN_AUX = ["should", "can", "could", "would", "will", "is", "are", "was", "were", "does", "do", "did", "may", "might", "must", "has", "have"];
/** An auxiliary opens a new question only before a pronoun subject
 *  ("…take is it normal…", "…understands us should we test…", "is there…"). */
const PRONOUN_SUBJECTS = ["it", "he", "she", "they", "we", "there", "i", "you"];
/** After a wh-word AND its auxiliary, a noun phrase is a subject too
 *  ("how many words should a three year old say"). */
const WH_SUBJECTS = [...PRONOUN_SUBJECTS, "this", "that", "a", "an", "the", "my", "our", "your", "his", "her", "their"];
/** "my worry is it…" / "my biggest worry right now is it…": the worry's own
 *  copula (its first is/was), never a question. */
const WORRY_NOUN = /^(?:worry|concern|problem|thing|issue|fear|question)$/;
const COPULAS = ["is", "are", "was", "were"];
/** HE: a question word opens a new question before a modal ("מה אפשר לנסות");
 *  "מה לעשות" inside a sentence stays where it is. */
const HE_MODALS = ["אפשר", "כדאי", "צריך", "צריכה", "צריכים", "יכול", "יכולה", "יכולים", "נוכל"];
const bareWord = (w: string) => w.toLowerCase().replace(/^[^\p{L}]+|[^\p{L}'’]+$/gu, "");

/** EN: a wh-word opens a NEW question only when the question's own auxiliary
 *  follows it, then a subject ("what should we", "how long does it", "how many
 *  words should a three year old") — a wh-word followed by its pronoun subject
 *  is a clause of the sentence it is in ("…doesn't answer when we call his
 *  name"), never a question of its own. */
function enWhOpensQuestion(words: readonly string[], i: number): boolean {
  if (!EN_WH.includes(bareWord(words[i]))) return false;
  for (let j = i + 1; j <= i + 3 && j < words.length; j++) {
    const w = bareWord(words[j]);
    if (PRONOUN_SUBJECTS.includes(w)) return false;
    if (EN_AUX.includes(w)) return WH_SUBJECTS.includes(bareWord(words[j + 1] ?? ""));
  }
  return false;
}

/** Cut a punctuation-free run-on (a spoken transcript) before each new
 *  question and before each voiced worry — a question after a worry gets its
 *  own line too (critic r2). */
function cutRunOn(chunk: string): string[] {
  const words = chunk.trim().split(/\s+/).filter(Boolean);
  const out: string[][] = [];
  let cur: string[] = [];
  words.forEach((w, i) => {
    const bare = bareWord(w);
    const next = bareWord(words[i + 1] ?? "");
    const prev = bareWord(words[i - 1] ?? "");
    const rest = words.slice(i).join(" ").toLowerCase();
    const curText = cur.join(" ");
    const curIsQuestion = isOpener(firstWord(curText));
    const curIsWorry = WORRY.test(withoutLeadingFiller(curText).toLowerCase());
    // A worry starts its own line, wherever it falls ("…usually take I'm worried that…").
    const worry = cur.length >= 1 && WORRY_START.test(rest);
    // EN: a wh-word with its own auxiliary and subject, inside a question or a worry.
    const enWh = cur.length >= MIN_WORDS_BEFORE_CUT && enWhOpensQuestion(words, i);
    // EN: an auxiliary before a pronoun subject, inside a question or a worry —
    // never the worry's own copula ("my worry is it…").
    const worryCopula = curIsWorry && COPULAS.includes(bare) && /^(?:my|our|the|what worries)\b/.test(curText.toLowerCase()) && !cur.some((x) => COPULAS.includes(bareWord(x)));
    const aux = EN_AUX.includes(bare) && PRONOUN_SUBJECTS.includes(next) && cur.length >= MIN_WORDS_BEFORE_CUT + 1
      && (curIsQuestion || curIsWorry) && !WORRY_NOUN.test(prev) && !worryCopula;
    // HE has no auxiliary to read: any question word cuts inside a question;
    // inside a worry (or any line) only "האם", or a question word before a
    // modal ("מה אפשר", "מה כדאי") — "אני דואגת שהוא לא יודע מה לעשות" stays.
    const heWh = HE_WH.includes(bare) && cur.length >= MIN_WORDS_BEFORE_CUT && curIsQuestion;
    const heOpens = cur.length >= 2 && (bare === "האם" || bare === "והאם" || (HE_WH.includes(bare) && HE_MODALS.includes(next)));
    if (worry || enWh || aux || heWh || heOpens) {
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
/** A connector left dangling where the next line was cut off
 *  ("when should we start toilet training and | I'm worried…"). */
const TRAILING = ["and", "so", "but", "or", "also", "um", "uh", "then", "אז", "וגם", "גם", "אה"];
function withoutTrailingFiller(s: string): string {
  const words = s.split(/\s+/);
  let n = words.length;
  while (n > 1 && TRAILING.includes(bareWord(words[n - 1]))) n--;
  return words.slice(0, n).join(" ");
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
      let s = withoutTrailingFiller(withoutLeadingFiller(piece.trim().replace(/^[,;:\-–—\s]+/, "").replace(/[.\s]+$/, "").trim()));
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

/** Rows for a rehearsed question's field before layout (≈ 28 characters a
 *  line at 390 px, Hebrew included), one to five lines; the page then fits
 *  the field to its text. */
export function rehearsalRows(text: string): number {
  return Math.min(5, Math.max(1, Math.ceil((text ?? "").length / 28)));
}

/** The numbered lines the visit page reviews ("1. …"), in the page's digits. */
export function numberedQuestions(questions: readonly string[]): string[] {
  return questions.map((q, i) => `${i + 1}. ${q}`);
}
