/**
 * lib/library/manuscriptLint — B-BOOK-33 (extends B-BOOK-16; kid-books-
 * standard §2, §3 "Automatic fail", §4, §7): the full rubric lint of a
 * canonical book's manuscript, as pure rules over the authored text, each
 * returning the lines that break it. A book that the lint rejects never
 * reaches the critic; the critic (lib/library/manuscriptCritic) scores what
 * a script cannot. Every rule has a seeded failure in manuscriptLint.test.ts
 * (on the proof) and in manuscriptRegistry.test.ts (on every registry book,
 * against AUTOMATIC_RULES); the proof's v3 text ("Five Smooth Stones")
 * passes. The quoted per-path report: lib/library/manuscriptReport.
 *
 * Rules (the standard's automatic fails a script can see, plus its caps):
 *   parity       EN + HE-m + HE-f on every line, Hebrew in Hebrew, NFC
 *   words        words per page (5–7: EN ≤ 40, HE ≤ 34; 3–4: 25 / 21), the
 *                echo, frame, after-repair and tap lines included
 *   sentence     ≤ 12 words a sentence (3–4: ≤ 8); a quoted verse ≤ 20
 *   preaching    a virtue noun (EN + HE, §3) or a stated moral in the child's text
 *   name         `{name}` only on the cover name line and the first and last
 *                pages' frame lines (CAST); `{hero}` on every story page
 *                (COMPANION); never a Hebrew prefix glued to either
 *   branch       two branches' first pages share text or picture state
 *   echo         the rejoin page and the last page carry one distinct echo
 *                per choice, each ≤ 12 words
 *   choice       3 typed choices (HARD / EASY / THIRD; 2 allowed for 3–4),
 *                labels ≤ 5 words EN, ≤ 6 HE
 *   dead-end     every branch is 1–2 pages, lengths differ by ≤ 1, it rejoins,
 *                only EASY / THIRD repair, a repair is never a second choice
 *   god          a plate brief that depicts God (a figure, face, hand or
 *                light-being) or a religious symbol
 *   divine-name  the Tetragrammaton anywhere in the text
 *   tts          parentheses or a dash aside in the child's text
 *   digit        a digit, a score or a count shown to the child
 *   shame        a shame word in the child's text
 *
 * The word lists are pipe-joined strings split at runtime (planLint's
 * pattern), so no literal reads as a Material Symbols glyph name to the
 * icon-font subset scanner.
 */
import { allBookPages, bookChoices, decisionOf, rejoinPageIdOf } from "./bookShape";
import { words, type LintHit } from "./plans/planLint";
import type { Book, BookLine, Page } from "./types";

export type { LintHit };
export type ManuscriptBand = "3-4" | "5-7";

export const PAGE_WORD_CAP: Record<ManuscriptBand, { en: number; he: number }> = { "3-4": { en: 25, he: 21 }, "5-7": { en: 40, he: 34 } };
export const SENTENCE_CAP: Record<ManuscriptBand, number> = { "3-4": 8, "5-7": 12 };
export const QUOTED_VERSE_CAP = 20;
export const ECHO_CAP = 12;

