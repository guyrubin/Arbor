/**
 * B-STATUS-01 — Undo on a receipt is honest (components/ui/Receipt.tsx).
 *
 * The four Undo sites — a just-started plan, a kept insight (Behaviors and a
 * milestone's explanation), a keepsake (Milestones and Notice detail) and a
 * moment's edit — run their reversing write through ONE runner:
 *   - a failing write keeps the item AND the receipt, with one calm line that
 *     the undo didn't go through (EN + HE) and "Try again" on the button;
 *   - a retry that goes through clears the receipt and undoes the item;
 *   - a double tap issues ONE write (the button is disabled while it runs).
 * Each site is exercised with its own write against a fake store, and its
 * source is held to the wiring. Negative controls run the pre-change handlers.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});

import { Receipt, ReceiptUndoFailed, createUndoRunner, undoButtonState, undoThen, type UndoPhase } from "./Receipt";
import { translate } from "../../lib/i18n";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => readFileSync(path.join(here, "..", "..", rel), "utf8").replace(/\r\n/g, "\n");
const RECEIPT = src("components/ui/Receipt.tsx");

afterEach(() => { state.lang = "en"; });

/** A child collection whose next `failures` writes reject, like a refused Firestore write. */
function fakeStore<T extends { id: string }>(rows: T[], failures = 1) {
  let left = failures;
  const items = new Map(rows.map((r) => [r.id, r]));
  const calls: string[] = [];
  const settle = async (what: string, apply: () => void) => {
    calls.push(what);
    await Promise.resolve();
    if (left > 0) { left -= 1; throw new Error("permission-denied"); }
    apply();
  };
  return {
    items,
    calls,
    remove: (id: string) => settle(`remove:${id}`, () => { items.delete(id); }),
    upsert: (row: T) => settle(`upsert:${row.id}`, () => { items.set(row.id, row); }),
  };
}

/** A host's receipt slot (useReceiptNote) plus the Receipt's runner. */
function host(write: () => unknown) {
  let shown = true;
  const phases: UndoPhase[] = [];
  const runner = createUndoRunner((p) => phases.push(p));
  const onUndo = undoThen(write, () => { shown = false; });
  return { runner, phases, tap: () => runner.run(onUndo), shown: () => shown };
}

type Site = {
  name: string;
  /** The store as the receipt found it, and the write the site's Undo issues. */
  make: (failures: number) => { store: ReturnType<typeof fakeStore<{ id: string; text?: string }>>; write: () => unknown; kept: () => boolean; undone: () => boolean };
};

const SITES: Site[] = [
  {
    name: "plan start (Plans: deletePlan → the just-started plan goes)",
    make: (failures) => {
      const store = fakeStore([{ id: "plan-1" }], failures);
      const deletePlan = (id: string) => store.remove(id); // ArborContext.deletePlan
      return { store, write: () => deletePlan("plan-1"), kept: () => store.items.has("plan-1"), undone: () => !store.items.has("plan-1") };
    },
  },
  {
    name: "kept insight (Behaviors / milestone explanation: unkeepBehaviorInsight)",
    make: (failures) => {
      const store = fakeStore([{ id: "kept-1" }], failures);
      const unkeepBehaviorInsight = (id: string) => store.remove(id); // ArborContext.unkeepBehaviorInsight
      return { store, write: () => unkeepBehaviorInsight("kept-1"), kept: () => store.items.has("kept-1"), undone: () => !store.items.has("kept-1") };
    },
  },
  {
    name: "keepsake (Milestones / Notice detail: restore the previous keepsake)",
    make: (failures) => {
      const store = fakeStore([{ id: "ms-1", text: "new words" }], failures);
      const before = { id: "ms-1", text: "old words" };
      return { store, write: () => store.upsert(before), kept: () => store.items.get("ms-1")?.text === "new words", undone: () => store.items.get("ms-1")?.text === "old words" };
    },
  },
  {
    name: "moment edit (Shell's carried receipt: restoreLog → the row as it was)",
    make: (failures) => {
      const store = fakeStore([{ id: "log-1", text: "edited" }], failures);
      const restoreLog = (previous: { id: string; text: string }) => store.upsert(previous); // ArborContext.restoreLog
      return { store, write: () => restoreLog({ id: "log-1", text: "original" }), kept: () => store.items.get("log-1")?.text === "edited", undone: () => store.items.get("log-1")?.text === "original" };
    },
  },
];

