/**
 * B-BOOK-51 — the one finished-book ledger (synthetic data only).
 *  - V2 true-ending semantics: one finish per true ending, never a skip to the
 *    end, never a resumed END, one finish per opening (replay = a new opening);
 *  - every reader (exit recap, program hand-back, offline shelf, kid shelf
 *    read mark) derives from the ledger's one reader and agrees with it;
 *  - old stored shapes are read, not rewritten;
 *  - B-BOOK-13 residue: the finish writes only the ledger row, never metrics;
 *  - aggregates: book cells under MIN_CELL_FAMILIES hidden, demo/internal out.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  bookReadRow,
  catalogueBookId,
  lastFinishByBook,
  lastReadSince,
  ledgerFinishes,
  trueEndingGate,
} from "./bookReads";
import { allBooks } from "./library/books";
import {
  awaitingRepair,
  bookFlowReducer,
  COVER,
  currentPage,
  END,
  initialBookFlow,
  isDecision,
  nextRepairItem,
  readPath,
  repairedItems,
  type BookFlowState,
} from "./library/bookFlow";
import { bookChoices } from "./library/bookShape";
import type { AnyBook } from "./library/types";
import { offlineLibraryBooks } from "./kidOfflineArt";
import { bookHandback, type SharedObject } from "./programs/sharedObject";
import { kidBooks } from "../components/kidmode/kidBooks";
import { KID_SHELF_STORIES, storiesForLanguage } from "./heroJourneys";
import { CHILD_SUBCOLLECTIONS } from "./childData";
import { buildKidPlayReport, MIN_CELL_FAMILIES, scanForbiddenKeys, summariseKidPlay, type CohortEventDoc, type CohortMetricsStore } from "../server/cohortMetrics";

const here = path.dirname(fileURLToPath(import.meta.url));
const book = allBooks().find((b) => bookChoices(b).length > 0)!;

/** One step the child can take on the current page (decision → first card + Go; repair → next item; else turn). */
function step(b: AnyBook, s: BookFlowState): BookFlowState {
  if (isDecision(b, s)) {
    const picked = bookFlowReducer(b, s, { type: "choose", choiceId: bookChoices(b)[0].id });
    return bookFlowReducer(b, picked, { type: "go" });
  }
  if (awaitingRepair(b, s)) {
    const page = currentPage(b, s)!;
    const done = repairedItems(page, s);
    const item = nextRepairItem(page, s) ?? page.repair!.items.find((it) => !done.has(it.id))!.id;
    return bookFlowReducer(b, s, { type: "repair", itemId: item });
  }
  return bookFlowReducer(b, s, { type: "next" });
}

/** Drive a whole opening through the gate; returns the finish count and the last state. */
function readThrough(b: AnyBook, from: BookFlowState, gate = trueEndingGate(from), max = 400): { finishes: number; state: BookFlowState; gate: typeof gate } {
  let s = from;
  let finishes = 0;
  for (let i = 0; i < max && s.at !== END; i++) {
    const next = step(b, s);
    if (gate(b, s, next)) finishes += 1;
    s = next;
  }
  return { finishes, state: s, gate };
}

