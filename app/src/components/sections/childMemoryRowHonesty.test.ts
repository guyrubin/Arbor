/**
 * Two honesty rules on the memory row.
 *
 * (1) THE EXPIRY CHIP TELLS THE TRUTH ABOUT THE ROW IT IS ON.
 *     `MemoryRow` is used for BOTH the pending queue and the approved list, and
 *     it rendered "Forgets on {date}" unconditionally. Server retention is
 *     enforced on read and drops `status === "approved"` only
 *     (memory/memoryService.enforceMemoryRetention), so nothing will ever expire
 *     a pending proposal: an unreviewed queue item sat there showing a date that
 *     had already gone by. The chip is now gated on the approved status.
 *
 * (2) THE PARENT WHO TYPES A CLINICAL TERM HEARS ABOUT IT, AT EDIT TIME.
 *     The edit PATCH writes parent prose into the approved ledger, and the
 *     approved ledger feeds `buildSharedScopePacket`, which runs
 *     `findClinicalDiagnosisTerm` for every non-clinician recipient and fails
 *     closed with 422. Correct, but silent: the co-parent hit a blank share and
 *     neither party could tell why. The row now runs the SAME scanner while the
 *     parent edits — as advice, never as a second guard.
 *
 * Scan discipline: \r\n normalised first; every extraction asserted truthy; each
 * rule negative-controlled against the pre-change source shape.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findClinicalDiagnosisTerm } from "../../lib/clinicalScan";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(here, "ChildMemory.tsx"), "utf8").replace(/\r\n/g, "\n");

function memoryRow(src: string): string {
  const start = src.indexOf("export function MemoryRow(");
  return start === -1 ? "" : src.slice(start);
}

const ROW = memoryRow(SRC);

/** The pre-change chip + edit form, verbatim — the negative control. */
const PRE_CHANGE = `export function MemoryRow({ m, busy, onApprove, onReject, onForget, onEdited }: {
  const saveEdit = async () => {
    const fact = factDraft.trim();
    if (!fact) return;
  };
        <span data-testid="memory-expiry-chip">
          <Chip tone="lav">
            {permanent || !forgetsOn
              ? t("elev.waveR.mem.keptUntilForget")
              : t("elev.waveR.mem.forgetsOn", { date: fmtDay(forgetsOn, uiLang) })}
          </Chip>
        </span>
`;

describe("the scan is real, not vacuous", () => {
  it("found the row in both the shipped source and the control", () => {
    expect(SRC.length).toBeGreaterThan(4000);
    expect(ROW).toBeTruthy();
    expect(ROW.length).toBeGreaterThan(800);
    expect(memoryRow(PRE_CHANGE)).toBeTruthy();
  });
});

describe("(1) the expiry chip renders only where it is true", () => {
  it("the chip is gated on the approved status", () => {
    expect(ROW).toContain('const showsExpiry = m.status === "approved";');
    expect(ROW).toMatch(/\{showsExpiry && \(\s*\n?\s*<span data-testid="memory-expiry-chip">/);
  });

  it("NEGATIVE CONTROL — the pre-change row rendered it unconditionally", () => {
    const pre = memoryRow(PRE_CHANGE);
    expect(pre).toContain('data-testid="memory-expiry-chip"'); // the chip was there…
    expect(pre).not.toContain("showsExpiry"); // …and nothing gated it.
    expect(/\{showsExpiry && \(/.exec(pre)).toBeNull();
  });

  it("the approved case is untouched — same helper, same anchor as the server", () => {
    // forgetsOnIso and the server's isMemoryExpired both read `createdAt`;
    // changing either side without the other is what would make the date lie.
    expect(ROW).toContain("forgetsOnIso({ retention: m.retention, createdAt: m.createdAt })");
    expect(ROW).toContain('t("elev.waveR.mem.forgetsOn"');
    expect(ROW).toContain('t("elev.waveR.mem.keptUntilForget")');
  });

  it("the retention-clock behaviour is recorded for the next reader", () => {
    // An edit appends a ledger event with a fresh createdAt and foldMemoryEvents
    // keeps the latest, so a correction restarts the window. Undocumented, this
    // reads as a bug on the next pass.
    expect(ROW).toMatch(/restarts its retention clock/);
  });
});

describe("(2) the clinical-term note is raised at edit time", () => {
  it("the row runs the SAME scanner the share egress fails closed on", () => {
    expect(SRC).toContain('from "../../lib/clinicalScan"');
    expect(SRC).toContain("findClinicalDiagnosisTerm");
    expect(ROW).toContain("const clinicalTerm = editing ? findClinicalDiagnosisTerm(factDraft) : null;");
    expect(ROW).toContain('data-testid="memory-edit-clinical-note"');
    expect(ROW).toContain('t("elev.waveR.mem.clinicalNote", { term: clinicalTerm })');
  });

  it("NEGATIVE CONTROL — the pre-change row scanned nothing", () => {
    const pre = memoryRow(PRE_CHANGE);
    expect(pre).toContain("const saveEdit = async () => {"); // the PATCH path existed…
    expect(pre).not.toContain("findClinicalDiagnosisTerm"); // …unscreened.
    expect(pre).not.toContain("memory-edit-clinical-note");
  });

  it("it is ADVICE, not a second guard — the save stays enabled", () => {
    // Fail-closed enforcement belongs at the egress. If the disabled condition
    // ever grows a clinicalTerm clause, a parent can no longer correct a fact
    // that says "delay", which is a worse outcome than a blocked share.
    const disabled = /disabled=\{([^}]*)\}/.exec(ROW);
    expect(disabled, "save button disabled= not found").toBeTruthy();
    expect(disabled![1]).toBe("saving || !factDraft.trim()");
    expect(disabled![1]).not.toContain("clinicalTerm");
    // …and the submit handler does not bail on the term either.
    const save = /const saveEdit = async \(\) => \{[\s\S]*?\n  \};/.exec(ROW);
    expect(save).toBeTruthy();
    expect(save![0]).not.toContain("clinicalTerm");
  });

  it("the scanner really fires on the words that block a share", () => {
    // Non-vacuity for the note itself: if the scanner returned null for these,
    // the UI above would be dead code.
    expect(findClinicalDiagnosisTerm("she has a speech delay")).toBe("delay");
    expect(findClinicalDiagnosisTerm("סימנים של עיכוב שפתי")).toBe("עיכוב");
    // NEGATIVE CONTROL: ordinary parent prose raises nothing.
    expect(findClinicalDiagnosisTerm("she loves the blue cup at breakfast")).toBeNull();
    expect(findClinicalDiagnosisTerm("")).toBeNull();
  });

  it("the note is translated in BOTH dictionaries (AI-11 holds on this surface)", async () => {
    const waveR = await import("../../lib/i18nElevation/waveR");
    const key = "elev.waveR.mem.clinicalNote";
    expect(waveR.en[key]).toBeTruthy();
    expect(waveR.he[key]).toBeTruthy();
    expect(waveR.he[key]).not.toBe(waveR.en[key]);
    // The term is interpolated, not hard-coded, in both.
    expect(waveR.en[key]).toContain("{term}");
    expect(waveR.he[key]).toContain("{term}");
    // And the dictionaries stay in lockstep overall.
    expect(Object.keys(waveR.he).length).toBe(Object.keys(waveR.en).length);
  });
});