describe("B-STATUS-01 · each Undo site: a failed write keeps the item and says so; a retry goes through; one write per tap", () => {
  for (const site of SITES) {
    describe(site.name, () => {
      for (const lang of ["en", "he"] as const) {
        it(`${lang}: a failing write keeps the item and the receipt, with the failure line and "Try again"`, async () => {
          state.lang = lang;
          const { write, kept } = site.make(1);
          const h = host(write);
          expect(await h.tap()).toBe(false);
          expect(kept()).toBe(true);
          expect(h.shown()).toBe(true); // the receipt did NOT claim it was undone
          expect(h.phases).toEqual(["pending", "failed"]);
          const html = renderToStaticMarkup(<ReceiptUndoFailed testId="x-undo-failed" />);
          expect(html.replace(/&#x27;/g, "'")).toContain(translate(lang, "elev.loop.receipt.undoFailed"));
          expect(html).toContain(`lang="${lang}"`);
          expect(html).toContain(`dir="${lang === "he" ? "rtl" : "ltr"}"`);
          expect(undoButtonState(h.runner.phase(), { label: translate(lang, "elev.keep.undo") }, translate(lang, "err.retry")).label)
            .toBe(translate(lang, "err.retry"));
        });
      }

      it("a retry that goes through undoes the item and clears the receipt", async () => {
        const { write, undone, store } = site.make(1);
        const h = host(write);
        await h.tap();
        expect(await h.tap()).toBe(true);
        expect(undone()).toBe(true);
        expect(h.shown()).toBe(false);
        expect(h.runner.phase()).toBe("idle");
        expect(store.calls).toHaveLength(2);
      });

      it("a double tap issues ONE write (and the button is disabled while it runs)", async () => {
        const { write, undone, store } = site.make(0);
        const h = host(write);
        const first = h.tap();
        expect(undoButtonState(h.runner.phase(), { label: "Undo" }, "Try again").disabled).toBe(true);
        const second = h.tap();
        expect(await second).toBe(false);
        expect(await first).toBe(true);
        expect(store.calls).toHaveLength(1);
        expect(undone()).toBe(true);
      });

      it("NEGATIVE CONTROL: the pre-change handler (clear first, write dropped) loses the receipt on a failure", async () => {
        const { write, kept } = site.make(1);
        let shown = true;
        const runner = createUndoRunner();
        await runner.run(() => { shown = false; void Promise.resolve(write()).catch(() => undefined); });
        await new Promise((r) => setTimeout(r, 0));
        expect(kept()).toBe(true);
        expect(shown).toBe(false); // the parent was told it was undone: the bug this fixes
      });
    });
  }
});

describe("B-STATUS-01 · the runner and the button", () => {
  it("a synchronous throw counts as a failure too; success returns to idle", async () => {
    const r = createUndoRunner();
    expect(await r.run(() => { throw new Error("x"); })).toBe(false);
    expect(r.phase()).toBe("failed");
    expect(await r.run(() => undefined)).toBe(true);
    expect(r.phase()).toBe("idle");
  });

  it("the button: Undo when idle, disabled + busy while pending, Try again once failed; a host's disabled holds", () => {
    const undo = { label: "Undo" };
    expect(undoButtonState("idle", undo, "Try again")).toEqual({ label: "Undo", disabled: false, busy: false });
    expect(undoButtonState("pending", undo, "Try again")).toEqual({ label: "Undo", disabled: true, busy: true });
    expect(undoButtonState("failed", undo, "Try again")).toEqual({ label: "Try again", disabled: false, busy: false });
    expect(undoButtonState("idle", { ...undo, disabled: true }, "Try again").disabled).toBe(true);
  });

  it("Receipt wires its Undo through the runner, the button state, the failure line and the polite region", () => {
    expect(RECEIPT).toMatch(/onClick=\{\(\) => \{ void undoRun\.run\(undo\.onUndo\); \}\}/);
    expect(RECEIPT).toMatch(/disabled=\{undoButton!\.disabled\}/);
    expect(RECEIPT).toMatch(/\{undoButton!\.label\}/);
    expect(RECEIPT).toMatch(/\{undo && failed && <ReceiptUndoFailed /);
    expect(RECEIPT).toMatch(/if \(failed\) announcePolite\(failedText\);/);
    // the failure line carries no live role of its own (read once, by the region)
    expect(renderToStaticMarkup(<ReceiptUndoFailed />)).not.toMatch(/role=|aria-live/);
  });

  it("first paint: Undo as given, enabled, no failure line", () => {
    const html = renderToStaticMarkup(<Receipt testId="r" undo={{ label: "Undo", onUndo: () => undefined, testId: "r-undo" }}>Kept.</Receipt>);
    expect(html).toMatch(/<button[^>]*data-testid="r-undo"[^>]*data-undo="idle"[^>]*>Undo<\/button>/);
    expect(html).not.toMatch(/<button[^>]*disabled/);
    expect(html).not.toContain("data-receipt-undo-failed");
  });

  it("the failure copy: EN and HE, calm, parent register, says it is still kept", () => {
    const en = translate("en", "elev.loop.receipt.undoFailed");
    const he = translate("he", "elev.loop.receipt.undoFailed");
    expect(en).not.toBe("elev.loop.receipt.undoFailed");
    expect(he).not.toBe("elev.loop.receipt.undoFailed");
    expect(en).toMatch(/still kept/);
    expect(he).toMatch(/עדיין שמור/);
    for (const s of [en, he]) expect(s).not.toMatch(/error|fail|server|sync|network|!/i);
    expect(translate("he", "err.retry")).not.toBe("err.retry");
  });
});

describe("B-STATUS-01 · the four sites return their write and clear only after it", () => {
  it("ArborContext: deletePlan and unkeepBehaviorInsight return the write (no void); restoreLog already does", () => {
    const ctx = src("context/ArborContext.tsx");
    expect(ctx).toContain("const deletePlan = (id: string) => plansCol.remove(id);");
    expect(ctx).toContain("const unkeepBehaviorInsight = (id: string) => insightsCol.remove(id);");
    expect(ctx).toContain("const restoreLog = (previous: BehaviorLog) => logsCol.upsert(previous);");
    // NEGATIVE CONTROL: the pre-change bodies dropped the write
    expect("const deletePlan = (id: string) => void plansCol.remove(id);").not.toContain("=> plansCol.remove(id);");
  });

  it("Plans, Behaviors, Milestones, Notice detail and the moment edit each use undoThen(write, clear)", () => {
    expect(src("components/tabs/PlansTab.tsx")).toContain('onUndo: undoThen(() => deletePlan(lead.id), startedReceipt.clear)');
    expect(src("components/tabs/BehaviorsTab.tsx")).toContain('onUndo: undoThen(() => unkeepBehaviorInsight(id), keptReceipt.clear)');
    const ms = src("components/tabs/MilestonesTab.tsx");
    expect(ms).toContain("onUndo: undoThen(onUndo, msReceipt.clear)");
    expect(ms).toContain("() => unkeepBehaviorInsight(kept)");
    expect(ms).toContain("() => (before ? keepsakeCol.upsert(keepsakeDoc(before)) : keepsakeCol.remove(saved.milestoneId))");
    const notice = src("components/companion/NoticeObjectDetail.tsx");
    expect(notice).toMatch(/onUndo: undoThen\(\(\) => \{\s*if \(!owns\(\)\) throw new Error\([^)]*\);\s*return before\s*\? keepsakes\.upsert\(keepsakeDoc\(before\), \{ requireAcknowledgement: true \}\)\s*: keepsakes\.remove\(saved\.milestoneId, \{ requireAcknowledgement: true \}\);\s*\}, evidenceReceipt\.clear\)/);
    expect(notice).not.toContain(".catch(() => undefined)");
    expect(src("components/overview/QuickLogModal.tsx")).toContain('onUndo: undoThen(() => restoreLog(beforeEdit), () => clearCarriedReceipt("app"))');
  });
});
