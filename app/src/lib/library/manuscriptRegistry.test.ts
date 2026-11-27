/**
 * B-BOOK-33 — the full rubric lint over EVERY canonical book in the registry
 * (allBooks(): real + fixture; the list is derived, never hard-coded), and
 * the quoted per-path critic report.
 *
 *  1. Registry sweep: each book's automatic findings equal its allow-list
 *     below EXACTLY (a new hit fails; a fixed hit must be removed from the
 *     list). Every allow-list entry carries a date and a reason. Books are
 *     never edited to make this pass.
 *  2. Seeded failures: for every automatic rule in AUTOMATIC_RULES, every
 *     registry book is copied, broken in exactly that one way, and the lint
 *     must report that rule and no other new rule.
 *  3. The report: deterministic, every quote is the book's own text, every
 *     judgement criterion is "needs human review" (never passed), and a
 *     seeded failure lands, quoted, on the path that reads it.
 *  4. Depth: the rules are ceilings, required parts and banned elements only;
 *     the cuts the lint can see (an echo, a line, a rejoin) are caught, never
 *     rewarded.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allBooks, FIXTURE_BOOKS, LIBRARY_BOOKS } from "./books";
import { bookChoices } from "./bookShape";
import { manuscriptPaths } from "./manuscriptCritic";
import { AUTOMATIC_RULE_IDS, AUTOMATIC_RULES, bookMode, bookPictureBriefs, lintManuscript, manuscriptBand, PAGE_WORD_CAP, type AutomaticRuleId, type ManuscriptLintOptions } from "./manuscriptLint";
import { HUMAN_AUTOMATIC_FAILS, HUMAN_REVIEW, manuscriptReport, parsePlaceholderCaptions, renderManuscriptReport } from "./manuscriptReport";
import { words, type LintHit } from "./plans/planLint";
import type { Book, Page } from "./types";

const CAPTIONS = parsePlaceholderCaptions(readFileSync(new URL("../../../scripts/dev-book-placeholders.py", import.meta.url), "utf8"));
const BOOKS = allBooks();
const briefsOf = (b: Book): Record<string, string> => ({ ...bookPictureBriefs(b), ...(CAPTIONS[b.id] ?? {}) });
const lint = (b: Book, extra: ManuscriptLintOptions = {}) => lintManuscript(b, { ...extra, plateBriefs: { ...briefsOf(b), ...(extra.plateBriefs ?? {}) } });
const key = (h: LintHit) => `${h.rule} ${h.pageId} ${h.lang}`;

/**
 * Real findings in shipped registry books, allow-listed (never silently
 * fixed). Each entry: the finding key, the date it was listed, the reason.
 */
const ALLOWLIST: Readonly<Record<string, readonly { key: string; since: string; reason: string }[]>> = {
  "five-smooth-stones": [],
  "abrams-long-road": [
    { key: "sentence p6c en", since: "2026-11-27", reason: "engine fixture, not polished further (BR1): the packing list is one 18-word sentence; FROZEN in manuscriptLint.test.ts, may only shrink" },
    { key: "sentence p6c he-m", since: "2026-11-27", reason: "same sentence, HE-m (18 words)" },
    { key: "sentence p6c he-f", since: "2026-11-27", reason: "same sentence, HE-f (18 words)" },
  ],
};