/** The standard §3 virtue nouns (and their inflections), never in the child's text. */
export const BOOK_VIRTUE_EN = "brave|bravery|braver|courage|courageous|responsible|honest|honesty|kind|kindness|good choice|wise|wisdom|obedient|jealous|good boy|good girl|bad boy|bad girl".split("|");
export const BOOK_VIRTUE_HE = "אמיץ|אמיצה|אומץ|אחראי|אחראית|כנה|בחירה טובה|חכם|חכמה|צייתן|צייתנית|קנאי|ילד טוב|ילדה טובה".split("|");
/** A moral stated by the narrator (§3: "the message is said plainly only in the parent panel"). */
const MORAL_EN = /\b(the (lesson|moral) (is|was)|that is why we|we should always|we must always|always remember|remember to always|the right thing to do)\b/i;
const MORAL_HE = /(המוסר הוא|השיעור הוא|תמיד צריך|תמיד חייבים|הדבר הנכון לעשות)/;
/** Shame (§3 automatic fail): a scold, an ashamed or mocked-and-broken hero. */
export const SHAME_EN = "ashamed|shame|shameful|naughty|stupid|silly boy|silly girl|bad boy|bad girl|cry baby|crybaby".split("|");
export const SHAME_HE = "מתבייש|מתביישת|בושה|טיפש|טיפשה|ילד רע|ילדה רעה|בכיין|בכיינית".split("|");
/** A score or a count shown to the child. */
const SCORE_EN = /\b(points?|score|scores|stars? earned|level up)\b/i;
const SCORE_HE = /(נקודות|ניקוד|ציון)/;
/** God depicted or a religious symbol in a plate brief (§1 "God is never depicted", §4 QC). */
const GOD_EN = /\b(god|the lord|divine|deity|angel|angels|halo|haloes|holy light|heavenly light|light-being|being of light|figure of light|hand (from|out of) the (sky|clouds|heavens)|face in the (sky|clouds)|cross|crucifix|crosses)\b/i;
const GOD_HE = /(אלוהים|מלאך|מלאכים|הילה|צלב|יד מן השמיים|פנים בשמיים)/;
const DIVINE_NAME = /(יהוה|יְהוָה|יְהֹוָה|\bYHWH\b|\bJehovah\b|\bYahweh\b)/i;
const DASH_ASIDE = /\s[—–]\s|[()]/;

const hasWordEn = (text: string, w: string) => new RegExp(`(?<![\\p{L}])${w.replace(/\s+/g, "\\s+")}(?![\\p{L}])`, "iu").test(text);
const hasWordHe = (text: string, w: string) => new RegExp(`(^|[^\\p{L}])(?:[והבלמשכ]{0,2})${w}(?![\\p{L}])`, "u").test(stripNiqqud(text));
const stripNiqqud = (t: string) => t.replace(/[֑-ׇ]/g, "");

type Variant = "en" | "he-m" | "he-f";
const variants = (line: BookLine): [Variant, string][] => [["en", line.en], ["he-m", line.he.m], ["he-f", line.he.f]];

/** Every line of a page the child reads (or hears), with its role. */
export function pageLines(page: Page): { role: "text" | "echo" | "closing" | "after" | "tap"; line: BookLine; key?: string }[] {
  return [
    { role: "text" as const, line: page.text },
    ...Object.entries(page.echo ?? {}).map(([key, line]) => ({ role: "echo" as const, line, key })),
    ...(page.closing ? [{ role: "closing" as const, line: page.closing }] : []),
    ...(page.repair ? [{ role: "after" as const, line: page.repair.textAfter }] : []),
    ...(page.repair?.items ?? []).flatMap((it) => (it.line ? [{ role: "tap" as const, line: it.line, key: it.id }] : [])),
  ];
}

/** A page's word count as the reader shows it: text + its longest echo + frame + after-repair + taps. */
function pageWords(page: Page, pick: (l: BookLine) => string): number {
  const echoMax = Math.max(0, ...Object.values(page.echo ?? {}).map((e) => words(pick(e))));
  const taps = (page.repair?.items ?? []).reduce((n, it) => n + (it.line ? words(pick(it.line)) : 0), 0);
  return words(pick(page.text)) + echoMax + (page.closing ? words(pick(page.closing)) : 0) + (page.repair ? words(pick(page.repair.textAfter)) : 0) + taps;
}

/** Sentences of a book line, exactly as written (name tokens kept, so a
 *  finding quotes the line itself): a sentence also ends at a closing quote
 *  after its stop (`…valley." David counts` is two), which planLint's
 *  splitter keeps as one. */
