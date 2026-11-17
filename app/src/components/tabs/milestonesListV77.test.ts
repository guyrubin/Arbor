import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// V77 (N-ChildList-D/M, "adopt the structure as drawn"): the list is the map's
// band with the area tiles as its filter, then a grid of the chosen area's
// cards, each with its "Seen it · <day>" or "Next to notice" chip. Source pins.
const MS = readFileSync(path.join(__dirname, "MilestonesTab.tsx"), "utf8");
const grid = MS.slice(MS.indexOf("const gridCards = useMemo(() => {"), MS.indexOf("const gridIds = "));
const card = MS.slice(MS.indexOf('<ul className="msl-grid" data-testid="ms-area-grid" role="list">'), MS.indexOf("</ul>", MS.indexOf('data-testid="ms-area-grid"')));

describe("V77 list — the area grid", () => {
  it("what to notice next first (the shelf's Notice card, then the area's around-now rows not yet Seen), then every Seen it by its day", () => {
    expect(grid).toContain('if (pick) out.push({ m: pick, shelf, kind: "next", pick: true });');
    expect(grid).toContain('if (m.id !== pick?.id && !isSeenIt(m)) out.push({ m, shelf, kind: "next", pick: false });');
    expect(grid).toContain('seen.sort((a, b) => (Date.parse(a.m.observationUpdatedAt ?? "") || 0) - (Date.parse(b.m.observationUpdatedAt ?? "") || 0));');
    expect(grid).toContain("return [...out, ...seen];");
  });

  it("each card: its chip (Seen it · the V10 day, or Next to notice), the answer flow, Earlier and later", () => {
    expect(card).toContain('data-testid="ms-card-chip"');
    expect(card).toContain("{at && <span> · <time dateTime={at}>{fmtDayV10(at, uiLang)}</time></span>}");
    expect(card).toContain("{pick ? renderPick(m, shelf, stamp) : renderRow(m, shelf, stamp, true)}");
    expect(card).toContain("<EarlierLater milestone={m} milestones={milestones}");
  });

  it("counts and days only: the chip never grades (no verdict words, no colour by state)", () => {
    expect(card).not.toMatch(/\b(behind|ahead|on track|late|delayed?|score)\b|%/i);
    expect(card).not.toMatch(/green-soft|red|amber/);
  });

  it("NEGATIVE CONTROL: an undated Seen it shows no invented day (the chip's date needs observationUpdatedAt)", () => {
    expect(card).toContain('const at = kind === "seen" ? m.observationUpdatedAt : undefined;');
    expect(card).not.toContain("new Date()");
  });

  it("the route keeps ONE stamp, on the grid's first unanswered card", () => {
    const code = MS.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code.match(/data-primary-move/g)).toHaveLength(1);
    expect(card).toContain("const stamp = m.id === gridStampId ?");
  });

  it("the stamp stays on the held card (the one just answered) while it is in the grid; otherwise the first unanswered card", () => {
    expect(MS).toContain("const heldId = heldCard && heldCard.childId === childProfile.id && gridIds.has(heldCard.id) ? heldCard.id : null;");
    expect(MS).toContain("const gridStampId = heldId ?? gridCards.find(");
    expect(MS).toContain("setHeldCard({ childId: childProfile.id, id: item.id });");
    // both card kinds carry it in either phase (answers while asking, Change once held)
    expect(MS.match(/heldAttrs=\{answersAttrs\}/g)).toHaveLength(2);
  });
  it("NEGATIVE CONTROL: with nothing held the stamp is never on an answered card", () => {
    expect(MS).toMatch(/gridCards\.find\(\(c\) => c\.kind === "next" && !c\.m\.observationStatus && !c\.m\.checked/);
  });
});
