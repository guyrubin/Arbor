/**
 * Wave L · TJB-13 — journal rows were inert.
 *
 * A saved moment rendered as an `<article>` with a two-line clamp and no
 * control of any kind: the parent could not read the rest of what they wrote,
 * could not fix a typo, and could not confirm what had actually been stored.
 * Capture was, in practice, write-only.
 *
 * The repo's vitest env is node (no DOM), so the render wiring is pinned by a
 * source scan — every assertion below carries a negative control built from
 * the shipped pre-change shape, so none of them can pass vacuously.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, rel), "utf8");
// Normalise line endings FIRST. Git checks these files out with CRLF on
// Windows, so a source scan whose extraction regex anchors on a newline +
// closing brace matches nothing there: the extraction returns "" and every
// assertion below would pass vacuously were they not guarded by toBeTruthy().
const strip = (code: string) =>
  code.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const journal = strip(read("./JournalTab.tsx"));
const sheet = strip(read("../journal/JournalEntrySheet.tsx"));

/** The shipped row: an inert article with no handler and no affordance. */
const SHIPPED_ROW = `<article
      id={\`journal-signal-\${signal.id}\`}
      className="flex gap-3.5 border-b py-4 last:border-b-0 rounded-xl transition-colors"
    >`;

describe("TJB-13 — the row is a control", () => {
  const row = /function JournalRow\(\{[\s\S]*?\n\}\n/.exec(journal)?.[0] ?? "";

  it("renders as a real button, so keyboard and screen readers get the same door", () => {
    expect(row).toBeTruthy();
    expect(row).toMatch(/<button\s+type="button"/);
    expect(row).toContain("onClick={onOpen}");
    // Negative control: the shipped shape has neither.
    expect(SHIPPED_ROW).not.toContain("onClick");
    expect(SHIPPED_ROW).not.toMatch(/<button/);
  });

  it("keeps the deep-link anchor id so evidence links still land on it", () => {
    // TODAY-6 scrolls to `journal-signal-<id>`; making the row a button must
    // not move that id off the element being scrolled to.
    expect(row).toContain("id={`journal-signal-${signal.id}`}");
  });

  it("every rendered row is given an open handler", () => {
    expect(journal).toContain("onOpen={() => setOpenSignal(s)}");
  });
});

describe("TJB-13 — the sheet reads the entry and routes to the ONE editor", () => {
  it("JournalTab mounts the sheet once for the whole feed", () => {
    expect(journal).toContain("<JournalEntrySheet");
    expect(journal).toContain("signal={openSignal}");
  });

  it("editing goes through the existing startEditLog + Behaviors form", () => {
    const edit = /const editOpenSignal = \(\) => \{[\s\S]*?\n  \};/.exec(journal)?.[0] ?? "";
    expect(edit).toBeTruthy();
    expect(edit).toContain("startEditLog(logId)");
    expect(edit).toContain('setActiveTab("behaviors")');
    // No second log form: the sheet must not own draft state or a write.
    expect(sheet).not.toMatch(/setNewLog|handleAddLog|upsert\(/);
  });

  it("only the parent's OWN moments are editable — never an Arbor or child row", () => {
    // The id gate: an edit handler exists only for `moment-` signals…
    const gate = /const openMomentLogId =[\s\S]*?;\n/.exec(journal)?.[0] ?? "";
    expect(gate).toContain('s.kind === "moment"');
    expect(gate).toContain('s.id.startsWith("moment-")');
    expect(journal).toContain("onEdit={openMomentLogId(openSignal) ? editOpenSignal : undefined}");
    // …and the sheet re-checks provenance before drawing the button.
    expect(sheet).toContain('onEdit && prov === "manual"');
  });

  it("FIREWALL: the sheet shows the entry's own content, nothing derived", () => {
    expect(sheet).not.toMatch(/intensity|score|percent|trend|delta|avg/i);
  });

  it("uses the shared Modal (focus trap + restore), not a hand-rolled overlay", () => {
    expect(sheet).toContain('import { Modal } from "../ui/Modal"');
  });
});
