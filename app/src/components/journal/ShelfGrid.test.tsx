import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

/* B-LOOP-11 — the journal is nine shelves: nine tiles in registry order
   whatever the counts, "Nothing yet" for 0 (never "0"), equal chrome on every
   tile, ≥ 88 px tiles with 44 px targets, the flip to the professional view as
   a text control, EN + HE, no firewall word. */

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});

import ShelfGrid, { shelfCountKey, tileNext } from "./ShelfGrid";
import { latestOwnEntry, ownWordsByShelf, practiceTryTitle, shelfDayLabel, shelfPractice, shelfTryPractice, tileWordsExcept } from "../../lib/journal/shelfView";
import { buildDemoFamily } from "../../demo/demoFamily";
import { toObservations } from "../../lib/observations";
import { shelfCoverage, selectNextMilestonesByShelf } from "../../lib/milestones/selectByShelf";
import { comparisonMonthsOf } from "../../lib/age/forChild";
import { PRACTICES } from "../../content/practices";
import { recentPracticeIds } from "../../lib/practice/choosePractice";
import { quotesFromDocs } from "../../lib/loop/tonight";
import { milestoneText } from "../../lib/milestoneData";
import type { BehaviorLog } from "../../types";
import { SHELVES, type ShelfId } from "../../lib/shelves/registry";
import { translate } from "../../lib/i18n";
import { loopFirewallHits } from "../../lib/loop/firewall";

const noop = () => undefined;
const render = (counts: Partial<Record<ShelfId, number>>, lang: "en" | "he" = "en") => {
  state.lang = lang;
  return renderToStaticMarkup(
    <ShelfGrid childName="Dylan" counts={counts} onOpenShelf={noop} onOpenPro={noop} onOpenAll={noop} primaryMoveProps={{ "data-primary-move": "open-shelf" }} />,
  );
};
const decode = (html: string) => html.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const tiles = (html: string) => [...html.matchAll(/<button[^>]*data-testid="shelf-tile"[^>]*data-shelf="([a-z]+)"[^>]*>/g)];
const REGISTRY_ORDER = [...SHELVES].sort((a, b) => a.order - b.order).map((s) => s.id);

