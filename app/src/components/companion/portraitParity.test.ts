import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { toObservations } from "../../lib/observations";

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

describe("a kept quote is part of the record (B-GROWTH-36)", () => {
  const child = { id: "child-a", ageMonths: 40 } as never;
  it("files under talking with its own id, instead of being dropped for having no milestone", () => {
    const out = toObservations({ keepsakes: [{ id: "quote-2026-10-08-abc", kind: "quote", milestoneId: "", note: "The moon is following us", noticedOn: "2026-10-08", createdAt: "2026-10-08T19:00:00Z", updatedAt: "2026-10-08T19:00:00Z" }] } as never, child);
    const quote = out.find((o) => o.id === "keepsakes:quote-2026-10-08-abc");
    expect(quote).toBeDefined();
    expect(quote!.domains).toEqual(["talking"]);
    expect(quote!.value).toMatchObject({ type: "keepsake", milestoneId: "", note: "The moon is following us" });
  });
  it("NEGATIVE CONTROL: a milestone keepsake still resolves through its milestone", () => {
    const out = toObservations({ keepsakes: [{ milestoneId: "unknown-ms", note: "x", noticedOn: "2026-10-08", createdAt: "2026-10-08T19:00:00Z", updatedAt: "2026-10-08T19:00:00Z" }] } as never, child);
    expect(out.find((o) => o.id === "keepsakes:unknown-ms")).toBeUndefined();
  });
  it("opening a kept quote goes where quotes live", () => {
    expect(portrait).toContain('if (o.origin === "keepsakes" && o.value.type === "keepsake" && !o.value.milestoneId) { setActiveTab("language"); return; }');
  });
});
