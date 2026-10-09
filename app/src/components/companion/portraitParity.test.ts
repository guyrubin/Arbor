import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { toObservations } from "../../lib/observations";
import { quoteKeepsakeDoc } from "../../lib/loop/tonight";

/** Parity 9 Oct — My child regains what the Growth hub carried. */
const read = (rel: string) => readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const portrait = read("components/companion/ChildPortrait.tsx");
const keepsakes = read("components/companion/PortraitKeepsakes.tsx");

describe("the portrait mounts the restored pieces inside its existing modules", () => {
  it("the watch row and the keepsake disclosure sit in the overview module (budget unchanged)", () => {
    const overview = portrait.slice(portrait.indexOf('data-module="child-portrait-overview"'), portrait.indexOf('data-module="child-portrait-evidence"'));
    expect(overview).toContain("<PortraitWatchRow />");
    expect(overview).toContain("<PortraitKeepsakes />");
    expect((portrait.match(/\bdata-module=/g) ?? []).length).toBe(3);
    expect(keepsakes).not.toMatch(/\bdata-module=/);
  });
  it("the keepsake views are the Growth hub's own: words, firsts, tree and the month", () => {
    for (const view of ["<FirstWordsLedger />", "<DevScoreCard />", "<ArborTreeCard />", "<MonthInReview />"]) expect(keepsakes).toContain(view);
  });
});

describe("CLINICAL FIREWALL on the thread map", () => {
  it("per-period counts are no longer drawn side by side (a trend reading); the mark and first line stay", () => {
    expect(portrait).not.toContain("portrait-cell-count");
    expect(portrait).toContain('className="portrait-mark"');
    expect(portrait).toContain('className="portrait-cell-label"');
  });
  it("areas carry no 01–08 index (an order is a ranking)", () => {
    expect(portrait).not.toContain("portrait-domain-index");
    expect(portrait).not.toContain('padStart(2, "0")');
  });
});

describe("kept quotes show on My child through the Words view (B-GROWTH-36)", () => {
  it("the Words view is the ledger, which lists 'Things {name} said' from 3", () => {
    const ledger = read("components/growth/FirstWordsLedger.tsx");
    expect(keepsakes).toContain('{view === "words" ? <FirstWordsLedger />');
    expect(ledger).toContain("<SaidList ");
  });
  it("B-LOOP-10 holds: a quote never becomes a record observation (no shelf, no coverage count)", () => {
    const doc = quoteKeepsakeDoc("The moon is following us", new Date("2026-10-08T19:00:00Z"))!;
    expect(toObservations({ keepsakes: [doc] } as never, { id: "child-a" } as never)).toEqual([]);
  });
});
