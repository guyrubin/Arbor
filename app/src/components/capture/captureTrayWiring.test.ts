import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * AI-04 — the tray is BUILT and WIRED, and it writes through the existing
 * seams rather than a second one.
 *
 * The vitest env is node-only, so these are SOURCE-BASED structural guards in
 * the house pattern (overview/typedCaptureExtraction.test.ts,
 * coach/coachHandoffGate.test.ts). Each scanned file is asserted real and
 * non-empty first — this repo has shipped vacuous scans — and each rule
 * carries a negative control reconstructing the shape the defect produces.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");
/** Drop comments so prose about a rule can never satisfy a scan. */
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const TRAY_PATH = "components/capture/CaptureProposalsTray.tsx";
const trayRaw = read(TRAY_PATH);
const tray = stripComments(trayRaw);
const journalRaw = read("components/tabs/JournalTab.tsx");
const journal = stripComments(journalRaw);
const sheet = stripComments(read("components/journal/JournalEntrySheet.tsx"));

describe("the scan is real", () => {
  it("read actual files, not empty strings", () => {
    for (const [name, src] of [["tray", tray], ["journal", journal], ["sheet", sheet]] as const) {
      expect(src, name).toBeTruthy();
      expect(src.length, name).toBeGreaterThan(1000);
    }
  });
});

describe("the tray is mounted where a typed turn can be kept", () => {
  it("JournalTab imports and renders it", () => {
    expect(journal).toContain('import CaptureProposalsTray from "../capture/CaptureProposalsTray"');
    expect(journal).toMatch(/<CaptureProposalsTray\s+surface="journal"\s*\/>/);
  });

  it("NEGATIVE CONTROL: an import with no mount would not satisfy the rule", () => {
    const importOnly = 'import CaptureProposalsTray from "../capture/CaptureProposalsTray";\nreturn <div />;';
    expect(/<CaptureProposalsTray\s+surface="journal"\s*\/>/.test(importOnly)).toBe(false);
  });
});

describe("'Keep this' runs the ONE durable-write seam, and records provenance from what it returns", () => {
  it("commits through ArborContext.commitConversationProposal", () => {
    expect(tray).toContain("commitConversationProposal");
    expect(tray).toMatch(/const record = await commitConversationProposal\(/);
  });

  it("the provenance row is keyed by the log id the COMMIT returned, never a guess", () => {
    expect(tray).toMatch(/const logId = record\.commitRef\?\.id/);
    const keepBlock = /const keep = async[\s\S]*?\n  };/.exec(tray)?.[0] ?? "";
    expect(keepBlock).toBeTruthy();
    // The commit must happen BEFORE the ledger write — a provenance row minted
    // from a predicted id would point at a row that may never exist.
    expect(keepBlock.indexOf("commitConversationProposal")).toBeLessThan(
      keepBlock.indexOf("recordCaptureProvenance"),
    );
    expect(keepBlock).toContain("promptKey: TYPED_TURN_PROMPT.key");
    expect(keepBlock).toContain("promptVersion: TYPED_TURN_PROMPT.version");
    expect(keepBlock).toContain('turnKind: "typed"');
    expect(keepBlock).toContain("sourceExcerpt: entry.proposal.sourceExcerpt");
  });

  it("NEGATIVE CONTROL: the pre-change shape (no provenance at all) fails these rules", () => {
    const shipped = `const keep = async (entry) => {
      await commitConversationProposal(entry.proposal);
      toast("saved");
    };`;
    expect(/const logId = record\.commitRef\?\.id/.test(shipped)).toBe(false);
    expect(shipped).not.toContain("recordCaptureProvenance");
  });

  it("the tray NEVER writes a behaviour log itself", () => {
    // The only durable write it may reach is the shared proposal seam. A
    // direct collection write here would bypass the audit record, the undo
    // path, and the provenance stamp all at once.
    for (const banned of ["logsCol", "upsert(", "setDoc(", "addDoc(", "handleAddLog"]) {
      expect(tray, `the tray must not call ${banned}`).not.toContain(banned);
    }
  });
});

describe("'Edit first' reuses the fail-closed ai-draft gate", () => {
  it("routes through requestCapture('ai-draft'), never a bare tab switch", () => {
    const editBlock = /const editFirst = \([\s\S]*?\n  };/.exec(tray)?.[0] ?? "";
    expect(editBlock).toBeTruthy();
    expect(editBlock).toMatch(/requestCapture\(\s*"ai-draft"\s*\)/);
    // Order matters: the gate must be armed BEFORE navigation, exactly as the
    // coach answer-card and overflow paths do (AI-05 / AI-CAP-4).
    expect(editBlock.indexOf('requestCapture("ai-draft")')).toBeLessThan(
      editBlock.indexOf('setActiveTab("behaviors")'),
    );
  });

  it("NEGATIVE CONTROL: the bypass shape AI-05 removed elsewhere fails here too", () => {
    const bypass = `const editFirst = (entry) => {
      setNewLogNotes(entry.proposal.summary);
      setActiveTab("behaviors");
    };`;
    expect(/requestCapture\(\s*"ai-draft"\s*\)/.test(bypass)).toBe(false);
  });
});

describe("duplicate protection is deterministic, never trusted to the model", () => {
  it("the tray runs the shared attachProposalConflicts check", () => {
    expect(tray).toContain("attachProposalConflicts");
    expect(tray).toContain("committedChanges: conversationChanges");
    expect(tray).toContain("behaviorLogs");
  });
});

describe("a kept row says where it came from, on the row and in the sheet", () => {
  it("the Journal feed stamps the origin only on rows that were actually kept", () => {
    expect(journal).toContain("provenanceForSignal(keptProvenance, s.id)");
    expect(journal).toMatch(/originLabel=\{provenanceForSignal\(keptProvenance, s\.id\) \? originLabel : ""\}/);
    expect(journal).toContain('data-testid="journal-row-origin"');
  });

  it("the entry sheet carries the full record: prompt version, question, and the day", () => {
    expect(sheet).toContain('data-testid="journal-entry-provenance"');
    expect(sheet).toContain('t("elev.waveR.provenance.line"');
    expect(sheet).toContain('t("elev.waveR.provenance.asked"');
    expect(sheet).toContain("version: kept.promptVersion");
  });

  it("NEGATIVE CONTROL: the chip is conditional — an unconditional stamp would be a false claim", () => {
    // If the origin chip ever renders for every row, a moment the parent wrote
    // in their own words would be labelled as Arbor's. Prove the guard would
    // notice: the shipped line must contain the conditional.
    expect(journal).not.toMatch(/originLabel=\{originLabel\}/);
  });
});

describe("no inline copy — every string is an i18n key", () => {
  it("the tray renders through t() and carries no Hebrew literal", () => {
    expect(tray).toContain('t("elev.waveR.capture.');
    // The i18nInlineCopy guard bans per-language literals in components/; this
    // is the same rule asserted locally so a regression is caught in this file.
    expect(/[֐-׿]/.test(tray)).toBe(false);
    expect(tray).not.toMatch(/uiLang === "he" \?\s*\{/);
  });
});
