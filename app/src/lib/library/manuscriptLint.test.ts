/**
 * B-BOOK-33 — "fails on a seeded bad manuscript (each automatic fail
 * injected once); passes the proof's v3 text". Each case below copies the
 * proof, injects ONE automatic fail, and expects exactly that rule (nothing
 * else) — so a rule that stops biting, or a rule that starts firing on clean
 * text, fails the build. The Engine fixture's known breach is frozen.
 */
import { describe, expect, it } from "vitest";
import { abramsLongRoad } from "./books/abramsLongRoad";
import { fiveSmoothStones } from "./books/fiveSmoothStones";
import { PLAN_PLATE_BRIEFS } from "./plans/planPlates";
import { words } from "./plans/planLint";
import { bookSentences, godInBriefs, lintManuscript, manuscriptBand, type LintHit } from "./manuscriptLint";
import type { Book, Page } from "./types";

const rules = (hits: LintHit[]) => [...new Set(hits.map((h) => h.rule))].sort();
const clone = (b: Book): Book => structuredClone(b);
const proof = fiveSmoothStones;
const first = proof.pages[0].id;
const last = proof.pages[proof.pages.length - 1].id;
/** A linear middle page with room under every cap (no echo, no frame, no repair). */
function roomy(b: Book): Page {
  return b.pages
    .filter((p) => p.id !== first && p.id !== last && p.id !== b.decision.pageId && p.id !== b.rejoinPageId && !p.echo && !p.closing && !p.repair)
    .sort((x, y) => words(x.text.en) - words(y.text.en))[0];
}
function seeded(mutate: (b: Book, page: Page) => void, opts: Parameters<typeof lintManuscript>[1] = {}): string[] {
  const b = clone(proof);
  mutate(b, roomy(b));
  return rules(lintManuscript(b, opts));
}

describe("B-BOOK-33: the proof's v3 text passes; the fixture's known breach is frozen", () => {
  it("Five Smooth Stones (manuscript v3): no automatic fail", () => {
    expect(lintManuscript(proof)).toEqual([]);
    expect(manuscriptBand(proof)).toBe("5-7");
  });

  it("the room the seeds use is real (the proof's pages run at 36-41 words; a seed adds at most 4)", () => {
    const p = roomy(clone(proof));
    expect(p).toBeDefined();
    expect(words(p.text.en) + 4).toBeLessThanOrEqual(40);
  });

  it("Abram's Long Road (engine fixture, not polished further, BR1): its one sentence over the cap, FROZEN (may only shrink)", () => {
    expect(lintManuscript(abramsLongRoad).map((h) => `${h.rule} ${h.pageId} ${h.lang}`)).toEqual(["sentence p6c en", "sentence p6c he-m", "sentence p6c he-f"]);
  });

  it("a sentence ends at a closing quote after its stop", () => {
    expect(bookSentences('Father says: "Take this bread." David counts.')).toEqual(['Father says: "Take this bread."', "David counts."]);
  });

  it("the shared plan plate briefs depict no God and no religious symbol", () => {
    for (const [pattern, briefs] of Object.entries(PLAN_PLATE_BRIEFS)) {
      expect(godInBriefs(Object.fromEntries(Object.entries(briefs ?? {}).map(([id, s]) => [id, s.brief]))), pattern).toEqual([]);
    }
  });
});