describe("V2 true-ending semantics (trueEndingGate)", () => {
  it("one finish per true ending: reading from the cover to END finishes once", () => {
    const r = readThrough(book, initialBookFlow());
    expect(r.state.at).toBe(END);
    expect(r.finishes).toBe(1);
  });

  it("skipping to the end is not a finish: a jump from the cover, a middle page or an uncommitted decision page", () => {
    const branch = bookChoices(book)[0].id;
    const middle = { ...initialBookFlow(), at: readPath(book, branch)[1].id, choiceId: branch };
    const decision = { ...initialBookFlow(), at: book.decision.pageId };
    for (const before of [initialBookFlow(), middle, decision]) {
      expect(trueEndingGate(initialBookFlow())(book, before, { ...before, at: END }), before.at).toBe(false);
    }
  });

  it("the reducer itself never turns past an undone repair or an unmade choice to END", () => {
    for (const b of allBooks()) {
      let s = initialBookFlow();
      for (let i = 0; i < 400 && s.at !== END; i++) {
        const turned = bookFlowReducer(b, s, { type: "next" });
        if (turned.at === END) expect(awaitingRepair(b, s) || isDecision(b, s), b.id).toBe(false);
        s = step(b, s);
      }
      expect(s.at, b.id).toBe(END);
    }
  });

  it("a resumed END is not a new finish, even paged back and forward again", () => {
    const branch = bookChoices(book)[0].id;
    const savedEnd = { ...initialBookFlow(), at: END, choiceId: branch };
    const gate = trueEndingGate(savedEnd);
    const back = bookFlowReducer(book, savedEnd, { type: "back" });
    expect(gate(book, savedEnd, back)).toBe(false);
    expect(gate(book, back, bookFlowReducer(book, back, { type: "next" }))).toBe(false);
  });

  it("replay: END → back → END is the same sitting; Read again (back to the cover) and a full re-read is a new finish", () => {
    const first = readThrough(book, initialBookFlow());
    expect(first.finishes).toBe(1);
    const back = bookFlowReducer(book, first.state, { type: "back" });
    expect(first.gate(book, first.state, back)).toBe(false);
    expect(first.gate(book, back, bookFlowReducer(book, back, { type: "next" }))).toBe(false);
    const cover = bookFlowReducer(book, first.state, { type: "toCover" });
    expect(first.gate(book, first.state, cover)).toBe(false);
    // The kids story-catalogue browser check reads every authored path in one
    // opening through Read again and counts each true ending (B-BOOK-51 fixup).
    expect(readThrough(book, cover, first.gate).finishes).toBe(1);
  });

  it("replay in a new opening is a new finish; a full re-read from a saved END finishes once", () => {
    expect(readThrough(book, initialBookFlow()).finishes).toBe(1);
    const savedEnd = { ...initialBookFlow(), at: END, choiceId: bookChoices(book)[0].id };
    const gate = trueEndingGate(savedEnd);
    const cover = bookFlowReducer(book, savedEnd, { type: "toCover" });
    expect(cover.at).toBe(COVER);
    expect(gate(book, savedEnd, cover)).toBe(false);
    expect(readThrough(book, cover, gate).finishes).toBe(1);
  });

  it("a resumed mid-book bookmark reaching the end is that read's one finish", () => {
    const branch = bookChoices(book)[0].id;
    const last = { ...initialBookFlow(), at: readPath(book, branch).at(-1)!.id, choiceId: branch };
    expect(readThrough(book, last).finishes).toBe(1);
  });
});

