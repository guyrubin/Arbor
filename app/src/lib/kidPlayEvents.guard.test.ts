/**
 * B-BOOK-51 / B-GAME-18 — the guard: a choice id or a child id never enters a
 * book or game event, and the one read ledger holds neither.
 *  - the helpers project an ALLOW-LIST (book_id, lang, hero / game, replay);
 *  - a child id, a timestamp, a generated row id or a one-letter choice id is
 *    not a catalogue id and is refused (the event is not sent);
 *  - every call site in src passes catalogue ids only (source scan);
 *  - in Kid Mode the one choke point (lib/analytics track) tags the event
 *    kid_mode: true and strips attribution.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sent = vi.hoisted(() => ({ calls: [] as { event: string; props: Record<string, unknown> }[] }));
vi.mock("./analytics", () => ({ track: (event: string, props: Record<string, unknown> = {}) => { sent.calls.push({ event, props }); } }));

import { catalogueId, KID_PLAY_EVENT_KEYS, trackBookFinished, trackBookOpened, trackGameSitting } from "./kpiEvents";
import { bookReadRow, catalogueBookId, lastReadSince } from "./bookReads";
import { allBooks } from "./library/books";
import { CHILD_SUBCOLLECTIONS } from "./childData";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..");
const CHILD_ID = "child-1780000000000";
const book = allBooks()[0];
const CHOICE_IDS = allBooks().flatMap((b) => b.decision.choices.map((c) => c.id));

beforeEach(() => { sent.calls = []; });

describe("the projection is an allow-list of catalogue ids", () => {
  it("book events carry book_id, lang and hero only — never a child id or choice id smuggled in", () => {
    const polluted = { bookId: catalogueBookId(book), lang: "he", hero: "own", childId: CHILD_ID, choiceId: CHOICE_IDS[0], name: "Synthetic" } as never;
    trackBookOpened(polluted);
    trackBookFinished(polluted);
    expect(sent.calls.map((c) => c.event)).toEqual(["book_opened", "book_finished"]);
    for (const c of sent.calls) {
      expect(Object.keys(c.props).sort()).toEqual([...KID_PLAY_EVENT_KEYS.book].sort());
      expect(Object.values(c.props)).not.toContain(CHILD_ID);
      for (const choice of CHOICE_IDS) expect(Object.values(c.props)).not.toContain(choice);
    }
  });
  it("game events carry game and replay only", () => {
    trackGameSitting({ game: "puzzle", replay: false, childId: CHILD_ID, score: 3 } as never);
    expect(sent.calls).toEqual([{ event: "game_sitting", props: { game: "puzzle", replay: false } }]);
  });
  it("a child id, a timestamp, a generated row id or a choice id is not a catalogue id: nothing is sent", () => {
    for (const bad of [CHILD_ID, "1780000000000", "plan-toilet-start--1780000000000", "x7f3k2", ...CHOICE_IDS, "", "child"]) {
      expect(catalogueId(bad), bad).toBeNull();
      trackBookOpened({ bookId: bad, lang: "en", hero: "own" });
      trackGameSitting({ game: bad, replay: false });
    }
    expect(sent.calls).toEqual([]);
  });
  it("every catalogue book id passes (library books by id, plan books by pattern)", () => {
    for (const b of allBooks()) expect(catalogueId(catalogueBookId(b)), b.id).toBe(b.id);
    expect(catalogueId("plan-toilet-start")).toBe("plan-toilet-start");
  });
});

describe("the one read ledger (bookReads)", () => {
  it("a row is the catalogue id, the language and the time — no child id, no choice, no score", () => {
    const row = bookReadRow(catalogueBookId(book), "he", new Date("2026-10-28T10:00:00Z"))!;
    expect(Object.keys(row).sort()).toEqual(["bookId", "finishedAt", "id", "lang"]);
    expect(row).toMatchObject({ bookId: book.id, lang: "he", finishedAt: "2026-10-28T10:00:00.000Z" });
    expect(bookReadRow(CHILD_ID, "en", new Date())).toBeNull();
    expect(bookReadRow(CHOICE_IDS[0], "en", new Date())).toBeNull();
  });
  it("is registered for export and erase", () => {
    expect(CHILD_SUBCOLLECTIONS).toContain("bookReads");
  });
  it("the latest read since the session began; earlier reads are not this session's", () => {
    const reads = [
      { bookId: "noahs-ark", finishedAt: "2026-10-28T09:00:00Z" },
      { bookId: book.id, finishedAt: "2026-10-28T10:05:00Z" },
      { bookId: "jonah-and-the-great-fish", finishedAt: "2026-10-28T10:01:00Z" },
    ];
    expect(lastReadSince(reads, Date.parse("2026-10-28T10:00:00Z"))?.bookId).toBe(book.id);
    expect(lastReadSince(reads, Date.parse("2026-10-28T11:00:00Z"))).toBeNull();
  });
});

describe("source guard: every book and game event call site names catalogue ids only", () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const f = path.join(dir, n);
    return statSync(f).isDirectory() ? walk(f) : /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [f] : [];
  });
  const calls = walk(SRC).flatMap((f) => {
    const text = readFileSync(f, "utf8");
    return [...text.matchAll(/(trackBookOpened|trackBookFinished|trackGameSitting|bookReadRow)\(([^)]*)\)/g)]
      .filter((m) => !f.endsWith(path.join("lib", "kpiEvents.ts")) && !f.endsWith(path.join("lib", "bookReads.ts")))
      .map((m) => ({ file: path.relative(SRC, f), args: m[2] }));
  });
  it("the call sites exist (kid reader, legacy reader, Studio games, Sneak & Freeze)", () => {
    const files = new Set(calls.map((c) => c.file.split(path.sep).join("/")));
    for (const f of ["components/kidmode/KidBookReaderView.tsx", "components/tabs/HeroJourneyTab.tsx", "components/kidmode/studioV2/StudioGame.tsx", "components/kidmode/games/sneakFreeze/SneakFreeze.tsx"]) expect(files, f).toContain(f);
  });
  it("no call site passes anything about the child or the choice", () => {
    for (const c of calls) expect(c.args, `${c.file}: ${c.args}`).not.toMatch(/choice|childProfile|child\.id|childId|\.name\b|score|correct/i);
  });
});
