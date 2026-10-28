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
const WORRY = /^(?:i'?m (?:a bit |really |so )?(?:worried|concerned|not sure)|i worry|we(?:'re| are) (?:worried|concerned|not sure)|we worry|worried (?:about|that)|אני (?:קצת |מאוד )?(?:דואג|דואגת|מודאג|מודאגת|לא בטוח|לא בטוחה)|אנחנו (?:דואגים|מודאגים|לא בטוחים)|מדאיג אותי|מדאיג אותנו)/i;

const firstWord = (s: string) => (s.trim().split(/\s+/)[0] ?? "").toLowerCase().replace(/^[^\p{L}]+|[^\p{L}']+$/gu, "");
const isOpener = (w: string) => EN_OPENERS.includes(w) || HE_OPENERS.includes(w) || HE_OPENERS.some((o) => w === `ו${o}`);
const isQuestion = (s: string) => /[?؟]\s*$/.test(s) || isOpener(firstWord(s));

/** Question words that start a new question wherever they fall in a run-on. */
const EN_WH = ["what", "how", "why", "when", "where", "who", "which"];
const HE_WH = ["מה", "איך", "למה", "מדוע", "מתי", "איפה", "מי", "האם", "כמה"];
/** An auxiliary opens a new question only before a subject ("…take is it normal…"). */
const SUBJECTS = ["it", "he", "she", "they", "we", "there", "this", "that", "i", "you", "her", "his"];
const bareWord = (w: string) => w.toLowerCase().replace(/^[^\p{L}]+|[^\p{L}']+$/gu, "");

/** Cut a punctuation-free run-on (a spoken transcript) before each new question. */
function cutRunOn(chunk: string): string[] {
  const words = chunk.trim().split(/\s+/).filter(Boolean);
  const out: string[][] = [];
  let cur: string[] = [];
  words.forEach((w, i) => {
    const bare = bareWord(w);
    const next = bareWord(words[i + 1] ?? "");
    const wh = EN_WH.includes(bare) || HE_WH.includes(bare);
    const aux = EN_OPENERS.includes(bare) && !wh && SUBJECTS.includes(next);
    if (cur.length >= MIN_WORDS_BEFORE_CUT && (wh || (aux && cur.length >= MIN_WORDS_BEFORE_CUT + 1)) && isOpener(firstWord(cur.join(" ")))) {
      out.push(cur);
      cur = [];
    }
    cur.push(w);
  });
  if (cur.length) out.push(cur);
  return out.map((ws) => ws.join(" "));
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
    const pieces = /[.?!؟]\s*$/.test(raw) ? [raw] : cutRunOn(raw);
    for (const piece of pieces) {
      let s = piece.trim().replace(/^[,;:\-–—\s]+/, "").replace(/[.\s]+$/, "").trim();
      if (!s) continue;
      const question = isQuestion(s);
      if (!question && !WORRY.test(s)) continue;
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

/** The numbered lines the visit page reviews ("1. …"), in the page's digits. */
export function numberedQuestions(questions: readonly string[]): string[] {
  return questions.map((q, i) => `${i + 1}. ${q}`);
}
