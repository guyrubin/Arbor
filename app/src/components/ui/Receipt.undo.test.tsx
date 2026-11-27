/**
 * B-STATUS-01 — Undo on a receipt is honest (components/ui/Receipt.tsx).
 *
 * Every Receipt Undo — a just-started plan, a kept insight (Behaviors and a
 * milestone's explanation), a keepsake (Milestones and Notice detail), a
 * moment's edit, and the family plan, screening re-check, fresh grant, visit
 * follow-up / outcome / home program, bedtime night / kept answer and logged
 * play — runs its reversing write through ONE runner:
 *   - a failing write keeps the item AND the receipt, with one calm line that
 *     the undo didn't go through (EN + HE) and "Try again" on the button;
 *   - a retry that goes through clears the receipt and undoes the item;
 *   - a double tap issues ONE write (the button is disabled while it runs).
 * Each site is exercised with its own write against a fake store, and its
 * source is held to the wiring. Negative controls run the pre-change handlers.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync, statSync } from "node:fs";
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
  /** How many writes one successful undo issues. */
  ops: number;
  make: (failures: number) => { store: ReturnType<typeof fakeStore<{ id: string; text?: string }>>; write: () => unknown; kept: () => boolean; undone: () => boolean };
};

const SITES: Site[] = [
  {
    ops: 1,
    name: "plan start (Plans: deletePlan → the just-started plan goes)",
    make: (failures) => {
      const store = fakeStore([{ id: "plan-1" }], failures);
      const deletePlan = (id: string) => store.remove(id); // ArborContext.deletePlan
      return { store, write: () => deletePlan("plan-1"), kept: () => store.items.has("plan-1"), undone: () => !store.items.has("plan-1") };
    },
  },
  {
    ops: 1,
    name: "kept insight (Behaviors / milestone explanation: unkeepBehaviorInsight)",
    make: (failures) => {
      const store = fakeStore([{ id: "kept-1" }], failures);
      const unkeepBehaviorInsight = (id: string) => store.remove(id); // ArborContext.unkeepBehaviorInsight
      return { store, write: () => unkeepBehaviorInsight("kept-1"), kept: () => store.items.has("kept-1"), undone: () => !store.items.has("kept-1") };
    },
  },
  {
    ops: 1,
    name: "keepsake (Milestones / Notice detail: restore the previous keepsake)",
    make: (failures) => {
      const store = fakeStore([{ id: "ms-1", text: "new words" }], failures);
      const before = { id: "ms-1", text: "old words" };
      return { store, write: () => store.upsert(before), kept: () => store.items.get("ms-1")?.text === "new words", undone: () => store.items.get("ms-1")?.text === "old words" };
    },
  },
  {
    ops: 1,
    name: "moment edit (Shell's carried receipt: restoreLog → the row as it was)",
    make: (failures) => {
      const store = fakeStore([{ id: "log-1", text: "edited" }], failures);
      const restoreLog = (previous: { id: string; text: string }) => store.upsert(previous); // ArborContext.restoreLog
      return { store, write: () => restoreLog({ id: "log-1", text: "original" }), kept: () => store.items.get("log-1")?.text === "edited", undone: () => store.items.get("log-1")?.text === "original" };
    },
  },
  // ── the remaining Receipt Undo callers ─────────────────────────────────────
  {
    ops: 2,
    name: "family plan (FamilyPlanView: useFamilyPlan's undo removes the added dates and writes back the changed ones)",
    make: (failures) => {
      const store = fakeStore([{ id: "fp-new" }, { id: "fp-old", text: "moved" }], failures);
      const created = ["fp-new"];
      const restored = [{ id: "fp-old", text: "as it was" }];
      // useFamilyPlan's undo: awaits every write and (B-STATUS-01) lets a refusal through
      const undo = async () => {
        for (const rid of created) await store.remove(rid);
        for (const row of restored) await store.upsert(row);
      };
      return { store, write: () => undo(), kept: () => store.items.has("fp-new"), undone: () => !store.items.has("fp-new") && store.items.get("fp-old")?.text === "as it was" };
    },
  },
  {
    ops: 1,
    name: "screening re-check (Screening: the record written back as it was)",
    make: (failures) => {
      const store = fakeStore([{ id: "scr-1", text: "recheck due" }], failures);
      const base = { id: "scr-1", text: "no recheck" };
      return { store, write: () => store.upsert(base), kept: () => store.items.get("scr-1")?.text === "recheck due", undone: () => store.items.get("scr-1")?.text === "no recheck" };
    },
  },
  {
    ops: 1,
    name: "fresh grant (TrustedSharing: revoke the grant, then re-read own grants)",
    make: (failures) => {
      const store = fakeStore([{ id: "grant-1" }], failures);
      let reloads = 0;
      const api = { revokeShare: (id: string) => store.remove(id) };
      const reloadOwn = async () => { reloads += 1; };
      return {
        store,
        write: () => api.revokeShare("grant-1").then(() => reloadOwn()),
        kept: () => store.items.has("grant-1") && reloads === 0,
        undone: () => !store.items.has("grant-1") && reloads === 1,
      };
    },
  },
  {
    ops: 2,
    name: "visit follow-up (Appointments: the follow-up goes, the booking is written back)",
    make: (failures) => {
      const store = fakeStore([{ id: "fu-1" }, { id: "appt-1", text: "done" }], failures);
      const wasDone = false;
      const write = async () => {
        await store.remove("fu-1");
        if (!wasDone) await store.upsert({ id: "appt-1", text: "booked" });
      };
      return { store, write, kept: () => store.items.has("fu-1") && store.items.get("appt-1")?.text === "done", undone: () => !store.items.has("fu-1") && store.items.get("appt-1")?.text === "booked" };
    },
  },
  {
    ops: 2,
    name: "visit outcome (ConsultTab: the follow-up goes, the booking is written back)",
    make: (failures) => {
      const store = fakeStore([{ id: "fu-2" }, { id: "appt-2", text: "done" }], failures);
      const write = async () => {
        await store.remove("fu-2");
        await store.upsert({ id: "appt-2", text: "booked" });
      };
      return { store, write, kept: () => store.items.has("fu-2"), undone: () => !store.items.has("fu-2") && store.items.get("appt-2")?.text === "booked" };
    },
  },
  {
    ops: 5,
    name: "home program (ConsultTab: the program, its goals and the follow-up go; the superseded program and the booking come back)",
    make: (failures) => {
      const store = fakeStore([{ id: "prog-new" }, { id: "prog-old", text: "superseded" }, { id: "goal-1" }, { id: "fu-3" }, { id: "appt-3", text: "done" }], failures);
      const write = async () => {
        await store.remove("prog-new");
        await store.upsert({ id: "prog-old", text: "active" });
        await store.remove("goal-1");
        await store.remove("fu-3");
        await store.upsert({ id: "appt-3", text: "booked" });
      };
      return {
        store, write,
        kept: () => store.items.has("prog-new") && store.items.has("goal-1"),
        undone: () => ["prog-new", "goal-1", "fu-3"].every((id) => !store.items.has(id)) && store.items.get("prog-old")?.text === "active",
      };
    },
  },
  {
    ops: 1,
    name: "goodnight saved (BedtimeStoriesTab: deleteLog of the night's entry)",
    make: (failures) => {
      const store = fakeStore([{ id: "night-1" }], failures);
      const deleteLog = (id: string) => store.remove(id);
      return { store, write: () => deleteLog("night-1"), kept: () => store.items.has("night-1"), undone: () => !store.items.has("night-1") };
    },
  },
  {
    ops: 1,
    name: "kept answer (BedtimeStoriesTab: deleteLog of the kept words)",
    make: (failures) => {
      const store = fakeStore([{ id: "said-1" }], failures);
      const keptIds: Record<number, string> = { 0: "said-1" };
      const deleteLog = (id: string) => store.remove(id);
      return { store, write: () => { const id = keptIds[0]; return id ? deleteLog(id) : undefined; }, kept: () => store.items.has("said-1"), undone: () => !store.items.has("said-1") };
    },
  },
  {
    ops: 1,
    name: "play logged (DailyPlayTab: undoPlayCompletion removes the day's log this tap wrote)",
    make: (failures) => {
      const store = fakeStore([{ id: "play-1" }], failures);
      const undoPlayCompletion = (done: { id: string; created: boolean }) => (done.created ? store.remove(done.id) : Promise.resolve());
      return { store, write: () => undoPlayCompletion({ id: "play-1", created: true }), kept: () => store.items.has("play-1"), undone: () => !store.items.has("play-1") };
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
        expect(store.calls).toHaveLength(1 + site.ops); // the refused write, then the retry's
      });

      it("a double tap issues ONE write (and the button is disabled while it runs)", async () => {
        const { write, undone, store } = site.make(0);
        const h = host(write);
        const first = h.tap();
        expect(undoButtonState(h.runner.phase(), { label: "Undo" }, "Try again").disabled).toBe(true);
        const second = h.tap();
        expect(await second).toBe(false);
        expect(await first).toBe(true);
        expect(store.calls).toHaveLength(site.ops); // one undo's writes, once
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

describe("B-STATUS-01 · the remaining Receipt Undo callers return their write and clear only after it", () => {
  it("each uses undoThen(write, clear); no write is dropped with void", () => {
    expect(src("components/familyPlan/FamilyPlanView.tsx")).toContain("onUndo: undoThen(() => plan.receipt?.undo?.(), () => undefined)");
    const fp = src("hooks/useFamilyPlan.ts");
    const fpUndo = fp.slice(fp.indexOf("undo: async () => {"), fp.indexOf("return true;", fp.indexOf("undo: async () => {")));
    expect(fpUndo).toContain("await collection.remove(rid);");
    expect(fpUndo).not.toContain("catch"); // a refusal reaches the Receipt
    expect(src("components/sections/Screening.tsx")).toContain("onUndo: undoThen(() => col.upsert(base), recheckReceipt.clear)");
    const sharing = src("components/sections/TrustedSharing.tsx");
    expect(sharing).toContain("onUndo: undoThen(() => api.revokeShare(created.id).then(() => reloadOwn()), () => {");
    expect(sharing).not.toContain("void api.revokeShare(created.id)");
    expect(src("components/sections/Appointments.tsx")).toMatch(/onUndo: undoThen\(async \(\) => \{\s*await followUpsCol\.remove\(record\.id\);\s*if \(!wasDone\) await apptsCol\.upsert\(a\);\s*\}, receipt\.clear\)/);
    const consult = src("components/tabs/ConsultTab.tsx");
    expect(consult).toMatch(/onUndo: undoThen\(async \(\) => \{\s*await followUpsCol\.remove\(record\.id\);\s*if \(!wasDone\) await apptsCol\.upsert\(before\);\s*\}, \(\) => \{ receipt\.clear\(\); setOutcome\(note\); \}\)/);
    expect(consult).toMatch(/onUndo: undoThen\(async \(\) => \{\s*await programsCol\.remove\(w\.enrolment\.id\);[\s\S]{0,400}?\}, receipt\.clear\)/);
    const bed = src("components/tabs/BedtimeStoriesTab.tsx");
    expect(bed).toContain("onUndo: undoThen(() => deleteLog(written.id), nightReceipt.clear)");
    expect(bed).toMatch(/onUndo: undoThen\(\(\) => \{\s*const id = keptIds\.current\[i\];\s*return id \? deleteLog\(id\) : undefined;/);
    expect(src("components/tabs/DailyPlayTab.tsx")).toContain("onUndo: undoThen(() => undoPlayCompletion(done), () => { playReceipt.clear(); restore(); })");
    expect(src("context/ArborContext.tsx")).toContain("done.created ? playLogCol.remove(done.id) : Promise.resolve();");
    for (const rel of ["components/tabs/ConsultTab.tsx", "components/sections/Appointments.tsx", "components/tabs/BedtimeStoriesTab.tsx"]) {
      expect(src(rel), rel).not.toMatch(/void (?:followUpsCol|apptsCol|programsCol|familyGoalsCol)\.(?:remove|upsert)\([^)]*\);\s*(?:for|if|setOutcome|\})/);
    }
  });
});

/* The guard: every Receipt Undo in src/ goes through undoThen. A Receipt undo
 * is an object with `label` then (optionally `testId`) then `onUndo`. Three
 * callers keep their own honest pending/failure state and are named here. */
const SRC_ROOT = path.join(here, "..", "..");
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}
const RECEIPT_UNDO = /label:\s*[^,\n]+,\s*(?:\/\/[^\n]*\s*)*(?:testId:\s*[^,\n]+,\s*(?:\/\/[^\n]*\s*)*)?onUndo\b(\s*:\s*undoThen\()?(.{0,40})/g;
type UndoSite = { file: string; honest: boolean; rest: string };
function receiptUndos(file: string, text: string): UndoSite[] {
  return [...text.matchAll(RECEIPT_UNDO)].map((m) => ({ file, honest: !!m[1], rest: m[2] }));
}
/** Callers that own their pending / failure state (reviewed, B-STATUS-01). */
const OWN_STATE: Record<string, string> = {
  // NoticeCard's undo runs through its own `run("undo", …)` busy/failed state
  "components/loop/NoticeCard.tsx": ": undo, testId: \"notice-undo\"",
  // the removal's Undo has its own restoring / restore_failed / restore_queued states
  "components/companion/NoticeObjectDetail.tsx": ": () => void undoRemoval()",
  // forwards its host's onUndo prop (the practice loop's own undo)
  "components/loop/PracticeCard.tsx": ", testId: \"practice-undo\"",
};

describe("B-STATUS-01 · guard: every Receipt Undo in src/ goes through undoThen", () => {
  const all = sourceFiles(SRC_ROOT).flatMap((f) => receiptUndos(path.relative(SRC_ROOT, f).split(path.sep).join("/"), readFileSync(f, "utf8").replace(/\r\n/g, "\n")));

  it("non-vacuity: the scan finds every known Receipt Undo (17), each honest or named", () => {
    expect(all.length).toBeGreaterThanOrEqual(17);
    const files = new Set(all.map((u) => u.file));
    for (const f of ["components/tabs/PlansTab.tsx", "components/tabs/BehaviorsTab.tsx", "components/tabs/MilestonesTab.tsx", "components/overview/QuickLogModal.tsx",
      "components/familyPlan/FamilyPlanView.tsx", "components/sections/Screening.tsx", "components/sections/TrustedSharing.tsx", "components/sections/Appointments.tsx",
      "components/tabs/ConsultTab.tsx", "components/tabs/BedtimeStoriesTab.tsx", "components/tabs/DailyPlayTab.tsx"]) expect(files.has(f), f).toBe(true);
  });

  it("every one is undoThen(…) or a named caller with its own state (each name still matches: shrink-only)", () => {
    const named = (u: UndoSite) => !!OWN_STATE[u.file] && u.rest.startsWith(OWN_STATE[u.file]);
    const offenders = all.filter((u) => !u.honest && !named(u));
    expect(offenders.map((u) => `${u.file}::${JSON.stringify(u.rest)}`)).toEqual([]);
    for (const [file, rest] of Object.entries(OWN_STATE)) {
      expect(all.some((u) => u.file === file && !u.honest && u.rest.startsWith(rest)), file).toBe(true);
    }
  });

  it("NEGATIVE CONTROL: the pre-change Screening and DailyPlay handlers, put back into real source, are caught", () => {
    const screening = src("components/sections/Screening.tsx").replace(
      "onUndo: undoThen(() => col.upsert(base), recheckReceipt.clear),",
      "onUndo: () => { recheckReceipt.clear(); void col.upsert(base); },",
    );
    expect(screening).toContain("void col.upsert(base); }");
    expect(receiptUndos("components/sections/Screening.tsx", screening).filter((u) => !u.honest)).toHaveLength(1);
    const play = src("components/tabs/DailyPlayTab.tsx").replace(
      "onUndo: undoThen(() => undoPlayCompletion(done), () => { playReceipt.clear(); restore(); }),",
      "onUndo: () => { playReceipt.clear(); undoPlayCompletion(done); restore(); },",
    );
    expect(play).toContain("undoPlayCompletion(done); restore(); }");
    expect(receiptUndos("components/tabs/DailyPlayTab.tsx", play).filter((u) => !u.honest)).toHaveLength(1);
  });
});