describe("B-BOOK-33: each automatic fail, injected once, is caught (and only it)", () => {
  it("parity: a missing HE-f line", () => expect(seeded((_, p) => { p.text.he.f = ""; })).toEqual(["parity"]));
  it("parity: Hebrew not NFC", () => expect(seeded((_, p) => { p.text.he.m = `${p.text.he.m}שׁ`; })).toEqual(["parity"]));
  it("parity: English inside the Hebrew line slot", () => expect(seeded((_, p) => { p.text.he.m = "David runs."; })).toEqual(["parity"]));
  it("words: a page over 40 EN words", () => expect(seeded((_, p) => { p.text.en = `${p.text.en} ${"The sun is hot. ".repeat(8).trim()}`; })).toEqual(["words"]));
  it("words: a page over 34 HE words", () => expect(seeded((_, p) => { p.text.he.f = `${p.text.he.f} ${"השמש חמה מאוד. ".repeat(12).trim()}`; })).toEqual(["words"]));
  it("sentence: an unquoted sentence over 12 words", () => expect(seeded((_, p) => { p.text.en = "David runs up the long green hill with his sheep and his dog today."; })).toEqual(["sentence"]));
  it("sentence: a quoted line may run to 20, not 21", () => {
    expect(seeded((_, p) => { p.text.en = '"Go up the long green hill with the sheep and the dog and the lamb today," he says.'; })).toEqual([]);
    expect(seeded((_, p) => { p.text.en = '"Go up the long green hill with the sheep and the dog and the little black lamb today, small one," he says.'; })).toEqual(["sentence"]);
  });
  it("preaching: a virtue noun, EN", () => expect(seeded((_, p) => { p.text.en = `${p.text.en} He is brave.`; })).toEqual(["preaching"]));
  it("preaching: a virtue noun, HE (with a prefix)", () => expect(seeded((_, p) => { p.text.he.m = `${p.text.he.m} והוא אמיץ.`; })).toEqual(["preaching"]));
  it("preaching: a stated moral", () => expect(seeded((_, p) => { p.text.en = `${p.text.en} The lesson is clear.`; })).toEqual(["preaching"]));
  it("name: a Hebrew prefix glued to {name}", () => expect(seeded((b) => { const p1 = b.pages[0]; p1.text.he.m = p1.text.he.m.replace("{name}", "ל{name}"); })).toEqual(["name"]));
  it("name: {name} on a middle page of a CAST book", () => expect(seeded((_, p) => { p.text.en = `${p.text.en} {name} runs.`; })).toEqual(["name"]));
  it("name: a COMPANION page without the hero", () => {
    const b = clone(abramsLongRoad);
    const p = b.pages.find((x) => x.id !== "cover" && /\{hero\}/.test(x.text.en) && !x.repair)!;
    p.text.en = p.text.en.replace(/\{hero\}/g, "Abram");
    const hits = lintManuscript(b).filter((h) => !(h.rule === "sentence" && h.pageId === "p6c"));
    expect(rules(hits)).toEqual(["name"]);
    expect(hits.map((h) => `${h.pageId} ${h.lang}`)).toEqual([`${p.id} en`]);
  });
  it("branch: two first branch pages share their text", () => expect(seeded((b) => { b.decision.choices[1].branch[0].text = structuredClone(b.decision.choices[0].branch[0].text); })).toEqual(["branch"]));
  it("branch: two first branch pages share their picture state", () => expect(seeded((b) => {
    const [a, x] = [b.decision.choices[0].branch[0], b.decision.choices[1].branch[0]];
    x.plateId = a.plateId; x.hero = structuredClone(a.hero); x.overlays = structuredClone(a.overlays);
  })).toEqual(["branch"]));
  it("echo: a path without its echo on the rejoin page", () => expect(seeded((b) => { delete b.pages.find((p) => p.id === b.rejoinPageId)!.echo![b.decision.choices[2].id]; })).toEqual(["echo"]));
  // the rejoin page sits at the 40-word cap, so this seed lifts the page cap to isolate the echo rule
  it("echo: an echo over 12 words", () => expect(seeded((b) => { const e = b.pages.find((p) => p.id === b.rejoinPageId)!.echo![b.decision.choices[0].id]; e.en = "His feet are light. He runs and runs and runs down the hill."; }, { enOver: { [proof.rejoinPageId]: 99, p9: 41 } })).toEqual(["echo"]));
  it("echo: two paths share an echo line", () => expect(seeded((b) => { const echo = b.pages[b.pages.length - 1].echo!; echo[b.decision.choices[1].id] = structuredClone(echo[b.decision.choices[0].id]); })).toEqual(["echo"]));
  it("choice: a label over 5 words", () => expect(seeded((b) => { b.decision.choices[0].label.en = "Go to the giant right now"; })).toEqual(["choice"]));
  it("choice: the types are not HARD / EASY / THIRD once each", () => expect(seeded((b) => { b.decision.choices.find((c) => c.type === "hard")!.type = "third"; })).toEqual(["choice"]));
  it("dead-end: a branch of three pages", () => expect(seeded((b) => {
    const c = b.decision.choices.find((x) => x.type === "hard")!;
    c.branch.push({ ...structuredClone(c.branch[0]), id: `${c.branch[0].id}-x`, text: { en: "He walks on.", he: { m: "הוא הולך.", f: "הוא הולך." } } }, { ...structuredClone(c.branch[0]), id: `${c.branch[0].id}-y`, text: { en: "He walks more.", he: { m: "הוא ממשיך.", f: "הוא ממשיך." } } });
  })).toEqual(["dead-end"]));
  it("dead-end: a repair that asks a second choice", () => expect(seeded((b) => {
    const it = b.decision.choices.flatMap((c) => c.branch).find((p) => p.repair?.items.some((i) => i.line))!.repair!.items.find((i) => i.line)!;
    it.line!.en = it.line!.en.replace(/[.!]$/, "?");
  })).toEqual(["dead-end"]));
  it("god: a plate brief that depicts God", () => expect(seeded(() => {}, { plateBriefs: { PL1: "The hills at dawn, a great light-being with a halo above the sheep" } })).toEqual(["god"]));
  it("god: a religious symbol in a plate brief (the armour stand drawn as a cross)", () => expect(seeded(() => {}, { plateBriefs: { PL4e: "The empty stand in the tent, shaped like a cross" } })).toEqual(["god"]));
  it("divine-name: the Tetragrammaton in the text", () => expect(seeded((_, p) => { p.text.he.m = `${p.text.he.m} יהוה.`; })).toEqual(["divine-name"]));
  it("tts: parentheses in the child's text", () => expect(seeded((_, p) => { p.text.en = p.text.en.replace(/^(\S+)/, "($1)"); })).toEqual(["tts"]));
  it("tts: a dash aside", () => expect(seeded((_, p) => { p.text.en = `${p.text.en} He runs — fast.`; })).toEqual(["tts"]));
  it("digit: a number shown to the child", () => expect(seeded((_, p) => { p.text.en = `${p.text.en} He has 3.`; })).toEqual(["digit"]));
  it("digit: a score shown to the child", () => expect(seeded((_, p) => { p.text.en = `${p.text.en} He wins points.`; })).toEqual(["digit"]));
  it("shame: a shame word, EN and HE", () => {
    expect(seeded((_, p) => { p.text.en = `${p.text.en} He is ashamed.`; })).toEqual(["shame"]);
    expect(seeded((_, p) => { p.text.he.f = `${p.text.he.f} איזו בושה.`; })).toEqual(["shame"]);
  });
  // B-BOOK-66: the parent-only practises facet names an act, never a virtue or a trait of the child.
  const acts = (b: Book) => b.parent.practises as { en: string; he: string }[];
  it("practises: a virtue noun, EN and HE", () => {
    expect(seeded((b) => { acts(b)[0].en = "Being brave when the giant comes"; })).toEqual(["practises"]);
    expect(seeded((b) => { acts(b)[0].he = "להיות אמיץ מול הענק"; })).toEqual(["practises"]);
  });
  it("practises: a trait of the child, EN and HE", () => {
    expect(seeded((b) => { acts(b)[1].en = "Showing your child is confident"; })).toEqual(["practises"]);
    expect(seeded((b) => { acts(b)[1].he = "לחזק ביטחון עצמי"; })).toEqual(["practises"]);
  });
  it("practises: a noun, not an act; a name token; three lines", () => {
    expect(seeded((b) => { acts(b)[0].en = "Small steps toward a fear"; })).toEqual(["practises"]);
    expect(seeded((b) => { acts(b)[0].en = "Going toward a small fear with {name}"; })).toEqual(["practises"]);
    expect(seeded((b) => { (b.parent as unknown as { practises: unknown[] }).practises = [...acts(b), acts(b)[0]]; })).toEqual(["practises"]);
  });
  it("3–4 band: the caps tighten (8-word sentences, 25 EN words a page)", () => {
    const hits = lintManuscript(proof, { band: "3-4" });
    expect(rules(hits)).toEqual(expect.arrayContaining(["sentence", "words"]));
  });
});
