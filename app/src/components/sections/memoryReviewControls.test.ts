/**
 * GP-13 — memory review: no edit, no expiry date, danger-toned expiry chip.
 *
 * The surface contract for `memory` promises "Approve, EDIT, or forget", and
 * the server has accepted `{ fact, retention, source }` on the transition since
 * the ledger was written (memory/memoryService.transitionMemory, reachable via
 * PATCH /api/memory/:memoryId). The UI mounted approve / dismiss / forget and
 * nothing else — the flagship trust mechanic let a parent DELETE a fact but not
 * CORRECT one ("she is 3" → "she is 4"). Meanwhile the expiry rendered as
 * `<Chip tone="pink">Time-boxed · {retention}</Chip>`, pink being this row's
 * delete tone: the safest property the ledger has, painted as danger, with no
 * date attached.
 *
 * SOURCE scan (`environment: "node"`). \r\n normalised first; every extraction
 * asserted truthy before it is judged; each rule carries a negative control
 * built from the pre-change source.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) =>
  readFileSync(path.join(here, "..", "..", rel), "utf8").replace(/\r\n/g, "\n");

const SRC = read("components/sections/ChildMemory.tsx");

/** The MemoryRow component body. */
function memoryRow(src: string): string {
  const start = src.indexOf("export function MemoryRow(");
  return start === -1 ? "" : src.slice(start);
}

/* ── Pre-change source, verbatim ───────────────────────────────────────────── */
const OLD_ROW = `export function MemoryRow({ m, busy, onApprove, onReject, onForget }: {
  m: MemoryReviewItem;
}) {
  const timeBoxed = m.retention && !/permanent|indefinite/i.test(m.retention);
  return (
    <div>
      <p>{m.fact}</p>
      {timeBoxed && <Chip tone="pink">{t("elev.childmem.timeBoxed", { retention: m.retention ?? "" })}</Chip>}
    </div>
  );
}`;

describe("GP-13 negative controls — the matchers reject the pre-change row", () => {
  it("the old row is extracted (so the scan is not vacuous) and fails every rule", () => {
    const row = memoryRow(OLD_ROW);
    expect(row).toBeTruthy();
    expect(row).toMatch(/<Chip tone="pink">/);
    expect(row).not.toMatch(/data-testid="memory-edit-open"/);
    expect(row).not.toMatch(/method: "PATCH"/);
    expect(row).not.toMatch(/forgetsOnIso/);
  });
});

describe("GP-13 — the parent can CORRECT a fact, not only delete it", () => {
  const row = memoryRow(SRC);

  it("the row is found", () => {
    expect(row, "MemoryRow not found in ChildMemory.tsx").toBeTruthy();
    expect(row.length).toBeGreaterThan(800);
  });

  it("mounts an edit control with a fact field and a retention choice", () => {
    expect(row).toContain('data-testid="memory-edit-open"');
    expect(row).toContain('data-testid="memory-edit-fact"');
    expect(row).toContain('data-testid="memory-edit-retention"');
    expect(row).toContain("RETENTION_CHOICES.map");
  });

  it("posts the edit through the EXISTING server transition, keeping the row's status", () => {
    expect(row).toMatch(/fetch\(`\/api\/memory\/\$\{encodeURIComponent\(m\.memoryId\)\}`/);
    expect(row).toMatch(/method: "PATCH"/);
    // status: m.status — correcting an approved fact must not re-queue it.
    expect(row).toMatch(/body: JSON\.stringify\(\{ status: m\.status, fact, retention: retentionDraft \}\)/);
    expect(row).toContain("await authHeaders()");
  });

  it("re-reads the ledger after a successful edit, and says so honestly when it fails", () => {
    expect(row).toMatch(/onEdited\?\.\(\)/);
    expect(row).toContain('t("elev.waveR.mem.saveFailed")');
  });

  it("only the surface that owns the ledger read gets the edit control", () => {
    // MemoryRow is reused by the Story timeline overlay, which passes no
    // onEdited — that surface keeps exactly the controls it had.
    expect(row).toMatch(/\{onEdited && !busy && !editing && \(/);
    expect(SRC).toMatch(/onEdited=\{retryMemoryReview\}/);
  });

  it("keeps 44px targets on the edit form controls", () => {
    expect(row).toMatch(/data-testid="memory-edit-retention"[\s\S]{0,400}?minHeight: 44/);
    expect(row).toMatch(/data-testid="memory-edit-save"[\s\S]{0,800}?minHeight: 44/);
  });
});

describe("GP-13 — the expiry is a DATE in a neutral tone", () => {
  const row = memoryRow(SRC);

  it("no pink chip remains on the row", () => {
    expect(row).toBeTruthy();
    expect(row).not.toMatch(/<Chip tone="pink">/);
    // …and the danger tone is still reserved for the destructive control.
    expect(row).toMatch(/onForget[\s\S]{0,300}?var\(--arbor-pink-ink\)/);
  });

  it("renders the day the fact forgets itself, from the shared helper", () => {
    expect(row).toContain('data-testid="memory-expiry-chip"');
    expect(row).toContain("forgetsOnIso(");
    expect(row).toContain('t("elev.waveR.mem.forgetsOn"');
    expect(row).toMatch(/fmtDay\(forgetsOn, uiLang\)/);
    expect(SRC).toContain('from "../../lib/memoryExpiry"');
  });

  it("a permanent fact says so instead of inventing a date", () => {
    expect(row).toContain("isPermanentRetention(");
    expect(row).toContain('t("elev.waveR.mem.keptUntilForget")');
    expect(row).toMatch(/permanent \|\| !forgetsOn/);
  });

  it("the dead time-boxed string is no longer rendered anywhere on this surface", () => {
    expect(SRC).not.toContain("elev.childmem.timeBoxed");
  });
});

describe("GP-13 — every new control is translated (AI-11 rule holds)", () => {
  const row = memoryRow(SRC);
  it("uses i18n keys, never English literals, for the edit affordances", () => {
    for (const key of [
      "elev.waveR.mem.edit",
      "elev.waveR.mem.edit.aria",
      "elev.waveR.mem.edit.factLabel",
      "elev.waveR.mem.edit.retentionLabel",
      "elev.waveR.mem.save",
      "elev.waveR.mem.cancel",
    ]) {
      expect(row).toContain(`"${key}"`);
    }
  });

  it("the keys exist in BOTH dictionaries", async () => {
    const waveR = await import("../../lib/i18nElevation/waveR");
    expect(Object.keys(waveR.en).length).toBeGreaterThan(0);
    for (const key of Object.keys(waveR.en)) {
      expect(waveR.he[key], `missing HE for ${key}`).toBeTruthy();
    }
    expect(Object.keys(waveR.he).length).toBe(Object.keys(waveR.en).length);
  });
});
