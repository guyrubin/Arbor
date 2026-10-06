/**
 * B-GROWTH-36 — "Things {name} said": the say-back, by age and by language.
 *
 * Pure and deterministic (zero model calls). Given ONE thing the child said,
 * the languages on the child's profile and the child's age in months
 * (lib/age/forChild `ageMonthsOf` — this module does no age arithmetic of its
 * own beyond reading the band below), it returns the line the parent can say
 * back, as i18n keys:
 *
 *   · Age decides the object: under 3 → words (the existing ledger);
 *     3 to 5 → quotes, "and then what?"; 6 to 8 → quotes, "what else?" and
 *     the teacher as the second observer ("Act now if…" lines, drafts).
 *   · The language decides the say-back. When the profile marks a language
 *     "in transition" ("English (Transition)") and the quote is in a language
 *     other than the one the family is keeping (the "(Native)" one, else the
 *     first listed — the Language Lab's home language), the line is in the
 *     KEPT language: "He said it in English. Say it back in Hebrew and add
 *     one: '…'". A quote already in the kept language gets no say-back in a
 *     family in transition (it is kept as a quote). Every other family gets
 *     "say it back and add one" in the language the child used.
 *   · The words to say come from reviewed templates per quote SHAPE (a single
 *     word → the word + one describing word; a sentence → "and then what?" /
 *     "what else?"; a question → "what do you think?"). Never a model, never a
 *     translation of the child's words.
 *
 * CLINICAL FIREWALL: nothing here counts, scores or compares the child. The
 * templates and the age bands are a clinical-review line (REVIEW-SHEET.md).
 */
import { knownLanguage, type KnownLanguage } from "../languageName";

export type QuoteShape = "word" | "question" | "sentence";
/** words: under 36 months · talk: 36–71 · school: 72 and over. */
export type TalkBand = "words" | "talk" | "school";

/** The band from the months `ageMonthsOf` returned (the ONE age read). */
export function talkBandForMonths(months: number): TalkBand {
  if (!(months >= 36)) return "words";
  return months >= 72 ? "school" : "talk";
}

const QUESTION_START_EN = /^(why|what|where|when|who|how|can|could|is|are|do|does|did|will|would)\b/i;
const QUESTION_START_HE = /^(למה|מה|איפה|מתי|מי|איך|האם|כמה|מדוע)(?=\s|$|[?])/;

/** The shape of what the child said (EN + HE; other scripts by punctuation). */
export function quoteShape(text: string): QuoteShape {
  const s = (text ?? "").replace(/[“”"„‟«»]/g, "").trim();
  if (/[?？؟]\s*$/.test(s) || QUESTION_START_EN.test(s) || QUESTION_START_HE.test(s)) return "question";
  const words = s.split(/\s+/).filter(Boolean);
  return words.length <= 1 ? "word" : "sentence";
}

/** "English (Transition)" → "English"; free text stays as written. */
export function plainLanguage(raw: string): string {
  return (raw ?? "").trim().replace(/\s*\([^)]*\)\s*$/, "").trim();
}
function levelOf(raw: string): string {
  const m = /\(([^)]+)\)\s*$/.exec((raw ?? "").trim());
  return m ? m[1].trim().toLowerCase() : "";
}

/** The profile's languages, cleaned (empty entries dropped). */
function cleaned(languages: readonly string[] | null | undefined): string[] {
  return (languages ?? []).map((l) => (l ?? "").trim()).filter(Boolean);
}

/** The language the family is keeping: the "(Native)" one, else the first listed. */
export function keptLanguage(languages: readonly string[] | null | undefined): string | null {
  const list = cleaned(languages);
  const native = list.find((l) => levelOf(l) === "native");
  const pick = native ?? list[0];
  return pick ? plainLanguage(pick) : null;
}

/** True when the profile records a language in transition (2+ languages, one marked "Transition"). */
export function hasTransition(languages: readonly string[] | null | undefined): boolean {
  const list = cleaned(languages);
  return list.length >= 2 && list.some((l) => levelOf(l) === "transition");
}

const SCRIPT: ReadonlyArray<[KnownLanguage, RegExp]> = [
  ["hebrew", /[א-ת]/],
  ["arabic", /[؀-ۿ]/],
  ["russian", /[Ѐ-ӿ]/],
];

const same = (a: string, b: string): boolean => {
  const ka = knownLanguage(plainLanguage(a));
  const kb = knownLanguage(plainLanguage(b));
  if (ka && kb) return ka === kb;
  return plainLanguage(a).toLowerCase() === plainLanguage(b).toLowerCase();
};

