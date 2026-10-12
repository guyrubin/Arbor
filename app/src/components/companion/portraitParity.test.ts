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
  // v3 F-CHILD-1 RE-PIN: My child is the Milestones pill, one scroll of two
  // modules (the portrait cards, then the areas table). The watch row folds
  // into its area row and the keepsake disclosure leaves the page (the brief's
  // child-watch-row and child-words-keepsakes gaps); both files stay unmounted
  // on disk. Was: watch row + keepsakes in the overview module, 3 modules.
  it("v3 F-CHILD-1: the portrait cards and the areas table are the page's two modules", () => {
    const cards = portrait.slice(portrait.indexOf('data-module="child-milestones-portrait"'), portrait.indexOf('data-module="child-milestones-areas"'));
    const areas = portrait.slice(portrait.indexOf('data-module="child-milestones-areas"'));
    expect(cards).toContain("<PortraitCards ");
    expect(areas).toContain("<MilestoneAreas key={childProfile.id}");
    expect((portrait.match(/\bdata-module=/g) ?? []).length).toBe(2);
    expect(portrait).not.toContain("<PortraitWatchRow");
    expect(portrait).not.toContain("<PortraitKeepsakes");
    expect(keepsakes).not.toMatch(/\bdata-module=/);
  });
  it("the keepsake views retain firsts/tree and use the unified month reader", () => {
    for (const view of ["<KeptThingsPage key={childProfile.id} />", "<DevScoreCard />", "<ArborTreeCard />"]) expect(keepsakes).toContain(view);
  });
});

describe("CLINICAL FIREWALL on the thread map", () => {
  // v3 F-CHILD-1 RE-PIN: the thread map moves to the Moments pill (F-CHILD-2),
  // so its mark and first-line positives leave this page; the negatives stay.
  it("per-period counts are no longer drawn side by side (a trend reading)", () => {
    expect(portrait).not.toContain("portrait-cell-count");
  });
  it("areas carry no 01–08 index (an order is a ranking)", () => {
    expect(portrait).not.toContain("portrait-domain-index");
    expect(portrait).not.toContain('padStart(2, "0")');
  });
});

describe("kept quotes show on My child through the unified reader (B-ASKJB-36)", () => {
  it("the kept view reads explicit quote documents at every age", () => {
    const reader = read("components/kept/KeptThingsPage.tsx");
    expect(keepsakes).toContain('{view === "kept" ? <KeptThingsPage');
    expect(reader).toContain('useChildHistory<KeepsakeDoc>(childId, "keepsakes")');
  });
  it("B-LOOP-10 holds: a quote never becomes a record observation (no shelf, no coverage count)", () => {
    const doc = quoteKeepsakeDoc("The moon is following us", new Date("2026-10-08T19:00:00Z"))!;
    expect(toObservations({ keepsakes: [doc] } as never, { id: "child-a" } as never)).toEqual([]);
  });
});
