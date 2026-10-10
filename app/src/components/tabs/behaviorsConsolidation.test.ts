import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { matchesJournalFilter } from "../../lib/journalFilters";
const read = (file: string) => readFileSync(resolve(process.cwd(), "src", file), "utf8");
const behaviors = read("components/tabs/BehaviorsTab.tsx");
const journal = read("components/tabs/JournalTab.tsx");
const context = read("context/ArborContext.tsx");

describe("B-ASKJB-23: one capture and one record", () => {
  it("retires the duplicate capture writer and record grid", () => {
    expect(behaviors).not.toMatch(/\bnewLog\w*|\bsetNewLog\w*|<ConfirmCaptureReview|<motion\.form|pendingCaptureMode|grouped\.map/);
    expect(behaviors).toContain('onText={() => openCaptureSheet({ mode: "text" })}');
    expect(behaviors).toContain('onMode={(mode) => openCaptureSheet({ mode })}');
  });
  it("opens Journal hard moments rather than the shelves landing", () => {
    expect(behaviors).toContain('requestJournalFilter("hard")');
    expect(journal).toContain("pendingJournalFilter");
    expect(journal).toContain("consumeJournalFilter()");
    expect(journal).toContain("setJournalQuery(\"\")");
    expect(context).toContain("requestJournalFilter");
  });
  it("preserves log details and scripts at the Journal entry", () => {
    const path = "components/journal/JournalMomentDetails.tsx";
    expect(existsSync(resolve(process.cwd(), "src", path))).toBe(true);
    if (!existsSync(resolve(process.cwd(), "src", path))) return;
    const details = read(path);
    for (const action of ["handleGetInlineCoRegulationScript(log)", "<SayThis", "seed.logCoreg", "contextLabel(log.context, t)", "log.notes"]) expect(details).toContain(action);
    expect(read("components/journal/JournalEntrySheet.tsx")).toContain("<JournalMomentDetails");
  });
  it("receives the shared saved-row echo without another capture path", () => {
    expect(behaviors).toContain("lastSavedBehavior");
    expect(context).toContain("setLastSavedBehavior");
    expect(behaviors).toContain('data-testid="behaviors-pattern-echo"');
  });
  it("preserves all three log filters in the Journal predicate", () => {
    const logsById = new Map([["one", { behaviorType: "Transition Refusal", trigger: "Shoes", intensity: 3, resolved: false }]]);
    const signal = { id: "moment-one", kind: "moment" } as any;
    const base = { filter: "hard", query: "", logsById, keptIds: new Set(), labelOf: () => "Transition Refusal" } as any;
    expect(matchesJournalFilter(signal, { ...base, type: "Sleep Meltdown" })).toBe(false);
    expect(matchesJournalFilter(signal, { ...base, intensity: "5" })).toBe(false);
    expect(matchesJournalFilter(signal, { ...base, status: "resolved" })).toBe(false);
    expect(matchesJournalFilter(signal, { ...base, type: "Transition Refusal", intensity: "3", status: "open" })).toBe(true);
  });
});