export function bookSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…]["”’»]?)\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** A sentence's words, a name token counting as one word. */
export const sentenceWords = (s: string) => words(s.replace(/\{(name|hero)\}/g, "Name"));

/** A sentence inside quotation marks (a quoted verse or a character's own words). */
const isQuoted = (s: string) => /^["“”„«»'‘’]|["“”„«»'‘’][.!?…]*$/.test(s.trim()) || /["“”„«]/.test(s);

export interface ManuscriptLintOptions {
  band?: ManuscriptBand;
  /** The plate briefs of the book's art round (§4), id → brief. */
  plateBriefs?: Readonly<Record<string, string>>;
  /** FROZEN per-page word-cap exceptions ({ pageId: count }), may only shrink. */
  enOver?: Readonly<Record<string, number>>;
  heOver?: Readonly<Record<string, number>>;
}

/**
 * FROZEN exceptions already pinned by books.test.ts (entries may only shrink):
 * the proof's p9 holds manuscript v2's 41 EN words exactly as written, and the
 * Abram fixture (not polished further, BR1) keeps two HE pages over the cap.
 */
export const FROZEN_WORD_EXCEPTIONS: Readonly<Record<string, { en?: Record<string, number>; he?: Record<string, number> }>> = {
  "five-smooth-stones": { en: { p9: 41 } },
  "abrams-long-road": { he: { p3: 35, p4: 36 } },
};

/** CAST or COMPANION, from the book's childRole line (BR2). */
export function bookMode(book: Pick<Book, "childRole">): "CAST" | "COMPANION" | "OTHER" {
  return /^\s*CAST\b/.test(book.childRole) ? "CAST" : /^\s*COMPANION\b/.test(book.childRole) ? "COMPANION" : "OTHER";
}

/** The band a canonical book is written for: 3–4 only when every band is ≤ 48 months. */
export function manuscriptBand(book: Pick<Book, "ageBands">): ManuscriptBand {
  return book.ageBands.length > 0 && book.ageBands.every((b) => b === "24m" || b === "30m" || b === "36m" || b === "48m") ? "3-4" : "5-7";
}

/** Every automatic-fail hit on a canonical book's manuscript (empty = the critic may score it). */
export function lintManuscript(book: Book, opts: ManuscriptLintOptions = {}): LintHit[] {
  const band = opts.band ?? manuscriptBand(book);
  const frozen = FROZEN_WORD_EXCEPTIONS[book.id] ?? {};
  const enOver = opts.enOver ?? frozen.en ?? {};
  const heOver = opts.heOver ?? frozen.he ?? {};
  const hits: LintHit[] = [];
  const hit = (rule: string, pageId: string, lang: Variant, text: string, detail?: string) => hits.push({ rule, pageId, lang, text, ...(detail ? { detail } : {}) });
  const mode = bookMode(book);
  const pages = allBookPages(book);
  const first = book.pages[0]?.id;
  const last = book.pages[book.pages.length - 1]?.id;

  // ── every line the child reads or hears ────────────────────────────────────
  const childLines: { pageId: string; role: string; line: BookLine }[] = [
    { pageId: "cover", role: "cover-line", line: { en: book.coverLine.en, he: { m: book.coverLine.he, f: book.coverLine.he } } },
    ...pages.flatMap((p) => pageLines(p).map((l) => ({ pageId: p.id, role: l.role, line: l.line }))),
    ...bookChoices(book).map((c) => ({ pageId: `${decisionOf(book)!.pageId}-choice-${c.id}`, role: "label", line: { en: c.label.en, he: { m: c.label.he, f: c.label.he } } })),
  ];
  for (const { pageId, role, line } of childLines) {
    for (const [lang, text] of variants(line)) {
      const isHe = lang !== "en";
      const plain = isHe ? stripNiqqud(text) : text;
      // parity
      if (!text.trim()) hit("parity", pageId, lang, text, "missing");
      else if (isHe && !/[֐-׿]/.test(text)) hit("parity", pageId, lang, text, "not Hebrew");
      else if (!isHe && /[֐-׿]/.test(text)) hit("parity", pageId, lang, text, "Hebrew in the EN line");
      if (isHe && text !== text.normalize("NFC")) hit("parity", pageId, lang, text, "not NFC");
      // sentence caps (a quoted verse may run to 20)
      if (role !== "label") {
        for (const s of bookSentences(text)) {
          const n = sentenceWords(s);
          const cap = isQuoted(s) ? Math.max(QUOTED_VERSE_CAP, SENTENCE_CAP[band]) : SENTENCE_CAP[band];
          if (n > cap) hit("sentence", pageId, lang, s, `${n} > ${cap} words`);
        }
      }
      // preaching: virtue nouns and stated morals
      for (const w of isHe ? BOOK_VIRTUE_HE : BOOK_VIRTUE_EN) if (isHe ? hasWordHe(text, w) : hasWordEn(text, w)) hit("preaching", pageId, lang, text, w);
      if (isHe ? MORAL_HE.test(plain) : MORAL_EN.test(text)) hit("preaching", pageId, lang, text, "a stated moral");
      // shame
      for (const w of isHe ? SHAME_HE : SHAME_EN) if (isHe ? hasWordHe(text, w) : hasWordEn(text, w)) hit("shame", pageId, lang, text, w);
      // digits and scores
      if (/\p{Nd}/u.test(text)) hit("digit", pageId, lang, text, "a digit");
      if (isHe ? SCORE_HE.test(plain) : SCORE_EN.test(text)) hit("digit", pageId, lang, text, "a score or count");
      // TTS-safe
      if (DASH_ASIDE.test(text)) hit("tts", pageId, lang, text, "parentheses or a dash aside");
      // the divine name
      if (DIVINE_NAME.test(text)) hit("divine-name", pageId, lang, text);
      // name tokens
      if (isHe && /[והבלמשכ]\{(name|hero)\}/.test(text)) hit("name", pageId, lang, text, "a Hebrew prefix glued to the name");
      if (/\{name\}/.test(text) && mode === "CAST" && !(role === "text" || role === "closing")) hit("name", pageId, lang, text, "{name} outside a frame line");
      if (/\{name\}/.test(text) && mode === "CAST" && pageId !== first && pageId !== last) hit("name", pageId, lang, text, "{name} outside the first and last pages");
    }
  }
  if (/\{(name|hero)\}/.test(book.title.en + book.title.he)) hit("name", "title", "en", book.title.en, "the name in the title");
  if (mode === "COMPANION") {
    for (const p of pages) {
      if (p.id === "cover") continue;
      for (const [lang, text] of variants(p.text)) if (!/\{hero\}/.test(text) && !(p.repair && /\{hero\}/.test(lang === "en" ? p.repair.textAfter.en : p.repair.textAfter.he[lang === "he-m" ? "m" : "f"]))) hit("name", p.id, lang, text, "COMPANION: the hero is not on this page");
    }
  }

  // ── words per page ──────────────────────────────────────────────────────────
  for (const p of pages) {
    if (p.id === "cover") continue;
    const en = pageWords(p, (l) => l.en);
    const capEn = enOver[p.id] ?? PAGE_WORD_CAP[band].en;
    if (en > capEn) hit("words", p.id, "en", p.text.en, `${en} > ${capEn}`);
    for (const g of ["m", "f"] as const) {
      const he = pageWords(p, (l) => l.he[g]);
      const capHe = heOver[p.id] ?? PAGE_WORD_CAP[band].he;
      if (he > capHe) hit("words", p.id, g === "m" ? "he-m" : "he-f", p.text.he[g], `${he} > ${capHe}`);
    }
  }

  // ── the decision, its branches and the rejoin ───────────────────────────────
  const decision = decisionOf(book);
  const choices = bookChoices(book);
  if (decision) {
    const want = band === "3-4" ? [2, 3] : [3];
    if (!want.includes(choices.length)) hit("choice", decision.pageId, "en", `${choices.length} choices`, `want ${want.join(" or ")}`);
    const types = choices.map((c) => c.type).sort().join(",");
    if (choices.length === 3 && types !== "easy,hard,third") hit("choice", decision.pageId, "en", types, "HARD / EASY / THIRD, once each");
    for (const c of choices) {
      if (words(c.label.en) > 5) hit("choice", `${decision.pageId}-choice-${c.id}`, "en", c.label.en, "> 5 words");
      if (words(c.label.he) > 6) hit("choice", `${decision.pageId}-choice-${c.id}`, "he-m", c.label.he, "> 6 words");
      if (c.branch.length < 1 || c.branch.length > 2) hit("dead-end", c.id, "en", `${c.branch.length} branch pages`, "1–2 pages");
      if (c.type === "hard" && c.branch.some((p) => p.repair)) hit("dead-end", c.id, "en", "a HARD repair", "only EASY / THIRD repair");
      for (const p of c.branch) if (p.id === decision.pageId || book.pages.some((q) => q.id === p.id)) hit("dead-end", p.id, "en", p.text.en, "a branch page reused on the linear path");
      for (const p of c.branch) for (const it of p.repair?.items ?? []) if (it.line && /\?/.test(it.line.en)) hit("dead-end", p.id, "en", it.line.en, "a repair that asks a second choice");
    }
    const lens = choices.map((c) => c.branch.length);
    if (lens.length && Math.max(...lens) - Math.min(...lens) > 1) hit("dead-end", decision.pageId, "en", lens.join("/"), "branch lengths differ by more than one page");
    const rejoin = rejoinPageIdOf(book);
    const rejoinPage = book.pages.find((p) => p.id === rejoin);
    if (!rejoinPage) hit("dead-end", String(rejoin), "en", "", "no rejoin page");
    // branch first pages differ in text and in picture state
    for (let i = 0; i < choices.length; i++) for (let j = i + 1; j < choices.length; j++) {
      const a = choices[i].branch[0], b = choices[j].branch[0];
      if (!a || !b) continue;
      for (const [lang, ta] of variants(a.text)) {
        const tb = variants(b.text).find(([l]) => l === lang)![1];
        if (ta.trim() === tb.trim()) hit("branch", `${a.id}|${b.id}`, lang, ta, "the first branch pages share their text");
      }
      if (a.plateId === b.plateId && (a.hero?.pose ?? null) === (b.hero?.pose ?? null) && JSON.stringify((a.overlays ?? []).map((o) => o.id).sort()) === JSON.stringify((b.overlays ?? []).map((o) => o.id).sort())) {
        hit("branch", `${a.id}|${b.id}`, "en", `${a.plateId} ${a.hero?.pose ?? ""}`, "the first branch pages share their picture state");
      }
    }
    // echoes: one distinct echo per choice on the rejoin page and the last page
    for (const p of [rejoinPage, book.pages[book.pages.length - 1]]) {
      if (!p) continue;
      const echo = p.echo ?? {};
      for (const c of choices) if (!echo[c.id]) hit("echo", p.id, "en", "", `no echo line for choice ${c.id}`);
      for (const [cid, e] of Object.entries(echo)) if (words(e.en) > ECHO_CAP) hit("echo", p.id, "en", e.en, `${cid}: ${words(e.en)} > ${ECHO_CAP} words`);
      const texts = Object.values(echo).map((e) => e.en.trim());
      if (new Set(texts).size !== texts.length) hit("echo", p.id, "en", texts.join(" | "), "two paths share an echo line");
    }
  }

  // ── plate briefs (§1 God is never depicted; §4 no religious shape) ─────────
  for (const [id, brief] of Object.entries(opts.plateBriefs ?? {})) {
    if (GOD_EN.test(brief) || GOD_HE.test(brief)) hit("god", `plate:${id}`, "en", brief, "God depicted or a religious symbol in a plate brief");
  }
  return hits;
}

/**
 * The catalogue of automatic rules: every rule id lintManuscript can emit,
 * with the standard clause it implements and its kind. Every kind is a
 * ceiling the standard itself sets, a required part, or a banned element:
 * there is deliberately no "shorter is better" rule, no readability score
 * and no presence rule a writer could satisfy only by flattening a page (the
 * depth the standard asks for, D1–D6, is the critic's, never the script's).
 * The registry test proves each id has a seeded failure.
 */
export const AUTOMATIC_RULES = {
  parity: { clause: "§3 HE parity broken", kind: "required part", what: "EN + HE-m + HE-f on every line, Hebrew in Hebrew, NFC" },
  words: { clause: "§3 over a word cap", kind: "ceiling", what: "words per page by band (5–7: EN 40 / HE 34; 3–4: 25 / 21)" },
  sentence: { clause: "§3 over a word cap", kind: "ceiling", what: "words per sentence by band (12 / 8); a quoted verse to 20" },
  preaching: { clause: "§3 preaching", kind: "banned element", what: "a virtue word or a stated moral in the child's text" },
  name: { clause: "BR2 / §2 name tokens", kind: "required part", what: "{name} only on frame lines (CAST); {hero} on every story page (COMPANION); no Hebrew prefix glued" },
  branch: { clause: "§3 branches' first pages share text or picture state", kind: "required part", what: "the first branch pages differ in text and picture" },
  echo: { clause: "§3 C6 rejoin carries memory (presence only)", kind: "required part", what: "one distinct echo per choice on the rejoin and last pages, each ≤ 12 words" },
  choice: { clause: "§3 C3 real choice (shape only)", kind: "required part", what: "3 typed choices HARD / EASY / THIRD (2 allowed for 3–4); labels ≤ 5 / 6 words" },
  "dead-end": { clause: "§3 a dead-end branch or a repair with a second choice", kind: "required part", what: "1–2 page branches that rejoin; only EASY / THIRD repair; no question in a repair" },
  god: { clause: "§1 / §3 God depicted", kind: "banned element", what: "a plate brief depicting God or a religious symbol" },
  "divine-name": { clause: "§1 the divine name", kind: "banned element", what: "the Tetragrammaton anywhere in the text" },
  tts: { clause: "§3 C9 TTS-safe", kind: "banned element", what: "parentheses or a dash aside in the child's text" },
  digit: { clause: "§3 a score shown to the child", kind: "banned element", what: "a digit, a score or a count shown to the child" },
  shame: { clause: "§3 shame", kind: "banned element", what: "a shame word in the child's text" },
} as const;
export type AutomaticRuleId = keyof typeof AUTOMATIC_RULES;
export const AUTOMATIC_RULE_IDS = Object.keys(AUTOMATIC_RULES) as AutomaticRuleId[];

/** What the registry itself says a book's pictures show, as plate-brief text
 *  for the God check: plate, overlay and art-state names, and every
 *  plate detail a repair reveals. An art round's own briefs are passed beside
 *  these (lintManuscript's `plateBriefs`). */
export function bookPictureBriefs(book: Book): Record<string, string> {
  const out: Record<string, string> = {};
  const say = (id: string) => id.replace(/[-_]+/g, " ");
  for (const p of allBookPages(book)) {
    out[`${p.id}:plate`] = say(p.plateId);
    for (const o of p.overlays ?? []) out[`${p.id}:overlay:${o.id}`] = say(o.id);
    for (const s of p.artStates ?? []) out[`${p.id}:state:${s.id}`] = [say(s.id), s.plateId ? say(s.plateId) : "", ...s.overlays.map(say)].filter(Boolean).join(", ");
    for (const it of p.repair?.items ?? []) if (it.plateDetailAfter) out[`${p.id}:repair:${it.id}`] = it.plateDetailAfter;
  }
  return out;
}

/** The plate-brief check alone (plan patterns and art rounds share it). */
export function godInBriefs(briefs: Readonly<Record<string, string>>): string[] {
  return Object.entries(briefs).filter(([, b]) => GOD_EN.test(b) || GOD_HE.test(b)).map(([id]) => id);
}
