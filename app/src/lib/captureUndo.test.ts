/**
 * N1-08 guard — Undo on Keep.
 *
 * Three things are defended, in descending order of how badly they would fail
 * in production:
 *
 *  1. The reversal never HARD-DELETES the audit record. `conversationChanges`
 *     exists to say "the parent kept this, then unkept it". A reversal that
 *     erased the record would leave a Journal that quietly disagrees with
 *     itself and no way to tell which count was right.
 *  2. MILESTONES ARE EXCLUDED (critic-vision BLOCK #1) — at the reversal, at
 *     both call sites, and in a negative control that asserts a milestone path
 *     wired to an undo action fails.
 *  3. Idempotence. A toast with an action does not auto-dismiss, so the Undo
 *     control sits on screen and WILL be pressed twice.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { undoKeptCapture, isUndoableCapture } from "./captureUndo";
import type { ConversationChangeRecord } from "./conversationProposals";
import { en as journalEn, he as journalHe } from "./i18nElevation/journal";

const record = (over: Partial<ConversationChangeRecord> = {}): ConversationChangeRecord => ({
  id: "turn-1-0",
  sessionId: "s1",
  turnId: "turn-1",
  childId: "c1",
  target: "journal",
  summary: "Read two books at bedtime.",
  sourceExcerpt: "we read two books",
  sourceLanguage: "en",
  confidence: 0.9,
  status: "committed",
  createdAt: "2026-09-15T10:00:00.000Z",
  confirmedBy: "parent",
  confirmedAt: "2026-09-15T10:00:01.000Z",
  providerCanWrite: false,
  commitRef: { collection: "behaviorLogs", id: "typed-turn-1-0" },
  ...over,
});

/** A collection that behaves like ArborContext's: undo TRANSITIONS, never removes. */
function fakeCollection(initial: ConversationChangeRecord[]) {
  let items = [...initial];
  const removed: string[] = [];
  const undoChange = vi.fn(async (id: string) => {
    const found = items.find((i) => i.id === id && i.status === "committed");
    if (!found) return;
    items = items.map((i) => (i.id === id ? { ...i, status: "undone" as const } : i));
  });
  return {
    readChanges: () => items,
    undoChange,
    /** Present only so the test can assert it is NEVER used. */
    removed,
    current: () => items,
  };
}

