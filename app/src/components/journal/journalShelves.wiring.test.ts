import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contractFor } from "../../lib/surfaceContract";
import type { ActiveTab } from "../../lib/routes";

/* B-LOOP-11 — the wiring, as source facts (no jsdom in this repo): JournalTab
   v2 dispatches on the hash query, the ONE stamp literal moved to open-shelf
   together with the contract, the capture sheet is pre-filed on the shelf,
   Today honours "Try it today", and every journal capability keeps a door. */

const src = (rel: string) =>
  readFileSync(path.resolve(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("JournalTab v2 — the grid is the journal's top", () => {
  const journal = strip(src("tabs/JournalTab.tsx"));
  it("no query → the shelves; ?view=all → the day-grouped thread (every feed capability intact)", () => {
    expect(journal).toContain('if (view === "all") return <JournalFeed primaryMoveProps={primaryMoveProps} densityToggle={densityToggle} />;');
    expect(journal).toContain('return <JournalShelves shelf={shelf} pro={view === "pro"} intakeFor={query.get("for")} primaryMoveProps={primaryMoveProps} />;');
    expect(journal).toContain("function JournalFeed(");
  });
  it("an evidence deep-link always lands on the thread, where its row is rendered", () => {
    expect(journal).toMatch(/if \(!pendingJournalFocusId\) return;[\s\S]*routeHash\("journal", \{ view: "all" \}\)/);
  });
});

describe("the ONE stamp literal and the contract change together", () => {
  it("TimelineTab stamps open-shelf on #/journal; the contract says the same", () => {
    expect(strip(src("tabs/TimelineTab.tsx"))).toContain('{ "data-primary-move": density === "story" ? "switch-density" : "open-shelf" }');
    const c = contractFor("journal" as ActiveTab)!;
    expect(c.primaryMove).toBe("open-shelf");
    expect(c.moduleBudget).toBe(3);
    expect(c.job).toBe("See {name} shelf by shelf, and what to try next.");
    expect(c.threadWrite).toBe("behaviorLogs");
  });
  it("B-OCCL-04: the grid passes the stamp to ShelfGrid, which spreads it on the registry-first tile only — never the grid", () => {
    expect(strip(src("journal/JournalShelves.tsx"))).toMatch(/<ShelfGrid[\s\S]{0,400}?primaryMoveProps=\{primaryMoveProps\}/);
    const grid = strip(src("journal/ShelfGrid.tsx"));
    expect(grid).toContain('<div data-testid="shelf-grid" className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">');
    expect(grid).toContain("{ordered.map((def, i) => {");
    expect(grid).toContain("{...(i === 0 ? primaryMoveProps ?? {} : {})}");
    expect(grid.match(/primaryMoveProps/g)).toHaveLength(3); // the prop type, the destructure, the one spread
  });
});

describe("the doors and seams", () => {
  const shelves = strip(src("journal/JournalShelves.tsx"));
  it("tile → ?shelf=<id>, flip → ?view=pro, Everything by date → ?view=all, back → the grid", () => {
    expect(shelves).toContain('onOpenShelf={(id) => goToRoute("journal", { shelf: id })}');
    expect(shelves).toContain('onOpenPro={() => goToRoute("journal", { view: "pro" })}');
    expect(shelves).toContain('onOpenAll={() => goToRoute("journal", { view: "all" })}');
    expect(shelves).toContain('onBack={() => goToRoute("journal")}');
  });
  it("the capture sheet opened from a shelf page files the moment on that shelf", () => {
    expect(shelves).toContain("<QuickLogModal open={capture.open} mode={capture.mode} shelf={shelf ?? undefined}");
    expect(strip(src("overview/QuickLogModal.tsx"))).toContain("...(shelf ? { shelf } : {}),");
  });
  it('"Try it today" pins the practice and Today\'s chooser honours the pin (a dose row wins)', () => {
    expect(shelves).toContain("writeTodayPin(childProfile.id, practicePick.practice.id);");
    expect(strip(src("tabs/OverviewTab.tsx"))).toContain("todayPracticeId: dose?.practiceId ?? readTodayPin(childProfile.id, now),");
  });
  it("no runtime image generation and no Kid Mode import on the journal's new screens", () => {
    for (const f of ["journal/JournalShelves.tsx", "journal/ShelfGrid.tsx", "journal/ShelfPage.tsx"]) {
      const s = strip(src(f));
      expect(s).not.toMatch(/generateImage/);
      expect(s).not.toMatch(/kidmode\//);
    }
  });
});

describe("B-LOOP-12 — the professional view reuses the ONE consult egress", () => {
  const shelves = strip(src("journal/JournalShelves.tsx"));
  const consult = strip(src("tabs/ConsultTab.tsx"));
  const ask = strip(src("sections/AskSpecialist.tsx"));
  it("PDF · Copy · Send open #/consult?intake=<profession>; no second egress in the journal", () => {
    expect(shelves).toContain('onEgress={() => goToRoute("consult", { intake: profession })}');
    for (const f of ["journal/JournalShelves.tsx", "journal/ProView.tsx"]) {
      const s = strip(src(f));
      expect(s).not.toMatch(/serializeForExport|exportPrintSections|navigator\.clipboard|mailto:|useConsultPdf/);
    }
  });
  it("Consult reads the preset and the step-3 egress carries the intake packet behind the same reviewed gate", () => {
    expect(consult).toContain('const intakeRaw = useHashQuery().get("intake");');
    expect(consult).toContain("intake={intake}");
    expect(ask).toContain("const packet = useMemo(() => intakePacket ?? presetPacket(audience, fullPacket), [intakePacket, audience, fullPacket]);");
    expect(ask).toContain('const egressAudience: ExportAudience = intakePacket ? "self" : audience;');
    expect(ask).toContain("serializeForExport(egressAudience, packet, excluded, visionNote");
    expect(ask).toContain("exportPrintSections(egressAudience, packet, excluded, visionNote");
    expect(ask).toContain("const noneSelected = includedCount === 0 || !reviewed || exportText == null;");
  });
});