describe("ShelfGrid — nine tiles, registry order, counts never verdicts", () => {
  it("nine tiles in registry order regardless of counts", () => {
    const rising = render(Object.fromEntries(REGISTRY_ORDER.map((id, i) => [id, i])) as Partial<Record<ShelfId, number>>);
    const falling = render(Object.fromEntries(REGISTRY_ORDER.map((id, i) => [id, 20 - i])) as Partial<Record<ShelfId, number>>);
    expect(tiles(rising).map((m) => m[1])).toEqual(REGISTRY_ORDER);
    expect(tiles(falling).map((m) => m[1])).toEqual(REGISTRY_ORDER);
    expect(REGISTRY_ORDER).toHaveLength(9);
  });

  it('"Nothing yet" for 0, "{n} noticed" otherwise — never a bare 0 (EN + HE)', () => {
    for (const lang of ["en", "he"] as const) {
      const html = render({ sleep: 0, words: 12, play: 1 }, lang);
      const counts = [...html.matchAll(/data-testid="shelf-tile-count"[^>]*>([\s\S]*?)<\/span>/g)].map((m) => text(m[1]));
      expect(counts[0]).toBe(translate(lang, "elev.shelfJournal.nothingYet"));
      expect(counts[REGISTRY_ORDER.indexOf("words")]).toBe(translate(lang, "elev.loop.shelf.noticed", { n: 12 }));
      expect(counts[REGISTRY_ORDER.indexOf("play")]).toBe(translate(lang, "elev.loop.shelf.noticed.one"));
      for (const c of counts) expect(c).not.toMatch(/(^|\s)0(\s|$)/);
      expect(translate(lang, "elev.shelfJournal.nothingYet")).not.toBe("elev.shelfJournal.nothingYet");
    }
    expect(shelfCountKey(0).key).toBe("elev.shelfJournal.nothingYet");
    expect(shelfCountKey(-1).key).toBe("elev.shelfJournal.nothingYet");
  });

  it("every tile wears the same chrome whatever its count (no tile differs by count)", () => {
    const a = render({ sleep: 0, food: 40 });
    const b = render({ sleep: 40, food: 0 });
    // B-OCCL-04: the route's stamp rides the registry-FIRST tile whatever the
    // counts (a position, never a count) — stripped like data-shelf.
    // B-DESIGN-04: a tile wears its SHELF's fixed tone (wash + ring ink) — shelf
    // identity, like data-shelf, so it is normalized; everything else is equal.
    const strip = (tag: string) =>
      tag
        .replace(/data-shelf="[a-z]+"/, "")
        .replace(/ data-primary-move="[a-z-]+"/, "")
        .replace(/var\(--arbor-(?:sky|yellow|lav|pink|green|peach)-(?:wash|ink)\)|var\(--arbor-paper-deep\)|var\(--arbor-ink\)(?= 9%)/g, "TONE");
    const chrome = (html: string) => tiles(html).map((m) => strip(m[0]));
    expect(chrome(a)).toEqual(chrome(b));
    const nonFamily = tiles(a).filter((m) => m[1] !== "family").map((m) => strip(m[0]));
    expect(new Set(nonFamily).size).toBe(1);
    expect(tiles(a).map((m) => /data-primary-move=/.test(m[0]))).toEqual(tiles(b).map((m) => /data-primary-move=/.test(m[0])));
  });

  it("tiles are ≥ 88 px tall (116 below sm, min-h 96 from sm) and every control is a 44 px target", () => {
    const html = render({});
    for (const m of tiles(html)) expect(m[0]).toMatch(/min-h-\[116px\] sm:min-h-\[96px\]/);
    expect(html).toMatch(/data-testid="journal-flip-pro"[^>]*min-h-11|min-h-11[^>]*data-testid="journal-flip-pro"/);
    // B-DESIGN-04 (journal design P2-7): the door is a 44 px+ row (min-h-16), not a 96 px tile
    expect(html).toMatch(/<button[^>]*data-testid="shelf-all-by-date"[^>]*min-h-16/);
  });

  it('the flip is a TEXT control named "Professional view" (never icon-only), EN + HE', () => {
    for (const lang of ["en", "he"] as const) {
      const html = render({}, lang);
      const flip = html.match(/<button[^>]*data-testid="journal-flip-pro"[^>]*>([\s\S]*?)<\/button>/)!;
      expect(text(flip[1])).toContain(translate(lang, "elev.shelfJournal.flip"));
    }
  });

  it("one stamp, on the registry-first tile (never the grid); header + grid = 2 modules (budget 3)", () => {
    for (const counts of [{ words: 3 }, {}, Object.fromEntries(REGISTRY_ORDER.map((id) => [id, 5]))]) {
      const html = render(counts as Partial<Record<ShelfId, number>>);
      expect((html.match(/data-primary-move="open-shelf"/g) || []).length).toBe(1);
      expect(html).not.toMatch(/data-testid="shelf-grid"[^>]*data-primary-move/);
      const stamped = tiles(html).filter((m) => /data-primary-move="open-shelf"/.test(m[0])).map((m) => m[1]);
      expect(stamped).toEqual([REGISTRY_ORDER[0]]);
    }
    expect((render({ words: 3 }).match(/data-module="/g) || []).length).toBeLessThanOrEqual(3);
  });

  it("no firewall word, no %, no claim that nothing is added without the parent (EN + HE)", () => {
    for (const lang of ["en", "he"] as const) {
      const out = text(render({ words: 12, feelings: 5 }, lang));
      expect(loopFirewallHits(out)).toEqual([]);
      expect(out).not.toMatch(/%|nothing is added|לא נוסף/i);
    }
  });

  it("logical properties and tokens only (source)", () => {
    const src = readFileSync(path.resolve(__dirname, "ShelfGrid.tsx"), "utf8");
    expect(src).not.toMatch(/\b(ml|mr|pl|pr|left|right)-\d/);
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).not.toMatch(/--gradient-cta|--arbor-gradient-primary/);
  });
});

/* P5-LOOP c2 r1 — the grid remembers in the parent's words (B-LOOP-NEW-1d (1),
   B-LOOP-NEW-1c (1)+(2)) and offers the capture dock, unfiled (journal product P1). */
describe("ShelfGrid — the parent's words, what to try, and the capture dock", () => {
  const full = (lang: "en" | "he", over: Partial<React.ComponentProps<typeof ShelfGrid>> = {}) => {
    state.lang = lang;
    return renderToStaticMarkup(
      <ShelfGrid
        childName="Dylan"
        counts={{ words: 8, sleep: 0 }}
        onOpenShelf={noop}
        onOpenPro={noop}
        onOpenAll={noop}
        primaryMoveProps={{ "data-primary-move": "open-shelf" }}
        latest={{ text: "Sang the whole bath song on his own", shelf: "words", day: lang === "he" ? "אתמול" : "Yesterday" }}
        tileWords={{ words: { text: "more juice!", date: "2 Oct" }, sleep: { text: "never shown on an empty tile", date: "1 Oct" } }}
        tileTry={{ sleep: "Say the bedtime steps out loud", words: "never shown on a filled tile" }}
        captureDock={<div data-testid="dock-probe" />}
        {...over}
      />,
    );
  };

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: the latest own entry sits in the header — verbatim, the ONE warm accent (ink rule, editorial --t-say), shelf in <bdi> + the day, a 44 px target`, () => {
      const html = full(lang);
      const header = html.slice(html.indexOf('data-module="journal-shelves-header"'), html.indexOf('data-module="journal-shelves"'));
      const btn = header.match(/<button[^>]*data-testid="journal-latest-words"[^>]*>/)![0];
      expect(btn).toMatch(/min-h-11/);
      expect(header).toContain("Sang the whole bath song on his own");
      expect(header).toMatch(/data-testid="journal-latest-quote" class="w-full arbor-accent-rule arbor-type-say line-clamp-2" style="color:var\(--arbor-ink\)"/);
      expect(header).toContain(`<bdi>${translate(lang, "elev.shelves.words")}</bdi>`);
      // absent on first open — never a placeholder
      expect(full(lang, { latest: null })).not.toContain('data-testid="journal-latest-words"');
    });

    it(`${lang}: a filled tile quotes its latest words with the date; an empty tile names its practice; each tile reads only its own shelf`, () => {
      const html = full(lang);
      const tile = (id: string) => {
        const i = html.indexOf(`data-shelf="${id}"`);
        return html.slice(i, html.indexOf("</button>", i));
      };
      expect(tile("words")).toContain("more juice!");
      expect(tile("words")).toContain("<bdi>2 Oct</bdi>");
      expect(tile("words")).not.toContain("never shown on a filled tile");
      expect(text(tile("sleep"))).toContain(translate(lang, "elev.shelfJournal.tryLine", { title: "Say the bedtime steps out loud" }));
      expect(text(tile("sleep"))).toContain(translate(lang, "elev.shelfJournal.nothingYetShort"));
      expect(tile("sleep")).not.toContain("never shown on an empty tile");
      // a tile with neither keeps the plain count line
      expect(text(tile("play"))).toContain(translate(lang, "elev.shelfJournal.nothingYet"));
      expect(tile("play")).not.toContain('data-testid="shelf-tile-next"');
      expect(loopFirewallHits(text(html))).toEqual([]);
      expect(text(html)).not.toMatch(/%|more than|fewer than|most|least|יותר מ|פחות מ/i);
    });
  }

  it("the capture dock is the grid's THIRD module (budget 3), after the shelves; the stamp stays on the first tile", () => {
    const html = full("en");
    expect([...html.matchAll(/data-module="([a-z-]+)"/g)].map((m) => m[1])).toEqual(["journal-shelves-header", "journal-shelves", "journal-capture"]);
    expect(html.indexOf('data-testid="dock-probe"')).toBeGreaterThan(html.indexOf('data-testid="shelf-all-by-date"'));
    expect((html.match(/data-primary-move=/g) || []).length).toBe(1);
  });

  it("JournalShelves wires the dock to the ONE capture sheet UNFILED (no shelf on the grid) and the hard moment through openHardMomentNow", () => {
    const src = readFileSync(path.resolve(__dirname, "JournalShelves.tsx"), "utf8");
    expect(src).toContain("<QuickCaptureBar");
    expect(src).toContain('onText={() => setCapture({ open: true, mode: "text" })}');
    expect(src).toContain("onHardMoment={hardMomentTile ? () => openHardMomentNow() : undefined}");
    expect(src).toContain("shelf={shelf ?? undefined}");
    // c2 r2: notes + the child's kept quotes; the header's entry is excluded from its tile
    expect(src).toContain("ownWordsByShelf(observations, behaviorLogs, keptQuotes, SHELF_IDS)");
    expect(src).toContain("tileWordsExcept(ownWords, latestOwn?.id)");
    expect(src).toContain("tileNotice={tileNotice}");
  });
});

/* P5-LOOP c2 r2 — ONE second line on every tile, family words first
   (journal product P1 G1-1, B-LOOP-NEW-2c), and the header's quote never
   repeats on its tile (journal design P1, B-LOOP-NEW-2d). */
describe("ShelfGrid — one line per tile, the quote appears once (c2 r2)", () => {
  // the seeded demo shape: nine shelves, six filled, the Words shelf holding notes AND kept quotes
  const log = (id: string, notes: string, timestamp: string) => ({ id, behaviorType: "Positive Moment", notes, timestamp, intensity: 1 } as unknown as BehaviorLog);
  const logs = [
    log("f1", "Sang the whole bath song on his own", "2026-10-06T19:00:00"),
    log("f0", "Hugged his sister after the fight", "2026-09-30T19:00:00"),
    log("w1", "Asked for more juice with a full sentence", "2026-10-02T09:00:00"),
  ];
  const obs = [
    { id: "behaviorLogs:f1", origin: "behaviorLogs" as const, shelf: "feelings" as ShelfId, at: "2026-10-06T19:00:00" },
    { id: "behaviorLogs:f0", origin: "behaviorLogs" as const, shelf: "feelings" as ShelfId, at: "2026-09-30T19:00:00" },
    { id: "behaviorLogs:w1", origin: "behaviorLogs" as const, shelf: "words" as ShelfId, at: "2026-10-02T09:00:00" },
  ];
  const quotes = [{ id: "quote-2026-10-04-a", note: "big ball!", noticedOn: "2026-10-04" }];
  const counts: Partial<Record<ShelfId, number>> = { food: 3, words: 8, feelings: 2, play: 3, moving: 1, hands: 1, school: 2, sleep: 0, family: 0 };
  const own = ownWordsByShelf(obs, logs, quotes, REGISTRY_ORDER);
  const latest = latestOwnEntry(own)!;
  const tileWords = Object.fromEntries(Object.entries(tileWordsExcept(own, latest.id)).map(([k, w]) => [k, { text: w!.text, date: w!.at.slice(5, 10) }]));
  const tileNotice: Partial<Record<ShelfId, string>> = { food: "Washes and dries hands", play: "Plays pretend with a friend", moving: "Climbs well", school: "Draws a circle" };
  const tileTry: Partial<Record<ShelfId, string>> = { sleep: "Same bedtime, same wake-up", family: "Name the people at dinner", hands: "Put on one sock together" };
  const grid = (lang: "en" | "he") => {
    state.lang = lang;
    return renderToStaticMarkup(
      <ShelfGrid childName="Dylan" counts={counts} onOpenShelf={noop} onOpenPro={noop} onOpenAll={noop}
        latest={{ text: latest.text, shelf: latest.shelf, day: "Yesterday" }} tileWords={tileWords} tileNotice={tileNotice} tileTry={tileTry} />,
    );
  };
  const tileOf = (html: string, id: string) => {
    const i = html.indexOf(`data-shelf="${id}"`);
    return html.slice(i, html.indexOf("</button>", i));
  };

  it("the selectors: the Words shelf holds the child's kept quote (newest first); the header is the newest NOTE; its tile gets the previous line", () => {
    expect(own.words?.map((w) => w.text)).toEqual(["big ball!", "Asked for more juice with a full sentence"]);
    expect(own.words?.[0].quote).toBe(true);
    expect(latest).toMatchObject({ shelf: "feelings", text: "Sang the whole bath song on his own" });
    expect(tileWordsExcept(own, latest.id).feelings?.text).toBe("Hugged his sister after the fight");
    // a shelf whose only line is the header's shows no words (its next line comes from notice/try)
    const solo = ownWordsByShelf([obs[0]], logs, [], REGISTRY_ORDER);
    expect(tileWordsExcept(solo, latestOwnEntry(solo)!.id).feelings).toBeUndefined();
  });

  it("tileNext cascade: words → next to notice → try; an empty shelf keeps its practice line only", () => {
    expect(tileNext(3, { text: "w", date: "d" }, "n", "t")?.kind).toBe("words");
    expect(tileNext(3, undefined, "n", "t")?.kind).toBe("notice");
    expect(tileNext(3, undefined, undefined, "t")?.kind).toBe("try");
    expect(tileNext(3)).toBeNull();
    expect(tileNext(0, { text: "w", date: "d" }, "n", "t")).toEqual({ kind: "try", title: "t" });
    expect(tileNext(0)).toBeNull();
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: every seeded tile carries EXACTLY one second line; Words reads the child's quote; the header's sentence renders once`, () => {
      const html = grid(lang);
      for (const id of REGISTRY_ORDER) {
        expect((tileOf(html, id).match(/data-testid="shelf-tile-next"/g) ?? []).length, `${lang} ${id}`).toBe(1);
      }
      expect(tileOf(html, "words")).toContain("big ball!");
      expect(tileOf(html, "words")).toMatch(/data-next="words"/);
      expect(text(tileOf(html, "food"))).toContain(translate(lang, "elev.shelfJournal.nextNotice", { title: "Washes and dries hands" }));
      expect(text(tileOf(html, "hands"))).toContain(translate(lang, "elev.shelfJournal.tryLine", { title: "Put on one sock together" }));
      // the header quote appears ONCE on the page; Feelings shows its previous line
      expect(html.split("Sang the whole bath song on his own").length - 1).toBe(1);
      expect(tileOf(html, "feelings")).toContain("Hugged his sister after the fight");
      // tile lines: t-sm sans in --arbor-ink-soft; tiles equal; no comparison words
      for (const m of html.matchAll(/<span data-testid="shelf-tile-next"[^>]*>/g)) {
        expect(m[0]).toContain("t-sm");
        expect(m[0]).toContain("color:var(--arbor-ink-soft)");
      }
      expect(loopFirewallHits(text(html))).toEqual([]);
      expect(text(html)).not.toMatch(/%|more than|fewer than|most|least|יותר מ|פחות מ/i);
    });
  }
});