describe("N1-08 — the reversal is a status transition, and the audit row survives", () => {
  it("undo moves the record to 'undone' and leaves it in the collection", async () => {
    const col = fakeCollection([record()]);
    const outcome = await undoKeptCapture("turn-1-0", col);

    expect(outcome).toEqual({ undone: true, record: { ...record(), status: "undone" } });
    expect(col.undoChange).toHaveBeenCalledTimes(1);
    // The row is STILL THERE — one document, now marked undone.
    expect(col.current()).toHaveLength(1);
    expect(col.current()[0].status).toBe("undone");
    expect(col.removed).toHaveLength(0);
  });

  it("the module is handed NO delete seam — it could not hard-delete if it tried", () => {
    const src = readFileSync(path.join(process.cwd(), "src/lib/captureUndo.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    // The deps interface has exactly two members, neither of them a remover.
    expect(code).toMatch(/readChanges: \(\) => readonly ConversationChangeRecord\[\]/);
    expect(code).toMatch(/undoChange: \(id: string\) => void \| Promise<void>/);
    // No word boundaries: `removeChange` must fail this too, or a delete seam
    // could be added under a camelCase name and the pin would not notice.
    expect(code).not.toMatch(/remove|delete|destroy|purge|splice|filter\(/i);
  });

  it("NEGATIVE CONTROL — a reversal implemented as a hard delete fails the audit assertion", async () => {
    // Exactly the shape this item forbids: drop the record instead of
    // transitioning it. The behaviour assertion above goes red against it.
    let items = [record()];
    const hardDelete = {
      readChanges: () => items,
      undoChange: async (id: string) => { items = items.filter((i) => i.id !== id); },
    };
    const outcome = await undoKeptCapture("turn-1-0", hardDelete);
    expect(outcome.undone).toBe(true);
    // … and the audit trail is gone, which is the failure.
    expect(items).toHaveLength(0);
    expect(items.some((i) => i.status === "undone")).toBe(false);
  });
});

describe("N1-08 — idempotence: a toast with an action does not auto-dismiss, so Undo gets pressed twice", () => {
  it("the second press is a no-op and writes nothing", async () => {
    const col = fakeCollection([record()]);

    const first = await undoKeptCapture("turn-1-0", col);
    const second = await undoKeptCapture("turn-1-0", col);

    expect(first.undone).toBe(true);
    expect(second).toEqual({ undone: false, reason: "already_undone" });
    // One write, one audit row. Not two.
    expect(col.undoChange).toHaveBeenCalledTimes(1);
    expect(col.current()).toHaveLength(1);
  });

  it("an id that never landed refuses with not_found and writes nothing", async () => {
    const col = fakeCollection([]);
    expect(await undoKeptCapture("nope", col)).toEqual({ undone: false, reason: "not_found" });
    expect(col.undoChange).not.toHaveBeenCalled();
  });

  it("reads the collection LIVE — a stale snapshot would refuse every undo", async () => {
    // The toast closure is built before the commit lands. `readChanges` is a
    // function for exactly this reason.
    let items: ConversationChangeRecord[] = [];
    const col = {
      readChanges: () => items,
      undoChange: vi.fn(async () => { items = items.map((i) => ({ ...i, status: "undone" as const })); }),
    };
    // …the record arrives after the action was created…
    items = [record()];
    expect((await undoKeptCapture("turn-1-0", col)).undone).toBe(true);
  });
});

describe("N1-08 — milestones are excluded (critic-vision BLOCK #1)", () => {
  it("a milestone record is refused at the reversal itself, not only at the call site", async () => {
    const col = fakeCollection([record({ target: "milestone", milestoneId: "m-1" })]);
    expect(await undoKeptCapture("turn-1-0", col)).toEqual({
      undone: false,
      reason: "milestone_excluded",
    });
    expect(col.undoChange).not.toHaveBeenCalled();
    expect(col.current()[0].status).toBe("committed");
  });

  it("isUndoableCapture rejects milestones and already-undone records", () => {
    expect(isUndoableCapture(record())).toBe(true);
    expect(isUndoableCapture(record({ target: "milestone" }))).toBe(false);
    expect(isUndoableCapture(record({ status: "undone" }))).toBe(false);
    expect(isUndoableCapture(undefined)).toBe(false);
  });
});

// ── Source pins on the two trays and the review surface ──────────────────────

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("N1-08 — the Keep toast carries the reversal, in both trays", () => {
  const typedTray = read("src/components/capture/CaptureProposalsTray.tsx");
  const voiceTray = read("src/components/coach/ConversationProposalTray.tsx");

  it("the typed tray raises the provenance toast with an Undo action", () => {
    expect(typedTray).toMatch(/import \{[^}]*\bundoKeptCapture\b[^}]*\} from "\.\.\/\.\.\/lib\/captureUndo"/);
    expect(typedTray).toContain('t("elev.keep.kept")');
    expect(typedTray).toContain('label: t("elev.keep.undo")');
    expect(typedTray).toMatch(/undoChange: undoConversationChange/);
  });

  it("the voice tray raises the same toast, with copy from i18nElevation/journal", () => {
    expect(voiceTray).toMatch(/import \{[^}]*\bundoKeptCapture\b[^}]*\} from "\.\.\/\.\.\/lib\/captureUndo"/);
    expect(voiceTray).toMatch(/from "\.\.\/\.\.\/lib\/i18nElevation\/journal"/);
    expect(voiceTray).toContain('j["elev.keep.kept"]');
    expect(voiceTray).toContain('label: j["elev.keep.undo"]');
    // The copy is never inlined: the ternary picks the DICTIONARY (as this
    // file's existing COPY[language] does), never the string.
    // (This tray has its own inline COPY block, so a blanket Hebrew scan would
    // be meaningless — the pin is that the KEEP strings are not among them.)
    const voiceCode = voiceTray.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    // ("Undo" alone is too short to be a sentinel - it is a substring of
    // `confirmThenOfferUndo` and `trackKeepUndone` - so the scan uses the
    // sentences, which are unambiguous.)
    for (const key of ["elev.keep.kept", "elev.keep.undone", "elev.keep.undoFailed"]) {
      expect(voiceCode).not.toContain(journalEn[key]);
      expect(voiceCode).not.toContain(journalHe[key]);
    }
  });

  it("BOTH trays pass NO undo action on a milestone target", () => {
    expect(typedTray).toMatch(/target === "milestone" \? undefined :/);
    expect(voiceTray).toMatch(/if \(proposal\.target === "milestone"[\s\S]{0,40}\) return;/);
  });

  it("NEGATIVE CONTROL — a tray that offers undo on a milestone fails the exclusion pin", () => {
    const badTray = `
      toast(t("elev.keep.kept"), "success", undoActionFor(record.id));
      // no milestone check anywhere`;
    expect(badTray).not.toMatch(/target === "milestone" \? undefined :/);
    expect(badTray).not.toMatch(/if \(proposal\.target === "milestone"[\s\S]{0,40}\) return;/);
  });

  it("NEGATIVE CONTROL — the pre-fix tray bodies (a bare success toast, no action) fail the pins", () => {
    const preFixTyped = `toast(t("elev.waveR.capture.kept"), "success");`;
    const preFixVoice = `onClick={() => onConfirm(proposal)}`;
    expect(preFixTyped).not.toContain('label: t("elev.keep.undo")');
    expect(preFixVoice).not.toContain("confirmThenOfferUndo");
    // …and the current files do carry them.
    expect(typedTray).toContain('label: t("elev.keep.undo")');
    expect(voiceTray).toContain("confirmThenOfferUndo");
  });

  it("keep_this and keep_undone carry the SAME surface id, so the pair is readable", () => {
    // N1-01 x N1-08: the T+7 read is "every keep_undone has a preceding
    // keep_this in the same uid's stream". That only works if both name the
    // same surface — the typed tray's `surface` prop, passed to both.
    expect(typedTray).toMatch(/noteTypedKeepCommitted\(record, entry, surface\)/);
    expect(typedTray).toMatch(/trackKeepUndone\(surface\)/);
  });

  it("the reversal emits keep_undone through the ONE analytics seam (A's kpiEvents helper)", () => {
    for (const tray of [typedTray, voiceTray]) {
      expect(tray).toMatch(/import \{ trackKeepUndone \} from "\.\.\/\.\.\/lib\/kpiEvents"/);
      expect(tray).toMatch(/trackKeepUndone\(/);
    }
    // Never a second logger.
    expect(voiceTray).not.toMatch(/from "\.\.\/\.\.\/lib\/analytics"/);
  });
});