/**
 * The language a quote is in, as one of the PROFILE's language names (plain).
 * The script decides Hebrew / Arabic / Russian; Latin letters go to the first
 * profile language written in Latin letters (English when the profile has it).
 * Null when nothing on the profile matches (the caller keeps the parent's pick).
 */
export function quoteLanguage(text: string, languages: readonly string[] | null | undefined): string | null {
  const list = cleaned(languages).map(plainLanguage);
  const s = text ?? "";
  for (const [lang, re] of SCRIPT) {
    if (re.test(s)) return list.find((l) => knownLanguage(l) === lang) ?? null;
  }
  if (!/[A-Za-z]/.test(s)) return null;
  const latin = list.filter((l) => {
    const k = knownLanguage(l);
    return k === null || k === "english" || k === "french";
  });
  return latin.find((l) => knownLanguage(l) === "english") ?? latin[0] ?? null;
}

/** The two locales the templates are written in. */
export type TemplateLocale = "en" | "he";
function templateLocale(language: string): TemplateLocale | null {
  const k = knownLanguage(plainLanguage(language));
  return k === "english" ? "en" : k === "hebrew" ? "he" : null;
}

export interface SayBack {
  /** cross: answer in the kept language · same: say it back in the child's language. */
  mode: "cross" | "same";
  shape: QuoteShape;
  band: TalkBand;
  /** Plain profile names (resolve for display with lib/languageName). */
  said: string;
  /** The language the line is in (the kept one on cross, the said one on same). */
  answerIn: string;
  /** The small sans line above the words to say (UI locale; HE gendered by the caller). */
  headKey: string;
  /** The words to say (in `lineLocale`, NOT the UI locale), or null when no template exists for that language. */
  lineKey: string | null;
  lineLocale: TemplateLocale | null;
  /** `{word}` for the word templates — the child's own word, verbatim. */
  lineVars: Record<string, string>;
  /** The honest line under it: what the technique is for. */
  whyKey: string;
}

/**
 * The say-back for one quote, or null (empty text, or a quote already in the
 * kept language of a family in transition — it is kept as a quote).
 */
export function sayBackFor(input: {
  text: string;
  /** The language the parent saved it under (a profile name); detected when absent. */
  language?: string | null;
  languages: readonly string[] | null | undefined;
  months: number;
}): SayBack | null {
  const text = (input.text ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  const band = talkBandForMonths(input.months);
  const shape = quoteShape(text);
  const said = plainLanguage(input.language || quoteLanguage(text, input.languages) || keptLanguage(input.languages) || "");
  const kept = keptLanguage(input.languages);
  const cross = !!kept && !!said && hasTransition(input.languages) && !same(said, kept);
  if (hasTransition(input.languages) && kept && said && same(said, kept)) return null;

  const answerIn = cross ? (kept as string) : said;
  const lineLocale = answerIn ? templateLocale(answerIn) : null;
  const word = text.replace(/[.!?,;:“”"„‟«»]+/g, "").trim();
  let lineKey: string;
  const lineVars: Record<string, string> = {};
  if (shape === "question") {
    lineKey = "elev.words.sayBack.line.question";
  } else if (shape === "word") {
    if (cross) lineKey = "elev.words.sayBack.line.word.cross";
    else {
      lineKey = "elev.words.sayBack.line.word.same";
      lineVars.word = word;
    }
  } else if (band === "words") {
    if (cross) lineKey = "elev.words.sayBack.line.word.cross";
    else {
      lineKey = "elev.words.sayBack.line.echo";
      lineVars.word = word;
    }
  } else {
    lineKey = band === "school" ? "elev.words.sayBack.line.sentence.school" : "elev.words.sayBack.line.sentence.talk";
  }
  return {
    mode: cross ? "cross" : "same",
    shape,
    band,
    said,
    answerIn,
    headKey: cross ? (lineLocale ? "elev.words.sayBack.head.cross" : "elev.words.sayBack.head.crossOther") : lineLocale ? "elev.words.sayBack.head.same" : "elev.words.sayBack.head.sameOther",
    lineKey: lineLocale ? lineKey : null,
    lineLocale,
    lineVars,
    whyKey: cross ? "elev.words.sayBack.why.cross" : "elev.words.sayBack.why.same",
  };
}

/** The "Act now if…" line by age (a DRAFT — REVIEW-SHEET.md): under 3 the
 *  words; 3 to 5 "hard for strangers to understand"; from 5 "the teacher
 *  raises it". */
export function actNowKey(months: number): string {
  if (!(months >= 36)) return "elev.words.actNow.words";
  return months >= 60 ? "elev.words.actNow.school" : "elev.words.actNow.talk";
}