describe("the ledger's one reader (ledgerFinishes) — and every reader agrees with it", () => {
  const NOW = Date.parse("2026-10-29T09:00:00.000Z");
  const id = catalogueBookId(book);
  const rows: unknown[] = [
    bookReadRow(id, "he", new Date("2026-10-28T18:00:00.000Z")), // current shape
    { bookId: "noahs-ark", finishedAt: "2026-10-28T17:00:00Z" }, // B-BOOK-13 shape: no id, no lang
    { bookId: " jonah-and-the-great-fish ", lang: "en", finishedAt: "2026-10-27T10:00:00+02:00" }, // padded id, offset time
    { bookId: "child-family-one", lang: "en", finishedAt: "2026-10-28T10:00:00Z" }, // a child id
    { bookId: "plan-x--1780000000000", lang: "en", finishedAt: "2026-10-28T10:00:00Z" }, // a per-child row id
    { bookId: id, lang: "en", finishedAt: "2027-01-01T00:00:00Z" }, // device clock error
    { bookId: id, lang: "en", finishedAt: "not a date" },
    { bookId: id, lang: "en" },
    null,
    "garbage",
  ];

  it("reads the current and old shapes, skips what it cannot trust, rewrites nothing", () => {
    const before = JSON.stringify(rows);
    const f = ledgerFinishes(rows, NOW);
    expect(f.map(({ bookId, lang }) => [bookId, lang])).toEqual([[id, "he"], ["noahs-ark", null], ["jonah-and-the-great-fish", "en"]]);
    expect(JSON.stringify(rows)).toBe(before);
    expect(ledgerFinishes(rows, Number.NaN)).toEqual([]);
    expect(ledgerFinishes(null, NOW)).toEqual([]);
  });

  it("rejects impossible civil dates across ledger, shelf and exit recap without rewriting rows", () => {
    const corrupt = [
      { bookId: "noahs-ark", finishedAt: "2026-02-30T12:00:00Z" },
      { bookId: "jonah-and-the-great-fish", finishedAt: "2026-04-31T12:00:00+02:00" },
      { bookId: "joseph-and-his-brothers", finishedAt: "2026-02-29T12:00:00Z" },
      { bookId: "david-and-goliath", finishedAt: "2026-10-27T24:00:00Z" },
      { bookId: "noahs-ark", finishedAt: "2026-10-28" },
      { bookId: "noahs-ark", finishedAt: "2026-10-28T10:00:00" },
      { bookId: "noahs-ark", finishedAt: "2026-10-29T09:01:00Z" },
    ];
    const genuine = { bookId: "moses-and-pharaoh", finishedAt: "2024-02-29T12:00:00+02:00" };
    const all = [...corrupt, genuine];
    const snapshot = JSON.stringify(all);
    expect(ledgerFinishes(all, NOW).map(f => [f.bookId, f.at])).toEqual([[genuine.bookId, Date.parse("2024-02-29T10:00:00Z")]]);
    expect(lastReadSince(all, 0, NOW)).toBe(genuine);
    const shelf = kidBooks({ lang: "en", ageMonths: null, showAllAges: true, hasCover: () => false, runs: [], reads: all, nowMs: NOW });
    expect(shelf.filter(b => b.state === "finished").map(b => b.story.id)).toEqual([genuine.bookId]);
    expect(JSON.stringify(all)).toBe(snapshot);
  });

  it("the exit recap, the offline shelf and the program hand-back name exactly the ledger's finishes", () => {
    const ledger = lastFinishByBook(rows, NOW);
    // exit recap: the latest finish since the visit began is the ledger's latest
    const latest = [...ledger.entries()].sort((a, b) => b[1] - a[1])[0];
    expect((lastReadSince(rows as never[], 0, NOW) as { bookId: string } | null)?.bookId).toBe(latest[0]);
    // offline shelf: the recent books are the ledger's books, newest first
    const e = (bookId: string) => ({ book: { id: bookId } as never });
    const shelf = [e("tonight"), e(id), e("noahs-ark"), e("jonah-and-the-great-fish"), e("child-family-one"), e("never-read")];
    const offline = offlineLibraryBooks(shelf, rows as never[], 5, NOW).map((x) => (x.book as { id: string }).id);
    expect(offline).toEqual(["tonight", ...[...ledger.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)]);
    // program hand-back: yesterday's ledger finish of the one object, and a non-ledger row never
    const object = (oid: string): SharedObject => ({
      id: oid, shelf: "food",
      title: { en: "t", he: "t" }, coverLine: { en: "c", he: "c" }, tomorrow: { en: "m", he: "m" },
      askAfter: { en: "a", he: { m: "a", f: "a" } },
    });
    const now = new Date(2026, 9, 29, 9, 0, 0);
    const yday = new Date(2026, 9, 28, 20, 0, 0).toISOString();
    const base = { weekShelf: "food" as const, now, lang: "en" as const, childName: "Noa", weekSkill: "skill" };
    expect(bookHandback({ ...base, objects: [object("plan-new-food")], reads: [{ bookId: "plan-new-food", finishedAt: yday }] })).toHaveProperty("key");
    expect(bookHandback({ ...base, objects: [object("plan-new-food")], reads: [{ bookId: "plan-new-food ", finishedAt: "not a date" }] })).not.toHaveProperty("key");
    const bad = "child-new-food";
    expect(bookHandback({ ...base, objects: [object(bad)], reads: [{ bookId: bad, finishedAt: yday }] })).not.toHaveProperty("key");
  });

  it("the kid shelf's read mark: a ledger finish marks it read; the legacy heroRuns completion still does; nothing else", () => {
    const [s1, s2, s3] = storiesForLanguage(KID_SHELF_STORIES, "en").slice(0, 3);
    const nowMs = Date.parse("2026-10-29T09:00:00.000Z");
    const books = kidBooks({
      lang: "en", ageMonths: null, showAllAges: true, hasCover: () => false, nowMs,
      runs: [
        { storyId: s2.id, startedAt: "2026-10-20T10:00:00Z", completedAt: "2026-10-20T10:10:00Z" }, // legacy shape only
        { storyId: s3.id, startedAt: "2026-10-21T10:00:00Z" }, // opened, never finished
      ],
      reads: [
        { bookId: s1.id, lang: "en", finishedAt: "2026-10-22T10:00:00Z" }, // ledger only
        { bookId: s3.id, lang: "en", finishedAt: "2027-01-01T00:00:00Z" }, // future: not a finish
      ],
    });
    const state = (sid: string) => books.find((b) => b.story.id === sid)?.state;
    expect(state(s1.id)).toBe("finished");
    expect(state(s2.id)).toBe("finished");
    expect(state(s3.id)).toBe("started");
    // most recent first: the ledger finish (22 Oct) leads the run start (21 Oct) and the legacy finish (20 Oct)
    expect(books.slice(0, 3).map((b) => b.story.id)).toEqual([s1.id, s3.id, s2.id]);
  });
});