/* B-OCCL-04 (7 Oct) — #/journal 375 EN + HE base: the ship sweep on b2c0d0f6
   measured the open-shelf stamp on the whole grid (y 345 / 321, h 875 / 873,
   dock top 749 → occluded). The stamp now rides the registry-first tile — the
   grid's first control, a 2-column cell at 375 — and the capture dock (the
   third module) follows the grid. jsdom has no layout, so this is the line
   model of that tile's bottom edge from the measured header: the grid top
   (EN 345 · HE 321, header with the demo seed's latest-words quote) plus one
   more t-lg line (24.75) in case that quote wraps to its 2-line clamp, then
   the tile: p-3.5 (14) · glyph 36 · gap-2 8 · name t-base leading-snug (15 ×
   1.375) · mt-0.5 2 · count t-sm (13 × 1.375) · mt-1 4 · the next line at
   its 2-line clamp · p-3.5 (14). A row is as tall as its taller cell, and
   both cells clamp the same way, so the bound holds for the row. */
describe("ShelfGrid — the stamped tile clears the capture dock at 375 (B-OCCL-04)", () => {
  const FOLD_LIMIT = 640;
  /* P7-DESIGN fix r1 (R3): the grid H1 moved from t-2xl (26.25 × 1.25 = 32.8) to
     the hero step (34 × 1.08 = 36.7), counted at TWO lines (a generous bound:
     "Dylan, shelf by shelf" may wrap at 375) = +40.6 on the measured tops; the
     tile is the fixed 116 px of the fix (one height below sm). */
  const HERO_DELTA = 2 * 34 * 1.08 - 26.25 * 1.25;
  const GRID_TOP_375 = { en: 345 + HERO_DELTA, he: 321 + HERO_DELTA } as const;
  const QUOTE_WRAP = 18 * 1.375;
  const tileH = 116;
  const bottom = (lang: "en" | "he") => Math.round(GRID_TOP_375[lang] + QUOTE_WRAP + tileH);

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: the stamp is the first tile (first control of the grid module), bottom ${bottom(lang)} ≤ ${FOLD_LIMIT}`, () => {
      state.lang = lang;
      const html = renderToStaticMarkup(
        <ShelfGrid childName="Dylan" counts={{ sleep: 0, words: 8 }} onOpenShelf={noop} onOpenPro={noop} onOpenAll={noop}
          primaryMoveProps={{ "data-primary-move": "open-shelf" }} tileTry={{ sleep: "Same bedtime, same wake-up" }}
          latest={{ text: "Sang the whole bath song on his own", shelf: "words", day: "Yesterday" }} captureDock={<div data-testid="dock-probe" />} />,
      );
      const grid = html.slice(html.indexOf('data-module="journal-shelves"'));
      const firstControl = /<button[^>]*>/.exec(grid)?.[0] ?? "";
      expect(firstControl).toContain('data-primary-move="open-shelf"');
      expect(firstControl).toContain(`data-shelf="${REGISTRY_ORDER[0]}"`);
      // the dock follows the stamped tile, never above it
      expect(html.indexOf('data-testid="dock-probe"')).toBeGreaterThan(html.indexOf('data-primary-move="open-shelf"'));
      // the lede stays one short sentence (no second lede line under the H1)
      expect(translate(lang, "elev.shelfJournal.lede").length).toBeLessThanOrEqual(60);
      expect(bottom(lang)).toBeLessThanOrEqual(FOLD_LIMIT);
    });
  }

  it("negative control: the grid as the stamp (the shipped shape) ran under the dock", () => {
    expect(GRID_TOP_375.en + 875).toBeGreaterThan(749);
  });
});

/* P5-LOOP critic residue (journal tileTry, 7 Oct) — on the demo seed two
   filled tiles (Body, food & growth "2 noticed"; Moving "1 noticed") showed a
   bare count: no words, no notice, and shelfPractice null under the recency
   exclusion. shelfTryPractice falls back to the pick WITHOUT recency, then
   the shelf's catalogue practice nearest the child's age (never ahead of
   it); practiceTryTitle names the child, never "your child". The grid inputs
   below are JournalShelves' own cascade over the real demo seed. */
describe("ShelfGrid — on the demo seed every tile carries one line (tileTry fallback)", () => {
  const NOW = new Date("2026-10-07T09:00:00Z");
  const seeded = (lang: "en" | "he") => {
    const fam = buildDemoFamily({ now: NOW.getTime(), lang });
    const c = fam.collections;
    const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
    const obs = toObservations({ behaviorLogs: c.behaviorLogs, milestones: c.milestones, langObs: c.langObs, actionLoops: c.actionLoops, practiceEvents: c.practiceEvents }, { id: fam.child.id, birthDate: fam.child.birthDate });
    const coverage = shelfCoverage(obs, NOW);
    const months = comparisonMonthsOf(fam.child, NOW);
    const own = ownWordsByShelf(obs, c.behaviorLogs, quotesFromDocs(c.keepsakes), REGISTRY_ORDER);
    const latest = latestOwnEntry(own);
    const tileWords: Partial<Record<ShelfId, { text: string; date: string }>> = {};
    for (const [id, w] of Object.entries(tileWordsExcept(own, latest?.id)) as [ShelfId, { text: string; at: string }][]) tileWords[id] = { text: w.text, date: shelfDayLabel(w.at, NOW, lang) };
    const tileNotice: Partial<Record<ShelfId, string>> = {};
    for (const p of selectNextMilestonesByShelf(c.milestones, months, { perShelf: 1, total: 9, now: NOW })) {
      if (!tileNotice[p.shelf]) tileNotice[p.shelf] = milestoneText(p.milestone, "title", t, { gender: fam.child.gender });
    }
    const input = { childId: fam.child.id, milestones: c.milestones, comparisonMonths: months, practices: PRACTICES, coverage, today: NOW, recentPracticeIds: recentPracticeIds(c.actionLoops, fam.child.id, NOW) };
    const first = fam.child.name.split(" ")[0];
    const tileTry: Partial<Record<ShelfId, string>> = {};
    for (const id of REGISTRY_ORDER) {
      if ((coverage[id] ?? 0) > 0 && (tileWords[id] || tileNotice[id])) continue;
      const practice = shelfTryPractice(input, id);
      if (practice) tileTry[id] = practiceTryTitle(practice, lang, first, fam.child.gender);
    }
    state.lang = lang;
    const html = renderToStaticMarkup(
      <ShelfGrid childName={first} counts={coverage} onOpenShelf={noop} onOpenPro={noop} onOpenAll={noop} primaryMoveProps={{ "data-primary-move": "open-shelf" }}
        latest={latest ? { text: latest.text, shelf: latest.shelf, day: shelfDayLabel(latest.at, NOW, lang) } : null}
        tileWords={tileWords} tileNotice={tileNotice} tileTry={tileTry} />,
    );
    return { fam, input, coverage, tileWords, tileNotice, tileTry, first, html };
  };
  const tileOf = (html: string, id: string) => {
    const i = html.indexOf(`data-shelf="${id}"`);
    return html.slice(i, html.indexOf("</button>", i));
  };

  it("the residue reproduces: food and moving are filled, with no words, no notice, and no chooser pick even without recency", () => {
    const { input, coverage, tileWords, tileNotice } = seeded("en");
    for (const id of ["food", "moving"] as const) {
      expect(coverage[id] ?? 0, id).toBeGreaterThan(0);
      expect(tileWords[id], id).toBeUndefined();
      expect(tileNotice[id], id).toBeUndefined();
      expect(shelfPractice(input, id), id).toBeNull();
      expect(shelfPractice({ ...input, recentPracticeIds: [] }, id), id).toBeNull();
      // the catalogue fallback: on the shelf, never ahead of the child's age
      const p = shelfTryPractice(input, id)!;
      expect(p.shelf).toBe(id);
      expect(p.ageMonths).toBeLessThanOrEqual(input.comparisonMonths!);
    }
  });

  it("the recency fallback: a shelf whose only pick was yesterday's still gets it", () => {
    const { input } = seeded("en");
    const words = shelfPractice({ ...input, recentPracticeIds: [] }, "words")!;
    const recentOnly = { ...input, recentPracticeIds: [words.practice.id] };
    const pick = shelfPractice(recentOnly, "words");
    expect(shelfTryPractice(recentOnly, "words")!.id).toBe((pick ?? words).practice.id);
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: all nine tiles carry exactly one second line; food + moving read "Try: …" in the child's terms`, () => {
      const { html, tileTry, first } = seeded(lang);
      for (const id of REGISTRY_ORDER) {
        expect((tileOf(html, id).match(/data-testid="shelf-tile-next"/g) ?? []).length, `${lang} ${id}`).toBe(1);
      }
      for (const id of ["food", "moving"] as const) {
        expect(tileOf(html, id)).toMatch(/data-next="try"/);
        expect(text(tileOf(html, id))).toContain(text(translate(lang, "elev.shelfJournal.tryLine", { title: tileTry[id]! })));
      }
      const out = text(html);
      expect(out).not.toMatch(/your child|your baby|your toddler/i);
      expect(out).not.toMatch(/הילד\/ה|התינוק\/ת|\/ה\b/);
      expect(loopFirewallHits(out)).toEqual([]);
      expect(first).not.toBe("");
    });
  }

  it("practiceTryTitle: the child's name replaces 'your child' (EN) and a standalone הילד/ה (HE); no name keeps the do as written", () => {
    const p = PRACTICES.find((x) => /your child\b/.test(x.do.en) && /(^|\s)הילד\/ה(\s|$)/.test(x.do.he))!;
    expect(p).toBeTruthy();
    const en = practiceTryTitle(p, "en", "Dylan", "boy");
    expect(en).not.toMatch(/your child/i);
    const he = practiceTryTitle(p, "he", "דילן", "boy");
    expect(he).not.toContain("/");
    expect(practiceTryTitle({ ...p, do: { en: "When your child's shoe is off, say 'shoe' and wait.", he: p.do.he } }, "en", "Dylan")).not.toMatch(/your/i);
    expect(practiceTryTitle(p, "en", "")).toBe(practiceTryTitle(p, "en", " "));
  });
});