describe("N1-08 — the Undo control is a 44 px target in both locales", () => {
  const toastSrc = read("src/context/ToastContext.tsx");

  it("the ToastAction button carries the touch-target class that gives the 44 px box", () => {
    // The undo IS ToastContext's action slot — no new component and no new
    // surface, so the target size is whatever that button already guarantees.
    const actionBlock = toastSrc.slice(
      toastSrc.indexOf("tc.action && ("),
      toastSrc.indexOf("aria.dismiss"),
    );
    expect(actionBlock).toContain("touch-target");
    expect(actionBlock).toMatch(/\{tc\.action\.label\}/);
  });

  it("`touch-target` is a real 44 px floor in the stylesheet, not a name", () => {
    const css = read("src/index.css");
    const block = css.slice(css.indexOf(".touch-target"));
    const head = block.slice(0, 400);
    expect(head).toMatch(/min-(height|block-size)\s*:\s*var\(--touch-min\)/);
    expect(head).toMatch(/min-(width|inline-size)\s*:\s*var\(--touch-min\)/);
    // …and the token is a real 44 px, everywhere it is defined.
    const defs = [...css.matchAll(/--touch-min:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(defs.length).toBeGreaterThan(0);
    for (const d of defs) expect(d).toBe("44px");
  });

  it("the label is real copy in EN and HE, and is not left as a key", () => {
    for (const key of ["elev.keep.kept", "elev.keep.undo", "elev.keep.undone", "elev.keep.provenance"]) {
      expect(journalEn[key], `missing EN ${key}`).toBeTruthy();
      expect(journalHe[key], `missing HE ${key}`).toBeTruthy();
      expect(journalHe[key], `${key} is not Hebrew`).toMatch(/[֐-׿]/);
      expect(journalHe[key]).not.toBe(journalEn[key]);
    }
    // The provenance sentence says who proposed and who confirmed — and grades
    // nothing (clinical firewall: no verdict, no score, no percentage).
    expect(journalEn["elev.keep.kept"]).toBe("Kept · proposed by Arbor, confirmed by you");
    expect(journalEn["elev.keep.kept"]).not.toMatch(/%|confiden|certain|risk|score|high|low/i);
  });
});

describe("N1-08 — the provenance chip at keep time", () => {
  const review = read("src/components/overview/ConfirmCaptureReview.tsx");

  it("renders on the ai-draft path, from i18nElevation, and states only a factual source", () => {
    expect(review).toContain('data-testid="keep-provenance-chip"');
    expect(review).toContain('t("elev.keep.provenance")');
    expect(review).toMatch(/source === "ai-draft" && \(/);
  });

  it("carries no certainty wording — CODEX-7, which may never return", () => {
    expect(journalEn["elev.keep.provenance"]).not.toMatch(
      /confiden|certain|accura|probab|%|high|low|likely/i,
    );
  });

  it("NEGATIVE CONTROL — a chip that asserts confidence fails the CODEX-7 scan", () => {
    const badChip = "High confidence · proposed by Arbor";
    expect(badChip).toMatch(/confiden|certain|accura|probab|%|high|low|likely/i);
  });
});