describe("B-BOOK-13 residue: the finish writes only the ledger row", () => {
  it("the row keys are the doc id, the catalogue id, the language and the time", () => {
    const row = bookReadRow(catalogueBookId(book), "en", new Date("2026-10-28T10:00:00Z"))!;
    expect(Object.keys(row).sort()).toEqual(["bookId", "finishedAt", "id", "lang"]);
    expect(CHILD_SUBCOLLECTIONS).toContain("bookReads");
  });

  it("neither finish path writes metrics", () => {
    const reader = readFileSync(path.join(here, "..", "components", "kidmode", "KidBookReaderView.tsx"), "utf8");
    expect(reader).not.toMatch(/metrics/i);
    const tab = readFileSync(path.join(here, "..", "components", "tabs", "HeroJourneyTab.tsx"), "utf8");
    const finish = tab.slice(tab.indexOf("const finishJourney"), tab.indexOf("// R2: reaching the last beat"));
    expect(finish).toContain("bookReadRow(");
    expect(finish).not.toMatch(/metricsEarned|"metrics|metricsCol/);
  });

  it("the library reader fires its finish only through the one gate", () => {
    const hook = readFileSync(path.join(here, "..", "components", "library", "useBookProgress.ts"), "utf8");
    expect(hook).toContain("trueEndingGate(");
    expect(hook.match(/onComplete\?\.\(\)/g)).toHaveLength(1);
    expect(hook).toMatch(/if \(before\.finish\(book, before\.state, state\)\) onComplete\?\.\(\);/);
  });
});

describe("privacy-safe book aggregates", () => {
  const at = (day: number) => new Date(Date.UTC(2026, 9, day, 10)).toISOString();
  const ev = (uid: string, day: number, event: "book_opened" | "book_finished", bookId = "five-smooth-stones"): CohortEventDoc =>
    ({ uid, event, at: at(day), props: { book_id: bookId, lang: "en", hero: "own", kid_mode: true } });
  const fam = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`);

  it("a book cell about fewer than MIN_CELL_FAMILIES families has no numbers", () => {
    const r = summariseKidPlay(fam(MIN_CELL_FAMILIES - 1).flatMap((u) => [ev(u, 20, "book_opened"), ev(u, 20, "book_finished")]));
    expect(r.books).toEqual([{ week: "2026-W43", book: "five-smooth-stones", hidden: true, families: null, opened: null, finished: null }]);
  });

  it("demo and internal families never count toward a book cell, so they cannot lift it over the threshold", async () => {
    const events = [
      ...fam(MIN_CELL_FAMILIES - 1).map((u) => ev(u, 20, "book_finished")),
      ev("demo-uid", 20, "book_finished"), ev("internal-uid", 20, "book_finished"),
    ];
    const store: CohortMetricsStore = {
      mode: "null",
      listRetentionRollups: async () => [
        { uid: "demo-uid", cohort: "demo", firstSeen: "2026-10-01", activeDays: [], source: null, market: null },
        { uid: "internal-uid", cohort: "internal", firstSeen: "2026-10-01", activeDays: [], source: null, market: null },
      ],
      listEvents: async () => events,
    };
    const r = await buildKidPlayReport(store, { since: at(1), now: new Date(at(28)) });
    expect(r.kidPlay.books).toEqual([{ week: "2026-W43", book: "five-smooth-stones", hidden: true, families: null, opened: null, finished: null }]);
    expect(scanForbiddenKeys(r)).toEqual([]);
    expect(JSON.stringify(r)).not.toMatch(/u0|demo-uid|internal-uid/);
  });
});