/* B-DESIGN-04 (P7-DESIGN blend frames 02 / 05, 8 Oct): the grid takes the
   chosen direction — each tile on its shelf's FIXED wash (never by count), the
   44 px duotone glyph on a white chip, the name in the display face, ONE count
   line and ONE verb-led detail line; the family's quote in the editorial face. */
describe("B-DESIGN-04 · the shelf tiles", () => {
  const html = (lang: "en" | "he", counts: Partial<Record<ShelfId, number>>) => {
    state.lang = lang;
    return renderToStaticMarkup(
      <ShelfGrid
        childName="Dylan"
        counts={counts}
        onOpenShelf={noop}
        onOpenPro={noop}
        onOpenAll={noop}
        primaryMoveProps={{ "data-primary-move": "open-shelf" }}
        tileWords={{ words: { text: "more juice!", date: "2 Oct" } }}
        tileTry={{ sleep: "Say the bedtime steps out loud" }}
        tileNotice={{ food: "Washes and dries hands" }}
      />,
    );
  };
  const tileOf = (h: string, id: string) => {
    const i = h.indexOf(`data-shelf="${id}"`);
    return h.slice(i, h.indexOf("</button>", i));
  };
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: every tile = its shelf's wash + the duotone glyph on the white chip + the display-face name; the old flat glyph is gone`, () => {
      const h = html(lang, { words: 8, food: 3 });
      for (const id of REGISTRY_ORDER) {
        const tile = tileOf(h, id);
        expect(tile, id).toMatch(new RegExp(`data-testid="shelf-glyph-duotone" data-shelf="${id}"`));
        expect(tile, id).toContain("background:var(--arbor-paper-elevated)"); // the white chip on the wash
        expect(tile, id).toMatch(/data-testid="shelf-tile-name"[^>]*font-family:var\(--font-display\)/);
      }
      expect(h).not.toContain('data-testid="shelf-glyph"');
      expect(h).not.toMatch(/--gradient-cta|--arbor-gradient-primary/);
    });
    it(`${lang}: the wash is the same for a shelf at 0 and at 40 (identity, never a count)`, () => {
      const washOf = (h: string, id: string) => /style="background:(var\(--arbor-[a-z-]+\))/.exec(tileOf(h, id))?.[1];
      const a = html(lang, { sleep: 0, words: 40 });
      const b = html(lang, { sleep: 40, words: 0 });
      for (const id of REGISTRY_ORDER) expect(washOf(a, id), id).toBe(washOf(b, id));
      expect(washOf(a, "sleep")).toBe("var(--arbor-sky-wash)");
      expect(washOf(a, "hands")).toBe("var(--arbor-paper-deep)");
    });
    it(`${lang}: the detail line leads with its verb in ink; the localized line renders whole; one line at 375`, () => {
      const h = html(lang, { words: 8, food: 3 });
      const sleep = tileOf(h, "sleep");
      expect(sleep).toMatch(new RegExp(`data-testid="shelf-tile-verb"[^>]*>${translate(lang, "elev.shelfJournal.tryVerb")}<`));
      expect(text(sleep)).toContain(translate(lang, "elev.shelfJournal.tryLine", { title: "Say the bedtime steps out loud" }));
      const food = tileOf(h, "food");
      expect(food).toMatch(new RegExp(`data-testid="shelf-tile-verb"[^>]*>${translate(lang, "elev.shelfJournal.nextNoticeVerb")}<`));
      expect(h).toMatch(/data-testid="shelf-tile-next"[^>]*class="[^"]*\bline-clamp-1\b/);
      expect(tileOf(h, "words")).toMatch(/data-testid="shelf-tile-quote"[^>]*font-family:var\(--font-editorial\)/);
    });
    it(`${lang}: each verb key is the exact prefix of its line (the split never drops a word)`, () => {
      expect(translate(lang, "elev.shelfJournal.tryLine", { title: "X" }).startsWith(translate(lang, "elev.shelfJournal.tryVerb"))).toBe(true);
      expect(translate(lang, "elev.shelfJournal.nextNotice", { title: "X" }).startsWith(translate(lang, "elev.shelfJournal.nextNoticeVerb"))).toBe(true);
    });
  }
});


