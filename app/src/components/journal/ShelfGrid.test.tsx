import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
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
import { latestOwnEntry, ownWordsByShelf, tileWordsExcept } from "../../lib/journal/shelfView";
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
    const chrome = (html: string) => tiles(html).map((m) => m[0].replace(/data-shelf="[a-z]+"/, ""));
    expect(chrome(a)).toEqual(chrome(b));
    const nonFamily = tiles(a).filter((m) => m[1] !== "family").map((m) => m[0].replace(/data-shelf="[a-z]+"/, ""));
    expect(new Set(nonFamily).size).toBe(1);
  });

  it("tiles are ≥ 88 px tall (min-h 96) and every control is a 44 px target", () => {
    const html = render({});
    for (const m of tiles(html)) expect(m[0]).toContain("min-h-[96px]");
    expect(html).toMatch(/data-testid="journal-flip-pro"[^>]*min-h-11|min-h-11[^>]*data-testid="journal-flip-pro"/);
    expect(html).toMatch(/<button[^>]*data-testid="shelf-all-by-date"[^>]*min-h-\[96px\]/);
  });

  it('the flip is a TEXT control named "Professional view" (never icon-only), EN + HE', () => {
    for (const lang of ["en", "he"] as const) {
      const html = render({}, lang);
      const flip = html.match(/<button[^>]*data-testid="journal-flip-pro"[^>]*>([\s\S]*?)<\/button>/)!;
      expect(text(flip[1])).toContain(translate(lang, "elev.shelfJournal.flip"));
    }
  });

  it("one stamp on the grid; header + grid = 2 modules (budget 3)", () => {
    const html = render({ words: 3 });
    expect((html.match(/data-primary-move="open-shelf"/g) || []).length).toBe(1);
    expect(html).toMatch(/data-testid="shelf-grid"[^>]*data-primary-move="open-shelf"/);
    expect((html.match(/data-module="/g) || []).length).toBeLessThanOrEqual(3);
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
    it(`${lang}: the latest own entry sits in the header — verbatim, clay-dim rule, editorial t-lg, shelf in <bdi> + the day, a 44 px target`, () => {
      const html = full(lang);
      const header = html.slice(html.indexOf('data-module="journal-shelves-header"'), html.indexOf('data-module="journal-shelves"'));
      const btn = header.match(/<button[^>]*data-testid="journal-latest-words"[^>]*>/)![0];
      expect(btn).toMatch(/min-h-11/);
      expect(header).toContain("Sang the whole bath song on his own");
      expect(header).toMatch(/border-s-2 ps-3 t-lg[^"]*" style="border-color:var\(--arbor-clay-dim\);font-family:var\(--font-editorial\);color:var\(--arbor-ink-soft\)"/);
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

  it("the capture dock is the grid's THIRD module (budget 3), after the shelves; the stamp stays on the grid", () => {
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
