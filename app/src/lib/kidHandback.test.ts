/**
 * B-BOOK-66 (mechanism half) + B-GAME-23 — Kid Mode's hand-back rows on the
 * parent's Today (lib/kidHandback). Synthetic data only.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LIBRARY_BOOKS, booksPractising, practisesFacet } from "./library/books";
import { fiveSmoothStones } from "./library/books/fiveSmoothStones";
import { abramsLongRoad } from "./library/books/abramsLongRoad";
import { parentSections } from "../components/library/BookParts";
import { isChildScopedKey } from "./childLocalState";
import { HE_VERDICT_WORDS } from "./milestoneHeRules";
import { findClinicalDiagnosisTerm } from "./clinicalScan";
import { NOW_COPY } from "../components/companion/nowViewCopy";
import { bookTomorrowRow, handbackDismissKey, playAtHomeRow, readHandbackDismissed, writeHandbackDismissed, PLAY_EXPERIENCES } from "./kidHandback";

const NOW = new Date(2026, 9, 29, 9, 0); // a Thursday morning, local time
const at = (d: number, h: number) => new Date(2026, 9, d, h, 0).toISOString();
const read = (id: string, bookId: string, finishedAt: string) => ({ id, bookId, finishedAt });
const WHO = { lang: "en" as const, gender: "girl", name: "Mia" };
const BOOK = fiveSmoothStones.id;

describe("B-BOOK-66 · the finished book reaches Today the next day", () => {
  it("a read finished yesterday shows the hero-free cover plate, the tomorrow line and the ask-after, EN", () => {
    const row = bookTomorrowRow([read("r1", BOOK, at(28, 19))], NOW, WHO);
    expect(row).not.toBeNull();
    expect(row!.key).toBe("r1");
    expect(row!.title).toBe(fiveSmoothStones.title.en);
    expect(row!.tomorrow).toBe(fiveSmoothStones.parent.tomorrow!.en);
    expect(row!.askAfter).toBe("Why did David leave the king's armour in the tent?");
    expect(row!.cover).toBe(`/visuals/books/${BOOK}/PL3-cover.webp`);
  });

  it("HE: the Hebrew tomorrow line, the title without niqqud", () => {
    const row = bookTomorrowRow([read("r1", BOOK, at(28, 19))], NOW, { ...WHO, lang: "he" })!;
    expect(row.tomorrow).toBe(fiveSmoothStones.parent.tomorrow!.he);
    expect(row.title).toMatch(/[א-ת]/);
    expect(row.title).not.toMatch(/[֑-ׇ]/);
    expect(row.askAfter).toMatch(/[א-ת]/);
  });

  it("only the day after: a read finished today or two days ago shows nothing", () => {
    expect(bookTomorrowRow([read("r1", BOOK, at(29, 7))], NOW, WHO)).toBeNull();
    expect(bookTomorrowRow([read("r1", BOOK, at(27, 19))], NOW, WHO)).toBeNull();
    // the latest of yesterday's reads is the one named
    expect(bookTomorrowRow([read("r1", BOOK, at(28, 8)), read("r2", BOOK, at(28, 19)), read("r3", BOOK, at(29, 8))], NOW, WHO)!.key).toBe("r2");
  });

  it("unreleased, unknown and missing-metadata controls show nothing", () => {
    expect(bookTomorrowRow([read("r1", abramsLongRoad.id, at(28, 19))], NOW, WHO)).toBeNull(); // a fixture, not released
    expect(bookTomorrowRow([read("r1", "no-such-book", at(28, 19))], NOW, WHO)).toBeNull();
    const panel = LIBRARY_BOOKS[BOOK].parent as { tomorrow?: unknown };
    const saved = panel.tomorrow;
    try {
      panel.tomorrow = undefined;
      expect(bookTomorrowRow([read("r1", BOOK, at(28, 19))], NOW, WHO)).toBeNull();
    } finally {
      panel.tomorrow = saved;
    }
    expect(bookTomorrowRow([], NOW, WHO)).toBeNull();
  });

  it("dismissing hides that read only; the next finished read comes back", () => {
    expect(bookTomorrowRow([read("r1", BOOK, at(28, 19))], NOW, WHO, { book: "r1" })).toBeNull();
    const nextDay = new Date(2026, 9, 30, 9);
    expect(bookTomorrowRow([read("r1", BOOK, at(28, 19)), read("r2", BOOK, at(29, 18))], nextDay, WHO, { book: "r1" })!.key).toBe("r2");
  });

  it("firewall: whatever else a row carries (a choice, a path, the read's language), the line is the same", () => {
    const plain = bookTomorrowRow([read("r1", BOOK, at(28, 19))], NOW, WHO);
    const loaded = bookTomorrowRow([{ ...read("r1", BOOK, at(28, 19)), choice: "b", path: ["p6b"], lang: "he", score: 3 } as never], NOW, WHO);
    expect(loaded).toEqual(plain);
  });
});

describe("B-GAME-23 · Play at home: visits, experiences met, one off-screen idea", () => {
  const sit = (id: string, day: string, extra: Record<string, unknown> = {}) => ({ id, game: "sneak-freeze", day, ...extra });
  it("counts the last seven days' sittings and names the experiences met, in a fixed order", () => {
    const row = playAtHomeRow([
      sit("s1", "2026-10-29", { experiences: ["dash"] }),
      sit("s2", "2026-10-27", { experiences: ["sunglasses", "dash"] }),
      sit("s3", "2026-10-23"),
      sit("s0", "2026-10-22", { experiences: ["fake-turn"] }), // eight days back: out
      { id: "x1", game: "other-game", day: "2026-10-29", experiences: ["fake-turn"] },
      { id: "x2", kind: "speech", day: "2026-10-29" },
    ], NOW);
    expect(row).toEqual({ key: "s1", game: "sneak-freeze", visits: 3, experiences: ["sunglasses", "dash"] });
  });
  it("firewall: rounds, prizes, duration, catches and a level change nothing", () => {
    const base = playAtHomeRow([sit("s1", "2026-10-29")], NOW);
    const loaded = playAtHomeRow([sit("s1", "2026-10-29", { rounds: 99, prizes: ["bell"], durationBucket: "over-10m", correct: true, score: 100, level: 3 })], NOW);
    expect(loaded).toEqual(base);
    expect(Object.keys(base!).sort()).toEqual(["experiences", "game", "key", "visits"]);
  });
  it("no sitting this week, or the latest sitting dismissed, shows nothing; a newer sitting comes back", () => {
    expect(playAtHomeRow([], NOW)).toBeNull();
    expect(playAtHomeRow([sit("s1", "2026-10-29")], NOW, { play: "s1" })).toBeNull();
    expect(playAtHomeRow([sit("s1", "2026-10-28"), sit("s2", "2026-10-29")], NOW, { play: "s1" })!.key).toBe("s2");
  });
});

describe("dismissals are per child and swept with the child", () => {
  const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
  it("one device key per child, ending in the child id", () => {
    const s = store();
    writeHandbackDismissed("kid-a", { book: "r1" }, s);
    expect(readHandbackDismissed("kid-a", s)).toEqual({ book: "r1" });
    expect(readHandbackDismissed("kid-b", s)).toEqual({}); // wrong child: nothing hidden, nothing shown from it
    expect(isChildScopedKey(handbackDismissKey("kid-a"), "kid-a")).toBe(true);
    expect(readHandbackDismissed("kid-a", { getItem: () => "{not json" })).toEqual({});
  });
});

describe("B-BOOK-66 · the parent-only practises facet", () => {
  it("the proof book carries one or two acts, EN and HE", () => {
    const acts = fiveSmoothStones.parent.practises!;
    expect(acts.length).toBeGreaterThanOrEqual(1);
    expect(acts.length).toBeLessThanOrEqual(2);
    for (const a of acts) { expect(a.en).toMatch(/^\p{L}+ing\b/u); expect(a.he).toMatch(/[א-ת]/); }
  });
  it("the library filters on it: each act once, released books only", () => {
    const facet = practisesFacet("en");
    expect(facet.map((f) => f.key)).toEqual(fiveSmoothStones.parent.practises!.map((a) => a.en));
    for (const f of facet) expect(f.bookIds).toEqual([BOOK]);
    expect(practisesFacet("he").map((f) => f.label)).toEqual(fiveSmoothStones.parent.practises!.map((a) => a.he));
    expect(booksPractising(facet[0].key).map((b) => b.id)).toEqual([BOOK]);
    expect(booksPractising("Something no book practises")).toEqual([]);
  });
  it("the grown-up panel of the kid-side end page never shows it", () => {
    const shown = parentSections(fiveSmoothStones.parent, "en", "m").map(([, text]) => text).join("\n");
    for (const a of fiveSmoothStones.parent.practises!) expect(shown).not.toContain(a.en);
  });
});

describe("firewalls: the kid register finds neither row nor field; no verdict words", () => {
  const SRC = path.resolve(__dirname, "..");
  const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const full = path.join(dir, n);
    return statSync(full).isDirectory() ? files(full) : /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [full] : [];
  });
  it("nothing under components/kidmode or components/library reads the hand-back or the practises field", () => {
    const hits = [...files(path.join(SRC, "components", "kidmode")), ...files(path.join(SRC, "components", "library"))]
      .filter((f) => /kidHandback|NowKidHandback|\.practises\b|practisesFacet|booksPractising/.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(SRC, f));
    expect(hits).toEqual([]);
  });
  it("the hand-back reads only the fields it names (no choice, rounds, prizes, duration, score or level)", () => {
    const src = readFileSync(path.join(SRC, "lib", "kidHandback.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/\.(choice|path|rounds|prizes|durationBucket|correct|score|level)\b|(?<!who)\.lang\b/); // `who.lang` is the parent's language, never the read's
  });
  it("the rows' copy carries no arrow, delta, band, trend, score or count of firsts, EN and HE", () => {
    const EN_VERDICT = /\b(better|worse|more than|less than|behind|ahead|improv\w*|progress\w*|first time|firsts?|record|score|level|band|streak|trend)\b|[↑↓▲▼%]|[+−-]\d/i;
    for (const lang of ["en", "he"] as const) {
      const c = NOW_COPY[lang];
      const lines = [c.bookRowTitle("Five Smooth Stones"), c.bookRowAsk("Why?"), c.logIt, c.logItAria, c.hideRow, c.playRowTitle, c.playVisits(1), c.playVisits(4), c.playMet("x"), ...PLAY_EXPERIENCES.map((x) => c.playExperience[x])];
      for (const l of lines) {
        expect(l, l).not.toMatch(EN_VERDICT);
        for (const w of HE_VERDICT_WORDS) expect(l.includes(w), `${l} / ${w}`).toBe(false);
        expect(findClinicalDiagnosisTerm(l)).toBeNull();
      }
    }
  });
});