/* P7-DESIGN fix r1 (journal product P1-1 + design P1-1, 8 Oct). The built CSS
   orders `.block` AFTER `.line-clamp-*`, so `block` beside a clamp cancelled it
   (tiles 139–160 px at 375, details on 2–3 rows, a stranded "·"). The guard:
   (1) no element in the grid carries `block` together with `line-clamp-*`;
   (2) the words line is a truncating quote + a date that cannot wrap;
   (3) a line model of every 375 tile on the REAL demo seed (JournalShelves'
   own cascade), EN + HE, the way PracticeCard.fold measures: the tile's
   content stays under its 116 px floor, so every tile — every row — renders at
   exactly that height, and the height is <= 124.
   Widths: the 375 tile is (375 − 2 × 16 − 12) / 2 = 165.5 px; inside p-3 it is
   141.5; beside the 44 px glyph + 10 px gap the name/count column is 87.5 px
   (Family, two columns wide: 265). Advance per character is generous (display
   0.55 em, body 0.5 em); words wrap whole. OWED to the rendered sweep: journal
   375 EN + HE stampHeight (the Sleep tile) = 116 and equal rows. */
describe("P7-DESIGN fix r1 · the 375 tile is one height (<= 124 px), its detail one line", () => {
  const NOW = new Date("2026-10-07T09:00:00Z");
  const TILE_375 = 116;
  const COL = 87.5;
  const FAMILY_COL = 265;
  const T_BASE = 14.0625, T_SM = 12.1875;
  /** Lines a text takes at `width`, wrapping whole words. */
  const wrap = (txt: string, px: number, width: number, em: number) => {
    const adv = px * em;
    let lines = 1, run = 0;
    for (const word of txt.split(/\s+/).filter(Boolean)) {
      const w = word.length * adv;
      const next = run === 0 ? w : run + adv + w;
      if (next > width && run > 0) { lines += 1; run = w; } else run = next;
    }
    return lines;
  };
  const seededHtml = (lang: "en" | "he") => {
    const fam = buildDemoFamily({ now: NOW.getTime(), lang });
    const c = fam.collections;
    const obs = toObservations({ behaviorLogs: c.behaviorLogs, milestones: c.milestones, langObs: c.langObs, actionLoops: c.actionLoops, practiceEvents: c.practiceEvents }, { id: fam.child.id, birthDate: fam.child.birthDate });
    const coverage = shelfCoverage(obs, NOW);
    const own = ownWordsByShelf(obs, c.behaviorLogs, quotesFromDocs(c.keepsakes), REGISTRY_ORDER);
    const latest = latestOwnEntry(own);
    const tileWords: Partial<Record<ShelfId, { text: string; date: string }>> = {};
    for (const [id, w] of Object.entries(tileWordsExcept(own, latest?.id)) as [ShelfId, { text: string; at: string }][]) tileWords[id] = { text: w.text, date: shelfDayLabel(w.at, NOW, lang) };
    // a deliberately long practice title on every shelf: the detail line is one line whatever it says
    const tileTry: Partial<Record<ShelfId, string>> = Object.fromEntries(REGISTRY_ORDER.map((id) => [id, "Keep bedtime and wake-up the same every day of the week"]));
    state.lang = lang;
    const first = fam.child.name.split(" ")[0];
    return {
      full: renderToStaticMarkup(
        <ShelfGrid childName={first} counts={coverage} onOpenShelf={noop} onOpenPro={noop} onOpenAll={noop} primaryMoveProps={{ "data-primary-move": "open-shelf" }}
          latest={latest ? { text: latest.text, shelf: latest.shelf, day: shelfDayLabel(latest.at, NOW, lang) } : null} tileWords={tileWords} tileTry={tileTry} />,
      ),
      // first open: every shelf empty (HE "Nothing yet" was the 2-row count)
      empty: renderToStaticMarkup(
        <ShelfGrid childName={first} counts={{}} onOpenShelf={noop} onOpenPro={noop} onOpenAll={noop} tileTry={tileTry} />,
      ),
    };
  };
  const tileParts = (html: string) => REGISTRY_ORDER.map((id) => {
    const i = html.indexOf(`data-shelf="${id}"`);
    const tile = html.slice(i, html.indexOf("</button>", i));
    const name = text(/data-testid="shelf-tile-name"[^>]*>([^<]*)</.exec(tile)![1]);
    const count = text(/data-testid="shelf-tile-count"[^>]*>([\s\S]*?)<\/span>/.exec(tile)![1]);
    return { id, tile, name, count, hasNext: tile.includes('data-testid="shelf-tile-next"') };
  });
  /** The model: p-3 · max(glyph 44, name + 2 + count) · gap-2 · (pt-2 + hairline + one t-sm line) · p-3. */
  const contentHeight = (t: ReturnType<typeof tileParts>[number]) => {
    const family = t.id === "family";
    const nameLines = Math.min(2, wrap(t.name, T_BASE, family ? FAMILY_COL : COL, 0.55));
    const countLines = family ? Math.min(2, wrap(t.count, T_SM, FAMILY_COL, 0.5)) : 1;
    const top = Math.max(44, nameLines * T_BASE * 1.25 + 2 + countLines * T_SM * 1.375);
    return 12 + top + (t.hasNext ? 8 + 8 + 1 + T_SM * 1.375 : 0) + 12;
  };
  const SRC = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "ShelfGrid.tsx"), "utf8");

  it("source: no `block` beside a `line-clamp-*` anywhere in the grid (the built CSS lets block win)", () => {
    const blockWithClamp = (c: string) => /\bline-clamp-\d/.test(c) && /(^|\s)block(\s|$)/.test(c);
    const classes = [...SRC.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map((m) => m[1] ?? m[2]);
    expect(classes.length).toBeGreaterThan(10);
    expect(classes.filter(blockWithClamp)).toEqual([]);
    expect(SRC).toContain('const TILE = "flex w-full min-h-[116px] sm:min-h-[96px] flex-col');
    // NEGATIVE CONTROL: the shipped detail span trips the check
    expect(blockWithClamp("block w-full min-w-0 pt-2 t-sm leading-snug line-clamp-1 sm:line-clamp-2")).toBe(true);
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: every tile on the demo seed (filled + first open) fits the ${TILE_375} px floor, so every row is ${TILE_375} px (<= 124)`, () => {
      const { full, empty } = seededHtml(lang);
      for (const html of [full, empty]) {
        const parts = tileParts(html);
        expect(parts).toHaveLength(9);
        for (const t of parts) {
          expect(t.tile, t.id).toMatch(/min-h-\[116px\]/);
          expect(t.tile).toMatch(/data-testid="shelf-tile-name"[^>]*class="[^"]*\bline-clamp-2\b/);
          expect(Math.round(contentHeight(t)), `${lang} ${t.id} "${t.name}" / "${t.count}"`).toBeLessThanOrEqual(TILE_375);
          // a shelf name never needs the clamp's ellipsis: two whole-word lines at most
          expect(wrap(t.name, T_BASE, t.id === "family" ? FAMILY_COL : COL, 0.55), `${lang} ${t.id}`).toBeLessThanOrEqual(2);
          if (t.id !== "family") expect(t.tile).toMatch(/data-testid="shelf-tile-count"[^>]*class="[^"]*\btruncate\b/);
          // the count line never needs its ellipsis either (no meaning lost to the truncate)
          if (t.id !== "family") expect(wrap(t.count, T_SM, COL, 0.5), `${lang} ${t.id} "${t.count}"`).toBe(1);
        }
      }
      expect(TILE_375).toBeLessThanOrEqual(124);
    });

    it(`${lang}: the words line = a truncating quote + a "· date" that cannot wrap (the separator never strands); one quote pair per locale`, () => {
      const { full } = seededHtml(lang);
      const words = tileParts(full).filter((t) => /data-next="words"/.test(t.tile));
      expect(words.length).toBeGreaterThan(0);
      for (const t of words) {
        expect(t.tile).toMatch(/data-testid="shelf-tile-next"[^>]*class="[^"]*\bflex\b/);
        expect(t.tile).toMatch(/data-testid="shelf-tile-quote"[^>]*class="min-w-0 truncate"/);
        expect(t.tile).toMatch(/data-testid="shelf-tile-date" class="flex-none whitespace-nowrap">· /);
        if (lang === "he") {
          expect(t.tile).not.toMatch(/[\u201C\u201D]/);
          expect(t.tile).toContain("\u05F4");
        }
      }
    });
  }
});
