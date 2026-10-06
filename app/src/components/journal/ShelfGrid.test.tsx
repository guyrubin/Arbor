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

import ShelfGrid, { shelfCountKey } from "./ShelfGrid";
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