describe("B-BOOK-33: the registry sweep (every canonical book, derived from the registry)", () => {
  it("the registry is real + fixture books and every one has an allow-list entry (even an empty one)", () => {
    expect(BOOKS.map((b) => b.id).sort()).toEqual([...Object.keys(LIBRARY_BOOKS), ...Object.keys(FIXTURE_BOOKS)].sort());
    expect(BOOKS.length).toBeGreaterThan(0);
    expect(Object.keys(ALLOWLIST).sort()).toEqual(BOOKS.map((b) => b.id).sort());
  });

  it("every allow-list entry is dated and reasoned", () => {
    for (const [id, entries] of Object.entries(ALLOWLIST)) for (const e of entries) {
      expect(e.since, `${id} ${e.key}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.reason.trim().length, `${id} ${e.key}`).toBeGreaterThan(10);
    }
  });

  for (const book of BOOKS) {
    it(`${book.id}: automatic findings equal its allow-list exactly (with the registry picture names and the art-round captions as plate briefs)`, () => {
      expect(lint(book).map(key).sort()).toEqual(ALLOWLIST[book.id].map((e) => e.key).sort());
    });
  }

  it("the art-round captions are parsed for every registry book and fed to the God check", () => {
    for (const b of BOOKS) expect(Object.keys(CAPTIONS[b.id] ?? {}).length, b.id).toBeGreaterThan(0);
    expect(CAPTIONS["five-smooth-stones"].PL4e).toBe("Saul's tent, the stand empty");
  });
});

// ── seeded failures ─────────────────────────────────────────────────────────
const subj = (b: Book) => (bookMode(b) === "COMPANION" ? "{hero}" : "He");
/** A middle page (linear or branch) with no echo, frame or repair, with the most room
 *  under both page caps (EN and HE). */
function roomy(b: Book): Page {
  const first = b.pages[0].id, last = b.pages[b.pages.length - 1].id, cap = PAGE_WORD_CAP[manuscriptBand(b)];
  const room = (p: Page) => Math.min(cap.en - words(p.text.en), cap.he - Math.max(words(p.text.he.m), words(p.text.he.f)));
  return [...b.pages, ...b.decision.choices.flatMap((c) => c.branch)]
    .filter((p) => p.id !== first && p.id !== last && p.id !== b.decision.pageId && p.id !== b.rejoinPageId && !p.echo && !p.closing && !p.repair)
    .sort((x, y) => room(y) - room(x) || x.id.localeCompare(y.id))[0];
}
type Seed = { name: string; mutate: (b: Book, p: Page) => void; opts?: (b: Book) => ManuscriptLintOptions };
const append = (en: (b: Book) => string): Seed["mutate"] => (b, p) => { p.text.en = `${p.text.en} ${en(b)}`; };

const SEEDS: Record<AutomaticRuleId, Seed[]> = {
  parity: [
    // an echo line (no name token is required there, so only parity can fire)
    { name: "a missing HE-f line", mutate: (b) => { const e = b.pages.find((p) => p.id === b.rejoinPageId)!.echo!; e[b.decision.choices[0].id].he.f = ""; } },
    // shin dot before dagesh: canonical order puts the dagesh first, so this is not NFC
    { name: "Hebrew not NFC", mutate: (_, p) => { p.text.he.m = `${p.text.he.m} \u05E9\u05C1\u05BC`; } },
    { name: "English in the Hebrew slot", mutate: (b, p) => { p.text.he.m = `${subj(b)} runs.`; } },
  ],
  words: [
    { name: "a page one sentence-run over the EN cap", mutate: (b, p) => { const cap = PAGE_WORD_CAP[manuscriptBand(b)].en; p.text.en = `${p.text.en} ${"The sun is hot. ".repeat(Math.ceil((cap - words(p.text.en) + 1) / 4)).trim()}`; } },
    { name: "a page over the HE cap", mutate: (b, p) => { const cap = PAGE_WORD_CAP[manuscriptBand(b)].he; p.text.he.f = `${p.text.he.f} ${"השמש חמה מאוד. ".repeat(Math.ceil((cap - words(p.text.he.f) + 1) / 3)).trim()}`; } },
  ],
  sentence: [{ name: "a 13-word sentence", mutate: (b, p) => { p.text.en = `${subj(b)} runs up the long green hill with the sheep and the dog today.`; } }],
  preaching: [
    { name: "a virtue noun, EN", mutate: append((b) => `${subj(b)} is brave.`) },
    { name: "a virtue noun, HE with a prefix", mutate: (_, p) => { p.text.he.m = `${p.text.he.m} והוא אמיץ.`; } },
    { name: "a stated moral", mutate: append(() => "The lesson is clear.") },
  ],
  name: [
    { name: "the name in the title", mutate: (b) => { b.title.en = `${b.title.en} {name}`; } },
    { name: "a Hebrew prefix glued to the name token", mutate: (b) => { const p = b.pages[0]; p.text.he.m = p.text.he.m.replace(/\{(name|hero)\}/, "ל$&"); } },
    {
      name: "CAST: {name} on a middle page · COMPANION: a story page without {hero}",
      mutate: (b, p) => {
        if (bookMode(b) === "CAST") { p.text.en = `${p.text.en} {name} runs.`; return; }
        const q = b.pages.find((x) => x.id !== "cover" && /\{hero\}/.test(x.text.en) && !x.repair)!;
        q.text.en = q.text.en.replace(/\{hero\}/g, "Child");
      },
    },
  ],
  branch: [
    { name: "the first branch pages share their text", mutate: (b) => { b.decision.choices[1].branch[0].text = structuredClone(b.decision.choices[0].branch[0].text); } },
    { name: "the first branch pages share their picture state", mutate: (b) => { const [a, x] = [b.decision.choices[0].branch[0], b.decision.choices[1].branch[0]]; x.plateId = a.plateId; x.hero = structuredClone(a.hero); x.overlays = structuredClone(a.overlays); } },
  ],
  echo: [
    { name: "a path without its echo on the rejoin page", mutate: (b) => { const c = b.decision.choices[b.decision.choices.length - 1]; delete b.pages.find((p) => p.id === b.rejoinPageId)!.echo![c.id]; } },
    { name: "two paths share an echo line on the last page", mutate: (b) => { const e = b.pages[b.pages.length - 1].echo!; e[b.decision.choices[1].id] = structuredClone(e[b.decision.choices[0].id]); } },
  ],
  choice: [
    { name: "a label over 5 words", mutate: (b) => { b.decision.choices[0].label.en = "Go up there right now please"; } },
    { name: "the types are not HARD / EASY / THIRD once each", mutate: (b) => { b.decision.choices.find((c) => c.type === "hard")!.type = "third"; } },
  ],
  "dead-end": [
    { name: "a branch of three pages", mutate: (b) => { const c = b.decision.choices.find((x) => x.type === "hard")!; const p = c.branch[0]; c.branch.push({ ...structuredClone(p), id: `${p.id}-x` }, { ...structuredClone(p), id: `${p.id}-y` }); } },
    {
      name: "a repair that asks a second choice",
      mutate: (b) => {
        const r = b.decision.choices.flatMap((c) => c.branch).find((p) => p.repair)!.repair!;
        const it = r.items.find((i) => i.line) ?? r.items[0];
        it.line = it.line ? { ...it.line, en: it.line.en.replace(/[.!]?$/, "?") } : { en: "Which one now?", he: { m: "איזה עכשיו?", f: "איזה עכשיו?" } };
      },
    },
  ],
  god: [
    { name: "a plate brief that depicts God", mutate: () => {}, opts: (b) => ({ plateBriefs: { [b.pages[0].plateId]: "The hills at dawn, a great light-being with a halo above the sheep" } }) },
    { name: "a religious symbol in a plate brief", mutate: () => {}, opts: (b) => ({ plateBriefs: { [b.pages[1].plateId]: "The empty stand in the tent, shaped like a cross" } }) },
  ],
  "divine-name": [{ name: "the Tetragrammaton in the text", mutate: (_, p) => { p.text.he.m = `${p.text.he.m} יהוה.`; } }],
  tts: [
    { name: "parentheses", mutate: (_, p) => { p.text.en = p.text.en.replace(/^(\S+)/, "($1)"); } },
    { name: "a dash aside", mutate: append((b) => `${subj(b)} runs — fast.`) },
  ],
  digit: [
    { name: "a digit", mutate: append((b) => `${subj(b)} has 3.`) },
    { name: "a score", mutate: append((b) => `${subj(b)} wins points.`) },
  ],
  shame: [
    { name: "a shame word, EN", mutate: append((b) => `${subj(b)} is ashamed.`) },
    { name: "a shame word, HE", mutate: (_, p) => { p.text.he.f = `${p.text.he.f} איזו בושה.`; } },
  ],
};

/** The rules a seed ADDS over the book's own (allow-listed) findings. */
function seededRules(book: Book, seed: Seed): string[] {
  const base = new Set(lint(book).map((h) => `${key(h)} ${h.text}`));
  const b = structuredClone(book);
  seed.mutate(b, roomy(b));
  return [...new Set(lint(b, seed.opts?.(b)).filter((h) => !base.has(`${key(h)} ${h.text}`)).map((h) => h.rule))].sort();
}

describe("B-BOOK-33: every automatic rule has a seeded failure, on every registry book", () => {
  it("the seeds cover the rule catalogue exactly, and the lint emits no rule outside it", () => {
    expect(Object.keys(SEEDS).sort()).toEqual([...AUTOMATIC_RULE_IDS].sort());
    const src = readFileSync(new URL("./manuscriptLint.ts", import.meta.url), "utf8");
    const emitted = new Set([...src.matchAll(/\bhit\("([a-z-]+)"/g)].map((m) => m[1]));
    expect([...emitted].sort()).toEqual([...AUTOMATIC_RULE_IDS].sort());
  });

  it("each registry book has the room the seeds use (≥ 4 EN and HE words under the page caps)", () => {
    for (const b of BOOKS) {
      const p = roomy(structuredClone(b)), cap = PAGE_WORD_CAP[manuscriptBand(b)];
      expect(p, b.id).toBeDefined();
      expect(words(p.text.en) + 4, b.id).toBeLessThanOrEqual(cap.en);
      expect(Math.max(words(p.text.he.m), words(p.text.he.f)) + 4, b.id).toBeLessThanOrEqual(cap.he);
    }
  });

  for (const book of BOOKS) for (const rule of AUTOMATIC_RULE_IDS) for (const seed of SEEDS[rule]) {
    it(`${book.id} · ${rule}: ${seed.name}`, () => expect(seededRules(book, seed)).toEqual([rule]));
  }
});

// ── the quoted per-path report ──────────────────────────────────────────────
const reportOf = (b: Book, extra: ManuscriptLintOptions = {}) => manuscriptReport(b, { ...extra, plateBriefs: { ...(CAPTIONS[b.id] ?? {}), ...(extra.plateBriefs ?? {}) } });

describe("B-BOOK-33: the quoted per-path critic report (deterministic, no model)", () => {
  for (const book of BOOKS) {
    it(`${book.id}: one section per read path; deterministic; every quote is the book's own text`, () => {
      const r = reportOf(book);
      expect(r.paths.map((p) => p.choiceId)).toEqual(bookChoices(book).map((c) => c.id));
      expect(renderManuscriptReport(reportOf(book))).toBe(renderManuscriptReport(r));
      const paths = manuscriptPaths(book);
      const briefs = Object.values(briefsOf(book));
      const parent = JSON.stringify([book.parent, book.knowledge, book.sourceRef, book.childRole, book.additions]);
      // the repair's own button labels (shown on the page, not narrated)
      const repairLabels = bookChoices(book).flatMap((c) => c.branch).flatMap((p) => (p.repair ? [p.repair.promptLabel.en, ...p.repair.items.flatMap((i) => (i.label ? [i.label.en] : []))] : []));
      for (const pr of r.paths) {
        const path = paths.find((p) => p.choiceId === pr.choiceId)!;
        const lines = path.pages.flatMap((p) => p.lines.map((l) => ({ pageId: p.pageId, l })));
        for (const h of pr.human) {
          expect(h.status, `${pr.choiceId} ${h.id}`).toBe(HUMAN_REVIEW);
          expect(h.passages.length, `${pr.choiceId} ${h.id}`).toBeGreaterThan(0);
          for (const ps of h.passages) {
            if (ps.quote.startsWith("(nothing on this path")) continue;
            const ok =
              ps.lang === "parent" ? parent.includes(JSON.stringify(ps.quote).slice(1, -1)) :
              ps.lang === "picture" ? briefs.includes(ps.quote) :
              repairLabels.includes(ps.quote) ? true :
              /-choice-/.test(ps.pageId) ? bookChoices(book).some((c) => ps.quote.endsWith(c.label.en)) :
              lines.some(({ pageId, l }) => (ps.pageId === "path" || pageId === ps.pageId) && [l.en, l.heM, l.heF].some((t) => t.includes(ps.quote)));
            expect(ok, `${book.id} ${pr.choiceId} ${h.id} ${ps.pageId}: "${ps.quote}"`).toBe(true);
          }
        }
        for (const f of pr.automatic) expect(lines.some(({ l }) => [l.en, l.heM, l.heF].some((t) => t.includes(f.quote))), `${f.rule} "${f.quote}"`).toBe(true);
      }
    });

    it(`${book.id}: every judgement criterion is listed as needs-human-review on every path, never scored`, () => {
      const r = reportOf(book);
      const n = 14 + 6 + Object.keys(HUMAN_AUTOMATIC_FAILS).length;
      for (const p of r.paths) {
        expect(p.human.map((h) => h.id)).toEqual([...Array.from({ length: 14 }, (_, i) => `C${i + 1}`), ...Array.from({ length: 6 }, (_, i) => `D${i + 1}`), ...Object.keys(HUMAN_AUTOMATIC_FAILS)]);
        expect(JSON.stringify(p.human)).not.toMatch(/"score"|"pass"/);
      }
      const md = renderManuscriptReport(r);
      expect(md.split(`_${HUMAN_REVIEW}_`).length - 1).toBe(n * r.paths.length);
      expect(md).toContain("None rewards cutting text");
    });
  }

  it("the allow-listed real findings appear quoted on the one path that reads them (Abram, path c)", () => {
    const r = reportOf(FIXTURE_BOOKS["abrams-long-road"]);
    expect(r.bookWide).toEqual([]);
    expect(r.paths.map((p) => [p.choiceId, p.automatic.map((f) => `${f.rule} ${f.pageId} ${f.lang}`)])).toEqual([
      ["a", []], ["b", []], ["c", ["sentence p6c en", "sentence p6c he-m", "sentence p6c he-f"]],
    ]);
    expect(r.paths[2].automatic[0].quote).toBe("{hero} packs everything: the clay lion, the little drum, the shiny stones, the pillow, the big round pot.");
  });

  it("a seeded failure on a branch page is quoted on that path only; a shared page on every path; a plate brief book-wide", () => {
    const b = structuredClone(LIBRARY_BOOKS["five-smooth-stones"]);
    const easy = b.decision.choices.find((c) => c.type === "easy")!;
    easy.branch[0].text.en = `${easy.branch[0].text.en} He is brave.`;
    const shared = roomy(b);
    shared.text.en = `${shared.text.en} He has 3.`;
    const r = reportOf(b, { plateBriefs: { PL1: "A face in the sky over the hills" } });
    for (const p of r.paths) {
      const pre = p.automatic.filter((f) => f.rule === "preaching");
      expect(pre.length, p.choiceId).toBe(p.choiceId === easy.id ? 1 : 0);
      if (pre.length) expect(pre[0].quote).toContain("He is brave.");
      expect(p.automatic.filter((f) => f.rule === "digit").map((f) => f.pageId)).toEqual([shared.id]);
    }
    expect(r.bookWide.map((f) => `${f.rule} ${f.pageId} ${f.quote}`)).toEqual(["god plate:PL1 A face in the sky over the hills"]);
  });
});

describe("B-BOOK-33: narrative depth is preserved", () => {
  it("every automatic rule is a ceiling, a required part or a banned element: none scores length or rewards a cut", () => {
    for (const [id, r] of Object.entries(AUTOMATIC_RULES)) expect(["ceiling", "required part", "banned element"], id).toContain(r.kind);
    // the only ceilings are the standard's own word caps
    expect(Object.entries(AUTOMATIC_RULES).filter(([, r]) => r.kind === "ceiling").map(([id]) => id).sort()).toEqual(["sentence", "words"]);
  });

  it("the cuts the lint can see are caught, never rewarded: an echo dropped, a line emptied, the rejoin page cut", () => {
    for (const book of BOOKS) {
      const base = new Set(lint(book).map(key));
      const added = (mut: (b: Book) => void) => { const b = structuredClone(book); mut(b); return [...new Set(lint(b).map(key).filter((k) => !base.has(k)).map((k) => k.split(" ")[0]))].sort(); };
      expect(added((b) => { b.pages.forEach((p) => delete p.echo); }), book.id).toContain("echo");
      expect(added((b) => { roomy(b).text.he.m = ""; }), book.id).toContain("parity");
      expect(added((b) => { b.pages = b.pages.filter((p) => p.id !== b.rejoinPageId); }), book.id).toContain("dead-end");
    }
  });
});
