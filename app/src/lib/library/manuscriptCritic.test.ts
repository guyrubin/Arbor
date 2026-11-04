/**
 * B-BOOK-33 — quoted per-path critic reports: each read path gets its own
 * brief (rubric C1–C14, depth D1–D6, the automatic fails, that path's text
 * only); a returned report counts as evidence only when every criterion of
 * every path is scored 0–2 with a quote that is really in THAT path's text;
 * the §3 pass bar is computed on the lowest path. The reports below are
 * synthetic fixtures for the checker, not a critic's scores.
 */
import { describe, expect, it } from "vitest";
import { fiveSmoothStones as book } from "./books/fiveSmoothStones";
import { criticPrompt, criticVerdict, DEPTH_IDS, manuscriptPaths, RUBRIC_IDS, validateCriticReport, type CriticReport } from "./manuscriptCritic";

const paths = manuscriptPaths(book);
const branchText = (cid: string) => book.decision.choices.find((c) => c.id === cid)!.branch[0].text.en;

/** A well-formed report: every criterion quotes a real line of its own path (or the parent panel). */
function report(score = 2, depth = 2): CriticReport {
  return {
    bookId: book.id,
    critic: "synthetic fixture",
    paths: paths.map((p) => {
      const line = p.pages.find((pg) => pg.pageId === book.decision.choices.find((c) => c.id === p.choiceId)!.branch[0].id)!.lines[0].en;
      return {
        choiceId: p.choiceId,
        scores: Object.fromEntries(RUBRIC_IDS.map((id) => [id, { score, quote: id === "C12" ? book.parent.askAfter.en : line }])),
        depth: Object.fromEntries(DEPTH_IDS.map((id) => [id, { score: depth, quote: id === "D6" ? book.parent.sourceNote.en : line }])),
        autoFails: [],
      };
    }),
  };
}

describe("B-BOOK-33: one brief per read path", () => {
  it("three paths, each the cover + its own read order, with only its own echo lines", () => {
    expect(paths.map((p) => [p.choiceId, p.type])).toEqual(book.decision.choices.map((c) => [c.id, c.type]));
    for (const p of paths) {
      expect(p.pages[0].pageId).toBe("cover");
      const rejoin = p.pages.find((pg) => pg.pageId === book.rejoinPageId)!;
      const echoes = Object.entries(book.pages.find((pg) => pg.id === book.rejoinPageId)!.echo!);
      for (const [cid, e] of echoes) expect(rejoin.lines.some((l) => l.en === e.en), `${p.choiceId} carries ${cid}'s echo`).toBe(cid === p.choiceId);
    }
  });

  it("the brief names every criterion, the automatic fails, and this path's text only", () => {
    const a = criticPrompt(book, "a");
    for (const id of [...RUBRIC_IDS, ...DEPTH_IDS]) expect(a).toContain(`- ${id} `);
    expect(a).toContain("God depicted or a theology lesson");
    expect(a).toContain(branchText("a"));
    expect(a).not.toContain(branchText("b"));
    expect(a).toContain("EXACTLY as written");
    expect(() => criticPrompt(book, "z")).toThrow();
  });
});

describe("B-BOOK-33: a report is evidence only when every score is quoted from its own path", () => {
  it("a well-formed report validates", () => {
    expect(validateCriticReport(book, report())).toEqual([]);
  });

  it("a fabricated quote, a quote from another path, a missing path, a bad score, an unnamed critic: each is a finding", () => {
    const r = report();
    r.paths[0].scores.C4 = { score: 2, quote: "David slays the giant with a sword" };
    r.paths[0].scores.C5 = { score: 2, quote: branchText("b") };
    r.paths[1].depth.D3 = { score: 3, quote: branchText("b") };
    r.paths = r.paths.filter((p) => p.choiceId !== "c");
    r.critic = " ";
    const findings = validateCriticReport(book, r);
    expect(findings).toEqual(expect.arrayContaining([
      "the report names no critic",
      'path a C4: the quote is not in this path\'s text ("David slays the giant with a sword")',
      `path a C5: the quote is not in this path's text ("${branchText("b")}")`,
      "path b D3: score 3 is not 0, 1 or 2",
      "path c: not scored",
    ]));
    expect(findings).toHaveLength(5);
  });

  it("quotes match through niqqud, curly quotes and spacing, never through paraphrase", () => {
    const r = report();
    const p1 = book.pages[0];
    r.paths[0].scores.C1 = { score: 2, quote: `  ${p1.text.he.m.replace(/[֑-ׇ]/g, "")}  ` };
    expect(validateCriticReport(book, r)).toEqual([]);
    r.paths[0].scores.C1 = { score: 2, quote: "David was afraid." };
    expect(validateCriticReport(book, r)).toHaveLength(1);
  });
});

describe("B-BOOK-33: the §3 pass bar on the lowest path", () => {
  it("all 2s pass (28/28, depth 12/12)", () => {
    const v = criticVerdict(book, report());
    expect(v.pass).toBe(true);
    expect(v.totals.a).toEqual({ rubric: 28, depth: 12 });
  });
  it("C3 / C4 / C5 / C7 / C13 below 2 fails; any criterion at 0 fails; under 23/28 fails", () => {
    const one = report(); one.paths[1].scores.C4!.score = 1;
    expect(criticVerdict(book, one).reasons).toEqual(["path b: C4 must be 2"]);
    const zero = report(); zero.paths[2].scores.C9!.score = 0;
    expect(criticVerdict(book, zero).reasons).toEqual(["path c: C9 at 0"]);
    const low = report(); for (const id of ["C1", "C2", "C6", "C8", "C9", "C10"] as const) low.paths[0].scores[id]!.score = 1;
    expect(criticVerdict(book, low).reasons).toEqual(["path a: 22/28 < 23"]);
  });
  it("depth under 11/12 on the lowest path fails; an automatic fail fails; an invalid report never passes", () => {
    const shallow = report(); shallow.paths[2].depth.D1!.score = 1; shallow.paths[2].depth.D3!.score = 1;
    expect(criticVerdict(book, shallow).reasons).toEqual(["depth 10/12 on the lowest path < 11"]);
    const auto = report(); auto.paths[0].autoFails = ["preaching"];
    expect(criticVerdict(book, auto).pass).toBe(false);
    const fake = report(); fake.paths[0].scores.C1 = { score: 2, quote: "not in the book" };
    expect(criticVerdict(book, fake).pass).toBe(false);
  });
  it("the critic module names no model (the critic is run outside CI)", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["./manuscriptCritic.ts", "./manuscriptLint.ts", "../../../scripts/manuscript-critic.mts"]) {
      const src = readFileSync(new URL(f, import.meta.url), "utf8");
      expect(src, f).not.toMatch(/gemini|claude|gpt-|openai|anthropic|vertex|fetch\(/i);
    }
  });
});
